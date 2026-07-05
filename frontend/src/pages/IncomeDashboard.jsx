import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
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
    <Layout>
      <div className="zxin">
        <div className="zxin-inner">
          <div className="zxin-head">
            <div>
              <div className="zxin-eyebrow">Finanzas</div>
              <h1 className="zxin-h1">Ingresos <span className="zxin-serif">del mes</span></h1>
            </div>
            <div className="zxin-actions">
              <Link to="/income/invoices" className="zxin-btn">Facturas</Link>
              <Link to="/income/payments" className="zxin-btn">Pagos</Link>
              <Link to="/income/invoice-generator" className="zxin-btn solid">+ Generar factura</Link>
            </div>
          </div>

          {loading ? (
            <div className="zxin-loading">Cargando ingresos…</div>
          ) : (
            <>
              <div className="zxin-tiles">
                <div className="zxin-tile lead">
                  <span className="k">MRR</span>
                  <span className="v">{fmtMoney(d?.mrr)}</span>
                  <span className="sub">ARR {fmtMoney((d?.mrr || 0) * 12)}</span>
                </div>
                <div className="zxin-tile">
                  <span className="k">Este mes</span>
                  <span className="v">{fmtMoney(d?.revenue_this_month)}</span>
                  <span className={`sub ${growth >= 0 ? "up" : "down"}`}>{growth >= 0 ? "↗" : "↘"} {Math.abs(growth).toFixed(1)}% vs mes anterior</span>
                </div>
                <div className="zxin-tile">
                  <span className="k">Por cobrar</span>
                  <span className="v warn">{fmtMoney(d?.total_outstanding)}</span>
                  <span className="sub">{d?.invoices_this_month || 0} facturas pendientes</span>
                </div>
                <div className="zxin-tile">
                  <span className="k">Vencido</span>
                  <span className="v bad">{fmtMoney(d?.overdue_amount)}</span>
                  <span className="sub">{d?.overdue_count || 0} facturas vencidas</span>
                </div>
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
        </div>
      </div>
    </Layout>
  );
};

export default IncomeDashboard;
