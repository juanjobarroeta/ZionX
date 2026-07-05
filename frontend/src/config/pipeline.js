// Shared production-pipeline vocabulary. Single source of truth for the stage
// and status labels used by the calendar drawer (ContentPlanningCenter) and the
// personal / supervision queues (MyWork).

export const STAGE_LABELS = {
  design: "Diseño",
  copy: "Copy",
  music: "Música",
  internal_approval: "Aprobación interna",
  client_approval: "Aprobación del cliente",
  paid_promo: "Promoción pagada",
  schedule: "Programación",
};

export const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  listo: "Listo",
  cambios: "Cambios pedidos",
};

export const STATUS_ORDER = ["pendiente", "en_progreso", "listo", "cambios"];

// Pill color -> brand tokens (muted / warn / ok / bad).
export const STATUS_VARIANT = {
  pendiente: "muted",
  en_progreso: "warn",
  listo: "ok",
  cambios: "bad",
};

export const OPTIONAL_STAGES = new Set(["music", "paid_promo"]);

export const stageLabel = (k) => STAGE_LABELS[k] || k;
export const statusLabel = (k) => STATUS_LABELS[k] || k;
