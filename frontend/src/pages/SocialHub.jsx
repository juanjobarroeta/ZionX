import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PageShell from "../components/PageShell";
import { API_BASE_URL } from "../utils/constants";
import { publishStatusInfo } from "../config/contentStatus";
import { tMinus } from "../utils/countdown";
import "./Hub.css";

// ---------- mappings ----------
// Labels come from the canonical publish-status module; the Hub keeps its own
// pill variant + card rail + grouping (Hub.css) mapped per status value.
const HUB_STYLE = {
  scheduled: { variant: "queued", rail: "queued", group: "scheduled" },
  publishing: { variant: "queued", rail: "queued", group: "scheduled" },
  published: { variant: "published", rail: "published", group: "published" },
  failed: { variant: "failed", rail: "failed", group: "failed" },
  cancelled: { variant: "muted", rail: "muted", group: "cancelled" },
};
const statusInfo = (s) => {
  const key = (s || "").toString().toLowerCase();
  const info = publishStatusInfo(key);
  const style = HUB_STYLE[key] || { variant: "muted", rail: "muted", group: "other" };
  return { label: info?.label || s || "—", ...style };
};

const PLATFORM_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube" };
const platLabel = (p) => PLATFORM_LABEL[(p || "").toLowerCase()] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : "—");
// Dense grids get the abbreviation, the same one the calendar uses.
const PLATFORM_ABBR = { instagram: "IG", facebook: "FB", tiktok: "TIKTOK", linkedin: "LI", youtube: "YT", threads: "TH" };
const platAbbr = (p) => PLATFORM_ABBR[(p || "").toLowerCase()] || (p ? p.slice(0, 2).toUpperCase() : "—");

const VERTICAL_TYPES = new Set(["story", "reel", "video", "tiktok"]);
const isVertical = (t) => VERTICAL_TYPES.has((t || "").toLowerCase());
const typeLabel = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Post");

const mediaUrl = (post) => {
  const u = Array.isArray(post.media_urls) ? post.media_urls[0] : null;
  if (!u) return null;
  return /^https?:\/\//.test(u) ? u : `${API_BASE_URL}${u}`;
};

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fmtDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  const day = `${d.getDate()} ${MONTHS_ES[d.getMonth()].slice(0, 3)}`;
  const time = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
  const sameDay = d.toDateString() === now.toDateString();
  return `${sameDay ? "Hoy" : day}, ${time}`;
};

// Month options: current month and the previous 5
const monthOptions = () => {
  const out = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const val = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: val, label: `${MONTHS_ES[m.getMonth()].replace(/^./, (c) => c.toUpperCase())} ${m.getFullYear()}` });
  }
  return out;
};

