// src/components/admin/BulkDeleteTile.js
"use client";

export default function BulkDeleteTile({
  bulkTileOpen,
  setBulkTileOpen,
  bulkYears,
  setBulkYears,
  openBulkModal,
  bulkOptions = [],
}) {
  // fallback if options aren’t passed
  const effectiveOptions =
    bulkOptions.length > 0
      ? bulkOptions
      : [
          { value: 5, label: "Older than 5 years" },
          { value: 3, label: "Older than 3 years" },
          { value: 2, label: "Older than 2 years" },
        ];

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setBulkTileOpen((v) => !v)}
      >
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-slate-800">
            Bulk Cleanup
          </span>
        </div>
        <span className="text-slate-500">
          {bulkTileOpen ? "▾" : "▸"}
        </span>
      </button>

      {bulkTileOpen && (
        <div className="px-4 pb-4 space-y-3 animate-slide-down">
          <p className="text-xs text-slate-500">
            Use this tool to move older contracts to Trash in bulk. Files
            remain in Trash for 15 days before permanent deletion.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={bulkYears}
              onChange={(e) => setBulkYears(Number(e.target.value))}
              className="border px-3 py-2 rounded-lg"
            >
              {effectiveOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={openBulkModal}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Bulk Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}