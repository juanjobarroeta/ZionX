/**
 * Social Media Integration Routes
 * Handles Meta (Facebook/Instagram) OAuth, posting, and analytics
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const metaService = require('../services/metaService');

// Meta App credentials - read at request time to ensure dotenv is loaded
const getMetaConfig = () => ({
  appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID,
  appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
  redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5174/social/callback',
  configId: process.env.META_CONFIG_ID || null
});

// In-memory store for OAuth state tokens (use Redis in production)
const pendingOAuthStates = new Map();

// Log config at startup
console.log('📱 Meta API Config:', {
  hasAppId: !!(process.env.META_APP_ID || process.env.FACEBOOK_APP_ID),
  hasAppSecret: !!(process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET),
  redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5174/social/callback'
});

// =====================================================
// HELPER: Validate token before API calls
// =====================================================
async function getValidAccount(pool, accountId) {
  const result = await pool.query(
    'SELECT * FROM social_accounts WHERE id = $1 AND is_active = true',
    [accountId]
  );

  if (!result.rows.length) {
    return { error: 'Account not found', status: 404 };
  }

  const account = result.rows[0];

  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    return { error: 'Token expired — please reconnect this account from Social Accounts', status: 401 };
  }

  return { account };
}

// =====================================================
// OAUTH / ACCOUNT CONNECTION
// =====================================================

/**
 * GET /api/social/auth-url
 * Get the OAuth URL to connect Meta accounts
 */
