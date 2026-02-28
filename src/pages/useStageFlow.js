"use client";

import { useState } from "react";
import { Auth } from "aws-amplify";
import toast from "react-hot-toast";

/**
 * useStageFlow (FINAL – SAFE, DROP-IN)
 *
 * Backend rules (unchanged):
 * - UPLOADED -> EMD_COLLECTED
 * - EMD_COLLECTED -> CONTINGENCIES
 * - CONTINGENCIES -> CLOSED
 *
 * UI-only:
 * - "CLOSING" is a modal step only
 */
export default function useStageFlow({ fetchContracts, getNextStage }) {
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stageForm, setStageForm] = useState({});
  const [modalStep, setModalStep] = useState(null); // UI-only

  const openStageModal = (contract) => {
    setSelected(contract);
    setStageForm(contract.stageData || {});
    setModalStep(contract.stage);
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

      let effectiveStage = selected.stage;
      let altaS3Key = null;

      // =========================
      // Decide effective backend stage (UNCHANGED)
      // =========================
      if (!advance) {
        effectiveStage = selected.stage;
      } else {
        if (selected.stage === "UPLOADED") {
          effectiveStage = "EMD_COLLECTED";
        } else if (selected.stage === "EMD_COLLECTED") {
          effectiveStage = "CONTINGENCIES";
        } else if (selected.stage === "CONTINGENCIES") {
          effectiveStage = "CLOSED";
        } else {
          effectiveStage = getNextStage(selected.stage);
        }
      }

      // =========================
      // VALIDATION + UPLOADS (ONLY when CONTINGENCIES -> CLOSED)
      // =========================
      if (selected.stage === "CONTINGENCIES" && advance) {
        if (!stageForm.titleCompany?.trim()) {
          toast.error("Title Company Name is required.");
          return;
        }
        if (!stageForm.commissionAmount) {
          toast.error("Commission Amount is required.");
          return;
        }
        if (!(stageForm.altaFile instanceof File)) {
          toast.error("ALTA / Settlement Statement (PDF) is required.");
          return;
        }

        // ===== Upload ALTA (UNCHANGED LOGIC) =====
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

        altaS3Key = presignData.key;

        // Keep UI state in sync (safe)
        setStageForm((prev) => ({
          ...prev,
          altaFile: { s3Key: presignData.key },
        }));

        // ===== Commission Disbursement PDF (NEW, SAFE) =====
        const commissionPdfBlob = await generateCommissionDisbursementPDF({
          address: `${selected.address.streetNumber} ${selected.address.streetName}, ${selected.address.city}, ${selected.address.state}`,
          agentName: agentFolder,
          titleCompany: stageForm.titleCompany,
          commissionAmount: stageForm.commissionAmount,
          adminFee: stageForm.adminFee,
          commissionNote: stageForm.commissionNote,
        });

        const commPresignRes = await fetch(`${apiUrl}/presign`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: "Comm_Disbursement.pdf",
            contentType: "application/pdf",
            fileSize: commissionPdfBlob.size,
            agentName: agentFolder,
            address: selected.address,
            transactionType: "PURCHASE",
            fileRole: "COMM_DISBURSEMENT",
          }),
        });

        const commPresignData = await commPresignRes.json();
        if (!commPresignRes.ok || !commPresignData?.url) {
          throw new Error("Commission disbursement presign failed");
        }

        await fetch(commPresignData.url, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: commissionPdfBlob,
        });
      }

      // =========================
      // SAVE stage + stageData (SAFE, CORRECT)
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
          stageData:
            altaS3Key
              ? { ...stageForm, altaFile: { s3Key: altaS3Key } }
              : (stageForm || {}),
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
      toast.error("Unable to update stage.");
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

/* =========================
   PDF GENERATION (UNCHANGED)
========================= */
const generateCommissionDisbursementPDF = async ({
  address,
  agentName,
  titleCompany,
  commissionAmount,
  adminFee,
  commissionNote,
}) => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Commission Disbursement Summary", 20, 20);

  doc.setFontSize(11);
  doc.text(`Property: ${address}`, 20, 35);
  doc.text(`Agent: ${agentName}`, 20, 45);
  doc.text(`Title Company: ${titleCompany}`, 20, 55);
  doc.text(`Commission Amount: $${commissionAmount}`, 20, 65);

  if (adminFee) {
    doc.text(`Admin Fee: $${adminFee}`, 20, 75);
  }

  if (commissionNote) {
    doc.text("Instructions:", 20, 90);
    doc.text(commissionNote, 20, 100, { maxWidth: 170 });
  }

  return doc.output("blob");
};