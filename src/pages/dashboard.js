"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";

/* =========================
   STAGE CONFIG
========================= */

const STAGE_ORDER = [
  "UPLOADED",
  "EMD_COLLECTED",
  "CONTINGENCIES",
  "CLOSED",
  "COMMISSION",
];

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

const getNextStage = (stage) => NEXT_STAGES[stage]?.[0] || "";

/* =========================
   EMD CONFIG
========================= */

const EMD_LINKS = {
  IKON_REALTY: [
    {
      label: "Ikon Realty Earnnest",
      url: "https://payments.earnnest.com/ikonrealtyashburn/send/304",
    },
  ],
  LOUDOUN_TITLE_VA: [
    {
      label: "Loudoun Title VA Escrow",
      url: "https://payments.earnnest.com/loudountitle/send/409",
    },
  ],
  LOUDOUN_TITLE_MD: [
    {
      label: "Loudoun Title MD Escrow",
      url: "https://payments.earnnest.com/loudountitle/send/102999",
    },
  ],
};

const CONTINGENCY_TYPES = [
  { value: "HOME_INSPECTION", label: "Home Inspection" },
  { value: "FINANCE", label: "Finance" },
  { value: "APPRAISAL", label: "Appraisal" },
  { value: "OTHER", label: "Other" },
];

/* =========================
   HELPERS
========================= */

const getPropertyStateSafe = (address) => {
  if (!address) return null;
  if (address.state === "VA") return "VA";
  if (address.state === "MD") return "MD";
  if (address.state === "DC") return "DC";
  return null;
};

const filterFilesByView = (files = [], view) => {
  if (!Array.isArray(files)) return [];

  const now = new Date();

  const isSameMonth = (d) =>
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const startOfQuarter = new Date(
    now.getFullYear(),
    Math.floor(now.getMonth() / 3) * 3,
    1
  );

  const startOfYear = new Date(now.getFullYear(), 0, 1);

  switch (view) {
    case "recent":
      return [...files]
        .sort(
          (a, b) =>
            new Date(b.lastModified) - new Date(a.lastModified)
        )
        .slice(0, 3);

    case "month":
      return files.filter((f) =>
        isSameMonth(new Date(f.lastModified))
      );

    case "quarter":
      return files.filter(
        (f) => new Date(f.lastModified) >= startOfQuarter
      );

    case "year":
      return files.filter(
        (f) => new Date(f.lastModified) >= startOfYear
      );

    case "older":
      return files.filter(
        (f) => new Date(f.lastModified) < startOfYear
      );

    default:
      return files;
  }
};


/* =========================
   COMPONENT
========================= */

