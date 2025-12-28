"use client";
import { useState, useEffect } from "react";

/* =========================
   STAGE BADGE COLORS
========================= */
const STAGE_COLORS = {
  UPLOADED: "bg-slate-200 text-slate-700",
  EMD_COLLECTED: "bg-blue-100 text-blue-700",
  CONTINGENCIES: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-green-100 text-green-700",
  COMMISSION: "bg-purple-100 text-purple-700",
};

const isPdfPreviewable = (f) =>
  String(f.filename || "").toLowerCase().endsWith(".pdf");

export default function AgentSection({
  mode,
  grouped,
  filteredGrouped,
  expanded,
  setExpanded,
  formatSize,
  onDelete,
  onDragStart,
  allContractsSorted,
  searchTerm = "",
}) {
  /* =========================
     STATE
  ========================= */
  const [pdfPreview, setPdfPreview] = useState(null);
  const [zoom, setZoom] = useState(1);

  /* =========================
     KEYBOARD HANDLERS
  ========================= */
  useEffect(() => {
    if (!pdfPreview) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setPdfPreview(null);
        setZoom(1);
      }
      if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(2, z + 0.25));
      }
      if (e.key === "-" || e.key === "_") {
        setZoom((z) => Math.max(0.5, z - 0.25));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pdfPreview]);

  /* =========================
     SEARCH HIGHLIGHT
  ========================= */
  const highlight = (text) => {
    if (!text || !searchTerm) return text;
    const t = String(text);
    const lower = t.toLowerCase();
    const q = searchTerm.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return t;
    return (
      <>
        {t.slice(0, idx)}
        <span className="bg-yellow-200 rounded-sm px-0.5">
          {t.slice(idx, idx + q.length)}
        </span>
        {t.slice(idx + q.length)}
      </>
    );
  };

  /* =========================
     STAGE + ATTENTION
  ========================= */
  const renderStageMeta = (item) => {
    const stage = item?.stage || "UPLOADED";
    const label = item?.stageLabel || stage;
    const attention = item?.attention;

    return (
      <div className="mt-1 flex flex-wrap gap-2">
        <span
          className={`text-[11px] px-2 py-1 rounded-md ${
            STAGE_COLORS[stage] || STAGE_COLORS.UPLOADED
          }`}
        >
          {label}
        </span>
        {attention && (
          <span className="text-[11px] text-red-600 font-semibold">
            ⚠ {attention}
          </span>
        )}
      </div>
    );
  };

  /* =========================
     MAIN CONTENT
  ========================= */
  let content = null;

  /* -------- ALL CONTRACTS -------- */
  if (mode === "allContracts") {
    content = (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">
          All Contracts (Newest first)
        </h2>

        {allContractsSorted.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts found.</p>
        ) : (
          <ul className="space-y-3">
            {allContractsSorted.map(({ agent, contract }) => (
              <li
                key={`all-${agent}-${contract.label}`}
                className="bg-white p-4 rounded-lg border"
              >
                <div className="flex justify-between gap-2">
                  <div className="font-semibold">
                    {highlight(contract.label)}
                    {renderStageMeta(contract)}
                  </div>

                  <button
                    onClick={() => onDelete(agent, contract)}
                    className="text-xs px-3 py-2 bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-2 pl-4 space-y-1">
                  {contract.files.map((f) => (
                    <div key={f.key} className="text-sm">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {highlight(f.filename)}
                      </a>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  /* -------- AGENTS -------- */
  if (mode === "agents") {
    const agentBlocks = Object.values(grouped || {});
    content = (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">Agents</h2>

        {agentBlocks.map(({ agentId, agentName, items }) => {
          const isOpen = expanded[agentId] ?? true;

          return (
            <div key={agentId} className="border rounded-lg p-4 bg-slate-50">
              <div
                className="flex justify-between cursor-pointer"
                onClick={() =>
                  setExpanded((p) => ({ ...p, [agentId]: !p[agentId] }))
                }
              >
                <h3 className="font-semibold">
                  {highlight(agentName)} ({items.length})
                </h3>
                <span>{isOpen ? "▾" : "▸"}</span>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-3">
                  {items.map((item) => (
                    <li key={item.label} className="bg-white p-3 rounded border">
                      <div className="flex justify-between">
                        <div>
                          <div className="font-semibold">
                            {highlight(item.label)}
                          </div>
                          {renderStageMeta(item)}
                        </div>

                        <button
                          onClick={() => onDelete(agentName, item)}
                          className="text-xs px-3 py-2 bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-2 pl-4 space-y-1">
                        {item.files.map((f) => (
                          <div key={f.key} className="text-sm">
                            {isPdfPreviewable(f) ? (
                              <button
                                onClick={() => setPdfPreview(f)}
                                className="text-blue-600 underline"
                              >
                                {highlight(f.filename)}
                              </button>
                            ) : (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline"
                              >
                                {highlight(f.filename)}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  /* -------- FILTERED -------- */
  if (mode === "filtered") {
    const blocks = Object.values(filteredGrouped || {});
    content = (
      <section className="space-y-3 animate-fade-in">
        {blocks.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            No matching results.
          </p>
        ) : (
          blocks.map(({ agentId, agentName, items }) => {
            const isOpen = expanded[agentId] ?? true;

            return (
              <div key={agentId} className="border rounded-lg p-4 bg-slate-50">
                <div
                  className="flex justify-between cursor-pointer"
                  onClick={() =>
                    setExpanded((p) => ({ ...p, [agentId]: !p[agentId] }))
                  }
                >
                  <h3 className="font-semibold">
                    {highlight(agentName)} ({items.length})
                  </h3>
                  <span>{isOpen ? "▾" : "▸"}</span>
                </div>

                {isOpen && (
                  <ul className="mt-3 space-y-3">
                    {items.map((item) => (
                      <li key={item.label} className="bg-white p-3 rounded border">
                        <div className="flex justify-between">
                          <div>
                            <div className="font-semibold">
                              {highlight(item.label)}
                            </div>
                            {renderStageMeta(item)}
                          </div>
                          <button
                            onClick={() => onDelete(agentName, item)}
                            className="text-xs px-3 py-2 bg-red-600 text-white rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </section>
    );
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      {content}

      {pdfPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[85vh] p-4 flex flex-col">
            <div className="flex justify-between mb-2">
              <div className="font-semibold">{pdfPreview.filename}</div>

              <div className="flex gap-2">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="px-2 py-1 border rounded"
                >
                  −
                </button>
                <span className="text-sm">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                  className="px-2 py-1 border rounded"
                >
                  +
                </button>
                <a
                  href={pdfPreview.url}
                  download
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    setPdfPreview(null);
                    setZoom(1);
                  }}
                  className="px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded">
              <iframe
                src={pdfPreview.url}
                style={{
                  width: "100%",
                  height: "100%",
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
              />
            </div>

            <div className="text-xs text-slate-500 mt-1 flex justify-between">
              <span>Scroll to navigate pages</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}