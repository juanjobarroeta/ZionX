import React, { useState, useEffect, useMemo, useCallback } from "react";
import Layout from "../components/Layout";
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";
import PeriodPicker from "../components/PeriodPicker";
import CeTable from "../components/CeTable";
import "./FiscalMirror.css";

/**
 * Balance general, con la CE como columna vertebral.
 *
 * Misma tesis que el estado de resultados: manda lo declarado al SAT y lo
 * derivado de los CFDIs va al lado. La diferencia es que el balance es una foto
 * acumulada, así que necesita un ancla —el período de la apertura— y antes de
 * ese corte el derivado no significa nada. El hub lo dice y aquí se repite en
 * vez de pintar una columna que nadie puede defender.
 */
export default function BalanceGeneral() {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth() + 1);
  const [st, setSt] = useState({ loading: true, configured: false, data: null, error: null });

  const load = useCallback(() => {
    setSt((s) => ({ ...s, loading: true }));
    axios.get(`${API_BASE_URL}/api/finance/balance`, { headers, params: { year, month } })
      .then((r) => setSt({ loading: false, configured: !!r.data?.configured, data: r.data, error: r.data?.error || null }))
      .catch((e) => setSt({ loading: false, configured: true, data: null, error: e.response?.data?.error || "No se pudo cargar el balance." }));
  }, [headers, year, month]);

  useEffect(() => { load(); }, [load]);

  const d = st.data;
  const notas = [];
  if (d?.antesDelAncla) notas.push("Este corte es anterior a la apertura del libro: sólo hay columna declarada.");
  if (d?.sinBanco) notas.push("Sin asientos de banco en el período: nada liquida las cuentas por cobrar ni por pagar, así que el derivado las muestra completas.");
  if (d?.ancla) notas.push(`El libro derivado arranca en ${String(d.ancla.mes).padStart(2, "0")}/${d.ancla.anio}.`);

  const descuadre = d?.totales?.descuadre;
  const cuadra = descuadre && Math.abs(descuadre.declarado || 0) < 1 && Math.abs(descuadre.derivado || 0) < 1;

  return (
    <Layout>
      <div className="zxfm">
        <div className="zxfm-inner">
          <div className="zxfm-head">
            <div className="eyebrow">Finanzas</div>
            <h1>Balance <span className="zxfm-serif">general</span></h1>
            {st.configured && !st.error && <div className="zxfm-sync">Sincronizado con contabilidad-os</div>}
          </div>

          {!st.loading && !st.configured ? (
            <div className="zxfm-empty">
              <div className="lead">Integración fiscal no configurada</div>
              <div>Conecta contabilidad-os para ver el balance aquí.</div>
            </div>
          ) : (
            <>
              <div className="zxfm-controls">
                <PeriodPicker year={year} month={month}
                              onChange={({ year: y, month: m }) => { setYear(y); setMonth(m); }} />
              </div>

              {st.loading ? <div className="zxfm-loading">Cargando…</div>
                : st.error ? <div className="zxfm-empty small"><div className="lead">{st.error}</div></div>
                : (
                  <>
                    <CeTable
                      presentado={d?.presentado}
                      grupos={d?.grupos || []}
                      nota={notas.length ? notas.join(" ") : null}
                      pie={[
                        { label: "Resultado del ejercicio", ...(d?.resultado || {}) },
                        { label: "Total activo", declarado: d?.totales?.activo?.declarado, derivado: d?.totales?.activo?.derivado, fuerte: true },
                        { label: "Pasivo + capital + resultado", declarado: d?.totales?.pasivoCapitalResultado?.declarado, derivado: d?.totales?.pasivoCapitalResultado?.derivado, fuerte: true },
                      ]}
                    />
                    {descuadre && (
                      <div className={`zxfm-cuadre ${cuadra ? "ok" : "off"}`}>
                        {cuadra
                          ? "La foto cuadra: activo igual a pasivo más capital."
                          : `Descuadre — declarado ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(descuadre.declarado || 0)} · derivado ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(descuadre.derivado || 0)}`}
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
