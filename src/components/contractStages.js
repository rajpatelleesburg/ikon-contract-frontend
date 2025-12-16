export const STAGES = [
  { key: "EMD_COLLECTED", label: "EMD Collected" },
  { key: "HOME_INSPECTION_COMPLETED", label: "Home Inspection Completed" },
  { key: "FIN_APPRAISAL_REMOVED", label: "Financial & Appraisal Contingency Removed" },
  { key: "CLOSED", label: "Closed" },
  { key: "COMM_DISBURSED", label: "Commission Disbursed" },
];

export const stageTone = (stage) => {
  switch (stage) {
    case "EMD_COLLECTED": return "blue";
    case "HOME_INSPECTION_COMPLETED": return "amber";
    case "FIN_APPRAISAL_REMOVED": return "amber";
    case "CLOSED": return "green";
    case "COMM_DISBURSED": return "green";
    default: return "slate";
  }
};

export const stageProgress = (stage) => {
  const order = ["UPLOADED", ...STAGES.map(s => s.key)];
  const idx = Math.max(0, order.indexOf(stage));
  return Math.round((idx / (order.length - 1)) * 100);
};
