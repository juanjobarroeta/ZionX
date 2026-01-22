/**
 * Social Media Integration Routes
 * Handles Meta (Facebook/Instagram) OAuth, posting, and analytics
 */

const express = require('express');
const router = express.Router();
const metaService = require('../services/metaService');

// Meta App credentials - read at request time to ensure dotenv is loaded
const getMetaConfig = () => ({
  appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID,
  appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
  redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5174/social/callback'
});

// Log config at startup
console.log('📱 Meta API Config:', {
  hasAppId: !!(process.env.META_APP_ID || process.env.FACEBOOK_APP_ID),
  hasAppSecret: !!(process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET),
  redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5174/social/callback'
});

// =====================================================
// OAUTH / ACCOUNT CONNECTION
// =====================================================

/**
 * GET /api/social/auth-url
 * Get the OAuth URL to connect Meta accounts
 */
router.get('/auth-url', (req, res) => {
  try {
    const { appId, redirectUri } = getMetaConfig();
    
    console.log('🔑 Auth URL request - App ID:', appId, 'Redirect:', redirectUri);
    
    if (!appId) {
      return res.status(400).json({ 
        error: 'Meta App ID not configured. Add META_APP_ID to your .env file.',
        setup_required: true
      });
    }

    const state = Buffer.from(JSON.stringify({ 
      userId: req.user.id,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = metaService.getOAuthUrl(appId, redirectUri, state);
    
    res.json({ 
      authUrl,
      configured: true
    });
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

    const { appId, appSecret, redirectUri } = getMetaConfig();
    
    if (!appId || !appSecret) {
      return res.status(400).json({ error: 'Meta App credentials not configured' });
    }

    // Exchange code for access token
    const tokenResult = await metaService.exchangeCodeForToken(
      code, appId, appSecret, redirectUri
    );

    if (!tokenResult.success) {
      return res.status(400).json({ error: tokenResult.error });
    }

    // Get long-lived token
    const longLivedResult = await metaService.getLongLivedToken(
      tokenResult.accessToken, appId, appSecret
    );

    const accessToken = longLivedResult.success ? longLivedResult.accessToken : tokenResult.accessToken;

    // Get Facebook Pages
    const pagesResult = await metaService.getFacebookPages(accessToken);

    if (!pagesResult.success) {
      return res.status(400).json({ error: pagesResult.error });
    }

    // Store each page as a connected account
    const connectedAccounts = [];

    for (const page of pagesResult.pages) {
      // Check if already connected
      const existing = await req.pool.query(
        'SELECT id FROM social_accounts WHERE platform = $1 AND platform_account_id = $2',
        ['facebook', page.id]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await req.pool.query(`
          UPDATE social_accounts SET
            access_token = $1,
            token_expires_at = NOW() + INTERVAL '60 days',
            account_name = $2,
            account_picture_url = $3,
            instagram_account_id = $4,
            is_active = true,
            updated_at = NOW()
          WHERE id = $5
        `, [
          page.access_token,
          page.name,
          page.picture?.data?.url,
          page.instagram_business_account?.id,
          existing.rows[0].id
        ]);
        
        connectedAccounts.push({ id: existing.rows[0].id, name: page.name, updated: true });
      } else {
        // Insert new
        const result = await req.pool.query(`
          INSERT INTO social_accounts (
            user_id, platform, platform_account_id, account_name, 
            account_picture_url, account_type, access_token, 
            token_expires_at, instagram_account_id
          ) VALUES ($1, 'facebook', $2, $3, $4, 'page', $5, NOW() + INTERVAL '60 days', $6)
          RETURNING id
        `, [
          req.user.id,
          page.id,
          page.name,
          page.picture?.data?.url,
          page.access_token,
          page.instagram_business_account?.id
        ]);

        connectedAccounts.push({ id: result.rows[0].id, name: page.name, new: true });

        // If page has Instagram, also create Instagram account entry
        if (page.instagram_business_account?.id) {
          const igResult = await metaService.getInstagramAccount(
            page.instagram_business_account.id, 
            page.access_token
          );

          if (igResult.success) {
            await req.pool.query(`
              INSERT INTO social_accounts (
                user_id, platform, platform_account_id, account_name,
                account_username, account_picture_url, account_type,
                access_token, token_expires_at, followers_count
              ) VALUES ($1, 'instagram', $2, $3, $4, $5, 'business', $6, NOW() + INTERVAL '60 days', $7)
              ON CONFLICT (platform, platform_account_id) DO UPDATE SET
                access_token = $6,
                token_expires_at = NOW() + INTERVAL '60 days',
                followers_count = $7,
                updated_at = NOW()
            `, [
              req.user.id,
              igResult.account.id,
              igResult.account.name,
              igResult.account.username,
              igResult.account.profile_picture_url,
              page.access_token,
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
        c.business_name as customer_name
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
    
    // Remove sensitive data
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

    // Get account
    const accountResult = await req.pool.query(
      'SELECT * FROM social_accounts WHERE id = $1 AND is_active = true',
      [account_id]
    );

    if (!accountResult.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];
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

    // Log the post
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

    const accountResult = await req.pool.query(
      'SELECT * FROM social_accounts WHERE id = $1',
      [id]
    );

    if (!accountResult.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];
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

    const accountResult = await req.pool.query(
      'SELECT * FROM social_accounts WHERE id = $1',
      [id]
    );

    if (!accountResult.rows.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];
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
      'SELECT * FROM social_accounts WHERE is_active = true'
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
          // Parse and store analytics snapshot
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
  const { appId, appSecret, redirectUri } = getMetaConfig();
  res.json({
    configured: !!(appId && appSecret),
    hasAppId: !!appId,
    hasAppSecret: !!appSecret,
    redirectUri: redirectUri,
    instructions: !appId ? 
      'To enable Meta integration, add META_APP_ID and META_APP_SECRET to your .env file. Get these from developers.facebook.com' : 
      null
  });
});

module.exports = router;

