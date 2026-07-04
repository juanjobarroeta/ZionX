// ============================================================================
// Canonical content workflow status — single source of truth.
//
// Before this module the content lifecycle was described in at least four
// places with drifting values: the new calendar (ContentPlanningCenter), the
// old Excel calendar (components/ContentCalendar), and the publish queue
// (SocialHub) each had their own status list, labels, colors and alias maps —
// and the two calendars didn't even agree (the old one was missing the
// `cliente` stage). Everything content-status now flows through here.
//
// Two axes:
//   1. CONTENT lifecycle  — a plan entry's editorial state (content_calendar.status)
//   2. PUBLISH status      — a queued post's delivery state (scheduled_posts.status)
// ============================================================================

// ---- 1. Content lifecycle (ordered) ---------------------------------------
// `variant`   → Calendar.css / Hub.css badge variant (draft|accent|published|failed)
// `badge`     → Tailwind classes used by the legacy Excel calendar
// `optionLabel` → label shown in the status <select> (may differ from the badge label)
export const CONTENT_STATUSES = [
  { value: "planificado", label: "Planificado", optionLabel: "Planificado",       variant: "draft",     badge: "bg-zionx-secondary text-zionx-primary" },
  { value: "en_diseño",   label: "En diseño",   optionLabel: "En diseño",         variant: "draft",     badge: "bg-yellow-100 text-yellow-800" },
  { value: "revision",    label: "En revisión", optionLabel: "En revisión",       variant: "accent",    badge: "bg-orange-100 text-orange-800" },
  { value: "aprobado",    label: "Aprobado",    optionLabel: "Aprobado",          variant: "accent",    badge: "bg-green-100 text-green-800" },
  { value: "cliente",     label: "Cliente",     optionLabel: "Esperando cliente", variant: "accent",    badge: "bg-blue-100 text-blue-800" },
  { value: "publicado",   label: "Publicado",   optionLabel: "Publicado",         variant: "published", badge: "bg-zionx-highlight text-white" },
];

// Non-lifecycle state a plan entry can end up in if its queued post failed.
const CONTENT_FAILED = { value: "fallido", label: "Fallida", optionLabel: "Fallida", variant: "failed", badge: "bg-red-100 text-red-800" };

const CONTENT_BY_VALUE = Object.fromEntries(CONTENT_STATUSES.map((s) => [s.value, s]));

// Tolerant alias map (Spanish/English + publish states that bleed in) → canonical value.
const CONTENT_ALIASES = {
  publicado: "publicado", published: "publicado", completed: "publicado",
  aprobado: "aprobado", approved: "aprobado", listo: "aprobado",
  revision: "revision", en_revision: "revision", "en revisión": "revision", review: "revision",
  cliente: "cliente", client: "cliente",
  en_diseño: "en_diseño", "en diseño": "en_diseño", diseno: "en_diseño", in_progress: "en_diseño",
  planificado: "planificado", pending: "planificado", programado: "planificado",
  fallido: "fallido", failed: "fallido", error: "fallido",
};

// Normalize any raw status string to a canonical content value (or null if unknown).
export const normalizeContentStatus = (raw) => CONTENT_ALIASES[(raw || "").toString().toLowerCase()] || null;

// Full descriptor for any raw status — always returns something renderable.
export const contentStatusInfo = (raw) => {
  const v = normalizeContentStatus(raw);
  if (v === "fallido") return CONTENT_FAILED;
  if (v && CONTENT_BY_VALUE[v]) return CONTENT_BY_VALUE[v];
  return { value: null, label: raw ? raw.toString().replace(/_/g, " ") : "Planificado", optionLabel: raw || "Planificado", variant: "draft", badge: "bg-zionx-tertiary text-zionx-primary" };
};

// Dropdown options in workflow order (excludes the failure state).
export const CONTENT_STATUS_OPTIONS = CONTENT_STATUSES.map((s) => ({ value: s.value, label: s.optionLabel }));

// Tailwind badge class for the legacy Excel calendar.
export const contentStatusBadge = (raw) => contentStatusInfo(raw).badge;

// ---- 2. Publish-queue status ----------------------------------------------
// The canonical delivery states for a scheduled_posts row. `tone` is semantic;
// each surface maps tone → its own CSS. Labels are unified here.
export const PUBLISH_STATUSES = [
  { value: "scheduled",  label: "Programada", tone: "queued" },
  { value: "publishing", label: "Publicando", tone: "active" },
  { value: "published",  label: "Publicada",  tone: "success" },
  { value: "failed",     label: "Fallida",    tone: "failed" },
  { value: "cancelled",  label: "Cancelada",  tone: "muted" },
];

const PUBLISH_BY_VALUE = Object.fromEntries(PUBLISH_STATUSES.map((s) => [s.value, s]));

// Descriptor for a publish-queue status (null if not a known publish state).
export const publishStatusInfo = (raw) => PUBLISH_BY_VALUE[(raw || "").toString().toLowerCase()] || null;

// ---- 3. Publish readiness (mirrors backend services/publishSync.js) --------
export const APPROVED_INTERNAL = new Set(["aprobado", "approved", "publicado", "published", "listo"]);
export const CLIENT_BLOCKED = new Set(["changes_requested", "rejected", "rechazado"]);
