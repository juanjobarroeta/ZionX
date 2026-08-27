/**
 * Meta metrics sync — the pipeline that turns Meta's API into stored history.
 *
 * Three jobs, all idempotent and all dated:
 *   · accounts — a daily snapshot per connected Facebook Page / Instagram account
 *   · posts    — a daily snapshot per published post, so a post's curve is visible
 *   · ads      — one row per ad account per day, plus a monthly roll-up
 *
 * Everything upserts on (entity, date). Re-running a sync corrects the day it
 * runs for instead of appending duplicates, which means a backfill and a
 * scheduled run are the same operation.
 *
 * Nothing in here throws: one broken account must not stop the other twenty.
 */

const metaService = require('./metaService');

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;

/**
 * Daily snapshot per connected account: followers, views, reach, engagement.
 * Instagram and Facebook report different metric names; both are normalized by
 * metaService before they land here.
 */
async function syncAccountInsights(pool) {
  const accounts = await pool.query(`
    SELECT * FROM social_accounts
    WHERE is_active = true
      AND access_token IS NOT NULL
      AND (token_expires_at IS NULL OR token_expires_at > NOW())
  `);

  const day = today();
  let synced = 0;
  const errors = [];

  for (const account of accounts.rows) {
    try {
      let result;
      let followers = null;

      if (account.platform === 'instagram') {
        const info = await metaService.getInstagramAccount(account.platform_account_id, account.access_token);
        if (info.success) followers = Number(info.account.followers_count) || 0;
        result = await metaService.getInstagramInsights(account.platform_account_id, account.access_token, 'day');
      } else if (account.platform === 'facebook') {
        result = await metaService.getFacebookPageInsights(account.platform_account_id, account.access_token, 'day');
        if (result.success) followers = result.metrics.followers || null;
      } else {
        continue; // platform we don't pull metrics for yet
      }

      if (!result.success) {
        errors.push({ account: account.id, platform: account.platform, error: result.error });
        continue;
      }

      const m = result.metrics;
      await pool.query(`
        INSERT INTO account_analytics (
          social_account_id, snapshot_date, followers_count, followers_gained, followers_lost,
          total_reach, profile_views, views, accounts_engaged, total_interactions,
          likes, comments, shares, saves, replies, link_clicks, video_views, page_actions,
          raw, fetched_at
        ) VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
        ON CONFLICT (social_account_id, snapshot_date) DO UPDATE SET
          followers_count = EXCLUDED.followers_count,
          followers_gained = EXCLUDED.followers_gained,
          followers_lost = EXCLUDED.followers_lost,
          total_reach = EXCLUDED.total_reach,
          profile_views = EXCLUDED.profile_views,
          views = EXCLUDED.views,
          accounts_engaged = EXCLUDED.accounts_engaged,
          total_interactions = EXCLUDED.total_interactions,
          likes = EXCLUDED.likes,
          comments = EXCLUDED.comments,
          shares = EXCLUDED.shares,
          saves = EXCLUDED.saves,
          replies = EXCLUDED.replies,
          link_clicks = EXCLUDED.link_clicks,
          video_views = EXCLUDED.video_views,
          page_actions = EXCLUDED.page_actions,
          raw = EXCLUDED.raw,
          fetched_at = NOW()
      `, [
        account.id, day,
        followers ?? 0, m.followers_gained || 0, m.followers_lost || 0,
        m.reach || 0, m.profile_views || 0, m.views || 0, m.accounts_engaged || 0,
        m.total_interactions || 0, m.likes || 0, m.comments || 0, m.shares || 0,
        m.saves || 0, m.replies || 0, m.link_clicks || 0, m.video_views || 0, m.actions || 0,
        JSON.stringify(result.raw || []),
      ]);

      if (followers !== null) {
        await pool.query(
          'UPDATE social_accounts SET followers_count = $1, last_synced_at = NOW() WHERE id = $2',
          [followers, account.id]
        );
      }
      synced++;
    } catch (err) {
      errors.push({ account: account.id, error: err.message });
    }
  }

  return { synced, total: accounts.rows.length, errors };
}

