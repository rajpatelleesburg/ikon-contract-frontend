"use client";

import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";

export default function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
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
      } catch (e) {
        console.error("Failed to load audit log", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">
                    {new Date(i.archivedAt).toLocaleString()}
                  </td>
                  <td className="p-2">{i.sk}</td>
                  <td className="p-2">
                    Older than {i.olderThanYears} years
                  </td>
                  <td className="p-2">
                    {i.retentionDays} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}