"use client";

import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";

export default function TrashPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadTrash = async () => {
    const session = await Auth.currentSession();
    const idToken = session.getIdToken().getJwtToken();

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/trash`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    const data = await res.json();
    setItems(data.items || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadTrash();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const restore = async () => {
    if (!restoreTarget) return;

    try {
      setBusy(true);
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/trash/restore`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originalKey: restoreTarget.trashKey.replace(/^trash\//, ""),
          }),
        }
      );

      setRestoreTarget(null);
      await loadTrash();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">
        <h1 className="text-lg font-semibold mb-4">Trash</h1>

        {loading ? (
          <p>Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Trash is empty.
          </p>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">Agent</th>
                <th className="p-2 text-left">Contract</th>
                <th className="p-2 text-left">Archived At</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{i.agent}</td>
                  <td className="p-2 break-all">{i.filename}</td>
                  <td className="p-2">
                    {new Date(i.archivedAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setRestoreTarget(i)}
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {restoreTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-lg">
            <h2 className="text-lg font-bold">
              Restore this contract from Trash?
            </h2>

            <p className="text-sm break-all">
              {restoreTarget.filename}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreTarget(null)}
                className="px-4 py-2 border rounded-lg"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={restore}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                disabled={busy}
              >
                {busy ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}