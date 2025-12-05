
"use client";

import { useEffect } from "react";

export default function BulkDeleteModal({
  years,
  confirmText,
  setConfirmText,
  countdown,
  setCountdown,
  inProgress,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (confirmText === "DELETE") {
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCountdown(0);
    }
  }, [confirmText, setCountdown]);

  const disabled =
    inProgress || confirmText !== "DELETE" || countdown > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-lg">
        <h2 className="text-lg font-bold text-red-700">
          Bulk Delete Confirmation
        </h2>
        <p className="text-sm text-slate-700">
          This will move <span className="font-semibold">ALL</span> contracts
          older than <span className="font-semibold">{years} years</span>{" "}
          into the Trash folder. These will be permanently deleted
          after 15 days.
        </p>
        <p className="text-xs text-red-600">
          This action cannot be undone. Type{" "}
          <code>DELETE</code> in all caps to proceed.
        </p>

        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="border px-3 py-2 rounded-lg w-full font-mono"
          placeholder="DELETE"
        />

        {confirmText === "DELETE" && countdown > 0 && (
          <p className="text-xs text-slate-500">
            Confirm button will be enabled in {countdown} seconds…
          </p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            disabled={inProgress}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-white ${
              disabled
                ? "bg-red-300 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {inProgress ? "Deleting…" : "Confirm Bulk Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
