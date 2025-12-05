// src/pages/adminDashboard.js
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

  // dashboardMode: normal | agents | allContracts | window
  const [dashboardMode, setDashboardMode] = useState("normal");
  const [focusedAgent, setFocusedAgent] = useState(null);
  // resultsSource: null | "summary" | "filters"
  const [resultsSource, setResultsSource] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchContracts();
  }, [user]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);

      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts`,
        {
          headers: { Authorization: idToken },
        }
      );

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();

      let files = [];

      if (Array.isArray(data.files)) {
        const arr = data.files;
        if (arr.length && arr[0].files && arr[0].agentName) {
          arr.forEach((agentBlock) => {
            agentBlock.files.forEach((f) => {
              files.push({ ...f, _agentName: agentBlock.agentName });
            });
          });
        } else {
          files = arr;
        }
      }

      if (!files.length && Array.isArray(data.agents)) {
        data.agents.forEach((agentBlock) => {
          agentBlock.files.forEach((f) => {
            files.push({ ...f, _agentName: agentBlock.agentName });
          });
        });
      }

      const groupedData = {};

      files.forEach((rawFile) => {
        let agentName;

        if (rawFile._agentName) {
          agentName = rawFile._agentName;
        } else if (rawFile.agentName) {
          agentName = rawFile.agentName;
        } else if (rawFile.key) {
          const agentKey = rawFile.key.split("/")[0];
          agentName = agentKey.replace(/-/g, " ");
        } else {
          agentName = "Unknown Agent";
        }

        const file = {
          ...rawFile,
          filename:
            rawFile.filename ||
            (rawFile.key ? rawFile.key.split("/").pop() : "Unknown file"),
          url: rawFile.url || rawFile.downloadUrl || rawFile.signedUrl,
          downloadUrl: rawFile.downloadUrl || rawFile.url || rawFile.signedUrl,
        };

        if (!groupedData[agentName]) groupedData[agentName] = [];
        groupedData[agentName].push(file);
      });

      Object.keys(groupedData).forEach((agentName) => {
        groupedData[agentName].sort(
          (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
        );
      });

      setGrouped(groupedData);

      const expandState = {};
      Object.keys(groupedData).forEach((name) => (expandState[name] = true));
      setExpanded(expandState);
    } catch (err) {
      console.error("Error fetching admin contracts:", err);
      setGrouped({});
      setError(
        "Unable to load contracts right now. Please refresh, and if the problem continues contact support."
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
    () => agentNames.reduce((sum, a) => sum + (grouped[a]?.length || 0), 0),
    [agentNames, grouped]
  );

  const flatFiles = useMemo(() => {
    const arr = [];
    agentNames.forEach((agent) => {
      (grouped[agent] || []).forEach((file) =>
        arr.push({ agent, file })
      );
    });
    return arr;
  }, [agentNames, grouped]);

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
          return (
            agent.toLowerCase().includes(q) ||
            (f.filename || "").toLowerCase().includes(q) ||
            (f.key || "").toLowerCase().includes(q) ||
            JSON.stringify(f).toLowerCase().includes(q)
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
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const key = deleteTarget.file.key;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${encodeURIComponent(
          key
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: idToken },
        }
      );

      if (!res.ok) throw new Error("Delete failed");

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
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/bulk-delete?years=${bulkYears}`,
        {
          method: "POST",
          headers: { Authorization: idToken },
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