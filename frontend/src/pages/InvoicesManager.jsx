import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./Finance.css";

const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STATUS = {
  draft: { label: "Borrador", cls: "draft" },
  sent: { label: "Enviada", cls: "sent" },
  partial: { label: "Parcial", cls: "partial" },
  paid: { label: "Pagada", cls: "paid" },
  overdue: { label: "Vencida", cls: "overdue" },
  cancelled: { label: "Cancelada", cls: "cancelled" },
};
const statusOf = (s) => STATUS[(s || "").toLowerCase()] || STATUS.draft;

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "sent", label: "Enviadas" },
  { id: "paid", label: "Pagadas" },
  { id: "overdue", label: "Vencidas" },
  { id: "cancelled", label: "Canceladas" },
  { id: "stamped", label: "Timbradas" },
];

// CFDI (hub) tipo tabs → ContaOS `tipo` filter.
const CFDI_TABS = [
  { id: "", label: "Todas" },
  { id: "INGRESO", label: "Ingresos" },
  { id: "EGRESO", label: "Gastos" },
  { id: "NOMINA", label: "Nómina" },
  { id: "PAGO", label: "Pagos" },
];
const CFDI_STATUS = {
  STAMPED: { label: "Timbrada", cls: "ok" },
  CANCELLED: { label: "Cancelada", cls: "cancelled" },
  DRAFT: { label: "Borrador", cls: "draft" },
};
const cfdiStatusOf = (s) => CFDI_STATUS[(s || "").toUpperCase()] || { label: s || "—", cls: "draft" };
const tipoCls = (t) => ({ INGRESO: "in", EGRESO: "out", NOMINA: "nom", PAGO: "pago" }[t] || "draft");

