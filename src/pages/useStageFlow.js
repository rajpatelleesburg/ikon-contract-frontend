"use client";

import { useState } from "react";
import { Auth } from "aws-amplify";

/**
 * useStageFlow (preserve yesterday behavior)
 *
 * Backend rules (observed):
 * - UPLOADED -> EMD_COLLECTED
 * - EMD_COLLECTED -> CONTINGENCIES
 * - CONTINGENCIES -> CLOSED (backend does NOT allow CONTINGENCIES -> CLOSING)
 *
 * UI-only:
 * - "CLOSING" is a modal step to collect ALTA + commission + title company,
 *   but backend stage remains CONTINGENCIES until you click "Closed".
 */
export default function useStageFlow({ fetchContracts, getNextStage }) {
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stageForm, setStageForm] = useState({});
  const [modalStep, setModalStep] = useState(null); // UI-only

  const openStageModal = (contract) => {
    setSelected(contract);
    setStageForm(contract.stageData || {});
    setModalStep(contract.stage); // UPLOADED / EMD_COLLECTED / CONTINGENCIES
    setStageModalOpen(true);
  };

  const closeStageModal = () => {
    setStageModalOpen(false);
    setSelected(null);
    setStageForm({});
    setModalStep(null);
  };

  const saveStage = async ({ advance = false } = {}) => {
    if (!selected) return;

    try {
      const session = await Auth.currentSession();
      const token = session.getAccessToken().getJwtToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // =========================
      // Decide effective backend stage
      // =========================
      let effectiveStage = selected.stage;

      if (!advance) {
        // Save metadata only, keep stage unchanged
        effectiveStage = selected.stage;
      } else {
        // Advance stage (backend-safe)
        if (selected.stage === "UPLOADED") {
          effectiveStage = "EMD_COLLECTED";
        } else if (selected.stage === "EMD_COLLECTED") {
          effectiveStage = "CONTINGENCIES";
        } else if (selected.stage === "CONTINGENCIES") {
          // This "advance" happens ONLY from CLOSING modal step -> user clicked "Closed"
          effectiveStage = "CLOSED";
        } else {
          effectiveStage = getNextStage(selected.stage);
        }
      }

      // =========================
      // VALIDATION + UPLOADS (match yesterday)
      // Only when CONTINGENCIES -> CLOSED
      // =========================
      if (selected.stage === "CONTINGENCIES" && advance) {
        if (!stageForm.titleCompany?.trim()) {
          alert("Title Company Name is required.");
          return;
        }
        if (!stageForm.commissionAmount) {
          alert("Commission Amount is required.");
          return;
        }
        if (!(stageForm.altaFile instanceof File)) {
          alert("ALTA / Settlement Statement (PDF) is required.");
          return;
        }

        // Upload ALTA
        const idPayload = session.getIdToken().payload;
        const agentFolder =
          idPayload.given_name && idPayload.family_name
            ? `${idPayload.given_name}-${idPayload.family_name}`.replace(/\s+/g, "-")
            : idPayload.email.split("@")[0];

        const presignRes = await fetch(`${apiUrl}/presign`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: "ALTA.pdf",
            contentType: stageForm.altaFile.type,
            fileSize: stageForm.altaFile.size,
            agentName: agentFolder,
            address: selected.address,
            transactionType: "PURCHASE",
            fileRole: "ALTA",
          }),
        });

        const presignData = await presignRes.json().catch(() => null);
        if (!presignRes.ok || !presignData?.url) {
          throw new Error(presignData?.message || "Presign failed");
        }

        const putRes = await fetch(presignData.url, {
          method: "PUT",
          headers: { "Content-Type": stageForm.altaFile.type },
          body: stageForm.altaFile,
        });

        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

        // Store s3Key into stageData like yesterday intent
        stageForm.altaFile = { s3Key: presignData.key };
      }

      // =========================
      // SAVE stage + stageData (same endpoint as yesterday)
      // =========================
      const res = await fetch(`${apiUrl}/contract/stage`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId: selected.contractId,
          stage: effectiveStage,
          stageData: stageForm || {},
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Request failed (${res.status})`);
      }

      await fetchContracts();
      closeStageModal();
    } catch (err) {
      console.error(err);
      alert("Unable to update stage.");
    }
  };

  return {
    stageModalOpen,
    selected,
    stageForm,
    setStageForm,
    modalStep,
    setModalStep,
    openStageModal,
    closeStageModal,
    saveStage,
  };
}