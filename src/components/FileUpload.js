"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import AddressSearch from "./AddressSearch";
import { API_URL } from "../lib/apiConfig";

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
  const state = addr?.state ? ` (${addr.state})` : "";
  const [w9File, setW9File] = useState(null); // Tenant broker W-9 (Rental only)
  const generateRentalLeaseName = (addr) =>
  generateFilename(addr, "lease.pdf", "RENTAL", false);

  const generateRentalW9Name = (addr) =>
    generateFilename(addr, "w9.pdf", "RENTAL", true);



  if (transactionType === "RENTAL") {
    const suffix = tenantBrokerInvolved ? "Rental_W9" : "Rental";
    return `${streetNumber} ${streetName}${state} ${suffix}.${ext}`;
  }

  return `${streetNumber} ${streetName}${state} Contract.${ext}`;
};

export default function FileUpload() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [address, setAddress] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [transactionType, setTransactionType] = useState("");
  const [tenantBrokerInvolved, setTenantBrokerInvolved] = useState(null);

  const validate = (f) => {
    if (!transactionType)
      return toast.error("Please select Purchase or Rental"), false;

    if (!address)
      return toast.error(
        "Please search and select a property address (VA/MD/DC)"
      ), false;

    if (!LICENSED.includes(address?.state))
      return toast.error("Only VA, MD, DC addresses are allowed."), false;

    if (!f) return toast.error("Please choose a file"), false;

    if (f.size > MAX_MB * 1024 * 1024)
      return toast.error("File must be less than 30 MB"), false;

    if (!ALLOWED.includes(f.type))
      return toast.error("Only PDF, DOC, DOCX allowed"), false;

    if (transactionType === "RENTAL" && tenantBrokerInvolved === null)
      return toast.error(
        "Please confirm if a tenant broker is involved"
      ), false;
    if (transactionType === "RENTAL") {
      if (!file)
        return toast.error("Please upload the rental lease"), false;

      if (tenantBrokerInvolved === true && !w9File)
        return toast.error("Please upload tenant broker W-9"), false;
    }
    return true;
  };

  const upload = async () => {
    try {
      if (!validate(file)) return;

      setUploading(true);
      setProgress(0);

      const { Auth } = await import("aws-amplify");
      const session = await Auth.currentSession();
      const accessToken = session.getAccessToken().getJwtToken();

      const idPayload = session.getIdToken().payload;
      const agentName =
        idPayload.given_name && idPayload.family_name
          ? `${idPayload.given_name}-${idPayload.family_name}`.replace(
              /\s+/g,
              "-"
            )
          : (idPayload.email || "").split("@")[0];

      // 1️⃣ Upload rental lease
      const leaseName =
        transactionType === "RENTAL"
          ? generateRentalLeaseName(address)
          : generateFilename(address, file.name, transactionType);

      await presignAndUpload({
        filename: leaseName,
        file,
      });

      // 2️⃣ Upload W-9 if required
      if (transactionType === "RENTAL" && tenantBrokerInvolved === true) {
        const w9Name = generateRentalW9Name(address);

        await presignAndUpload({
          filename: w9Name,
          file: w9File,
        });
      }


      const res = await fetch(`${API_URL}/presign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: desiredName,
          contentType: file.type,
          fileSize: file.size,
          address,
          agentName,
          transactionType,
          tenantBrokerInvolved,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        toast.error(data?.message || "Presign failed");
        setUploading(false);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.url);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          toast.success("Upload complete!");
          setTimeout(() => router.push("/dashboard"), 600);
        } else {
          toast.error(`Upload failed (${xhr.status})`);
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        toast.error("Upload error");
        setUploading(false);
      };

      xhr.send(file);
    } catch (err) {
      console.error(err);
      toast.error("Unexpected upload error");
      setUploading(false);
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
        <div className="bg-slate-50 p-3 rounded space-y-2">
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

      {/* Purchase (unchanged behavior) */}
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

          {file && (
            <div className="font-semibold">
              {generateRentalLeaseName(address)}
            </div>
          )}

          {tenantBrokerInvolved === true && w9File && (
            <div className="font-semibold">
              {generateRentalW9Name(address)}
            </div>
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
          (transactionType === "RENTAL" &&
            tenantBrokerInvolved === true &&
            !w9File)
        }

        className="w-full bg-blue-600 text-white py-2 rounded"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}