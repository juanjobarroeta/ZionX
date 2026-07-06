// =====================================================
// BANCOS HUB ADAPTER
//
// Normalizes contabilidad-os (ContaOS) /api/bancos responses into the shape the
// ZionX Bancos frontend already expects, so the same page works whether it's
// backed by the hub (shared source of truth) or the local tables (offline
// fallback). In hub mode every match is against a ContaOS CFDI/invoice.
// =====================================================

const money = (n) => (n == null ? null : Math.round((Number(n) + Number.EPSILON) * 100) / 100);

// Short, human label for a matched/candidate CFDI.
function invoiceLabel({ folio, serie, uuid }) {
  if (folio) return `${serie ? `${serie}-` : ""}${folio}`;
  if (uuid) return `CFDI ${String(uuid).slice(0, 8)}`;
  return "Factura";
}

// ContaOS account → ZionX account row.
function normalizeAccount(a) {
  const stats = a.stats || {};
  return {
    id: a.id,
    banco: a.banco,
    nombre: a.nombre,
    numero_cuenta: a.numeroCuenta,
    clabe: a.clabe,
    moneda: a.moneda,
    tipo: a.tipo,
    titular: a.titular,
    belvo_link_id: a.belvoLinkId || null,
    counts: {
      UNMATCHED: stats.unmatched ?? 0,
      MATCHED: stats.matched ?? 0,
      IGNORED: stats.ignored ?? 0,
    },
    saldo: money(a.lastTransaction?.saldo),
  };
}

function normalizeAccounts(hubAccounts) {
  return (Array.isArray(hubAccounts) ? hubAccounts : []).map(normalizeAccount);
}

// ContaOS transaction → ZionX transaction row (with a resolved match label).
function normalizeTransaction(t) {
  let match = null;
  let matched_type = null;
  let matched_id = null;
  if (t.invoiceId && t.invoice) {
    matched_type = "invoice";
    matched_id = t.invoiceId;
    match = { label: invoiceLabel(t.invoice), party: t.invoice.customer?.razonSocial || null };
  } else if (Array.isArray(t.conciliacionDetalles) && t.conciliacionDetalles.length) {
    // Split match across several CFDIs.
    matched_type = "invoice";
    match = { label: `${t.conciliacionDetalles.length} facturas`, party: null };
  } else if (t.taxDeclaration) {
    match = { label: "Pago de impuestos", party: t.taxDeclaration.periodo || null };
  }
  return {
    id: t.id,
    fecha: t.fecha,
    descripcion: t.descripcion,
    referencia: t.referencia || null,
    monto: money(t.monto),
    saldo: money(t.saldo),
    tipo: t.tipo,
    status: t.status,
    matched_type,
    matched_id,
    category_tag: t.status === "IGNORED" ? (t.notes || null) : null,
    match,
  };
}

// ContaOS { transactions, statusCounts } → ZionX { transactions, counts }.
function normalizeTransactionList(hubResponse) {
  const sc = hubResponse?.statusCounts || {};
  return {
    transactions: (hubResponse?.transactions || []).map(normalizeTransaction),
    counts: {
      UNMATCHED: sc.UNMATCHED ?? 0,
      MATCHED: sc.MATCHED ?? 0,
      IGNORED: sc.IGNORED ?? 0,
    },
    total: hubResponse?.pagination?.total ?? (hubResponse?.transactions?.length || 0),
  };
}

// ContaOS { candidates } → ZionX candidate rows.
function normalizeCandidates(hubResponse) {
  return (hubResponse?.candidates || []).map((c) => ({
    type: "invoice",
    id: c.id,
    label: invoiceLabel(c),
    party: c.cliente || null,
    amount: money(c.total),
    date: c.fecha,
    score: c.score,
    confidence: c.confidence,
    alreadyMatched: c.alreadyMatched || false,
  }));
}

// ContaOS import result → ZionX import report.
function normalizeImportResult(r) {
  return {
    success: !!r.ok,
    imported: r.imported ?? 0,
    duplicates: r.posiblesDuplicados ?? r.skipped ?? 0,
    descartadas: r.descartadas || [],
    warnings: r.warnings || [],
    message: r.message || null,
  };
}

module.exports = {
  normalizeAccounts,
  normalizeAccount,
  normalizeTransactionList,
  normalizeCandidates,
  normalizeImportResult,
};
