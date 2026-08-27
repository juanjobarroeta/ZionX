import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import Layout from "../components/Layout";
import PixelMark from "../components/PixelMark";
import Telemetry from "../components/Telemetry";
import { API_BASE_URL } from "../utils/constants";
import { customerName as resolveCustomerName } from "../utils/customerName";
import "../styles/zionx.css";
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

const Analytics = () => {
  const [customers, setCustomers] = useState([]);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [range, setRange] = useState(30);
  const [social, setSocial] = useState([]);
  const [spend, setSpend] = useState([]);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const days = useMemo(() => dayRange(range), [range]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/customers`, { headers })
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, [headers]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = { from: days[0], to: days[days.length - 1] };
    if (customerFilter !== "all") params.customer_id = customerFilter;
    const [s, a, p, st] = await Promise.all([
      axios.get(`${API_BASE_URL}/api/social/analytics/series`, { headers, params }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/ads/spend/series`, { headers, params }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/analytics/posts`, { headers, params: { ...params, limit: 10, sort: "views" } }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/social/analytics/status`, { headers }).catch(() => ({ data: {} })),
    ]);
    setSocial(Array.isArray(s.data?.series) ? s.data.series : []);
    setSpend(Array.isArray(a.data?.series) ? a.data.series : []);
    setPosts(Array.isArray(p.data?.posts) ? p.data.posts : []);
    setStatus(Array.isArray(st.data?.jobs) ? st.data.jobs : []);
    setLoading(false);
  }, [headers, days, customerFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  // ---- series aligned to the shared axis ----
  const viewsSeries = useMemo(() => align(days, social, "day", "views"), [days, social]);
  const reachSeries = useMemo(() => align(days, social, "day", "reach"), [days, social]);
  const interactionSeries = useMemo(() => align(days, social, "day", "interactions"), [days, social]);
  const spendSeries = useMemo(() => align(days, spend, "day", "spend"), [days, spend]);
  const dmSeries = useMemo(() => align(days, spend, "day", "conversations_started"), [days, spend]);
  const labels = useMemo(() => days.map(fmtDay), [days]);

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
    pointRadius: 0,
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

  const jobLabel = { meta_accounts: "Cuentas", meta_posts: "Publicaciones", meta_ads: "Anuncios" };
  const staleAfterHours = 12;

  return (
    <Layout>
      <div className="zx-app zxa">
        <header className="zx-cmd">
          <div className="zx-cmd-inner">
            <div className="zx-cmd-top">
              <div>
                <div className="zx-eyebrow"><PixelMark size={11} /> Analítica</div>
                <h1 className="zx-title">Rendimiento <span className="zx-serif">en el tiempo</span></h1>
              </div>
              <div className="zx-cmd-actions">
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
              </div>
            </div>
            <Telemetry
              items={[
                { k: "Vistas", v: sum(viewsSeries) },
                { k: "Alcance", v: sum(reachSeries) },
                { k: "Interacciones", v: sum(interactionSeries) },
                { k: "Seguidores", v: followers },
                { k: "Conversaciones", v: sum(dmSeries), tone: "brass" },
              ]}
            />
          </div>
        </header>

        <div className="zx-canvas">
          {loading ? (
            <div className="zx-empty">Cargando métricas…</div>
          ) : (
            <>
              <div className="zxa-grid">
                {/* --- views & reach: two series, so a legend is always present --- */}
                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Vistas y alcance</h2>
                    <span className="sub">{fmtNum(sum(viewsSeries))} vistas · {fmtNum(sum(reachSeries))} alcance</span>
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
                    <span className="sub">reacciones, comentarios, compartidos y guardados</span>
                  </div>
                  <div className="zxa-plot">
                    {hasSocial ? (
                      <Bar
                        data={{ labels, datasets: [barSet("interacciones", interactionSeries, COLOR.interactions)] }}
                        options={baseOptions(fmtNum)}
                      />
                    ) : empty("Aún no hay interacciones guardadas para este período.")}
                  </div>
                </section>

                {/* --- ad spend and its outcome: two measures, two charts.
                        Never one chart with two y-axes. --- */}
                <section className="zxa-card">
                  <div className="zxa-card-head">
                    <h2>Inversión publicitaria</h2>
                    <span className="sub">{fmtMoney(sum(spendSeries), currency)} en {range} días</span>
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
                    <span className="sub">mensajes que abrieron los anuncios</span>
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

              {/* --- leaderboard: also the table view for every number above --- */}
              <section className="zxa-card">
                <div className="zxa-card-head">
                  <h2>Publicaciones con mejor rendimiento</h2>
                  <span className="sub">último dato de cada publicación</span>
                </div>
                {posts.length === 0 ? (
                  empty("Cuando se publique contenido y corra la sincronización, aquí aparece qué funcionó.")
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
                        {posts.map((p) => (
                          <tr key={p.platform_post_id}>
                            <td>
                              <div className="post-msg">{p.message || "Sin texto"}</div>
                              <div className="post-meta">
                                {(p.platform || "").toUpperCase()}
                                {p.account_username ? ` · @${p.account_username}` : ""}
                                {p.published_at ? ` · ${fmtDay(String(p.published_at).slice(0, 10))}` : ""}
                              </div>
                            </td>
                            <td>{p.media_type || "—"}</td>
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
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
