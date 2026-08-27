import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import PageShell from "../components/PageShell";
import PixelMark from "../components/PixelMark";
import { API_BASE_URL } from "../utils/constants";
import { customerName as resolveCustomerName } from "../utils/customerName";
import "./Analytics.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

// Series color per entity, never per rank: filtering a client out must not
// repaint the series that remain.
const COLOR = {
  views: "#2a78d6",
  reach: "#1f8a68",
  interactions: "#4a3aa7",
  ads: "#9A6B1E",
};
const INK = "#04111A";
const MUTED = "rgba(4,17,26,0.55)";
const GRID = "rgba(4,17,26,0.08)";
const PAPER = "#F2F3F1";

const MONTHS_ES_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const iso = (d) => d.toISOString().slice(0, 10);
const fmtDay = (key) => {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_ES_SHORT[(m || 1) - 1]}`;
};
const nf = new Intl.NumberFormat("es-MX");
const fmtNum = (n) => nf.format(Math.round(Number(n) || 0));
const fmtMoney = (n, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const RANGES = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];

/** Every day in the range, so all four charts share one x axis even when a
 *  series has gaps (a day nobody synced is a gap, not a zero). */
const dayRange = (days) => {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(iso(d));
  }
  return out;
};

/** Map API rows (one per day) onto the shared axis; missing days stay null. */
const align = (days, rows, dayKey, valueKey) => {
  const byDay = new Map(rows.map((r) => [String(r[dayKey]).slice(0, 10), r]));
  return days.map((d) => {
    const row = byDay.get(d);
    return row ? Number(row[valueKey]) || 0 : null;
  });
};

const sum = (arr) => arr.reduce((t, v) => t + (Number(v) || 0), 0);

const FORMAT_LABEL = { REELS: "Reel", CAROUSEL_ALBUM: "Carrusel", IMAGE: "Imagen", VIDEO: "Video", STORY: "Story", POST: "Post" };
const fmtLabel = (t) => FORMAT_LABEL[t] || (t || "Post");
const POST_SORTS = [
  { v: "views", label: "Vistas" },
  { v: "reach", label: "Alcance" },
  { v: "total_interactions", label: "Interacciones" },
  { v: "engagement_rate", label: "Tasa" },
];
const postMediaUrl = (u) => (u ? (/^(https?:|data:)/.test(u) ? u : `${API_BASE_URL}${u}`) : null);

const Analytics = () => {
  const [customers, setCustomers] = useState([]);
  // Deep-link support: /social-analytics?customer=<id> preselects the client,
  // so the client hub can hand off without losing context.
  const [searchParams] = useSearchParams();
  const [customerFilter, setCustomerFilter] = useState(() => searchParams.get("customer") || "all");
  const [range, setRange] = useState(30);
  const [social, setSocial] = useState([]);
  const [spend, setSpend] = useState([]);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState([]);
  const [postSort, setPostSort] = useState("views");
  const [postView, setPostView] = useState("galeria");
  const [selectedPost, setSelectedPost] = useState(null);
  const [postSeries, setPostSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  // Twice the window: the second half is the chart, the first half is the
  // baseline every "vs período anterior" reading compares against.
  const daysAll = useMemo(() => dayRange(range * 2), [range]);
  const days = useMemo(() => daysAll.slice(range), [daysAll, range]);
  const prevDays = useMemo(() => daysAll.slice(0, range), [daysAll, range]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/customers`, { headers })
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, [headers]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = { from: daysAll[0], to: daysAll[daysAll.length - 1] };
    if (customerFilter !== "all") params.customer_id = customerFilter;
    const [s, a, p, st] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/social/analytics/series`, { headers, params }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/ads/spend/series`, { headers, params }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/analytics/posts`, { headers, params: { from: days[0], to: days[days.length - 1], ...(customerFilter !== "all" ? { customer_id: customerFilter } : {}), limit: 60, sort: "views" } }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/analytics/status`, { headers }).catch(() => ({ data: {} })),
    ]);
    setSocial(Array.isArray(s.data?.series) ? s.data.series : []);
    setSpend(Array.isArray(a.data?.series) ? a.data.series : []);
    setPosts(Array.isArray(p.data?.posts) ? p.data.posts : []);
    setStatus(Array.isArray(st.data?.jobs) ? st.data.jobs : []);
    setLoading(false);
  }, [headers, daysAll, days, customerFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!selectedPost) { setPostSeries([]); return; }
    let alive = true;
    axios.get(`${API_BASE_URL}/api/social/analytics/posts/${encodeURIComponent(selectedPost.platform_post_id)}`, { headers })
      .then((r) => { if (alive) setPostSeries(Array.isArray(r.data?.series) ? r.data.series : []); })
      .catch(() => { if (alive) setPostSeries([]); });
    return () => { alive = false; };
  }, [selectedPost, headers]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        axios.post(`${API_BASE_URL}/api/social/sync-analytics`, {}, { headers }),
        axios.post(`${API_BASE_URL}/api/ads/sync`, {}, { headers }),
      ]);
      await fetchAll();
    } catch {
      /* the status line below shows what actually landed */
    } finally {
      setSyncing(false);
    }
  };

  // Period-over-period reading. Null when there is no baseline — a delta
  // against nothing is a made-up number.
  const deltaOf = (curr, prev) => {
    if (!prev) return null;
    const pct = ((curr - prev) / prev) * 100;
    if (Math.abs(pct) < 0.5) return { text: "· 0%", dir: "flat" };
    const arrow = pct > 0 ? "↑" : "↓";
    return { text: `${arrow} ${Math.abs(pct) >= 200 ? ">200" : Math.abs(pct).toFixed(0)}%`, dir: pct > 0 ? "up" : "down" };
  };
  const deltaText = (d) => (d ? ` · ${d.text} vs anterior` : "");

  // ---- series aligned to the shared axis ----
  const viewsSeries = useMemo(() => align(days, social, "day", "views"), [days, social]);
  const reachSeries = useMemo(() => align(days, social, "day", "reach"), [days, social]);
  const interactionSeries = useMemo(() => align(days, social, "day", "interactions"), [days, social]);
  const spendSeries = useMemo(() => align(days, spend, "day", "spend"), [days, spend]);
  const dmSeries = useMemo(() => align(days, spend, "day", "conversations_started"), [days, spend]);
  const labels = useMemo(() => days.map(fmtDay), [days]);
  // Interaction components ride the tooltip — the chart stays one honest series.
  const likesSeries = useMemo(() => align(days, social, "day", "likes"), [days, social]);
  const commentsSeries = useMemo(() => align(days, social, "day", "comments"), [days, social]);
  const sharesSeries = useMemo(() => align(days, social, "day", "shares"), [days, social]);
  const savesSeries = useMemo(() => align(days, social, "day", "saves"), [days, social]);

  const prevOf = useCallback((rows, key) => sum(align(prevDays, rows, "day", key)), [prevDays]);
  const dViews = deltaOf(sum(viewsSeries), prevOf(social, "views"));
  // Both sides of the comparison are per-day averages, so the delta is like-for-like.
  const reachDays = Math.max(1, reachSeries.filter((v) => v != null).length);
  const dReach = deltaOf(sum(reachSeries) / reachDays, prevOf(social, "reach") / Math.max(1, prevDays.length));
  const dInteractions = deltaOf(sum(interactionSeries), prevOf(social, "interactions"));
  const dSpend = deltaOf(sum(spendSeries), prevOf(spend, "spend"));
  const dDms = deltaOf(sum(dmSeries), prevOf(spend, "conversations_started"));
  const netFollowers = sum(align(days, social, "day", "followers_gained")) - sum(align(days, social, "day", "followers_lost"));

  const currency = spend.find((r) => r.currency)?.currency || "MXN";
  const followers = social.length ? Number(social[social.length - 1].followers) || 0 : 0;
  const hasSocial = social.length > 0;
  const hasSpend = spend.length > 0;

  // ---- chart chrome, identical across every plot ----
  const baseOptions = (valueFmt) => ({
    responsive: true,
    maintainAspectRatio: false,
    // No entry animation: every filter change re-renders four charts at once,
    // and watching them all grow from zero is noise, not information.
    animation: false,
    interaction: { mode: "index", intersect: false }, // one tooltip, every series
    plugins: {
      legend: { display: false }, // legends are rendered in HTML, keyed like the mark
      tooltip: {
        backgroundColor: INK,
        titleColor: "rgba(242,243,241,0.6)",
        bodyColor: PAPER,
        titleFont: { family: "ui-monospace, Menlo, monospace", size: 10, weight: "500" },
        bodyFont: { family: "Bricolage, Helvetica, Arial, sans-serif", size: 13, weight: "600" },
        padding: 10,
        cornerRadius: 3,
        displayColors: true,
        boxWidth: 10,
        boxHeight: 2,
        callbacks: {
          // Value leads, series name follows — the reader already knows the series.
          label: (ctx) => `${valueFmt(ctx.parsed.y)}  ${ctx.dataset.label}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: GRID },
        ticks: {
          color: MUTED, maxRotation: 0, autoSkipPadding: 24,
          font: { family: "ui-monospace, Menlo, monospace", size: 10 },
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID, drawTicks: false },   // hairline, solid, recessive
        border: { display: false },
        ticks: {
          color: MUTED, maxTicksLimit: 5, padding: 8,
          font: { family: "ui-monospace, Menlo, monospace", size: 10 },
          callback: (v) => valueFmt(v),
        },
      },
    },
  });

  const lineSet = (label, data, color) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    tension: 0.25,
    spanGaps: false,
    // A history a few days old is dots, not a line — make the dots visible
    // instead of rendering an apparently empty chart.
    pointRadius: data.filter((v) => v != null).length <= 3 ? 4 : 0,
    pointBorderColor: PAPER,
    pointBorderWidth: 2,
    pointHoverRadius: 5,          // ≥8px across, with a surface ring
    pointHoverBorderColor: PAPER,
    pointHoverBorderWidth: 2,
    pointHitRadius: 24,           // the hit target is far bigger than the mark
  });

  const barSet = (label, data, color) => ({
    label,
    data,
    backgroundColor: color,
    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
    borderSkipped: false,
    maxBarThickness: 24,
    categoryPercentage: 0.9,
    barPercentage: 0.86,          // the leftover band is the 2px surface gap
  });

  const empty = (what) => (
    <div className="zx-empty" style={{ background: "transparent", border: "none", padding: "48px 12px" }}>
      <strong>Sin historial todavía.</strong>
      {what}
    </div>
  );

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => Number(b[postSort] || 0) - Number(a[postSort] || 0)),
    [posts, postSort]
  );
  // Per-format average views for the current client + range: the "what should
  // we make more of" number, computed from what's on screen.
  const formatStats = useMemo(() => {
    const acc = new Map();
    for (const p of posts) {
      const k = fmtLabel(p.media_type);
      const e = acc.get(k) || { n: 0, views: 0 };
      e.n += 1; e.views += Number(p.views) || 0;
      acc.set(k, e);
    }
    return [...acc.entries()]
      .map(([k, e]) => ({ label: k, n: e.n, avg: e.views / e.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 4);
  }, [posts]);

  const jobLabel = { meta_accounts: "Cuentas", meta_posts: "Publicaciones", meta_ads: "Anuncios" };
  const staleAfterHours = 12;

  return (
    <>
      <PageShell
        className="zxa"
        eyebrow="Analítica"
        title="Rendimiento"
        titleAccent="en el tiempo"
        actions={
          <>
            <select className="zx-select inline on-ink" value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)} aria-label="Cliente">
              <option value="all">Todos los clientes</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{resolveCustomerName(c)}</option>
              ))}
            </select>
            <div className="zx-seg on-ink">
              {RANGES.map((r) => (
                <button key={r.value} className={range === r.value ? "on" : ""}
                        onClick={() => setRange(r.value)}>{r.label}</button>
              ))}
            </div>
            <button className="zx-btn on-ink" onClick={syncNow} disabled={syncing}>
              {syncing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          </>
        }
        telemetry={[
          { k: "Vistas", v: sum(viewsSeries), delta: dViews },
          // Reach is unique accounts per day; summing days counts a person once
          // per day. Show the daily average, which is a number that holds.
          { k: "Alcance diario", v: Math.round(sum(reachSeries) / Math.max(1, reachSeries.filter((v) => v != null).length)), delta: dReach },
          { k: "Interacciones", v: sum(interactionSeries), delta: dInteractions },
          { k: "Seguidores", v: followers,
            delta: netFollowers !== 0 ? { text: `${netFollowers > 0 ? "+" : "−"}${Math.abs(netFollowers)}`, dir: netFollowers > 0 ? "up" : "down" } : null },
          { k: "Conversaciones", v: sum(dmSeries), tone: "brass", delta: dDms },
        ]}
      >
          {loading && !hasSocial && !hasSpend && posts.length === 0 ? (
            <div className="zx-empty">Cargando métricas…</div>
          ) : (
            <>
              <div className="zxa-grid">
                {/* --- views & reach: two series, so a legend is always present --- */}
                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Vistas y alcance</h2>
                    <span className="sub">{fmtNum(sum(viewsSeries))} vistas · {fmtNum(sum(reachSeries) / Math.max(1, reachSeries.filter((v) => v != null).length))} alcance diario prom.{deltaText(dViews)}</span>
                  </div>
                  <div className="zxa-legend">
                    <span><i className="zxa-key" style={{ background: COLOR.views }} /> Vistas</span>
                    <span><i className="zxa-key" style={{ background: COLOR.reach }} /> Alcance</span>
                  </div>
                  <div className="zxa-plot">
                    {hasSocial ? (
                      <Line
                        data={{ labels, datasets: [
                          lineSet("vistas", viewsSeries, COLOR.views),
                          lineSet("alcance", reachSeries, COLOR.reach),
                        ] }}
                        options={baseOptions(fmtNum)}
                      />
                    ) : empty("Las cuentas se sincronizan cada 6 horas. Usa “Sincronizar ahora” para traer el primer día.")}
                  </div>
                </section>

                {/* --- interactions: a single series needs no legend box --- */}
                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Interacciones</h2>
                    <span className="sub">reacciones, comentarios, compartidos y guardados{deltaText(dInteractions)}</span>
                  </div>
                  <div className="zxa-plot">
                    {hasSocial ? (
                      <Bar
                        data={{ labels, datasets: [barSet("interacciones", interactionSeries, COLOR.interactions)] }}
                        options={{
                          ...baseOptions(fmtNum),
                          plugins: {
                            ...baseOptions(fmtNum).plugins,
                            tooltip: {
                              ...baseOptions(fmtNum).plugins.tooltip,
                              callbacks: {
                                label: (ctx) => `${fmtNum(ctx.parsed.y)}  interacciones`,
                                // The components live in the same rows — surface
                                // them where the reader is already looking.
                                afterBody: (items) => {
                                  const i = items[0]?.dataIndex ?? -1;
                                  if (i < 0) return [];
                                  return [
                                    `${fmtNum(likesSeries[i] || 0)}  reacciones`,
                                    `${fmtNum(commentsSeries[i] || 0)}  comentarios`,
                                    `${fmtNum(sharesSeries[i] || 0)}  compartidos`,
                                    `${fmtNum(savesSeries[i] || 0)}  guardados`,
                                  ];
                                },
                              },
                            },
                          },
                        }}
                      />
                    ) : empty("Aún no hay interacciones guardadas para este período.")}
                  </div>
                </section>

                {/* --- ad spend and its outcome: two measures, two charts.
                        Never one chart with two y-axes. --- */}
                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Inversión publicitaria</h2>
                    <span className="sub">{fmtMoney(sum(spendSeries), currency)} en {range} días{deltaText(dSpend)}</span>
                  </div>
                  <div className="zxa-plot">
                    {hasSpend ? (
                      <Bar
                        data={{ labels, datasets: [barSet("inversión", spendSeries, COLOR.ads)] }}
                        options={baseOptions((v) => fmtMoney(v, currency))}
                      />
                    ) : empty("Conecta una cuenta publicitaria o sincroniza para ver la inversión diaria.")}
                  </div>
                </section>

                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Conversaciones iniciadas</h2>
                    <span className="sub">mensajes que abrieron los anuncios{deltaText(dDms)}</span>
                  </div>
                  <div className="zxa-plot">
                    {hasSpend ? (
                      <Bar
                        data={{ labels, datasets: [barSet("conversaciones", dmSeries, COLOR.ads)] }}
                        options={baseOptions(fmtNum)}
                      />
                    ) : empty("Sin datos de anuncios en este período.")}
                  </div>
                </section>
              </div>

              {/* --- content: every post on the connected accounts, ZIONX-published
                     or organic, as a gallery with a table twin --- */}
              <section className="zxa-card">
                <div className="zxa-card-head">
                  <h2>Contenido del período</h2>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select className="zx-select inline" value={postSort} onChange={(e) => setPostSort(e.target.value)} aria-label="Ordenar por">
                      {POST_SORTS.map((o) => <option key={o.v} value={o.v}>Por {o.label.toLowerCase()}</option>)}
                    </select>
                    <div className="zx-seg" role="group" aria-label="Vista">
                      <button className={postView === "galeria" ? "on" : ""} onClick={() => setPostView("galeria")}>Galería</button>
                      <button className={postView === "tabla" ? "on" : ""} onClick={() => setPostView("tabla")}>Tabla</button>
                    </div>
                  </div>
                </div>

                {formatStats.length > 1 && (
                  <div className="zxa-formats">
                    {formatStats.map((f) => (
                      <span key={f.label}>{f.label} ø <b>{fmtNum(f.avg)}</b> vistas · {f.n}</span>
                    ))}
                  </div>
                )}

                {sortedPosts.length === 0 ? (
                  empty("Cuando corra la sincronización, aquí aparece todo el contenido de las cuentas conectadas — publicado desde ZIONX o directo en la app.")
                ) : postView === "galeria" ? (
                  <div className="zxa-postgrid">
                    {sortedPosts.map((p) => {
                      const img = postMediaUrl(p.thumbnail_url);
                      return (
                        <button className="zxa-postcard" key={p.platform_post_id} onClick={() => setSelectedPost(p)}>
                          <div className="zxa-postmedia">
                            {/* Stripes sit underneath so a failed image degrades
                                to the brand placeholder. IG's CDN 403s requests
                                that carry a cross-site Referer, and its signed
                                URLs expire — the sweep refreshes them each pass. */}
                            <span className="stripes" />
                            {img && (
                              <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer"
                                   style={{ position: "relative" }}
                                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            )}
                            <span className="fmt">{p.platform === "facebook" ? "FB" : "IG"} · {fmtLabel(p.media_type)}</span>
                            {!p.organic && <span className="zx-mark" title="Publicado desde ZIONX"><PixelMark size={9} /></span>}
                          </div>
                          <div className="zxa-postcard-body">
                            <div className="zxa-postcard-cap">{p.message || "Sin texto"}</div>
                            <div className="zxa-postcard-nums">
                              <span><b>{fmtNum(p.views)}</b> vistas</span>
                              <span><b>{fmtNum(p.total_interactions)}</b> int.</span>
                              <span><b>{Number(p.engagement_rate || 0).toFixed(1)}%</b></span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="zxa-table-wrap">
                    <table className="zxa-table">
                      <thead>
                        <tr>
                          <th>Publicación</th>
                          <th>Formato</th>
                          <th className="num">Vistas</th>
                          <th className="num">Alcance</th>
                          <th className="num">Interacciones</th>
                          <th className="num">Tasa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPosts.map((p) => (
                          <tr key={p.platform_post_id} onClick={() => setSelectedPost(p)} style={{ cursor: "pointer" }}>
                            <td>
                              <div className="post-msg">{p.message || "Sin texto"}</div>
                              <div className="post-meta">
                                {(p.platform || "").toUpperCase()}
                                {p.account_username ? ` · @${p.account_username}` : ""}
                                {p.published_at ? ` · ${fmtDay(String(p.published_at).slice(0, 10))}` : ""}
                                {p.organic ? " · orgánico" : " · zionx"}
                              </div>
                            </td>
                            <td>{fmtLabel(p.media_type)}</td>
                            <td className="num">{fmtNum(p.views)}</td>
                            <td className="num">{fmtNum(p.reach)}</td>
                            <td className="num">{fmtNum(p.total_interactions)}</td>
                            <td className="num">{Number(p.engagement_rate || 0).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* A stale number should look stale rather than quietly wrong. */}
              {status.length > 0 && (
                <div className="zxa-status">
                  {status.map((j) => {
                    const last = j.last_success_at ? new Date(j.last_success_at) : null;
                    const stale = !last || (Date.now() - last.getTime()) / 3600000 > staleAfterHours;
                    return (
                      <span key={j.job} className={stale ? "stale" : ""}>
                        {jobLabel[j.job] || j.job}:{" "}
                        {last ? `${last.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "sin correr"}
                        {j.last_detail ? ` · ${j.last_detail}` : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
      </PageShell>

      {/* ---------- post drawer: one post's numbers and its curve ---------- */}
      {selectedPost && (
        <div className="zx-overlay">
          <button className="zxa-scrim" onClick={() => setSelectedPost(null)} aria-label="Cerrar" />
          <aside className="zxa-drawer">
            <div className="zxa-drawer-head">
              <span className="plat">
                {(selectedPost.platform || "").toUpperCase()} · {fmtLabel(selectedPost.media_type)}
                {selectedPost.account_username ? ` · @${selectedPost.account_username}` : ""}
              </span>
              <button className="zxa-drawer-x" onClick={() => setSelectedPost(null)} aria-label="Cerrar">×</button>
            </div>
            <div className="zxa-drawer-body">
              {postMediaUrl(selectedPost.thumbnail_url) && (
                <div className="zxa-drawer-media">
                  <img src={postMediaUrl(selectedPost.thumbnail_url)} alt="" referrerPolicy="no-referrer"
                       onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }} />
                </div>
              )}
              <div className="zx-field">
                <span className="k">
                  {selectedPost.organic ? "Publicado en la app" : "Publicado desde ZIONX"}
                  {selectedPost.published_at ? ` · ${fmtDay(String(selectedPost.published_at).slice(0, 10))}` : ""}
                </span>
                {selectedPost.message && <span className="val zxa-drawer-cap">{selectedPost.message}</span>}
              </div>
              <div className="zxa-drawer-grid">
                {[
                  ["Vistas", fmtNum(selectedPost.views)],
                  ["Alcance", fmtNum(selectedPost.reach)],
                  ["Tasa", `${Number(selectedPost.engagement_rate || 0).toFixed(1)}%`],
                  ["Likes", fmtNum(selectedPost.likes)],
                  ["Comentarios", fmtNum(selectedPost.comments)],
                  // The sixth cell follows the format: a reel is judged by how
                  // long people stayed, a story by who answered.
                  selectedPost.media_type === "REELS" && Number(selectedPost.avg_watch_time) > 0
                    ? ["Ver. promedio", `${(Number(selectedPost.avg_watch_time) / 1000).toFixed(1)}s`]
                    : selectedPost.media_type === "STORY"
                    ? ["Respuestas", fmtNum(selectedPost.replies)]
                    : ["Guardados", fmtNum(selectedPost.saves)],
                ].map(([k, v]) => (
                  <div className="zx-field" key={k}>
                    <span className="k">{k}</span>
                    <span className="val zx-mono">{v}</span>
                  </div>
                ))}
              </div>
              {postSeries.length > 1 && (
                <div className="zx-field">
                  <span className="k">Cómo acumuló vistas</span>
                  <div className="zxa-legend">
                    <span><i className="zxa-key" style={{ background: COLOR.views }} /> Vistas</span>
                    <span><i className="zxa-key" style={{ background: COLOR.interactions }} /> Interacciones</span>
                  </div>
                  <div className="zxa-drawer-plot">
                    <Line
                      data={{
                        labels: postSeries.map((r) => fmtDay(String(r.day).slice(0, 10))),
                        datasets: [
                          lineSet("vistas", postSeries.map((r) => Number(r.views) || 0), COLOR.views),
                          lineSet("interacciones", postSeries.map((r) => Number(r.total_interactions) || 0), COLOR.interactions),
                        ],
                      }}
                      options={baseOptions(fmtNum)}
                    />
                  </div>
                </div>
              )}
              {selectedPost.platform_post_url && (
                <a className="link" href={selectedPost.platform_post_url} target="_blank" rel="noreferrer">Ver publicación →</a>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default Analytics;
