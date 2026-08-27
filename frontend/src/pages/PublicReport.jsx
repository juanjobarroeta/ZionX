import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { API_BASE_URL } from "../utils/constants";
import "../styles/zionx.css";
import "./PublicReport.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

// Same entities, same colours as Rendimiento — a client who sees both should
// see one product.
const COLOR = { views: "#2a78d6", reach: "#1f8a68" };
const INK = "#04111A";
const PAPER = "#F2F3F1";
const MUTED = "rgba(4,17,26,0.55)";
const GRID = "rgba(4,17,26,0.08)";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nf = new Intl.NumberFormat("es-MX");
const fmtNum = (n) => nf.format(Math.round(Number(n) || 0));
const fmtMoney = (n, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n) || 0);
const monthLabel = (period) => {
  const [y, m] = String(period || "").split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : "";
};
const dayLabel = (d) => {
  const [, , day] = String(d).slice(0, 10).split("-").map(Number);
  return String(day);
};
const FORMAT = { REELS: "Reel", VIDEO: "Video", CAROUSEL_ALBUM: "Carrusel", IMAGE: "Imagen", STORY: "Story", POST: "Post" };
const media = (u) => (u ? (/^(https?:|data:)/.test(u) ? u : `${API_BASE_URL}${u}`) : null);

