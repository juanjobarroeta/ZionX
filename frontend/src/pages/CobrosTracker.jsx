import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PageShell from "../components/PageShell";
import { API_BASE_URL } from "../utils/constants";
import "./CobrosTracker.css";

const IVA = 0.16;
const fmtMoney = (n) =>
  `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m) => {
  const [y, mo] = (m || "").split("-").map(Number);
  if (!y) return "";
  return new Date(y, mo - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
};

const CobrosTracker = () => {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState({ totals: { total: 0, cobrado: 0, pendiente: 0, count: 0 }, charges: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");

  const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  const fetchCharges = useCallback(async (m) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/income/charges`, { headers, params: { month: m } });
      setData(res.data || { totals: {}, charges: [] });
    } catch (err) {
      console.error("Error fetching charges:", err);
      setData({ totals: { total: 0, cobrado: 0, pendiente: 0, count: 0 }, charges: [] });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchCharges(month); }, [month, fetchCharges]);

  const generate = async () => {
    setWorking(true); setMsg("");
    try {
      const res = await axios.post(`${API_BASE_URL}/api/income/subscriptions/generate-charges`, { month }, { headers });
      const n = res.data?.synced ?? res.data?.created ?? 0;
      setMsg(n ? `${n} cobro(s) generado(s)/actualizado(s) para ${monthLabel(month)}.` : `Sin cambios — los cobros ya están al día.`);
      await fetchCharges(month);
    } catch (err) {
      console.error(err);
      setMsg("No se pudieron generar los cobros.");
    } finally { setWorking(false); }
  };

  const align = async () => {
    if (!window.confirm("Alinear todas las suscripciones activas para cobrar en el mes actual. ¿Continuar?")) return;
    setWorking(true); setMsg("");
    try {
      const res = await axios.post(`${API_BASE_URL}/api/income/subscriptions/align-current-month`, {}, { headers });
      setMsg(`${res.data?.updated || 0} suscripción(es) alineadas al mes actual.`);
    } catch (err) {
      console.error(err);
      setMsg("No se pudo alinear las suscripciones.");
    } finally { setWorking(false); }
  };

  const patchCharge = async (charge, body) => {
    setBusyId(charge.id);
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/income/charges/${charge.id}`, body, { headers });
      setData((d) => ({ ...d, charges: d.charges.map((c) => (c.id === charge.id ? res.data.charge : c)) }));
      // Recompute totals locally.
      setData((d) => {
        const totals = d.charges.reduce((a, c) => {
          const amt = Number(c.amount) || 0; a.total += amt;
          if (c.status === "cobrado") a.cobrado += amt; else a.pendiente += amt;
          return a;
        }, { total: 0, cobrado: 0, pendiente: 0, count: d.charges.length });
        return { ...d, totals };
      });
    } catch (err) {
      console.error("Error updating charge:", err);
      alert("No se pudo actualizar el cobro.");
    } finally { setBusyId(null); }
  };

  const markCobrado = (charge) => {
    const method = window.prompt("Método de cobro (Transferencia, Efectivo, Tarjeta, …):", "Transferencia");
    if (method === null) return; // cancelled
    patchCharge(charge, { status: "cobrado", payment_method: method || null });
  };
  const markPendiente = (charge) => patchCharge(charge, { status: "pendiente" });
  const toggleFactura = (charge) => patchCharge(charge, { requires_invoice: !charge.requires_invoice });

  const t = data.totals || {};

  return (
    <PageShell
      className="zxcob"
      eyebrow="Finanzas · Ingresos"
      title="Cobros del"
      titleAccent="mes"
      actions={
        <>
          <input
            className="zx-input sm"
            style={{ width: "auto" }}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            aria-label="Mes"
          />
          <button className="zx-btn on-ink" onClick={generate} disabled={working} title="Crea los cobros del mes y actualiza los pendientes si cambió una suscripción (no toca los ya cobrados)">
            {working ? "…" : "Generar / actualizar"}
          </button>
          <button className="zx-btn on-ink ghost" onClick={align} disabled={working} title="Ajusta la próxima facturación de todas las suscripciones activas al mes actual">
            Alinear al mes
          </button>
        </>
      }
      telemetry={[
        { k: "Cobros", v: t.count || 0 },
        { k: "Total del mes", v: fmtMoney(t.total) },
        { k: "Cobrado", v: fmtMoney(t.cobrado) },
        { k: "Pendiente", v: fmtMoney(t.pendiente), tone: "brass" },
      ]}
    >
          {msg && <div className="zxcob-note">{msg}</div>}

          <div className="zxcob-card">
            <div className="zxcob-card-head">
              {monthLabel(month)}
              <span className="zxcob-count">{data.charges.length} cobro{data.charges.length === 1 ? "" : "s"}</span>
            </div>

            {loading ? (
              <div className="zxcob-empty">Cargando cobros…</div>
            ) : data.charges.length === 0 ? (
              <div className="zxcob-empty">
                <div className="lead">Aún no hay cobros para {monthLabel(month)}</div>
                <div>Usa <b>Generar cobros del mes</b> para crearlos a partir de las suscripciones activas.</div>
              </div>
            ) : (
              <div className="zxcob-tablewrap">
                <table className="zxcob-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="r">Monto</th>
                      <th className="r">Con IVA</th>
                      <th>Factura</th>
                      <th>Estado</th>
                      <th className="r">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charges.map((c) => {
                      const cobrado = c.status === "cobrado";
                      return (
                        <tr key={c.id} className={cobrado ? "is-paid" : ""}>
                          <td>
                            <div className="zxcob-cust">{c.customer_name}</div>
                            {c.package_name && <div className="zxcob-sub">{c.package_name}</div>}
                          </td>
                          <td className="r mono">{fmtMoney(c.amount)}</td>
                          <td className="r mono muted">{c.applies_iva ? fmtMoney(Number(c.amount) * (1 + IVA)) : <span title="Sin IVA">{fmtMoney(c.amount)} <em style={{ fontStyle: "normal", opacity: 0.6 }}>· sin IVA</em></span>}</td>
                          <td>
                            <button
                              className={`zxcob-flag ${c.requires_invoice ? "on" : "off"}`}
                              disabled={busyId === c.id}
                              onClick={() => toggleFactura(c)}
                              title="Marca si este cliente requiere factura (CFDI)"
                            >
                              {c.requires_invoice ? "Requiere factura" : "Sin factura"}
                            </button>
                            {c.invoice_number && (
                              <span className="zxcob-invnum">· {c.invoice_number}</span>
                            )}
                          </td>
                          <td>
                            <span className={`zxcob-pill ${cobrado ? "ok" : "warn"}`}>
                              {cobrado ? "Cobrado" : "Pendiente"}
                            </span>
                            {cobrado && c.payment_method && <span className="zxcob-method">{c.payment_method}</span>}
                          </td>
                          <td className="r">
                            <div className="zxcob-actions">
                              {cobrado ? (
                                <button className="zxcob-act" disabled={busyId === c.id} onClick={() => markPendiente(c)}>Marcar pendiente</button>
                              ) : (
                                <button className="zxcob-act primary" disabled={busyId === c.id} onClick={() => markCobrado(c)}>Cobrar</button>
                              )}
                              {c.requires_invoice && !c.invoice_number && (
                                <Link className="zxcob-act link" to={`/income/invoice-generator?subscription_id=${c.subscription_id}&customer_id=${c.customer_id}`}>
                                  Facturar
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
    </PageShell>
  );
};

export default CobrosTracker;
