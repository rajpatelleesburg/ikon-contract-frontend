"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";

/* =========================
   STAGE CONFIG (OPEN-ENDED)
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

const EMD_OPTIONS = [
  { value: "IKON_REALTY", label: "Ikon Realty" },
  { value: "LOUDOUN_TITLE", label: "Loudoun Title" },
  { value: "OTHER", label: "Other" },
];

const EMD_LINKS = {
  IKON_REALTY: [
    {
      label: "Ikon Realty Earnnest",
      url: "https://payments.earnnest.com/ikonrealtyashburn/send/304",
    },
  ],
  LOUDOUN_TITLE: [
    {
      label: "Loudoun Title VA Escrow",
      url: "https://payments.earnnest.com/loudountitle/send/409",
    },
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

const getNextStage = (stage) =>
  NEXT_STAGES[stage]?.[0] || "";

/* =========================
   COMPONENT
========================= */

export default function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState("latest");

  // Stage modal state
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nextStage, setNextStage] = useState("");
  const [stageForm, setStageForm] = useState({});

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

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /* =========================
     FETCH CONTRACTS
  ========================= */

  const fetchContracts = async () => {
    try {
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error("Error fetching contracts:", err);
    }
  };

  useEffect(() => {
    if (user) fetchContracts();
  }, [user]);

  /* =========================
     SORT & FILTER
  ========================= */

  const sorted = useMemo(
    () =>
      [...files].sort(
        (a, b) =>
          new Date(b.lastModified) - new Date(a.lastModified)
      ),
    [files]
  );

  let filteredFiles = sorted;

  /* =========================
     STAGE MODAL HANDLERS
  ========================= */

  const openStageModal = (f) => {
    const stage = f.stage || "UPLOADED";
    setSelected({
      contractId: f.contractId,
      fileName: f.fileName,
      stage,
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
      const idToken = session.getIdToken().getJwtToken();

      const savedStage = nextStage;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/${selected.contractId}/stage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
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

      // 🔥 AUTO-ADVANCE
      const autoNext = getNextStage(savedStage);

      if (autoNext) {
        setSelected((prev) => ({
          ...prev,
          stage: savedStage,
        }));
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
      <div className="bg-white shadow-xl p-10 rounded-xl w-full max-w-3xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome {fullName}</h1>
          <p className="text-slate-600">Today is {today}</p>
        </div>

        <button
          onClick={() => router.push("/upload")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          Upload Contract
        </button>

        {/* CONTRACT LIST */}
        <div className="space-y-2">
          {filteredFiles.map((f) => (
            <div
              key={f.key}
              className="flex justify-between items-center bg-slate-50 p-3 rounded border"
            >
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

        {/* =========================
            STAGE MODAL
        ========================= */}
        {stageModalOpen && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4">

              {/* Header */}
              <div>
                <h3 className="text-lg font-bold">Update Stage</h3>
                <p className="text-sm text-slate-600">
                  {selected.fileName}
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex gap-1 text-xs">
                {STAGE_ORDER.map((s, idx) => {
                  const done =
                    STAGE_ORDER.indexOf(selected.stage) >= idx;
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

              {/* EMD FORM */}
              {nextStage === "EMD_COLLECTED" && (
                <div className="space-y-2">
                  <select
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm({ holder: e.target.value })
                    }
                  >
                    <option value="">EMD Held By</option>
                    {EMD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {EMD_LINKS[stageForm.holder] && (
                    <div className="space-y-1 text-sm">
                      {EMD_LINKS[stageForm.holder].map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline block"
                        >
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CONTINGENCIES FORM */}
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
                  <input
                    className="w-full border px-3 py-2 rounded"
                    placeholder="Other notes"
                    onChange={(e) =>
                      setStageForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              {/* Buttons */}
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