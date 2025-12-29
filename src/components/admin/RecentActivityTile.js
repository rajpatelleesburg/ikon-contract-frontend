"use client";

import { useMemo, useState } from "react";
import { ClockIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Extract the address folder from an S3 presigned URL.
 * Expected path:
 *   /<agentFolder>/<addressFolder>/<filename>
 * Example:
 *   /Raj-Patel/210%20Monticello%20Square%20Winchester%20VA/Contract.pdf
 */
const extractAddressFromPresignedUrl = (presignedUrl) => {
  try {
    if (!presignedUrl) return null;

    const u = new URL(presignedUrl);
    const parts = u.pathname.split("/").filter(Boolean); // removes empty segments

    // Need at least: agentFolder/addressFolder/file
    if (parts.length < 3) return null;

    const addressFolder = decodeURIComponent(parts[parts.length - 2] || "");
    const cleaned = addressFolder.replace(/\+/g, " ").trim();

    return cleaned || null;
  } catch {
    return null;
  }
};

const getTypeLabel = (a) => {
  const t = String(a.transactionType || "").toUpperCase();
  if (t === "RENTAL") return "Rental";
  if (t === "LEASE") return "Lease";
  return "Contract";
};

const buildDisplayName = (a) => {
  const address =
    extractAddressFromPresignedUrl(a.presignedUrl) ||
    a.addressLabel ||
    a.propertyAddress ||
    null;

  if (address) return `${address} ${getTypeLabel(a)}.pdf`;
  return a.filename || "Contract.pdf";
};

const isJustNow = (a) => {
  const t = new Date(a.lastModified).getTime();
  if (!t) return false;
  return Date.now() - t <= 2 * 60 * 1000; // <= 2 minutes
};

const isTodayLocal = (isoOrDate) => {
  const d = new Date(isoOrDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

const isYesterdayLocal = (isoOrDate) => {
  const d = new Date(isoOrDate);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
};

export default function RecentActivityTile({ activity }) {
  const [limitToday, setLimitToday] = useState(3);
  const [limitYesterday, setLimitYesterday] = useState(3);
  const [openPreview, setOpenPreview] = useState(null); // { url, title }

  const grouped = useMemo(() => {
    const now = Date.now();
    const HOUR = 1000 * 60 * 60;
    const MAX_WINDOW = 72 * HOUR;

    const items =
      (activity || [])
        .filter((a) => {
          const t = new Date(a.lastModified).getTime();
          return t && now - t <= MAX_WINDOW;
        })
        .slice()
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)) || [];

    const today = [];
    const yesterday = [];
    const older = [];

    for (const a of items) {
      if (isTodayLocal(a.lastModified)) today.push(a);
      else if (isYesterdayLocal(a.lastModified)) yesterday.push(a);
      else older.push(a); // still within 72h
    }

    return { today, yesterday, older };
  }, [activity]);

  const hasAny =
    grouped.today.length || grouped.yesterday.length || grouped.older.length;

  if (!hasAny) return null;

  const renderRow = (a, idx) => {
    const displayName = buildDisplayName(a);
    const previewUrl = a.presignedUrl || a.url;

    const highlight = isJustNow(a);

    return (
      <li
        key={`${idx}-${a.lastModified}`}
        className={`py-2 flex items-start justify-between gap-3 ${
          highlight ? "bg-yellow-50" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setOpenPreview({ url: previewUrl, title: displayName })}
                className="text-sm font-medium text-blue-600 hover:underline truncate text-left"
                title="Preview"
              >
                {displayName}
              </button>
            ) : (
              <div className="text-sm font-medium text-slate-800 truncate">
                {displayName}
              </div>
            )}

            {a.attention && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                Attention
              </span>
            )}

            {highlight && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                Just now
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            {a.agent} · {a.transactionType}
            {a.attention && ` · ${a.attention}`}
          </div>
        </div>

        <div className="text-xs text-slate-400 whitespace-nowrap">
          {a.relativeTime}
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
        </div>

        {/* TODAY */}
        {grouped.today.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Today
            </div>
            <ul className="divide-y bg-white rounded-xl border">
              {grouped.today.slice(0, limitToday).map(renderRow)}
            </ul>
            {grouped.today.length > limitToday && (
              <button
                type="button"
                onClick={() => setLimitToday((n) => n + 3)}
                className="text-xs text-blue-600 hover:underline"
              >
                Load more
              </button>
            )}
          </div>
        )}

        {/* YESTERDAY */}
        {grouped.yesterday.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Yesterday
            </div>
            <ul className="divide-y bg-white rounded-xl border">
              {grouped.yesterday.slice(0, limitYesterday).map(renderRow)}
            </ul>
            {grouped.yesterday.length > limitYesterday && (
              <button
                type="button"
                onClick={() => setLimitYesterday((n) => n + 3)}
                className="text-xs text-blue-600 hover:underline"
              >
                Load more
              </button>
            )}
          </div>
        )}

        {/* OLDER (still within 72h) */}
        {grouped.older.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Last 72 hours
            </div>
            <ul className="divide-y bg-white rounded-xl border">
              {grouped.older.slice(0, 3).map(renderRow)}
            </ul>
          </div>
        )}
      </div>

      {/* INLINE PREVIEW MODAL */}
      {openPreview?.url && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {openPreview.title}
                </div>
                <div className="text-xs text-slate-500">
                  Preview
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenPreview(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            <div className="h-[75vh] bg-slate-100">
              <iframe
                src={openPreview.url}
                title="Contract preview"
                className="w-full h-full"
              />
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-3">
              <a
                href={openPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => setOpenPreview(null)}
                className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}