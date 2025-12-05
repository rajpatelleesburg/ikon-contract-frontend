"use client";

export default function FiltersTile({
  filtersOpen,
  setFiltersOpen,
  search,
  setSearch,
  selectedAgent,
  setSelectedAgent,
  dateRange,
  setDateRange,
  agentNames,
  grouped,
  hasResults,
  onBack,
}) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-slate-800">
            Search &amp; Filters
          </span>
        </div>
        <span className="text-slate-500">{filtersOpen ? "▾" : "▸"}</span>
      </button>

      {filtersOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search agents, files, addresses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-4 py-2 rounded-lg w-full"
          />

          {/* Agent Dropdown + Date Range */}
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="border px-3 py-2 rounded-lg"
            >
              <option value="">All Agents</option>
              {agentNames.map((name) => (
                <option key={name} value={name}>
                  {name} ({grouped[name]?.length || 0})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                className="border px-2 py-1 rounded-lg"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
              <span>to</span>
              <input
                type="date"
                className="border px-2 py-1 rounded-lg"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Back to Dashboard ONLY when results exist */}
          {/*
          {hasResults && (
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={onBack}
                className="text-blue-600 hover:underline text-sm"
              >
                ← Back to Dashboard
              </button>
            </div>
          )}
          */}
        </div>
      )}
    </div>
  );
}