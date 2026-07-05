// =====================================================
// BANK STATEMENT IMPORT
//
// Ported from contabilidad-os (src/lib/bancos/import.ts + dedup.ts). Takes the
// normalized rows from bank-parser, de-duplicates against what's already in the
// DB, auto-categorizes obvious no-invoice movements (fees, taxes, transfers),
// inserts, then kicks off auto-reconciliation.
// =====================================================

const { autoConciliarCuenta } = require('./bank-reconcile');

// Regex rules → category tag. Anything that matches is inserted straight to
// IGNORED with the tag, so it doesn't clutter the "por conciliar" list.
const CATEGORY_RULES = [
  { tag: 'COMISION', re: /comisi[oó]n|iva\s*comis|cuota\s*anual|manejo\s*de\s*cuenta/i },
  { tag: 'TAX_PAYMENT', re: /pago\s*de\s*impuestos|\bsat\b|tesofe|\bsua\b|impuesto|\bisr\b|\biva\b\s*por\s*pagar/i },
  { tag: 'INTERNAL_TRANSFER', re: /traspaso\s*(entre|a)\s*cuentas?\s*propias?|traspaso\s*mismo\s*banco/i },
];

function autoCategory(descripcion) {
  const text = String(descripcion || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(text)) return rule.tag;
  }
  return null;
}

// Dedup key for a normalized row.
function dedupKey(accountId, t) {
  const day = new Date(t.fecha).toISOString().slice(0, 10);
  return [accountId, day, Number(t.monto).toFixed(2), (t.descripcion || '').trim(), (t.referencia || '').trim()].join('|');
}

// Insert the parsed rows, skipping duplicates. Returns a report.
// `parsed` = array of { fecha, descripcion, referencia, monto, saldo }.
async function persistTransactions(pool, accountId, parsed, source = 'UPLOAD') {
  if (!parsed.length) return { imported: 0, duplicates: 0, categorized: 0 };

  // Count existing occurrences per key (measured before this upload).
  const existing = new Map();
  const { rows } = await pool.query(
    `SELECT fecha, monto, descripcion, referencia FROM bank_transactions WHERE bank_account_id = $1`,
    [accountId]
  );
  for (const r of rows) {
    const key = dedupKey(accountId, { fecha: r.fecha, monto: r.monto, descripcion: r.descripcion, referencia: r.referencia });
    existing.set(key, (existing.get(key) || 0) + 1);
  }

  // Count occurrences per key within the incoming file.
  const fileCounts = new Map();
  for (const t of parsed) {
    const key = dedupKey(accountId, t);
    fileCounts.set(key, (fileCounts.get(key) || 0) + 1);
  }

  // For each key, import max(0, F - D); track how many of each key we've kept.
  const kept = new Map();
  let imported = 0;
  let duplicates = 0;
  let categorized = 0;

  for (const t of parsed) {
    const key = dedupKey(accountId, t);
    const already = existing.get(key) || 0;
    const seen = kept.get(key) || 0;
    // The first `already` occurrences in the file are treated as duplicates.
    if (seen < already) {
      kept.set(key, seen + 1);
      duplicates++;
      continue;
    }
    kept.set(key, seen + 1);

    const tag = autoCategory(t.descripcion);
    const status = tag ? 'IGNORED' : 'UNMATCHED';
    if (tag) categorized++;
    const tipo = Number(t.monto) >= 0 ? 'CREDITO' : 'DEBITO';

    await pool.query(
      `INSERT INTO bank_transactions
         (bank_account_id, fecha, descripcion, referencia, monto, saldo, tipo, status, category_tag, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [accountId, t.fecha, t.descripcion, t.referencia, t.monto, t.saldo, tipo, status, tag, source]
    );
    imported++;
  }

  // Event-driven auto-reconcile (best-effort).
  let autoMatched = 0;
  if (imported > 0) {
    try {
      autoMatched = await autoConciliarCuenta(pool, accountId);
    } catch (err) {
      console.error('⚠️ auto-reconcile after import failed:', err.message);
    }
  }

  return { imported, duplicates, categorized, autoMatched };
}

module.exports = { persistTransactions, autoCategory };
