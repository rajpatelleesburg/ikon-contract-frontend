"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { STAGES, stageTone } from "../../../components/contractStages";

const pretty = (k) => STAGES.find((s) => s.key === k)?.label || k;

const sanitizeId = (rawId) => {
  if (!rawId) return null;
  const str = String(Array.isArray(rawId) ? rawId[0] : rawId);
  return /^[A-Za-z0-9_-]+$/.test(str) ? str : null;
};

export default function AdminContract() {
  const router = useRouter();
  const { id } = router.query;
  const safeId = sanitizeId(id);

  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    totalCommissionReceived: "",
    adminFeeCollected: "",
    titleCompanyName: "",
    specialNotes: "",
  });

  /** -----------------------------
   * Derived values (NO HOOK NEEDED)
   * ----------------------------- */
  const addr =
    c && c.property
      ? `${c.property.streetNumber || ""} ${c.property.streetName || ""}`.trim()
      : "";

  /** -----------------------------
   * Data fetch
   * ----------------------------- */
  const refresh = async () => {
    if (!safeId) return;
    setLoading(true);
    try {
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${safeId}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");

      setC(data);
      setForm({
        totalCommissionReceived: data?.commission?.totalCommissionReceived ?? "",
        adminFeeCollected: data?.commission?.adminFeeCollected ?? "",
        titleCompanyName: data?.commission?.titleCompanyName ?? "",
        specialNotes: data?.commission?.specialNotes ?? "",
      });
    } catch (e) {
      console.error(e);
      toast.error("Load failed");
    } finally {
      setLoading(false);
    }
  };

  /** -----------------------------
   * Effects (SAFE)
   * ----------------------------- */
  useEffect(() => {
    if (!safeId) {
      toast.error("Invalid contract ID");
      return;
    }
    refresh();
  }, [safeId]);

  /** -----------------------------
   * Actions
   * ----------------------------- */
  const updateStage = async (stage) => {
    try {
      if (!safeId) return;
      setSaving(true);

      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${safeId}/stage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stage }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setC(data);
      toast.success("Stage updated");
    } catch (e) {
      console.error(e);
      toast.error("Stage update failed");
    } finally {
      setSaving(false);
    }
  };

  const submitCommission = async () => {
    try {
      if (!safeId) return;

      if (!["CLOSED", "COMM_DISBURSED"].includes(c?.stage)) {
        toast.error("Commission packet can be submitted after Closed.");
        return;
      }

      setSaving(true);
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${safeId}/commission`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            totalCommissionReceived: Number(form.totalCommissionReceived || 0),
            adminFeeCollected: Number(form.adminFeeCollected || 0),
            titleCompanyName: form.titleCompanyName,
            specialNotes: form.specialNotes,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setC(data);
      toast.success("Commission submitted");
    } catch (e) {
      console.error(e);
      toast.error("Commission submit failed");
    } finally {
      setSaving(false);
    }
  };

  /** -----------------------------
   * Render guards (AFTER hooks)
   * ----------------------------- */
  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-6">Loading...</div>;
  }

  if (!c) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <Button onClick={() => router.push("/admin")}>Back</Button>
      </div>
    );
  }

  const tone = stageTone(c.stage || "UPLOADED");

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{addr}</h1>
              <Badge tone={tone}>{pretty(c.stage || "UPLOADED")}</Badge>
            </div>
            <div className="text-sm text-slate-600">
              {c.agentName || "Agent"} • {c.property?.state || ""}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => router.push("/admin")}>Back</Button>
            <Button onClick={refresh}>Refresh</Button>
          </div>
        </div>

        {/* rest of your JSX unchanged */}
      </div>
    </div>
  );
}