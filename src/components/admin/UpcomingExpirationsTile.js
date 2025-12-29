export default function UpcomingExpirationsTile({ items }) {
  if (!items.length) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-semibold text-amber-800">
        Upcoming Retention Expirations (30 days)
      </h3>

      <ul className="divide-y text-sm">
        {items.slice(0, 5).map((i, idx) => (
          <li key={idx} className="py-2">
            <div className="font-medium text-slate-800">{i.label}</div>
            <div className="text-xs text-slate-600">
              {i.agent} · Eligible on{" "}
              {new Date(i.eligibleAt).toLocaleDateString()} ·{" "}
              <span className="text-amber-700 font-semibold">
                {i.daysLeft} days left
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}