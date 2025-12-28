"use client";

import { ClockIcon } from "@heroicons/react/24/outline";

export default function RecentActivityTile({ activity }) {
  if (!activity || activity.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ClockIcon className="h-5 w-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-800">
          Recent Activity
        </h3>
      </div>

      <ul className="divide-y">
        {activity.map((a, idx) => (
          <li key={idx} className="py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-slate-800 truncate">
                    {a.filename}
                </div>

                {a.attention && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    Attention
                    </span>
                )}
                </div>

                <div className="text-xs text-slate-500">
                {a.agent} · {a.transactionType}
                {a.attention && ` · ${a.attention}`}
                </div>
            </div>

            <div className="text-xs text-slate-400 whitespace-nowrap">
                {a.relativeTime}
            </div>
        </li>

        ))}
      </ul>
    </div>
  );
}