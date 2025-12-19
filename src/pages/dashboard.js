"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import dynamic from "next/dynamic";

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
  return address.state || null;
};

// 🔒 Rental guard – rentals do NOT participate in stages
const isRental = (contract) => contract?.transactionType === "RENTAL";

/* =========================
   COMPONENT
========================= */

function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);

  const [files, setFiles] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [viewFilter, setViewFilter] = useState("recent");
  const [search, setSearch] = useState("");

  const limit = viewFilter === "recent" ? 3 : 10;

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

  const fetchContracts = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      try {
        append ? setLoadingMore(true) : setLoading(true);

        const session = await Auth.currentSession();
        const token = session.getAccessToken().getJwtToken();

        const params = new URLSearchParams({
          limit: String(limit),
          view: viewFilter,
        });

        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/contracts/user?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) throw new Error(`Failed: ${res.status}`);

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];

        setFiles((prev) => (append ? [...prev, ...items] : items));
        setNextCursor(data.nextCursor || null);
      } catch (err) {
        console.error("Error fetching contracts:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit, viewFilter]
  );

  useEffect(() => {
    if (!user) return;
    setFiles([]);
    setNextCursor(null);
    fetchContracts({ append: false });
  }, [user, viewFilter, fetchContracts]);

  /* =========================
     SEARCH FILTER (client-side)
  ========================= */

  const visibleFiles = useMemo(() => {
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter((f) => {
      const addr = f.address || {};
      return (
        f.fileName?.toLowerCase().includes(q) ||
        `${addr.streetNumber || ""} ${addr.streetName || ""}`
          .toLowerCase()
          .includes(q) ||
        addr.city?.toLowerCase().includes(q) ||
        addr.state?.toLowerCase().includes(q)
      );
    });
  }, [files, search]);

  /* =========================
     STAGE MODAL
  ========================= */

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nextStage, setNextStage] = useState("");
  const [stageForm, setStageForm] = useState({});

  const openStageModal = (f) => {
    if (isRental(f)) return; // 🚫 rentals skip stages entirely
    setSelected(f);
    setNextStage(getNextStage(f.stage));
    setStageForm({});
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setStageModalOpen(false);
    setSelected(null);
    setNextStage("");
    setStageForm({});
  };

  /* =========================
     OPTIMISTIC STAGE UPDATE
  ========================= */

  const saveStage = async () => {
    if (!selected || !nextStage) return;

    const prevStage = selected.stage;
    selected.stage = nextStage;
    closeStageModal();

    try {
      const session = await Auth.currentSession();
      const token = session.getAccessToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/${selected.contractId}/stage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage: nextStage,
            stageData: stageForm,
          }),
        }
      );

      if (!res.ok) throw new Error("Stage update failed");

      fetchContracts();
    } catch (err) {
      console.error(err);
      selected.stage = prevStage;
      fetchContracts();
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

        <div className="flex gap-2">
          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
            className="border px-2 py-1 text-sm rounded"
          >
            <option value="recent">Recent</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="older">Older</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by address or filename"
            className="flex-1 border px-3 py-1 rounded text-sm"
          />
        </div>

        {loading && (
          <div className="space-y-2">
            {[...Array(limit)].map((_, i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 animate-pulse rounded border"
              />
            ))}
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            {visibleFiles.map((f) => (
              <div
                key={f.contractId}
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
                    {f.lastModified
                      ? new Date(f.lastModified).toLocaleDateString()
                      : ""}
                  </div>
                </div>
                
                {!isRental(f) && (
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
              )}

              </div>
            ))}
          </div>
        )}

        {!loading && nextCursor && (
          <button
            onClick={() =>
              fetchContracts({ cursor: nextCursor, append: true })
            }
            disabled={loadingMore}
            className="w-full border rounded py-2"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        )}

        <button
          onClick={signOut}
          className="w-full bg-slate-800 text-white py-3 rounded-lg"
        >
          Sign Out
        </button>

        {/* STAGE MODAL */}
        {stageModalOpen && selected && !isRental(selected) && (
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
                     {/* ✅ NEW: Other Holder Textbox */}
                    {stageForm.holder === "OTHER" && (
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="Enter EMD holder name (e.g. Listing or Buyer Brokerage
                        
                        
                        )"
                        className="w-full border px-3 py-2 rounded"
                        value={stageForm.otherHolder || ""}
                        onChange={(e) =>
                          setStageForm((p) => ({
                            ...p,
                            otherHolder: e.target.value,
                          }))
                        }
                      />
                    )}
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

/* =========================
   DISABLE SSR
========================= */

export default dynamic(() => Promise.resolve(DashboardPage), {
  ssr: false,
});