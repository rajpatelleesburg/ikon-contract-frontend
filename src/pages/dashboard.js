"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";

const STAGE_LABELS = {
  UPLOADED: "Uploaded",
  EMD_COLLECTED: "Collect EMD",
  CONTINGENCIES: "Contingencies",
  CLOSED: "Closed",
  COMMISSION: "Commission",
};

const NEXT_STAGES = {
  UPLOADED: ["EMD_COLLECTED"],
  EMD_COLLECTED: ["CONTINGENCIES"],
  CONTINGENCIES: ["CLOSED"],
  CLOSED: ["COMMISSION"],
  COMMISSION: [],
};

export default function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState("latest");

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null); // { contractId, fileName, stage }
  const [nextStage, setNextStage] = useState("");

  useEffect(() => {
    async function loadAttributes() {
      try {
        const cognitoUser = await Auth.currentAuthenticatedUser();
        setProfile(cognitoUser.attributes);
      } catch (err) {
        console.error("Error loading user attributes:", err);
      }
    }
    loadAttributes();
  }, []);

  const given = profile?.given_name || "";
  const family = profile?.family_name || "";
  const email = profile?.email || "";

  const fullName =
    given && family ? `${given} ${family}` : email ? email.split("@")[0] : "Agent";

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchContracts = async () => {
    try {
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json();
      const normalized =
        data.files ||
        (Array.isArray(data.items)
          ? data.items.map((i) => ({
              key: i.s3Key,
              lastModified: i.createdAt,
              url: i.url || null,
              stage: i.stage || "UPLOADED",
              contractId: i.contractId,
              fileName: i.fileName,
            }))
          : []);

      setFiles(normalized);
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchContracts();
  }, [user]);

  const sorted = useMemo(
    () => [...files].sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified)),
    [files]
  );

  const now = new Date();
  let filteredFiles = sorted;

  if (filter === "month") {
    filteredFiles = sorted.filter((f) => {
      const dt = new Date(f.lastModified);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    });
  }
  if (filter === "3months") {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - 3);
    filteredFiles = sorted.filter((f) => new Date(f.lastModified) >= limit);
  }
  if (filter === "6months") {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - 6);
    filteredFiles = sorted.filter((f) => new Date(f.lastModified) >= limit);
  }
  if (filter === "ytd") {
    filteredFiles = sorted.filter(
      (f) => new Date(f.lastModified).getFullYear() === now.getFullYear()
    );
  }

  const openStageModal = (f) => {
    const stage = f.stage || "UPLOADED";
    const choices = NEXT_STAGES[stage] || [];
    setSelected({
      contractId: f.contractId,
      fileName: f.fileName || f.key?.split("/")?.pop() || "Contract",
      stage,
    });
    setNextStage(choices[0] || "");
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setStageModalOpen(false);
    setSelected(null);
    setNextStage("");
  };

  const saveStage = async () => {
    if (!selected?.contractId || !nextStage) return;

    try {
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/${selected.contractId}/stage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stage: nextStage }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Stage update failed (${res.status})`);
      }

      closeStageModal();
      await fetchContracts();
    } catch (e) {
      console.error(e);
      alert("Unable to update stage. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl p-10 rounded-xl w-full max-w-3xl space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">Welcome {fullName}</h1>
          <p className="text-slate-600">Today is {today}</p>
        </div>

        <button
          onClick={() => router.push("/upload")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
        >
          Upload Contract
        </button>

        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Browse Your Contracts</h2>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full border px-3 py-2 rounded mb-4"
          >
            <option value="latest">Latest (Default)</option>
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="ytd">Year to Date</option>
            <option value="all">All Files</option>
          </select>

          {filteredFiles.length === 0 ? (
            <p className="text-slate-500">No files found for this filter.</p>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50 p-3 rounded-lg border hover:bg-slate-100"
                >
                  <div className="flex flex-col">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {(f.fileName || f.key.split("/").pop())}
                    </a>
                    <div className="text-xs text-slate-500">
                      {new Date(f.lastModified).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700">
                      {STAGE_LABELS[f.stage || "UPLOADED"] || (f.stage || "UPLOADED")}
                    </span>

                    <button
                      onClick={() => openStageModal(f)}
                      className="text-sm px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-900"
                    >
                      Update Stage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full bg-slate-800 text-white py-3 rounded-lg text-lg font-semibold hover:bg-slate-900 transition"
        >
          Sign Out
        </button>

        {/* Stage Modal */}
        {stageModalOpen && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
              <div>
                <div className="text-lg font-bold text-slate-800">Update Stage</div>
                <div className="text-sm text-slate-600">{selected.fileName}</div>
              </div>

              <div className="text-sm">
                Current:{" "}
                <span className="font-semibold">
                  {STAGE_LABELS[selected.stage] || selected.stage}
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-700 font-semibold">
                  Next stage
                </label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  className="w-full border px-3 py-2 rounded"
                  disabled={(NEXT_STAGES[selected.stage] || []).length === 0}
                >
                  {(NEXT_STAGES[selected.stage] || []).length === 0 ? (
                    <option>No further stages</option>
                  ) : (
                    (NEXT_STAGES[selected.stage] || []).map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s] || s}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeStageModal}
                  className="px-4 py-2 rounded border"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStage}
                  disabled={!nextStage}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}