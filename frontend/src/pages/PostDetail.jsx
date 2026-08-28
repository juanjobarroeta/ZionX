import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import PageShell from "../components/PageShell";
import { API_BASE_URL } from "../utils/constants";
import { STAGE_LABELS, STATUS_LABELS, STATUS_VARIANT } from "../config/pipeline";
import { contentStatusInfo, publishStatusInfo } from "../config/contentStatus";
import "./PostDetail.css";

/**
 * One post, its whole life.
 *
 * The pieces of a post used to live on five pages — the idea on the calendar,
 * the approval in the queue, the publication in the hub, the numbers in
 * Rendimiento — so moving one post meant finding it again on each. This is the
 * page the rest of them link to.
 */

const CLIENT_STATE = {
  pending: { label: "Esperando al cliente", tone: "warn" },
  approved: { label: "Aprobado por el cliente", tone: "ok" },
  changes_requested: { label: "Cambios del cliente", tone: "bad" },
};

const fmtDate = (d, time) => {
  if (!d) return "Sin fecha";
  const date = new Date(`${String(d).slice(0, 10)}T${(time || "00:00").slice(0, 5)}`);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    + (time ? ` · ${String(time).slice(0, 5)}` : "");
};

const num = (n) => (n == null ? "—" : Number(n).toLocaleString("es-MX"));

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  const load = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API_BASE_URL}/content-calendar/${id}`, { headers });
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.response?.status === 404
        ? "Esta publicación no existe o se eliminó."
        : "No se pudo cargar la publicación.");
    } finally {
      setLoading(false);
    }
  }, [id, headers]);

  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, msg) => {
    setBusy(key); setNote(null);
    try {
      await fn();
      setNote({ tone: "ok", text: msg });
      await load();
    } catch (e) {
      setNote({ tone: "bad", text: e.response?.data?.error || e.response?.data?.message || "No se pudo completar." });
    } finally {
      setBusy(null);
    }
  };

  const setStage = (stage, status) => act(
    `stage-${stage.id}`,
    () => axios.patch(`${API_BASE_URL}/content-calendar/${id}/pipeline/${stage.stage_key}`, { status }, { headers }),
    status === "listo" ? `${STAGE_LABELS[stage.stage_key] || stage.stage_key}: listo.` : "Etapa actualizada."
  );

  const sendToClient = () => act(
    "client",
    async () => {
      const { data: r } = await axios.post(`${API_BASE_URL}/api/approvals/generate-post-link`,
        { content_calendar_id: Number(id) }, { headers });
      if (r?.url || r?.link) await navigator.clipboard?.writeText(r.url || r.link).catch(() => {});
    },
    "Liga de aprobación creada y copiada."
  );

  if (loading) {
    return <PageShell eyebrow="Publicación" title="Cargando" titleAccent="…">
      <div className="zxpd-loading">Cargando la publicación…</div>
    </PageShell>;
  }

  if (error) {
    return <PageShell eyebrow="Publicación" title="No" titleAccent="disponible">
      <div className="zxpd-empty">
        <div className="lead">{error}</div>
        <button className="zxpd-btn" onClick={() => navigate("/content-calendar")}>Volver al calendario</button>
      </div>
    </PageShell>;
  }

  const { post, stages, publication, metrics } = data;
  const state = contentStatusInfo(post.status);
  const pub = publication ? publishStatusInfo(publication.status) : null;
  const client = CLIENT_STATE[post.client_status] || null;
  const mine = stages.filter((s) => s.ready && s.status !== "listo");
  const arte = Array.isArray(post.arte_files) ? post.arte_files : [];
  const cover = arte[0]?.url || arte[0]?.path || post.arte || null;

  return (
    <PageShell
      eyebrow={`${post.customer_name} · ${post.platform || "—"} · ${post.content_type || "post"}`}
      title={post.title || post.idea_tema || "Publicación"}
      titleAccent=""
      actions={
        <>
          <button className="zx-btn" onClick={() => navigate(`/content-calendar?customer=${post.customer_id}`)}>
            Ver calendario
          </button>
          {publication && (
            <Link className="zx-btn" to="/social-hub">Ver en el hub</Link>
          )}
        </>
      }
      telemetry={[
        { k: "Estado", v: state.label },
        { k: "Programado", v: fmtDate(post.scheduled_date, post.scheduled_time) },
        { k: "Etapas listas", v: `${stages.filter((s) => s.status === "listo").length}/${stages.length}` },
        ...(client ? [{ k: "Cliente", v: client.label, tone: client.tone === "bad" ? "crit" : undefined }] : []),
      ]}
    >
      {note && <div className={`zxpd-note ${note.tone}`}>{note.text}</div>}

      {/* ---- The work: what it looks like and what it says ---- */}
      <section className="zxpd-work">
        <div className="zxpd-art">
          {cover
            ? <img src={cover} alt="Arte de la publicación" />
            : <div className="zxpd-art-empty">Sin arte todavía</div>}
        </div>

        <div className="zxpd-side">
          <div className="zxpd-block">
            <h2 className="zxpd-h2">La idea</h2>
            {post.pilar && <div className="zxpd-kv"><span>Pilar</span><b>{post.pilar}</b></div>}
            {post.idea_tema && <p className="zxpd-text">{post.idea_tema}</p>}
            {post.referencia && (
              <a className="zxpd-link" href={post.referencia} target="_blank" rel="noreferrer">
                Referencia →
              </a>
            )}
            {!post.pilar && !post.idea_tema && !post.referencia && (
              <p className="zxpd-muted">Nadie ha escrito la idea todavía.</p>
            )}
          </div>

          <div className="zxpd-block">
            <h2 className="zxpd-h2">El copy</h2>
            {post.copy_out || post.copy_in
              ? <p className="zxpd-copy">{post.copy_out || post.copy_in}</p>
              : <p className="zxpd-muted">Sin copy todavía.</p>}
            {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
              <div className="zxpd-tags">{post.hashtags.map((h) => <span key={h}>#{String(h).replace(/^#/, "")}</span>)}</div>
            )}
          </div>
        </div>
      </section>

      {/* ---- The ladder ---- */}
      <section className="zxpd-block wide">
        <h2 className="zxpd-h2">
          Producción
          {mine.length > 0 && <span className="zxpd-h2-sub">{mine.length} en tus manos ahora</span>}
        </h2>

        <ol className="zxpd-ladder">
          {stages.map((s) => {
            const done = s.status === "listo";
            return (
              <li key={s.id} className={`zxpd-rung ${done ? "done" : ""} ${s.ready && !done ? "now" : ""}`}>
                <span className="dot" aria-hidden="true" />
                <div className="body">
                  <div className="name">
                    {STAGE_LABELS[s.stage_key] || s.stage_key}
                    {s.optional && <span className="opt">opcional</span>}
                  </div>
                  <div className="meta">
                    <span className={`zxpd-pill v-${STATUS_VARIANT[s.status] || "muted"}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                    <span className="owner">{s.owner_name || "Sin dueño"}</span>
                    {!s.ready && !done && <span className="blocked">espera etapas previas</span>}
                  </div>
                </div>
                {s.ready && !done && (
                  <div className="act">
                    {s.status !== "en_progreso" && (
                      <button className="zxpd-btn" disabled={busy === `stage-${s.id}`}
                        onClick={() => setStage(s, "en_progreso")}>Empezar</button>
                    )}
                    <button className="zxpd-btn solid" disabled={busy === `stage-${s.id}`}
                      onClick={() => setStage(s, "listo")}>
                      {busy === `stage-${s.id}` ? "…" : "Marcar listo"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ---- The client ---- */}
      <section className="zxpd-block wide">
        <h2 className="zxpd-h2">El cliente</h2>
        {client
          ? <div className={`zxpd-state v-${client.tone}`}>{client.label}</div>
          : <p className="zxpd-muted">Todavía no se le ha enviado.</p>}

        {post.client_feedback_text && (
          <blockquote className="zxpd-quote">{post.client_feedback_text}</blockquote>
        )}
        {post.client_reviewed_at && (
          <div className="zxpd-muted small">Respondió el {fmtDate(post.client_reviewed_at)}</div>
        )}

        <div className="zxpd-actions">
          <button className="zxpd-btn solid" onClick={sendToClient} disabled={busy === "client"}>
            {busy === "client" ? "Creando…" : post.client_status ? "Nueva liga de aprobación" : "Enviar al cliente"}
          </button>
        </div>
      </section>

      {/* ---- The publication ---- */}
      <section className="zxpd-block wide">
        <h2 className="zxpd-h2">La publicación</h2>
        {publication ? (
          <>
            <div className="zxpd-kv"><span>Cuenta</span><b>@{publication.account_username || publication.account_name || "—"}</b></div>
            <div className="zxpd-kv"><span>Estado</span><b>{pub?.label || publication.status}</b></div>
            <div className="zxpd-kv"><span>{publication.published_at ? "Publicada" : "Programada"}</span>
              <b>{fmtDate(publication.published_at || publication.scheduled_for)}</b></div>
            {publication.error_message && (
              <div className="zxpd-fail">
                {publication.error_message}
                {publication.retry_count > 0 && <span> · {publication.retry_count} intento(s)</span>}
              </div>
            )}
            {publication.platform_post_url && (
              <a className="zxpd-link" href={publication.platform_post_url} target="_blank" rel="noreferrer">
                Verla en {publication.platform || "la red"} →
              </a>
            )}
          </>
        ) : (
          <p className="zxpd-muted">No está en la cola de publicación todavía.</p>
        )}
      </section>

      {/* ---- How it did ---- */}
      {metrics && (
        <section className="zxpd-block wide">
          <h2 className="zxpd-h2">Cómo le fue</h2>
          <div className="zxpd-metrics">
            {[
              ["Vistas", metrics.views], ["Alcance", metrics.reach],
              ["Me gusta", metrics.likes], ["Comentarios", metrics.comments],
              ["Guardados", metrics.saves], ["Interacciones", metrics.total_interactions],
            ].map(([k, v]) => (
              <div className="m" key={k}><span>{k}</span><b>{num(v)}</b></div>
            ))}
          </div>
          <div className="zxpd-muted small">
            Último corte: {fmtDate(metrics.snapshot_date)} · <Link className="zxpd-link" to="/social-analytics">Rendimiento</Link>
          </div>
        </section>
      )}
    </PageShell>
  );
}
