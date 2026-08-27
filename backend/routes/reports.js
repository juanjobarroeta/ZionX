const express = require('express');
const crypto = require('crypto');
const router = express.Router();

/**
 * Monthly client reports.
 *
 * The agency stores a daily history of every account, post and peso spent; a
 * client sees none of it. This turns a month of that history into one page
 * they can open from an email — no account, no login — which is the artifact
 * an agency actually gets judged on.
 *
 * Two surfaces:
 *   · authenticated: generate/refresh the link for a client and month
 *   · public: read one report by token (mounted before auth in index.js)
 *
 * The report is computed on read, not frozen at generation, so a link sent on
 * the 3rd keeps telling the truth on the 30th.
 */

const CUSTOMER_NAME_SQL =
  `COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente')`;

/**
 * First day of the month, as YYYY-MM-DD.
 *
 * A DATE column comes back from pg as a Date object, so slicing its string
 * form gives "Sat Aug" — read it as a date when it is one, and as text only
 * when the caller passed text.
 */
const firstOfMonth = (value) => {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${String(value).slice(0, 7)}-01`;
};

/** Everything the report page renders, for one client and one month. */
async function buildReport(pool, customerId, periodMonth) {
  const first = firstOfMonth(periodMonth);

  const customer = await pool.query(
    `SELECT id, ${CUSTOMER_NAME_SQL} AS name FROM customers c WHERE id = $1`,
    [customerId]
  );
  if (!customer.rows.length) return null;

  // Daily series for the month and the one before it, so every headline can
  // carry a comparison instead of floating alone.
  const series = await pool.query(`
    SELECT aa.snapshot_date AS day,
           SUM(aa.views) AS views, SUM(aa.total_reach) AS reach,
           SUM(aa.total_interactions) AS interactions,
           SUM(aa.followers_gained) AS gained, SUM(aa.followers_lost) AS lost,
           MAX(aa.followers_count) AS followers
      FROM account_analytics aa
      JOIN social_accounts sa ON sa.id = aa.social_account_id
     WHERE sa.customer_id = $1
       AND aa.snapshot_date >= ($2::date - INTERVAL '1 month')
       AND aa.snapshot_date < ($2::date + INTERVAL '1 month')
     GROUP BY aa.snapshot_date
     ORDER BY aa.snapshot_date
  `, [customerId, first]);

  const posts = await pool.query(`
    SELECT DISTINCT ON (pa.platform_post_id)
           pa.platform_post_id, pa.views, pa.reach, pa.likes, pa.comments,
           pa.shares, pa.saves, pa.total_interactions, pa.engagement_rate,
           pa.media_type, pa.platform, pa.thumbnail_url,
           COALESCE(sp.message, pa.caption) AS message,
           COALESCE(sp.published_at, pa.posted_at) AS published_at,
           COALESCE(sp.platform_post_url, pa.permalink) AS url
      FROM post_analytics pa
      LEFT JOIN scheduled_posts sp ON sp.id = pa.scheduled_post_id
     WHERE COALESCE(sp.customer_id, pa.customer_id) = $1
       AND COALESCE(sp.published_at, pa.posted_at) >= $2::date
       AND COALESCE(sp.published_at, pa.posted_at) < ($2::date + INTERVAL '1 month')
     ORDER BY pa.platform_post_id, pa.snapshot_date DESC
  `, [customerId, first]);

  const spend = await pool.query(`
    SELECT COALESCE(SUM(d.spend), 0) AS spend,
           COALESCE(SUM(d.impressions), 0) AS impressions,
           COALESCE(SUM(d.reach), 0) AS reach,
           COALESCE(SUM(d.link_clicks), 0) AS link_clicks,
           COALESCE(SUM(d.leads), 0) AS leads,
           COALESCE(SUM(d.conversations_started), 0) AS conversations,
           MAX(d.currency) AS currency
      FROM ad_spend_daily d
      JOIN ad_accounts a ON a.id = d.ad_account_id
     WHERE a.customer_id = $1
       AND d.day >= $2::date AND d.day < ($2::date + INTERVAL '1 month')
  `, [customerId, first]);

  const inMonth = (r) => firstOfMonth(r.day) === first;
  const rows = series.rows;
  const current = rows.filter(inMonth);
  const previous = rows.filter((r) => !inMonth(r));
  const total = (list, key) => list.reduce((t, r) => t + (Number(r[key]) || 0), 0);

  const ranked = posts.rows
    .slice()
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0));

  return {
    customer: customer.rows[0],
    period: String(first).slice(0, 7),
    totals: {
      views: total(current, 'views'),
      reach: total(current, 'reach'),
      interactions: total(current, 'interactions'),
      followers: current.length ? Number(current[current.length - 1].followers) || 0 : 0,
      followers_net: total(current, 'gained') - total(current, 'lost'),
      posts: posts.rows.length,
    },
    previous: {
      views: total(previous, 'views'),
      reach: total(previous, 'reach'),
      interactions: total(previous, 'interactions'),
    },
    series: current.map((r) => ({
      day: r.day, views: Number(r.views) || 0, reach: Number(r.reach) || 0,
      interactions: Number(r.interactions) || 0,
    })),
    ads: spend.rows[0] || null,
    top_posts: ranked.slice(0, 6),
  };
}

/**
 * POST /api/reports/generate
 * Create or refresh the link for a client's month. Idempotent per
 * (customer, month): the same URL keeps working, so a client who already has
 * it in their inbox isn't cut off by someone pressing the button again.
 */
router.post('/generate', async (req, res) => {
  try {
    const { customer_id, period_month, headline } = req.body || {};
    if (!customer_id) return res.status(400).json({ error: 'customer_id es obligatorio' });
    const month = `${String(period_month || new Date().toISOString().slice(0, 7)).slice(0, 7)}-01`;

    const existing = await req.pool.query(
      'SELECT token FROM client_reports WHERE customer_id = $1 AND period_month = $2::date',
      [customer_id, month]
    );

    let token;
    if (existing.rows.length) {
      token = existing.rows[0].token;
      if (headline !== undefined) {
        await req.pool.query(
          'UPDATE client_reports SET headline = $1 WHERE customer_id = $2 AND period_month = $3::date',
          [headline || null, customer_id, month]
        );
      }
    } else {
      token = crypto.randomBytes(24).toString('hex');
      await req.pool.query(
        `INSERT INTO client_reports (customer_id, period_month, token, headline, created_by)
         VALUES ($1, $2::date, $3, $4, $5)`,
        [customer_id, month, token, headline || null, req.user?.id || null]
      );
    }

    const base = process.env.FRONTEND_URL || req.headers.origin || '';
    res.json({ success: true, token, url: `${base.replace(/\/$/, '')}/reporte/${token}` });
  } catch (e) {
    console.error('Error generating client report:', e);
    res.status(500).json({ error: 'No se pudo generar el reporte' });
  }
});

/**
 * GET /api/reports/customer/:id — the links already generated for a client,
 * so the hub can show and re-share them instead of minting duplicates.
 */
router.get('/customer/:id', async (req, res) => {
  try {
    const r = await req.pool.query(
      `SELECT period_month, token, headline, created_at, last_viewed_at, view_count
         FROM client_reports WHERE customer_id = $1 ORDER BY period_month DESC LIMIT 12`,
      [req.params.id]
    );
    res.json({ reports: r.rows });
  } catch (e) {
    console.error('Error listing client reports:', e);
    res.status(500).json({ error: 'No se pudieron listar los reportes' });
  }
});

module.exports = { router, buildReport };
