"use client";

// NOTE: keep this component dumb/pure. No imports from stage config.
// Stage labels come from parent via props.

export default function PurchaseFolderList({
  purchaseGroups = {},
  displayCount = 5,
  onOpenStage,
  stageLabels = {},
  displayFileName = (s) => s,
  isPrimary = (f) =>
    String(f?.fileName || "").toLowerCase() === "contract.pdf" && !!f?.address,
}) {
  return (
    <>
      {Object.entries(purchaseGroups)
        .slice(0, displayCount)
        .map(([key, group]) => {
          const primary = (group || []).find(isPrimary);
          if (!primary) return null;

          const addr = primary.address || {};
          const stage = primary.stage;
          const stageLabel = stageLabels?.[stage] || stage || "";

          return (
            <div key={key} className="bg-slate-50 border rounded p-3 space-y-2">
              {/* Folder header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="font-semibold text-slate-800 leading-tight">
                  <div>
                    {addr.streetNumber} {addr.streetName}
                  </div>
                  <div className="text-sm text-slate-600">
                    {addr.city}, {addr.state}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-slate-200">
                    {stageLabel}
                  </span>

                  {stage !== "CLOSED" && (
                    <button
                      onClick={() => onOpenStage?.(primary)}
                      className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm rounded-lg bg-slate-800 text-white"
                    >
                      Update Stage
                    </button>
                  )}
                </div>
              </div>

              {/* Files inside folder */}
              <div className="pl-4 space-y-1">
                {(group || []).map((f) => (
                  <div key={f.contractId || f.s3Key || f.url} className="text-sm">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {displayFileName(f.fileName)}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}
