"use client";

import { useState } from "react";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";

export default function FileUpload() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const MAX_MB = 30;
  const ALLOWED = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const validate = (f) => {
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

      // Request presigned URL
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/presign`, {
        method: "POST",
        headers: {
          Authorization: idToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      const data = await res.json();

      if (res.status === 413) {
        toast.error(data.error || "Storage/file size limit exceeded.");
        setUploading(false);
        return;
      }

      if (!res.ok || !data.url) {
        console.error("Presign error:", data);
        toast.error(data.error || "Failed to get upload URL");
        setUploading(false);
        return;
      }

      const { url } = data;

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);

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
          toast.error("Upload failed");
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
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-sm"
      />

      {progress > 0 && (
        <div className="bg-gray-200 h-2 w-full rounded">
          <div
            className="bg-blue-600 h-2 rounded"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <button
        onClick={upload}
        disabled={uploading}
        className={`w-full px-4 py-2 rounded text-white ${
          uploading
            ? "bg-blue-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        } transition`}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}