/**
 * Daily snapshot per published post. Only posts from the last `windowDays` are
 * refreshed — older ones stop moving, and Instagram only keeps insights for 90
 * days anyway. The stored rows keep the history regardless.
 */
async function syncPostInsights(pool, { windowDays = 30, limit = 200 } = {}) {
  const posts = await pool.query(`
    SELECT sp.id, sp.platform_post_id, sp.content_type, sp.customer_id,
           sa.id AS account_id, sa.platform, sa.access_token
      FROM scheduled_posts sp
      JOIN social_accounts sa ON sa.id = sp.social_account_id
     WHERE sp.status = 'published'
       AND sp.platform_post_id IS NOT NULL
       AND sp.published_at > NOW() - ($1 || ' days')::interval
       AND sa.is_active = true
       AND sa.access_token IS NOT NULL
       AND (sa.token_expires_at IS NULL OR sa.token_expires_at > NOW())
     ORDER BY sp.published_at DESC
     LIMIT $2
  `, [String(windowDays), limit]);

  const day = today();
  let synced = 0;
  const errors = [];

  for (const post of posts.rows) {
    try {
      const result = post.platform === 'instagram'
        ? await metaService.getInstagramMediaInsights(post.platform_post_id, post.access_token, mediaTypeOf(post.content_type))
        : await metaService.getFacebookPostInsights(post.platform_post_id, post.access_token);

      if (!result.success) {
        errors.push({ post: post.id, error: result.error });
        continue;
      }

      const m = result.metrics;
      const interactions = m.total_interactions
        || (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
      // Engagement rate against reach — the denominator clients recognize.
      const rate = m.reach > 0 ? Math.min(999.99, (interactions / m.reach) * 100) : 0;

      await pool.query(`
        INSERT INTO post_analytics (
          scheduled_post_id, social_account_id, platform_post_id, snapshot_date,
          views, reach, likes, comments, shares, saves, clicks, video_views,
          total_interactions, replies, navigation, profile_visits, follows, link_clicks,
          avg_watch_time, total_watch_time, engagement_rate, media_type, platform,
          customer_id, raw, fetched_at
        ) VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW())
        ON CONFLICT (platform_post_id, snapshot_date) DO UPDATE SET
          views = EXCLUDED.views, reach = EXCLUDED.reach, likes = EXCLUDED.likes,
          comments = EXCLUDED.comments, shares = EXCLUDED.shares, saves = EXCLUDED.saves,
          clicks = EXCLUDED.clicks, video_views = EXCLUDED.video_views,
          total_interactions = EXCLUDED.total_interactions, replies = EXCLUDED.replies,
          navigation = EXCLUDED.navigation, profile_visits = EXCLUDED.profile_visits,
          follows = EXCLUDED.follows, link_clicks = EXCLUDED.link_clicks,
          avg_watch_time = EXCLUDED.avg_watch_time, total_watch_time = EXCLUDED.total_watch_time,
          engagement_rate = EXCLUDED.engagement_rate, raw = EXCLUDED.raw, fetched_at = NOW()
      `, [
        post.id, post.account_id, post.platform_post_id, day,
        m.views || 0, m.reach || 0, m.likes || 0, m.comments || 0, m.shares || 0,
        m.saves || 0, m.link_clicks || 0, m.video_views || 0,
        interactions, m.replies || 0, m.navigation || 0, m.profile_visits || 0,
        m.follows || 0, m.link_clicks || 0,
        m.avg_watch_time || 0, m.total_watch_time || 0, rate.toFixed(2),
        mediaTypeOf(post.content_type), post.platform, post.customer_id || null,
        JSON.stringify(result.raw || []),
      ]);
      synced++;
    } catch (err) {
      errors.push({ post: post.id, error: err.message });
    }
  }

  return { synced, total: posts.rows.length, errors };
}

/** Map our content_type vocabulary onto Instagram's media types. */
function mediaTypeOf(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t === 'story') return 'STORY';
  if (t === 'reel' || t === 'video') return 'REELS';
  if (t === 'carrusel' || t === 'carousel') return 'CAROUSEL_ALBUM';
  return 'IMAGE';
}

