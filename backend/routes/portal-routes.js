const express = require('express');
const router = express.Router();

// GET /portal/summary
// Client-facing dashboard data, scoped to one customer. A client-portal user is
// locked to their own customer_id; staff/admin may pass ?customer_id= to preview.
router.get('/portal/summary', async (req, res) => {
  try {
    const pool = req.pool;
    const customerId = req.user.role === 'client' ? req.user.customer_id : (req.query.customer_id || null);
    if (!customerId) return res.status(400).json({ error: 'customer_id requerido' });

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Customer name (for the greeting).
    const cRes = await pool.query(
      `SELECT COALESCE(NULLIF(commercial_name,''), NULLIF(business_name,''), 'Cliente') AS name FROM customers WHERE id = $1`,
      [customerId]
    );
    const customerName = cRes.rows[0]?.name || 'Cliente';

    // Funnel metrics.
    const f = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS won,
        COUNT(*) FILTER (WHERE status = 'lost')::int AS lost,
        COUNT(*) FILTER (WHERE created_at >= $2)::int AS new_this_month,
        COALESCE(SUM(estimated_value) FILTER (WHERE status NOT IN ('converted','lost')), 0) AS pipeline_value,
        COALESCE(SUM(estimated_value) FILTER (WHERE status = 'converted'), 0) AS won_value
      FROM leads WHERE customer_id = $1
    `, [customerId, monthStart]);
    const stages = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM leads WHERE customer_id = $1 GROUP BY status`,
      [customerId]
    );
    const fr = f.rows[0];
    const decided = fr.won + fr.lost;

    // Content planned this month (best-effort).
    let content = { planned: 0 };
    try {
      const c = await pool.query(
        `SELECT COUNT(*)::int AS planned FROM content_calendar WHERE customer_id = $1 AND month_year = $2`,
        [customerId, monthYear]
      );
      content.planned = c.rows[0].planned;
    } catch (_) { /* table/col may vary */ }

    // Billing (best-effort).
    let billing = { monthly: 0, charge_status: null };
    try {
      const s = await pool.query(
        `SELECT COALESCE(custom_monthly_price, 0) AS monthly FROM customer_subscriptions
          WHERE customer_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1`,
        [customerId]
      );
      if (s.rows.length) billing.monthly = Number(s.rows[0].monthly) || 0;
      const ch = await pool.query(
        `SELECT status FROM subscription_charges WHERE customer_id = $1 AND period_month = $2::date ORDER BY id DESC LIMIT 1`,
        [customerId, monthStart]
      );
      if (ch.rows.length) billing.charge_status = ch.rows[0].status;
    } catch (_) { /* tables may not exist yet */ }

    res.json({
      customer_name: customerName,
      funnel: {
        total: fr.total,
        new_this_month: fr.new_this_month,
        won: fr.won,
        pipeline_value: Number(fr.pipeline_value) || 0,
        won_value: Number(fr.won_value) || 0,
        conversion: decided ? Math.round((fr.won / decided) * 100) : 0,
        stages: stages.rows,
      },
      content,
      billing,
    });
  } catch (error) {
    console.error('Error portal summary:', error);
    res.status(500).json({ error: 'Error al cargar el resumen del portal' });
  }
});

module.exports = router;