const InvoicesManager = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [cancelling, setCancelling] = useState(null);

  // Fiscal mirror (contabilidad-os). When configured, ZionX surfaces the real
  // CFDIs and defaults to that view; the local ZionX invoices stay a click away.
  const [configured, setConfigured] = useState(false);
  const [view, setView] = useState("local"); // 'cfdi' | 'local'
  const [cfdi, setCfdi] = useState({ loading: true, facturas: [] });
  const [cfdiTipo, setCfdiTipo] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  // Detect the fiscal integration once and default to the CFDI view when on.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/income/cfdi/health`, { headers })
      .then((r) => {
        if (r.data?.configured) { setConfigured(true); setView("cfdi"); }
      })
      .catch(() => {});
  }, [headers]);

  // Local ZionX invoices.
  useEffect(() => {
    setLoading(true);
    const url = filter === "all" || filter === "overdue" || filter === "stamped"
      ? `${API_BASE_URL}/api/income/invoices`
      : `${API_BASE_URL}/api/income/invoices?status=${filter}`;
    axios.get(url, { headers })
      .then((r) => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [filter, headers]);

  // Fiscal CFDIs from the hub (only when configured and viewing them).
  useEffect(() => {
    if (!configured || view !== "cfdi") return;
    setCfdi((s) => ({ ...s, loading: true }));
    const q = cfdiTipo ? `?tipo=${cfdiTipo}&take=200` : "?take=200";
    axios.get(`${API_BASE_URL}/api/income/cfdi/invoices${q}`, { headers })
      .then((r) => setCfdi({ loading: false, facturas: r.data?.facturas || [] }))
      .catch(() => setCfdi({ loading: false, facturas: [] }));
  }, [configured, view, cfdiTipo, headers]);

  const rows = useMemo(() => {
    if (filter === "overdue") return invoices.filter((i) => (i.current_status || i.status) === "overdue");
    if (filter === "stamped") return invoices.filter((i) => Boolean(i.cfdi_uuid));
    return invoices;
  }, [invoices, filter]);

  const totals = useMemo(() => rows.reduce(
    (a, i) => {
      const st = i.current_status || i.status;
      a.billed += Number(i.total) || 0;
      a.paid += Number(i.amount_paid) || 0;
      if (st !== "paid" && st !== "cancelled") a.due += Number(i.amount_due) || 0;
      if (st === "overdue") a.overdue += Number(i.amount_due) || 0;
      return a;
    },
    { billed: 0, paid: 0, due: 0, overdue: 0 }
  ), [rows]);

  const handleCancelInvoice = async (invoice) => {
    if (!window.confirm(`¿Cancelar la factura ${invoice.invoice_number || invoice.id}? Esta acción no se puede deshacer.`)) return;
    const reason = window.prompt("Motivo de cancelación (opcional):", "") ?? "";
    try {
      setCancelling(invoice.id);
      const res = await axios.post(`${API_BASE_URL}/api/income/invoices/${invoice.id}/cancel`, { reason }, { headers });
      const updated = res.data?.invoice;
      setInvoices((prev) => prev.map((inv) =>
        inv.id === invoice.id ? { ...inv, ...(updated || {}), status: "cancelled", current_status: "cancelled" } : inv
      ));
    } catch (error) {
      alert(error.response?.data?.error || "No se pudo cancelar la factura");
    } finally {
      setCancelling(null);
    }
  };

  const cfdiView = configured && view === "cfdi";

  return (
    <Layout>
      <div className="zxin">
        <div className="zxin-inner">
          <div className="zxin-head">
            <div>
              <div className="zxin-eyebrow">Finanzas</div>
              <h1 className="zxin-h1">Facturas</h1>
              {configured && (
                <div className="zxin-sync">Comprobantes fiscales sincronizados con contabilidad-os</div>
              )}
            </div>
            <div className="zxin-actions">
              <Link to="/income" className="zxin-btn">← Ingresos</Link>
              <Link to="/income/invoice-generator" className="zxin-btn solid">+ Generar factura</Link>
            </div>
          </div>

          {configured && (
            <div className="zxin-toggle">
              <button className={`zxin-tbtn${view === "cfdi" ? " active" : ""}`} onClick={() => setView("cfdi")}>CFDI · contabilidad-os</button>
              <button className={`zxin-tbtn${view === "local" ? " active" : ""}`} onClick={() => setView("local")}>Mis facturas ZionX</button>
            </div>
          )}

          {cfdiView ? (
            <>
              <div className="zxin-filter">
                {CFDI_TABS.map((t) => (
                  <button key={t.id} className={`zxin-fbtn${cfdiTipo === t.id ? " active" : ""}`} onClick={() => setCfdiTipo(t.id)}>{t.label}</button>
                ))}
              </div>

              {cfdi.loading ? (
                <div className="zxin-loading">Cargando comprobantes…</div>
              ) : cfdi.facturas.length === 0 ? (
                <div className="zxin-note"><strong>No hay comprobantes en este filtro.</strong></div>
              ) : (
                <div className="zxin-tablewrap">
                  <table className="zxin-table">
                    <thead>
                      <tr>
                        <th>Tipo</th><th>Contraparte</th><th>Folio</th><th>Fecha</th>
                        <th className="r">Total</th><th>Estado</th><th>CFDI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfdi.facturas.map((f) => {
                        const cs = cfdiStatusOf(f.status);
                        const neg = f.tipo === "EGRESO";
                        return (
                          <tr key={f.id}>
                            <td><span className={`zxin-tipo ${tipoCls(f.tipo)}`}>{f.tipo_label}</span></td>
                            <td>{f.contraparte || <span className="muted">{f.rfc || "—"}</span>}{f.contraparte && f.rfc ? <div className="zxin-rfc">{f.rfc}</div> : null}</td>
                            <td>{f.folio || "—"}</td>
                            <td>{fmtDate(f.fecha)}</td>
                            <td className="r" style={neg ? { color: "var(--bad)" } : undefined}>{neg ? "−" : ""}{fmtMoney(Math.abs(f.total))}</td>
                            <td><span className={`zxin-pill ${cs.cls}`}>{cs.label}</span></td>
                            <td>{f.uuid ? <span className="zxin-uuid">{String(f.uuid).slice(-12)}</span> : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="zxin-subrow" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                <div className="zxin-mini"><span className="k">Facturado</span><span className="v">{fmtMoney(totals.billed)}</span></div>
                <div className="zxin-mini"><span className="k">Cobrado</span><span className="v">{fmtMoney(totals.paid)}</span></div>
                <div className="zxin-mini"><span className="k">Por cobrar</span><span className="v" style={{ color: "var(--warn)" }}>{fmtMoney(totals.due)}</span></div>
                <div className="zxin-mini"><span className="k">Vencido</span><span className="v" style={{ color: "var(--bad)" }}>{fmtMoney(totals.overdue)}</span></div>
              </div>

              <div className="zxin-filter">
                {FILTERS.map((f) => (
                  <button key={f.id} className={`zxin-fbtn${filter === f.id ? " active" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>

              {loading ? (
                <div className="zxin-loading">Cargando facturas…</div>
              ) : rows.length === 0 ? (
                <div className="zxin-note"><strong>No hay facturas {filter !== "all" ? "en este filtro" : "todavía"}.</strong>
                  <p><Link to="/income/invoice-generator">Generar la primera factura →</Link></p></div>
              ) : (
                <div className="zxin-tablewrap">
                  <table className="zxin-table">
                    <thead>
                      <tr>
                        <th>Folio</th><th>Cliente</th><th>Fecha</th><th>Vence</th>
                        <th className="r">Total</th><th className="r">Saldo</th><th>Estado</th><th>CFDI</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((inv) => {
                        const st = statusOf(inv.current_status || inv.status);
                        const canCancel = inv.status !== "paid" && inv.status !== "cancelled" && (inv.current_status || inv.status) !== "cancelled";
                        return (
                          <tr key={inv.id}>
                            <td><Link className="lnk" to={`/income/invoices/${inv.id}`}>{inv.invoice_number || `#${inv.id}`}</Link></td>
                            <td>{inv.customer_name || "—"}</td>
                            <td>{fmtDate(inv.invoice_date)}</td>
                            <td>{fmtDate(inv.due_date)}</td>
                            <td className="r">{fmtMoney(inv.total)}</td>
                            <td className="r">{fmtMoney(inv.amount_due)}</td>
                            <td><span className={`zxin-pill ${st.cls}`}>{st.label}</span></td>
                            <td>
                              {inv.cfdi_uuid ? (
                                <div className="zxin-cfdi">
                                  <span className="zxin-pill ok">Timbrada</span>
                                  {inv.cfdi_pdf_url ? (
                                    <a className="zxin-uuid" href={inv.cfdi_pdf_url} target="_blank" rel="noopener noreferrer">
                                      {String(inv.cfdi_uuid).slice(-12)}
                                    </a>
                                  ) : (
                                    <span className="zxin-uuid">{String(inv.cfdi_uuid).slice(-12)}</span>
                                  )}
                                </div>
                              ) : (inv.current_status || inv.status) === "cancelled" || inv.cfdi_status === "CANCELLED" ? (
                                <span className="zxin-pill cancelled">Cancelada</span>
                              ) : (
                                <span className="zxin-pill draft">Sin timbrar</span>
                              )}
                            </td>
                            <td className="r">
                              {canCancel && (
                                <button className="zxin-cancel" disabled={cancelling === inv.id} onClick={() => handleCancelInvoice(inv)}>
                                  {cancelling === inv.id ? "…" : "Cancelar"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default InvoicesManager;
