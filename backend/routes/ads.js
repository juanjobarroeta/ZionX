const express = require('express');
const router = express.Router();
const metaService = require('../services/metaService');

// Month boundaries in the server's local time. period_month is stored as the
// first day of the month; the insights range covers month-start → today.
function monthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const since = `${y}-${pad(m + 1)}-01`;
  const until = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
  return { since, until, periodMonth: since };
}

const CUSTOMER_NAME_SQL =
  `COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''))`;

/**
 * GET /api/ads/accounts
 * List connected advertising accounts with their assigned client and the
 * latest known monthly spend.
 */
router.get('/accounts', async (req, res) => {
  try {
    const { periodMonth } = monthBounds();
    const r = await req.pool.query(`
      SELECT a.id, a.platform, a.platform_account_id, a.account_name, a.currency,
             a.customer_id, a.is_active, a.last_synced_at,
             ${CUSTOMER_NAME_SQL} AS customer_name,
             COALESCE(s.spend, 0) AS month_spend,
             COALESCE(s.impressions, 0) AS month_impressions,
             COALESCE(s.clicks, 0) AS month_clicks
        FROM ad_accounts a
        LEFT JOIN customers c ON c.id = a.customer_id
        LEFT JOIN ad_spend_monthly s ON s.ad_account_id = a.id AND s.period_month = $1::date
       WHERE a.is_active = true
       ORDER BY a.platform, a.account_name
    `, [periodMonth]);
    res.json({ accounts: r.rows });
  } catch (e) {
    console.error('Error listing ad accounts:', e);
    res.status(500).json({ error: 'Error al listar cuentas publicitarias' });
  }
});

/**
 * PATCH /api/ads/accounts/:id/customer  { customer_id }
 * Assign (or clear) which client an ad account belongs to.
 */
router.patch('/accounts/:id/customer', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id } = req.body;
    const r = await req.pool.query(
      'UPDATE ad_accounts SET customer_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, customer_id',
      [customer_id || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ success: true, account: r.rows[0] });
  } catch (e) {
    console.error('Error assigning ad account to customer:', e);
    res.status(500).json({ error: 'Error al asignar cliente a la cuenta' });
  }
});

/**
 * POST /api/ads/sync
 * Pull month-to-date spend/impressions/clicks for every active Meta ad account
 * and cache it in ad_spend_monthly. Defensive: one bad account doesn't abort
 * the batch.
 */
router.post('/sync', async (req, res) => {
  try {
    const { since, until, periodMonth } = monthBounds();
    const accounts = await req.pool.query(
      `SELECT id, platform, platform_account_id, access_token, currency
         FROM ad_accounts WHERE is_active = true AND platform = 'meta' AND access_token IS NOT NULL`
    );

    let synced = 0;
    const errors = [];
    for (const acct of accounts.rows) {
      try {
        const ins = await metaService.getAdAccountInsights(
          acct.platform_account_id, acct.access_token, since, until
        );
        if (!ins.success) { errors.push({ id: acct.id, error: ins.error }); continue; }
        await req.pool.query(`
          INSERT INTO ad_spend_monthly (ad_account_id, period_month, spend, impressions, clicks, currency, fetched_at)
          VALUES ($1, $2::date, $3, $4, $5, $6, NOW())
          ON CONFLICT (ad_account_id, period_month) DO UPDATE SET
            spend = $3, impressions = $4, clicks = $5, currency = $6, fetched_at = NOW()
        `, [acct.id, periodMonth, ins.spend, ins.impressions, ins.clicks, acct.currency || null]);
        await req.pool.query('UPDATE ad_accounts SET last_synced_at = NOW() WHERE id = $1', [acct.id]);
        synced++;
      } catch (err) {
        errors.push({ id: acct.id, error: err.message });
      }
    }

    res.json({ success: true, synced, total: accounts.rows.length, errors });
  } catch (e) {
    console.error('Error syncing ad spend:', e);
    res.status(500).json({ error: 'Error al sincronizar inversión publicitaria' });
  }
});

module.exports = router;
