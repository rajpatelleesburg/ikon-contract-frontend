// src/pages/upload.js
"use client";

import FileUpload from "../components/FileUpload";

export default function UploadPage({ user, signOut }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg p-10 rounded-xl w-full max-w-md space-y-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">Upload Contract</h1>

        <FileUpload />

        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="w-full bg-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-400 transition"
        >
          Back to Dashboard
        </button>

        <button
          onClick={signOut}
          className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}