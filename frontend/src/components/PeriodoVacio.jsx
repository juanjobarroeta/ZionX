import React from "react";

/**
 * Por qué este mes no tiene cifras.
 *
 * Una tabla vacía no es una respuesta: son tres problemas distintos y sólo uno
 * se arregla desde aquí. El período puede ser anterior a la apertura del libro
 * (no hay de dónde sacar nada), puede no tener CFDIs (falta la descarga del
 * SAT), o tenerlos sin contabilizar (falta correr el posteo en el hub).
 */
export default function PeriodoVacio({ periodo, year, month }) {
  const MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const cuando = `${MESES[month]} de ${year}`;
  const p = periodo || {};

  let titulo = `Sin movimientos en ${cuando}`;
  let cuerpo = "El hub no devolvió cifras para este período.";

  const antesDelLibro = p.primero && (year < p.primero.year || (year === p.primero.year && month < p.primero.month));

  if (antesDelLibro) {
    titulo = `${cuando} es anterior a la apertura del libro`;
    cuerpo = `La contabilidad arranca en ${MESES[p.primero.month]} de ${p.primero.year}. Antes de ese corte no hay asientos de los que derivar cifras — y si necesitas ese mes, hay que cargar la contabilidad electrónica de ese ejercicio en contabilidad-os.`;
  } else if (!p.existe) {
    titulo = `${cuando} no tiene CFDIs cargados`;
    cuerpo = "El período ni siquiera existe en el libro, lo que normalmente significa que la descarga del SAT todavía no lo cubre. Se resuelve en contabilidad-os, no aquí.";
  } else if (p.estado === "DRAFT" && p.asientos === 0) {
    titulo = `${cuando} está en borrador`;
    cuerpo = "Sus CFDIs están cargados pero nadie los ha contabilizado, así que no hay asientos que sumar. En contabilidad-os se postea el mes y las cifras aparecen aquí.";
  } else if (p.asientos === 0) {
    titulo = `${cuando} no tiene asientos`;
    cuerpo = `El período existe (${p.estado || "sin estado"}) pero sin movimientos contables.`;
  } else {
    cuerpo = `El período tiene ${p.asientos} asiento${p.asientos === 1 ? "" : "s"} pero ninguno cayó en cuentas de resultado.`;
  }

  return (
    <div className="zxfm-empty small">
      <div className="lead">{titulo}</div>
      <div>{cuerpo}</div>
    </div>
  );
}
