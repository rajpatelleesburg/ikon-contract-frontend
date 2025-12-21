"use client";

import { useState, useMemo, useEffect } from "react";

const PAYMENT_METHODS = [
  "Cashier Check",
  "Zelle",
  "Venmo",
  "Wire",
];

// Helpers for date limits
const todayISO = () => new Date().toISOString().split("T")[0];
const pastLimitISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
};

export default function RentalCommissionForm({
  hasTenantBroker = false,
  onChange,
}) {
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState("Zelle");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [percent, setPercent] = useState(25);
  const [notes, setNotes] = useState("");

  const parsedTotal = Number(total) || 0;

  // If no tenant broker, force percent to 0
  useEffect(() => {
    if (!hasTenantBroker) {
      // No tenant broker → force 0%
      setPercent(0);
    } else {
      // Tenant broker selected → restore default ONLY if it was 0
      setPercent((prev) => (prev === 0 ? 25 : prev));
    }
  }, [hasTenantBroker]);


  const tenantAmount = useMemo(() => {
    if (!hasTenantBroker) return 0;
    return Math.round((parsedTotal * percent) / 100 * 100) / 100;
  }, [parsedTotal, percent, hasTenantBroker]);

  const officeAmount = useMemo(() => {
    return Math.round((parsedTotal - tenantAmount) * 100) / 100;
  }, [parsedTotal, tenantAmount]);

  // Bubble up structured payload
  useEffect(() => {
    onChange?.({
      totalReceived: parsedTotal,
      paymentMethod: method,
      paymentDate,                 // ✅ NEW
      hasTenantBroker,
      tenantAgentPercent: hasTenantBroker ? percent : 0,
      tenantAgentAmount: tenantAmount,
      officeAmount,
      specialInstructions: notes?.trim() || null,
    });
  }, [
    parsedTotal,
    method,
    paymentDate,
    percent,
    notes,
    hasTenantBroker,
    tenantAmount,
    officeAmount,
    onChange,
  ]);

  return (
    <div className="mt-4 border rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="text-sm font-semibold text-slate-800">
        Commission Disbursement Instructions
      </div>

      {/* Total Commission */}
      <div>
        <label className="text-xs text-slate-600">
          Total Rental Commission Received
        </label>
        <input
          type="number"
          min="0"
          className="w-full border rounded px-3 py-2 text-sm"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="e.g. 2500"
        />
      </div>

      {/* Mode of Payment */}
      <div>
        <label className="text-xs text-slate-600">Mode of Payment</label>
        <select
          className="w-full border rounded px-3 py-2 text-sm"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Date of Payment */}
      <div>
        <label className="text-xs text-slate-600">
          Date Payment Was Received
        </label>
        <input
          type="date"
          className="w-full border rounded px-3 py-2 text-sm"
          value={paymentDate}
          min={pastLimitISO()}   // ⏪ max 30 days back
          max={todayISO()}      // 🚫 no future dates
          onChange={(e) => setPaymentDate(e.target.value)}
        />
        <div className="text-xs text-slate-500 mt-1">
          Must be within the last 30 days. Future dates not allowed.
        </div>
      </div>

      {/* Tenant Agent Commission (ONLY if broker involved) */}
      {hasTenantBroker && (
        <div>
          <label className="text-xs text-slate-600">
            Tenant Agent Commission (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            className="w-full border rounded px-3 py-2 text-sm"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
          <div className="text-xs text-slate-500 mt-1">
            Default is 25%. Adjust if needed.
          </div>
        </div>
      )}

      {/* Breakdown */}
      {parsedTotal > 0 && (
        <div className="text-xs text-slate-700 bg-white border rounded p-2">
          {hasTenantBroker && (
            <div>Tenant Agent: ${tenantAmount}</div>
          )}
          <div>Office: ${officeAmount}</div>
        </div>
      )}

      {/* Special Instructions */}
      <div>
        <label className="text-xs text-slate-600">
          Special Instructions (optional)
        </label>
        <textarea
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="e.g. Hold check until lease executed, Zelle to office, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}