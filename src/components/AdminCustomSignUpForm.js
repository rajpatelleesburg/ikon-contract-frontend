"use client";

import { useState } from "react";
import allowedAdminPhones from "../lib/allowedAdminPhones.json";
import allowedAdminEmails from "../lib/allowedAdminEmails.json";

export default function AdminCustomSignUpForm() {
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    given_name: "",
    family_name: "",
    admin_phone: "",   // ⭐ renamed from phone_number to avoid Amplify validation
    email: "",
    password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState({});
  const [emailAllowed, setEmailAllowed] = useState(true);

  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const formatPhone = (raw) => {
    if (!raw) return "";
    let d = raw.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    return d.length === 10 ? `+1${d}` : "";
  };

  const validateStep1 = () => {
    const e = {};

    if (!form.given_name.trim()) e.given_name = "First name required";
    if (!form.family_name.trim()) e.family_name = "Last name required";

    const formatted = formatPhone(form.admin_phone);
    if (!formatted) e.admin_phone = "Invalid US phone number";
    else if (!allowedAdminPhones.includes(formatted))
      e.admin_phone = "Phone not authorized for admin";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    const emailLower = form.email.toLowerCase();

    if (!emailLower.includes("@")) e.email = "Valid email required";
    if (!allowedAdminEmails.includes(emailLower))
      e.email = "Email not authorized for admin";

    if (!form.password || form.password.length < 12)
      e.password = "Password must be at least 12 characters";

    if (form.password !== form.confirm_password)
      e.confirm_password = "Passwords must match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ⭐ Make available to AdminAuthWrapper
  globalThis.__adminForm = form;

  return (
    <div className="floating-wrapper space-y-5">
      
      {/* Progress Bar */}
      <div className="w-full bg-slate-200 h-2 rounded">
        <div className="h-full bg-blue-600 rounded transition-all"
          style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} />
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          {/* First Name */}
          <div>
            <div className="floating-group">
              <input className="floating-input" placeholder=" "
                value={form.given_name}
                onChange={(e) => update("given_name", e.target.value)} />
              <label className="floating-label">First Name</label>
            </div>
            {errors.given_name && <p className="text-xs text-red-600">{errors.given_name}</p>}
          </div>

          {/* Last Name */}
          <div>
            <div className="floating-group">
              <input className="floating-input" placeholder=" "
                value={form.family_name}
                onChange={(e) => update("family_name", e.target.value)} />
              <label className="floating-label">Last Name</label>
            </div>
            {errors.family_name && <p className="text-xs text-red-600">{errors.family_name}</p>}
          </div>

          {/* Admin Phone */}
          <div>
            <div className="floating-group">
              <input className="floating-input" placeholder=" "
                value={form.admin_phone}
                onChange={(e) => update("admin_phone", e.target.value)} />
              <label className="floating-label">Phone Number</label>
            </div>
            {errors.admin_phone && <p className="text-xs text-red-600">{errors.admin_phone}</p>}
          </div>

          <button onClick={() => validateStep1() && setStep(2)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
            Continue →
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Admin Account Details</h2>

          {/* Email */}
          <div>
            <div className="floating-group">
              <input type="email" className="floating-input" placeholder=" "
                value={form.email}
                onChange={(e) => {
                  const email = e.target.value.toLowerCase();
                  update("email", email);
                  setEmailAllowed(allowedAdminEmails.includes(email));
                }} />
              <label className="floating-label">Admin Email</label>
            </div>
            {!emailAllowed && form.email &&
              <p className="text-xs text-red-600">Email not authorized</p>}
          </div>

          {/* Password */}
          {emailAllowed && (
            <>
              <div>
                <div className="floating-group">
                  <input type="password" className="floating-input" placeholder=" "
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)} />
                  <label className="floating-label">Password</label>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <div className="floating-group">
                  <input type="password" className="floating-input" placeholder=" "
                    value={form.confirm_password}
                    onChange={(e) => update("confirm_password", e.target.value)} />
                  <label className="floating-label">Confirm Password</label>
                </div>
                {errors.confirm_password &&
                  <p className="text-xs text-red-600">{errors.confirm_password}</p>}
              </div>
            </>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)}
              className="text-sm text-slate-600 hover:underline">← Back</button>

            <button
              disabled={!emailAllowed}
              onClick={() => validateStep2() && setStep(3)}
              className={`px-6 py-2 rounded-lg text-sm text-white ${
                emailAllowed ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400"
              }`}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4 text-center animate-fade-in">
          <h2 className="text-lg font-semibold">Review Admin Details</h2>

          <ul className="text-left text-sm mx-auto max-w-xs space-y-1">
            <li><strong>Name:</strong> {form.given_name} {form.family_name}</li>
            <li><strong>Phone:</strong> {formatPhone(form.admin_phone)}</li>
            <li><strong>Email:</strong> {form.email}</li>
          </ul>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)}
              className="text-sm text-slate-600 hover:underline">← Back</button>

            <button type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg">Create Admin Account ✓</button>
          </div>
        </div>
      )}

      {/* Hidden fields for Amplify (NO phone_number) */}
      <input type="hidden" name="given_name" value={form.given_name} />
      <input type="hidden" name="family_name" value={form.family_name} />
      <input type="hidden" name="email" value={form.email} />
      <input type="hidden" name="password" value={form.password} />
      <input type="hidden" name="confirm_password" value={form.confirm_password} />
    </div>
  );
}