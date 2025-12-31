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
import RecentActivityTile from "../components/admin/RecentActivityTile";
import UploadVelocityTile from "../components/admin/UploadVelocityTile";
import UpcomingExpirationsTile from "../components/admin/UpcomingExpirationsTile"
import { Auth } from "aws-amplify";

/* ======================================================
   STAGE + ATTENTION (ADMIN VIEW)
   Backend is authoritative for:
   - transactionType: "PURCHASE" | "RENTAL"
   - stage: string for PURCHASE, null for RENTAL
====================================================== */

const STAGE_LABELS = {
  UPLOADED: "Uploaded",
  EMD_COLLECTED: "EMD Collected",
  CONTINGENCIES: "Contingencies",
  CLOSED: "Closed",
};


const isRiskContract = (item) => {
  const contingencies = item?.stageData?.contingencies || [];
  const expiringSoon = contingencies.some((c) => {
    if (!c.expiresAt) return false;
    const diff = new Date(c.expiresAt).getTime() - Date.now();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });
  return expiringSoon || item.attention === "Closing approaching";
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

/**
 * ADMIN ONLY: display-friendly names for rental files.
 * Keys stay unchanged — delete/download still uses key.
 */
const normalizeFile = (f, txn) => {
  const rawLeaf = leafName(f.filename || f.key);

  let display = rawLeaf;

  if (txn === "RENTAL") {
    display = display
      .replace(/^.*\sRental_w9\.pdf$/i, "Rental_w9.pdf")
      .replace(/^.*\sRental\.pdf$/i, "Rental.pdf")
      .replace(/^.*rental_comm_disbursement\.json$/i, "Comm_Disbursement.json");
  }

  return {
    key: f.key,
    filename: display,
    url: f.url,
    downloadUrl: f.url,
    size: f.size || 0,
    documentType: f.documentType,
  };
};

const mergeFilesByKey = (existingFiles = [], incomingFiles = []) => {
  const seen = new Set((existingFiles || []).map((x) => x.key));
  const merged = [...(existingFiles || [])];

  for (const f of incomingFiles || []) {
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


const txnLabel = (txn) => (txn === "RENTAL" ? "Rental" : "Purchase");

const CLOSING_SOON_DAYS = 7; // 🔁 change to 14 anytime

const getClosingDate = (item) => {
  const d = item?.stageData?.closingDate;
  return d ? new Date(d) : null;
};


const getPresetDateRange = (preset) => {
  const now = new Date();

  if (preset === "month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
      label: "This Month",
    };
  }

  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), q * 3, 1),
      end: now,
      label: "This Quarter",
    };
  }

  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: now,
    label: "This Year",
  };
};


export default function AdminDashboard({ user, signOut }) {
  const [grouped, setGrouped] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
 
  const [selectedAgent, setSelectedAgent] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkCountdown, setBulkCountdown] = useState(0);
  const [bulkInProgress, setBulkInProgress] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkTileOpen, setBulkTileOpen] = useState(false);

  const [dashboardMode, setDashboardMode] = useState("normal");
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [resultsSource, setResultsSource] = useState(null);

  const [windowPreset, setWindowPreset] = useState("month"); 
