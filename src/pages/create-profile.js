// src/pages/create-profile.js
"use client";

import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";
import { useRouter } from "next/router";
import toast from "react-hot-toast";

const normalizePhone = (raw) => {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `+1${ten}` : "";
};

export default function CreateProfilePage({ user, signOut }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    given_name: "",
    family_name: "",
    phone_number: "",
    email: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const u = await Auth.currentAuthenticatedUser();
        const a = u?.attributes || {};

        if (!alive) return;

        setForm({
          given_name: a.given_name || "",
          family_name: a.family_name || "",
          phone_number: a.phone_number || "",
          email: a.email || "",
        });
      } catch (e) {
        console.error(e);
        toast.error("Please sign in again.");
        router.replace("/");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const given_name = (form.given_name || "").trim();
    const family_name = (form.family_name || "").trim();
    const phone_number = normalizePhone(form.phone_number || "");

    if (!given_name) return toast.error("First name is required");
    if (!family_name) return toast.error("Last name is required");
    if (!phone_number) return toast.error("Enter a valid phone number");

    setSaving(true);
    try {
      const u = await Auth.currentAuthenticatedUser();

      await Auth.updateUserAttributes(u, {
        given_name,
        family_name,
        phone_number,
      });

      toast.success("Profile saved");
      router.replace("/dashboard");
    } catch (e) {
      console.error(e);
      toast.error("Unable to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl p-8 rounded-xl w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 text-center">
          Complete Your Profile
        </h1>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Email (locked)</label>
            <input
              className="w-full border rounded px-3 py-2 bg-slate-100"
              value={form.email}
              disabled
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">First Name</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.given_name}
              onChange={(e) => update("given_name", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Last Name</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.family_name}
              onChange={(e) => update("family_name", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Phone Number</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="(703) 555-1212"
              value={form.phone_number}
              onChange={(e) => update("phone_number", e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              We’ll store it as +1XXXXXXXXXX
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save & Continue"}
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => router.replace("/dashboard")}
            className="w-1/2 border rounded-lg py-2"
          >
            Skip for now
          </button>
          <button
            onClick={signOut}
            className="w-1/2 bg-slate-800 text-white rounded-lg py-2"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}