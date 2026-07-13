import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import { contentStatusInfo } from "../config/contentStatus";
import { STAGE_LABELS, STATUS_LABELS, STATUS_VARIANT } from "../config/pipeline";
import "./MyWork.css";

// Per-person home. Two lenses on the production pipeline:
//   1. Cola de producción — the stages the person owns and must move.
//   2. Todo mi contenido — every post they're attached to, by workflow status.
// Seniors also get a supervision panel: where their team's posts stand.

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "Sin fecha");
const platLabel = (p) => cap(p) || "Contenido";
const postTitle = (it) => it.campaign || it.idea_tema || it.title || "Sin título";

const ROLE_LABEL = { designer: "Diseño", cm: "CM", approver: "Aprobar" };

// -------- pipeline queue bucketing --------
// Order matters: most-urgent bucket first.
const QUEUE_BUCKETS = [
  { key: "cambios", title: "Cambios pedidos", cls: "bad" },
  { key: "en_progreso", title: "En progreso", cls: "warn" },
  { key: "ready", title: "Por empezar", cls: "ok" },
  { key: "blocked", title: "En espera de etapas previas", cls: "muted" },
];

const queueBucketOf = (stage) => {
  if (stage.status === "cambios") return "cambios";
  if (stage.status === "en_progreso") return "en_progreso";
  return stage.ready ? "ready" : "blocked";
};

