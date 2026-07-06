// =====================================================
// FACTURAS HUB ADAPTER
//
// Normalizes contabilidad-os /api/facturas rows (Prisma Invoice + customer)
// into a compact shape for the ZionX Facturas page when it mirrors the fiscal
// source of truth. ContaOS holds every CFDI (ingresos, gastos, nómina, pagos);
// ZionX surfaces them read-only.
// =====================================================

const money = (n) => (n == null ? null : Math.round((Number(n) + Number.EPSILON) * 100) / 100);

// SAT comprobante type -> ZionX display tipo.
const TIPO_LABEL = {
  INGRESO: "Ingreso",
  EGRESO: "Gasto",
  NOMINA: "Nómina",
  PAGO: "Pago (REP)",
  TRASLADO: "Traslado",
};

function normalizeFactura(inv) {
  const serieFolio = `${inv.serie ? `${inv.serie}-` : ""}${inv.folio ?? ""}`.trim();
  // PAGO (REP) carries its real amount in the complement, not `total`.
  const total = inv.tipo === "PAGO" && inv.pagoMonto != null ? inv.pagoMonto : inv.total;
  return {
    id: inv.id,
    tipo: inv.tipo,
    tipo_label: TIPO_LABEL[inv.tipo] || inv.tipo,
    uuid: inv.uuid || null,
    folio: serieFolio || null,
    total: money(total),
    fecha: inv.fecha,
    status: inv.status,
    contraparte: inv.customer?.razonSocial || null,
    rfc: inv.customer?.rfc || null,
    metodo_pago: inv.metodoPago || null,
    pdf_url: inv.pdfUrl || null,
  };
}

function normalizeFacturas(hubInvoices) {
  return (Array.isArray(hubInvoices) ? hubInvoices : []).map(normalizeFactura);
}

module.exports = { normalizeFacturas, normalizeFactura, TIPO_LABEL };