// "month" | "quarter" | "year"

  const [bulkYears, setBulkYears] = useState(5); // default 5 years
  const [retentionDays, setRetentionDays] = useState(30);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [retentionAlertsSent, setRetentionAlertsSent] = useState({});

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
    }, 300); // 300ms debounce

    return () => clearTimeout(t);
  }, [searchInput]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      await fetchContracts();
      await fetchRetentionAlertsSent();
    })();
  }, [user]);

  const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
  const ALERT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

  const upcomingExpirations = useMemo(() => {
    const now = Date.now();

    const rows = [];

    Object.values(grouped).forEach(({ agentName, items }) => {
      (items || []).forEach((item) => {
        const createdAt = new Date(item.lastModified).getTime();
        const eligibleAt = createdAt + THREE_YEARS_MS;

        if (
          eligibleAt > now &&
          eligibleAt <= now + ALERT_WINDOW_MS
        ) {
          rows.push({
            agent: agentName,
            label: item.label,
            contractPk: item.pk,
            eligibleAt,
            daysLeft: Math.ceil((eligibleAt - now) / (1000 * 60 * 60 * 24)),
          });
        }
      });
    });

    return rows.sort((a, b) => a.eligibleAt - b.eligibleAt);
  }, [grouped]);


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
        // Backend meta returns: agent, transactionType, address, stage (null for rentals), files[]
        //const agent = formatAgentName(c.agent) || "Unknown Agent";
        const agentId = c.agentId || "unknown-agent";
        const agentName = c.agentName || "Unknown Agent";
        const txn = String(c.transactionType || "PURCHASE").toUpperCase();
        const addressLabel = addrToLabel(c.address);

        const filesIncomingRaw = Array.isArray(c.files) ? c.files : [];
        const filesIncoming = filesIncomingRaw.map((f) => normalizeFile(f, txn));

        if (!byAgent[agentId]) {
          byAgent[agentId] = {
            agentId,
            agentName,
            items: []
          };
        }

        const label = `${addressLabel || "Property"} - ${txnLabel(txn)}`;

        let group = byAgent[agentId].items.find(
          (x) => x.label === label && x.type === txn
        );

        if (!group) {
          const stage = txn === "PURCHASE" ? (c.stage || "UPLOADED") : null;

          group = {
            type: txn, // "PURCHASE" | "RENTAL"
            label,
            stage,
            stageLabel: stage ? (STAGE_LABELS[stage] || stage) : null,
            attention: stage ? getAttentionReason(stage) : null,
            lastModified: c.updatedAt || c.createdAt || new Date().toISOString(),
            files: [],
          };

          byAgent[agentId].items.push(group);
        }

        group.files = mergeFilesByKey(group.files, filesIncoming);

        // Backend is authoritative, but we only show stage for PURCHASE
        if (txn === "PURCHASE") {
          const stage = c.stage || group.stage || "UPLOADED";
          group.stage = stage;
          group.stageLabel = STAGE_LABELS[stage] || stage;
          group.attention = getAttentionReason(stage);
        } else {
          group.stage = null;
          group.stageLabel = null;
          group.attention = null;
        }

        group.lastModified = c.updatedAt || c.createdAt || group.lastModified;
      }

      Object.values(byAgent).forEach((agentBlock) => {
        agentBlock.items.sort(
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

  const fetchRetentionAlertsSent = async () => {
    try {
      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/retention-alerts-sent`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Retention alerts fetch failed", {
          status: res.status,
          body: text,
        });

        // Do NOT break dashboard
        setRetentionAlertsSent({});
        return;
      }

    const data = await res.json();
      setRetentionAlertsSent(data.sent || {});

    } catch (e) {
      console.error("Retention alert status fetch failed", e);
    }
  };


  const agentNames = useMemo(
    () =>
      Object.values(grouped)
        .map((a) => a.agentName)
        .sort(),
    [grouped]
  );

  const totalContracts = useMemo(
    () =>
      Object.values(grouped).reduce(
        (sum, a) => sum + (a.items?.length || 0),
        0
      ),
    [grouped]
  );

  const runBulkDryRun = async () => {
    try {
      setDryRunLoading(true);

      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();
      setDryRunResult(null);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/bulk-archive` +
          `?olderThanYears=${bulkYears}&retentionDays=${retentionDays}&dryRun=true`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      if (!res.ok) {
        throw new Error(`Dry-run failed: ${res.status}`);
      }

      const data = await res.json();
      setDryRunResult(data);
    } catch (err) {
      console.error("Dry-run error:", err);
      toast.error("Unable to preview affected contracts.");
    } finally {
      setDryRunLoading(false);
    }
  };

 
  
  const executeBulkDelete = async () => {
    if (bulkConfirmText !== "DELETE") return;

    try {
      setBulkInProgress(true);

      const session = await Auth.currentSession();
      const idToken = session.getIdToken().getJwtToken();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/bulk-archive?retentionDays=${retentionDays}&olderThanYears=${bulkYears}`,
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
      await fetchRetentionAlertsSent();
      const ts = Date.now();

      toast.success(
        (t) => (
          <span>
            <strong>Bulk cleanup completed.</strong>{" "}
            <button
              onClick={() => {
                toast.dismiss(t.id);
                window.location.href = `/admin/audit-log?from=bulk-archive&ts=${ts}`;
              }}
              className="underline ml-1"
            >
              View audit log
            </button>
          </span>
        ),
        { duration: 8000 }
      );

    } catch (err) {
      console.error("Bulk delete error:", err);
      setError("Bulk delete failed. Please try again.");
      toast.error("Bulk delete failed. Please try again.");
    } finally {
      closeBulkModal();
    }
  };

  const countOldContracts = (years) => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);

    return Object.values(grouped).reduce((count, agent) => {
      return (
        count +
        (agent.items || []).filter(
          (item) => new Date(item.lastModified) < cutoff
        ).length
      );
    }, 0);
  };
  
  const bulkDeleteCount = useMemo(
    () => countOldContracts(bulkYears),
    [grouped, bulkYears]
  );


  // =========================
// CLOSINGS SOON (ADMIN TILE)
// =========================
const closingsSoon = useMemo(() => {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + CLOSING_SOON_DAYS);

  const results = [];

  Object.values(grouped).forEach(({ agentId, agentName, items }) => {
    (items || []).forEach((item) => {
      if (item.type !== "PURCHASE") return;
      if (item.stage === "CLOSED") return;

      const closingDate = getClosingDate(item);
      if (!closingDate) return;

      if (closingDate >= now && closingDate <= cutoff) {
        results.push({
          agent: agentName,
          label: item.label,
          closingDate,
          stage: item.stage,
        });
      }
    });
  });

    return results.sort((a, b) => a.closingDate - b.closingDate);
  }, [grouped]);

  /**
   * Flat list used for summary + date windows.
   * Stage/EMD only for PURCHASE (backend contract meta should set rentals stage=null).
   */
  const flatFiles = useMemo(() => {
    const arr = [];

    Object.values(grouped).forEach(({ agentId, agentName, items }) => {
      (items || []).forEach((item) => {
        const isRental = item.type === "RENTAL";

        (item.files || []).forEach((f) => {
          arr.push({
            agent: agentName,
            agentId,

            // 👇 ADD PROPERTY CONTEXT
            address: item.address,

            file: {
              ...f,
              stage: isRental ? null : item.stage,
              stageLabel: isRental ? null : item.stageLabel,
              attention: isRental ? null : item.attention,
              lastModified: item.lastModified,
              transactionType: item.type,

              // 👇 ENSURE URL EXISTS
              presignedUrl: f.downloadUrl || f.url,
            },
          });
        });
      });
    });

    return arr;
  }, [grouped]);

  const buildContractFilename = (activity) => {
    const addr = activity.address;
    if (!addr) return "Contract.pdf";

    const street = [
      addr.streetNumber,
      addr.streetName,
    ].filter(Boolean).join(" ");

    const type =
      activity.transactionType === "RENTAL"
        ? "Rental"
        : activity.transactionType === "LEASE"
        ? "Lease"
        : "Contract";

    return `${street} ${type}.pdf`;
  };

  const recentActivity = useMemo(() => {
    const now = Date.now();

    const toRelativeTime = (date) => {
      const diffSec = Math.floor((now - date.getTime()) / 1000);
      if (diffSec < 60) return "just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    };

    const rows = flatFiles.map(({ agent, address, file }) => ({
      agent,

      // 👇 REQUIRED BY TILE
      address,
      presignedUrl: file.presignedUrl,

      filename: file.filename,
      transactionType: file.transactionType === "RENTAL" ? "Rental" : "Purchase",
      attention: file.attention,
      lastModified: file.lastModified,
      relativeTime: toRelativeTime(new Date(file.lastModified)),
    }));

    return rows
      .sort((a, b) => {
        // 🔴 Pin attention-required first
        if (a.attention && !b.attention) return -1;
        if (!a.attention && b.attention) return 1;

        // Then newest first
        return new Date(b.lastModified) - new Date(a.lastModified);
      })
      .slice(0, 20);
  }, [flatFiles]);


  const windowInfo = useMemo(() => {
    const { start, end, label } = getPresetDateRange(windowPreset);

    const chosen = flatFiles.filter(({ file }) => {
      const d = new Date(file.lastModified);
      return d >= start && d <= end;
    });

    const perAgent = {};
    const counts = {};

    chosen.forEach(({ agent, file }) => {
      if (!perAgent[agent]) perAgent[agent] = [];
      perAgent[agent].push(file);
      counts[agent] = (counts[agent] || 0) + 1;
    });

    const topAgents = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent, count]) => ({ agent, count }));

    return {
      label,
      total: chosen.length,
      perAgent,
      topAgents,
      start,
      end,
    };
  }, [flatFiles, windowPreset]);

  const uploadVelocity = useMemo(() => {
    const { start, end } = getPresetDateRange(windowPreset);
    const counts = {};

    flatFiles.forEach(({ agent, file }) => {
      const d = new Date(file.lastModified);
      if (d < start || d > end) return;

      counts[agent] = (counts[agent] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([agent, count]) => ({ agent, count }));
  }, [flatFiles, windowPreset]);



  const allContractsSorted = useMemo(() => {
    const rows = [];

    Object.values(grouped).forEach(({ agentId, agentName, items }) => {
      (items || []).forEach((item) => {
        rows.push({
          agent: agentName,
          contract: item, // property-level object
          lastModified: item.lastModified,
        });
      });
    });

    return rows.sort(
      (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
    );
  }, [grouped]);


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
    const q = search.trim().toLowerCase();
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;

    const result = {};

    Object.values(grouped).forEach(({ agentId, agentName, items }) => {
      let filteredItems = [...(items || [])];

      // 1️⃣ Text search (address + filenames)
      if (q) {
        filteredItems = filteredItems.filter((item) => {
          const labelText = (item.label || "").toLowerCase();
          const fileText = (item.files || [])
            .map((x) => x.filename || "")
            .join(" ")
            .toLowerCase();

          return labelText.includes(q) || fileText.includes(q);
        });
      }

      // 2️⃣ Date range filter
      if (start || end) {
        filteredItems = filteredItems.filter((item) => {
          const d = new Date(item.lastModified);
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        });
      }

      // 3️⃣ Agent dropdown filter (by NAME, as UI expects)
      if (selectedAgent && agentName !== selectedAgent) {
        filteredItems = [];
      }

      if (filteredItems.length) {
        result[agentId] = {
          agentId,
          agentName,
          items: filteredItems,
        };
      }
    });

    return result;
  };


  const filteredGrouped = useMemo(applyFilters, [grouped, selectedAgent, search, dateRange]);

  const filteredHasResults = useMemo(
    () =>
      Object.values(filteredGrouped).some(
        (block) => Array.isArray(block?.items) && block.items.length > 0
      ),
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

  const handleBackToDashboard = () => {
    setDashboardMode("normal");
    setFocusedAgent(null);
    setResultsSource(null);
    setSearch("");
    setSelectedAgent("");
    setDateRange({ start: "", end: "" });
    setFiltersOpen(false);
    setBulkTileOpen(false);
    setDryRunResult(null);
  };

  useEffect(() => {
    if (!user) return;

    // Do not auto-refresh during destructive operations
    if (showBulkModal || showDeleteModal) return;

    const interval = setInterval(async () => {
      try {
        await fetchContracts();
        await fetchRetentionAlertsSent();
      } catch (e) {
        console.warn("Auto-refresh failed", e);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [
    user,
    showBulkModal,
    showDeleteModal
  ]);


  const hasSummaryResults = resultsSource === "summary" && dashboardMode !== "normal";
  const hasFilterResults = resultsSource === "filters" && filteredHasResults;
  const showAnyResults = hasSummaryResults || hasFilterResults;
  const isFilterMode = hasFilterResults;
  const showBackLink =
                        hasSummaryResults ||
                        hasFilterResults ||
                        bulkTileOpen ||
                        resultsSource === "recentActivity";

  const focusedGrouped = useMemo(() => {
    if (!focusedAgent) return grouped;

    // grouped shape: { [agentId]: { agentId, agentName, items } }
    const entry = Object.entries(grouped).find(
      ([, v]) => v.agentName === focusedAgent
    );

    if (!entry) return {};

    const [agentId, agentBlock] = entry;
    return { [agentId]: agentBlock };
  }, [grouped, focusedAgent]);

  const dataForAgents =
  isFilterMode
    ? filteredGrouped
    : focusedAgent
    ? focusedGrouped
    : grouped;

  const resultsSection = showAnyResults ? (
    <div className="space-y-3 animate-fade-in">
      <AgentSection
        onNudgeAgent={async ({ agentEmail, contractLabel }) => {
          try {
            await sendNudgeEmail({ agentEmail, contractLabel });
            toast.success("Nudge email sent");
          } catch (e) {
            toast.error(e.message || "Failed to send nudge");
          }
        }}
        onAdminOverride={async ({ contractId, override }) => {
          try {
            await persistAdminOverride({ contractId, override });
            toast.success("Admin override saved");
          } catch (e) {
            toast.error(e.message || "Failed to save override");
          }
        }}
        
        mode={dashboardMode}
        grouped={dataForAgents}
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
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-3 sm:p-6">
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
          /* 🔽 NEW — required for dropdown */
          windowPreset={windowPreset}
          setWindowPreset={setWindowPreset}
          //closingSoonCount={closingsSoon.length}
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
            setDateRange({
              start: windowInfo.start.toISOString().slice(0, 10),
              end: windowInfo.end.toISOString().slice(0, 10),
            });
            setResultsSource("summary");
            setDashboardMode("agents");
            setFocusedAgent(null);
          }}
          onTopAgentClick={(agent) => {
            setSearch("");
            setSelectedAgent("");
            setDateRange({ start: "", end: "" });
            setResultsSource("summary");
            setDashboardMode("agents");
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

        <RecentActivityTile
          activity={recentActivity}
          onOpen={() => {
            setResultsSource("recentActivity");
            setDashboardMode("recentActivity");
            setFocusedAgent(null);
          }}
        />

        <UploadVelocityTile
          data={uploadVelocity}
          windowLabel={windowInfo.label}
        />

        <FiltersTile
          filtersOpen={filtersOpen}
          setFiltersOpen={setFiltersOpen}
          search={searchInput}
          setSearch={setSearchInput}
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

        <UpcomingExpirationsTile
          items={upcomingExpirations}
          alertsSent={retentionAlertsSent}
        />

        <BulkDeleteTile
          bulkTileOpen={bulkTileOpen}
          setBulkTileOpen={setBulkTileOpen}
          bulkYears={bulkYears}
          setBulkYears={setBulkYears}
          retentionDays={retentionDays}
          setRetentionDays={setRetentionDays}
          affectedCount={bulkDeleteCount}
          openBulkModal={openBulkModal}
          runBulkDryRun={runBulkDryRun}
          dryRunResult={dryRunResult}
          dryRunLoading={dryRunLoading}
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