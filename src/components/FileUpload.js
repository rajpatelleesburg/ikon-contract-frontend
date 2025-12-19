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

const generateFilename = (addr, originalName) => {
  const ext = (originalName.split(".").pop() || "pdf").toLowerCase();
  const streetNumber = String(addr?.streetNumber || "").replace(/\D/g, "");
  const streetName = safePart(addr?.streetName);
  const state = addr?.state ? ` (${addr.state})` : "";
  return `${streetNumber} ${streetName}${state} Contract.${ext}`;
};

export default function FileUpload() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [address, setAddress] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const validate = (f) => {
    if (!address) return toast.error("Please search and select a property address (VA/MD/DC)"), false;
    if (!LICENSED.includes(address?.state)) return toast.error("Only VA, MD, DC addresses are allowed."), false;
    if (!f) return toast.error("Please choose a file"), false;
    if (f.size > MAX_MB * 1024 * 1024) return toast.error("File must be less than 30 MB"), false;
    if (!ALLOWED.includes(f.type)) return toast.error("Only PDF, DOC, DOCX allowed"), false;
    return true;
  };

  const upload = async () => {
    try {
      if (!validate(file)) return;

      setUploading(true);
      setProgress(0);

      // ✅ Lazy import Amplify Auth inside handler (build-safe)
      const { Auth } = await import("aws-amplify");

      const session = await Auth.currentSession();
      const accessToken = session.getAccessToken().getJwtToken();

      // ✅ Use ID token payload for human name (folder naming)
      const idPayload = session.getIdToken().payload;
      const agentName =
        idPayload.given_name && idPayload.family_name
          ? `${idPayload.given_name}-${idPayload.family_name}`.replace(/\s+/g, "-")
          : (idPayload.email || "").split("@")[0];

      const desiredName = generateFilename(address, file.name);

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
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        toast.error(data?.error || data?.message || "Presign failed");
        setUploading(false);
        return;
      }

      const { url, requiredHeaders } = data;

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);

      if (requiredHeaders?.["Content-Type"]) {
        xhr.setRequestHeader("Content-Type", requiredHeaders["Content-Type"]);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          toast.success("Upload complete!");
          setProgress(0);
          setFile(null);
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
      console.error("Upload error:", err);
      toast.error("Unexpected error during upload.");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <AddressSearch value={address} onChange={setAddress} />

      <input
        type="file"
        accept=".pdf,.doc,.docx"
        disabled={!address}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className={`w-full text-sm ${!address ? "opacity-50 cursor-not-allowed" : ""}`}
      />

      {address && file && (
        <div className="bg-slate-50 p-3 rounded text-sm text-slate-700">
          <div className="text-xs text-slate-500">S3 file name</div>
          <div className="font-semibold">{generateFilename(address, file.name)}</div>
        </div>
      )}

      {progress > 0 && (
        <div className="bg-gray-200 h-2 w-full rounded">
          <div className="bg-blue-600 h-2 rounded transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        onClick={upload}
        disabled={uploading || !address || !file}
        className={`w-full px-4 py-2 rounded text-white ${
          uploading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        } transition`}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}