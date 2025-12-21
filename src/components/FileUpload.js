 "use client";

import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import AddressSearch from "./AddressSearch";
import { API_URL } from "../lib/apiConfig";
import RentalCommissionForm from "./RentalCommissionForm";

const MAX_MB = 30;

const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const LICENSED = ["VA", "MD", "DC"];


const safePart = (s) =>
  (s || "")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 .-]/g, "")
    .trim();

const generateFilename = (
  addr,
  originalName,
  transactionType,
  tenantBrokerInvolved
) => {
  const ext = (originalName.split(".").pop() || "pdf").toLowerCase();
  const streetNumber = String(addr?.streetNumber || "").replace(/\D/g, "");
  const streetName = safePart(addr?.streetName);
  const city = safePart(addr?.city);
  const state = addr?.state ? ` ${addr.state}` : "";

  if (transactionType === "RENTAL") {
    const suffix = tenantBrokerInvolved ? "Rental_w9" : "Rental";
    return `${streetNumber} ${streetName} ${city} ${state} ${suffix}.${ext}`;
  }

  return `${streetNumber} ${streetName}$ ${city} ${state} Contract.${ext}`;
};

const generateRentalLeaseName = (addr) =>
  generateFilename(addr, "lease.pdf", "RENTAL", false);

const generateRentalW9Name = (addr) =>
  `${addr.streetNumber} ${safePart(addr.streetName)} ${safePart(addr.city)} (${addr.state}) Rental_w9.pdf`;

