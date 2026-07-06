import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./FiscalMirror.css";

const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

// periodo is stored as "YYYY-MM-DD/YYYY-MM-DD".
const fmtPeriodo = (p) => {
  if (!p) return "—";
  const [a, b] = String(p).split("/");
  return b ? `${fmtDate(a)} – ${fmtDate(b)}` : fmtDate(a);
};

const TIPO_LABEL = {
  ORDINARIA: "Ordinaria", EXTRAORDINARIA: "Extraordinaria", FINIQUITO: "Finiquito",
  AGUINALDO: "Aguinaldo", VACACIONES: "Vacaciones", PTU: "PTU",
};
const STATUS = {
  DRAFT: { label: "Borrador", cls: "muted" },
  CALCULATED: { label: "Calculada", cls: "warn" },
  STAMPED: { label: "Timbrada", cls: "ok" },
  PAID: { label: "Pagada", cls: "ok" },
};
const statusOf = (s) => STATUS[(s || "").toUpperCase()] || { label: s || "—", cls: "muted" };
const empName = (e) => [e?.nombre, e?.apellidoPaterno].filter(Boolean).join(" ") || e?.rfc || "—";

const NominaFiscal = () => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [state, setState] = useState({ loading: true, configured: false, runs: [] });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({ loading: false, run: null });

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/nomina/runs`, { headers })
      .then((r) => setState({ loading: false, configured: !!r.data?.configured, runs: r.data?.runs || [] }))
      .catch(() => setState({ loading: false, configured: false, runs: [] }));
  }, [headers]);

  const toggle = async (run) => {
    if (openId === run.id) { setOpenId(null); return; }
    setOpenId(run.id);
    setDetail({ loading: true, run: null });
    try {
      const r = await axios.get(`${API_BASE_URL}/api/nomina/runs/${run.id}`, { headers });
      setDetail({ loading: false, run: r.data?.run || null });
    } catch {
      setDetail({ loading: false, run: null });
    }
  };

  return (
    <Layout>
      <div className="zxfm">
        <div className="zxfm-inner">
          <div className="zxfm-head">
            <div className="eyebrow">Nómina</div>
            <h1>Nómina <span className="zxfm-serif">fiscal</span></h1>
            {state.configured && <div className="zxfm-sync">Sincronizado con contabilidad-os</div>}
          </div>

          {state.loading ? (
            <div className="zxfm-loading">Cargando corridas…</div>
          ) : !state.configured ? (
            <div className="zxfm-empty">
              <div className="lead">Integración fiscal no configurada</div>
              <div>Conecta contabilidad-os para ver las corridas de nómina y sus recibos aquí.</div>
            </div>
          ) : state.runs.length === 0 ? (
            <div className="zxfm-empty"><div className="lead">Sin corridas de nómina</div></div>
          ) : (
            <div className="zxfm-list">
              {state.runs.map((run) => {
                const st = statusOf(run.status);
                const open = openId === run.id;
                return (
                  <div key={run.id} className={`zxfm-card${open ? " open" : ""}`}>
                    <button className="zxfm-row" onClick={() => toggle(run)}>
                      <div className="zxfm-row-main">
                        <div className="zxfm-row-title">{fmtPeriodo(run.periodo)}</div>
                        <div className="zxfm-row-sub">
                          {TIPO_LABEL[run.tipo] || run.tipo} · {run._count?.items ?? 0} empleados · Pago {fmtDate(run.fechaPago)}
                        </div>
                      </div>
                      <div className="zxfm-row-amt">{fmtMoney(run.totalNeto)}</div>
                      <span className={`zxfm-pill v-${st.cls}`}>{st.label}</span>
                    </button>

                    {open && (
                      <div className="zxfm-detail">
                        {detail.loading ? (
                          <div className="zxfm-detail-loading">Cargando recibos…</div>
                        ) : !detail.run?.items?.length ? (
                          <div className="zxfm-detail-loading">Sin recibos.</div>
                        ) : (
                          <table className="zxfm-table">
                            <thead>
                              <tr>
                                <th>Empleado</th><th className="r">Percepciones</th>
                                <th className="r">Deducciones</th><th className="r">Neto</th><th>CFDI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.run.items.map((it) => (
                                <tr key={it.id}>
                                  <td>{empName(it.employee)}</td>
                                  <td className="r">{fmtMoney(it.totalPercepciones)}</td>
                                  <td className="r">{fmtMoney(it.totalDeducciones)}</td>
                                  <td className="r strong">{fmtMoney(it.netoAPagar)}</td>
                                  <td>{it.cfdiUuid ? <span className="zxfm-uuid">{String(it.cfdiUuid).slice(-12)}</span> : <span className="muted">Sin timbrar</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default NominaFiscal;
