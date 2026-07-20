// Single source of truth for the sales/CRM funnel stages.
// Used by the Funnel board, lead detail, and analytics so labels/order never
// drift across screens (they used to be duplicated in 3 files).

export const FUNNEL_STAGES = [
  { key: "new",           label: "Nuevo",       tone: "muted" },
  { key: "contacted",     label: "Contactado",  tone: "sched" },
  { key: "qualified",     label: "Calificado",  tone: "sched" },
  { key: "proposal_sent", label: "Propuesta",   tone: "wait" },
  { key: "negotiation",   label: "Negociación", tone: "wait" },
  { key: "converted",     label: "Ganado",      tone: "done" },
  { key: "lost",          label: "Perdido",     tone: "bad" },
];

// Stages a lead actively moves through on the board (excludes the terminal
// "lost" column visually grouped at the end but still draggable).
export const STAGE_KEYS = FUNNEL_STAGES.map((s) => s.key);

export const stageLabel = (key) =>
  FUNNEL_STAGES.find((s) => s.key === key)?.label || key || "—";

export const stageTone = (key) =>
  FUNNEL_STAGES.find((s) => s.key === key)?.tone || "muted";

// Lead sources (where a lead came from).
export const LEAD_SOURCES = [
  { key: "campaign",  label: "Campaña" },
  { key: "manual",    label: "Manual" },
  { key: "website",   label: "Sitio web" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook",  label: "Facebook" },
  { key: "whatsapp",  label: "WhatsApp" },
  { key: "referral",  label: "Referido" },
  { key: "other",     label: "Otro" },
];
export const sourceLabel = (key) =>
  LEAD_SOURCES.find((s) => s.key === key)?.label || key || "—";