export default function FileUpload() {
  const router = useRouter();

  const [file, setFile] = useState(null);      // Lease or Purchase contract
  const [w9File, setW9File] = useState(null);  // Tenant broker W-9
  const [address, setAddress] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [transactionType, setTransactionType] = useState("");
  const [tenantBrokerInvolved, setTenantBrokerInvolved] = useState(null);
  const [rentalCommission, setRentalCommission] = useState(null);

  const validate = () => {
    if (!transactionType)
      return toast.error("Please select Purchase or Rental"), false;

    if (!address)
      return toast.error("Please search and select a property address (VA/MD/DC)"), false;

    if (!LICENSED.includes(address?.state))
      return toast.error("Only VA, MD, DC addresses are allowed."), false;

    if (!file)
      return toast.error(
        transactionType === "RENTAL"
          ? "Please upload the rental lease"
          : "Please choose a file"
      ), false;

    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error("File must be less than 30 MB"), false;

    if (!ALLOWED.includes(file.type))
      return toast.error("Only PDF, DOC, DOCX allowed"), false;

    if (transactionType === "RENTAL") {
      if (tenantBrokerInvolved === null)
        return toast.error("Please confirm if a tenant broker is involved"), false;

      if (tenantBrokerInvolved === true && !w9File)
        return toast.error("Please upload tenant broker W-9"), false;

      if (tenantBrokerInvolved === true && w9File) {
        if (w9File.size > MAX_MB * 1024 * 1024)
          return toast.error("W-9 must be less than 30 MB"), false;

        if (!ALLOWED.includes(w9File.type))
          return toast.error("W-9 must be a PDF, DOC, or DOCX"), false;
      }
    }

    return true;
  };

  const upload = async () => {
    try {
      if (!validate()) return;

      setUploading(true);
      setProgress(0);

      const { Auth } = await import("aws-amplify");
      const session = await Auth.currentSession();
      const accessToken = session.getAccessToken().getJwtToken();

      const idPayload = session.getIdToken().payload;
      const agentName =
        idPayload.given_name && idPayload.family_name
          ? `${idPayload.given_name}-${idPayload.family_name}`.replace(/\s+/g, "-")
          : (idPayload.email || "").split("@")[0];

      const presignAndUpload = async (filename, fileToUpload, fileRole) => {
        const res = await fetch(`${API_URL}/presign`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename,
            contentType: fileToUpload.type,
            fileSize: fileToUpload.size,
            agentName,
            address,
            transactionType,
            tenantBrokerInvolved,
            fileRole, // 🔑 NEW: tells backend what this file represents
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.url) {
          throw new Error(data?.message || "Presign failed");
        }

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", data.url);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setProgress(Math.round((e.loaded / e.total) * 100));
          };

          xhr.onload = () =>
            xhr.status === 200
              ? resolve()
              : reject(new Error(`Upload failed (${xhr.status})`));

          xhr.onerror = () => reject(new Error("Upload error"));
          xhr.send(fileToUpload);
        });
      };

      // Upload lease or purchase contract
      const primaryName =
        transactionType === "RENTAL"
          ? generateRentalLeaseName(address)
          : generateFilename(address, file.name, transactionType);

      await presignAndUpload(
        primaryName,
        file,
        transactionType === "RENTAL" ? "LEASE" : "PURCHASE"
      );


      // Upload W-9 if needed
      if (transactionType === "RENTAL" && tenantBrokerInvolved === true) {
        const w9Name = generateRentalW9Name(address);
        //await presignAndUpload(w9Name, w9File);
        await presignAndUpload(w9Name, w9File, "W9");
      }

      // ✅ Save rental commission disbursement JSON (AFTER uploads)
      if (transactionType === "RENTAL" && rentalCommission) {
        try {
          const res = await fetch(`${API_URL}/contracts/rental/commission`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              address,
              tenantBrokerInvolved,
              rentalCommission,
              agentName, // 🔑 REQUIRED for consistent S3 path
            }),
          });

          if (!res.ok) {
            console.error("Commission save failed", await res.text());
          }
        } catch (e) {
          console.error("Commission save error", e);
        }
      }

      toast.success("Upload complete!");
      //router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Unexpected upload error");
    } finally {
      setUploading(false);
      // 🔒 Guarantee exit from upload screen
      router.replace("/dashboard");
    }
  };

  return (
    <div className="space-y-4">
      {/* Transaction Type */}
      <div className="bg-slate-50 p-3 rounded space-y-2">
        <div className="text-xs font-medium text-slate-600">
          Transaction Type <span className="text-red-500">*</span>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={transactionType === "PURCHASE"}
              onChange={() => {
                setTransactionType("PURCHASE");
                setAddress(null);
                setTenantBrokerInvolved(null);
                setW9File(null);
                setRentalCommission(null); // 🔒 clear stale rental data
              }}
            />
            Purchase
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={transactionType === "RENTAL"}
              onChange={() => {
                setTransactionType("RENTAL");
                setAddress(null);
                setTenantBrokerInvolved(null);
                setW9File(null);
                setRentalCommission(null); // 🔒 reset for fresh rental flow
              }}
            />
            Rental
          </label>
        </div>
      </div>

      <AddressSearch
        value={address}
        onChange={setAddress}
        disabled={!transactionType}
      />

      {transactionType === "RENTAL" && address && (
        <div className="bg-slate-50 p-3 rounded space-y-3">
          {/* ===============================
            TENANT BROKER QUESTION
          =============================== */}
          <div className="text-xs font-medium text-slate-600">
            Is there a tenant broker involved?
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={tenantBrokerInvolved === true}
                onChange={() => setTenantBrokerInvolved(true)}
              />
              Yes
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={tenantBrokerInvolved === false}
                onChange={() => setTenantBrokerInvolved(false)}
              />
              No
            </label>
          </div>

          {/* ===============================
            COMMISSION DISBURSEMENT FORM
            (Shown AFTER selection)
          =============================== */}
          {tenantBrokerInvolved !== null && (
            <RentalCommissionForm
              hasTenantBroker={tenantBrokerInvolved === true}
              onChange={(data) => {
                setRentalCommission(data);
              }}
            />
          )}
        </div>
      )}


      {/* Rental Lease Upload */}
      {transactionType === "RENTAL" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Upload Rental Lease
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={!address}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      )}

      {/* Tenant Broker W-9 */}
      {transactionType === "RENTAL" && tenantBrokerInvolved === true && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Upload Tenant Broker W-9
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={!address}
            onChange={(e) => setW9File(e.target.files?.[0] || null)}
          />
        </div>
      )}

      {/* Purchase */}
      {transactionType === "PURCHASE" && (
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          disabled={!address}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      )}

      {address && transactionType === "RENTAL" && (
        <div className="bg-slate-50 p-3 rounded text-sm space-y-1">
          <div className="text-xs text-slate-500">S3 file names</div>
          {file && <div className="font-semibold">{generateRentalLeaseName(address)}</div>}
          {tenantBrokerInvolved === true && w9File && (
            <div className="font-semibold">{generateRentalW9Name(address)}</div>
          )}
        </div>
      )}

      {address && transactionType === "PURCHASE" && file && (
        <div className="bg-slate-50 p-3 rounded text-sm">
          <div className="text-xs text-slate-500">S3 file name</div>
          <div className="font-semibold">
            {generateFilename(address, file.name, transactionType)}
          </div>
        </div>
      )}

      <button
        onClick={upload}
        disabled={
          uploading ||
          !address ||
          !transactionType ||
          !file ||
          (transactionType === "RENTAL" && tenantBrokerInvolved === null) ||
          (transactionType === "RENTAL" && tenantBrokerInvolved === true && !w9File)
        }
        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}