router.get('/auth-url', (req, res) => {
  try {
    const { appId, redirectUri, configId } = getMetaConfig();

    if (!appId) {
      return res.status(400).json({
        error: 'Meta App ID not configured. Add META_APP_ID to your .env file.',
        setup_required: true
      });
    }

    // Generate cryptographically secure state token for CSRF protection
    const stateToken = crypto.randomBytes(32).toString('hex');
    pendingOAuthStates.set(stateToken, {
      userId: req.user.id,
      createdAt: Date.now()
    });

    // Clean up stale states older than 10 minutes
    for (const [key, val] of pendingOAuthStates) {
      if (Date.now() - val.createdAt > 600000) pendingOAuthStates.delete(key);
    }

    const authUrl = metaService.getOAuthUrl(appId, redirectUri, stateToken, configId);

    res.json({ authUrl, configured: true, usesConfigId: !!configId });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * POST /api/social/callback
 * Handle OAuth callback and exchange code for token
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Validate CSRF state token
    if (!state || !pendingOAuthStates.has(state)) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state. Please try connecting again.' });
    }
    const stateData = pendingOAuthStates.get(state);
    pendingOAuthStates.delete(state);

    if (stateData.userId !== req.user.id) {
      return res.status(403).json({ error: 'OAuth state mismatch' });
    }

    const { appId, appSecret, redirectUri } = getMetaConfig();

    if (!appId || !appSecret) {
      return res.status(400).json({ error: 'Meta App credentials not configured' });
    }

    // Exchange code for short-lived access token
    const tokenResult = await metaService.exchangeCodeForToken(
      code, appId, appSecret, redirectUri
    );

    if (!tokenResult.success) {
      return res.status(400).json({ error: tokenResult.error });
    }

    // Exchange for long-lived token (60 days)
    const longLivedResult = await metaService.getLongLivedToken(
      tokenResult.accessToken, appId, appSecret
    );

    const accessToken = longLivedResult.success ? longLivedResult.accessToken : tokenResult.accessToken;
    // Use actual expiration from Meta, fall back to 60 days
    const expiresInSeconds = longLivedResult.success ? (longLivedResult.expiresIn || 5184000) : 3600;

    // Get Facebook Pages the user manages
    const pagesResult = await metaService.getFacebookPages(accessToken);

    if (!pagesResult.success) {
      return res.status(400).json({ error: pagesResult.error });
    }

    const connectedAccounts = [];

    for (const page of pagesResult.pages) {
      // Page access tokens from long-lived user tokens are already long-lived and don't expire
      const pageToken = page.access_token;

      const existing = await req.pool.query(
        'SELECT id FROM social_accounts WHERE platform = $1 AND platform_account_id = $2',
        ['facebook', page.id]
      );

      if (existing.rows.length > 0) {
        await req.pool.query(`
          UPDATE social_accounts SET
            access_token = $1,
            token_expires_at = NOW() + INTERVAL '${Math.floor(expiresInSeconds)} seconds',
            account_name = $2,
            account_picture_url = $3,
            instagram_account_id = $4,
            is_active = true,
            updated_at = NOW()
          WHERE id = $5
        `, [
          pageToken,
          page.name,
          page.picture?.data?.url,
          page.instagram_business_account?.id,
          existing.rows[0].id
        ]);

        connectedAccounts.push({ id: existing.rows[0].id, name: page.name, updated: true });
      } else {
        const result = await req.pool.query(`
          INSERT INTO social_accounts (
            user_id, platform, platform_account_id, account_name,
            account_picture_url, account_type, access_token,
            token_expires_at, instagram_account_id
          ) VALUES ($1, 'facebook', $2, $3, $4, 'page', $5, NOW() + INTERVAL '${Math.floor(expiresInSeconds)} seconds', $6)
          RETURNING id
        `, [
          req.user.id,
          page.id,
          page.name,
          page.picture?.data?.url,
          pageToken,
          page.instagram_business_account?.id
        ]);

        connectedAccounts.push({ id: result.rows[0].id, name: page.name, new: true });

        // If page has linked Instagram Business account, store it too
        if (page.instagram_business_account?.id) {
          const igResult = await metaService.getInstagramAccount(
            page.instagram_business_account.id,
            pageToken
          );

          if (igResult.success) {
            await req.pool.query(`
              INSERT INTO social_accounts (
                user_id, platform, platform_account_id, account_name,
                account_username, account_picture_url, account_type,
                access_token, token_expires_at, followers_count
              ) VALUES ($1, 'instagram', $2, $3, $4, $5, 'business', $6, NOW() + INTERVAL '${Math.floor(expiresInSeconds)} seconds', $7)
              ON CONFLICT (platform, platform_account_id) DO UPDATE SET
                access_token = $6,
                token_expires_at = NOW() + INTERVAL '${Math.floor(expiresInSeconds)} seconds',
                followers_count = $7,
                updated_at = NOW()
            `, [
              req.user.id,
              igResult.account.id,
              igResult.account.name,
              igResult.account.username,
              igResult.account.profile_picture_url,
              pageToken,
              igResult.account.followers_count
            ]);

            connectedAccounts.push({
              platform: 'instagram',
              username: igResult.account.username
            });
          }
        }
      }
    }

    console.log(`✅ Connected ${connectedAccounts.length} social accounts for user ${req.user.id}`);
    res.json({
      success: true,
      accounts: connectedAccounts,
      message: `Successfully connected ${connectedAccounts.length} account(s)`
    });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.status(500).json({ error: 'Failed to connect accounts' });
  }
});

/**
 * GET /api/social/accounts
 * Get all connected social accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const { customer_id } = req.query;

    let query = `
      SELECT
        sa.*,
        CONCAT(c.first_name, ' ', c.last_name) as customer_name,
        CASE WHEN sa.token_expires_at < NOW() THEN true ELSE false END as token_expired,
        CASE WHEN sa.token_expires_at < NOW() + INTERVAL '7 days' THEN true ELSE false END as token_expiring_soon
      FROM social_accounts sa
      LEFT JOIN customers c ON sa.customer_id = c.id
      WHERE sa.is_active = true
    `;
    const params = [];

    if (customer_id) {
      params.push(customer_id);
      query += ` AND sa.customer_id = $${params.length}`;
    }

    query += ' ORDER BY sa.platform, sa.account_name';

    const result = await req.pool.query(query, params);

    // Remove sensitive data but include token status
    const accounts = result.rows.map(acc => ({
      ...acc,
      access_token: acc.access_token ? '••••••' : null
    }));

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

/**
 * DELETE /api/social/accounts/:id
 * Disconnect a social account
 */
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.pool.query(
      'UPDATE social_accounts SET is_active = false, access_token = NULL WHERE id = $1',
      [id]
    );

    res.json({ message: 'Account disconnected' });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

