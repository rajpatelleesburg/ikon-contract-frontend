"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import HeaderTile from "../components/admin/HeaderTile";
import SummaryTile from "../components/admin/SummaryTile";
import FiltersTile from "../components/admin/FiltersTile";
import BulkDeleteTile from "../components/admin/BulkDeleteTile";
import AgentSection from "../components/admin/AgentSection";
import DeleteModal from "../components/admin/DeleteModal";
import BulkDeleteModal from "../components/admin/BulkDeleteModal";
import { Auth } from "aws-amplify";

/* ======================================================
   STAGE + ATTENTION (ADMIN VIEW)
====================================================== */

const STAGE_LABELS = {
  UPLOADED: "Uploaded",
  EMD_COLLECTED: "EMD Collected",
  CONTINGENCIES: "Contingencies",
  CLOSED: "Closed",
};

const ATTENTION_REASON = {
  UPLOADED: "EMD not collected",
  EMD_COLLECTED: "Contingencies pending",
  CONTINGENCIES: "Closing approaching",
};

const getAttentionReason = (stage) => ATTENTION_REASON[stage] || null;

const addrToLabel = (addr) => {
  if (!addr) return "";
  return [addr.streetNumber, addr.streetName, addr.city, addr.state]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const leafName = (k = "") => String(k).split("/").pop();
const normalizeFile = (f) => {
  const raw = leafName(f.filename || f.key);
  // ADMIN ONLY: clean rental filenames
  const adminFriendly = raw
    .replace(/^.*\sRental_w9\.pdf$/i, "Rental_w9.pdf")
    .replace(/^.*\sRental\.pdf$/i, "Rental.pdf");

  return {
    key: f.key,
    filename: adminFriendly,
    url: f.url,
    downloadUrl: f.url,
    size: f.size || 0,
  };
};



const mergeFilesByKey = (existingFiles = [], incomingFiles = []) => {
  const seen = new Set(existingFiles.map((x) => x.key));
  const merged = [...existingFiles];
  for (const f of incomingFiles) {
    if (!f?.key) continue;
    if (seen.has(f.key)) continue;
    merged.push(f);
    seen.add(f.key);
  }
  return merged;
};

const pickPrimaryFileForDelete = (item) => {
  if (!item) return null;
  if (item.key) return item; // already a file
  const files = Array.isArray(item.files) ? item.files : [];
  if (!files.length) return null;
  const contract = files.find(
    (f) => String(f.filename || "").toLowerCase() === "contract.pdf"
  );
  return contract || files[0];
};

const formatAgentName = (agentRaw) => {
  if (!agentRaw) return "Unknown Agent";

  // If it's a UUID (Cognito sub), show friendly fallback
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(agentRaw)) {
    return "Raj Patel"; // TEMP fallback
  }

  return agentRaw.replace(/-/g, " ");
};


