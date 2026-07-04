import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import {
  contentStatusInfo,
  CONTENT_STATUS_OPTIONS,
  publishStatusInfo,
  APPROVED_INTERNAL,
  CLIENT_BLOCKED,
} from "../config/contentStatus";
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

// ---------- publish readiness (mirrors backend publishSync) ----------

const PLAT_NAME = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn" };

const readinessOf = (p) => {
  const missing = [];
  if (!APPROVED_INTERNAL.has((p.status || "").toLowerCase())) missing.push("aprobación interna");
  if (CLIENT_BLOCKED.has((p.client_status || "").toLowerCase())) missing.push("aprobación del cliente");
  if (!(p.copy_out || p.copy_in || "").trim()) missing.push("copy");
  if ((p.platform || "").toLowerCase() === "instagram" && !(p.arte || "").trim()) missing.push("arte");
  if (!p.scheduled_date) missing.push("fecha");
  if (!p.has_account) missing.push(`cuenta de ${PLAT_NAME[(p.platform || "").toLowerCase()] || "la plataforma"} conectada`);
  return { ready: missing.length === 0, missing };
};

// Map the canonical publish tone → this surface's Calendar.css variant.
const PUBLISH_VARIANT = { queued: "accent", active: "accent", success: "published", failed: "failed", muted: "draft" };
const publishMeta = (s) => {
  const info = publishStatusInfo(s);
  return info ? { label: info.label, variant: PUBLISH_VARIANT[info.tone] } : null;
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

  const customerName = useCallback(
    (post) => post.customer_name || customers.find((c) => c.id === post.customer_id)?.business_name || "Cliente",
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
  const EDIT_FIELDS = ["platform", "content_type", "campaign", "pilar", "idea_tema", "referencia", "copy_in", "copy_out", "assigned_designer", "assigned_community_manager"];

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

  const PostChip = ({ post }) => {
    const { variant } = statusInfo(post.status);
    return (
      <button className={`zxc-post v-${variant}`} onClick={() => setSelected(post)}>
        <div className="top">
          <span>{[postTime(post), platAbbr(post.platform)].filter(Boolean).join(" · ")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {post.publish_status === "scheduled" && <i className="zxc-qdot" title="En cola de publicación" />}
            {post.publish_status === "failed" && <i className="zxc-qdot fail" title="Falló la publicación" />}
            {statusInfo(post.status).label}
          </span>
        </div>
        <div className="title">{postTitle(post)}</div>
        <div className="client">{customerName(post)}</div>
      </button>
    );
  };

  const WeekView = () => {
    const days = weekDays(anchor);
    return (
      <div className="zxc-grid-wrap">
        <div className="zxc-week">
          {days.map((d) => (
            <div key={"h" + dayKey(d)} className={`zxc-dayhead${isSameDay(d, today) ? " today" : ""}`}>
              {DAYS_ES[d.getDay()]} {d.getDate()}{isSameDay(d, today) ? " · Hoy" : ""}
            </div>
          ))}
          {days.map((d) => {
            const list = byDay[dayKey(d)] || [];
            return (
              <div key={"c" + dayKey(d)} className={`zxc-daycell${isSameDay(d, today) ? " today" : ""}`}>
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
            <div key={"mh" + d} className="zxc-dayhead">{d}</div>
          ))}
          {cells.map((d) => {
            const list = byDay[dayKey(d)] || [];
            const inMonth = d.getMonth() === anchor.getMonth();
            return (
              <div key={"m" + dayKey(d)} className={`zxc-mcell${inMonth ? "" : " dim"}${isSameDay(d, today) ? " today" : ""}`}>
                <span className="num">{d.getDate()}</span>
                {list.slice(0, 3).map((p) => (
                  <button key={p.id} className={`zxc-mpost v-${statusInfo(p.status).variant}`} onClick={() => setSelected(p)} title={postTitle(p)}>
                    {postTime(p) ? postTime(p) + " " : ""}{postTitle(p)}
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
      <div className="zxc">
        <div className="zxc-inner">
          {/* Header */}
          <div className="zxc-head">
            <div>
              <div className="zxc-eyebrow">Contenido</div>
              <h1 className="zxc-h1">Calendario <span className="zxc-serif">de contenido</span></h1>
            </div>
            <div className="zxc-controls">
              <div className="zxc-seg">
                <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Semana</button>
                <button className={view === "month" ? "on" : ""} onClick={() => setView("month")}>Mes</button>
              </div>
              <div className="zxc-nav">
                <button className="zxc-iconbtn" onClick={() => shift(-1)} aria-label="Anterior">←</button>
                <span className="range" onClick={goToday} style={{ cursor: "pointer" }} title="Ir a hoy">{rangeLabel(view, anchor)}</span>
                <button className="zxc-iconbtn" onClick={() => shift(1)} aria-label="Siguiente">→</button>
              </div>
              <button className="zxc-btn-solid" onClick={() => openCreate(null)}>+ Nueva publicación</button>
            </div>
          </div>

          {/* Client filter chips */}
          <div className="zxc-chips">
            <button className={`zxc-chip${customerFilter === "all" ? " on" : ""}`} onClick={() => setCustomerFilter("all")}>
              Todos los clientes
            </button>
            {customers.map((c) => (
              <button
                key={c.id}
                className={`zxc-chip${String(customerFilter) === String(c.id) ? " on" : ""}`}
                onClick={() => setCustomerFilter(c.id)}
              >
                {c.business_name || c.commercial_name || `Cliente ${c.id}`}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="zxc-empty">Cargando calendario…</div>
          ) : posts.length === 0 ? (
            <div className="zxc-empty">Sin publicaciones en este período. Usa “+ Nueva publicación” para empezar.</div>
          ) : view === "week" ? (
            <WeekView />
          ) : (
            <MonthView />
          )}

          {/* Legend */}
          <div className="zxc-legend">
            <span><i className="zxc-swatch" style={{ background: "#04111A" }} /> Publicado</span>
            <span><i className="zxc-swatch" style={{ background: "#F2F3F1", borderLeft: "3px solid #04111A" }} /> Aprobado / revisión</span>
            <span><i className="zxc-swatch" style={{ border: "1px dashed rgba(4,17,26,0.4)" }} /> En diseño / planificado</span>
            <span><i className="zxc-swatch" style={{ background: "#F2F3F1", borderLeft: "3px solid #8A1C1C" }} /> Fallida</span>
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
                {!editing && <button className="zxc-btn-ghost" onClick={openEdit}>Editar</button>}
                <button className="zxc-x" onClick={() => { setSelected(null); setEditing(false); }} aria-label="Cerrar">×</button>
              </div>
            </div>
            <div className="zxc-drawer-body">
              <div className={`zxc-pill v-${statusInfo(selected.status).variant}`} style={{ alignSelf: "flex-start" }}>
                {statusInfo(selected.status).label}
              </div>
              <h3>{postTitle(selected)}</h3>

              <div className="zxc-field">
                <span className="k">Cliente</span>
                <span className="val">{customerName(selected)}</span>
              </div>
              <div className="zxc-field">
                <span className="k">Programado</span>
                <span className="val">
                  {(() => {
                    const dk = postDayKey(selected);
                    const [y, m, day] = dk.split("-").map(Number);
                    const t = postTime(selected);
                    return `${day} ${MONTHS_ES[(m || 1) - 1]} ${y}${t ? ` · ${t}` : ""}`;
                  })()}
                </span>
              </div>
              {editing ? (
                <>
                  <div className="zxc-row2">
                    <div className="zxc-field">
                      <span className="k">Plataforma</span>
                      <select className="zxc-select" value={editForm.platform || ""} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}>
                        {PLATFORMS.map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                      </select>
                    </div>
                    <div className="zxc-field">
                      <span className="k">Formato</span>
                      <select className="zxc-select" value={editForm.content_type || ""} onChange={(e) => setEditForm({ ...editForm, content_type: e.target.value })}>
                        {CONTENT_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="zxc-row2">
                    <div className="zxc-field">
                      <span className="k">Campaña</span>
                      <input className="zxc-input" type="text" value={editForm.campaign || ""} onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })} />
                    </div>
                    <div className="zxc-field">
                      <span className="k">Pilar</span>
                      <input className="zxc-input" type="text" value={editForm.pilar || ""} onChange={(e) => setEditForm({ ...editForm, pilar: e.target.value })} />
                    </div>
                  </div>
                  <div className="zxc-field">
                    <span className="k">Idea / tema</span>
                    <input className="zxc-input" type="text" value={editForm.idea_tema || ""} onChange={(e) => setEditForm({ ...editForm, idea_tema: e.target.value })} />
                  </div>
                  <div className="zxc-field">
                    <span className="k">Referencia</span>
                    <input className="zxc-input" type="text" value={editForm.referencia || ""} onChange={(e) => setEditForm({ ...editForm, referencia: e.target.value })} />
                  </div>
                  <div className="zxc-field">
                    <span className="k">Copy in (brief)</span>
                    <textarea className="zxc-input" rows={2} value={editForm.copy_in || ""} onChange={(e) => setEditForm({ ...editForm, copy_in: e.target.value })} />
                  </div>
                  <div className="zxc-field">
                    <span className="k">Copy out (publicación)</span>
                    <textarea className="zxc-input" rows={3} value={editForm.copy_out || ""} onChange={(e) => setEditForm({ ...editForm, copy_out: e.target.value })} />
                  </div>
                  <div className="zxc-row2">
                    <div className="zxc-field">
                      <span className="k">Diseñador</span>
                      <select className="zxc-select" value={editForm.assigned_designer || ""} onChange={(e) => setEditForm({ ...editForm, assigned_designer: e.target.value })}>
                        <option value="">Sin asignar</option>
                        {designers.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
                      </select>
                    </div>
                    <div className="zxc-field">
                      <span className="k">Community manager</span>
                      <select className="zxc-select" value={editForm.assigned_community_manager || ""} onChange={(e) => setEditForm({ ...editForm, assigned_community_manager: e.target.value })}>
                        <option value="">Sin asignar</option>
                        {cms.map((e) => <option key={e.id} value={e.id}>{e.name || e.full_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="zxc-pub" style={{ marginTop: 4 }}>
                    <button className="zxc-btn-solid" disabled={saving} onClick={saveEdit}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                    <button className="zxc-btn-ghost" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
                  </div>
                </>
              ) : (
              <>
              {selected.campaign && (
                <div className="zxc-field"><span className="k">Campaña</span><span className="val">{selected.campaign}</span></div>
              )}
              {selected.pilar && (
                <div className="zxc-field"><span className="k">Pilar</span><span className="val">{selected.pilar}</span></div>
              )}
              {(selected.designer_name || selected.cm_name) && (
                <div className="zxc-field">
                  <span className="k">Equipo</span>
                  <span className="val">{[selected.designer_name && `Diseño: ${selected.designer_name}`, selected.cm_name && `CM: ${selected.cm_name}`].filter(Boolean).join(" · ")}</span>
                </div>
              )}
              {selected.copy_out && (
                <div className="zxc-field"><span className="k">Copy</span><span className="val copy">{selected.copy_out}</span></div>
              )}

              <div className="zxc-field">
                <span className="k">Cambiar estado</span>
                <select
                  className="zxc-select"
                  value={STATUS_OPTIONS.find((o) => o.value === (selected.status || "").toLowerCase())?.value || ""}
                  onChange={(e) => updateStatus(selected, e.target.value)}
                >
                  <option value="" disabled>Selecciona…</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Client sign-off (per-post approval link) */}
              <div className="zxc-field">
                <span className="k">Cliente</span>
                <div className="zxc-pub">
                  {selected.client_status === "approved" && <span className="zxc-pill v-published">Aprobado por cliente</span>}
                  {["changes_requested", "rejected", "rechazado"].includes((selected.client_status || "").toLowerCase()) && (
                    <span className="zxc-pill v-failed">Cambios solicitados</span>
                  )}
                  <button className="zxc-btn-ghost" disabled={busy} onClick={() => sendToClient(selected)}>
                    {clientLinkFor?.id === selected.id ? "Enlace copiado ✓" : "Enviar a cliente"}
                  </button>
                  {clientLinkFor?.id === selected.id && (
                    <input className="zxc-input" readOnly value={clientLinkFor.url} onFocus={(e) => e.target.select()} />
                  )}
                </div>
              </div>

              {/* Publish (plan → queue) */}
              <div className="zxc-field">
                <span className="k">Publicación</span>
                {(() => {
                  const pm = publishMeta(selected.publish_status);
                  if (pm) {
                    return (
                      <div className="zxc-pub">
                        <span className={`zxc-pill v-${pm.variant}`}>{pm.label}</span>
                        {selected.publish_status === "failed" && selected.publish_error && (
                          <div className="zxc-pub-err">⚠ {selected.publish_error}</div>
                        )}
                        {selected.publish_status === "scheduled" && (
                          <button className="zxc-btn-ghost" disabled={busy} onClick={() => unschedulePost(selected)}>
                            Quitar de la cola
                          </button>
                        )}
                        {selected.publish_status === "failed" && readinessOf(selected).ready && (
                          <button className="zxc-btn-solid" disabled={busy} onClick={() => schedulePost(selected)}>
                            {busy ? "Reintentando…" : "Reintentar"}
                          </button>
                        )}
                      </div>
                    );
                  }
                  const rd = readinessOf(selected);
                  return rd.ready ? (
                    <button className="zxc-btn-solid" disabled={busy} onClick={() => schedulePost(selected)}>
                      {busy ? "Programando…" : "Programar publicación"}
                    </button>
                  ) : (
                    <div className="zxc-missing">
                      <span>Falta para publicar:</span>
                      <ul>{rd.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                    </div>
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
              <div className="zxc-field">
                <span className="k">Cliente</span>
                <select className="zxc-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
                  <option value="">Selecciona un cliente…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.business_name || c.commercial_name || `Cliente ${c.id}`}</option>
                  ))}
                </select>
              </div>
              <div className="zxc-row2">
                <div className="zxc-field">
                  <span className="k">Fecha y hora</span>
                  <input className="zxc-input" type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} required />
                </div>
                <div className="zxc-field">
                  <span className="k">Estado</span>
                  <select className="zxc-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="zxc-row2">
                <div className="zxc-field">
                  <span className="k">Plataforma</span>
                  <select className="zxc-select" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{capitalize(p)}</option>)}
                  </select>
                </div>
                <div className="zxc-field">
                  <span className="k">Formato</span>
                  <select className="zxc-select" value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
                  </select>
                </div>
              </div>
              <div className="zxc-field">
                <span className="k">Idea / tema</span>
                <input className="zxc-input" type="text" value={form.idea_tema} onChange={(e) => setForm({ ...form, idea_tema: e.target.value })} placeholder="p. ej. Promo verano 2×1" />
              </div>
              <div className="zxc-field">
                <span className="k">Campaña (opcional)</span>
                <input className="zxc-input" type="text" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
              </div>
            </div>
            <div className="zxc-modal-foot">
              <button type="button" className="zxc-btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button type="submit" className="zxc-btn-solid" disabled={saving}>{saving ? "Guardando…" : "Crear publicación"}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default ContentPlanningCenter;
