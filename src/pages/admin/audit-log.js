"use client";

import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";

export default function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const loadAudit = async () => {
    const session = await Auth.currentSession();
    const idToken = session.getIdToken().getJwtToken();

    const qs = new URLSearchParams(window.location.search);
    const ts = qs.get("ts");

    const url =
      `${process.env.NEXT_PUBLIC_API_URL}/admin/audit-log` +
      (ts ? `?ts=${ts}` : "");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const data = await res.json();
    setItems(data.items || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAudit();
      } catch (e) {
        console.error("Failed to load audit log", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const doRestore = async () => {
    if (!restoreTarget) return;

    try {
      setRestoreBusy(true);

      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/trash/restore`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ originalKey: restoreTarget.sk }),
        }
      );

      if (!res.ok) throw new Error(`Restore failed: ${res.status}`);

      await res.json();

      // refresh audit log
      await loadAudit();

      setRestoreTarget(null);
    } catch (e) {
      console.error("Restore failed", e);
      alert("Restore failed. Check logs.");
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">
        <h1 className="text-lg font-semibold mb-4">Audit Log</h1>

        {loading ? (
          <p>Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No audit entries found.</p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Contract</th>
                <th className="p-2 text-left">Policy</th>
                <th className="p-2 text-left">Retention</th>
                <th className="p-2 text-left">Action</th> {/* ✅ NEW */}
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">
                    {new Date(i.archivedAt || i.restoredAt).toLocaleString()}
                  </td>
                  <td className="p-2 break-all">{i.sk}</td>
                  <td className="p-2">
                    {i.olderThanYears
                      ? `Older than ${i.olderThanYears} years`
                      : "—"}
                  </td>
                  <td className="p-2">
                    {i.retentionDays ? `${i.retentionDays} days` : "—"}
                  </td>

                  {/* ✅ RESTORE ACTION */}
                  <td className="p-2">
                    {String(i.pk || "").startsWith("ARCHIVE#") ? (
                      <button
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => setRestoreTarget(i)}
                      >
                        Restore
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ✅ RESTORE CONFIRM MODAL */}
      {restoreTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-lg">
            <h2 className="text-lg font-bold text-slate-800">
              Restore this contract from Trash?
            </h2>

            <p className="text-sm text-slate-600 break-all">
              {restoreTarget.sk}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={restoreBusy}
                className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={doRestore}
                disabled={restoreBusy}
                className={`px-4 py-2 rounded-lg text-white ${
                  restoreBusy
                    ? "bg-blue-300"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {restoreBusy ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}