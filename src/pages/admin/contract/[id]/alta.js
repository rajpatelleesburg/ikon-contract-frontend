"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";
import Card from "../../../../components/ui/Card";
import Button from "../../../../components/ui/Button";

export default function AltaUpload() {
  const router = useRouter();
  const { id } = router.query;
  const safeId = typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async () => {
    try {
      if (!safeId) {
        toast.error("Invalid contract id");
        return;
      }
      if (!file) return toast.error("Choose ALTA PDF");
      setUploading(true);

      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      // presign ALTA upload
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${safeId}/alta/presign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        toast.error(data?.error || "Failed to presign");
        setUploading(false);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = async () => {
        if (xhr.status === 200) {
          toast.success("ALTA uploaded");
          setFile(null);
          setProgress(0);
          // notify backend
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${safeId}/alta/complete`, {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ok: true }),
          });
          router.push(`/admin/contract/${safeId}`);
        } else {
          toast.error("Upload failed");
        }
        setUploading(false);
      };
      xhr.onerror = () => { toast.error("Upload error"); setUploading(false); };
      xhr.send(file);
    } catch (e) {
      console.error(e);
      toast.error("ALTA upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
      <Card className="w-full max-w-lg p-6">
        <h1 className="text-xl font-bold text-slate-900">Upload Signed ALTA</h1>
        <p className="mt-1 text-sm text-slate-600">Required before commission disbursement submission.</p>

        <div className="mt-4">
          <input type="file" accept=".pdf" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        </div>

        {progress > 0 && (
          <div className="mt-4 h-2 w-full rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-900" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button onClick={() => router.back()} className="bg-slate-200 text-slate-900 hover:bg-slate-300">Back</Button>
          <Button onClick={upload} disabled={uploading || !file} className="w-full">
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
