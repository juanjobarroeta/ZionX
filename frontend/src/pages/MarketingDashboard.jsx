import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import "../components/AdminShell.css";

// ---------- formatting helpers ----------

const fmtMoneyCompact = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v).toLocaleString("es-MX")}`;
};

const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

const timeAgoEs = (dateStr) => {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  return `hace ${days} días`;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const dueTextEs = (dueDateStr) => {
  if (!dueDateStr) return { text: "Sin fecha", overdue: false };
  const days = Math.round((startOfDay(dueDateStr) - startOfDay(new Date())) / 86400000);
  if (days < 0) return { text: `Vencida · ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`, overdue: true };
  if (days === 0) return { text: "Vence hoy", overdue: false };
  if (days === 1) return { text: "Vence mañana", overdue: false };
  const d = new Date(dueDateStr);
  return { text: `Vence ${d.getDate()} ${d.toLocaleDateString("es-MX", { month: "short" })}`, overdue: false };
};

const greetingEs = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
};

const todayLabelEs = () => {
  const label = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Content statuses that mean "ready to go"
const READY_STATUSES = new Set(["publicado", "programado", "aprobado", "listo", "published", "scheduled", "approved"]);
const PENDING_STATUSES = new Set(["planificado", "pending", "en_revision", "en revisión", "revision", "diseño", "diseno", "draft"]);

const statusPillEs = (status) => {
  const s = (status || "").toLowerCase();
  if (READY_STATUSES.has(s)) return { text: "Listo", solid: true };
  const short = (status || "Pendiente").replace(/_/g, " ");
  return { text: short.length > 14 ? `${short.slice(0, 13)}…` : short, solid: false };
};

const MarketingDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [customersRes, tasksRes, invoicesRes, leadsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/customers`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/team/content-tasks`, { headers, params: { days: 30 } }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/income/invoices`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/leads`, { headers, params: { limit: 20 } }).catch(() => ({ data: [] })),
      ]);

      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      const t = tasksRes.data?.tasks || tasksRes.data;
      setTasks(Array.isArray(t) ? t : []);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      const l = leadsRes.data?.leads || leadsRes.data;
      setLeads(Array.isArray(l) ? l : []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ---------- derived metrics ----------

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const newCustomersThisMonth = customers.filter(
    (c) => c.created_at && new Date(c.created_at) >= monthStart
  ).length;

  // Posts this week (Mon–Sun)
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const postsThisWeek = tasks.filter((t) => {
    if (!t.scheduled_date) return false;
    const d = new Date(t.scheduled_date);
    return d >= weekStart && d < weekEnd;
  });
  const pendingApproval = postsThisWeek.filter((t) => PENDING_STATUSES.has((t.status || "").toLowerCase())).length;

  // Invoices
  const validInvoices = invoices.filter((i) => i.status !== "cancelled");
  const monthName = now.toLocaleDateString("es-MX", { month: "long" });
  const prevMonthName = prevMonthStart.toLocaleDateString("es-MX", { month: "long" });
  const sumInvoices = (from, to) =>
    validInvoices
      .filter((i) => i.invoice_date && new Date(i.invoice_date) >= from && new Date(i.invoice_date) < to)
      .reduce((acc, i) => acc + (Number(i.total) || 0), 0);
  const incomeThisMonth = sumInvoices(monthStart, now);
  const incomePrevMonth = sumInvoices(prevMonthStart, monthStart);
  const incomeDelta =
    incomePrevMonth > 0 ? Math.round(((incomeThisMonth - incomePrevMonth) / incomePrevMonth) * 100) : null;

  const openInvoices = validInvoices.filter((i) => (i.current_status || i.status) !== "paid");
  const receivable = openInvoices.reduce((acc, i) => acc + (Number(i.amount_due ?? i.total) || 0), 0);
  const cobranza = [...openInvoices]
    .sort((a, b) => new Date(a.due_date || "2099-01-01") - new Date(b.due_date || "2099-01-01"))
    .slice(0, 3);

  // Today's calendar
  const todayTasks = tasks
    .filter((t) => {
      if (!t.scheduled_date) return false;
      const d = new Date(t.scheduled_date);
      return startOfDay(d).getTime() === startOfDay(now).getTime();
    })
    .slice(0, 6);

  // Newest leads
  const newLeads = [...leads]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 3);

  const firstName = (localStorage.getItem("userName") || "").trim().split(" ")[0] || "hola";

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  if (loading) {
    return (
      <Layout>
        <div className="zxd" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ opacity: 0.5, fontSize: 15 }}>Cargando mission control…</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="zxd">
        <div className="zxd-inner">
          {/* Header */}
          <div className="zxd-header">
            <div>
              <span className="zxd-date">{todayLabelEs()}</span>
              <h1 className="zxd-h1">
                {greetingEs()}, <span className="zxd-serif">{firstName}.</span>
              </h1>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/content-calendar" className="zxd-btn-ghost">Nueva publicación</Link>
              <Link to="/create-customer" className="zxd-btn-solid">+ Nuevo cliente</Link>
            </div>
          </div>

          {/* KPIs */}
          <div className="zxd-kpis">
            <div className="zxd-kpi">
              <span className="label">Clientes activos</span>
              <span className="value">{customers.length}</span>
              <span className="hint">
                {newCustomersThisMonth > 0 ? `+${newCustomersThisMonth} este mes` : "Sin altas este mes"}
              </span>
            </div>
            <div className="zxd-kpi">
              <span className="label">Publicaciones esta semana</span>
              <span className="value">{postsThisWeek.length}</span>
              <span className="hint">
                {pendingApproval > 0 ? `${pendingApproval} pendientes de aprobar` : "Todo aprobado"}
              </span>
            </div>
            <div className="zxd-kpi">
              <span className="label">Ingresos de {monthName}</span>
              <span className="value">{fmtMoneyCompact(incomeThisMonth)}</span>
              <span className="hint">
                {incomeDelta !== null
                  ? `MXN · ${incomeDelta >= 0 ? "+" : ""}${incomeDelta}% vs. ${prevMonthName}`
                  : "MXN"}
              </span>
            </div>
            <div className="zxd-kpi">
              <span className="label">Por cobrar</span>
              <span className="value">{fmtMoneyCompact(receivable)}</span>
              <span className="hint">
                {openInvoices.length === 1 ? "1 factura abierta" : `${openInvoices.length} facturas abiertas`}
              </span>
            </div>
          </div>

          {/* Two columns */}
          <div className="zxd-cols">
            {/* Hoy en el calendario */}
            <section className="zxd-card">
              <div className="zxd-card-head">
                <h2>Hoy en el calendario</h2>
                <Link to="/content-calendar" className="zxd-card-link">Ver calendario →</Link>
              </div>
              <div>
                {todayTasks.length === 0 && (
                  <div className="zxd-empty">Sin publicaciones programadas para hoy.</div>
                )}
                {todayTasks.map((t) => {
                  const pill = statusPillEs(t.status);
                  const time = t.scheduled_date
                    ? new Date(t.scheduled_date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "—";
                  return (
                    <div className="zxd-row" key={t.id}>
                      <span className="time">{time === "00:00" ? "—" : time}</span>
                      <div className="what">
                        <div className="title">
                          {t.content_type ? `${capitalize(t.content_type)} — ` : ""}
                          {t.idea_tema || t.campaign || t.customer_name || "Publicación"}
                        </div>
                        <div className="meta">
                          {[capitalize(t.platform), t.customer_name].filter(Boolean).join(" · ") || "Contenido"}
                        </div>
                      </div>
                      <span className={`zxd-pill ${pill.solid ? "solid" : "line"}`}>{pill.text}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Right column */}
            <div className="zxd-right">
              {/* Leads nuevos */}
              <section className="zxd-dark">
                <img className="astro" src="/landing/astronaut.png" alt="" />
                <h2>Leads nuevos</h2>
                <div className="zxd-dark-list">
                  {newLeads.length === 0 && <div className="zxd-empty">Sin leads nuevos por ahora.</div>}
                  {newLeads.map((l) => (
                    <div className="zxd-dark-row" key={l.id}>
                      <div>
                        <div className="title">{l.name || l.whatsapp_name || l.phone_number || "Lead"}</div>
                        <div className="meta">
                          {[l.source ? capitalize(l.source) : "Lead", timeAgoEs(l.created_at)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Link to="/leads-inbox">Abrir →</Link>
                    </div>
                  ))}
                </div>
              </section>

              {/* Cobranza */}
              <section className="zxd-light">
                <div className="zxd-light-head">
                  <h2>Cobranza</h2>
                  <Link to="/income/invoices" className="zxd-card-link">Facturas →</Link>
                </div>
                <div>
                  {cobranza.length === 0 && <div className="zxd-empty">Sin facturas abiertas. 🎉</div>}
                  {cobranza.map((inv) => {
                    const due = dueTextEs(inv.due_date);
                    return (
                      <div className="zxd-light-row" key={inv.id}>
                        <div>
                          <div className="title">
                            {inv.customer_name || "Cliente"}
                            {inv.invoice_number ? ` — ${inv.invoice_number}` : ""}
                          </div>
                          <div className={`meta${due.overdue ? " overdue" : ""}`}>{due.text}</div>
                        </div>
                        <span className="amount">{fmtMoney(inv.amount_due ?? inv.total)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MarketingDashboard;