export default function AdminDashboard({ user, signOut }) {
  const [grouped, setGrouped] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [bulkYears, setBulkYears] = useState(5);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkCountdown, setBulkCountdown] = useState(0);
  const [bulkInProgress, setBulkInProgress] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkTileOpen, setBulkTileOpen] = useState(false);

  const [dashboardMode, setDashboardMode] = useState("normal");
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [resultsSource, setResultsSource] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/meta`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const byAgent = {};

      for (const c of items) {
        const agent = formatAgentName(c.agent) || "Unknown Agent";
        const txn = c.transactionType || "PURCHASE";
        const addressLabel = addrToLabel(c.address);
        const files = Array.isArray(c.files) ? c.files.map(normalizeFile) : [];

        if (!byAgent[agent]) byAgent[agent] = [];

        /* ============================
          PURCHASE
        ============================ */
        if (txn === "PURCHASE") {
          const key = addressLabel || "Purchase Contract";

          let group = byAgent[agent].find(
            (x) => x.type === "PURCHASE" && x.label === key
          );

          if (!group) {
            const stage = c.stage || "UPLOADED";
            group = {
              type: "PURCHASE",
              label: key,
              stage,
              stageLabel: STAGE_LABELS[stage] || stage,
              attention: getAttentionReason(stage),
              lastModified:
                c.updatedAt || c.createdAt || new Date().toISOString(),
              files: [],
            };
            byAgent[agent].push(group);
          }

          group.files = mergeFilesByKey(group.files, files);

          const hasContractPdf = files.some(
            (f) => String(f.filename || "").toLowerCase() === "contract.pdf"
          );

          if (hasContractPdf) {
            const stage = c.stage || "UPLOADED";
            group.stage = stage;
            group.stageLabel = STAGE_LABELS[stage] || stage;
            group.attention = getAttentionReason(stage);
            group.lastModified =
              c.updatedAt || c.createdAt || group.lastModified;
          }

          continue;
        }

        /* ============================
          RENTAL (NO STAGE / NO EMD)
        ============================ */
        const rentalKey = `${addressLabel || "Rental"} Rental`
          .replace(/\s+/g, " ")
          .trim();

        let rentalGroup = byAgent[agent].find(
          (x) => x.type === "RENTAL" && x.label === rentalKey
        );

        if (!rentalGroup) {
          rentalGroup = {
            type: "RENTAL",
            label: rentalKey,
            stage: null,
            stageLabel: null,
            attention: null,
            lastModified:
              c.updatedAt || c.createdAt || new Date().toISOString(),
            files: [],
          };
          byAgent[agent].push(rentalGroup);
        }

        rentalGroup.files = mergeFilesByKey(rentalGroup.files, files);

        // 🔒 HARD GUARANTEE: rentals never show stage / EMD
        rentalGroup.stage = null;
        rentalGroup.stageLabel = null;
        rentalGroup.attention = null;

        rentalGroup.lastModified =
          c.updatedAt || c.createdAt || rentalGroup.lastModified;
      }

      Object.keys(byAgent).forEach((agent) => {
        byAgent[agent].sort(
          (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
        );
      });

      setGrouped(byAgent);

      const expandState = {};
      Object.keys(byAgent).forEach((a) => {
        expandState[a] = true;
      });
      setExpanded(expandState);
    } catch (e) {
      console.error("Error fetching admin contracts:", e);
      setGrouped({});
      setError("Unable to load contracts. Please refresh.");
    } finally {
      setLoading(false);
    }
  };


  const agentNames = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const totalContracts = useMemo(
    () => agentNames.reduce((sum, a) => sum + (grouped[a]?.length || 0), 0),
    [agentNames, grouped]
  );

  const flatFiles = useMemo(() => {
    const arr = [];

    Object.entries(grouped).forEach(([agent, items]) => {
      (items || []).forEach((item) => {
        (item.files || []).forEach((f) => {
          // 🔑 Source of truth: metadata first, fallback to grouping
          const txn =
            f.transactionType ||
            item.transactionType ||
            item.type;

          const isRental = txn === "RENTAL";

          arr.push({
            agent,
            file: {
              ...f,

              // 🔒 Rentals NEVER expose stage / EMD
              stage: isRental ? null : item.stage,
              stageLabel: isRental ? null : item.stageLabel,
              attention: isRental ? null : item.attention,

              lastModified: item.lastModified,
              transactionType: txn,
            },
          });
        });
      });
    });

    return arr;
  }, [grouped]);


  const windowInfo = useMemo(() => {
    const now = new Date();

    const inMonth = flatFiles.filter(({ file }) => {
      const d = new Date(file.lastModified);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const byDays = (days) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return flatFiles.filter(({ file }) => new Date(file.lastModified) >= cutoff);
    };

    let chosen = inMonth;
    let label = "This month";
    if (!chosen.length) {
      chosen = byDays(60);
      label = "Last 60 days";
    }
    if (!chosen.length) {
      chosen = byDays(90);
      label = "Last 90 days";
    }

    const perAgent = {};
    chosen.forEach(({ agent, file }) => {
      perAgent[agent] ||= [];
      perAgent[agent].push(file);
    });

    const counts = {};
    chosen.forEach(({ agent }) => {
      counts[agent] = (counts[agent] || 0) + 1;
    });

    const topAgents = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent, count]) => ({ agent, count }));

    return { label, total: chosen.length, perAgent, topAgents };
  }, [flatFiles]);

  const allContractsSorted = useMemo(() => {
    return [...flatFiles].sort((a, b) => new Date(b.file.lastModified) - new Date(a.file.lastModified));
  }, [flatFiles]);

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const bulkOptions = useMemo(() => {
    if (!flatFiles.length) {
      return [
        { value: 5, label: "Older than 5 years" },
        { value: 3, label: "Older than 3 years" },
        { value: 2, label: "Older than 2 years" },
      ];
    }

    const now = new Date();
    let oldest = now;
    flatFiles.forEach(({ file }) => {
      const d = new Date(file.lastModified);
      if (!isNaN(d) && d < oldest) oldest = d;
    });

    const diffYears = (now - oldest) / (1000 * 60 * 60 * 24 * 365.25);

    if (diffYears >= 5) {
      return [
        { value: 5, label: "Older than 5 years" },
        { value: 3, label: "Older than 3 years" },
        { value: 2, label: "Older than 2 years" },
      ];
    }
    if (diffYears >= 3) {
      return [
        { value: 3, label: "Older than 3 years" },
        { value: 2, label: "Older than 2 years" },
        { value: 1, label: "Older than 1 year" },
      ];
    }
    if (diffYears >= 2) {
      return [
        { value: 2, label: "Older than 2 years" },
        { value: 1, label: "Older than 1 year" },
        { value: 0.5, label: "Older than 6 months" },
      ];
    }
    return [
      { value: 1, label: "Older than 1 year (This year)" },
      { value: 0.25, label: "Older than 3 months (This quarter)" },
      { value: 1 / 12, label: "Older than 1 month (This month)" },
    ];
  }, [flatFiles]);

  const applyFilters = () => {
    let filtered = JSON.parse(JSON.stringify(grouped));

    if (selectedAgent) filtered = { [selectedAgent]: filtered[selectedAgent] || [] };

    if (search.trim()) {
      const q = search.toLowerCase();
      const newFiltered = {};
      Object.keys(filtered).forEach((agent) => {
        const matching = (filtered[agent] || []).filter((item) => {
          const labelText = (item.label || "").toLowerCase();
          const fileText = (item.files || []).map((x) => x.filename || "").join(" ").toLowerCase();
          return agent.toLowerCase().includes(q) || labelText.includes(q) || fileText.includes(q);
        });
        if (matching.length) newFiltered[agent] = matching;
      });
      filtered = newFiltered;
    }

    if (dateRange.start || dateRange.end) {
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      const newFiltered = {};
      Object.keys(filtered).forEach((agent) => {
        const matching = (filtered[agent] || []).filter((item) => {
          const d = new Date(item.lastModified);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
        if (matching.length) newFiltered[agent] = matching;
      });
      filtered = newFiltered;
    }

    return filtered;
  };

  const filteredGrouped = useMemo(applyFilters, [grouped, selectedAgent, search, dateRange]);

  const filteredHasResults = useMemo(
    () => Object.values(filteredGrouped).some((files) => Array.isArray(files) && files.length > 0),
    [filteredGrouped]
  );

  useEffect(() => {
    const hasFilterInput = !!((search && search.trim()) || selectedAgent || dateRange.start || dateRange.end);

    if (hasFilterInput) {
      if (filteredHasResults) {
        if (resultsSource !== "filters" || dashboardMode !== "agents") {
          setResultsSource("filters");
          setDashboardMode("agents");
          setFocusedAgent(null);
        }
      } else {
        if (resultsSource === "filters" && dashboardMode !== "normal") setDashboardMode("normal");
        if (resultsSource === "filters") setResultsSource(null);
      }
    } else {
      if (resultsSource === "filters") {
        if (dashboardMode !== "normal") setDashboardMode("normal");
        setResultsSource(null);
      }
    }
  }, [search, selectedAgent, dateRange, filteredHasResults, resultsSource, dashboardMode]);

  const openDeleteModal = (agentName, fileOrGroup) => {
    const primary = pickPrimaryFileForDelete(fileOrGroup);
    if (!primary?.key) {
      toast.error("Unable to delete: missing file key");
      return;
    }
    setDeleteTarget({ agentName, file: primary });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setShowDeleteModal(false);
  };

  const confirmDeleteFile = async () => {
    if (!deleteTarget) return;

    try {
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const encodedKey = deleteTarget.file.key.split("/").map(encodeURIComponent).join("/");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${encodedKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Delete failed (${res.status}): ${text}`);
      }

      await fetchContracts();
      toast.success("File deleted");
    } catch (err) {
      console.error("Error deleting file:", err);
      setError("Unable to delete file. Please try again.");
      toast.error("Unable to delete file. Please try again.");
    } finally {
      closeDeleteModal();
    }
  };

  useEffect(() => {
    if (bulkConfirmText === "DELETE" && showBulkModal) {
      setBulkCountdown(10);
      const timer = setInterval(() => {
        setBulkCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setBulkCountdown(0);
    }
  }, [bulkConfirmText, showBulkModal]);

  const openBulkModal = () => {
    setBulkConfirmText("");
    setBulkCountdown(0);
    setShowBulkModal(true);
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkConfirmText("");
    setBulkCountdown(0);
    setBulkInProgress(false);
  };

  const executeBulkDelete = async () => {
    if (bulkConfirmText !== "DELETE") return;

    try {
      setBulkInProgress(true);
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/bulk-delete?years=${bulkYears}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`Bulk delete failed: ${res.status}`);

      await res.json();
      await fetchContracts();
      toast.success("Bulk cleanup request submitted");
    } catch (err) {
      console.error("Bulk delete error:", err);
      setError("Bulk delete failed. Please try again.");
      toast.error("Bulk delete failed. Please try again.");
    } finally {
      closeBulkModal();
    }
  };

  const handleBackToDashboard = () => {
    setDashboardMode("normal");
    setFocusedAgent(null);
    setResultsSource(null);
    setSearch("");
    setSelectedAgent("");
    setDateRange({ start: "", end: "" });
    setFiltersOpen(false);
    setBulkTileOpen(false);
  };

  const hasSummaryResults = resultsSource === "summary" && dashboardMode !== "normal";
  const hasFilterResults = resultsSource === "filters" && filteredHasResults;
  const showAnyResults = hasSummaryResults || hasFilterResults;
  const isFilterMode = hasFilterResults;
  const showBackLink = hasSummaryResults || hasFilterResults || bulkTileOpen;

  const resultsSection = showAnyResults ? (
    <div className="space-y-3 animate-fade-in">
      <AgentSection
        mode={dashboardMode}
        grouped={grouped}
        filteredGrouped={filteredGrouped}
        expanded={expanded}
        setExpanded={setExpanded}
        formatSize={formatSize}
        onDelete={openDeleteModal}
        onDragStart={(e, file) => {
          const url = file?.downloadUrl || file?.url;
          if (!url) return;
          e.dataTransfer.setData("DownloadURL", `application/octet-stream:${url}`);
        }}
        windowInfo={windowInfo}
        allContractsSorted={allContractsSorted}
        focusedAgent={focusedAgent}
        setFocusedAgent={setFocusedAgent}
        searchTerm={isFilterMode ? search : ""}
      />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-4xl bg-white p-6 sm:p-8 rounded-xl shadow-xl space-y-6">
        <HeaderTile signOut={signOut} />

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <SummaryTile
          totalAgents={agentNames.length}
          totalContracts={totalContracts}
          windowLabel={windowInfo.label}
          windowCount={windowInfo.total}
          topAgents={windowInfo.topAgents}
          onAgentsClick={() => {
            setSearch("");
            setSelectedAgent("");
            setDateRange({ start: "", end: "" });
            setResultsSource("summary");
            setDashboardMode("agents");
            setFocusedAgent(null);
          }}
          onContractsClick={() => {
            setSearch("");
            setSelectedAgent("");
            setDateRange({ start: "", end: "" });
            setResultsSource("summary");
            setDashboardMode("allContracts");
            setFocusedAgent(null);
          }}
          onWindowClick={() => {
            setSearch("");
            setSelectedAgent("");
            setDateRange({ start: "", end: "" });
            setResultsSource("summary");
            setDashboardMode("window");
            setFocusedAgent(null);
          }}
          onTopAgentClick={(agent) => {
            setSearch("");
            setSelectedAgent("");
            setDateRange({ start: "", end: "" });
            setResultsSource("summary");
            setDashboardMode("window");
            setFocusedAgent(agent);
          }}
        />

        {showBackLink && (
          <div className="pt-1 pb-2 animate-fade-in">
            <button onClick={handleBackToDashboard} className="text-blue-600 hover:underline text-sm">
              ← Back to Dashboard
            </button>
          </div>
        )}

        {hasSummaryResults && resultsSection}

        <FiltersTile
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          search={search}
          setSearch={setSearch}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          dateRange={dateRange}
          setDateRange={setDateRange}
          agentNames={agentNames}
          grouped={grouped}
          hasResults={hasFilterResults}
          onBack={handleBackToDashboard}
        />

        {hasFilterResults && resultsSection}

        <BulkDeleteTile
          bulkTileOpen={bulkTileOpen}
          setBulkTileOpen={setBulkTileOpen}
          bulkYears={bulkYears}
          setBulkYears={setBulkYears}
          openBulkModal={openBulkModal}
          bulkOptions={bulkOptions}
        />
      </div>

      {showDeleteModal && deleteTarget && (
        <DeleteModal target={deleteTarget} onClose={closeDeleteModal} onConfirm={confirmDeleteFile} />
      )}

      {showBulkModal && (
        <BulkDeleteModal
          years={bulkYears}
          confirmText={bulkConfirmText}
          setConfirmText={setBulkConfirmText}
          countdown={bulkCountdown}
          setCountdown={setBulkCountdown}
          inProgress={bulkInProgress}
          onClose={closeBulkModal}
          onConfirm={executeBulkDelete}
        />
      )}
    </div>
  );
}