import React from "react";
import "./CeTable.css";

/**
 * La tabla de tres columnas: declarado, derivado, diferencia.
 *
 * El estado de resultados y el balance tienen la misma forma —grupos con
 * cuentas, y cada renglón con sus tres cifras— así que comparten la tabla. Que
 * cada pantalla dibujara la suya es cómo dos vistas del mismo dato terminan
 * enseñando la diferencia de dos maneras distintas.
 *
 * La diferencia se muestra siempre que haya período presentado. Esconderla
 * sería lo prudente sólo si fuera enorme, y entonces sería justo lo peor.
 */

const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);

export default function CeTable({
  presentado,
  grupos = [],
  pie = null,
  nota = null,
  onAbrirCuenta = null,
  cuentaAbierta = null,
  children,
}) {
  return (
    <div className="zxce">
      <div className={`zxce-flag ${presentado ? "ok" : "prelim"}`}>
        {presentado
          ? "Período presentado al SAT — lo declarado manda; el derivado de los CFDIs va al lado como evidencia."
          : "Período sin presentar — sólo hay cifras derivadas de los CFDIs. Dice dónde va a cerrar el mes."}
      </div>
      {nota && <div className="zxce-nota">{nota}</div>}

      <div className="zxce-head">
        <span className="n">Cuenta</span>
        <span className="v">{presentado ? "Declarado" : "—"}</span>
        <span className="v">Derivado</span>
        <span className="v">Diferencia</span>
      </div>

      {grupos.filter((g) => g.cuentas?.length || g.declarado || g.derivado).map((g) => (
        <div className="zxce-grupo" key={g.clave}>
          <div className="zxce-ghead">{g.titulo}</div>
          {(g.cuentas || []).map((c) => {
            const abierta = cuentaAbierta === c.numCta;
            const clickable = Boolean(onAbrirCuenta);
            return (
              <React.Fragment key={c.numCta}>
                <div
                  className={`zxce-line${clickable ? " clickable" : ""}${abierta ? " abierta" : ""}`}
                  onClick={clickable ? () => onAbrirCuenta(abierta ? null : c.numCta) : undefined}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? (e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrirCuenta(abierta ? null : c.numCta); }
                  } : undefined}
                >
                  <span className="n">
                    {clickable && <i className={`zxce-caret${abierta ? " on" : ""}`} aria-hidden="true">›</i>}
                    <em>{c.numCta}</em> {c.nombre}
                  </span>
                  <span className="v">{presentado ? fmt(c.declarado) : "—"}</span>
                  <span className="v">{fmt(c.derivado)}</span>
                  <span className={`v d${presentado && Math.abs(c.diferencia) > 0.5 ? " on" : ""}`}>
                    {presentado ? fmt(c.diferencia) : "—"}
                  </span>
                </div>
                {abierta && children}
              </React.Fragment>
            );
          })}
          <div className="zxce-line total">
            <span className="n">Total {g.titulo.toLowerCase()}</span>
            <span className="v">{presentado ? fmt(g.declarado) : "—"}</span>
            <span className="v">{fmt(g.derivado)}</span>
            <span className={`v d${presentado && Math.abs(g.diferencia) > 0.5 ? " on" : ""}`}>
              {presentado ? fmt(g.diferencia) : "—"}
            </span>
          </div>
        </div>
      ))}

      {pie?.map((f) => (
        <div className={`zxce-line result${f.fuerte ? " fuerte" : ""}`} key={f.label}>
          <span className="n">{f.label}</span>
          <span className={`v ${Number(f.declarado) >= 0 ? "pos" : "neg"}`}>{presentado ? fmt(f.declarado) : "—"}</span>
          <span className={`v ${Number(f.derivado) >= 0 ? "pos" : "neg"}`}>{fmt(f.derivado)}</span>
          <span className="v d">{presentado && f.diferencia != null ? fmt(f.diferencia) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
