"use client";

/**
 * Agent Dashboard (modularized)
 * - Preserves yesterday's business behavior
 * - Only extraction / wiring changes
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { Auth } from "aws-amplify";

import PurchaseFolderList from "../components/PurchaseFolderList";
import RentalList from "../components/RentalList";
import StageModal from "./StageModal";
import useStageFlow from "./useStageFlow";

/* =========================
   STAGE LABELS (UI)
   IMPORTANT:
   - UPLOADED shows "Collect EMD" (call-to-action) like you want
   - Backend stage values remain unchanged
========================= */
const STAGE_LABELS = {
  UPLOADED: "Collect EMD",
  EMD_COLLECTED: "EMD Collected",
  CONTINGENCIES: "Contingencies",
  CLOSING: "Closing",
  CLOSED: "Closed",
};

const NEXT_STAGES = {
  UPLOADED: ["EMD_COLLECTED"],
  EMD_COLLECTED: ["CONTINGENCIES"],
  CONTINGENCIES: ["CLOSING"], // UI-only; backend allows CONTINGENCIES -> CLOSED only
  CLOSING: ["CLOSED"],
  CLOSED: [],
};

const getNextStage = (s) => NEXT_STAGES[s]?.[0] || "";

/* =========================
   HELPERS
========================= */
const stripFolder = (s = "") => String(s).split("/").pop();
const stripStateParens = (s = "") => String(s).replace(/\((VA|MD|DC)\)/g, "$1");
const normalizeSpaces = (s = "") => String(s).replace(/\s+/g, " ").trim();
const displayFileName = (rawName) => normalizeSpaces(stripStateParens(stripFolder(rawName)));

const isRental = (f) =>
  f?.transactionType === "RENTAL" ||
  String(f?.fileName || "").toLowerCase().includes(" rental") ||
  String(f?.s3Key || "").toLowerCase().includes(" rental/");

const getPurchaseGroupKey = (f) => {
  const a = f.address || {};
  return [a.streetNumber, a.streetName, a.city, a.state].filter(Boolean).join(" ").trim();
};

const isPurchaseFile = (f) =>
  !isRental(f) && (!!f.address || String(f.fileName || "").toLowerCase() === "contract.pdf");

/* =========================
   PAGE
========================= */
function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [viewFilter, setViewFilter] = useState("recent");
  const [search, setSearch] = useState("");

  const DISPLAY_LIMIT = 5;
  const [displayCountByFilter, setDisplayCountByFilter] = useState({});
  const displayCount = displayCountByFilter[viewFilter] ?? DISPLAY_LIMIT;

  useEffect(() => {
    Auth.currentAuthenticatedUser()
      .then((u) => setProfile(u.attributes))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setDisplayCountByFilter((p) => ({
      ...p,
      [viewFilter]: p[viewFilter] ?? DISPLAY_LIMIT,
    }));
  }, [viewFilter, search]);

  const fullName =
    profile?.given_name && profile?.family_name
      ? `${profile.given_name} ${profile.family_name}`
      : profile?.email?.split("@")[0] || "Agent";

  /* =========================
     FETCH CONTRACTS
  ========================= */
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);

      const session = await Auth.currentSession();
      const token = session.getAccessToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contracts/user?view=${viewFilter}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const data = await res.json();
      setFiles(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Error fetching contracts:", err);
    } finally {
      setLoading(false);
    }
  }, [viewFilter]);

  useEffect(() => {
    if (!user) return;
    setFiles([]);
    fetchContracts();
  }, [user, viewFilter, fetchContracts]);

  /* =========================
     SEARCH + GROUP
  ========================= */
  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = files.filter((f) => {
      const name = (f.fileName || "").toLowerCase();
      if (name.includes("rental_w9") || name.includes("rentalw9")) return false;

      if (!q) return true;

      const addr = f.address || {};
      const addressText = [addr.streetNumber, addr.streetName, addr.city, addr.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return name.includes(q) || addressText.includes(q);
    });

    const purchaseGroups = {};
    const rentals = [];

    filtered.forEach((f) => {
      if (isRental(f)) {
        rentals.push(f);
      } else if (isPurchaseFile(f)) {
        const key = getPurchaseGroupKey(f) || f.contractId || f.s3Key || f.url;
        purchaseGroups[key] = purchaseGroups[key] || [];
        purchaseGroups[key].push(f);
      }
    });

    return { purchaseGroups, rentals };
  }, [files, search]);

  /* =========================
     STAGE FLOW (HOOK)
  ========================= */
  const {
    stageModalOpen,
    selected,
    stageForm,
    setStageForm,
    modalStep,
    setModalStep,
    openStageModal,
    closeStageModal,
    saveStage,
  } = useStageFlow({
    fetchContracts,
    getNextStage,
  });

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
            className="w-full max-w-xs sm:max-w-sm md:max-w-md border px-3 py-1 rounded text-sm"
          />
        </div>

        {loading && (
          <div className="space-y-2">
            {[...Array(DISPLAY_LIMIT)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 animate-pulse rounded border" />
            ))}
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            <PurchaseFolderList
              purchaseGroups={visibleFiles.purchaseGroups}
              displayCount={displayCount}
              onOpenStage={openStageModal}
              stageLabels={STAGE_LABELS}
              displayFileName={displayFileName}
            />

            <RentalList
              rentals={visibleFiles.rentals}
              displayCount={displayCount}
              displayFileName={displayFileName}
            />
          </div>
        )}

        <button onClick={signOut} className="w-full bg-slate-800 text-white py-3 rounded-lg">
          Sign Out
        </button>

        <StageModal
          open={stageModalOpen}
          selected={selected}
          stageForm={stageForm}
          setStageForm={setStageForm}
          modalStep={modalStep}
          setModalStep={setModalStep}
          onClose={closeStageModal}
          onSave={saveStage}
          stageLabels={STAGE_LABELS}
        />
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(DashboardPage), { ssr: false });