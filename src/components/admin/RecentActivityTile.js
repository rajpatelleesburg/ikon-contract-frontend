"use client";

import { useMemo, useState } from "react";
import { ClockIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Extract address folder from S3 presigned URL
 */
const extractAddressFromPresignedUrl = (presignedUrl) => {
  try {
    if (!presignedUrl) return null;
    const u = new URL(presignedUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return null;
    return decodeURIComponent(parts[parts.length - 2]).replace(/\+/g, " ").trim();
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
    a.propertyAddress;
  return address
    ? `${address} ${getTypeLabel(a)}.pdf`
    : a.filename || "Contract.pdf";
};

const isJustNow = (a) => {
  const t = new Date(a.lastModified).getTime();
  return t && Date.now() - t <= 2 * 60 * 1000;
};

const isToday = (d) => {
  const x = new Date(d);
  const n = new Date();
  return (
    x.getFullYear() === n.getFullYear() &&
    x.getMonth() === n.getMonth() &&
    x.getDate() === n.getDate()
  );
};

const isYesterday = (d) => {
  const x = new Date(d);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
};

const isLast72Hours = (d) =>
  Date.now() - new Date(d).getTime() <= 72 * 60 * 60 * 1000;

export default function RecentActivityTile({ activity }) {
  const [filter, setFilter] = useState("TOP"); // TOP | TODAY | YESTERDAY | LAST_72
  const [openPreview, setOpenPreview] = useState(null);

  const sorted = useMemo(() => {
    return (activity || [])
      .filter((a) => a.lastModified)
      .sort(
        (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
      );
  }, [activity]);

  const filtered = useMemo(() => {
    if (filter === "TODAY")
      return sorted.filter((a) => isToday(a.lastModified));

    if (filter === "YESTERDAY")
      return sorted.filter((a) => isYesterday(a.lastModified));

    if (filter === "LAST_72")
      return sorted.filter((a) => isLast72Hours(a.lastModified));

    return sorted.slice(0, 3);
  }, [sorted, filter]);

  if (!sorted.length) return null;

  const renderRow = (a, idx) => {
    const highlight = isJustNow(a);
    const displayName = buildDisplayName(a);
    const previewUrl = a.presignedUrl || a.url;

    return (
      <li
        key={`${idx}-${a.lastModified}`}
        className={`py-2 flex justify-between gap-3 ${
          highlight ? "bg-yellow-50" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {previewUrl ? (
              <button
                onClick={() =>
                  setOpenPreview({ url: previewUrl, title: displayName })
                }
                className="text-sm font-medium text-blue-600 hover:underline truncate text-left"
              >
                {displayName}
              </button>
            ) : (
              <div className="text-sm font-medium truncate">{displayName}</div>
            )}

            {a.attention && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border">
                Attention
              </span>
            )}

            {highlight && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border">
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
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Recent Activity
            </h3>
          </div>

          {sorted.length > 3 && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-xs border rounded px-2 py-1 bg-white"
            >
              <option value="TOP">Recent (Top 3)</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_72">Last 72 Hours</option>
            </select>
          )}
        </div>

        <ul className="divide-y bg-white rounded-xl border max-h-[360px] overflow-hidden">
          {filtered.map(renderRow)}
        </ul>
      </div>

      {/* INLINE PREVIEW MODAL */}
      {openPreview?.url && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-5xl rounded-2xl overflow-hidden">
            <div className="flex justify-between px-4 py-3 border-b">
              <div className="truncate text-sm font-semibold">
                {openPreview.title}
              </div>
              <button onClick={() => setOpenPreview(null)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <iframe
              src={openPreview.url}
              className="w-full h-[75vh]"
              title="Preview"
            />
          </div>
        </div>
      )}
    </>
  );
}