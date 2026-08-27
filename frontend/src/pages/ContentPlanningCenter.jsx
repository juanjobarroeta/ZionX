import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import PinterestEmbed from "../components/PinterestEmbed";
import PixelMark from "../components/PixelMark";
import Telemetry from "../components/Telemetry";
import { API_BASE_URL } from "../utils/constants";
import { customerName as resolveCustomerName } from "../utils/customerName";
import {
  contentStatusInfo,
  CONTENT_STATUS_OPTIONS,
  publishStatusInfo,
  APPROVED_INTERNAL,
  CLIENT_BLOCKED,
} from "../config/contentStatus";
import {
  STAGE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_VARIANT,
  OPTIONAL_STAGES,
} from "../config/pipeline";
import { tMinus } from "../utils/countdown";
import "../styles/zionx.css";
import "./Calendar.css";

// ---------- status + platform mapping ----------
// Canonical content/publish status now lives in config/contentStatus.
const statusInfo = contentStatusInfo;
const STATUS_OPTIONS = CONTENT_STATUS_OPTIONS;

const PLATFORM_ABBR = {
  instagram: "IG", facebook: "FB", tiktok: "TikTok",
  linkedin: "LI", twitter: "X", youtube: "YT", threads: "TH",
};
const platAbbr = (p) => PLATFORM_ABBR[(p || "").toLowerCase()] || (p ? p.slice(0, 2).toUpperCase() : "—");

const PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin"];
const CONTENT_TYPES = ["post", "reel", "story", "carrusel", "video"];

// ---------- date helpers ----------

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_ES_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const postDayKey = (post) => String(post.scheduled_date || "").slice(0, 10);
const isSameDay = (a, b) => dayKey(a) === dayKey(b);

