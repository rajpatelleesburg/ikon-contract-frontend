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
        <div className="px-4 pb-4 space-y-3 sm:space-y-4">
          {/* Search (mobile-friendly + clear icon) */}
          <div className="relative w-full flex justify-center sm:justify-start">
            <input
              type="text"
              placeholder="Search agents, files, addresses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
                w-full
                max-w-xs
                sm:max-w-sm
                md:max-w-md
                border
                px-4
                py-2
                pr-9
                rounded-lg
                text-sm
              "
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  hover:text-gray-600
                  text-sm
                "
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Agent Dropdown + Date Range */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="border px-3 py-2 rounded-lg text-sm w-full sm:w-auto"
            >
              <option value="">All Agents</option>
              {agentNames.map((name) => (
                <option key={name} value={name}>
                  {name} ({grouped[name]?.length || 0})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                className="border px-2 py-1 rounded-lg text-sm w-full sm:w-auto"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
              <span className="text-sm text-slate-500">to</span>
              <input
                type="date"
                className="border px-2 py-1 rounded-lg text-sm w-full sm:w-auto"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Back to Dashboard (kept commented as you had it) */}
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