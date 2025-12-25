"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { STAGES, stageTone } from "../../components/contractStages";

const pretty = (k) => (STAGES.find(s => s.key === k)?.label || k);

export default function ContractDetail() {
  const router = useRouter();
  const { id } = router.query;
  const safeId = typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;

  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const stageToneVal = stageTone(c?.stage || "UPLOADED");

  const refresh = async () => {
    if (!safeId) return;
    setLoading(true);
    try {
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${safeId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load");
      setC(data);
    } catch (e) {
      console.error(e);
      toast.error("Could not load contract");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [safeId]);

  const addr = useMemo(() => {
    if (!c?.property) return "";
    if (!safeId) {
      toast.error("Invalid contract id");
      return;
    }
    return `${c.property.streetNumber || ""} ${c.property.streetName || ""}`.trim();
  }, [c]);

  const setStage = async (stage) => {
    try {
      setSaving(true);
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contracts/${safeId}/stage`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update stage");
      setC(data);
      toast.success("Updated");
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-6 text-slate-700">Loading...</div>;
  }

  if (!c) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <Button onClick={() => router.push("/dashboard")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{addr}</h1>
              <Badge tone={stageToneVal}>{pretty(c.stage || "UPLOADED")}</Badge>
            </div>
            <div className="text-sm text-slate-600">{c.property?.city || ""}, {c.property?.state || ""} {c.property?.zip || ""}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/dashboard")} className="bg-slate-200 text-slate-900 hover:bg-slate-300">Back</Button>
            <Button onClick={refresh} className="bg-slate-200 text-slate-900 hover:bg-slate-300">Refresh</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <div className="font-semibold text-slate-900">Contract file</div>
            <div className="mt-2 text-sm text-slate-700 break-all">{c.file?.s3Key || "—"}</div>
            {c.file?.downloadUrl && (
              <a className="mt-3 inline-block text-sm font-medium text-slate-900 underline" href={c.file.downloadUrl} target="_blank">
                Download (presigned)
              </a>
            )}
          </Card>

          <Card className="p-5">
            <div className="font-semibold text-slate-900">Milestones</div>
            <div className="mt-3 grid gap-2">
              {STAGES.filter(s => s.key !== "COMM_DISBURSED").map((s) => (
                <button
                  key={s.key}
                  disabled={saving}
                  onClick={() => setStage(s.key)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                    (c.stage === s.key) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className={`text-xs ${c.stage === s.key ? "text-slate-200" : "text-slate-500"}`}>
                    Tap to set current stage (Admin sees same status)
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-900">Commission (Admin completes after Closed)</div>
            <Badge tone={c.commission?.disbursementSubmitted ? "green" : "slate"}>
              {c.commission?.disbursementSubmitted ? "Submitted" : "Not Submitted"}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Total Comm Receive</div>
              <div className="text-lg font-semibold text-slate-900">{c.commission?.totalCommissionReceived ?? "—"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Admin fee collected</div>
              <div className="text-lg font-semibold text-slate-900">{c.commission?.adminFeeCollected ?? "—"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Title Company Name</div>
              <div className="text-lg font-semibold text-slate-900">{c.commission?.titleCompanyName ?? "—"}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Signed ALTA</div>
              <div className="text-lg font-semibold text-slate-900">{c.commission?.altaSignedUploaded ? "Uploaded" : "—"}</div>
            </div>
            <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Special Notes</div>
              <div className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{c.commission?.specialNotes ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Agents can view commission details, but Admin submits the disbursement packet.
          </div>
        </Card>
      </div>
    </div>
  );
}
