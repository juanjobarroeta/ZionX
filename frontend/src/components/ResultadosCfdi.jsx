import React, { useState } from "react";
import CfdiVisor from "./CfdiVisor";
import "./ResultadosCfdi.css";

/**
 * El estado de resultados del mes, armado con los comprobantes.
 *
 * Una columna, no tres: aquí no hay nada declarado contra qué comparar — esto
 * ES lo que dicen los CFDIs. Cada rubro se abre a sus contrapartes y cada
 * contraparte a sus comprobantes, y cualquiera se abre en el visor.
 */

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
const dia = (d) => (d ? new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—");

export default function ResultadosCfdi({ data }) {
  const [abierto, setAbierto] = useState(null);   // clave de rubro
  const [visor, setVisor] = useState(null);
  const { rubros = [], resultado = {}, comprobantes = 0, ignorados = {} } = data || {};

  const nota = [];
  if (ignorados.pago) nota.push(`${ignorados.pago} complemento${ignorados.pago === 1 ? "" : "s"} de pago`);
  if (ignorados.cancelados) nota.push(`${ignorados.cancelados} cancelado${ignorados.cancelados === 1 ? "" : "s"}`);
  if (ignorados.traslado) nota.push(`${ignorados.traslado} traslado${ignorados.traslado === 1 ? "" : "s"}`);

  return (
    <div className="zxrc">
      <div className="zxrc-flag">
        Armado con {comprobantes} comprobante{comprobantes === 1 ? "" : "s"} del mes.
        {nota.length > 0 && (
          <> Fuera: {nota.join(", ")} — un complemento de pago es un cobro, no una venta, y contarlo la duplicaría.</>
        )}
      </div>

      {rubros.map((r) => {
        const vacio = r.cuentas.length === 0;
        const on = abierto === r.clave;
        return (
          <div className="zxrc-rubro" key={r.clave}>
            <button className={`zxrc-head${on ? " on" : ""}`} onClick={() => setAbierto(on ? null : r.clave)}
                    disabled={vacio} aria-expanded={on}>
              <span className="c"><i className={`zxrc-caret${on ? " on" : ""}`} aria-hidden="true">›</i>{r.titulo}</span>
              <span className="n">{r.cuentas.length} contraparte{r.cuentas.length === 1 ? "" : "s"}</span>
              <span className={`m ${r.clave === "ingresos" ? "pos" : "neg"}`}>
                {r.clave === "ingresos" ? "" : "−"}{fmt(Math.abs(r.monto))}
              </span>
            </button>

            {on && r.cuentas.map((c) => (
              <div className="zxrc-parte" key={c.clave}>
                <div className="zxrc-phead">
                  <span className="who">{c.nombre}{c.rfc && <em>{c.rfc}</em>}</span>
                  <span className="q">{c.cfdis.length} CFDI{c.cfdis.length === 1 ? "" : "s"}</span>
                  <span className="m">{fmt(c.monto)}</span>
                </div>
                {c.cfdis.map((f) => (
                  <div className="zxrc-cfdi" key={f.id}>
                    <span className="f">{dia(f.fecha)}</span>
                    <span className="d">
                      {f.folio || "Sin folio"}
                      {f.credito && <b className="nc">nota de crédito</b>}
                      <em>{f.uuid}</em>
                    </span>
                    <span className="m">{fmt(f.monto)}</span>
                    <span className="a">
                      {f.representable
                        ? <button className="zxrc-ver" onClick={() => setVisor(f)}>Ver</button>
                        : <span className="sin">sin XML</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      <div className="zxrc-total">
        <span>Resultado del período</span>
        <span className={Number(resultado.utilidad) >= 0 ? "pos" : "neg"}>{fmt(resultado.utilidad)}</span>
      </div>

      {visor && <CfdiVisor invoiceId={visor.id} uuid={visor.uuid} onCerrar={() => setVisor(null)} />}
    </div>
  );
}
