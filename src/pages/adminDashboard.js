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
   ✅ ADDITIVE: STAGE + ATTENTION HELPERS (ADMIN VIEW)
====================================================== */

const STAGE_LABELS = {
  UPLOADED: "Uploaded",
  EMD_COLLECTED: "EMD Collected",
  CONTINGENCIES: "Contingencies",
  CLOSED: "Closed",
  COMMISSION: "Commission",
};

const ATTENTION_REASON = {
  UPLOADED: "EMD not collected",
  EMD_COLLECTED: "Contingencies pending",
  CONTINGENCIES: "Closing approaching",
};

/* ======================================================
   PURCHASE GROUPING HELPERS (ADMIN VIEW)
====================================================== */

const isPurchasePrimaryContract = (f) =>
  !f.isRental &&
  String(f.filename || "").toLowerCase() === "contract.pdf" &&
  !!f.address;

const isPurchaseChildFile = (f) =>
  !f.isRental &&
  !isPurchasePrimaryContract(f);

const getPurchaseGroupKey = (f) => {
  const a = f.address || {};
  return [a.streetNumber, a.streetName, a.city, a.state]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const getPurchaseLabelFromAddress = (addr) => {
  if (!addr) return "Purchase Contract";
  return [addr.streetNumber, addr.streetName, addr.city, addr.state]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};


const getAttentionReason = (stage) => ATTENTION_REASON[stage] || null;


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
  }, [user]);

  // 🔹 FIXED + NORMALIZED FETCH
  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/meta`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files : [];

      /**
       * Normalize backend S3-style files
       * key: "Agent-Name/filename.pdf"
       */
      const groupedData = {};

      const items = Array.isArray(data.items) ? data.items : [];

      const groupedByAgent = {};

      items.forEach((c) => {
        const agent = c.agent || "Unknown Agent";

        groupedByAgent[agent] ||= [];

        if (c.transactionType === "PURCHASE") {
          groupedByAgent[agent].push({
            type: "PURCHASE",
            label: [
              c.address?.streetNumber,
              c.address?.streetName,
              c.address?.city,
              c.address?.state,
            ]
              .filter(Boolean)
              .join(" "),
            stage: c.stage,
            stageLabel: STAGE_LABELS[c.stage] || c.stage,
            attention: getAttentionReason(c.stage),
            lastModified: c.updatedAt || c.createdAt,
            files: c.files.map((f) => ({
              key: f.key,
              filename: f.filename,
              url: f.url,
              downloadUrl: f.url,
              size: f.size || 0,
            })),
          });
        }

        if (c.transactionType === "RENTAL") {
          groupedByAgent[agent].push({
            type: "RENTAL",
            label: c.files[0]?.filename || "Rental",
            stage: "UPLOADED",
            stageLabel: "Uploaded",
            attention: null,
            lastModified: c.updatedAt || c.createdAt,
            files: c.files.map((f) => ({
              key: f.key,
              filename: f.filename,
              url: f.url,
              downloadUrl: f.url,
              size: f.size || 0,
            })),
          });
        }
      });

      setGrouped(groupedByAgent);

      Object.entries(groupedData).forEach(([agent, files]) => {
        const purchases = {};
        const rentals = [];

        files.forEach((f) => {
          if (f.isRental) {
            rentals.push(f);
          } else {
            const key = getPurchaseGroupKey(f);
            purchases[key] = purchases[key] || [];
            purchases[key].push(f);
          }
        });

        // Build final agent list
        const finalList = [];

        Object.entries(purchases).forEach(([key, group]) => {
          const primary = group.find(isPurchasePrimaryContract);
          if (!primary) return;

          finalList.push({
            type: "PURCHASE",
            label: getPurchaseLabelFromAddress(primary.address),
            stage: primary.stage,
            stageLabel: primary.stageLabel,
            attention: primary.attention,
            files: group,
            lastModified: primary.lastModified,
          });
        });

        rentals.forEach((r) => {
          finalList.push({
            type: "RENTAL",
            label: r.filename,
            stage: r.stage,
            stageLabel: r.stageLabel,
            attention: r.attention,
            files: [r],
            lastModified: r.lastModified,
          });
        });

        finalList.sort(
          (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
        );

        groupedByAgent[agent] = finalList;
      });

      setGrouped(groupedByAgent);

      const expandState = {};
      Object.keys(groupedData).forEach((a) => (expandState[a] = true));
      setExpanded(expandState);
    } catch (err) {
      console.error("Error fetching admin contracts:", err);
      setGrouped({});
      setError(
        "Unable to load contracts. Please refresh, and if the problem continues contact support."
      );
    } finally {
      setLoading(false);
    }
  };

  const agentNames = useMemo(
    () => Object.keys(grouped).sort(),
    [grouped]
  );

  const totalContracts = useMemo(
    () =>
      agentNames.reduce(
        (sum, a) => sum + (grouped[a]?.length || 0),
        0
      ),
    [agentNames, grouped]
  );

  const flatFiles = useMemo(() => {
    const arr = [];

    Object.entries(grouped).forEach(([agent, items]) => {
      items.forEach((item) => {
        // PURCHASE → expand to files
        if (item.type === "PURCHASE") {
          item.files.forEach((f) => {
            arr.push({ agent, file: f });
          });
        }

        // RENTAL → already file-based
        if (item.type === "RENTAL") {
          arr.push({ agent, file: item.files[0] });
        }
      });
    });

    return arr;
  }, [grouped]);


  // Everything below this point is UNCHANGED from your original file
  // (filters, summary, bulk delete, UI, modals, drag download)


  const windowInfo = useMemo(() => {
    const now = new Date();
    const files = flatFiles;

    const inMonth = files.filter(({ file }) => {
      const d = new Date(file.lastModified);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });

    const byDays = (days) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return files.filter(({ file }) => new Date(file.lastModified) >= cutoff);
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
      if (!perAgent[agent]) perAgent[agent] = [];
      perAgent[agent].push(file);
    });

    const counts = {};
    chosen.forEach(({ agent }) => {
      counts[agent] = (counts[agent] || 0) + 1;
    });

    const sortedAgents = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([agent, count]) => ({ agent, count }));

    const topAgents = sortedAgents.slice(0, 5);

    return {
      label,
      total: chosen.length,
      perAgent,
      topAgents,
    };
  }, [flatFiles]);

  const allContractsSorted = useMemo(() => {
    return [...flatFiles].sort(
      (a, b) =>
        new Date(b.file.lastModified) - new Date(a.file.lastModified)
    );
  }, [flatFiles]);

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // 🔹 Dynamic bulk cleanup options based on oldest contract age
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

    const diffMs = now - oldest;
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

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

    // No contracts older than ~2 years → focus on this year, quarter, month
    return [
      { value: 1, label: "Older than 1 year (This year)" },
      { value: 0.25, label: "Older than 3 months (This quarter)" },
      { value: 1 / 12, label: "Older than 1 month (This month)" },
    ];
  }, [flatFiles]);

  const applyFilters = () => {
    let filtered = JSON.parse(JSON.stringify(grouped));

    if (selectedAgent) {
      filtered = {
        [selectedAgent]: filtered[selectedAgent] || [],
      };
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const newFiltered = {};
      Object.keys(filtered).forEach((agent) => {
        const matching = filtered[agent].filter((f) => {
          const labelText = (f.label || "").toLowerCase();

          const fileText = (f.files || [])
            .map((x) => x.filename || "")
            .join(" ")
            .toLowerCase();

          return (
            agent.toLowerCase().includes(q) ||
            labelText.includes(q) ||
            fileText.includes(q)
          );
        });

        if (matching.length > 0) newFiltered[agent] = matching;
      });
      filtered = newFiltered;
    }

    if (dateRange.start || dateRange.end) {
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;

      const newFiltered = {};
      Object.keys(filtered).forEach((agent) => {
        const matching = filtered[agent].filter((f) => {
          const d = new Date(f.lastModified);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
        if (matching.length > 0) newFiltered[agent] = matching;
      });
      filtered = newFiltered;
    }

    return filtered;
  };

  const filteredGrouped = useMemo(applyFilters, [
    grouped,
    selectedAgent,
    search,
    dateRange,
  ]);

  const hasFilterInput = useMemo(
    () =>
      !!(
        (search && search.trim()) ||
        selectedAgent ||
        dateRange.start ||
        dateRange.end
      ),
    [search, selectedAgent, dateRange]
  );

  const filteredHasResults = useMemo(
    () =>
      Object.values(filteredGrouped).some(
        (files) => Array.isArray(files) && files.length > 0
      ),
    [filteredGrouped]
  );

  // Automatically switch to filter-results mode when filters are applied
  useEffect(() => {
    if (hasFilterInput) {
      if (filteredHasResults) {
        // Filters override summary; always show filter-driven results under Tile 3
        if (resultsSource !== "filters" || dashboardMode !== "agents") {
          setResultsSource("filters");
          setDashboardMode("agents");
          setFocusedAgent(null);
        }
      } else {
        // Filters are present but no matching data
        if (resultsSource === "filters" && dashboardMode !== "normal") {
          setDashboardMode("normal");
        }
        if (resultsSource === "filters") {
          setResultsSource(null);
        }
      }
    } else {
      // No filter input: if we were in filter mode, reset back to a clean dashboard
      if (resultsSource === "filters") {
        if (dashboardMode !== "normal") {
          setDashboardMode("normal");
        }
        setResultsSource(null);
      }
    }
  }, [hasFilterInput, filteredHasResults, resultsSource, dashboardMode]);

  const expandAll = () => {
    const all = {};
    Object.keys(grouped).forEach((name) => (all[name] = true));
    setExpanded(all);
  };

  const collapseAll = () => {
    const all = {};
    Object.keys(grouped).forEach((name) => (all[name] = false));
    setExpanded(all);
  };

  const openDeleteModal = (agentName, file) => {
    setDeleteTarget({ agentName, file });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setShowDeleteModal(false);
  };

  const confirmDeleteFile = async () => {
    if (!deleteTarget) return;

    try {
      // ✅ ALWAYS get a fresh token
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const key = deleteTarget.file.key;

      // ✅ Encode path segments individually (keeps "/" working)
      const encodedKey = key
        .split("/")
        .map(encodeURIComponent)
        .join("/");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${encodedKey}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

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

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/bulk-delete?years=${bulkYears}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (!res.ok) {
        throw new Error(`Bulk delete failed: ${res.status}`);
      }

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Redirecting…
      </div>
    );
  }

  const handleBackToDashboard = () => {
    // Reset everything back to a clean dashboard (Option D: full reset)
    setDashboardMode("normal");
    setFocusedAgent(null);
    setResultsSource(null);
    setSearch("");
    setSelectedAgent("");
    setDateRange({ start: "", end: "" });
    setFiltersOpen(false);
    setBulkTileOpen(false);
  };

  const hasSummaryResults =
    resultsSource === "summary" && dashboardMode !== "normal";

  const hasFilterResults =
    resultsSource === "filters" && filteredHasResults;

  const showAnyResults = hasSummaryResults || hasFilterResults;
  const isFilterMode = hasFilterResults;

  // show Back when summary/filter drilling or bulk tile is open
  const showBackLink =
    hasSummaryResults || hasFilterResults || bulkTileOpen;

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
          e.dataTransfer.setData(
            "DownloadURL",
            `application/octet-stream:${url}`
          );
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

        {/* TILE 2: SUMMARY */}
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

        {/* BACK BUTTON (dynamic, appears below Tile 3) */}
        {showBackLink && (
          <div className="pt-1 pb-2 animate-fade-in">
            <button
              onClick={handleBackToDashboard}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}

        {/* Summary results immediately under Tile 2 */}
        {hasSummaryResults && resultsSection}

        {/* TILE 3: FILTERS (COLLAPSIBLE) */}
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

        {/* Filter results under Tile 3 */}
        {hasFilterResults && resultsSection}

        {/* TILE 4: BULK CLEANUP (COLLAPSIBLE) */}
        <BulkDeleteTile
          bulkTileOpen={bulkTileOpen}
          setBulkTileOpen={setBulkTileOpen}
          bulkYears={bulkYears}
          setBulkYears={setBulkYears}
          openBulkModal={openBulkModal}
          bulkOptions={bulkOptions}
        />
      </div>

      {/* Individual Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onClose={closeDeleteModal}
          onConfirm={confirmDeleteFile}
        />
      )}

      {/* Bulk Delete Modal */}
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