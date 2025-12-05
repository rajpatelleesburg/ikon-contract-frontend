
"use client";

import { UserIcon, DocumentIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

export default function SummaryTile({
  totalAgents,
  totalContracts,
  windowLabel,
  windowCount,
  topAgents,
  onAgentsClick,
  onContractsClick,
  onWindowClick,
  onTopAgentClick,
}) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Dashboard Summary
        </h2>
        <span className="text-xs uppercase text-slate-400 tracking-wide">
          Tile 2
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={<UserIcon className="h-6 w-6 text-blue-600" />}
          title="Agents"
          value={totalAgents}
          onClick={onAgentsClick}
          gradient="from-blue-50 to-blue-100"
        />
        <KpiCard
          icon={<DocumentIcon className="h-6 w-6 text-indigo-600" />}
          title="Contracts"
          value={totalContracts}
          onClick={onContractsClick}
          gradient="from-indigo-50 to-indigo-100"
        />
        <KpiCard
          icon={<CalendarDaysIcon className="h-6 w-6 text-purple-600" />}
          title={windowLabel}
          value={windowCount}
          onClick={onWindowClick}
          gradient="from-purple-50 to-purple-100"
        />
      </div>

      <div className="mt-2">
        <div className="text-xs uppercase text-slate-400 tracking-wide mb-1">
          Top Agents ({windowLabel})
        </div>
        {topAgents.length === 0 ? (
          <p className="text-xs text-slate-500">
            No recent activity in this window yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {topAgents.map(({ agent, count }, idx) => (
              <li
                key={agent}
                className={`flex items-center justify-between text-xs rounded-xl px-3 py-2 bg-white border cursor-pointer hover:bg-blue-50 ${
                  idx >= 3 ? "hidden sm:flex" : "flex"
                }`}
                onClick={() => onTopAgentClick && onTopAgentClick(agent)}
              >
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-slate-800">{agent}</span>
                </span>
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                  {count} file{count !== 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value, gradient, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-sm border border-slate-200 flex flex-col items-center justify-center hover:shadow-md transition`}
    >
      <div className="bg-white rounded-lg shadow p-1.5 mb-1">{icon}</div>
      <div className="text-[11px] text-slate-500">{title}</div>
      <div className="text-lg font-semibold text-slate-700">{value}</div>
    </button>
  );
}