export default function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [nextCursor, setNextCursor] = useState(null); 
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nextStage, setNextStage] = useState("");
  const [stageForm, setStageForm] = useState({});

  // ✅ NEW: view filter
  const [viewFilter, setViewFilter] = useState("recent");

  /* =========================
     LOAD PROFILE
  ========================= */

  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then((u) => setProfile(u.attributes))
      .catch(console.error);
  }, []);

  const fullName =
    profile?.given_name && profile?.family_name
      ? `${profile.given_name} ${profile.family_name}`
      : profile?.email?.split("@")[0] || "Agent";

  /* =========================
     FETCH CONTRACTS
  ========================= */

  const fetchContracts = async () => {
    try {
      const session = await Auth.currentSession();
      const accessToken = session
        .getAccessToken()
        .getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/user`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed: ${res.status}`);
      }

      const data = await res.json();

      //setFiles(data || []);
      // NEW: backend returns { items, nextCursor }
      setFiles(Array.isArray(data.items) ? data.items : []);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };


  useEffect(() => {
    if (user) fetchContracts();
  }, [user]);

  const visibleFiles = useMemo(
    () => filterFilesByView(files, viewFilter),
    [files, viewFilter]
  );

  /* =========================
     STAGE MODAL HANDLERS
  ========================= */

  const openStageModal = (f) => {
    const stage = f.stage || "UPLOADED";
    setSelected({
      contractId: f.contractId,
      fileName: f.fileName,
      stage,
      address: f.address || f.stageData?.address || {},
    });
    setNextStage(getNextStage(stage));
    setStageForm({});
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setStageModalOpen(false);
    setSelected(null);
    setNextStage("");
    setStageForm({});
  };

  const saveStage = async () => {
    if (!selected?.contractId || !nextStage) return;

    try {
      const session = await Auth.currentSession();
      //const idToken = session.getIdToken().getJwtToken();
      const accessToken = session.getAccessToken().getJwtToken();
      const savedStage = nextStage;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/${selected.contractId}/stage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage: savedStage,
            stageData: stageForm,
          }),
        }
      );

      if (!res.ok) throw new Error("Stage update failed");

      await fetchContracts();

      const autoNext = getNextStage(savedStage);
      if (autoNext) {
        setSelected((prev) => ({ ...prev, stage: savedStage }));
        setNextStage(autoNext);
        setStageForm({});
        setStageModalOpen(true);
      } else {
        closeStageModal();
      }
    } catch (err) {
      console.error(err);
      alert("Unable to update stage.");
    }
  };

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl p-10 rounded-xl w-full max-w-3xl space-y-6">

        <h1 className="text-3xl font-bold text-center">
          Welcome {fullName}
        </h1>

        <button
          onClick={() => router.push("/upload")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          Upload Contract
        </button>

        {/* FILTER DROPDOWN */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-700">
            Contracts
          </h2>

          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
            className="border px-2 py-1 text-sm rounded"
          >
            <option value="recent">Recent Contracts</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="older">Older Contracts</option>
          </select>
        </div>

        {/* CONTRACT LIST */}
        <div className="space-y-2">
          {visibleFiles.map((f) => (
            <div key={f.contractId || f.s3Key} className="contract-row">
              <div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {f.fileName}
                </a>
                <div className="text-xs text-slate-500">
                  {new Date(f.lastModified).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 rounded bg-slate-200">
                  {STAGE_LABELS[f.stage]}
                </span>
                <button
                  onClick={() => openStageModal(f)}
                  className="px-3 py-2 text-sm rounded bg-slate-800 text-white"
                >
                  Update Stage
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={signOut}
          className="w-full bg-slate-800 text-white py-3 rounded-lg"
        >
          Sign Out
        </button>

        {/* STAGE MODAL */}
        {stageModalOpen && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4">
              <h3 className="text-lg font-bold">
                Update Stage — {STAGE_LABELS[selected.stage]}
              </h3>

              <div className="flex gap-1 text-xs">
                {STAGE_ORDER.map((s, idx) => {
                  const done = STAGE_ORDER.indexOf(selected.stage) >= idx;
                  return (
                    <div
                      key={s}
                      className={`flex-1 text-center py-1 rounded ${
                        done
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {idx + 1}. {STAGE_LABELS[s]}
                    </div>
                  );
                })}
              </div>

              {/* EMD */}
              {nextStage === "EMD_COLLECTED" && (() => {
                const state = getPropertyStateSafe(selected.address);

                return (
                  <div className="space-y-2">
                    <select
                      className="w-full border px-3 py-2 rounded"
                      onChange={(e) =>
                        setStageForm({ holder: e.target.value })
                      }
                    >
                      <option value="">EMD Held By</option>
                      <option value="IKON_REALTY">Ikon Realty</option>

                      {state === "VA" && (
                        <option value="LOUDOUN_TITLE_VA">
                          Loudoun Title VA Escrow
                        </option>
                      )}

                      {state === "MD" && (
                        <option value="LOUDOUN_TITLE_MD">
                          Loudoun Title MD Escrow
                        </option>
                      )}

                      <option value="OTHER">Other</option>
                    </select>

                    {(EMD_LINKS[stageForm.holder] || []).map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline block text-sm"
                      >
                        {l.label}
                      </a>
                    ))}
                  </div>
                );
              })()}

              {/* CONTINGENCIES */}
              {nextStage === "CONTINGENCIES" && (
                <div className="space-y-2">
                  {CONTINGENCY_TYPES.map((c) => (
                    <label key={c.value} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        onChange={(e) =>
                          setStageForm((prev) => {
                            const set = new Set(prev.types || []);
                            e.target.checked
                              ? set.add(c.value)
                              : set.delete(c.value);
                            return { ...prev, types: Array.from(set) };
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}

              {/* CLOSED */}
              {nextStage === "CLOSED" && (
                <div className="space-y-2">
                  <input
                    type="date"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({
                        ...p,
                        closingDate: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Title Company Name"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({
                        ...p,
                        titleCompany: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Commission Amount"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({
                        ...p,
                        commissionAmount: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Admin Fee (optional)"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({
                        ...p,
                        adminFee: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  onClick={closeStageModal}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStage}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
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