/** Month-over-month reading. Absent when there's no previous month to stand on. */
const delta = (now, before) => {
  if (!before) return null;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return { text: "sin cambio", dir: "flat" };
  return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct).toFixed(0)}% vs mes anterior`, dir: pct > 0 ? "up" : "down" };
};

const PublicReport = () => {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/public/report/${token}`)
      .then((r) => setState({ loading: false, data: r.data, error: null }))
      .catch((e) => setState({
        loading: false, data: null,
        error: e.response?.status === 404 ? "notfound" : "error",
      }));
  }, [token]);

  if (state.loading) {
    return <div className="zxr"><div className="zxr-state">Cargando el reporte…</div></div>;
  }
  if (state.error) {
    return (
      <div className="zxr">
        <div className="zxr-state">
          <strong>{state.error === "notfound" ? "Este reporte ya no está disponible." : "No se pudo cargar el reporte."}</strong>
          {state.error === "notfound"
            ? "El enlace puede haber sido reemplazado. Pídele uno nuevo a tu equipo de ZIONX."
            : "Vuelve a intentarlo en un momento."}
        </div>
      </div>
    );
  }

  const d = state.data;
  const t = d.totals;
  const ads = d.ads || {};
  const currency = ads.currency || "MXN";
  const spend = Number(ads.spend) || 0;
  const labels = d.series.map((r) => dayLabel(r.day));

  const dViews = delta(t.views, d.previous.views);
  const dInter = delta(t.interactions, d.previous.interactions);
  // Reach counts unique accounts *per day*, so adding days together counts the
  // same person once per day. The daily average is the honest summary; the
  // chart below still shows each day as measured.
  const avgReach = d.series.length ? t.reach / d.series.length : 0;
  const prevDays = 30; // the comparison window is a calendar month
  const dReach = delta(avgReach, d.previous.reach ? d.previous.reach / prevDays : 0);

  const lineSet = (label, data, color) => ({
    label, data,
    borderColor: color, backgroundColor: color,
    borderWidth: 2, tension: 0.25,
    pointRadius: data.length <= 3 ? 4 : 0,
    pointBorderColor: PAPER, pointBorderWidth: 2,
    pointHoverRadius: 5, pointHoverBorderColor: PAPER, pointHoverBorderWidth: 2,
    pointHitRadius: 24,
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: INK, titleColor: "rgba(242,243,241,0.6)", bodyColor: PAPER,
        titleFont: { family: "ui-monospace, Menlo, monospace", size: 10 },
        bodyFont: { family: "Bricolage, Helvetica, Arial, sans-serif", size: 13, weight: "600" },
        padding: 10, cornerRadius: 3, boxWidth: 10, boxHeight: 2,
        callbacks: {
          title: (items) => `Día ${items[0]?.label ?? ""}`,
          label: (ctx) => `${fmtNum(ctx.parsed.y)}  ${ctx.dataset.label}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: GRID },
           ticks: { color: MUTED, maxRotation: 0, autoSkipPadding: 20, font: { family: "ui-monospace, Menlo, monospace", size: 10 } } },
      y: { beginAtZero: true, grid: { color: GRID, drawTicks: false }, border: { display: false },
           ticks: { color: MUTED, maxTicksLimit: 5, padding: 8, font: { family: "ui-monospace, Menlo, monospace", size: 10 }, callback: (v) => fmtNum(v) } },
    },
  };

  const Figure = ({ k, v, d: dd }) => (
    <div className="zxr-fig">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      {dd && <span className={`d ${dd.dir}`}>{dd.text}</span>}
    </div>
  );

  return (
    <div className="zxr">
      <header className="zxr-top">
        <div className="zxr-top-in">
          <div className="zxr-brand">
            <img src="/landing/logo-wordmark-white.webp" alt="ZIONX" />
            <span className="zxr-period">{monthLabel(d.period)}</span>
          </div>
          <h1 className="zxr-title">{d.customer.name}</h1>
          {d.headline && <p className="zxr-headline">{d.headline}</p>}

          <div className="zxr-figures">
            <Figure k="Vistas" v={fmtNum(t.views)} d={dViews} />
            <Figure k="Alcance diario" v={fmtNum(avgReach)} d={dReach} />
            <Figure k="Interacciones" v={fmtNum(t.interactions)} d={dInter} />
            <Figure
              k="Seguidores"
              v={fmtNum(t.followers)}
              d={t.followers_net !== 0
                ? { text: `${t.followers_net > 0 ? "+" : "−"}${Math.abs(t.followers_net)} en el mes`, dir: t.followers_net > 0 ? "up" : "down" }
                : null}
            />
            <Figure k="Publicaciones" v={fmtNum(t.posts)} />
          </div>
        </div>
      </header>

      <div className="zxr-body">
        {d.series.length > 0 && (
          <section className="zxr-card">
            <h2>Cómo se movió el mes</h2>
            <p className="sub">Vistas y alcance, día por día.</p>
            <div className="zxr-legend">
              <span><i className="zxr-key" style={{ background: COLOR.views }} /> Vistas</span>
              <span><i className="zxr-key" style={{ background: COLOR.reach }} /> Alcance</span>
            </div>
            <div className="zxr-plot">
              <Line
                data={{ labels, datasets: [
                  lineSet("vistas", d.series.map((r) => r.views), COLOR.views),
                  lineSet("alcance", d.series.map((r) => r.reach), COLOR.reach),
                ] }}
                options={options}
              />
            </div>
          </section>
        )}

        {d.top_posts.length > 0 && (
          <section className="zxr-card">
            <h2>Lo que mejor funcionó</h2>
            <p className="sub">Las publicaciones más vistas del mes.</p>
            <div className="zxr-posts">
              {d.top_posts.map((p) => {
                const img = media(p.thumbnail_url);
                const Card = p.url ? "a" : "div";
                return (
                  <Card
                    className="zxr-post"
                    key={p.platform_post_id}
                    {...(p.url ? { href: p.url, target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <div className="zxr-post-media">
                      <span className="stripes" />
                      {img && (
                        <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer"
                             style={{ position: "relative" }}
                             onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      )}
                      <span className="fmt">{FORMAT[p.media_type] || "Post"}</span>
                    </div>
                    <div className="zxr-post-body">
                      <span className="zxr-post-cap">{p.message || "Sin texto"}</span>
                      <span className="zxr-post-num">
                        {fmtNum(p.views)} vistas · {fmtNum(p.total_interactions)} interacciones
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {spend > 0 && (
          <section className="zxr-card">
            <h2>Publicidad</h2>
            <p className="sub">Lo invertido este mes y lo que generó.</p>
            <div className="zxr-ads">
              <div className="zxr-ad"><span className="k">Inversión</span><span className="v">{fmtMoney(spend, currency)}</span></div>
              <div className="zxr-ad"><span className="k">Impresiones</span><span className="v">{fmtNum(ads.impressions)}</span></div>
              <div className="zxr-ad"><span className="k">Clics al enlace</span><span className="v">{fmtNum(ads.link_clicks)}</span></div>
              <div className="zxr-ad"><span className="k">Conversaciones</span><span className="v">{fmtNum(ads.conversations)}</span></div>
              {Number(ads.leads) > 0 && (
                <div className="zxr-ad"><span className="k">Registros</span><span className="v">{fmtNum(ads.leads)}</span></div>
              )}
            </div>
          </section>
        )}

        {d.series.length === 0 && d.top_posts.length === 0 && spend === 0 && (
          <section className="zxr-card">
            <h2>Todavía no hay datos de este mes</h2>
            <p className="sub">En cuanto se publique y se midan los primeros días, aparecerán aquí.</p>
          </section>
        )}
      </div>

      <footer className="zxr-foot">
        <span>Reporte generado por ZIONX · {monthLabel(d.period)}</span>
        <span className="zxr-serif">All systems nominal.</span>
      </footer>
    </div>
  );
};

export default PublicReport;