/**
 * Daily ad spend for a lookback window, then a monthly roll-up.
 *
 * The window matters: Meta keeps attributing conversions to a day for a while
 * after it, so yesterday's number is not final. Re-pulling the last few days on
 * every run lets those late numbers correct themselves.
 */
async function syncAdSpend(pool, { lookbackDays = 14 } = {}) {
  const accounts = await pool.query(`
    SELECT id, platform_account_id, access_token, currency
      FROM ad_accounts
     WHERE is_active = true AND platform = 'meta' AND access_token IS NOT NULL
       AND (token_expires_at IS NULL OR token_expires_at > NOW())
  `);

  const since = daysAgo(lookbackDays);
  const until = today();
  let synced = 0;
  const errors = [];
  const touchedMonths = new Set();

  for (const acct of accounts.rows) {
    try {
      const result = await metaService.getAdAccountInsightsDaily(
        acct.platform_account_id, acct.access_token, since, until
      );
      if (!result.success) {
        errors.push({ id: acct.id, error: result.error });
        continue;
      }

      for (const d of result.days) {
        await pool.query(`
          INSERT INTO ad_spend_daily (
            ad_account_id, day, spend, impressions, clicks, reach, frequency,
            cpc, cpm, ctr, link_clicks, leads, purchases, post_engagements,
            conversations_started, currency, fetched_at
          ) VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
          ON CONFLICT (ad_account_id, day) DO UPDATE SET
            spend = EXCLUDED.spend, impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks, reach = EXCLUDED.reach, frequency = EXCLUDED.frequency,
            cpc = EXCLUDED.cpc, cpm = EXCLUDED.cpm, ctr = EXCLUDED.ctr,
            link_clicks = EXCLUDED.link_clicks, leads = EXCLUDED.leads,
            purchases = EXCLUDED.purchases, post_engagements = EXCLUDED.post_engagements,
            conversations_started = EXCLUDED.conversations_started,
            currency = EXCLUDED.currency, fetched_at = NOW()
        `, [
          acct.id, d.date, d.spend, d.impressions, d.clicks, d.reach, d.frequency,
          d.cpc, d.cpm, d.ctr, d.link_clicks, d.leads, d.purchases, d.post_engagements,
          d.conversations_started, acct.currency || null,
        ]);
        touchedMonths.add(`${acct.id}|${monthStart(d.date)}`);
      }

      await pool.query('UPDATE ad_accounts SET last_synced_at = NOW() WHERE id = $1', [acct.id]);
      synced++;
    } catch (err) {
      errors.push({ id: acct.id, error: err.message });
    }
  }

  await rollUpMonthlySpend(pool, touchedMonths);
  return { synced, total: accounts.rows.length, days: `${since}..${until}`, errors };
}

/**
 * Recompute ad_spend_monthly from the daily rows. The portal and the ad-account
 * screen read the monthly table, so it stays authoritative — just derived now.
 */
async function rollUpMonthlySpend(pool, touched) {
  for (const key of touched) {
    const [accountId, month] = key.split('|');
    await pool.query(`
      INSERT INTO ad_spend_monthly (
        ad_account_id, period_month, spend, impressions, clicks, reach,
        link_clicks, leads, conversations_started, currency, fetched_at
      )
      SELECT $1, $2::date,
             COALESCE(SUM(spend), 0), COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0),
             COALESCE(SUM(reach), 0), COALESCE(SUM(link_clicks), 0), COALESCE(SUM(leads), 0),
             COALESCE(SUM(conversations_started), 0), MAX(currency), NOW()
        FROM ad_spend_daily
       WHERE ad_account_id = $1
         AND day >= $2::date AND day < ($2::date + INTERVAL '1 month')
      ON CONFLICT (ad_account_id, period_month) DO UPDATE SET
        spend = EXCLUDED.spend, impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
        reach = EXCLUDED.reach, link_clicks = EXCLUDED.link_clicks, leads = EXCLUDED.leads,
        conversations_started = EXCLUDED.conversations_started,
        currency = COALESCE(EXCLUDED.currency, ad_spend_monthly.currency), fetched_at = NOW()
    `, [accountId, month]);
  }
}

module.exports = { syncAccountInsights, syncPostInsights, syncAdSpend, rollUpMonthlySpend };
