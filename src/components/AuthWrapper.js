// src/components/AuthWrapper.js
"use client";

import { useRouter } from "next/router";
import allowedAgents from "../lib/allowedAgents.json";
import allowedPhones from "../lib/allowedPhones.json";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Authenticator = dynamic(
  () => import("@aws-amplify/ui-react").then((m) => m.Authenticator),
  { ssr: false }
);

/* =====================================================================================
   CustomSignUpForm
====================================================================================== */
function CustomSignUpForm() {
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    given_name: "",
    family_name: "",
    phone_number: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState({});
  const [emailAllowed, setEmailAllowed] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const formatPhone = (raw) => {
    if (!raw) return "";
    let d = raw.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    if (d.length !== 10) return "";
    return `+1${d}`;
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.given_name.trim()) e.given_name = "First name required";
    if (!form.family_name.trim()) e.family_name = "Last name required";

    const formatted = formatPhone(form.phone_number);
    if (!formatted) e.phone_number = "Enter valid US/CA phone";
    else if (!allowedPhones.includes(formatted))
      e.phone_number = "Phone not in roster";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    const emailLower = form.email.toLowerCase();

    if (!emailLower.includes("@")) e.email = "Valid email required";
    if (!allowedAgents.includes(emailLower)) e.email = "Email not in roster";
    if (!form.password) e.password = "Password required";
    else if (form.password.length < 12)
      e.password = "Minimum 12 characters";

    if (form.password !== form.confirm_password)
      e.confirm_password = "Passwords must match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const computeStrength = (v) => {
    let s = 0;
    if (v.length >= 12) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    setPasswordStrength(s);
  };

  // ✅ Make form available to AuthWrapper (same pattern as admin)
  globalThis.__agentForm = form;

  /* RENDER */
  return (
    <div className="floating-wrapper space-y-5">
      {/* Progress bar */}
      <div className="w-full bg-slate-200 h-2 rounded">
        <div
          className="h-full bg-blue-600 rounded transition-all"
          style={{
            width: step === 1 ? "33%" : step === 2 ? "66%" : "100%",
          }}
        />
      </div>

      {/* ---------- STEP 1 ---------- */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Personal Info</h2>

          <div>
            <div className="floating-group">
              <input
                className="floating-input"
                placeholder=" "
                value={form.given_name}
                onChange={(e) => update("given_name", e.target.value)}
              />
              <label className="floating-label">First Name</label>
            </div>
            {errors.given_name && (
              <p className="text-xs text-red-600">{errors.given_name}</p>
            )}
          </div>

          <div>
            <div className="floating-group">
              <input
                className="floating-input"
                placeholder=" "
                value={form.family_name}
                onChange={(e) => update("family_name", e.target.value)}
              />
              <label className="floating-label">Last Name</label>
            </div>
            {errors.family_name && (
              <p className="text-xs text-red-600">{errors.family_name}</p>
            )}
          </div>

          <div>
            <div className="floating-group">
              <input
                className="floating-input"
                placeholder=" "
                value={form.phone_number}
                onChange={(e) => update("phone_number", e.target.value)}
              />
              <label className="floating-label">Phone Number</label>
            </div>
            {errors.phone_number && (
              <p className="text-xs text-red-600">{errors.phone_number}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => validateStep1() && setStep(2)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ---------- STEP 2 ---------- */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Account Details</h2>

          {/* Email */}
          <div>
            <div className="floating-group">
              <input
                className="floating-input"
                placeholder=" "
                type="email"
                value={form.email}
                onChange={(e) => {
                  const email = e.target.value.toLowerCase();
                  update("email", email);
                  setEmailAllowed(allowedAgents.includes(email));
                }}
              />
              <label className="floating-label">Email</label>
            </div>

            {!emailAllowed && form.email && (
              <p className="text-xs text-red-600">Email not in IKON roster</p>
            )}
            {emailAllowed && form.email && (
              <p className="text-xs text-green-600">Verified ✓</p>
            )}
          </div>

          {/* Password + Confirm */}
          {emailAllowed && (
            <>
              <div>
                <div className="floating-group relative">
                  <input
                    className="floating-input"
                    placeholder=" "
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => {
                      update("password", e.target.value);
                      computeStrength(e.target.value);
                    }}
                  />
                  <label className="floating-label">Password</label>
                  <span
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showPwd ? "🙈" : "👁️"}
                  </span>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <ul className="text-xs text-slate-600 space-y-1">
                <li
                  className={
                    form.password.length >= 12
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  • Minimum 12 characters
                </li>
                <li
                  className={
                    /[A-Z]/.test(form.password)
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  • One uppercase letter
                </li>
                <li
                  className={
                    /[0-9]/.test(form.password)
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  • One number
                </li>
                <li
                  className={
                    /[^A-Za-z0-9]/.test(form.password)
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  • One symbol
                </li>
              </ul>

              <div className="password-meter mb-1">
                <div
                  style={{
                    width: `${(passwordStrength / 4) * 100}%`,
                    background:
                      passwordStrength < 2
                        ? "red"
                        : passwordStrength < 3
                        ? "orange"
                        : "green",
                  }}
                />
              </div>

              <div>
                <div className="floating-group relative">
                  <input
                    className="floating-input"
                    placeholder=" "
                    type={showConfirmPwd ? "text" : "password"}
                    value={form.confirm_password}
                    onChange={(e) => update("confirm_password", e.target.value)}
                  />
                  <label className="floating-label">Confirm Password</label>
                  <span
                    onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showConfirmPwd ? "🙈" : "👁️"}
                  </span>
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-red-600">
                    {errors.confirm_password}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-sm text-slate-600 hover:underline"
              type="button"
            >
              ← Back
            </button>
            <button
              disabled={!emailAllowed}
              onClick={() => validateStep2() && setStep(3)}
              className={`px-6 py-2 rounded-lg text-sm text-white ${
                emailAllowed ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400"
              }`}
              type="button"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 3 ---------- */}
      {step === 3 && (
        <div className="space-y-4 text-center animate-fade-in">
          <h2 className="text-lg font-semibold">Review Details</h2>

          <ul className="text-left text-sm mx-auto max-w-xs space-y-1">
            <li>
              <strong>Name:</strong> {form.given_name} {form.family_name}
            </li>
            <li>
              <strong>Phone:</strong> {formatPhone(form.phone_number)}
            </li>
            <li>
              <strong>Email:</strong> {form.email}
            </li>
          </ul>

          <div className="flex justify-between">
            <button
              className="text-sm text-slate-600 hover:underline"
              onClick={() => setStep(2)}
              type="button"
            >
              ← Back
            </button>

            {/* IMPORTANT: this "submit" is what triggers Authenticator SignUp */}
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Create Account ✓
            </button>
          </div>
        </div>
      )}

      {/* Hidden fields (Amplify expects these names) */}
      <input type="hidden" name="given_name" value={form.given_name} />
      <input type="hidden" name="family_name" value={form.family_name} />
      <input type="hidden" name="email" value={form.email} />
      <input type="hidden" name="username" value={form.email} />
      <input type="hidden" name="password" value={form.password} />
      <input
        type="hidden"
        name="confirm_password"
        value={form.confirm_password}
      />
    </div>
  );
}

/* =====================================================================================
   AuthWrapper
===================================================================================== */

export default function AuthWrapper({ children }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg animate-fade-in">
          <Authenticator
            // ✅ Use your interactive signup UI
            components={{
              SignUp: {
                FormFields: (props) => <CustomSignUpForm {...props} />,
              },
            }}
            // ✅ Actually perform signup with your form data (same pattern as AdminAuthWrapper)
            services={{
              async handleSignUp() {
                const { Auth } = await import("aws-amplify");

                const form = globalThis.__agentForm || {};
                const email = (form.email || "").toLowerCase().trim();

                // normalize phone to +1XXXXXXXXXX
                const digits = (form.phone_number || "").replace(/\D/g, "");
                const ten =
                  digits.length === 11 && digits.startsWith("1")
                    ? digits.slice(1)
                    : digits;
                const phone = ten.length === 10 ? `+1${ten}` : "";

                // mark that this user should land on create-profile after signup
                try {
                  localStorage.setItem("ikon_post_signup", "1");
                } catch {}

                return Auth.signUp({
                  username: email,
                  password: form.password,
                  attributes: {
                    email,
                    given_name: form.given_name,
                    family_name: form.family_name,
                    ...(phone ? { phone_number: phone } : {}),
                  },
                  autoSignIn: { enabled: true },
                });
              },
            }}
          >
            {(context) => {
              const { user, signOut } = context;

              if (user) {
                // If we just signed up, go to create-profile first
                let postSignup = false;
                try {
                  postSignup = localStorage.getItem("ikon_post_signup") === "1";
                } catch {}

                if (postSignup) {
                  try {
                    localStorage.removeItem("ikon_post_signup");
                  } catch {}
                  if (router.pathname !== "/create-profile") {
                    router.replace("/create-profile");
                    return null;
                  }
                } else {
                  // normal login flow
                  if (router.pathname === "/" || router.pathname === "/index") {
                    router.replace("/dashboard");
                    return null;
                  }
                }
              }

              return children({ user, signOut });
            }}
          </Authenticator>
        </div>
      </div>
    </>
  );
}