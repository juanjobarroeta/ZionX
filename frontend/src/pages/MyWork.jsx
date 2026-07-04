import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { contentStatusInfo } from "../config/contentStatus";
import "./MyWork.css";

// Per-person home. Shows the logged-in person's own content — the posts where
// they are the designer, community manager, or approver — bucketed by what they
// need to do, so a creator finally lands somewhere scoped to them.

const PLATFORM_ICON = { instagram: "📸", facebook: "👍", tiktok: "🎵", linkedin: "💼", twitter: "𝕏", youtube: "▶️" };
const platIcon = (p) => PLATFORM_ICON[(p || "").toLowerCase()] || "📱";
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Sin fecha");

const ROLE_LABEL = { designer: "Diseño", cm: "CM", approver: "Aprobar" };

// Decide which bucket an item belongs to, from the caller's perspective.
const bucketOf = (item) => {
  const status = (item.status || "").toLowerCase();
  const pub = (item.publish_status || "").toLowerCase();
  const appr = (item.approval_status || "").toLowerCase();
  const isApprover = item.roles.includes("approver");
  const isMaker = item.roles.includes("designer") || item.roles.includes("cm");

  if (pub === "published" || status === "publicado") return "done";
  if (pub === "scheduled" || pub === "publishing" || status === "programado") return "scheduled";
  if (isApprover && (status === "revision" || appr === "pending_review" || appr === "in_review")) return "action";
  if (isMaker && ["planificado", "en_diseño", "en diseño", "fallido"].includes(status)) return "action";
  if (["revision", "aprobado", "cliente"].includes(status)) return "waiting";
  return "action";
};

const GROUPS = [
  { key: "action", title: "Requiere tu atención", cls: "action" },
  { key: "waiting", title: "En revisión / con cliente", cls: "wait" },
  { key: "scheduled", title: "Programado", cls: "sched" },
  { key: "done", title: "Publicado", cls: "done" },
];

const MyWork = () => {
  const [state, setState] = useState({ loading: true, items: [], employeeId: undefined, error: null });
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const userName = localStorage.getItem("userName") || "";
  const firstName = userName.split(" ")[0] || "";

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/team/my-work`, { headers })
      .then((r) => setState({ loading: false, items: r.data?.items || [], employeeId: r.data?.employeeId ?? null, error: null }))
      .catch((e) => setState({ loading: false, items: [], employeeId: null, error: e.response?.data?.message || e.message }));
  }, [headers]);

  const grouped = useMemo(() => {
    const g = { action: [], waiting: [], scheduled: [], done: [] };
    for (const it of state.items) g[bucketOf(it)].push(it);
    return g;
  }, [state.items]);

  const openHref = (item) =>
    item.roles.includes("approver") && bucketOf(item) === "action"
      ? "/approvals"
      : `/content-calendar?customer=${item.customer_id}`;

  const Card = ({ item }) => {
    const st = contentStatusInfo(item.status);
    return (
      <Link className="zxw-card" to={openHref(item)}>
        <div className="top">
          <span className="plat">{platIcon(item.platform)} {cap(item.platform) || "Contenido"} · {cap(item.content_type) || "Post"}</span>
          <span className={`zxw-pill v-${st.variant}`}>{st.label}</span>
        </div>
        <div className="title">{item.campaign || item.idea_tema || "Sin título"}</div>
        <div className="client">{item.customer_name || "—"}{item.current_revision > 1 ? ` · Rev. #${item.current_revision}` : ""}</div>
        {item.rejection_reason && bucketOf(item) === "action" && (
          <div className="reject">↩️ {item.rejection_reason.slice(0, 130)}</div>
        )}
        <div className="foot">
          <span className="date">📅 {fmtDate(item.scheduled_date)}</span>
          <span className="zxw-roles">
            {item.roles.map((r) => <span key={r} className="zxw-role">{ROLE_LABEL[r] || r}</span>)}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <Layout>
      <div className="zxw">
        <div className="zxw-inner">
          <div className="zxw-head">
            <div className="eyebrow">Tu día</div>
            <h1>Mi <span className="zxw-serif">trabajo</span></h1>
            <div className="greet">{firstName ? `Hola, ${firstName}. ` : ""}Todo el contenido asignado a ti, en un solo lugar.</div>
          </div>

          {state.loading ? (
            <div className="zxw-loading">Cargando tu trabajo…</div>
          ) : state.employeeId === null && state.items.length === 0 ? (
            <div className="zxw-empty">
              <span className="big">🗂️</span>
              <div className="lead">No tienes contenido asignado</div>
              <div>Cuando te asignen posts como diseñador, community manager o aprobador, aparecerán aquí.</div>
            </div>
          ) : (
            <>
              <div className="zxw-tiles">
                <div className="zxw-tile action"><span className="v">{grouped.action.length}</span><span className="k">Por hacer</span></div>
                <div className="zxw-tile wait"><span className="v">{grouped.waiting.length}</span><span className="k">En revisión</span></div>
                <div className="zxw-tile sched"><span className="v">{grouped.scheduled.length}</span><span className="k">Programado</span></div>
                <div className="zxw-tile done"><span className="v">{grouped.done.length}</span><span className="k">Publicado</span></div>
              </div>

              {GROUPS.map((grp) =>
                grouped[grp.key].length > 0 ? (
                  <div className={`zxw-group ${grp.cls}`} key={grp.key}>
                    <div className="zxw-group-head">
                      <span className="dot" />
                      <h2>{grp.title}</h2>
                      <span className="count">{grouped[grp.key].length}</span>
                      <span className="stripe" />
                    </div>
                    <div className="zxw-cards">
                      {grouped[grp.key].map((it) => <Card key={it.id} item={it} />)}
                    </div>
                  </div>
                ) : null
              )}

              {state.items.length === 0 && (
                <div className="zxw-empty">
                  <span className="big">✅</span>
                  <div className="lead">Nada pendiente</div>
                  <div>No tienes contenido asignado ahora mismo.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyWork;
