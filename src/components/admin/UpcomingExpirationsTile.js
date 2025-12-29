export default function UpcomingExpirationsTile({ items, alertsSent }) {
  if (!items.length) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <h3 className="text-sm font-semibold text-amber-800">
        Upcoming Retention Expirations (30 days)
      </h3>

      <ul className="divide-y text-sm">
        {items.slice(0, 5).map((i, idx) => (
            <li key={idx} className="py-2 flex justify-between items-center">
            <div>
                <div className="font-medium text-slate-800">{i.label}</div>
                <div className="text-xs text-slate-600">
                {i.agent} · Eligible on{" "}
                {new Date(i.eligibleAt).toLocaleDateString()} ·{" "}
                <span className="text-amber-700 font-semibold">
                    {i.daysLeft} days left
                </span>
                </div>
            </div>

            {alertsSent?.[i.contractPk] && (
                <span
                title="Retention alert sent"
                className="text-green-600 text-lg"
                >
                ✓
                </span>
            )}
            </li>
        ))}
    </ul>

    </div>
  );
}