const SocialHub = () => {
  const navigate = useNavigate();
  const months = useMemo(monthOptions, []);
  const [posts, setPosts] = useState([]);
  const [counts, setCounts] = useState({ scheduled: 0, published: 0, failed: 0, total: 0 });
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [month, setMonth] = useState(months[0].value);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/customers`, { headers })
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, [headers]);

  const fetchHub = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month };
      if (customerFilter !== "all") params.customer_id = customerFilter;
      if (platformFilter !== "all") params.platform = platformFilter;
      const r = await axios.get(`${API_BASE_URL}/api/social/hub`, { headers, params });
      setPosts(Array.isArray(r.data?.posts) ? r.data.posts : []);
      setCounts(r.data?.counts || { scheduled: 0, published: 0, failed: 0, total: 0 });
    } catch {
      setPosts([]);
      setCounts({ scheduled: 0, published: 0, failed: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [month, customerFilter, platformFilter, headers]);

  useEffect(() => { fetchHub(); }, [fetchHub]);

  const visiblePosts = useMemo(() => {
    if (statusFilter === "all") return posts;
    return posts.filter((p) => statusInfo(p.status).group === statusFilter);
  }, [posts, statusFilter]);

  const PLATFORMS = [
    { value: "all", label: "Todas" },
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "tiktok", label: "TikTok" },
  ];
  const STATUS_CHIPS = [
    { value: "all", label: "Todos los estados" },
    { value: "scheduled", label: "Programadas" },
    { value: "published", label: "Publicadas" },
    { value: "failed", label: "Fallidas" },
  ];

  const Card = ({ post }) => {
    const st = statusInfo(post.status);
    const vertical = isVertical(post.content_type);
    const img = mediaUrl(post);
    const handle = post.account_username || post.customer_name;
    const when = fmtDateTime(post.published_at || post.scheduled_for);
    const countdown = st.group === "scheduled" ? tMinus(post.scheduled_for) : null;

    return (
      <button className={`zxh-card s-${st.rail}`} onClick={() => setSelected(post)}>
        <div className="zxh-card-top">
          <span className="zxh-card-plat">{platAbbr(post.platform)} · {typeLabel(post.content_type)}</span>
          <span className={`zx-pill v-${st.variant}`}>{st.label}</span>
        </div>
        <div className={`zxh-media ${vertical ? "r916" : "r11"}`}>
          {img ? (
            <img src={img} alt="" />
          ) : (
            <>
              <span className="stripes" />
              {handle && (
                <span className="handle">
                  <span className="av">{(handle[0] || "?").toUpperCase()}</span>
                  <span className="nm">{handle}</span>
                </span>
              )}
              <span className="ph">{vertical ? "9:16" : "1:1"}</span>
              {post.message && <span className="cap">{post.message}</span>}
            </>
          )}
        </div>
        <div className="zxh-card-body">
          <span className="zxh-card-client">{post.customer_name || "Sin cliente"}</span>
          {st.group === "failed" ? (
            <span className="zxh-card-err">{post.error_message || "Falló la publicación"}</span>
          ) : (
            <span className="zxh-card-when">
              <span>{when}</span>
              {countdown && <span className="zx-tmin">{countdown}</span>}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <PageShell
        className="zxh"
        eyebrow="Bitácora de publicación"
        title="Hub de"
        titleAccent="publicaciones"
        actions={
          <>
            <select className="zx-select inline on-ink" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} aria-label="Cliente">
              <option value="all">Todos los clientes</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.business_name || c.commercial_name || `Cliente ${c.id}`}</option>
              ))}
            </select>
            <select className="zx-select inline on-ink" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button className="zx-btn on-ink" onClick={() => navigate("/content-calendar")}>Programar publicación</button>
          </>
        }
        telemetry={[
          { k: "Programadas", v: counts.scheduled, tone: "brass" },
          { k: "Publicadas", v: counts.published },
          { k: "Fallidas", v: counts.failed, tone: "crit" },
          { k: "Total", v: counts.total },
        ]}
      >
          <div className="zx-toolbar">
            {PLATFORMS.map((p) => (
              <button key={p.value} className={`zx-chip${platformFilter === p.value ? " on" : ""}`} onClick={() => setPlatformFilter(p.value)}>
                {p.label}
              </button>
            ))}
            <span className="zx-sep" />
            {STATUS_CHIPS.map((s) => (
              <button key={s.value} className={`zx-chip${statusFilter === s.value ? " on" : ""}`} onClick={() => setStatusFilter(s.value)}>
                {s.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="zx-empty">Cargando publicaciones…</div>
          ) : visiblePosts.length === 0 ? (
            <div className="zx-empty">
              {counts.total === 0 ? (
                <>
                  <strong>Nada en la cola de este mes.</strong>
                  Programa contenido desde el calendario y aparecerá aquí en cuanto entre en cola.
                </>
              ) : (
                <>
                  <strong>Ninguna publicación coincide.</strong>
                  Ajusta los filtros de plataforma o estado.
                </>
              )}
            </div>
          ) : (
            <div className="zxh-grid">
              {visiblePosts.map((p) => <Card key={p.id} post={p} />)}
            </div>
          )}
      </PageShell>

      {/* ---------- detail modal ---------- */}
      {selected && (
        <div className="zx-overlay zxh-modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="zxh-modal">
            <div className="zxh-modal-head">
              <span className="plat">{platLabel(selected.platform)} · {typeLabel(selected.content_type)}</span>
              <button className="zxh-x" onClick={() => setSelected(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="zxh-modal-body">
              <span className={`zx-pill v-${statusInfo(selected.status).variant}`} style={{ alignSelf: "flex-start" }}>
                {statusInfo(selected.status).label}
              </span>
              {selected.error_message && statusInfo(selected.status).group === "failed" && (
                <div className="zx-err">⚠ {selected.error_message}</div>
              )}
              <div className="zx-field"><span className="k">Cliente</span><span className="val">{selected.customer_name || "—"}</span></div>
              <div className="zx-field"><span className="k">Cuenta</span><span className="val">{selected.account_username || selected.account_name || platLabel(selected.platform)}</span></div>
              <div className="zx-field">
                <span className="k">{statusInfo(selected.status).group === "published" ? "Publicado" : "Programado"}</span>
                <span className="val zx-mono">
                  {fmtDateTime(selected.published_at || selected.scheduled_for)}
                  {statusInfo(selected.status).group === "scheduled" && tMinus(selected.scheduled_for) && (
                    <span className="zx-tmin" style={{ marginLeft: 10 }}>{tMinus(selected.scheduled_for)}</span>
                  )}
                </span>
              </div>
              {selected.message && (
                <div className="zx-field"><span className="k">Texto</span><span className="val copy">{selected.message}</span></div>
              )}
              {selected.platform_post_url && (
                <a className="link" href={selected.platform_post_url} target="_blank" rel="noreferrer">Ver publicación →</a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SocialHub;
