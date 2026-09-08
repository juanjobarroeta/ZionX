import React, { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import "./FiscalMirror.css";

/**
 * Lo declarado al SAT en el ejercicio, y lo que falta.
 *
 * Dos listas que se leen juntas: las declaraciones capturadas —con su importe,
 * su estatus y si tienen acuse— y los acuses faltantes. Lo segundo importa
 * tanto como lo primero: sin acuse no se arrastran saldos a favor ni el
 * coeficiente, así que un hueco aquí cuesta dinero más adelante.
 */

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Declaraciones() {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [st, setSt] = useState({ loading: true, configured: false, data: null, error: null });

  const load = useCallback(() => {
    setSt((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/declaraciones`, { headers, params: { year } })
      .then((r) => setSt({ loading: false, configured: !!r.data?.configured, data: r.data, error: r.data?.error || null }))
      .catch((e) => setSt({ loading: false, configured: true, data: null, error: e.response?.data?.error || "No se pudieron cargar las declaraciones." }));
  }, [headers, year]);

  useEffect(() => { load(); }, [load]);

  const d = st.data;
  // El hub ha usado más de un nombre para esta lista según el endpoint; se
  // toma la primera que venga en vez de asumir una sola.
  const lista = d?.declaraciones || d?.historial || d?.items || [];
  const faltantes = d?.cobertura?.faltantes || d?.cobertura?.meses || [];
  const years = [hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2];

  return (
    <Layout>
      <div className="zxfm">
        <div className="zxfm-inner">
          <div className="zxfm-head">
            <div className="eyebrow">Finanzas</div>
            <h1>Declaraciones <span className="zxfm-serif">al SAT</span></h1>
            {st.configured && !st.error && <div className="zxfm-sync">Sincronizado con contabilidad-os</div>}
          </div>

          {!st.loading && !st.configured ? (
            <div className="zxfm-empty">
              <div className="lead">Integración fiscal no configurada</div>
              <div>Conecta contabilidad-os para ver las declaraciones aquí.</div>
            </div>
          ) : (
            <>
              <div className="zxfm-controls">
                <div className="zxdec-years">
                  {years.map((y) => (
                    <button key={y} className={`zxdec-year${y === year ? " on" : ""}`} onClick={() => setYear(y)}>{y}</button>
                  ))}
                </div>
              </div>

              {st.loading ? <div className="zxfm-loading">Cargando…</div>
                : st.error ? <div className="zxfm-empty small"><div className="lead">{st.error}</div></div>
                : (
                  <>
                    {faltantes.length > 0 && (
                      <div className="zxfm-cuadre off">
                        {faltantes.length === 1
                          ? "Falta un acuse. Sin él no se arrastran saldos a favor ni el coeficiente de utilidad."
                          : `Faltan ${faltantes.length} acuses. Sin ellos no se arrastran saldos a favor ni el coeficiente de utilidad.`}
                      </div>
                    )}

                    {lista.length === 0 ? (
                      <div className="zxfm-empty small"><div className="lead">Sin declaraciones capturadas en {year}</div></div>
                    ) : (
                      <div className="zxdec">
                        <div className="zxdec-head">
                          <span>Período</span><span>Tipo</span><span className="r">Importe</span><span>Estatus</span><span>Acuse</span>
                        </div>
                        {lista.map((row, i) => {
                          const mes = row.mes ?? row.month;
                          const pagado = Number(row.importe ?? row.monto ?? row.total ?? 0);
                          const tieneAcuse = Boolean(row.acuseUrl || row.acuseId || row.tieneAcuse || row.acuse);
                          return (
                            <div className="zxdec-row" key={row.id || `${mes}-${row.tipo}-${i}`}>
                              <span className="p">{mes ? MESES[mes] : "Anual"} {row.anio || row.year || year}</span>
                              <span className="t">{row.tipo || row.impuesto || "—"}</span>
                              <span className="r">{fmt(pagado)}</span>
                              <span className={`e ${String(row.estatus || row.status || "").toLowerCase()}`}>
                                {row.estatus || row.status || "—"}
                              </span>
                              <span className={`a ${tieneAcuse ? "si" : "no"}`}>{tieneAcuse ? "Sí" : "Falta"}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
