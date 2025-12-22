// src/components/admin/AgentSection.js
"use client";

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

export default function AgentSection({
  mode,
  grouped,
  filteredGrouped,
  expanded,
  setExpanded,
  formatSize,
  onDelete,
  onDragStart,
  windowInfo,
  allContractsSorted,
  focusedAgent,
  setFocusedAgent,
  searchTerm = "",
}) {
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
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-2">
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
      </div>
    );
  };

  /* =====================================================
     MODE: ALL CONTRACTS (FLAT, ADMIN SUMMARY VIEW)
  ====================================================== */
  if (mode === "allContracts") {
    return (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">
          All Contracts (Newest first)
        </h2>

        {allContractsSorted.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts found.</p>
        ) : (
          <ul className="space-y-2">
            {allContractsSorted.map(({ agent, file }) => (
              <li key={`all-${file.key || file.filename || `${agent}-${file.lastModified}`}`}>
                <div>
                  <button
                    onClick={() => window.open(file.url, "_blank")}
                    className="text-blue-700 hover:underline text-left"
                  >
                    {highlight(file.filename)}
                  </button>

                  <div className="text-[11px] text-slate-500">
                    {new Date(file.lastModified).toLocaleString()} —{" "}
                    <span className="font-medium">{highlight(agent)}</span>
                  </div>

                  {renderStageMeta(file)}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] bg-slate-200 px-2 py-1 rounded-lg">
                    {formatSize(file.size)}
                  </span>
                  <button
                    onClick={() => onDelete(agent, file)}
                    className="text-[11px] bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  /* =====================================================
     MODE: AGENTS (GROUPED VIEW – PURCHASE + RENTAL)
  ====================================================== */
  if (mode === "agents") {
    const agents = Object.keys(grouped || {});

    return (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">Agents</h2>

        {agents.length === 0 ? (
          <p className="text-sm text-slate-500">No agents found.</p>
        ) : (
          agents.map((agent) => {
            const items = grouped[agent] || [];
            const isOpen = expanded[agent];

            return (
              <div
                key={`agent-${agent}`}
                className="border rounded-lg p-4 bg-slate-50 mb-2"
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [agent]: !prev[agent],
                    }))
                  }
                >
                  <h3 className="text-sm font-semibold text-slate-800">
                    {highlight(agent)} ({items.length})
                  </h3>
                  <span className="text-blue-600">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </div>

                {isOpen && (
                  <ul className="mt-3 space-y-3">
                    {items.map((item) => {
                      const rowKey =
                        item.type === "PURCHASE"
                          ? `purchase-${agent}-${item.label}`
                          : `rental-${agent}-${item.files[0]?.key}`;

                      return (
                        <li
                          key={rowKey}
                          className="bg-white p-3 rounded-lg border"
                        >
                          {/* HEADER */}
                          <div className="flex justify-between items-center">
                            <div className="font-semibold text-slate-800">
                              {highlight(item.label)}
                            </div>

                            <div className="flex items-center gap-2">
                              {renderStageMeta(item)}
                              <button
                                onClick={() => onDelete(agent, item)}
                                className="text-[11px] bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* FILES */}
                          <div className="mt-2 pl-4 space-y-1">
                            {item.files.map((f) => (
                              <div
                                key={f.key}
                                draggable
                                onDragStart={(e) =>
                                  onDragStart?.(e, f)
                                }
                                className="text-sm"
                              >
                                <a
                                  href={f.downloadUrl || f.url}
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
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </section>
    );
  }

  /* =====================================================
     MODE: FILTERED (SEARCH RESULTS)
  ====================================================== */
  const agentNames = Object.keys(filteredGrouped || {});

  return (
    <section className="space-y-3 animate-fade-in">
      {agentNames.length === 0 ? (
        <p className="text-center text-slate-500 text-sm">
          No matching results.
        </p>
      ) : (
        agentNames.map((agent) => {
          const items = filteredGrouped[agent] || [];
          const isOpen = expanded[agent];

          return (
            <div
              key={`filtered-${agent}`}
              className="border rounded-lg p-4 bg-slate-50"
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [agent]: !prev[agent],
                  }))
                }
              >
                <h2 className="text-lg font-bold">
                  {highlight(agent)} ({items.length})
                </h2>
                <span className="text-blue-600">
                  {isOpen ? "▾" : "▸"}
                </span>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-3">
                  {items.map((item) => {
                    const rowKey =
                      item.type === "PURCHASE"
                        ? `filtered-purchase-${agent}-${item.label}`
                        : `filtered-rental-${agent}-${item.files[0]?.key}`;

                    return (
                      <li
                        key={rowKey}
                        className="bg-white p-4 rounded-lg border"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold">
                              {highlight(item.label)}
                            </div>
                            {renderStageMeta(item)}
                          </div>

                          <button
                            onClick={() => onDelete(agent, item)}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>

                        <div className="mt-2 pl-4 space-y-1">
                          {item.files.map((f) => (
                            <div key={f.key} className="text-sm">
                              <a
                                href={f.downloadUrl || f.url}
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
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}