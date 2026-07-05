// =====================================================
// BANK RECONCILIATION ENGINE
//
// Ported from contabilidad-os (src/lib/bancos/auto-conciliar.ts +
// conciliacion.ts), adapted to ZionX's domain: a bank movement matches an
// income INVOICE (credits/deposits) or an EXPENSE (debits/withdrawals).
//
// Scoring is identical to ContaOS: amount exactness + date proximity +
// reference/name appearing in the memo. Two windows: a wide one for showing
// suggestions to the user, a tight one for unambiguous auto-apply.
// =====================================================

const SUGGEST_WINDOW_DAYS = 30;
const SUGGEST_TOLERANCE = 0.05; // 5%
const AUTO_WINDOW_DAYS = 14;
const AUTO_TOLERANCE = 0.01; // 1%
const AUTO_MATCH_MIN_SCORE = 130;
const AUTO_MATCH_AMBIGUITY_GAP = 20;

const DAY_MS = 86400000;

// Pure scoring. `cand` = { amount, date, ref } (ref = text likely to appear in
// the bank memo, e.g. invoice number or vendor name). `tx` = the bank movement.
function scoreCandidate(cand, tx) {
  const absAmount = Math.abs(Number(tx.monto));
  const candAmount = Math.abs(Number(cand.amount));
  let score = 0;

  const diff = Math.abs(candAmount - absAmount);
  if (diff < 0.01) score += 100;
  else if (candAmount > 0 && diff / candAmount < 0.005) score += 70;
  else if (candAmount > 0 && diff / candAmount < 0.01) score += 40;
  else if (candAmount > 0 && diff / candAmount < 0.05) score += 20;

  const daysDiff = Math.abs(new Date(cand.date).getTime() - new Date(tx.fecha).getTime()) / DAY_MS;
  if (daysDiff <= 1) score += 30;
  else if (daysDiff <= 3) score += 20;
  else if (daysDiff <= 7) score += 10;

  const memo = String(tx.descripcion || "").toUpperCase();
  const ref = String(cand.ref || "").toUpperCase().trim();
  if (ref && ref.length >= 3 && memo.includes(ref)) score += 25;

  return score;
}

const confidenceOf = (score) => (score >= 100 ? "alta" : score >= 50 ? "media" : "baja");

// SQL fragment: a target row is "already matched" if some bank_transaction
// points at it with status MATCHED.
const NOT_MATCHED = (type, idCol) =>
  `NOT EXISTS (SELECT 1 FROM bank_transactions bt
                WHERE bt.status = 'MATCHED' AND bt.matched_type = '${type}'
                  AND bt.matched_id = ${idCol})`;

// Fetch candidate internal records for a bank movement, within `windowDays`
// and `tolerance`. Returns a normalized list with score + confidence.
async function findCandidates(pool, tx, { windowDays = SUGGEST_WINDOW_DAYS, tolerance = SUGGEST_TOLERANCE } = {}) {
  const absAmount = Math.abs(Number(tx.monto));
  const isCredit = Number(tx.monto) >= 0;
  const lo = absAmount * (1 - tolerance);
  const hi = absAmount * (1 + tolerance);

  let rows;
  if (isCredit) {
    // Deposit → income invoice.
    const { rows: r } = await pool.query(
      `SELECT i.id, i.invoice_number, i.total AS amount, i.invoice_date AS date,
              c.business_name AS party
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.status NOT IN ('draft','cancelled')
          AND i.total BETWEEN $1 AND $2
          AND i.invoice_date BETWEEN $3::date - $4::int AND $3::date + $4::int
          AND ${NOT_MATCHED("invoice", "i.id")}
        ORDER BY i.invoice_date DESC
        LIMIT 25`,
      [lo, hi, tx.fecha, windowDays]
    );
    rows = r.map((x) => ({
      type: "invoice",
      id: x.id,
      label: x.invoice_number,
      party: x.party,
      amount: Number(x.amount),
      date: x.date,
      ref: x.invoice_number,
    }));
  } else {
    // Withdrawal → expense.
    const { rows: r } = await pool.query(
      `SELECT e.id, e.description, e.amount, e.expense_date AS date, e.vendor
         FROM expenses e
        WHERE e.amount BETWEEN $1 AND $2
          AND COALESCE(e.expense_date, e.created_at::date) BETWEEN $3::date - $4::int AND $3::date + $4::int
          AND ${NOT_MATCHED("expense", "e.id")}
        ORDER BY COALESCE(e.expense_date, e.created_at::date) DESC
        LIMIT 25`,
      [lo, hi, tx.fecha, windowDays]
    );
    rows = r.map((x) => ({
      type: "expense",
      id: x.id,
      label: x.description,
      party: x.vendor,
      amount: Number(x.amount),
      date: x.date,
      ref: x.vendor || x.description,
    }));
  }

  return rows
    .map((cand) => {
      const score = scoreCandidate(cand, tx);
      return { ...cand, score, confidence: confidenceOf(score) };
    })
    .sort((a, b) => b.score - a.score);
}

// Auto-reconcile every UNMATCHED transaction on an account. Only links when the
// best candidate is high-confidence (>=130) AND unambiguous (next best is >=20
// points behind). Idempotent — never un-matches. Returns count matched.
async function autoConciliarCuenta(pool, accountId) {
  const { rows: txs } = await pool.query(
    `SELECT id, bank_account_id, fecha, descripcion, monto
       FROM bank_transactions
      WHERE bank_account_id = $1 AND status = 'UNMATCHED'`,
    [accountId]
  );

  let matched = 0;
  for (const tx of txs) {
    const cands = await findCandidates(pool, tx, { windowDays: AUTO_WINDOW_DAYS, tolerance: AUTO_TOLERANCE });
    if (!cands.length) continue;
    const best = cands[0];
    const second = cands[1];
    const unambiguous = !second || best.score - second.score >= AUTO_MATCH_AMBIGUITY_GAP;
    if (best.score >= AUTO_MATCH_MIN_SCORE && unambiguous) {
      const upd = await pool.query(
        `UPDATE bank_transactions
            SET status = 'MATCHED', matched_type = $2, matched_id = $3
          WHERE id = $1 AND status = 'UNMATCHED'`,
        [tx.id, best.type, best.id]
      );
      if (upd.rowCount) matched++;
    }
  }
  return matched;
}

module.exports = {
  scoreCandidate,
  confidenceOf,
  findCandidates,
  autoConciliarCuenta,
  SUGGEST_WINDOW_DAYS,
  SUGGEST_TOLERANCE,
};
