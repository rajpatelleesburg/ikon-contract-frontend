"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { STAGES, stageTone } from "../../../components/contractStages";

const pretty = (k) => (STAGES.find(s => s.key === k)?.label || k);

export default function AdminContract() {
  const router = useRouter();
  const { id } = router.query;

  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    totalCommissionReceived: "",
    adminFeeCollected: "",
    titleCompanyName: "",
    specialNotes: "",
  });

  const refresh = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
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

  useEffect(() => { refresh(); }, [id]);

  const addr = useMemo(() => {
    if (!c?.property) return "";
    return `${c.property.streetNumber || ""} ${c.property.streetName || ""}`.trim();
  }, [c]);

  const updateStage = async (stage) => {
    try {
      setSaving(true);
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${id}/stage`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
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
      if ((c?.stage || "") !== "CLOSED" && (c?.stage || "") !== "COMM_DISBURSED") {
        toast.error("Commission packet can be submitted after Closed.");
        return;
      }
      setSaving(true);
      const user = await Auth.currentAuthenticatedUser();
      const idToken = user?.signInUserSession?.idToken?.jwtToken;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/contracts/${id}/commission`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          totalCommissionReceived: Number(form.totalCommissionReceived || 0),
          adminFeeCollected: Number(form.adminFeeCollected || 0),
          titleCompanyName: form.titleCompanyName,
          specialNotes: form.specialNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      setC(data);
      toast.success("Commission submitted");
    } catch (e) {
      console.error(e);
      toast.error("Commission submit failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-100 p-6">Loading...</div>;
  if (!c) return <div className="min-h-screen bg-slate-100 p-6"><Button onClick={() => router.push("/admin")}>Back</Button></div>;

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
            <div className="text-sm text-slate-600">{c.agentName || "Agent"} • {c.property?.state || ""}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/admin")} className="bg-slate-200 text-slate-900 hover:bg-slate-300">Back</Button>
            <Button onClick={refresh} className="bg-slate-200 text-slate-900 hover:bg-slate-300">Refresh</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <div className="font-semibold text-slate-900">Stage control</div>
            <div className="mt-3 grid gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.key}
                  disabled={saving}
                  onClick={() => updateStage(s.key)}
                  className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                    (c.stage === s.key) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className={`text-xs ${c.stage === s.key ? "text-slate-200" : "text-slate-500"}`}>
                    Updates agent + admin view together
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-semibold text-slate-900">Commission Disbursement</div>
            <p className="mt-1 text-sm text-slate-600">Submit after Closed. Requires ALTA upload (backend-enforced).</p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Total Comm Receive</label>
                <input value={form.totalCommissionReceived} onChange={(e)=>setForm({...form, totalCommissionReceived:e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. 12500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Admin fee collected</label>
                <input value={form.adminFeeCollected} onChange={(e)=>setForm({...form, adminFeeCollected:e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. 495"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Title Company Name</label>
                <input value={form.titleCompanyName} onChange={(e)=>setForm({...form, titleCompanyName:e.target.value})}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. Loudoun Title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Special Notes</label>
                <textarea value={form.specialNotes} onChange={(e)=>setForm({...form, specialNotes:e.target.value})}
                  className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Anything special for accounting / broker record..."
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Signed ALTA</div>
                  <div className="text-sm font-semibold text-slate-900">{c.commission?.altaSignedUploaded ? "Uploaded" : "Not uploaded"}</div>
                </div>
                <Button
                  onClick={() => (window.location.href = `/admin/contract/${c.contractId}/alta`)}
                  className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                >
                  Upload ALTA
                </Button>
              </div>

              <Button disabled={saving} onClick={submitCommission} className="w-full">
                Submit Disbursement Packet
              </Button>

              {c.commission?.disbursementSubmitted && (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  Disbursement submitted.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
