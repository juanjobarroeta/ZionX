import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./Finance.css";

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtMonth = (s) => {
  if (!s) return "";
  const [y, m] = s.split("-");
  return new Date(y, parseInt(m, 10) - 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
};
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—");

const IncomeDashboard = () => {
  const [d, setD] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    Promise.all([
      axios.get(`${API_BASE_URL}/api/income/dashboard`, { headers }).catch(() => ({ data: {} })),
      axios.get(`${API_BASE_URL}/api/income/revenue/summary`, { headers }).catch(() => ({ data: [] })),
      axios.get(`${API_BASE_URL}/api/income/invoices/pending`, { headers }).catch(() => ({ data: [] })),
    ]).then(([dash, rev, inv]) => {
      setD(dash.data || {});
      setRevenue((Array.isArray(rev.data) ? rev.data : []).slice(0, 6));
      setPending((Array.isArray(inv.data) ? inv.data : []).slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  const growth = Number(d?.month_over_month_growth) || 0;
  const maxRev = Math.max(1, ...revenue.map((m) => parseFloat(m.total_paid || 0)));

  return (
    <PageShell
      className="zxin"
      eyebrow="Finanzas"
      title="Ingresos"
      titleAccent="del mes"
      actions={
        <>
          <Link to="/income/invoices" className="zx-btn on-ink ghost">Facturas</Link>
          <Link to="/income/payments" className="zx-btn on-ink ghost">Pagos</Link>
          <Link to="/income/invoice-generator" className="zx-btn on-ink">Generar factura</Link>
        </>
      }
      telemetry={[
        { k: "MRR", v: fmtMoney(d?.mrr) },
        { k: "Este mes", v: fmtMoney(d?.revenue_this_month),
          delta: Number.isFinite(growth) && growth !== 0
            ? { text: `${growth > 0 ? "↑" : "↓"} ${Math.abs(growth).toFixed(0)}%`, dir: growth > 0 ? "up" : "down" }
            : null },
        { k: "Por cobrar", v: fmtMoney(d?.total_outstanding), tone: "brass" },
        { k: "Vencido", v: fmtMoney(d?.overdue_amount), tone: "crit" },
      ]}
    >

          {loading ? (
            <div className="zxin-loading">Cargando ingresos…</div>
          ) : (
            <>
              {/* The counts behind the money — the tiles' only unique content. */}
              <div className="zxin-context">
                <span><b>{d?.invoices_this_month || 0}</b> facturas pendientes</span>
                <span className={d?.overdue_count ? "bad" : undefined}><b>{d?.overdue_count || 0}</b> vencidas</span>
              </div>

              <div className="zxin-subrow">
                <div className="zxin-mini"><span className="k">Suscripciones activas</span><span className="v">{d?.active_subscriptions || 0}</span></div>
                <div className="zxin-mini"><span className="k">ARPU (prom. por cliente)</span><span className="v">{fmtMoney((d?.mrr || 0) / (d?.active_subscriptions || 1))}</span></div>
                <div className="zxin-mini"><span className="k">ARR (anual)</span><span className="v">{fmtMoney(d?.annual_run_rate || (d?.mrr || 0) * 12)}</span></div>
              </div>

              <div className="zxin-cols">
                <div className="zxin-panel">
                  <h2>Ingresos cobrados por mes</h2>
                  {revenue.length === 0 ? (
                    <div className="zxin-empty">Sin datos de ingresos todavía.</div>
                  ) : (
                    <div className="zxin-chart">
                      {revenue.map((m, i) => (
                        <div className="zxin-bar-row" key={i}>
                          <div className="zxin-bar-top">
                            <span className="m">{fmtMonth(m.month)}</span>
                            <span className="a">{fmtMoney(m.total_paid)}</span>
                          </div>
                          <div className="zxin-track">
                            <div className="zxin-fill" style={{ width: `${Math.max(2, (parseFloat(m.total_paid || 0) / maxRev) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="zxin-panel">
                  <h2>Por cobrar</h2>
                  {pending.length === 0 ? (
                    <div className="zxin-empty">Nada pendiente — todo al día. ✅</div>
                  ) : (
                    <div className="zxin-inv">
                      {pending.map((inv) => {
                        const over = (inv.current_status || inv.status) === "overdue" ||
                          (inv.due_date && new Date(inv.due_date) < new Date());
                        return (
                          <Link className="zxin-inv-row" key={inv.id} to={`/income/invoices/${inv.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                            <div>
                              <div className="who">{inv.customer_name || "—"}</div>
                              <div className="meta">{inv.invoice_number || `#${inv.id}`} · vence {fmtDate(inv.due_date)}</div>
                            </div>
                            <div className={`amt ${over ? "over" : ""}`}>{fmtMoney(inv.amount_due ?? inv.total)}</div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
    </PageShell>
  );
};

export default IncomeDashboard;
