"use client";

import { useEffect, useMemo, useState } from "react";
import { ClockIcon, XMarkIcon } from "@heroicons/react/24/outline";

/* ---------------- helpers ---------------- */

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

const isJustNow = (a) =>
  Date.now() - new Date(a.lastModified).getTime() <= 2 * 60 * 1000;

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

/* Attention pinned first */
const sortAttentionPinned = (items) =>
  items.slice().sort((a, b) => {
    if (a.attention && !b.attention) return -1;
    if (!a.attention && b.attention) return 1;
    return new Date(b.lastModified) - new Date(a.lastModified);
  });

/* ---------------- component ---------------- */

const splitActivities = (filename) => {
  if (!filename || !filename.includes("•")) return null;
  return filename.split("•").map((s) => s.trim());
};

export default function RecentActivityTile({ activity, onOpen }) {
  const [filter, setFilter] = useState("TOP"); // TOP | TODAY | YESTERDAY | LAST_72
  const [openPreview, setOpenPreview] = useState(null);
  const [visibleCount, setVisibleCount] = useState(3);

  /* keyboard: ESC closes preview */
  useEffect(() => {
    if (!openPreview) return;
    const onKey = (e) => e.key === "Escape" && setOpenPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPreview]);

  const baseSorted = useMemo(() => {
    return sortAttentionPinned(
      (activity || []).filter((a) => a.lastModified)
    );
  }, [activity]);

  const buckets = useMemo(() => {
    const today = baseSorted.filter((a) => isToday(a.lastModified));
    const yesterday = baseSorted.filter((a) => isYesterday(a.lastModified));
    const last72 = baseSorted.filter((a) => isLast72Hours(a.lastModified));
    return { today, yesterday, last72 };
  }, [baseSorted]);

  const filtered = useMemo(() => {
    setVisibleCount(3);

    if (filter === "TODAY")
      return buckets.today.length ? buckets.today : buckets.yesterday;

    if (filter === "YESTERDAY") return buckets.yesterday;
    if (filter === "LAST_72") return buckets.last72;

    return baseSorted.slice(0, 3);
  }, [filter, buckets, baseSorted]);

  if (!baseSorted.length) return null;

  const renderRow = (a, idx) => {
    const activities = splitActivities(a.filename);
    const address =
      extractAddressFromPresignedUrl(a.presignedUrl) ||
      a.addressLabel ||
      a.propertyAddress;

    return (
      <li
        key={`${idx}-${a.lastModified}`}
        className={`py-3 px-3 space-y-2 ${
          isJustNow(a) ? "bg-yellow-50" : ""
        }`}
      >
        {/* Property header */}
        <div className="text-sm font-semibold text-slate-800 truncate">
          {address || "Property"}
        </div>

        {/* Activity list */}
        {activities ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {activities.map((act, i) => {
              const lower = act.toLowerCase();

              // Decide link target per activity
              let linkUrl = null;
              if (lower.includes("contract")) {
                linkUrl = a.presignedUrl; // Contract.pdf
              } else if (lower.includes("alta")) {
                linkUrl = a.presignedUrl; // ALTA.pdf is also acceptable
              } else if (lower.includes("commission")) {
                linkUrl = a.presignedUrl;
              }

              return (
                <li key={i} className="text-slate-700">
                  {linkUrl ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPreview({
                          url: linkUrl,
                          title: act,
                        });
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      {act}
                    </button>
                  ) : (
                    <span>{act}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-sm text-blue-600">
            {buildDisplayName(a)}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between text-xs text-slate-500 pt-1">
          <span>
            {a.agent} · {a.transactionType}
            {a.attention && ` · ${a.attention}`}
          </span>
          <span>{a.relativeTime}</span>
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

          {baseSorted.length > 3 && (
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                onOpen?.();
              }}
              className="text-xs border rounded px-2 py-1 bg-white"
            >
              <option value="TOP">Recent (Top 3)</option>
              <option value="TODAY">Today · {buckets.today.length}</option>
              <option value="YESTERDAY">
                Yesterday · {buckets.yesterday.length}
              </option>
              <option value="LAST_72">
                Last 72 Hours · {buckets.last72.length}
              </option>
            </select>
          )}
        </div>

        <div className="relative">
          <ul className="divide-y bg-white rounded-xl border max-h-[360px] overflow-hidden">
            {filtered.slice(0, visibleCount).map(renderRow)}
          </ul>

          {filtered.length > visibleCount && (
            <button
              onClick={() => {
                setVisibleCount((n) => n + 3);
                onOpen?.();
              }}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Load more
            </button>
          )}

          {filtered.length > 3 && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent rounded-b-xl" />
          )}
        </div>
      </div>

      {/* Preview modal */}
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