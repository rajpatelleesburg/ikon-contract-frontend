// src/components/admin/AgentSection.js
"use client";

// ✅ ADD: stage badge colors (admin view)
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

  // ✅ ADD: reusable stage/attention UI (safe defaults)
  const renderStageMeta = (file) => {
  const stage = file?.stage || "UPLOADED";
  const label = file?.stageLabel || stage;
  const attention = file?.attention;

  const showEmdHolder =
    stage === "EMD_COLLECTED" && file?.emdHolder;

  return (
    <div className="mt-1 space-y-1">
      {/* Stage badge + attention */}
      <div className="flex items-center gap-2">
        <span
          className={`text-[11px] px-2 py-1 rounded-md ${
            STAGE_COLORS[stage] || STAGE_COLORS.UPLOADED
          }`}
        >
          {label}
        </span>

        {attention ? (
          <span className="text-[11px] text-red-600 font-semibold">
            ⚠ {attention}
          </span>
        ) : null}
      </div>

      {/* ✅ NEW: EMD Holder (Admin view only, conditional) */}
      {showEmdHolder && (
        <div className="text-[11px] text-slate-600 pl-1">
          EMD Held By:{" "}
          <span className="font-medium text-slate-800">
            {file.emdHolder}
          </span>
        </div>
      )}
    </div>
  );
  };


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
              <li
                key={file.key}
                className="flex justify-between items-center bg-slate-50 border rounded-lg p-3"
              >
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

                  {/* ✅ ADD: Stage + Attention */}
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

  if (mode === "window") {
    const agents = Object.keys(windowInfo.perAgent || {});
    const visibleAgents = focusedAgent
      ? agents.filter((a) => a === focusedAgent)
      : agents;

    return (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">
          Contracts ({windowInfo.label})
        </h2>

        {visibleAgents.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts in this window.</p>
        ) : (
          visibleAgents.map((agent) => {
            const files = windowInfo.perAgent[agent] || [];
            return (
              <div
                key={agent}
                className="border rounded-lg p-4 bg-slate-50 mb-2 transition-all duration-200 ease-out"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {highlight(agent)} ({files.length})
                  </h3>
                </div>
                <ul className="mt-2 space-y-2 animate-fade-in">
                  {files.map((file) => (
                    <li
                      key={file.key}
                      className="flex justify-between items-center bg-white p-3 rounded-lg border"
                    >
                      <div>
                        <button
                          onClick={() => window.open(file.url, "_blank")}
                          className="text-blue-700 hover:underline text-left"
                        >
                          {highlight(file.filename)}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {new Date(file.lastModified).toLocaleString()}
                        </div>

                        {/* ✅ ADD: Stage + Attention */}
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
              </div>
            );
          })
        )}
      </section>
    );
  }

  if (mode === "agents") {
    const agents = Object.keys(grouped);

    return (
      <section className="space-y-3 animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-800">Agents</h2>
        {agents.length === 0 ? (
          <p className="text-sm text-slate-500">No agents found.</p>
        ) : (
          agents.map((agent) => {
            const files = grouped[agent] || [];
            const isOpen = expanded[agent];

            return (
              <div
                key={agent}
                className="border rounded-lg p-4 bg-slate-50 mb-2 transition-all duration-200 ease-out"
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => {
                    const next = {};
                    agents.forEach((a) => (next[a] = a === agent));
                    setExpanded(next);
                  }}
                >
                  <h3 className="text-sm font-semibold text-slate-800">
                    {highlight(agent)} ({files.length})
                  </h3>
                  <span className="text-blue-600">{isOpen ? "▾" : "▸"}</span>
                </div>

                {isOpen && (
                  <ul className="mt-2 space-y-2 animate-fade-in">
                    {files.map((file) => (
                      <li
                        key={file.key}
                        draggable
                        onDragStart={(e) => onDragStart(e, file)}
                        className="flex justify-between items-center bg-white p-3 rounded-lg border hover:bg-slate-100 transition"
                      >
                        <div>
                          <button
                            onClick={() =>
                              window.open(
                                file.url || file.downloadUrl,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            className="text-blue-700 hover:underline text-left break-all"
                          >
                            {highlight(file.filename)}
                          </button>
                          <div className="text-[11px] text-slate-500">
                            {file.lastModified
                              ? new Date(file.lastModified).toLocaleString()
                              : ""}
                          </div>

                          {/* ✅ ADD: Stage + Attention */}
                          {renderStageMeta(file)}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[11px] px-2 py-1 bg-slate-200 rounded-md text-slate-700">
                            {formatSize(file.size)}
                          </span>
                          <button
                            onClick={() => onDelete(agent, file)}
                            className="text-[11px] px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
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

  // mode === "normal" (filtered view)
  const agentNames = Object.keys(filteredGrouped);

  return (
    <section className="space-y-3 animate-fade-in">
      {agentNames.length === 0 ? (
        <p className="text-center text-slate-500 text-sm">
          No matching results.
        </p>
      ) : (
        agentNames.map((agentName) => {
          const files = filteredGrouped[agentName];
          const topFiles = files;
          const isOpen = expanded[agentName];

          return (
            <div
              key={agentName}
              className="border rounded-lg p-4 bg-slate-50 transition-all duration-200 ease-out"
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [agentName]: !prev[agentName],
                  }))
                }
              >
                <h2 className="text-lg font-bold">
                  {highlight(agentName)} ({files.length})
                </h2>
                <span className="text-blue-600">
                  {isOpen ? "▾" : "▸"}
                </span>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-3 animate-fade-in">
                  {topFiles.map((f) => (
                    <li
                      key={f.key}
                      draggable
                      onDragStart={(e) => onDragStart(e, f)}
                      className="flex justify-between items-center bg-white p-4 rounded-lg border hover:bg-slate-100 transition"
                    >
                      <div>
                        <button
                          onClick={() =>
                            window.open(
                              f.url || f.downloadUrl,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="text-blue-700 hover:underline text-left break-all"
                        >
                          {highlight(f.filename)}
                        </button>
                        <div className="text-xs text-slate-500">
                          {f.lastModified
                            ? new Date(f.lastModified).toLocaleString()
                            : ""}
                        </div>

                        {/* ✅ ADD: Stage + Attention */}
                        {renderStageMeta(f)}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs px-2 py-1 bg-slate-200 rounded-md text-slate-700">
                          {formatSize(f.size)}
                        </span>
                        <button
                          onClick={() => onDelete(agentName, f)}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
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