/**
 * POST /api/social/accounts/refresh-tokens
 * Refresh tokens for all accounts expiring within 7 days
 */
router.post('/accounts/refresh-tokens', async (req, res) => {
  try {
    const { appId, appSecret } = getMetaConfig();

    if (!appId || !appSecret) {
      return res.status(400).json({ error: 'Meta App credentials not configured' });
    }

    // Find accounts expiring within 7 days
    const expiring = await req.pool.query(`
      SELECT * FROM social_accounts
      WHERE is_active = true
        AND access_token IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW() + INTERVAL '7 days'
        AND token_expires_at > NOW()
    `);

    let refreshed = 0;
    let failed = 0;

    for (const account of expiring.rows) {
      const result = await metaService.refreshLongLivedToken(
        account.access_token, appId, appSecret
      );

      if (result.success) {
        const expiresIn = result.expiresIn || 5184000;
        await req.pool.query(`
          UPDATE social_accounts SET
            access_token = $1,
            token_expires_at = NOW() + INTERVAL '${Math.floor(expiresIn)} seconds',
            updated_at = NOW()
          WHERE id = $2
        `, [result.accessToken, account.id]);
        refreshed++;
      } else {
        console.error(`Failed to refresh token for account ${account.id}:`, result.error);
        failed++;
      }
    }

    console.log(`🔄 Token refresh: ${refreshed} refreshed, ${failed} failed out of ${expiring.rows.length} expiring`);
    res.json({
      message: `Refreshed ${refreshed} tokens`,
      refreshed,
      failed,
      total_expiring: expiring.rows.length
    });
  } catch (error) {
    console.error('Error refreshing tokens:', error);
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

// =====================================================
// CONTENT CALENDAR → SCHEDULED POSTS BRIDGE
// =====================================================

/**
 * POST /api/social/schedule-from-calendar
 * Create a scheduled post from a content calendar entry.
 * Links the calendar item to a social account for automated publishing.
 */
router.post('/schedule-from-calendar', async (req, res) => {
  try {
    const { calendar_entry_id, account_id, scheduled_for } = req.body;

    if (!calendar_entry_id || !account_id) {
      return res.status(400).json({ error: 'calendar_entry_id and account_id are required' });
    }

    // Fetch the calendar entry
    const calendarResult = await req.pool.query(
      'SELECT * FROM content_calendar WHERE id = $1',
      [calendar_entry_id]
    );

    if (!calendarResult.rows.length) {
      return res.status(404).json({ error: 'Calendar entry not found' });
    }

    const entry = calendarResult.rows[0];

    // Build the post message from calendar fields
    const message = entry.copy_out || entry.copy_in || '';
    if (!message.trim()) {
      return res.status(400).json({ error: 'Calendar entry has no copy text (copy_out/copy_in)' });
    }

    // Build media URLs from arte or fotos_video fields
    const mediaUrls = [];
    if (entry.arte) mediaUrls.push(entry.arte);
    if (entry.fotos_video) mediaUrls.push(entry.fotos_video);

    // Use scheduled_date from calendar if no explicit time provided
    const publishAt = scheduled_for || entry.scheduled_date || entry.publish_date;
    if (!publishAt) {
      return res.status(400).json({ error: 'No publish date found — set scheduled_for or update the calendar entry date' });
    }

    // Check for duplicate
    const existing = await req.pool.query(
      'SELECT id FROM scheduled_posts WHERE social_account_id = $1 AND message = $2 AND scheduled_for::date = $3::date AND status != $4',
      [account_id, message, publishAt, 'cancelled']
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A post with this content is already scheduled for this date' });
    }

    // Create the scheduled post
    const result = await req.pool.query(`
      INSERT INTO scheduled_posts (
        social_account_id, customer_id, content_type, message,
        media_urls, scheduled_for, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
      RETURNING *
    `, [
      account_id,
      entry.customer_id,
      entry.content_type || entry.formato || 'post',
      message,
      mediaUrls.length > 0 ? mediaUrls : null,
      publishAt,
      req.user.id
    ]);

    // Update calendar entry status
    await req.pool.query(
      "UPDATE content_calendar SET status = 'programado', updated_at = NOW() WHERE id = $1",
      [calendar_entry_id]
    );

    console.log(`📅 Calendar entry #${calendar_entry_id} → scheduled post #${result.rows[0].id}`);
    res.status(201).json({
      success: true,
      scheduled_post: result.rows[0],
      message: 'Post scheduled from calendar entry'
    });
  } catch (error) {
    console.error('Error scheduling from calendar:', error);
    res.status(500).json({ error: 'Failed to schedule post from calendar' });
  }
});

/**
 * POST /api/social/schedule-batch-from-calendar
 * Schedule multiple calendar entries at once for a customer's month.
 */
router.post('/schedule-batch-from-calendar', async (req, res) => {
  try {
    const { customer_id, month_year, account_id } = req.body;

    if (!customer_id || !month_year || !account_id) {
      return res.status(400).json({ error: 'customer_id, month_year, and account_id are required' });
    }

    // Get all approved calendar entries for this customer/month that haven't been scheduled
    const entries = await req.pool.query(`
      SELECT * FROM content_calendar
      WHERE customer_id = $1
        AND month_year = $2
        AND status IN ('aprobado', 'approved')
        AND (scheduled_date IS NOT NULL OR publish_date IS NOT NULL)
        AND (copy_out IS NOT NULL OR copy_in IS NOT NULL)
      ORDER BY post_number ASC
    `, [customer_id, month_year]);

    if (entries.rows.length === 0) {
      return res.status(404).json({ error: 'No approved calendar entries with dates and copy found' });
    }

    let scheduled = 0;
    let skipped = 0;
    const results = [];

    for (const entry of entries.rows) {
      const message = entry.copy_out || entry.copy_in;
      const publishAt = entry.scheduled_date || entry.publish_date;
      const mediaUrls = [];
      if (entry.arte) mediaUrls.push(entry.arte);
      if (entry.fotos_video) mediaUrls.push(entry.fotos_video);

      // Skip if already scheduled
      const existing = await req.pool.query(
        'SELECT id FROM scheduled_posts WHERE social_account_id = $1 AND message = $2 AND scheduled_for::date = $3::date AND status != $4',
        [account_id, message, publishAt, 'cancelled']
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      const result = await req.pool.query(`
        INSERT INTO scheduled_posts (
          social_account_id, customer_id, content_type, message,
          media_urls, scheduled_for, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
        RETURNING id
      `, [
        account_id, customer_id,
        entry.content_type || entry.formato || 'post',
        message, mediaUrls.length > 0 ? mediaUrls : null,
        publishAt, req.user.id
      ]);

      await req.pool.query(
        "UPDATE content_calendar SET status = 'programado', updated_at = NOW() WHERE id = $1",
        [entry.id]
      );

      results.push({ calendar_id: entry.id, post_id: result.rows[0].id });
      scheduled++;
    }

    console.log(`📅 Batch scheduled: ${scheduled} posts from calendar (${skipped} skipped)`);
    res.status(201).json({
      success: true,
      scheduled,
      skipped,
      total_entries: entries.rows.length,
      posts: results
    });
  } catch (error) {
    console.error('Error batch scheduling from calendar:', error);
    res.status(500).json({ error: 'Failed to batch schedule' });
  }
});

// =====================================================
// POSTING
// =====================================================

/**
 * POST /api/social/post
 * Post to a social account immediately
 */
router.post('/post', async (req, res) => {
  try {
    const { account_id, message, media_urls, link_url } = req.body;

    if (!account_id || !message) {
      return res.status(400).json({ error: 'account_id and message are required' });
    }

    const { account, error, status } = await getValidAccount(req.pool, account_id);
    if (error) return res.status(status).json({ error });

    let result;

    if (account.platform === 'facebook') {
      result = await metaService.postToFacebookPage(
        account.platform_account_id,
        account.access_token,
        { message, link: link_url, photoUrl: media_urls?.[0] }
      );
    } else if (account.platform === 'instagram') {
      if (!media_urls?.length) {
        return res.status(400).json({ error: 'Instagram posts require at least one image' });
      }

      if (media_urls.length === 1) {
        result = await metaService.postToInstagram(
          account.platform_account_id,
          account.access_token,
          { imageUrl: media_urls[0], caption: message }
        );
      } else {
        result = await metaService.postCarouselToInstagram(
          account.platform_account_id,
          account.access_token,
          { imageUrls: media_urls, caption: message }
        );
      }
    } else {
      return res.status(400).json({ error: `Platform ${account.platform} not supported yet` });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log the published post
    await req.pool.query(`
      INSERT INTO scheduled_posts (
        social_account_id, message, media_urls, link_url,
        scheduled_for, status, published_at, platform_post_id, created_by
      ) VALUES ($1, $2, $3, $4, NOW(), 'published', NOW(), $5, $6)
    `, [account_id, message, media_urls, link_url, result.postId || result.mediaId, req.user.id]);

    console.log(`📱 Posted to ${account.platform}: ${result.postId || result.mediaId}`);
    res.json({
      success: true,
      postId: result.postId || result.mediaId,
      platform: account.platform
    });
  } catch (error) {
    console.error('Error posting:', error);
    res.status(500).json({ error: 'Failed to post' });
  }
});

/**
 * POST /api/social/schedule
 * Schedule a post for later
 */
router.post('/schedule', async (req, res) => {
  try {
    const {
      account_id, customer_id, message, media_urls, link_url,
      scheduled_for, content_type = 'post'
    } = req.body;

    if (!account_id || !message || !scheduled_for) {
      return res.status(400).json({ error: 'account_id, message, and scheduled_for are required' });
    }

    const result = await req.pool.query(`
      INSERT INTO scheduled_posts (
        social_account_id, customer_id, content_type, message,
        media_urls, link_url, scheduled_for, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [account_id, customer_id, content_type, message, media_urls, link_url, scheduled_for, req.user.id]);

    console.log(`📅 Scheduled post for ${scheduled_for}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error scheduling post:', error);
    res.status(500).json({ error: 'Failed to schedule post' });
  }
});

/**
 * GET /api/social/scheduled
 * Get scheduled posts
 */
router.get('/scheduled', async (req, res) => {
  try {
    const { customer_id, status = 'scheduled' } = req.query;

    let query = `
      SELECT
        sp.*,
        sa.platform,
        sa.account_name,
        sa.account_username
      FROM scheduled_posts sp
      JOIN social_accounts sa ON sp.social_account_id = sa.id
      WHERE sp.status = $1
    `;
    const params = [status];

    if (customer_id) {
      params.push(customer_id);
      query += ` AND sp.customer_id = $${params.length}`;
    }

    query += ' ORDER BY sp.scheduled_for ASC';

    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled posts' });
  }
});

/**
 * DELETE /api/social/scheduled/:id
 * Cancel a scheduled post
 */
router.delete('/scheduled/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.pool.query(
      "UPDATE scheduled_posts SET status = 'cancelled' WHERE id = $1 AND status = 'scheduled'",
      [id]
    );

    res.json({ message: 'Post cancelled' });
  } catch (error) {
    console.error('Error cancelling post:', error);
    res.status(500).json({ error: 'Failed to cancel post' });
  }
});

// =====================================================
// ANALYTICS & INSIGHTS
// =====================================================

/**
 * GET /api/social/accounts/:id/insights
 * Get insights for a social account
 */
router.get('/accounts/:id/insights', async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'days_28' } = req.query;

    const { account, error, status } = await getValidAccount(req.pool, id);
    if (error) return res.status(status).json({ error });

    let insights;

    if (account.platform === 'facebook') {
      insights = await metaService.getFacebookPageInsights(
        account.platform_account_id,
        account.access_token,
        period
      );
    } else if (account.platform === 'instagram') {
      insights = await metaService.getInstagramInsights(
        account.platform_account_id,
        account.access_token,
        period === 'days_28' ? 'day' : period
      );
    }

    if (!insights?.success) {
      return res.status(400).json({ error: insights?.error || 'Failed to fetch insights' });
    }

    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/social/accounts/:id/posts
 * Get recent posts from a social account
 */
router.get('/accounts/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const { account, error, status } = await getValidAccount(req.pool, id);
    if (error) return res.status(status).json({ error });

    let posts;

    if (account.platform === 'facebook') {
      posts = await metaService.getFacebookPagePosts(
        account.platform_account_id,
        account.access_token,
        parseInt(limit)
      );
    } else if (account.platform === 'instagram') {
      posts = await metaService.getInstagramMedia(
        account.platform_account_id,
        account.access_token,
        parseInt(limit)
      );
    }

    if (!posts?.success) {
      return res.status(400).json({ error: posts?.error || 'Failed to fetch posts' });
    }

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * POST /api/social/sync-analytics
 * Sync analytics for all active accounts
 */
router.post('/sync-analytics', async (req, res) => {
  try {
    const accounts = await req.pool.query(
      `SELECT * FROM social_accounts
       WHERE is_active = true
         AND (token_expires_at IS NULL OR token_expires_at > NOW())`
    );

    let synced = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const account of accounts.rows) {
      try {
        let insights;

        if (account.platform === 'facebook') {
          insights = await metaService.getFacebookPageInsights(
            account.platform_account_id,
            account.access_token,
            'day'
          );
        } else if (account.platform === 'instagram') {
          const accountInfo = await metaService.getInstagramAccount(
            account.platform_account_id,
            account.access_token
          );

          if (accountInfo.success) {
            await req.pool.query(`
              UPDATE social_accounts SET
                followers_count = $1,
                last_synced_at = NOW()
              WHERE id = $2
            `, [accountInfo.account.followers_count, account.id]);
          }

          insights = await metaService.getInstagramInsights(
            account.platform_account_id,
            account.access_token,
            'day'
          );
        }

        if (insights?.success) {
          let impressions = 0, reach = 0;

          for (const metric of insights.insights || []) {
            if (metric.name.includes('impressions')) impressions = metric.values?.[0]?.value || 0;
            if (metric.name.includes('reach')) reach = metric.values?.[0]?.value || 0;
          }

          await req.pool.query(`
            INSERT INTO account_analytics (social_account_id, snapshot_date, total_impressions, total_reach)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (social_account_id, snapshot_date) DO UPDATE SET
              total_impressions = $3,
              total_reach = $4
          `, [account.id, today, impressions, reach]);

          synced++;
        }
      } catch (err) {
        console.error(`Error syncing account ${account.id}:`, err.message);
      }
    }

    console.log(`📊 Synced analytics for ${synced}/${accounts.rows.length} accounts`);
    res.json({ message: `Synced ${synced} accounts`, total: accounts.rows.length });
  } catch (error) {
    console.error('Error syncing analytics:', error);
    res.status(500).json({ error: 'Failed to sync analytics' });
  }
});

/**
 * GET /api/social/config
 * Get current Meta API configuration status
 */
router.get('/config', (req, res) => {
  const { appId, appSecret, redirectUri, configId } = getMetaConfig();
  res.json({
    configured: !!(appId && appSecret),
    hasAppId: !!appId,
    hasAppSecret: !!appSecret,
    hasConfigId: !!configId,
    redirectUri: redirectUri,
    apiVersion: 'v21.0',
    loginFlow: configId ? 'facebook_login_for_business' : 'classic_oauth',
    // TEMPORARY diagnostic — remove after OAuth is working
    debug: {
      appIdLength: (appId || '').length,
      appIdStart: (appId || '').substring(0, 6),
      appIdEnd: (appId || '').substring((appId || '').length - 4),
      secretLength: (appSecret || '').length,
      secretStart: (appSecret || '').substring(0, 4),
      secretEnd: (appSecret || '').substring((appSecret || '').length - 4),
      secretHasWhitespace: (appSecret || '') !== (appSecret || '').trim(),
      configIdValue: configId,
      redirectUriRaw: redirectUri,
      envMetaAppId: !!process.env.META_APP_ID,
      envMetaAppSecret: !!process.env.META_APP_SECRET,
      envFacebookAppId: !!process.env.FACEBOOK_APP_ID,
      envFacebookAppSecret: !!process.env.FACEBOOK_APP_SECRET
    },
    instructions: !appId ?
      'To enable Meta integration, add META_APP_ID and META_APP_SECRET to your .env file. Get these from developers.facebook.com' :
      null
  });
});

module.exports = router;
