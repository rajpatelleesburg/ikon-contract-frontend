"use client";

import { ArrowTrendingUpIcon } from "@heroicons/react/24/outline";

export default function UploadVelocityTile({ data, windowLabel }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowTrendingUpIcon className="h-5 w-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-slate-800">
          Upload Velocity ({windowLabel})
        </h3>
      </div>

      <ul className="space-y-2">
        {data.slice(0, 5).map(({ agent, count }) => (
          <li
            key={agent}
            className="flex items-center justify-between text-sm bg-white border rounded-xl px-3 py-2"
          >
            <span className="font-medium text-slate-800">{agent}</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
              {count} file{count !== 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}