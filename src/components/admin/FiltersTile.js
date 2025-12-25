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
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-slate-800">
          Search &amp; Filters
        </span>
        <span className="text-slate-500">{filtersOpen ? "▾" : "▸"}</span>
      </button>

      {filtersOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* Search */}
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search agents, files, addresses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
                w-full
                border
                px-4
                py-3
                pr-10
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

          {/* Agent + Date Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
            {/* Agent dropdown */}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="
                w-full
                sm:w-auto
                border
                px-4
                py-3
                sm:py-2
                rounded-lg
                text-sm
              "
            >
              <option value="">All Agents</option>
              {agentNames.map((name) => (
                <option key={name} value={name}>
                  {name} ({grouped[name]?.length || 0})
                </option>
              ))}
            </select>

            {/* Date range */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 w-full sm:w-auto">
              <input
                type="date"
                className="
                  w-full
                  sm:w-auto
                  border
                  px-4
                  py-3
                  sm:py-2
                  rounded-lg
                  text-sm
                "
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
              />

              <span className="hidden sm:inline text-sm text-slate-500">
                to
              </span>

              <input
                type="date"
                className="
                  w-full
                  sm:w-auto
                  border
                  px-4
                  py-3
                  sm:py-2
                  rounded-lg
                  text-sm
                "
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}