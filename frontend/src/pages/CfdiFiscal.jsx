import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../utils/constants";
import "./Fiscal.css";

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STATUS = {
  STAMPED: { label: "Timbrada", variant: "ok" },
  DRAFT: { label: "Borrador", variant: "muted" },
  CANCELLED: { label: "Cancelada", variant: "bad" },
};
const statusOf = (s) => STATUS[(s || "").toUpperCase()] || { label: s || "—", variant: "muted" };

const CfdiFiscal = () => {
  const [state, setState] = useState({ loading: true, configured: false, invoices: [], error: null });
  const [q, setQ] = useState("");

  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/income/cfdi/invoices`, { headers })
      .then((r) => setState({ loading: false, configured: !!r.data?.configured, invoices: r.data?.invoices || [], error: r.data?.error || null }))
      .catch((e) => setState({ loading: false, configured: true, invoices: [], error: e.response?.data?.error || e.message }));
  }, [headers]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return state.invoices;
    return state.invoices.filter((i) =>
      [i.uuid, i.customer?.razonSocial, i.customer?.rfc, i.folio].some((v) => (v || "").toString().toLowerCase().includes(term))
    );
  }, [state.invoices, q]);

  const total = rows.reduce((s, i) => s + (Number(i.total) || 0), 0);

  return (
    <Layout>
      <div className="zxf">
        <div className="zxf-inner">
          <div className="zxf-head">
            <div>
              <div className="zxf-eyebrow">Facturación</div>
              <h1 className="zxf-h1">Facturas <span className="zxf-serif">fiscales</span></h1>
            </div>
            {state.configured && (
              <input className="zxf-search" placeholder="Buscar folio, cliente, RFC…" value={q} onChange={(e) => setQ(e.target.value)} />
            )}
          </div>

          {state.loading ? (
            <div className="zxf-empty">Cargando CFDIs…</div>
          ) : !state.configured ? (
            <div className="zxf-note">
              <strong>Integración fiscal no configurada.</strong>
              <p>Conecta contabilidad-os (variables <code>CONTA_OS_*</code>) para ver y emitir CFDIs reales desde ZIONX.</p>
            </div>
          ) : state.error ? (
            <div className="zxf-note error"><strong>No se pudo cargar del hub fiscal.</strong><p>{state.error}</p></div>
          ) : (
            <>
              <div className="zxf-summary">
                <div><span className="k">CFDIs</span><span className="v">{rows.length}</span></div>
                <div><span className="k">Total facturado</span><span className="v">{fmtMoney(total)}</span></div>
              </div>
              <div className="zxf-tablewrap">
                <table className="zxf-table">
                  <thead>
                    <tr>
                      <th>Folio fiscal</th><th>Cliente</th><th>Tipo</th><th className="r">Total</th><th>Fecha</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan="6" className="zxf-empty">Sin CFDIs todavía. Timbra una factura desde su detalle.</td></tr>
                    )}
                    {rows.map((i) => {
                      const st = statusOf(i.status);
                      return (
                        <tr key={i.id || i.uuid}>
                          <td className="mono">{i.uuid || "—"}</td>
                          <td>{i.customer?.razonSocial || i.customer?.rfc || "—"}</td>
                          <td>{i.tipo || "INGRESO"}</td>
                          <td className="r bold">{fmtMoney(i.total)}</td>
                          <td>{fmtDate(i.fecha)}</td>
                          <td><span className={`zxf-pill ${st.variant}`}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CfdiFiscal;