// Monday-first week containing `d`
const weekStart = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const weekDays = (anchor) => {
  const s = weekStart(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};

// 6-week Monday-first grid covering the month of `anchor`
const monthGrid = (anchor) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

const postTime = (post) => {
  const s = String(post.scheduled_date || "");
  const m = s.match(/[T ](\d{2}):(\d{2})/);
  if (!m || (m[1] === "00" && m[2] === "00")) return "";
  return `${m[1]}:${m[2]}`;
};

const rangeLabel = (view, anchor) => {
  if (view === "month") return `${MONTHS_ES[anchor.getMonth()].replace(/^./, (c) => c.toUpperCase())} ${anchor.getFullYear()}`;
  const days = weekDays(anchor);
  const a = days[0], b = days[6];
  return `${a.getDate()} ${MONTHS_ES_SHORT[a.getMonth()]} — ${b.getDate()} ${MONTHS_ES_SHORT[b.getMonth()]}`;
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const mediaSrc = (u) => (u ? (/^(https?:|data:)/.test(u) ? u : `${API_BASE_URL}${u}`) : null);
const isVideoFile = (u) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || "");
const fmtShort = (s) => {
  if (!s) return "";
  const [, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_ES_SHORT[(m || 1) - 1]}`;
};
const isPastDue = (due, status) =>
  due && status !== "listo" && new Date(String(due).slice(0, 10)) < new Date(new Date().toDateString());

// ---------- publish readiness (mirrors backend publishSync) ----------

const PLAT_NAME = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn" };

const readinessOf = (p) => {
  const missing = [];
  const isStory = (p.content_type || "").toLowerCase() === "story";
  if (!APPROVED_INTERNAL.has((p.status || "").toLowerCase())) missing.push("aprobación interna");
  if (CLIENT_BLOCKED.has((p.client_status || "").toLowerCase())) missing.push("aprobación del cliente");
  // Stories carry no caption — mirror of publishSync.computeReadiness.
  if (!isStory && !(p.copy_out || p.copy_in || "").trim()) missing.push("copy");
  if ((p.platform || "").toLowerCase() === "instagram" && !(p.arte || "").trim()) missing.push("arte");
  if (!p.scheduled_date) missing.push("fecha");
  if (!p.has_account) missing.push(`cuenta de ${PLAT_NAME[(p.platform || "").toLowerCase()] || "la plataforma"} conectada`);
  return { ready: missing.length === 0, missing };
};

// Map the canonical publish tone → this surface's Calendar.css variant.
const PUBLISH_VARIANT = { queued: "queued", active: "queued", success: "published", failed: "failed", muted: "muted" };
const publishMeta = (s) => {
  const info = publishStatusInfo(s);
  return info ? { label: info.label, variant: PUBLISH_VARIANT[info.tone] } : null;
};

// ---------- production pipeline ----------
// Live, stateful stages for a post (replaces the stateless "Falta para publicar"
// checklist). Vocabulary lives in config/pipeline (shared with MyWork).
const stageOwnerLabel = (s) => {
  if (s.stage_key === "client_approval") return "Cliente";
  if (s.owner_id == null) return "Sin asignar";
  return s.owner_name || `#${s.owner_id}`;
};

const ContentPlanningCenter = () => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  // Deep-link support: /content-calendar?customer=<id> preselects the client
  // (used by the per-client planning grid to hand off to the unified calendar).
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get("customer") || "all");
  const [posts, setPosts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    customer_id: "", scheduled_date: "", platform: "instagram",
    content_type: "post", campaign: "", idea_tema: "", status: "planificado",
  });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  // Production pipeline (right-panel) state.
  const [pipeline, setPipeline] = useState({ loading: false, stages: [], postId: null });
  const [assignable, setAssignable] = useState([]);
  const [stageBusy, setStageBusy] = useState(null);
  const [copyDraft, setCopyDraft] = useState(null);
  const [ideaDraft, setIdeaDraft] = useState(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  // Fetch customers once (filter chips + create form)
  useEffect(() => {
    axios.get(`${API_BASE_URL}/customers`, { headers })
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, [headers]);

  // Fetch employees once (designer / CM assignment in the post editor).
  // Assignment resolves against the employees table (assigned_designer =
  // employees.id), which is what the range endpoint joins for the names.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/hr/employees`, { headers })
      .then((r) => setEmployees(Array.isArray(r.data) ? r.data : (r.data?.employees || [])))
      .catch(() => setEmployees([]));
  }, [headers]);

  // Assignable team members for pipeline owner reassignment (fetched once).
  useEffect(() => {
    axios.get(`${API_BASE_URL}/pipeline/assignable`, { headers })
      .then((r) => setAssignable(Array.isArray(r.data?.team_members) ? r.data.team_members : []))
      .catch(() => setAssignable([]));
  }, [headers]);

  // Lazily load (and seed) the pipeline whenever a post opens in the drawer.
  useEffect(() => {
    const pid = selected?.id;
    if (!pid) {
      setPipeline({ loading: false, stages: [], postId: null });
      setCopyDraft(null);
      return;
    }
    setPipeline({ loading: true, stages: [], postId: pid });
    setCopyDraft(null);
    let alive = true;
    axios.get(`${API_BASE_URL}/content-calendar/${pid}/pipeline`, { headers })
      .then((r) => { if (alive) setPipeline({ loading: false, stages: Array.isArray(r.data?.stages) ? r.data.stages : [], postId: pid }); })
      .catch(() => { if (alive) setPipeline({ loading: false, stages: [], postId: pid }); });
    return () => { alive = false; };
  }, [selected?.id, headers]);

  // PATCH a single stage (status and/or owner) and replace it from the response.
  const patchStage = async (stageKey, body) => {
    const pid = pipeline.postId;
    if (!pid) return;
    setStageBusy(stageKey);
    try {
      const r = await axios.patch(`${API_BASE_URL}/content-calendar/${pid}/pipeline/${stageKey}`, body, { headers });
      const stage = r.data?.stage;
      if (stage) setPipeline((prev) => ({ ...prev, stages: prev.stages.map((s) => (s.stage_key === stageKey ? stage : s)) }));
    } catch {
      /* keep UI responsive; a failed stage write just no-ops */
    } finally {
      setStageBusy(null);
    }
  };

  // Copy AI-draft — asks Claude for an on-brand caption using the client's
  // brief + this post's idea/pilar/platform. The draft is a starting point the
  // community manager reviews and inserts into the copy field.
  const generateDraft = async () => {
    const pid = pipeline.postId;
    if (!pid) return;
    setCopyDraft({ loading: true });
    try {
      const r = await axios.post(`${API_BASE_URL}/content-calendar/${pid}/pipeline/copy/ai-draft`, {}, { headers });
      setCopyDraft({ done: true, draft: r.data?.draft ?? null, error: null });
    } catch (err) {
      setCopyDraft({ done: true, draft: null, error: err.response?.data?.error || "No se pudo generar el borrador" });
    }
  };

  // Idea/tema AI-draft — a content concept for the design stage, from the
  // client's brief + this post's pilar/platform.
  const generateIdea = async () => {
    const pid = pipeline.postId;
    if (!pid) return;
    setIdeaDraft({ loading: true });
    try {
      const r = await axios.post(`${API_BASE_URL}/content-calendar/${pid}/pipeline/idea/ai-draft`, {}, { headers });
      setIdeaDraft({ done: true, draft: r.data?.draft ?? null, error: null });
    } catch (err) {
      setIdeaDraft({ done: true, draft: null, error: err.response?.data?.error || "No se pudo generar la idea" });
    }
  };

  // Persist an AI draft onto the post, reflect it locally (and in the open edit
  // form), and nudge its stage into progress — so using AI actually moves the
  // work forward instead of just filling a textarea.
  const applyAiDraft = async (field, value, stageKey) => {
    const pid = pipeline.postId;
    if (!pid) return;
    try {
      await axios.put(`${API_BASE_URL}/content-calendar/${pid}`, { [field]: value }, { headers });
      applyPatch(pid, { [field]: value });
      if (editForm) setEditForm({ ...editForm, [field]: value });
      const st = pipeline.stages.find((s) => s.stage_key === stageKey);
      if (st && st.status === "pendiente") await patchStage(stageKey, { status: "en_progreso" });
    } catch {
      /* keep UI responsive; a failed write just no-ops */
    }
  };

  // Save the AI copy draft to copy_out and advance the copy stage.
  const useDraft = async () => {
    if (!copyDraft?.draft) return;
    await applyAiDraft("copy_out", copyDraft.draft, "copy");
    setCopyDraft(null);
  };

  // Save the AI idea to idea_tema and advance the design stage.
  const useIdea = async () => {
    if (!ideaDraft?.draft) return;
    await applyAiDraft("idea_tema", ideaDraft.draft, "design");
    setIdeaDraft(null);
  };

  const designers = useMemo(() => employees.filter((e) => (e.role || "").toLowerCase() === "designer"), [employees]);
  const cms = useMemo(() => employees.filter((e) => ["community_manager", "cm"].includes((e.role || "").toLowerCase())), [employees]);
  const employeeName = useCallback((id) => {
    const e = employees.find((x) => String(x.id) === String(id));
    return e ? (e.name || e.full_name || `#${id}`) : null;
  }, [employees]);

  const [from, to] = useMemo(() => {
    const cells = view === "month" ? monthGrid(anchor) : weekDays(anchor);
    return [dayKey(cells[0]), dayKey(cells[cells.length - 1])];
  }, [view, anchor]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from, to };
      if (customerFilter !== "all") params.customer_id = customerFilter;
      const r = await axios.get(`${API_BASE_URL}/content-calendar-range`, { headers, params });
      setPosts(Array.isArray(r.data) ? r.data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, customerFilter, headers]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Group posts by day
  const byDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      const k = postDayKey(p);
      (map[k] = map[k] || []).push(p);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => postTime(a).localeCompare(postTime(b)));
    }
    return map;
  }, [posts]);

  // Counts for the command-bar readout: what is planned in this range, what is
  // already in the publish queue, and what broke.
  const totals = useMemo(() => {
    let queued = 0, failed = 0, published = 0;
    for (const p of posts) {
      const ps = (p.publish_status || "").toLowerCase();
      if (ps === "scheduled" || ps === "publishing") queued += 1;
      if (ps === "failed") failed += 1;
      if (ps === "published" || statusInfo(p.status).variant === "published") published += 1;
    }
    return { total: posts.length, queued, failed, published };
  }, [posts]);

  const customerName = useCallback(
    (post) => post.customer_name || resolveCustomerName(customers.find((c) => c.id === post.customer_id)),
    [customers]
  );

  const postTitle = useCallback((post) => {
    const type = post.content_type ? capitalize(post.content_type) : "Post";
    const subject = post.idea_tema || post.campaign || customerName(post);
    return `${type} — ${subject}`;
  }, [customerName]);

  const shift = (dir) => {
    setAnchor((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + dir);
      else d.setDate(d.getDate() + dir * 7);
      return d;
    });
  };
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d); };

  const [busy, setBusy] = useState(false);

  const applyPatch = (postId, patch) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
    setSelected((s) => (s && s.id === postId ? { ...s, ...patch } : s));
  };

  const updateStatus = async (post, status) => {
    try {
      await axios.put(`${API_BASE_URL}/content-calendar/${post.id}`, { status }, { headers });
      applyPatch(post.id, { status });
    } catch {
      /* keep UI responsive; a failed status write just no-ops */
    }
  };

  const schedulePost = async (post) => {
    setBusy(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/content-calendar/${post.id}/schedule`, {}, { headers });
      applyPatch(post.id, {
        publish_status: r.data?.scheduled_post?.status || "scheduled",
        scheduled_post_id: r.data?.scheduled_post?.id || post.id,
      });
    } catch {
      /* button only shows when ready; ignore transient failures */
    } finally {
      setBusy(false);
    }
  };

  const unschedulePost = async (post) => {
    setBusy(true);
    try {
      await axios.delete(`${API_BASE_URL}/content-calendar/${post.id}/schedule`, { headers });
      applyPatch(post.id, { publish_status: null, scheduled_post_id: null });
    } catch {
      /* no-op */
    } finally {
      setBusy(false);
    }
  };

  // Per-post client sign-off: generate a link scoped to just this post and copy it.
  const [clientLinkFor, setClientLinkFor] = useState(null);
  const [uploadingArte, setUploadingArte] = useState(false);
  const arteInputRef = useRef(null);

  // Attach the actual media to the post — the thing Instagram publishes. One
  // file: image for posts/carruseles, video for reels y stories.
  const uploadArte = async (file) => {
    if (!selected || !file) return;
    setUploadingArte(true);
    try {
      const form = new FormData();
      form.append("files", file);
      form.append("fileType", "arte");
      const r = await axios.post(`${API_BASE_URL}/content/${selected.id}/upload`, form, { headers });
      const arte = r.data?.post?.arte || r.data?.files?.[0]?.file_path;
      if (arte) applyPatch(selected.id, { arte });
    } catch {
      /* the readiness panel keeps saying "arte" until it actually lands */
    } finally {
      setUploadingArte(false);
      if (arteInputRef.current) arteInputRef.current.value = "";
    }
  };
  const sendToClient = async (post) => {
    setBusy(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/approvals/generate-post-link`, { content_calendar_id: post.id }, { headers });
      const url = r.data?.url;
      if (url) {
        try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
        setClientLinkFor({ id: post.id, url });
      }
    } catch {
      /* surface nothing intrusive; button stays available to retry */
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (date) => {
    const f = { customer_id: "", scheduled_date: "", platform: "instagram", content_type: "post", campaign: "", idea_tema: "", status: "planificado" };
    if (date) {
      const d = new Date(date); d.setHours(9, 0, 0, 0);
      f.scheduled_date = `${dayKey(d)}T09:00`;
    }
    setForm(f);
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.scheduled_date) return;
    setSaving(true);
    try {
      const monthYear = form.scheduled_date.slice(0, 7);
      const sameMonth = posts.filter(
        (p) => String(p.customer_id) === String(form.customer_id) && postDayKey(p).slice(0, 7) === monthYear
      );
      const postNumber = sameMonth.reduce((mx, p) => Math.max(mx, p.post_number || 0), 0) + 1;
      await axios.post(`${API_BASE_URL}/content-calendar`, {
        customer_id: Number(form.customer_id),
        month_year: monthYear,
        post_number: postNumber,
        campaign: form.campaign || null,
        platform: form.platform,
        content_type: form.content_type,
        scheduled_date: form.scheduled_date,
        status: form.status,
        idea_tema: form.idea_tema || null,
      }, { headers });
      setShowCreate(false);
      await fetchPosts();
    } catch {
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  };

  // ---------- full post editor (drawer) ----------
  // The rich content fields the legacy Excel grid owned now live here, so a post
  // can be authored end-to-end in the calendar. Writes via PUT /content-calendar/:id
  // (dynamic update from body keys).
  const EDIT_FIELDS = ["platform", "content_type", "campaign", "pilar", "idea_tema", "referencia", "pinterest_ref", "copy_in", "copy_out", "assigned_designer", "assigned_community_manager"];

  const openEdit = () => {
    if (!selected) return;
    const f = {};
    for (const k of EDIT_FIELDS) f[k] = selected[k] ?? "";
    setEditForm(f);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected || !editForm) return;
    setSaving(true);
    try {
      // Send only changed keys; empty strings become null so a cleared field clears.
      const body = {};
      for (const k of EDIT_FIELDS) {
        const v = editForm[k];
        body[k] = v === "" ? null : v;
      }
      await axios.put(`${API_BASE_URL}/content-calendar/${selected.id}`, body, { headers });
      // Reflect edits immediately, incl. resolved designer/CM names for the drawer.
      applyPatch(selected.id, {
        ...body,
        designer_name: employeeName(body.assigned_designer),
        cm_name: employeeName(body.assigned_community_manager),
      });
      setEditing(false);
      fetchPosts();
    } catch {
      /* keep the editor open so the user can retry */
    } finally {
      setSaving(false);
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ---------- render helpers ----------

  // The rail carries the editorial state; the right of the top row carries the
  // flight state — queued posts count down to air, failed ones say so.
  const PostChip = ({ post }) => {
    const { variant, label } = statusInfo(post.status);
    const queued = post.publish_status === "scheduled" || post.publish_status === "publishing";
    const failed = post.publish_status === "failed";
    const countdown = queued ? tMinus(post.scheduled_date) : null;
    // Close to air with required production unfinished — the chip that asks
    // for attention before the failure happens instead of after.
    const untilAir = post.scheduled_date ? new Date(post.scheduled_date).getTime() - Date.now() : null;
    const atRisk = !queued && !failed
      && statusInfo(post.status).variant !== "published"
      && Number(post.pending_stages) > 0
      && untilAir !== null && untilAir < 72 * 3600e3 && untilAir > -7 * 86400e3;
    return (
      <button className={`zxc-post v-${variant}`} onClick={() => setSelected(post)}>
        <div className="top">
          <span>{[postTime(post), platAbbr(post.platform)].filter(Boolean).join(" · ")}</span>
          {failed ? (
            <span className="flight fail"><i className="zxc-qdot fail" />Falló</span>
          ) : queued ? (
            <span className="flight" title="En cola de publicación"><i className="zxc-qdot" />{countdown}</span>
          ) : atRisk ? (
            <span className="flight fail" title={`${post.pending_stages} etapas pendientes y publica pronto`}>
              ⚠ {post.pending_stages}
            </span>
          ) : null}
        </div>
        <div className="title">{postTitle(post)}</div>
        <div className="client">{customerName(post)} <span className="state">· {label}</span></div>
      </button>
    );
  };

  const WeekView = () => {
    const days = weekDays(anchor);
    return (
      <div className="zxc-grid-wrap">
        <div className="zxc-week">
          {days.map((d) => {
            const n = (byDay[dayKey(d)] || []).length;
            const isToday = isSameDay(d, today);
            return (
              <div key={"h" + dayKey(d)} className={`zxc-dayhead${isToday ? " today" : ""}`}>
                <span className="when">
                  <span className="n">{d.getDate()}</span>
                  <span className="d">{DAYS_ES[d.getDay()]}</span>
                </span>
                <span className="c">
                  {isToday && <PixelMark size={9} />}
                  {n > 0 ? String(n).padStart(2, "0") : "—"}
                </span>
              </div>
            );
          })}
          {days.map((d) => {
            const list = byDay[dayKey(d)] || [];
            return (
              <div key={"c" + dayKey(d)} className={`zxc-daycell${isSameDay(d, today) ? " today" : ""}${d < today ? " past" : ""}`}>
                {list.map((p) => <PostChip key={p.id} post={p} />)}
                <button className="addslot" onClick={() => openCreate(d)}>+ Publicación</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const MonthView = () => {
    const cells = monthGrid(anchor);
    return (
      <div className="zxc-grid-wrap">
        <div className="zxc-month">
          {DAYS_ES.slice(1).concat(DAYS_ES[0]).map((d) => (
            <div key={"mh" + d} className="zxc-mhead">{d}</div>
          ))}
          {cells.map((d) => {
            const list = byDay[dayKey(d)] || [];
            const inMonth = d.getMonth() === anchor.getMonth();
            return (
              <div key={"m" + dayKey(d)} className={`zxc-mcell${inMonth ? "" : " dim"}${isSameDay(d, today) ? " today" : ""}`}>
                <span className="num">{d.getDate()}</span>
                {list.slice(0, 3).map((p) => (
                  <button key={p.id} className={`zxc-mpost v-${statusInfo(p.status).variant}`} onClick={() => setSelected(p)} title={postTitle(p)}>
                    {postTime(p) && <span className="t">{postTime(p)}</span>}
                    {postTitle(p)}
                  </button>
                ))}
                {list.length > 3 && <span className="zxc-mmore">+{list.length - 3} más</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="zx-app zxc">
        {/* ---------- command bar ---------- */}
        <header className="zx-cmd">
          <div className="zx-cmd-inner">
            <div className="zx-cmd-top">
              <div>
                <div className="zx-eyebrow"><PixelMark size={11} /> Programación</div>
                <h1 className="zx-title">Calendario <span className="zx-serif">de contenido</span></h1>
              </div>
              <div className="zx-cmd-actions">
                <div className="zx-seg on-ink">
                  <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Semana</button>
                  <button className={view === "month" ? "on" : ""} onClick={() => setView("month")}>Mes</button>
                </div>
                <div className="zxc-range">
                  <button className="zx-btn on-ink ghost icon" onClick={() => shift(-1)} aria-label="Período anterior">←</button>
                  <button className="zxc-range-label" onClick={goToday} title="Ir a hoy">{rangeLabel(view, anchor)}</button>
                  <button className="zx-btn on-ink ghost icon" onClick={() => shift(1)} aria-label="Período siguiente">→</button>
                </div>
                <button className="zx-btn on-ink" onClick={() => openCreate(null)}>Nueva publicación</button>
              </div>
            </div>
            <Telemetry
              items={[
                { k: "Publicaciones", v: totals.total },
                { k: "En cola", v: totals.queued, tone: "brass" },
                { k: "Fallidas", v: totals.failed, tone: "crit" },
                { k: "Publicadas", v: totals.published },
              ]}
            />
          </div>
        </header>

        {/* ---------- working surface ---------- */}
        <div className="zx-canvas">
          {/* Client filter chips */}
          <div className="zx-toolbar">
            <button className={`zx-chip${customerFilter === "all" ? " on" : ""}`} onClick={() => setCustomerFilter("all")}>
              Todos los clientes
            </button>
            {customers.map((c) => (
              <button
                key={c.id}
                className={`zx-chip${String(customerFilter) === String(c.id) ? " on" : ""}`}
                onClick={() => setCustomerFilter(c.id)}
              >
                {resolveCustomerName(c)}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="zx-empty">Cargando calendario…</div>
          ) : posts.length === 0 ? (
            <div className="zx-empty">
              <strong>Esta ventana está vacía.</strong>
              Crea la primera publicación con “Nueva publicación”, o pasa el cursor sobre un día para programarla ahí.
            </div>
          ) : view === "week" ? (
            <WeekView />
          ) : (
            <MonthView />
          )}

          {/* Legend */}
          <div className="zx-legend">
            <span><i className="zx-swatch" style={{ background: "#04111A" }} /> Publicado</span>
            <span><i className="zx-swatch" style={{ background: "#FFFFFF", borderLeft: "3px solid #04111A" }} /> Aprobado / revisión</span>
            <span><i className="zx-swatch" style={{ background: "#FFFFFF", borderLeft: "3px dashed rgba(4,17,26,0.4)" }} /> Planificado / en diseño</span>
            <span><i className="zx-swatch" style={{ background: "#FFFFFF", borderLeft: "3px solid #8A1C1C" }} /> Fallida</span>
            <span><i className="zxc-qdot" /> En cola de publicación</span>
            <span><span style={{ color: "#8A1C1C", fontWeight: 700 }}>⚠</span> Producción pendiente y publica pronto</span>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <button className="zxc-scrim" onClick={() => { setSelected(null); setEditing(false); }} aria-label="Cerrar" />
          <aside className="zxc-drawer">
            <div className="zxc-drawer-head">
              <span className="plat">{capitalize(selected.platform) || "Contenido"} · {capitalize(selected.content_type) || "Post"}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!editing && <button className="zx-btn on-ink ghost" onClick={openEdit}>Editar</button>}
                <button className="zxc-x" onClick={() => { setSelected(null); setEditing(false); }} aria-label="Cerrar">×</button>
              </div>
            </div>
            <div className="zxc-drawer-body">
              <div className={`zx-pill v-${statusInfo(selected.status).variant}`} style={{ alignSelf: "flex-start" }}>
                {statusInfo(selected.status).label}
              </div>
              <h3>{postTitle(selected)}</h3>

              <div className="zx-field">
                <span className="k">Cliente</span>
                <span className="val">{customerName(selected)}</span>
              </div>
              <div className="zx-field">
                <span className="k">Programado</span>
                <span className="zxc-when">
                  <span>
                    {(() => {
                      const dk = postDayKey(selected);
                      const [y, m, day] = dk.split("-").map(Number);
                      const t = postTime(selected);
                      return `${day} ${MONTHS_ES[(m || 1) - 1]} ${y}${t ? ` · ${t}` : ""}`;
                    })()}
                  </span>
                  {selected.publish_status === "scheduled" && tMinus(selected.scheduled_date) && (
                    <span className="zx-tmin">{tMinus(selected.scheduled_date)}</span>
                  )}
                </span>
              </div>
              {editing ? (
                <>
                  <div className="zx-row2">
                    <div className="zx-field">
                      <span className="k">Plataforma</span>
                      <select className="zx-select" value={editForm.platform || ""} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}>
                        {PLATFORMS.map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                      </select>
                    </div>
                    <div className="zx-field">
                      <span className="k">Formato</span>
                      <select className="zx-select" value={editForm.content_type || ""} onChange={(e) => setEditForm({ ...editForm, content_type: e.target.value })}>
                        {CONTENT_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="zx-row2">
                    <div className="zx-field">
                      <span className="k">Campaña</span>
                      <input className="zx-input" type="text" value={editForm.campaign || ""} onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })} />
                    </div>
                    <div className="zx-field">
                      <span className="k">Pilar</span>
                      <input className="zx-input" type="text" value={editForm.pilar || ""} onChange={(e) => setEditForm({ ...editForm, pilar: e.target.value })} />
                    </div>
                  </div>
                  <div className="zx-field">
                    <span className="k">Idea / tema</span>
                    <input className="zx-input" type="text" value={editForm.idea_tema || ""} onChange={(e) => setEditForm({ ...editForm, idea_tema: e.target.value })} />
                  </div>
                  <div className="zx-field">
                    <span className="k">Referencia</span>
                    <input className="zx-input" type="text" value={editForm.referencia || ""} onChange={(e) => setEditForm({ ...editForm, referencia: e.target.value })} />
                  </div>
                  <div className="zx-field">
                    <span className="k">Pinterest (Pin/tablero)</span>
                    <input className="zx-input" type="url" placeholder="https://pinterest.com/pin/…" value={editForm.pinterest_ref || ""} onChange={(e) => setEditForm({ ...editForm, pinterest_ref: e.target.value })} />
                  </div>
                  <div className="zx-field">
                    <span className="k">Copy in (brief)</span>
                    <textarea className="zx-input" rows={2} value={editForm.copy_in || ""} onChange={(e) => setEditForm({ ...editForm, copy_in: e.target.value })} />
                  </div>
                  <div className="zx-field">
                    <span className="k">Copy out (publicación)</span>
                    <textarea className="zx-input" rows={3} value={editForm.copy_out || ""} onChange={(e) => setEditForm({ ...editForm, copy_out: e.target.value })} />
                  </div>
                  <div className="zx-row2">
                    <div className="zx-field">
                      <span className="k">Diseñador</span>
                      <select className="zx-select" value={editForm.assigned_designer || ""} onChange={(e) => setEditForm({ ...editForm, assigned_designer: e.target.value })}>
                        <option value="">Sin asignar</option>
                        {designers.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
                      </select>
                    </div>
                    <div className="zx-field">
                      <span className="k">Community manager</span>
                      <select className="zx-select" value={editForm.assigned_community_manager || ""} onChange={(e) => setEditForm({ ...editForm, assigned_community_manager: e.target.value })}>
                        <option value="">Sin asignar</option>
                        {cms.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="zxc-actions" style={{ marginTop: 4 }}>
                    <button className="zx-btn" disabled={saving} onClick={saveEdit}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                    <button className="zx-btn ghost" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
                  </div>
                </>
              ) : (
              <>
              {selected.campaign && (
                <div className="zx-field"><span className="k">Campaña</span><span className="val">{selected.campaign}</span></div>
              )}
              {selected.pilar && (
                <div className="zx-field"><span className="k">Pilar</span><span className="val">{selected.pilar}</span></div>
              )}
              {(selected.designer_name || selected.cm_name) && (
                <div className="zx-field">
                  <span className="k">Equipo</span>
                  <span className="val">{[selected.designer_name && `Diseño: ${selected.designer_name}`, selected.cm_name && `CM: ${selected.cm_name}`].filter(Boolean).join(" · ")}</span>
                </div>
              )}
              {selected.copy_out && (
                <div className="zx-field"><span className="k">Copy</span><span className="val copy">{selected.copy_out}</span></div>
              )}
              {selected.pinterest_ref && (
                <div className="zx-field">
                  <span className="k">Referencia visual</span>
                  <PinterestEmbed url={selected.pinterest_ref} />
                </div>
              )}

              <div className="zx-field">
                <span className="k">Cambiar estado</span>
                <select
                  className="zx-select"
                  value={STATUS_OPTIONS.find((o) => o.value === (selected.status || "").toLowerCase())?.value || ""}
                  onChange={(e) => updateStatus(selected, e.target.value)}
                >
                  <option value="" disabled>Selecciona…</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Arte — the media Instagram will actually publish */}
              <div className="zx-field">
                <span className="k">Arte / medios</span>
                {selected.arte ? (
                  <div className="zxc-arte">
                    {isVideoFile(selected.arte) ? (
                      <video src={mediaSrc(selected.arte)} controls muted playsInline />
                    ) : (
                      <img src={mediaSrc(selected.arte)} alt="Arte de la publicación" />
                    )}
                  </div>
                ) : (
                  <div className="zxc-note">
                    {(selected.platform || "").toLowerCase() === "instagram"
                      ? "Sin arte todavía — Instagram lo necesita para publicar."
                      : "Sin arte todavía."}
                  </div>
                )}
                <div className="zxc-actions">
                  <button type="button" className="zx-btn ghost" disabled={uploadingArte}
                          onClick={() => arteInputRef.current?.click()}>
                    {uploadingArte ? "Subiendo…" : selected.arte ? "Reemplazar arte" : "Subir arte"}
                  </button>
                  <input ref={arteInputRef} type="file" hidden
                         accept="image/*,video/mp4,video/quicktime"
                         onChange={(e) => uploadArte(e.target.files?.[0])} />
                  {["story", "reel", "video"].includes((selected.content_type || "").toLowerCase()) && (
                    <span className="zxc-note">Para {selected.content_type}: sube video (MP4/MOV).</span>
                  )}
                </div>
              </div>

              {/* Production pipeline — live, stateful stages */}
              <div className="zx-field">
                <span className="k">Producción</span>
                {pipeline.loading ? (
                  <div className="zxc-pipe-note">Cargando producción…</div>
                ) : pipeline.stages.length === 0 ? (
                  <div className="zxc-pipe-note">Sin etapas de producción.</div>
                ) : (
                  <>
                    {(() => {
                      const req = pipeline.stages.filter((x) => !OPTIONAL_STAGES.has(x.stage_key));
                      const done = req.filter((x) => x.status === "listo").length;
                      const overdue = req.filter((x) => isPastDue(x.due_date, x.status)).length;
                      return (
                        <div className="zxc-pipe-summary">
                          <b>{done} de {req.length}</b> listas
                          {selected.scheduled_date && <> · publica el {fmtShort(postDayKey(selected))}</>}
                          {overdue > 0 && <span className="over"> · {overdue} vencida{overdue > 1 ? "s" : ""}</span>}
                        </div>
                      );
                    })()}
                  <div className="zxc-pipe">
                    {pipeline.stages.map((s) => {
                      const optional = OPTIONAL_STAGES.has(s.stage_key);
                      return (
                        <div key={s.stage_key} className={`zxc-stage${optional ? " opt" : ""}`}>
                          <div className="zxc-stage-top">
                            <span className="zxc-stage-name">
                              {STAGE_LABELS[s.stage_key] || s.stage_key}
                              {optional && <span className="zxc-opt-tag">opcional</span>}
                            </span>
                            <span className={`zx-pill v-${STATUS_VARIANT[s.status] || "muted"}`}>
                              {STATUS_LABELS[s.status] || s.status}
                            </span>
                          </div>
                          <div className="zxc-stage-owner">
                            {stageOwnerLabel(s)}
                            {s.due_date && (
                              <span className={`zxc-stage-due${isPastDue(s.due_date, s.status) ? " over" : ""}`}>
                                {" "}· entrega {fmtShort(s.due_date)}
                              </span>
                            )}
                          </div>
                          <div className="zxc-stage-controls">
                            <select
                              className="zx-select sm"
                              value={s.status || "pendiente"}
                              disabled={stageBusy === s.stage_key}
                              onChange={(e) => patchStage(s.stage_key, { status: e.target.value })}
                            >
                              {STATUS_ORDER.map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
                            </select>
                            {s.stage_key !== "client_approval" && (
                              <select
                                className="zx-select sm"
                                value={s.owner_id ?? ""}
                                disabled={stageBusy === s.stage_key}
                                onChange={(e) => patchStage(s.stage_key, { owner_id: e.target.value === "" ? null : Number(e.target.value) })}
                              >
                                <option value="">Sin asignar</option>
                                {assignable.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            )}
                          </div>
                          {s.stage_key === "design" && (
                            <div className="zxc-stage-ai">
                              <button
                                type="button"
                                className="zx-linkbtn"
                                onClick={generateIdea}
                                disabled={ideaDraft?.loading}
                              >
                                {ideaDraft?.loading ? "Generando…" : "Generar idea con IA"}
                              </button>
                              {ideaDraft?.error && <span className="zxc-note">{ideaDraft.error}</span>}
                              {ideaDraft?.draft && (
                                <div className="zxc-ai-draft">
                                  <div className="zxc-ai-draft-text">{ideaDraft.draft}</div>
                                  <div className="zxc-ai-draft-actions">
                                    <button type="button" className="zx-linkbtn" onClick={useIdea}>Usar como idea/tema</button>
                                    <button type="button" className="zx-linkbtn muted" onClick={() => setIdeaDraft(null)}>Descartar</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {s.stage_key === "copy" && (
                            <div className="zxc-stage-ai">
                              <button
                                type="button"
                                className="zx-linkbtn"
                                onClick={generateDraft}
                                disabled={copyDraft?.loading}
                              >
                                {copyDraft?.loading ? "Generando…" : "Generar borrador con IA"}
                              </button>
                              {copyDraft?.error && <span className="zxc-note">{copyDraft.error}</span>}
                              {copyDraft?.draft && (
                                <div className="zxc-ai-draft">
                                  <div className="zxc-ai-draft-text">{copyDraft.draft}</div>
                                  <div className="zxc-ai-draft-actions">
                                    <button type="button" className="zx-linkbtn" onClick={useDraft}>Usar en copy</button>
                                    <button type="button" className="zx-linkbtn muted" onClick={() => setCopyDraft(null)}>Descartar</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              {/* Client sign-off (per-post approval link) */}
              <div className="zx-field">
                <span className="k">Cliente</span>
                <div className="zxc-actions">
                  {selected.client_status === "approved" && <span className="zx-pill v-published">Aprobado por cliente</span>}
                  {["changes_requested", "rejected", "rechazado"].includes((selected.client_status || "").toLowerCase()) && (
                    <span className="zx-pill v-failed">Cambios solicitados</span>
                  )}
                  <button className="zx-btn ghost" disabled={busy} onClick={() => sendToClient(selected)}>
                    {clientLinkFor?.id === selected.id ? "Enlace copiado ✓" : "Enviar a cliente"}
                  </button>
                  {clientLinkFor?.id === selected.id && (
                    <input className="zx-input" readOnly value={clientLinkFor.url} onFocus={(e) => e.target.select()} />
                  )}
                </div>
              </div>

              {/* Publish (plan → queue) */}
              <div className="zx-field">
                <span className="k">Publicación</span>
                {(() => {
                  const pm = publishMeta(selected.publish_status);
                  if (pm) {
                    return (
                      <div className="zxc-actions">
                        <span className={`zx-pill v-${pm.variant}`}>{pm.label}</span>
                        {selected.publish_status === "failed" && selected.publish_error && (
                          <div className="zx-err">⚠ {selected.publish_error}</div>
                        )}
                        {selected.publish_status === "scheduled" && (
                          <button className="zx-btn ghost" disabled={busy} onClick={() => unschedulePost(selected)}>
                            Quitar de la cola
                          </button>
                        )}
                        {selected.publish_status === "failed" && readinessOf(selected).ready && (
                          <button className="zx-btn" disabled={busy} onClick={() => schedulePost(selected)}>
                            {busy ? "Reintentando…" : "Reintentar"}
                          </button>
                        )}
                      </div>
                    );
                  }
                  const rd = readinessOf(selected);
                  return rd.ready ? (
                    <button className="zx-btn" disabled={busy} onClick={() => schedulePost(selected)}>
                      {busy ? "Programando…" : "Programar publicación"}
                    </button>
                  ) : (
                    <div className="zxc-note">Completa las etapas de producción para habilitar la programación.</div>
                  );
                })()}
              </div>
              </>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="zxc-modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <form className="zxc-modal" onSubmit={submitCreate}>
            <div className="zxc-modal-head">
              <h2>Nueva publicación</h2>
              <button type="button" className="zxc-x" onClick={() => setShowCreate(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="zxc-modal-body">
              <div className="zx-field">
                <span className="k">Cliente</span>
                <select className="zx-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                  <option value="">Selecciona un cliente…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{resolveCustomerName(c)}</option>
                  ))}
                </select>
              </div>
              <div className="zx-row2">
                <div className="zx-field">
                  <span className="k">Fecha y hora</span>
                  <input className="zx-input" type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required />
                </div>
                <div className="zx-field">
                  <span className="k">Estado</span>
                  <select className="zx-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="zx-row2">
                <div className="zx-field">
                  <span className="k">Plataforma</span>
                  <select className="zx-select" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                  </select>
                </div>
                <div className="zx-field">
                  <span className="k">Formato</span>
                  <select className="zx-select" value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
                  </select>
                </div>
              </div>
              <div className="zx-field">
                <span className="k">Idea / tema</span>
                <input className="zx-input" type="text" value={form.idea_tema} onChange={(e) => setForm({ ...form, idea_tema: e.target.value })} placeholder="p. ej. Promo verano 2×1" />
              </div>
              <div className="zx-field">
                <span className="k">Campaña (opcional)</span>
                <input className="zx-input" type="text" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
              </div>
            </div>
            <div className="zxc-modal-foot">
              <button type="button" className="zx-btn ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button type="submit" className="zx-btn" disabled={saving}>{saving ? "Guardando…" : "Crear publicación"}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default ContentPlanningCenter;