// -------- legacy content bucketing (overall workflow status) --------
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
  const [state, setState] = useState({ loading: true, items: [], memberId: undefined, error: null });
  const [queue, setQueue] = useState({ loading: true, items: [] });
  const [supervision, setSupervision] = useState({ loading: true, items: [] });
  const [busyStage, setBusyStage] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const userName = localStorage.getItem("userName") || "";
  const firstName = userName.split(" ")[0] || "";

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/team/my-work`, { headers })
      .then((r) => setState({ loading: false, items: r.data?.items || [], memberId: r.data?.memberId ?? null, error: null }))
      .catch((e) => setState({ loading: false, items: [], memberId: null, error: e.response?.data?.message || e.message }));

    axios.get(`${API_BASE_URL}/pipeline/my-queue`, { headers })
      .then((r) => setQueue({ loading: false, items: r.data?.items || [] }))
      .catch(() => setQueue({ loading: false, items: [] }));

    axios.get(`${API_BASE_URL}/pipeline/supervision`, { headers })
      .then((r) => setSupervision({ loading: false, items: r.data?.items || [] }))
      .catch(() => setSupervision({ loading: false, items: [] }));
  }, [headers]);

  const groupedQueue = useMemo(() => {
    const g = { cambios: [], en_progreso: [], ready: [], blocked: [] };
    for (const s of queue.items) g[queueBucketOf(s)].push(s);
    return g;
  }, [queue.items]);

  const grouped = useMemo(() => {
    const g = { action: [], waiting: [], scheduled: [], done: [] };
    for (const it of state.items) g[bucketOf(it)].push(it);
    return g;
  }, [state.items]);

  const actionable = groupedQueue.cambios.length + groupedQueue.en_progreso.length + groupedQueue.ready.length;

  const openHref = (item) =>
    item.roles.includes("approver") && bucketOf(item) === "action"
      ? "/approvals"
      : `/content-calendar?customer=${item.customer_id}`;

  // Advance one of my stages right from here. Completing (listo) auto-advances
  // the next stage on the backend, so we refetch the queue + supervision after.
  const patchMyStage = async (stage, status) => {
    setBusyStage(stage.id);
    try {
      await axios.patch(
        `${API_BASE_URL}/content-calendar/${stage.post_id}/pipeline/${stage.stage_key}`,
        { status },
        { headers }
      );
      const [q, sup] = await Promise.all([
        axios.get(`${API_BASE_URL}/pipeline/my-queue`, { headers }).catch(() => ({ data: { items: [] } })),
        axios.get(`${API_BASE_URL}/pipeline/supervision`, { headers }).catch(() => ({ data: { items: [] } })),
      ]);
      setQueue({ loading: false, items: q.data?.items || [] });
      setSupervision({ loading: false, items: sup.data?.items || [] });
    } catch {
      /* keep UI responsive; a failed write just no-ops */
    } finally {
      setBusyStage(null);
    }
  };

  // -------- pipeline queue card --------
  const QueueCard = ({ stage }) => {
    const busy = busyStage === stage.id;
    return (
      <div className="zxw-card">
        <div className="top">
          <span className="plat">{platLabel(stage.platform)} · {cap(stage.content_type) || "Post"}</span>
          <span className={`zxw-pill v-${STATUS_VARIANT[stage.status] || "muted"}`}>
            {STATUS_LABELS[stage.status] || stage.status}
          </span>
        </div>
        <div className="title">{postTitle(stage)}</div>
        <div className="client">{stage.customer_name || "—"}</div>
        <div className="foot">
          <span className="date">{fmtDate(stage.scheduled_date)}</span>
          <span className="zxw-roles">
            <span className="zxw-role stage">{STAGE_LABELS[stage.stage_key] || stage.stage_key}</span>
          </span>
        </div>
        <div className="zxw-card-actions">
          <button className="zxw-act primary" disabled={busy} onClick={() => patchMyStage(stage, "listo")}>
            {busy ? "…" : "Marcar listo"}
          </button>
          {stage.status === "en_progreso" ? (
            <button className="zxw-act" disabled={busy} onClick={() => patchMyStage(stage, "cambios")}>Pedir cambios</button>
          ) : (
            <button className="zxw-act" disabled={busy} onClick={() => patchMyStage(stage, "en_progreso")}>Empezar</button>
          )}
          <Link className="zxw-act link" to={`/content-calendar?customer=${stage.customer_id}`}>Ver</Link>
        </div>
      </div>
    );
  };

  // -------- supervision row --------
  const SupervisionRow = ({ post }) => {
    const needsMe = post.current_stage === "internal_approval";
    const stuck = post.current_status === "cambios";
    return (
      <Link
        className={`zxw-sup-row${stuck ? " stuck" : ""}${needsMe ? " mine" : ""}`}
        to={`/content-calendar?customer=${post.customer_id}`}
      >
        <div className="zxw-sup-main">
          <div className="zxw-sup-title">{postTitle(post)}</div>
          <div className="zxw-sup-meta">{post.customer_name || "—"} · {platLabel(post.platform)} · {fmtDate(post.scheduled_date)}</div>
        </div>
        <div className="zxw-sup-stage">
          <span className="zxw-sup-stagename">{STAGE_LABELS[post.current_stage] || post.current_stage}</span>
          <span className="zxw-sup-owner">{post.current_owner_name || "Sin asignar"}</span>
        </div>
        <span className={`zxw-pill v-${STATUS_VARIANT[post.current_status] || "muted"}`}>
          {STATUS_LABELS[post.current_status] || post.current_status}
        </span>
      </Link>
    );
  };

  const Card = ({ item }) => {
    const st = contentStatusInfo(item.status);
    return (
      <Link className="zxw-card" to={openHref(item)}>
        <div className="top">
          <span className="plat">{platLabel(item.platform)} · {cap(item.content_type) || "Post"}</span>
          <span className={`zxw-pill v-${st.variant}`}>{st.label}</span>
        </div>
        <div className="title">{item.campaign || item.idea_tema || "Sin título"}</div>
        <div className="client">{item.customer_name || "—"}{item.current_revision > 1 ? ` · Rev. #${item.current_revision}` : ""}</div>
        {item.rejection_reason && bucketOf(item) === "action" && (
          <div className="reject">{item.rejection_reason.slice(0, 130)}</div>
        )}
        <div className="foot">
          <span className="date">{fmtDate(item.scheduled_date)}</span>
          <span className="zxw-roles">
            {item.roles.map((r) => <span key={r} className="zxw-role">{ROLE_LABEL[r] || r}</span>)}
          </span>
        </div>
      </Link>
    );
  };

  const hasQueue = queue.items.length > 0;
  const hasSupervision = supervision.items.length > 0;
  const nothingAtAll =
    !state.loading && !queue.loading && !supervision.loading &&
    state.items.length === 0 && !hasQueue && !hasSupervision;

  return (
    <Layout>
      <div className="zxw">
        <div className="zxw-inner">
          <div className="zxw-head">
            <div className="eyebrow">Tu día</div>
            <h1>Mi <span className="zxw-serif">trabajo</span></h1>
            <div className="greet">{firstName ? `Hola, ${firstName}. ` : ""}Todo lo que está en tus manos, en un solo lugar.</div>
          </div>

          {state.loading && queue.loading ? (
            <div className="zxw-loading">Cargando tu trabajo…</div>
          ) : nothingAtAll ? (
            <div className="zxw-empty">
              <div className="lead">No tienes trabajo asignado</div>
              <div>Cuando te asignen etapas de producción o contenido, aparecerán aquí.</div>
            </div>
          ) : (
            <>
              {/* ---- Personal production queue ---- */}
              {hasQueue && (
                <section className="zxw-section">
                  <div className="zxw-tiles">
                    <div className="zxw-tile bad"><span className="v">{groupedQueue.cambios.length}</span><span className="k">Cambios</span></div>
                    <div className="zxw-tile warn"><span className="v">{groupedQueue.en_progreso.length}</span><span className="k">En progreso</span></div>
                    <div className="zxw-tile ok"><span className="v">{groupedQueue.ready.length}</span><span className="k">Por empezar</span></div>
                    <div className="zxw-tile muted"><span className="v">{groupedQueue.blocked.length}</span><span className="k">En espera</span></div>
                  </div>

                  <div className="zxw-section-head">
                    <h2>Tu cola de <span className="zxw-serif">producción</span></h2>
                    <span className="zxw-section-sub">{actionable} etapa{actionable === 1 ? "" : "s"} en tus manos ahora</span>
                  </div>

                  {QUEUE_BUCKETS.map((b) =>
                    groupedQueue[b.key].length > 0 ? (
                      <div className={`zxw-group ${b.cls}`} key={b.key}>
                        <div className="zxw-group-head">
                          <span className="dot" />
                          <h3>{b.title}</h3>
                          <span className="count">{groupedQueue[b.key].length}</span>
                          <span className="stripe" />
                        </div>
                        <div className="zxw-cards">
                          {groupedQueue[b.key].map((s) => <QueueCard key={s.id} stage={s} />)}
                        </div>
                      </div>
                    ) : null
                  )}
                </section>
              )}

              {/* ---- Supervision (seniors) ---- */}
              {hasSupervision && (
                <section className="zxw-section">
                  <div className="zxw-section-head">
                    <h2>Supervisión de <span className="zxw-serif">equipo</span></h2>
                    <span className="zxw-section-sub">{supervision.items.length} publicacion{supervision.items.length === 1 ? "" : "es"} en curso en tus clientes</span>
                  </div>
                  <div className="zxw-sup-list">
                    {supervision.items.map((p) => <SupervisionRow key={p.post_id} post={p} />)}
                  </div>
                </section>
              )}

              {/* ---- All my content, by workflow status ---- */}
              {state.items.length > 0 && (
                <section className="zxw-section">
                  <div className="zxw-section-head">
                    <h2>Todo mi <span className="zxw-serif">contenido</span></h2>
                    <span className="zxw-section-sub">Estado general del contenido asignado a ti</span>
                  </div>
                  {GROUPS.map((grp) =>
                    grouped[grp.key].length > 0 ? (
                      <div className={`zxw-group ${grp.cls}`} key={grp.key}>
                        <div className="zxw-group-head">
                          <span className="dot" />
                          <h3>{grp.title}</h3>
                          <span className="count">{grouped[grp.key].length}</span>
                          <span className="stripe" />
                        </div>
                        <div className="zxw-cards">
                          {grouped[grp.key].map((it) => <Card key={it.id} item={it} />)}
                        </div>
                      </div>
                    ) : null
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyWork;
