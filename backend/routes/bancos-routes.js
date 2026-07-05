const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

const { parseStatement } = require('../services/bank-parser');
const { persistTransactions } = require('../services/bank-import');
const { findCandidates, autoConciliarCuenta } = require('../services/bank-reconcile');
const { isBelvoConfigured } = require('../services/belvo');

// =====================================================
// BANCOS — bank statement reconciliation (conciliación)
// Mounted at /api/bancos behind withPool + authenticateToken + finanzas.
// =====================================================

// In-memory upload (files are parsed, never persisted to disk).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Status buckets used for the filter tabs + counts.
const MAIN_STATUSES = ['UNMATCHED', 'MATCHED', 'IGNORED'];

// ---- accounts ----

// GET /api/bancos/accounts — accounts with per-account status counts + saldo.
router.get('/accounts', async (req, res) => {
  try {
    const pool = req.pool;
    const { rows: accounts } = await pool.query(
      `SELECT id, banco, nombre, numero_cuenta, clabe, moneda, tipo, titular,
              belvo_link_id, is_active, created_at
         FROM bank_accounts
        WHERE is_active = true
        ORDER BY banco, nombre`
    );
    // Per-account counts + latest saldo, in two grouped queries.
    const { rows: counts } = await pool.query(
      `SELECT bank_account_id, status, COUNT(*)::int AS n
         FROM bank_transactions GROUP BY bank_account_id, status`
    );
    const { rows: saldos } = await pool.query(
      `SELECT DISTINCT ON (bank_account_id) bank_account_id, saldo, fecha
         FROM bank_transactions
        WHERE saldo IS NOT NULL
        ORDER BY bank_account_id, fecha DESC, id DESC`
    );
    const countMap = {};
    for (const c of counts) {
      countMap[c.bank_account_id] = countMap[c.bank_account_id] || { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 };
      countMap[c.bank_account_id][c.status] = c.n;
    }
    const saldoMap = {};
    for (const s of saldos) saldoMap[s.bank_account_id] = s.saldo;

    res.json({
      accounts: accounts.map((a) => ({
        ...a,
        counts: countMap[a.id] || { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 },
        saldo: saldoMap[a.id] ?? null,
      })),
    });
  } catch (error) {
    console.error('Error listing bank accounts:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /api/bancos/accounts — create an account.
router.post('/accounts', async (req, res) => {
  try {
    const pool = req.pool;
    const { banco, nombre, numero_cuenta, clabe, moneda, tipo, titular } = req.body || {};
    if (!banco) return res.status(400).json({ message: 'El banco es obligatorio' });
    const { rows } = await pool.query(
      `INSERT INTO bank_accounts (banco, nombre, numero_cuenta, clabe, moneda, tipo, titular)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [banco, nombre || null, numero_cuenta || null, clabe || null, moneda || 'MXN', tipo || 'cheques', titular || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Ya existe una cuenta con ese número' });
    console.error('Error creating bank account:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// PATCH /api/bancos/accounts/:id — edit account.
router.patch('/accounts/:id', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const fields = ['banco', 'nombre', 'numero_cuenta', 'clabe', 'moneda', 'tipo', 'titular'];
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { params.push(req.body[f] || null); sets.push(`${f} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ message: 'Nada que actualizar' });
    sets.push('updated_at = NOW()');
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE bank_accounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    if (!rows.length) return res.status(404).json({ message: 'Cuenta no encontrada' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// DELETE /api/bancos/accounts/:id — soft-delete (keeps transactions).
router.delete('/accounts/:id', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE bank_accounts SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]
    );
    if (!rowCount) return res.status(404).json({ message: 'Cuenta no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---- transactions ----

// Resolve the matched record's display label for a transaction row.
async function attachMatchLabels(pool, rows) {
  const invoiceIds = rows.filter((r) => r.matched_type === 'invoice' && r.matched_id).map((r) => r.matched_id);
  const expenseIds = rows.filter((r) => r.matched_type === 'expense' && r.matched_id).map((r) => r.matched_id);
  const invMap = {};
  const expMap = {};
  if (invoiceIds.length) {
    const { rows: inv } = await pool.query(
      `SELECT i.id, i.invoice_number, c.business_name
         FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.id = ANY($1)`, [invoiceIds]
    );
    for (const r of inv) invMap[r.id] = { label: r.invoice_number, party: r.business_name };
  }
  if (expenseIds.length) {
    const { rows: exp } = await pool.query(
      `SELECT id, description, vendor FROM expenses WHERE id = ANY($1)`, [expenseIds]
    );
    for (const r of exp) expMap[r.id] = { label: r.description, party: r.vendor };
  }
  return rows.map((r) => {
    let match = null;
    if (r.matched_type === 'invoice') match = invMap[r.matched_id] || null;
    else if (r.matched_type === 'expense') match = expMap[r.matched_id] || null;
    return { ...r, match };
  });
}

// GET /api/bancos/accounts/:id/transactions?status=&page=&pageSize=
router.get('/accounts/:id/transactions', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));
    const offset = (page - 1) * pageSize;

    const params = [id];
    let where = 'bank_account_id = $1';
    if (status && MAIN_STATUSES.includes(status)) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT id, bank_account_id, fecha, descripcion, referencia, monto, saldo,
              tipo, status, matched_type, matched_id, category_tag, notes, source
         FROM bank_transactions
        WHERE ${where}
        ORDER BY fecha DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bank_transactions WHERE ${where}`, params
    );
    const { rows: statusCounts } = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM bank_transactions WHERE bank_account_id = $1 GROUP BY status`, [id]
    );
    const counts = { UNMATCHED: 0, MATCHED: 0, IGNORED: 0 };
    for (const c of statusCounts) counts[c.status] = c.n;

    const withLabels = await attachMatchLabels(pool, rows);
    res.json({ transactions: withLabels, total: totalRows[0].n, page, pageSize, counts });
  } catch (error) {
    console.error('Error listing transactions:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /api/bancos/accounts/:id/upload — import a statement.
// Accepts either a multipart file field `file`, or JSON { fileContent, filename, encoding }.
router.post('/accounts/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const acc = await pool.query('SELECT id FROM bank_accounts WHERE id = $1', [id]);
    if (!acc.rows.length) return res.status(404).json({ message: 'Cuenta no encontrada' });

    let buffer = null;
    let filename = '';
    if (req.file) {
      buffer = req.file.buffer;
      filename = req.file.originalname || '';
    } else if (req.body?.fileContent) {
      const encoding = req.body.encoding === 'base64' ? 'base64' : 'utf8';
      buffer = Buffer.from(req.body.fileContent, encoding);
      filename = req.body.filename || '';
    } else {
      return res.status(400).json({ message: 'No se recibió archivo' });
    }

    // Excel → CSV text; everything else is treated as text (CSV/OFX).
    const lower = filename.toLowerCase();
    let content;
    if (/\.(xlsx|xls|xlsm)$/.test(lower)) {
      try {
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        content = XLSX.utils.sheet_to_csv(sheet);
      } catch (err) {
        return res.status(400).json({ message: 'No se pudo leer el archivo Excel', detail: err.message });
      }
    } else {
      content = buffer.toString('utf8');
    }

    const parsed = parseStatement(content, filename);
    if (!parsed.transactions.length) {
      return res.status(422).json({
        message: 'No se encontraron movimientos en el archivo',
        warnings: parsed.warnings,
        descartadas: parsed.descartadas,
      });
    }

    const report = await persistTransactions(pool, id, parsed.transactions, 'UPLOAD');
    res.json({
      success: true,
      ...report,
      parsed: parsed.transactions.length,
      descartadas: parsed.descartadas,
      warnings: parsed.warnings,
    });
  } catch (error) {
    console.error('Error importing statement:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /api/bancos/accounts/:id/auto-conciliar — run auto-match.
router.post('/accounts/:id/auto-conciliar', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const matched = await autoConciliarCuenta(pool, id);
    res.json({ success: true, matched });
  } catch (error) {
    console.error('Error auto-reconciling:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// GET /api/bancos/transactions/:txId/candidates — suggested matches.
router.get('/transactions/:txId/candidates', async (req, res) => {
  try {
    const pool = req.pool;
    const { txId } = req.params;
    const { rows } = await pool.query(
      `SELECT id, fecha, descripcion, monto, status FROM bank_transactions WHERE id = $1`, [txId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Movimiento no encontrado' });
    const candidates = await findCandidates(pool, rows[0]);
    res.json({ candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// PATCH /api/bancos/transactions/:txId — match / ignore / unmatch / unignore.
router.patch('/transactions/:txId', async (req, res) => {
  try {
    const pool = req.pool;
    const { txId } = req.params;
    const { action } = req.body || {};

    const existing = await pool.query('SELECT * FROM bank_transactions WHERE id = $1', [txId]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Movimiento no encontrado' });

    let sql, params;
    if (action === 'match') {
      const { matched_type, matched_id } = req.body;
      if (!['invoice', 'expense'].includes(matched_type) || !matched_id) {
        return res.status(400).json({ message: 'matched_type (invoice|expense) y matched_id son obligatorios' });
      }
      // Guard: the target must not already be matched by another movement.
      const dup = await pool.query(
        `SELECT id FROM bank_transactions
          WHERE status = 'MATCHED' AND matched_type = $1 AND matched_id = $2 AND id <> $3`,
        [matched_type, matched_id, txId]
      );
      if (dup.rows.length) return res.status(409).json({ message: 'Ese registro ya está conciliado con otro movimiento' });
      sql = `UPDATE bank_transactions
                SET status = 'MATCHED', matched_type = $2, matched_id = $3, category_tag = NULL
              WHERE id = $1 RETURNING *`;
      params = [txId, matched_type, matched_id];
    } else if (action === 'ignore') {
      const { category_tag, notes } = req.body;
      sql = `UPDATE bank_transactions
                SET status = 'IGNORED', category_tag = $2, notes = $3,
                    matched_type = NULL, matched_id = NULL
              WHERE id = $1 RETURNING *`;
      params = [txId, category_tag || null, notes || null];
    } else if (action === 'unmatch' || action === 'unignore') {
      sql = `UPDATE bank_transactions
                SET status = 'UNMATCHED', matched_type = NULL, matched_id = NULL, category_tag = NULL
              WHERE id = $1 RETURNING *`;
      params = [txId];
    } else {
      return res.status(400).json({ message: 'Acción inválida', valid: ['match', 'ignore', 'unmatch', 'unignore'] });
    }

    const { rows } = await pool.query(sql, params);
    const [withLabel] = await attachMatchLabels(pool, rows);
    res.json({ success: true, transaction: withLabel });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---- belvo (stubbed) ----
router.get('/belvo/status', (req, res) => res.json({ configured: isBelvoConfigured() }));
router.post('/belvo/token', (req, res) => {
  if (!isBelvoConfigured()) return res.status(503).json({ message: 'Belvo no está configurado' });
  res.status(501).json({ message: 'Integración Belvo pendiente' });
});
router.post('/belvo/sync', (req, res) => {
  if (!isBelvoConfigured()) return res.status(503).json({ message: 'Belvo no está configurado' });
  res.status(501).json({ message: 'Integración Belvo pendiente' });
});

module.exports = router;
