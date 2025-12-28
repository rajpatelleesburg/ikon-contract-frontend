// src/components/admin/BulkDeleteTile.js
"use client";

import { useEffect, useState } from "react";
export default function BulkDeleteTile({
  bulkTileOpen,
  setBulkTileOpen,
  // Contract age selection (years)
  bulkYears,
  setBulkYears,
  // Retention (trash)
  retentionDays,
  setRetentionDays,
  // Count from parent
  affectedCount = 0,
  openBulkModal,
   // NEW
  runBulkDryRun,
  dryRunResult,
  dryRunLoading,
}) {
  const ageOptions = [
    { value: 5, label: "Older than 5 years (Default)" },
    { value: 4, label: "Older than 4 years" },
    { value: 3, label: "Older than 3 years (Statutory)" },
    { value: 2, label: "Older than 2 years" },
    { value: 1, label: "Older than 1 year" },
  ];

  // 🔐 Two-step confirmation state
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [previewLimit, setPreviewLimit] = useState(10);
  // Start countdown ONLY after first click
  useEffect(() => {
    if (!armed) return;
    setConfirmText("");
    setCountdown(8);
    const t = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [armed]);

  useEffect(() => {
    if (!bulkTileOpen) {
      setPreviewLimit(10);
    }
  }, [bulkTileOpen]);

  // Reset dry-run preview when criteria changes
  useEffect(() => {
    setArmed(false);
    setConfirmText("");
    setCountdown(0);
  }, [bulkYears, retentionDays]);

  const canConfirm =
    armed &&
    countdown === 0 &&
    confirmText.trim().toLowerCase() === "permanently delete" &&
    affectedCount > 0;

  const handlePrimaryClick = async () => {
    // First click → run dry-run
    if (!dryRunResult) {
      await runBulkDryRun();
      return;
    }
    if (!armed) {
      setArmed(true);
      return;
    }

    if (canConfirm) {
      openBulkModal();
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => {
          setBulkTileOpen((v) => !v);
          setArmed(false);
          setConfirmText("");
          setCountdown(0);
        }}
      >
        <span className="text-sm font-semibold text-slate-800">
          Bulk Cleanup
        </span>
        <span className="text-slate-500">
          {bulkTileOpen ? "▾" : "▸"}
        </span>
      </button>

      {bulkTileOpen && (
        <div className="px-4 pb-4 space-y-4 animate-slide-down">
          <p className="text-xs text-slate-500 leading-relaxed">
            Select how old contracts must be to qualify. Matching contracts will
            be moved to <strong>Trash</strong> and retained before permanent
            deletion.
          </p>

          {/* Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">
                Contract age
              </label>
              <select
                value={bulkYears}
                onChange={(e) => setBulkYears(Number(e.target.value))}
                className="border px-3 py-2 rounded-lg text-sm w-full"
              >
                {ageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500">
                Trash retention
              </label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="border px-3 py-2 rounded-lg text-sm w-full"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>

          {/* Impact */}
          <div className="text-xs text-slate-600 bg-white border rounded-lg p-3">
            {affectedCount > 0 ? (
              <>
                ⚠️ <strong>{affectedCount}</strong> contracts will be moved to
                Trash.
                {bulkYears < 3 && (
                  <div className="mt-1 text-red-600">
                    Statutory retention is 3 years. Proceed with caution.
                  </div>
                )}
              </>
            ) : (
              <>No contracts match this criteria.</>
            )}
          </div>

          {/* Dry-run preview */}
          {dryRunResult && dryRunResult.items && (
            <div className="border rounded-lg bg-white p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Preview – Contracts to be archived
                <span className="ml-1 text-slate-500">
                  (showing {Math.min(previewLimit, dryRunResult.items.length)} of{" "}
                  {dryRunResult.items.length})
                </span>
              </div>

              <ul className="divide-y text-xs">
                {dryRunResult.items.slice(0, previewLimit).map((c, idx) => (
                  <li key={idx} className="py-2">
                    <div className="font-medium text-slate-800">
                      {c.label}
                    </div>
                    <div className="text-slate-500">
                      {c.agent} · {c.transactionType}
                    </div>
                  </li>
                ))}
              </ul>

              {previewLimit < dryRunResult.items.length && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewLimit((p) => Math.min(p + 10, dryRunResult.items.length))
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  Show more
                </button>
              )}
            </div>
          )}

          {/* Step-2 confirmation */}
          {armed && (
            <div className="border rounded-lg p-3 bg-white space-y-2">
              <p className="text-xs text-slate-600">
                Wait <strong>{countdown}</strong> seconds and type{" "}
                <strong>permanently delete</strong>.
              </p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full border px-3 py-2 rounded-lg text-sm"
                placeholder="permanently delete"
              />
            </div>
          )}

          {affectedCount > 0 && (
          <button
            type="button"
            disabled={
              dryRunLoading ||
              (dryRunResult && armed && !canConfirm)
            }
            onClick={handlePrimaryClick}
            className={`w-full px-4 py-2 rounded-lg text-sm transition-colors ${
              dryRunLoading
                ? "bg-slate-300 text-slate-500 cursor-wait"
                : !dryRunResult
                ? "bg-red-600 text-white hover:bg-red-700"
                : canConfirm
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {!dryRunResult
              ? dryRunLoading
                ? "Previewing affected contracts…"
                : "Move Contracts to Trash"
              : armed
              ? "Confirm Permanent Delete"
              : "Review Preview & Proceed"}
          </button>
        )}

        </div>
      )}
    </div>
  );
}