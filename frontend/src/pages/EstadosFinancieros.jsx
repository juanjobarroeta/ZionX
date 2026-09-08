import React, { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import PeriodPicker from "../components/PeriodPicker";
import CeTable from "../components/CeTable";
import CuentaDocumentos from "../components/CuentaDocumentos";
import ResultadosCfdi from "../components/ResultadosCfdi";
import PeriodoVacio from "../components/PeriodoVacio";
import "./FiscalMirror.css";

const fmtMoney = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const TABS = [
  { id: "resultados", label: "Estado de resultados" },
  { id: "ce", label: "Versión contable (CE)" },
  { id: "balanza", label: "Balanza de comprobación" },
];

const EstadosFinancieros = () => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const nowD = new Date();
  const [year, setYear] = useState(nowD.getFullYear());
  const [month, setMonth] = useState(nowD.getMonth() + 1);
  const [tab, setTab] = useState("resultados");
  const [er, setEr] = useState({ loading: true, configured: false, ce: null, data: null });
  const [ytd, setYtd] = useState(false);
  const [ce, setCe] = useState({ loading: false, data: null });
  // Qué renglón está abierto. Uno a la vez: abrir varios convierte la pantalla
  // en una lista de listas y se pierde el estado de resultados.
  const [cuenta, setCuenta] = useState(null);
  const [bz, setBz] = useState({ loading: false, configured: false, rows: [], preliminar: false });

  // El estado de resultados con la CE como columna vertebral: lo declarado al
  // SAT manda, lo derivado de los CFDIs va al lado como evidencia. Si el hub no
  // lo tiene o falla, se cae al de siempre — que da el mismo número sin decir
  // de dónde sale.
  // El estado de resultados se arma con los CFDIs. La versión de Contabilidad
  // Electrónica sigue disponible en su pestaña: es la exacta cuando el mes está
  // presentado, pero está vacía hasta que el contador cierra — y los
  // comprobantes existen desde que el SAT los entrega.
  const loadER = useCallback(() => {
    setEr((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/resultados-cfdi`, { headers, params: { year, month } })
      .then((r) => setEr({ loading: false, configured: !!r.data?.configured, cfdi: r.data, ce: null, data: null }))
      .catch((e) => setEr({ loading: false, configured: true, cfdi: null, ce: null, data: null,
                            error: e.response?.data?.error || "No se pudo armar el estado de resultados." }));
  }, [headers, year, month]);

  // La de CE, sólo cuando se pide: cuesta una llamada al hub.
  const loadCE = useCallback(() => {
    setCe((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/ce-estado-resultados`, { headers, params: { year, month, ytd: ytd ? 1 : undefined } })
      .then((r) => setCe({ loading: false, data: r.data }))
      .catch((e) => setCe({ loading: false, data: null, error: e.response?.data?.error || "No se pudo cargar la versión CE." }));
  }, [headers, year, month, ytd]);

  const loadBZ = useCallback(() => {
    setBz((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/balanza`, { headers, params: { year, month } })
      .then((r) => setBz({ loading: false, configured: !!r.data?.configured, rows: r.data?.rows || [], preliminar: !!r.data?.preliminar }))
      .catch(() => setBz({ loading: false, configured: false, rows: [], preliminar: false }));
  }, [headers, year, month]);

  useEffect(() => { loadER(); }, [loadER]);
  useEffect(() => { if (tab === "balanza") loadBZ(); }, [tab, loadBZ]);
  useEffect(() => { if (tab === "ce") loadCE(); }, [tab, loadCE]);

  const configured = er.configured;

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
                <PeriodPicker
                  year={year} month={month}
                  onChange={({ year: y, month: m }) => { setYear(y); setMonth(m); }}
                  ytd={ytd} onYtdChange={setYtd}
                />
                <div className="zxfm-tabs">
                  {TABS.map((t) => (
                    <button key={t.id} className={`zxfm-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
                  ))}
                </div>
              </div>

              {tab === "resultados" ? (
                er.loading ? <div className="zxfm-loading">Cargando…</div>
                : er.error ? <div className="zxfm-empty small"><div className="lead">{er.error}</div></div>
                : er.cfdi?.comprobantes === 0 ? (
                  <div className="zxfm-empty small">
                    <div className="lead">Sin comprobantes en este mes</div>
                    <div>No hay CFDIs del período en contabilidad-os. Si esperabas alguno, la descarga del SAT todavía no lo cubre.</div>
                  </div>
                ) : <ResultadosCfdi data={er.cfdi} />
              ) : tab === "ce" ? (
                ce.loading ? <div className="zxfm-loading">Cargando…</div>
                : ce.error ? <div className="zxfm-empty small"><div className="lead">{ce.error}</div></div>
                : ce.data && Array.isArray(ce.data.rubros) && ce.data.rubros.some((r) => r.cuentas?.length) ? (
                  <CeTable
                    presentado={ce.data.presentado}
                    grupos={ce.data.rubros}
                    pie={[{ label: "Resultado del período", ...ce.data.resultado, fuerte: true }]}
                    cuentaAbierta={cuenta}
                    onAbrirCuenta={setCuenta}
                  >
                    {cuenta && <CuentaDocumentos cuenta={cuenta} year={year} month={month} ytd={ytd} />}
                  </CeTable>
                ) : <PeriodoVacio periodo={ce.data?.periodo} year={year} month={month} />
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
