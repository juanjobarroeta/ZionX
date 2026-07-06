import React, { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./FiscalMirror.css";

const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const TABS = [
  { id: "resultados", label: "Estado de resultados" },
  { id: "balanza", label: "Balanza de comprobación" },
];

const EstadosFinancieros = () => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const nowD = new Date();
  const [year, setYear] = useState(nowD.getFullYear());
  const [month, setMonth] = useState(nowD.getMonth() + 1);
  const [tab, setTab] = useState("resultados");
  const [er, setEr] = useState({ loading: true, configured: false, data: null });
  const [bz, setBz] = useState({ loading: false, configured: false, rows: [], preliminar: false });

  const loadER = useCallback(() => {
    setEr((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/estado-resultados`, { headers, params: { year, month } })
      .then((r) => setEr({ loading: false, configured: !!r.data?.configured, data: r.data }))
      .catch(() => setEr({ loading: false, configured: false, data: null }));
  }, [headers, year, month]);

  const loadBZ = useCallback(() => {
    setBz((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/balanza`, { headers, params: { year, month } })
      .then((r) => setBz({ loading: false, configured: !!r.data?.configured, rows: r.data?.rows || [], preliminar: !!r.data?.preliminar }))
      .catch(() => setBz({ loading: false, configured: false, rows: [], preliminar: false }));
  }, [headers, year, month]);

  useEffect(() => { loadER(); }, [loadER]);
  useEffect(() => { if (tab === "balanza") loadBZ(); }, [tab, loadBZ]);

  const configured = er.configured;
  const years = [nowD.getFullYear(), nowD.getFullYear() - 1, nowD.getFullYear() - 2];

  const Section = ({ title, rows, total, totalLabel }) => (
    <div className="zxfm-fs-section">
      <div className="zxfm-fs-shead">{title}</div>
      {(rows || []).map((r, i) => (
        <div className="zxfm-fs-line" key={`${r.cuentaSAT}-${i}`}>
          <span className="n">{r.nombre}</span>
          <span className="v">{fmtMoney(r.monto)}</span>
        </div>
      ))}
      <div className="zxfm-fs-line total">
        <span className="n">{totalLabel}</span>
        <span className="v">{fmtMoney(total)}</span>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="zxfm">
        <div className="zxfm-inner">
          <div className="zxfm-head">
            <div className="eyebrow">Finanzas</div>
            <h1>Estados <span className="zxfm-serif">financieros</span></h1>
            {configured && <div className="zxfm-sync">Sincronizado con contabilidad-os</div>}
          </div>

          {!er.loading && !configured ? (
            <div className="zxfm-empty">
              <div className="lead">Integración fiscal no configurada</div>
              <div>Conecta contabilidad-os para ver el estado de resultados y la balanza aquí.</div>
            </div>
          ) : (
            <>
              <div className="zxfm-controls">
                <select className="zxfm-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select className="zxfm-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="zxfm-tabs">
                  {TABS.map((t) => (
                    <button key={t.id} className={`zxfm-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>

              {tab === "resultados" ? (
                er.loading ? <div className="zxfm-loading">Cargando…</div> : (
                  <div className="zxfm-fs">
                    {er.data?.preliminar && <div className="zxfm-prelim">Cifras preliminares (periodo sin cierre contable)</div>}
                    <Section title="Ingresos" rows={er.data?.ingresos} total={er.data?.totalIngresos} totalLabel="Total ingresos" />
                    {er.data?.costos?.length > 0 && (
                      <Section title="Costos" rows={er.data?.costos} total={er.data?.totalCostos} totalLabel="Total costos" />
                    )}
                    <Section title="Gastos" rows={er.data?.gastos} total={er.data?.totalGastos} totalLabel="Total gastos" />
                    <div className="zxfm-fs-result">
                      <span>Utilidad antes de impuestos</span>
                      <span className={Number(er.data?.utilidadAntesImpuestos) >= 0 ? "pos" : "neg"}>
                        {fmtMoney(er.data?.utilidadAntesImpuestos)}
                      </span>
                    </div>
                  </div>
                )
              ) : (
                bz.loading ? <div className="zxfm-loading">Cargando…</div> : bz.rows.length === 0 ? (
                  <div className="zxfm-empty small"><div className="lead">Sin movimientos en el periodo</div></div>
                ) : (
                  <div className="zxfm-tablewrap">
                    {bz.preliminar && <div className="zxfm-prelim">Cifras preliminares (periodo sin cierre contable)</div>}
                    <table className="zxfm-table">
                      <thead>
                        <tr>
                          <th>Cuenta</th><th>Nombre</th><th className="r">Inicial</th>
                          <th className="r">Cargos</th><th className="r">Abonos</th><th className="r">Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bz.rows.map((r, i) => (
                          <tr key={`${r.cuentaSAT}-${r.subcuenta || ""}-${i}`}>
                            <td className="mono">{r.cuentaSAT}{r.subcuenta ? `-${r.subcuenta}` : ""}</td>
                            <td>{r.nombre}</td>
                            <td className="r">{fmtMoney(r.saldoInicial)}</td>
                            <td className="r">{fmtMoney(r.cargos)}</td>
                            <td className="r">{fmtMoney(r.abonos)}</td>
                            <td className="r strong">{fmtMoney(r.saldoFinal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default EstadosFinancieros;
