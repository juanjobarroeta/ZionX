/**
 * Estado de resultados armado con los CFDIs, no con la contabilidad.
 *
 * La versión que había se apoyaba en la Contabilidad Electrónica y en los
 * asientos del hub: exacta cuando el mes está presentado, pero vacía cuando el
 * contador todavía no lo cerró — que es justo lo que pasaba con junio. Los
 * comprobantes, en cambio, existen desde que el SAT los entrega, así que con
 * ellos se puede armar cada mes tan atrás como haya datos.
 *
 * Las reglas, que son donde se gana o se pierde la exactitud:
 *
 *   tipo INGRESO  → factura EMITIDA   → ingreso
 *   tipo EGRESO   → factura RECIBIDA  → gasto
 *   tipo NOMINA   → recibo de nómina  → gasto de personal
 *   tipo PAGO     → complemento       → NO entra: es cobro, no ingreso.
 *                                       Contarlo duplicaría la venta.
 *   tipo TRASLADO → traslado          → NO entra: no hay operación.
 *
 *   tipoSat "E"   → nota de crédito. RESTA dentro de su propio lado: emitida
 *                   baja ingresos, recibida baja gastos.
 *
 *   status CANCELLED → fuera. Un CFDI cancelado no sostiene nada.
 *
 * Se suma el SUBTOTAL, no el total: el IVA no es ingreso ni gasto, es de
 * Hacienda y sólo pasa por la cuenta.
 */

const contaHub = require('./contaHub');

const PAGINA = 200; // el tope por página del hub

/** Los CFDIs de un rango, paginando hasta que una página venga incompleta. */
async function traerCfdis(desde, hasta) {
  const todos = [];
  for (let skip = 0; ; skip += PAGINA) {
    const pagina = await contaHub.listInvoices({ from: desde, to: hasta, take: PAGINA, skip });
    if (!Array.isArray(pagina) || pagina.length === 0) break;
    todos.push(...pagina);
    if (pagina.length < PAGINA) break;
    // Tope de seguridad: 10 000 comprobantes en un mes ya no es un mes.
    if (todos.length >= 10000) break;
  }
  return todos;
}

const esCredito = (f) => String(f.tipoSat || '').toUpperCase() === 'E';
const importe = (f) => {
  const base = Number(f.subtotal);
  return Number.isFinite(base) ? base : 0;
};

/** El rubro al que pertenece un CFDI, o null si no entra al resultado. */
function rubroDe(f) {
  if (String(f.status || '').toUpperCase() === 'CANCELLED') return null;
  switch (String(f.tipo || '').toUpperCase()) {
    case 'INGRESO': return 'ingresos';
    case 'EGRESO': return 'gastos';
    case 'NOMINA': return 'nomina';
    default: return null; // PAGO y TRASLADO no son operaciones del período
  }
}

/**
 * Arma el estado de resultados de un rango a partir de sus CFDIs.
 * @returns {{rubros, resultado, comprobantes, ignorados}}
 */
function construir(cfdis) {
  const RUBROS = [
    { clave: 'ingresos', titulo: 'Ingresos' },
    { clave: 'gastos', titulo: 'Gastos' },
    { clave: 'nomina', titulo: 'Nómina' },
  ];
  const acumulado = new Map(RUBROS.map((r) => [r.clave, new Map()]));
  let contados = 0;
  const ignorados = { pago: 0, traslado: 0, cancelados: 0 };

  for (const f of cfdis) {
    const rubro = rubroDe(f);
    if (!rubro) {
      const t = String(f.tipo || '').toUpperCase();
      if (String(f.status || '').toUpperCase() === 'CANCELLED') ignorados.cancelados += 1;
      else if (t === 'PAGO') ignorados.pago += 1;
      else if (t === 'TRASLADO') ignorados.traslado += 1;
      continue;
    }
    contados += 1;
    // Una nota de crédito resta dentro de su lado, no cambia de lado.
    const monto = importe(f) * (esCredito(f) ? -1 : 1);
    const clave = f.contraparteRfc || f.contraparteNombre || 'sin-contraparte';
    const grupo = acumulado.get(rubro);
    if (!grupo.has(clave)) {
      grupo.set(clave, {
        clave,
        nombre: f.contraparteNombre || f.contraparteRfc || 'Sin contraparte',
        rfc: f.contraparteRfc || null,
        monto: 0,
        cfdis: [],
      });
    }
    const g = grupo.get(clave);
    g.monto += monto;
    g.cfdis.push({
      id: f.id,
      uuid: f.uuid || null,
      folio: [f.serie, f.folio].filter(Boolean).join('-') || null,
      fecha: f.fecha,
      monto,
      credito: esCredito(f),
      representable: f.rawXml != null,
    });
  }

  const rubros = RUBROS.map((r) => {
    const cuentas = [...acumulado.get(r.clave).values()]
      .sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto));
    return { ...r, monto: cuentas.reduce((s, c) => s + c.monto, 0), cuentas };
  });

  const ingresos = rubros.find((r) => r.clave === 'ingresos').monto;
  const egresos = rubros.filter((r) => r.clave !== 'ingresos').reduce((s, r) => s + r.monto, 0);

  return {
    rubros,
    resultado: { ingresos, egresos, utilidad: ingresos - egresos },
    comprobantes: contados,
    ignorados,
  };
}

/** Un mes. `mes` es 1-12. */
async function mes(year, month) {
  const desde = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const cfdis = await traerCfdis(desde, hasta);
  return { year, month, desde, hasta, ...construir(cfdis) };
}

/**
 * La serie: un renglón por mes, del más reciente hacia atrás. Sin detalle por
 * contraparte — para eso está `mes()`— porque la serie es para ver la forma del
 * año, no para auditar un renglón.
 */
async function serie(hastaYear, hastaMonth, meses = 12) {
  const salida = [];
  for (let i = 0; i < meses; i += 1) {
    const d = new Date(Date.UTC(hastaYear, hastaMonth - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const r = await mes(y, m); // eslint-disable-line no-await-in-loop
    salida.push({
      year: y, month: m,
      ingresos: r.resultado.ingresos,
      egresos: r.resultado.egresos,
      utilidad: r.resultado.utilidad,
      comprobantes: r.comprobantes,
    });
  }
  return salida;
}

module.exports = { mes, serie, construir, rubroDe };
