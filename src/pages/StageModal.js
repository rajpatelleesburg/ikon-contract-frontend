"use client";

const STAGE_ORDER = ["UPLOADED", "EMD_COLLECTED", "CONTINGENCIES", "CLOSING", "CLOSED"];

const EMD_LINKS = {
  IKON_REALTY: [
    { label: "Ikon Realty Earnnest", url: "https://payments.earnnest.com/ikonrealtyashburn/send/304" },
  ],
  LOUDOUN_TITLE_VA: [
    { label: "Loudoun Title VA Escrow", url: "https://payments.earnnest.com/loudountitle/send/409" },
  ],
  LOUDOUN_TITLE_MD: [
    { label: "Loudoun Title MD Escrow", url: "https://payments.earnnest.com/loudountitle/send/102999" },
  ],
};

const CONTINGENCY_TYPES = [
  { value: "HOME_INSPECTION", label: "Home Inspection" },
  { value: "FINANCE", label: "Finance" },
  { value: "APPRAISAL", label: "Appraisal" },
  { value: "OTHER", label: "Other" },
];

const getPropertyStateSafe = (address) => address?.state || null;

const daysFromTodayISO = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

const monthsFromTodayISO = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
};

export default function StageModal({
  open,
  selected,
  stageForm,
  setStageForm,
  modalStep,
  setModalStep,
  onClose,
  onSave,
  stageLabels = {},
}) {
  if (!open || !selected) return null;

  // UI step:
  // - UPLOADED: Collect EMD UI
  // - EMD_COLLECTED: Proceed to Contingencies (no form)
  // - CONTINGENCIES: Contingencies form
  // - CLOSING: Closing form (UI-only, backend still CONTINGENCIES)
  const currentStep = modalStep || selected.stage;
  const state = getPropertyStateSafe(selected.address);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold">Update Stage — {stageLabels[currentStep]}</h3>

        {/* Progress bar */}
        <div className="flex gap-1 text-xs">
          {STAGE_ORDER.map((s, idx) => {
            const currentIdx = STAGE_ORDER.indexOf(currentStep);
            const done = idx <= currentIdx;
            return (
              <div
                key={s}
                className={`flex-1 text-center py-1 rounded ${
                  done ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {idx + 1}. {stageLabels[s] || s}
              </div>
            );
          })}
        </div>

        {/* =========================
            UPLOADED -> Collect EMD (RESTORED from yesterday)
           ========================= */}
        {currentStep === "UPLOADED" && (
          <div className="space-y-2">
            <select
              className="w-full border px-3 py-2 rounded"
              value={stageForm.holder || ""}
              onChange={(e) => setStageForm((p) => ({ ...p, holder: e.target.value }))}
            >
              <option value="">EMD Held By</option>
              <option value="IKON_REALTY">Ikon Realty</option>

              {state === "VA" && <option value="LOUDOUN_TITLE_VA">Loudoun Title VA Escrow</option>}
              {state === "MD" && <option value="LOUDOUN_TITLE_MD">Loudoun Title MD Escrow</option>}

              <option value="OTHER">Other</option>
            </select>

            {stageForm.holder === "OTHER" && (
              <input
                type="text"
                maxLength={60}
                placeholder="Enter EMD holder name"
                className="w-full border px-3 py-2 rounded"
                value={stageForm.otherHolder || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, otherHolder: e.target.value }))}
              />
            )}

            {(EMD_LINKS[stageForm.holder] || []).map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline block text-sm"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        {/* =========================
            EMD_COLLECTED -> guidance only
           ========================= */}
        {currentStep === "EMD_COLLECTED" && (
          <div className="text-sm text-slate-600 border rounded p-3 bg-slate-50">
            <strong>EMD confirmed.</strong>
            <div className="mt-1">Proceed to <strong>Contingencies</strong> when ready.</div>
          </div>
        )}

        {/* =========================
            CONTINGENCIES (RESTORED from yesterday)
           ========================= */}
        {currentStep === "CONTINGENCIES" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Expected Closing Date</label>
              <input
                type="date"
                className="w-full border px-3 py-2 rounded text-sm"
                min={daysFromTodayISO(-45)}
                max={monthsFromTodayISO(12)}
                value={stageForm.closingDate || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, closingDate: e.target.value }))}
              />
            </div>

            {CONTINGENCY_TYPES.map((c) => {
              const list = stageForm.contingencies || [];
              const existing = list.find((x) => x.type === c.value);
              const isChecked = !!existing;

              return (
                <div key={c.value} className="border rounded p-3 space-y-2 bg-slate-50">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setStageForm((prev) => {
                          const curr = prev.contingencies || [];
                          if (e.target.checked) {
                            return {
                              ...prev,
                              contingencies: [
                                ...curr,
                                { type: c.value, expiresAt: null, notes: "", createdAt: new Date().toISOString() },
                              ],
                            };
                          }
                          return { ...prev, contingencies: curr.filter((x) => x.type !== c.value) };
                        })
                      }
                    />
                    {c.label}
                  </label>

                  {isChecked && (
                    <div className="pl-6 space-y-2">
                      <input
                        type="date"
                        className="border px-3 py-1 rounded text-sm w-full"
                        min={daysFromTodayISO(-45)}
                        max={monthsFromTodayISO(12)}
                        value={existing.expiresAt || ""}
                        onChange={(e) =>
                          setStageForm((prev) => ({
                            ...prev,
                            contingencies: prev.contingencies.map((x) =>
                              x.type === c.value ? { ...x, expiresAt: e.target.value } : x
                            ),
                          }))
                        }
                      />

                      {c.value === "OTHER" && (
                        <textarea
                          rows={2}
                          placeholder="Optional notes"
                          className="border px-3 py-2 rounded text-sm w-full"
                          value={existing.notes || ""}
                          onChange={(e) =>
                            setStageForm((prev) => ({
                              ...prev,
                              contingencies: prev.contingencies.map((x) =>
                                x.type === c.value ? { ...x, notes: e.target.value } : x
                              ),
                            }))
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Guidance (restored intent) */}
            <div className="text-sm space-y-1 text-slate-600 border-t pt-3">
              <div><strong>Save</strong> — Contingencies remain editable</div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-xs">
                  ✓
                </span>
                <span><strong>Closing</strong> — Contingencies done</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================
            CLOSING (RESTORED + REQUIRED ASTERISKS)
            Note: this is UI-only step; backend stage changes to CLOSED on submit
           ========================= */}
        {currentStep === "CLOSING" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Title Company Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                className="w-full border px-3 py-2 rounded"
                value={stageForm.titleCompany || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, titleCompany: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Commission Amount <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                className="w-full border px-3 py-2 rounded"
                value={stageForm.commissionAmount || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, commissionAmount: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Admin Fee <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="number"
                className="w-full border px-3 py-2 rounded"
                value={stageForm.adminFee || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, adminFee: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Upload ALTA / Settlement Statement (PDF) <span className="text-red-600">*</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                className="w-full border px-3 py-2 rounded text-sm"
                onChange={(e) => setStageForm((p) => ({ ...p, altaFile: e.target.files?.[0] || null }))}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium">
                Commission Instructions (for Admin) <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={4}
                className="w-full border px-3 py-2 rounded text-sm"
                value={stageForm.commissionNote || ""}
                onChange={(e) => setStageForm((p) => ({ ...p, commissionNote: e.target.value }))}
              />
            </div>

            <div className="text-xs text-slate-500 pt-1">
              <span className="text-red-600">*</span> Required to mark contract as <strong>Closed</strong>
            </div>
          </div>
        )}

        {/* =========================
            ACTIONS (matches yesterday behavior)
           ========================= */}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancel
          </button>

          {/* UPLOADED: Save advances to EMD_COLLECTED */}
          {currentStep === "UPLOADED" && (
            <button onClick={() => onSave({ advance: true })} className="px-4 py-2 border rounded">
              Save
            </button>
          )}

          {/* EMD_COLLECTED: button to go to contingencies (advance stage) */}
          {currentStep === "EMD_COLLECTED" && (
            <button onClick={() => onSave({ advance: true })} className="px-4 py-2 bg-blue-600 text-white rounded">
              Contingencies
            </button>
          )}

          {/* CONTINGENCIES: Save (no advance) + Closing (UI only) */}
          {currentStep === "CONTINGENCIES" && (
            <>
              <button onClick={() => onSave({ advance: false })} className="px-4 py-2 border rounded">
                Save
              </button>
              <button onClick={() => setModalStep("CLOSING")} className="px-4 py-2 bg-blue-600 text-white rounded">
                Closing
              </button>
            </>
          )}

          {/* CLOSING: Back + Closed (advance=true triggers validation + ALTA upload + CLOSED stage) */}
          {currentStep === "CLOSING" && (
            <>
              <button onClick={() => setModalStep("CONTINGENCIES")} className="px-4 py-2 border rounded">
                Back
              </button>
              <button onClick={() => onSave({ advance: true })} className="px-4 py-2 bg-blue-600 text-white rounded">
                Closed
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}