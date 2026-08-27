const express = require('express');
const router = express.Router();
const { syncAdSpend } = require('../services/metricsSync');

const todayIso = () => new Date().toISOString().slice(0, 10);
const defaultFrom = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

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
 * Pull daily spend/performance for every active Meta ad account and roll it up
 * into the monthly table the portal reads. Runs automatically every few hours
 * (services/metricsScheduler); this endpoint is the manual "do it now".
 *
 * Body: { lookbackDays } — how far back to re-pull. Meta keeps attributing
 * conversions for days after the fact, so recent days are re-fetched rather
 * than trusted once.
 */
router.post('/sync', async (req, res) => {
  try {
    const lookbackDays = Math.min(400, parseInt(req.body?.lookbackDays, 10) || 14);
    const result = await syncAdSpend(req.pool, { lookbackDays });
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('Error syncing ad spend:', e);
    res.status(500).json({ error: 'Error al sincronizar inversión publicitaria' });
  }
});

/**
 * GET /api/ads/spend/series?from&to&customer_id&ad_account_id
 * Daily spend series for charting. Returns one row per day with the platform's
 * own outcome counts (link clicks, leads, conversations started).
 */
router.get('/spend/series', async (req, res) => {
  try {
    const { from, to, customer_id: customerId, ad_account_id: adAccountId } = req.query;
    const params = [from || defaultFrom(), to || todayIso()];
    let where = 'd.day BETWEEN $1::date AND $2::date';
    if (customerId) { params.push(customerId); where += ` AND a.customer_id = $${params.length}`; }
    if (adAccountId) { params.push(adAccountId); where += ` AND a.id = $${params.length}`; }

    const r = await req.pool.query(`
      SELECT d.day,
             SUM(d.spend)::numeric(14,2) AS spend,
             SUM(d.impressions) AS impressions,
             SUM(d.reach) AS reach,
             SUM(d.clicks) AS clicks,
             SUM(d.link_clicks) AS link_clicks,
             SUM(d.leads) AS leads,
             SUM(d.conversations_started) AS conversations_started,
             MAX(d.currency) AS currency
        FROM ad_spend_daily d
        JOIN ad_accounts a ON a.id = d.ad_account_id
       WHERE ${where}
       GROUP BY d.day
       ORDER BY d.day
    `, params);

    res.json({ series: r.rows });
  } catch (e) {
    console.error('Error fetching ad spend series:', e);
    res.status(500).json({ error: 'Error al obtener la serie de inversión' });
  }
});

module.exports = router;
