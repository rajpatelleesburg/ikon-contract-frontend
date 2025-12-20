// src/pages/index.js
"use client";

export default function Home() {
  return (
    <div className="text-center py-16 px-4">
      <h1 className="text-4xl font-bold mb-4">
        Welcome to the Ikon Contract Portal
      </h1>

      <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto">
        Upload, manage, and securely access your real estate contracts.
      </p>

      <a
        href="/dashboard"
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
      >
        Login / Create Account
      </a>
    </div>
  );
}