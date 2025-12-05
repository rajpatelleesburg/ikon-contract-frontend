// src/pages/dashboard.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Auth } from "aws-amplify";

export default function DashboardPage({ user, signOut }) {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState("latest");

  useEffect(() => {
    async function loadAttributes() {
      try {
        const cognitoUser = await Auth.currentAuthenticatedUser();
        setProfile(cognitoUser.attributes);
      } catch (err) {
        console.error("Error loading user attributes:", err);
      }
    }
    loadAttributes();
  }, []);

  const given = profile?.given_name || "";
  const family = profile?.family_name || "";
  const email = profile?.email || "";

  const fullName =
    given && family
      ? `${given} ${family}`
      : email
      ? email.split("@")[0]
      : "Agent";

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (!user) return;

    const fetchContracts = async () => {
      try {
        const idToken = user?.signInUserSession?.idToken?.jwtToken;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/contracts`,
          {
            headers: {
              Authorization: idToken,
            },
          }
        );

        const data = await res.json();
        console.log("CONTRACT RESPONSE:", data);
        setFiles(data.files || []);
      } catch (err) {
        console.error("Error fetching contracts:", err);
      }
    };

    fetchContracts();
  }, [user, profile]);

  const sorted = [...files].sort(
    (a, b) => new Date(b.lastModified) - new Date(a.lastModified)
  );

  const now = new Date();
  let filteredFiles = sorted;

  if (filter === "month") {
    filteredFiles = sorted.filter((f) => {
      const dt = new Date(f.lastModified);
      return (
        dt.getMonth() === now.getMonth() &&
        dt.getFullYear() === now.getFullYear()
      );
    });
  }

  if (filter === "3months") {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - 3);
    filteredFiles = sorted.filter(
      (f) => new Date(f.lastModified) >= limit
    );
  }

  if (filter === "6months") {
    const limit = new Date();
    limit.setMonth(limit.getMonth() - 6);
    filteredFiles = sorted.filter(
      (f) => new Date(f.lastModified) >= limit
    );
  }

  if (filter === "ytd") {
    filteredFiles = sorted.filter(
      (f) => new Date(f.lastModified).getFullYear() === now.getFullYear()
    );
  }

  // Note: no more "recentFive" or Recent Uploads section

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl p-10 rounded-xl w-full max-w-2xl space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">
            Welcome {fullName}
          </h1>
          <p className="text-slate-600">Today is {today}</p>
        </div>

        <button
          onClick={() => router.push("/upload")}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
        >
          Upload Contract
        </button>

        {/* Single source of truth: Browse section with filters */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">
            Browse Your Contracts
          </h2>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full border px-3 py-2 rounded mb-4"
          >
            <option value="latest">Latest (Default)</option>
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="ytd">Year to Date</option>
            <option value="all">All Files</option>
          </select>

          {filteredFiles.length === 0 ? (
            <p className="text-slate-500">
              No files found for this filter.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredFiles.map((f) => (
                <li
                  key={f.key}
                  className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border hover:bg-slate-100"
                >
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {f.key.split("/").pop()}
                  </a>
                  <span className="text-sm text-slate-500">
                    {new Date(
                      f.lastModified
                    ).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full bg-slate-800 text-white py-3 rounded-lg text-lg font-semibold hover:bg-slate-900 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}