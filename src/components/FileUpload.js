"use client";

import { useState } from "react";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";
import AddressSearch from "./AddressSearch";

const MAX_MB = 30;
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const LICENSED = ["VA", "MD", "DC"];

const safePart = (s) =>
  (s || "").replace(/\s+/g, " ").replace(/[^a-zA-Z0-9 .-]/g, "").trim();

const generateFilename = (addr, originalName) => {
  const ext = (originalName.split(".").pop() || "pdf").toLowerCase();
  const streetNumber = String(addr?.streetNumber || "").replace(/\D/g, "");
  const streetName = safePart(addr?.streetName);
  return `${streetNumber} ${streetName} Contract.${ext}`;
};

// ✅ S3 ChecksumSHA256 expects BASE64(SHA256(bytes))
const sha256Base64 = async (file) => {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export default function FileUpload() {
  const [file, setFile] = useState(null);
  const [address, setAddress] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const validate = (f) => {
    if (!address) {
      toast.error("Please search and select a property address (VA/MD/DC)");
      return false;
    }
    if (!LICENSED.includes(address?.state)) {
      toast.error("Only VA, MD, DC addresses are allowed.");
      return false;
    }
    if (!f) {
      toast.error("Please choose a file");
      return false;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error("File must be less than 30 MB");
      return false;
    }
    if (!ALLOWED.includes(f.type)) {
      toast.error("Only PDF, DOC, DOCX allowed");
      return false;
    }
    return true;
  };

  const upload = async () => {
    try {
      if (!validate(file)) return;

      setUploading(true);
      setProgress(0);

      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      if (!idToken) {
        toast.error("Unable to read authentication token.");
        setUploading(false);
        return;
      }

      // ✅ compute checksum BEFORE presign request
      const checksumSha256 = await sha256Base64(file);
      const desiredName = generateFilename(address, file.name);

      // Request presigned URL
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/presign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: desiredName,
          contentType: file.type,
          fileSize: file.size,
          checksumSha256,
          address,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // If API Gateway returns non-JSON error
        data = null;
      }

      if (!res.ok) {
        console.error("Presign error:", data);
        toast.error(data?.error || `Presign failed (${res.status})`);
        setUploading(false);
        return;
      }

      if (!data?.url) {
        toast.error("No upload URL returned.");
        setUploading(false);
        return;
      }

      const { url, requiredHeaders } = data;

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);

      // ✅ REQUIRED for checksum-enforced presigned PUT
      // backend returns requiredHeaders['x-amz-checksum-sha256'] === checksumSha256
      if (requiredHeaders?.["x-amz-checksum-sha256"]) {
        xhr.setRequestHeader(
          "x-amz-checksum-sha256",
          requiredHeaders["x-amz-checksum-sha256"]
        );
      }

      // keep content-type consistent
      if (requiredHeaders?.["Content-Type"]) {
        xhr.setRequestHeader("Content-Type", requiredHeaders["Content-Type"]);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          toast.success("Upload complete!");
          setProgress(0);
          setFile(null);
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
      toast.error("An unexpected error occurred during upload.");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <AddressSearch value={address} onChange={setAddress} />

      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-sm"
      />

      {address && file && (
        <div className="bg-slate-50 p-3 rounded text-sm text-slate-700">
          <div className="text-xs text-slate-500">S3 file name</div>
          <div className="font-semibold">{generateFilename(address, file.name)}</div>
        </div>
      )}

      {progress > 0 && (
        <div className="bg-gray-200 h-2 w-full rounded">
          <div className="bg-blue-600 h-2 rounded" style={{ width: `${progress}%` }} />
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