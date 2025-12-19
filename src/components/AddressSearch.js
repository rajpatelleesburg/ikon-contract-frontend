"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

const LICENSED = ["VA", "MD", "DC"];

const clean = (s) =>
  (s || "")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 .-]/g, "")
    .trim();

export default function AddressSearch({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  const canSearch = useMemo(
    () => q.trim().length >= 4 && !value,
    [q, value]
  );

  useEffect(() => {
    const run = async () => {
      if (!canSearch) {
        setResults([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/address/google?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (e) {
        console.error(e);
        toast.error("Address search failed");
        setResults([]);
      }
    };

    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [q, canSearch]);

  const pick = (r) => {
    if (!LICENSED.includes(r.state)) {
      toast.error("Only VA, MD, DC addresses are allowed.");
      return;
    }

    const streetNumber = String(r.streetNumber || "")
      .replace(/\D/g, "")
      .trim();
    const streetName = clean(r.streetName);

    if (!streetNumber || !streetName) {
      toast.error("We only store street number and street name.");
      return;
    }

    const selected = {
      streetNumber,
      streetName,
      state: r.state,
      city: r.city,
      zip: r.zip,
    };

    // ✅ Set selected value
    onChange(selected);

    // ✅ Lock input to selected address
    setQ(`${streetNumber} ${streetName}, ${r.state}`);

    // ✅ Clear suggestions immediately
    setResults([]);

    // ✅ Blur input for clean UX
    inputRef.current?.blur();
  };

  const clearSel = () => {
    onChange(null);
    setQ("");
    setResults([]);

    // Allow typing again
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        Property address (VA • MD • DC)
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: 123 Main St"
          disabled={!!value}
          className={`w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 ${
            value
              ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
              : "border-slate-200 focus:ring-slate-300"
          }`}
        />

        {value && (
          <button
            type="button"
            onClick={clearSel}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* 🔽 Suggestions dropdown */}
      {results.length > 0 && !value && (
        <div className="relative z-20 rounded border border-slate-200 bg-white overflow-hidden shadow-sm">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <div className="font-medium text-slate-800">
                {r.streetNumber} {r.streetName}
              </div>
              <div className="text-xs text-slate-500">
                {r.city}, {r.state} {r.zip}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ✅ Selected address summary */}
      {value && (
        <div className="rounded bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Stored format</div>
          <div className="text-sm font-semibold text-slate-800">
            {value.streetNumber} {value.streetName} ({value.state})
          </div>
        </div>
      )}
    </div>
  );
}