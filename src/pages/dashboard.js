"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import dynamic from "next/dynamic";

/* =========================
   STAGE CONFIG
========================= */

const STAGE_ORDER = ["UPLOADED", "EMD_COLLECTED", "CONTINGENCIES", "CLOSED"];

const STAGE_LABELS = {
  UPLOADED: "Uploaded",
  EMD_COLLECTED: "Collect EMD",
  CONTINGENCIES: "Contingencies",
  CLOSED: "Closed",
};

const NEXT_STAGES = {
  UPLOADED: ["EMD_COLLECTED"],
  EMD_COLLECTED: ["CONTINGENCIES"],
  CONTINGENCIES: ["CLOSED"],
  CLOSED: [],
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

const getPropertyStateSafe = (address) => address?.state || null;

// --- DISPLAY NAME NORMALIZATION (Agent UI only) ---
const stripFolder = (s = "") => String(s).split("/").pop(); // last segment
const stripStateParens = (s = "") =>
  String(s).replace(/\((VA|MD|DC)\)/g, "$1"); // "(VA)" -> "VA"
const normalizeSpaces = (s = "") => String(s).replace(/\s+/g, " ").trim();

const displayFileName = (rawName) =>
  normalizeSpaces(stripStateParens(stripFolder(rawName)));

// Rental guard (existing)
const isRental = (contract) =>
  contract?.transactionType === "RENTAL" ||
  contract?.fileName?.toLowerCase().includes(" rental") ||
  contract?.s3Key?.toLowerCase().includes(" rental/");

// ✅ Purchase primary contract detection (API-safe)
const isPurchasePrimaryContract = (f) => {
  if (!f) return false;

  // Rental guard (existing behavior preserved)
  if (
    f.transactionType === "RENTAL" ||
    String(f.fileName || "").toLowerCase().includes(" rental")
  ) {
    return false;
  }

  // Purchase primary contract is always Contract.pdf + has address
  return (
    String(f.fileName || "").toLowerCase() === "contract.pdf" &&
    !!f.address
  );
};

const getPurchaseLabelFromAddress = (addr) => {
  if (!addr) return "Purchase Contract";
  return [addr.streetNumber, addr.streetName, addr.city, addr.state]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

// --- PURCHASE GROUPING (additive, non-breaking) ---

const getPurchaseGroupKey = (f) => {
  const a = f.address || {};
  return [a.streetNumber, a.streetName, a.city, a.state]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const isPurchaseFile = (f) =>
  !isRental(f) && !!f.address; // purchase files always have address

const isPurchaseChildFile = (f) =>
  isPurchaseFile(f) && !isPurchasePrimaryContract(f);



// ✅ Correct purchase detection (NO MORE length hacks)
const isPurchaseContractRow = (f) => {
  if (!f?.s3Key) return false;

  // If transactionType exists, respect it
  if (f.transactionType) {
    if (f.transactionType === "RENTAL") return false;
    // Purchase record for the primary contract we list should be Contract.pdf inside folder
    return String(f.fileName || "").toLowerCase() === "contract.pdf";
  }

  // If backend does not send transactionType, infer:
  // rental paths contain " Rental/" folder
  const s3 = String(f.s3Key);
  const isRentalPath = / rental\//i.test(s3);

  // purchase primary contract should end with "/Contract.pdf"
  const endsWithContractPdf = /\/contract\.pdf$/i.test(s3);

  return !isRentalPath && endsWithContractPdf;
};

// Upload helper: presign + PUT
const presignAndPut = async ({
  apiUrl,
  token,
  address,
  transactionType,
  fileRole,
  agentName,
  file,
  filename,
}) => {
  const presignRes = await fetch(`${apiUrl}/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename,
      contentType: file.type,
      fileSize: file.size,
      agentName,
      address,
      transactionType,
      fileRole,
      // tenantBrokerInvolved not needed for PURCHASE roles
    }),
  });

  const presignData = await presignRes.json().catch(() => null);

  if (!presignRes.ok || !presignData?.url) {
    throw new Error(presignData?.message || "Presign failed");
  }

  const putRes = await fetch(presignData.url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }

  return presignData.key; // s3Key
};

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

  const FETCH_LIMIT = 10;
  const DISPLAY_LIMIT = 3;
  const limit = FETCH_LIMIT;

  const [displayCount, setDisplayCount] = useState(3);

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
    setDisplayCount(3);
    fetchContracts({ append: false });
  }, [user, viewFilter, fetchContracts]);

  /* =========================
     SEARCH FILTER
  ========================= */

  const nameIncludes = (name, q) => (name || "").toLowerCase().includes(q);

  const visibleFiles = useMemo(() => {
  const q = search.trim().toLowerCase();

  // 1️⃣ Filter FIRST (flat)
  const filtered = files.filter((f) => {
    const name = (f.fileName || "").toLowerCase();

    // Preserve existing exclusions
    if (name.includes("rental_w9") || name.includes("rentalw9")) return false;

    if (!q) return true;

    const addr = f.address || {};
    const addressText = [
      addr.streetNumber,
      addr.streetName,
      addr.city,
      addr.state,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      name.includes(q) ||
      addressText.includes(q)
    );
  });

  // 2️⃣ THEN group
  const purchaseGroups = {};
  const rentals = [];

  filtered.forEach((f) => {
    if (isRental(f)) {
      rentals.push(f);
    } else if (isPurchaseFile(f)) {
      const key = getPurchaseGroupKey(f);
      purchaseGroups[key] = purchaseGroups[key] || [];
      purchaseGroups[key].push(f);
    }
  });

  return { rentals, purchaseGroups };
}, [files, search]);



  const [autoAdjusted, setAutoAdjusted] = useState(false);

  useEffect(() => {
    if (viewFilter !== "recent") return;
    if (loading) return;
    if (autoAdjusted) return;

    if (files.length < DISPLAY_LIMIT) {
      setAutoAdjusted(true);
      setViewFilter("month");
    }
  }, [viewFilter, files.length, loading, autoAdjusted]);

  /* =========================
     STAGE MODAL
  ========================= */

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [nextStage, setNextStage] = useState("");
  const [stageForm, setStageForm] = useState({});

  const openStageModal = (f) => {
    if (isRental(f)) return;
    if (f.stage === "CLOSED") return;

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
     SAVE STAGE + OPTIONAL UPLOADS
  ========================= */

  const saveStage = async () => {
    if (!selected || !nextStage) return;

    const prevStage = selected.stage;
    selected.stage = nextStage;
    closeStageModal();

    try {
      const session = await Auth.currentSession();
      const token = session.getAccessToken().getJwtToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // ✅ Identify PURCHASE primary contract safely
      const isPurchase =
        !isRental(selected) &&
        String(selected?.fileName || "").toLowerCase() === "contract.pdf" &&
        !!selected?.address;

      // ✅ If moving to CLOSED for PURCHASE: upload ALTA + comm json first
      if (nextStage === "CLOSED" && isPurchase) {
        const idPayload = session.getIdToken().payload;

        const agentFolder =
          idPayload.given_name && idPayload.family_name
            ? `${idPayload.given_name}-${idPayload.family_name}`.replace(/\s+/g, "-")
            : (idPayload.email || "").split("@")[0];

        // 1️⃣ ALTA upload (optional)
        if (stageForm?.altaFile instanceof File) {
          const altaKey = await presignAndPut({
            apiUrl,
            token,
            address: selected.address,
            transactionType: "PURCHASE",
            fileRole: "ALTA",
            agentName: agentFolder,
            file: stageForm.altaFile,
            filename: "ALTA.pdf",
          });

          // Replace File object with reference only
          stageForm.altaFile = { s3Key: altaKey };
        }

        // 2️⃣ Commission Disbursement JSON (only if meaningful data exists)
        if (
          stageForm.commissionNote ||
          stageForm.commissionAmount ||
          stageForm.adminFee ||
          stageForm.titleCompany ||
          stageForm.closingDate
        ) {
          const commJson = {
            contractId: selected.contractId,
            property: selected.address,
            closingDate: stageForm.closingDate || "",
            titleCompany: stageForm.titleCompany || "",
            commissionAmount: stageForm.commissionAmount || "",
            adminFee: stageForm.adminFee || "",
            commissionNote: stageForm.commissionNote || "",
            createdAt: new Date().toISOString(),
          };

          const jsonBlob = new Blob([JSON.stringify(commJson, null, 2)], {
            type: "application/json",
          });
          const jsonFile = new File([jsonBlob], "Comm_Disbursement.json", {
            type: "application/json",
          });

          const commKey = await presignAndPut({
            apiUrl,
            token,
            address: selected.address,
            transactionType: "PURCHASE",
            fileRole: "COMM_DISBURSEMENT",
            agentName: agentFolder,
            file: jsonFile,
            filename: "Comm_Disbursement.json",
          });

          stageForm.commDisbursement = { s3Key: commKey };
        }
      }

      // ✅ NOW save stage metadata (this was missing before)
      const res = await fetch(`${apiUrl}/contract/stage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId: selected.contractId,
          stage: nextStage,
          stageData: stageForm || {},
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("Stage update failed:", t);
        throw new Error("Stage update failed");
      }

      // Refresh dashboard
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
        <h1 className="text-3xl font-bold text-center">Welcome {fullName}</h1>

        <button
          onClick={() => router.push("/upload")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          Upload Contract
        </button>

        <div className="flex gap-2">
          <select
            value={viewFilter}
            onChange={(e) => {
              setViewFilter(e.target.value);
              setAutoAdjusted(false);
            }}
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
            {/* PURCHASE FOLDERS */}
{Object.entries(visibleFiles.purchaseGroups).map(([key, group]) => {
  const primary = group.find(isPurchasePrimaryContract);
  if (!primary) return null;

  return (
    <div key={key} className="bg-slate-50 border rounded p-3 space-y-2">
      {/* Folder header */}
      <div className="flex justify-between items-center">
        <div className="font-semibold text-slate-800">
          {getPurchaseLabelFromAddress(primary.address)}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-slate-200">
            {STAGE_LABELS[primary.stage]}
          </span>

          {primary.stage !== "CLOSED" && (
            <button
              onClick={() => openStageModal(primary)}
              className="px-3 py-2 text-sm rounded bg-slate-800 text-white"
            >
              Update Stage
            </button>
          )}
        </div>
      </div>

      {/* Files inside folder */}
      <div className="pl-4 space-y-1">
        {group.map((f) => (
          <div key={f.contractId} className="text-sm">
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              {displayFileName(f.fileName)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
})}

{/* RENTALS (unchanged behavior) */}
{visibleFiles.rentals.map((f) => (
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
        {displayFileName(f.fileName)}
      </a>
      <div className="text-xs text-slate-500">
        {f.lastModified
          ? new Date(f.lastModified).toLocaleDateString()
          : ""}
      </div>
    </div>
  </div>
))}

          </div>
        )}

        {!loading && visibleFiles.length > displayCount && (
          <button
            onClick={() => setDisplayCount((c) => c + DISPLAY_LIMIT)}
            className="w-full border rounded py-2"
          >
            Load More
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
                      onChange={(e) => setStageForm({ holder: e.target.value })}
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

                    {stageForm.holder === "OTHER" && (
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="Enter EMD holder name"
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
                    <label key={c.value} className="flex gap-2 text-sm items-center">
                      <input
                        type="checkbox"
                        checked={(stageForm.types || []).includes(c.value)}
                        onChange={(e) =>
                          setStageForm((prev) => {
                            const set = new Set(prev.types || []);
                            e.target.checked ? set.add(c.value) : set.delete(c.value);

                            // If "OTHER" gets unchecked, clear the text
                            const next = { ...prev, types: Array.from(set) };
                            if (!set.has("OTHER")) delete next.otherText;
                            return next;
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}

                  {(stageForm.types || []).includes("OTHER") && (
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Specify other contingency (max 100 chars)"
                      className="w-full border px-3 py-2 rounded text-sm"
                      value={stageForm.otherText || ""}
                      onChange={(e) =>
                        setStageForm((p) => ({ ...p, otherText: e.target.value }))
                      }
                    />
                  )}
                </div>
              )}


              {nextStage === "CLOSED" && (
                <div className="space-y-2">
                  <input
                    type="date"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({ ...p, closingDate: e.target.value }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Title Company Name"
                    className="w-full border px-3 py-2 rounded"
                    onChange={(e) =>
                      setStageForm((p) => ({ ...p, titleCompany: e.target.value }))
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
                      setStageForm((p) => ({ ...p, adminFee: e.target.value }))
                    }
                  />

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Upload ALTA / Settlement Statement (PDF)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="w-full border px-3 py-2 rounded text-sm"
                      onChange={(e) =>
                        setStageForm((p) => ({
                          ...p,
                          altaFile: e.target.files?.[0] || null,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Commission Instructions (for Admin)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Example: referral fee, split, etc."
                      className="w-full border px-3 py-2 rounded text-sm"
                      value={stageForm.commissionNote || ""}
                      onChange={(e) =>
                        setStageForm((p) => ({
                          ...p,
                          commissionNote: e.target.value,
                        }))
                      }
                    />
                  </div>
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

export default dynamic(() => Promise.resolve(DashboardPage), { ssr: false });