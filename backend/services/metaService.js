/**
 * Meta (Facebook & Instagram) Graph API Service
 * Handles posting content and fetching analytics from Meta platforms
 */

const axios = require('axios');

// Metrics Meta has rejected this process-lifetime. Meta retires metrics on its
// own schedule and errors the *whole* request when one is unknown, which is how
// a single deprecation used to take down an entire sync. We learn the bad ones
// at runtime and stop asking for them.
const rejectedMetrics = new Set();

class MetaService {
  constructor() {
    // Pinned deliberately, overridable without a deploy. v21.0 expires
    // 2027-01-21; v25.0 (Feb 2026) runs to 2028-07 and is past its teething.
    this.apiVersion = process.env.META_API_VERSION || 'v25.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Request insight metrics, degrading gracefully instead of failing whole.
   *
   * Meta returns an error for the entire request if any single metric name is
   * unknown or newly deprecated. So: ask for everything once; if that fails,
   * ask for each metric on its own, keep what answers, and remember what
   * didn't so later calls skip it. One dead metric costs one metric, not the
   * whole sync.
   */
  async fetchInsights(url, baseParams, metrics) {
    const wanted = metrics.filter((m) => !rejectedMetrics.has(m));
    if (!wanted.length) return { success: true, data: [], dropped: metrics.slice() };

    try {
      const r = await axios.get(url, { params: { ...baseParams, metric: wanted.join(',') } });
      return { success: true, data: r.data.data || [], dropped: [] };
    } catch (err) {
      const first = err.response?.data?.error?.message || err.message;
      // Fall back to one call per metric to isolate the offender(s).
      const data = [];
      const dropped = [];
      for (const metric of wanted) {
        try {
          const r = await axios.get(url, { params: { ...baseParams, metric } });
          data.push(...(r.data.data || []));
        } catch (e) {
          dropped.push(metric);
          rejectedMetrics.add(metric);
          console.warn(`⚠️  Meta rejected metric "${metric}" — skipping it from now on:`,
            e.response?.data?.error?.message || e.message);
        }
      }
      if (!data.length) return { success: false, error: first, data: [], dropped };
      return { success: true, data, dropped };
    }
  }

  /**
   * Get headers with access token
   */
  getHeaders(accessToken) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Wait for Instagram media container to be ready before publishing.
   * Containers can take several seconds to process, especially for carousels.
   */
  async waitForContainerReady(containerId, accessToken, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.get(
        `${this.baseUrl}/${containerId}`,
        { params: { fields: 'status_code,status', access_token: accessToken } }
      );

      const statusCode = response.data.status_code;
      if (statusCode === 'FINISHED') return { ready: true };
      if (statusCode === 'ERROR') {
        return { ready: false, error: response.data.status || 'Container processing failed' };
      }
      // IN_PROGRESS — wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return { ready: false, error: 'Container processing timed out' };
  }

  // =====================================================
  // FACEBOOK PAGE METHODS
  // =====================================================

  /**
   * Get Facebook Pages the user manages
   * @param {string} userAccessToken - User's access token
   */
  async getFacebookPages(userAccessToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/me/accounts`,
        {
          params: {
            fields: 'id,name,category,picture,access_token,instagram_business_account',
            access_token: userAccessToken
          }
        }
      );
      
      return {
        success: true,
        pages: response.data.data || []
      };
    } catch (error) {
      console.error('Error fetching Facebook pages:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Post to a Facebook Page
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @param {Object} post - Post content { message, link?, photoUrl? }
   */
  async postToFacebookPage(pageId, pageAccessToken, { message, link, photoUrl }) {
    try {
      let endpoint = `${this.baseUrl}/${pageId}/feed`;
      let data = { message, access_token: pageAccessToken };

      // If posting a photo
      if (photoUrl) {
        endpoint = `${this.baseUrl}/${pageId}/photos`;
        data = {
          url: photoUrl,
          caption: message,
          access_token: pageAccessToken
        };
      }

      // If posting a link
      if (link && !photoUrl) {
        data.link = link;
      }

      const response = await axios.post(endpoint, data);
      
      console.log(`✅ Posted to Facebook Page ${pageId}:`, response.data.id);
      return {
        success: true,
        postId: response.data.id
      };
    } catch (error) {
      console.error('Error posting to Facebook:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Facebook Page insights, one snapshot per day.
   *
   * Metric names follow Meta's post-deprecation set: `page_impressions`,
   * `page_impressions_unique`, `page_engaged_users` and `page_fans` were all
   * retired between March 2024 and November 2025. Views now come from
   * `page_media_view` and followers from `page_follows`.
   *
   * @returns {Object} normalized metrics — never throws, never partial-fails
   */
  async getFacebookPageInsights(pageId, pageAccessToken, period = 'day') {
    const METRICS = [
      'page_media_view',              // replaced page_impressions (Nov 2025)
      'page_total_media_view_unique', // replaced page_impressions_unique (Jun 2025)
      'page_post_engagements',
      'page_follows',                 // replaced page_fans (Nov 2025)
      'page_daily_follows_unique',
      'page_daily_unfollows_unique',
      'page_views_total',
      'page_total_actions',
      'page_video_views',
    ];

    const res = await this.fetchInsights(
      `${this.baseUrl}/${pageId}/insights`,
      { period, access_token: pageAccessToken },
      METRICS
    );
    if (!res.success) return { success: false, error: res.error };

    const val = (name) => {
      const m = res.data.find((d) => d.name === name);
      if (!m) return 0;
      // Page insights are a time series; the latest bucket is the snapshot.
      const values = m.values || [];
      return Number(values[values.length - 1]?.value) || 0;
    };

    return {
      success: true,
      dropped: res.dropped,
      metrics: {
        views: val('page_media_view'),
        reach: val('page_total_media_view_unique'),
        engagements: val('page_post_engagements'),
        followers: val('page_follows'),
        followers_gained: val('page_daily_follows_unique'),
        followers_lost: val('page_daily_unfollows_unique'),
        profile_views: val('page_views_total'),
        actions: val('page_total_actions'),
        video_views: val('page_video_views'),
      },
      raw: res.data,
    };
  }

  /**
   * Get recent posts from a Facebook Page
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @param {number} limit - Number of posts to fetch
   */
  async getFacebookPagePosts(pageId, pageAccessToken, limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${pageId}/posts`,
        {
          params: {
            fields: 'id,message,created_time,full_picture,permalink_url,shares,reactions.summary(true),comments.summary(true)',
            limit: limit,
            access_token: pageAccessToken
          }
        }
      );
      
      return {
        success: true,
        posts: response.data.data || []
      };
    } catch (error) {
      console.error('Error fetching page posts:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  // =====================================================
  // INSTAGRAM METHODS
  // =====================================================

  /**
   * Get Instagram account info using the Instagram Graph API (for tokens from
   * "Instagram API with Facebook Login" / "API Graph de Instagram" variation).
   * These tokens cannot access Facebook Pages — they can only access Instagram.
   *
   * @param {string} accessToken - Instagram access token from OAuth
   */
  async getInstagramAccountFromToken(accessToken) {
    try {
      const response = await axios.get(
        'https://graph.instagram.com/v21.0/me',
        {
          params: {
            fields: 'user_id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count,biography',
            access_token: accessToken
          }
        }
      );

      return {
        success: true,
        account: response.data
      };
    } catch (error) {
      console.error('Error fetching Instagram account from token:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Get Instagram Business Account info
   * @param {string} igAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access token
   */
  async getInstagramAccount(igAccountId, accessToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${igAccountId}`,
        {
          params: {
            fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website',
            access_token: accessToken
          }
        }
      );
      
      return {
        success: true,
        account: response.data
      };
    } catch (error) {
      console.error('Error fetching Instagram account:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Post a photo to Instagram (requires container creation)
   * @param {string} igAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access token
   * @param {Object} post - { imageUrl, caption }
   */
  async postToInstagram(igAccountId, accessToken, { imageUrl, caption }) {
    try {
      // Step 1: Create media container
      const containerResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media`,
        {
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken
        }
      );

      const containerId = containerResponse.data.id;
      console.log(`📦 Created Instagram container: ${containerId}`);

      // Step 2: Wait for container to finish processing
      const status = await this.waitForContainerReady(containerId, accessToken);
      if (!status.ready) {
        return { success: false, error: status.error };
      }

      // Step 3: Publish the container
      const publishResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken
        }
      );

      console.log(`✅ Published to Instagram: ${publishResponse.data.id}`);
      return {
        success: true,
        mediaId: publishResponse.data.id
      };
    } catch (error) {
      console.error('Error posting to Instagram:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Post a carousel to Instagram
   * @param {string} igAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access token
   * @param {Object} post - { imageUrls: [], caption }
   */
  async postCarouselToInstagram(igAccountId, accessToken, { imageUrls, caption }) {
    try {
      // Step 1: Create containers for each image
      const containerIds = [];
      for (const imageUrl of imageUrls) {
        const response = await axios.post(
          `${this.baseUrl}/${igAccountId}/media`,
          {
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: accessToken
          }
        );
        containerIds.push(response.data.id);
      }

      // Step 2: Wait for all item containers to be ready
      for (const containerId of containerIds) {
        const status = await this.waitForContainerReady(containerId, accessToken);
        if (!status.ready) {
          return { success: false, error: `Carousel item failed: ${status.error}` };
        }
      }

      // Step 3: Create carousel container
      const carouselResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: containerIds.join(','),
          caption: caption,
          access_token: accessToken
        }
      );

      // Step 4: Wait for carousel container to be ready
      const carouselStatus = await this.waitForContainerReady(carouselResponse.data.id, accessToken);
      if (!carouselStatus.ready) {
        return { success: false, error: `Carousel failed: ${carouselStatus.error}` };
      }

      // Step 5: Publish
      const publishResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media_publish`,
        {
          creation_id: carouselResponse.data.id,
          access_token: accessToken
        }
      );

      return {
        success: true,
        mediaId: publishResponse.data.id
      };
    } catch (error) {
      console.error('Error posting carousel to Instagram:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Get recent Instagram media
   * @param {string} igAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access token
   * @param {number} limit - Number of posts
   */
  async getInstagramMedia(igAccountId, accessToken, limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${igAccountId}/media`,
        {
          params: {
            fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
            limit: limit,
            access_token: accessToken
          }
        }
      );
      
      return {
        success: true,
        media: response.data.data || []
      };
    } catch (error) {
      console.error('Error fetching Instagram media:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Instagram account insights, one snapshot per day.
   *
   * Two calls, because Meta splits them: most account metrics only answer to
   * `metric_type=total_value`, while `follower_count` is a time series. Asking
   * for both in one request is an error — as is asking for `impressions`,
   * deprecated across all API versions on 2025-04-21 and replaced by `views`.
   *
   * @returns {Object} normalized metrics — never throws
   */
  async getInstagramInsights(igAccountId, accessToken, period = 'day') {
    const TOTAL_VALUE = [
      'views',              // replaced impressions (Apr 2025)
      'reach',
      'accounts_engaged',
      'total_interactions',
      'likes',
      'comments',
      'shares',
      'saves',
      'replies',
      'profile_links_taps',
    ];
    const TIME_SERIES = ['follower_count'];

    const url = `${this.baseUrl}/${igAccountId}/insights`;
    const totals = await this.fetchInsights(
      url,
      { period, metric_type: 'total_value', access_token: accessToken },
      TOTAL_VALUE
    );
    const series = await this.fetchInsights(
      url,
      { period: 'day', access_token: accessToken },
      TIME_SERIES
    );

    if (!totals.success && !series.success) {
      return { success: false, error: totals.error || series.error };
    }

    const total = (name) => {
      const m = (totals.data || []).find((d) => d.name === name);
      return Number(m?.total_value?.value) || 0;
    };
    const latest = (name) => {
      const m = (series.data || []).find((d) => d.name === name);
      const values = m?.values || [];
      return Number(values[values.length - 1]?.value) || 0;
    };

    return {
      success: true,
      dropped: [...(totals.dropped || []), ...(series.dropped || [])],
      metrics: {
        views: total('views'),
        reach: total('reach'),
        accounts_engaged: total('accounts_engaged'),
        total_interactions: total('total_interactions'),
        likes: total('likes'),
        comments: total('comments'),
        shares: total('shares'),
        saves: total('saves'),
        replies: total('replies'),
        link_clicks: total('profile_links_taps'),
        followers_gained: latest('follower_count'),
      },
      raw: [...(totals.data || []), ...(series.data || [])],
    };
  }

  /**
   * Per-media insights. Which metrics exist depends on the media type, so ask
   * only for what that type supports — a story has replies and navigation, a
   * reel has watch time, a feed post has neither.
   *
   * @param {string} mediaType - IMAGE | VIDEO | CAROUSEL_ALBUM | REELS | STORY
   */
  async getInstagramMediaInsights(mediaId, accessToken, mediaType = 'IMAGE') {
    const type = String(mediaType || '').toUpperCase();
    let metrics;
    if (type === 'STORY') {
      metrics = ['views', 'reach', 'replies', 'navigation', 'profile_visits', 'follows', 'link_clicks'];
    } else if (type === 'REELS' || type === 'VIDEO') {
      metrics = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions',
                 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'];
    } else {
      metrics = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions',
                 'profile_visits', 'follows'];
    }

    const res = await this.fetchInsights(
      `${this.baseUrl}/${mediaId}/insights`,
      { access_token: accessToken },
      metrics
    );
    if (!res.success) return { success: false, error: res.error };

    const val = (name) => {
      const m = res.data.find((d) => d.name === name);
      if (!m) return 0;
      if (m.total_value) return Number(m.total_value.value) || 0;
      return Number((m.values || [])[0]?.value) || 0;
    };

    return {
      success: true,
      dropped: res.dropped,
      metrics: {
        views: val('views'),
        reach: val('reach'),
        likes: val('likes'),
        comments: val('comments'),
        shares: val('shares'),
        saves: val('saved'),
        total_interactions: val('total_interactions'),
        replies: val('replies'),
        navigation: val('navigation'),
        profile_visits: val('profile_visits'),
        follows: val('follows'),
        link_clicks: val('link_clicks'),
        avg_watch_time: val('ig_reels_avg_watch_time'),
        total_watch_time: val('ig_reels_video_view_total_time'),
      },
      raw: res.data,
    };
  }

  /**
   * Per-post metrics for a Facebook Page post. Reaction/comment/share counts
   * come from the post's own fields (stable); anything else is an insight and
   * goes through the resilient fetcher.
   */
  async getFacebookPostInsights(postId, pageAccessToken) {
    const out = {
      views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0,
      total_interactions: 0, link_clicks: 0, video_views: 0,
    };

    try {
      const r = await axios.get(`${this.baseUrl}/${postId}`, {
        params: {
          fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares',
          access_token: pageAccessToken,
        },
      });
      out.likes = Number(r.data?.reactions?.summary?.total_count) || 0;
      out.comments = Number(r.data?.comments?.summary?.total_count) || 0;
      out.shares = Number(r.data?.shares?.count) || 0;
      out.total_interactions = out.likes + out.comments + out.shares;
    } catch (error) {
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }

    const res = await this.fetchInsights(
      `${this.baseUrl}/${postId}/insights`,
      { access_token: pageAccessToken },
      ['post_media_view', 'post_clicks', 'post_video_views']
    );
    if (res.success) {
      const val = (name) => {
        const m = res.data.find((d) => d.name === name);
        return Number((m?.values || [])[0]?.value) || 0;
      };
      out.views = val('post_media_view');
      out.link_clicks = val('post_clicks');
      out.video_views = val('post_video_views');
    }

    return { success: true, metrics: out, dropped: res.dropped || [] };
  }

  /**
   * List the ad accounts a user can access (Marketing API).
   * Requires the ads_read permission on the user token.
   * @param {string} userAccessToken - Long-lived user token
   */
  async getAdAccounts(userAccessToken) {
    try {
      const response = await axios.get(`${this.baseUrl}/me/adaccounts`, {
        params: {
          fields: 'account_id,name,currency,account_status',
          limit: 200,
          access_token: userAccessToken
        }
      });
      return { success: true, accounts: response.data.data || [] };
    } catch (error) {
      console.error('Error fetching ad accounts:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        accounts: []
      };
    }
  }

  /**
   * Pull account-level ad insights (spend, impressions, clicks) for a date range.
   * @param {string} adAccountId - The ad account id (with or without the act_ prefix)
   * @param {string} accessToken - User token with ads_read
   * @param {string} since - YYYY-MM-DD (inclusive)
   * @param {string} until - YYYY-MM-DD (inclusive)
   */
  async getAdAccountInsights(adAccountId, accessToken, since, until) {
    const act = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    try {
      const response = await axios.get(`${this.baseUrl}/${act}/insights`, {
        params: {
          fields: 'spend,impressions,clicks,cpc,ctr',
          level: 'account',
          time_range: JSON.stringify({ since, until }),
          access_token: accessToken
        }
      });
      const row = (response.data.data || [])[0] || {};
      return {
        success: true,
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        cpc: Number(row.cpc) || 0,
        ctr: Number(row.ctr) || 0
      };
    } catch (error) {
      console.error(`Error fetching insights for ${act}:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Daily ad-account insights for a date range — one row per day, so spend can
   * be charted and re-synced without losing history.
   *
   * `actions` is where the outcomes live: link clicks, leads, purchases and
   * `onsite_conversion.messaging_conversation_started_7d` — the DMs an ad
   * actually started, which is the number most clients ask about.
   */
  async getAdAccountInsightsDaily(adAccountId, accessToken, since, until) {
    const act = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const rows = [];
    let url = `${this.baseUrl}/${act}/insights`;
    let params = {
      fields: 'date_start,date_stop,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions',
      level: 'account',
      time_increment: 1,
      time_range: JSON.stringify({ since, until }),
      limit: 500,
      access_token: accessToken,
    };

    try {
      // Follow paging — a long range with time_increment=1 spills over one page.
      for (let page = 0; page < 20; page++) {
        const response = await axios.get(url, { params });
        rows.push(...(response.data.data || []));
        const next = response.data.paging?.next;
        if (!next) break;
        url = next;
        params = undefined; // the `next` URL already carries every parameter
      }
    } catch (error) {
      console.error(`Error fetching daily insights for ${act}:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error?.message || error.message, days: [] };
    }

    const actionValue = (actions, type) =>
      Number((actions || []).find((a) => a.action_type === type)?.value) || 0;

    return {
      success: true,
      days: rows.map((r) => ({
        date: r.date_start,
        spend: Number(r.spend) || 0,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        reach: Number(r.reach) || 0,
        frequency: Number(r.frequency) || 0,
        cpc: Number(r.cpc) || 0,
        cpm: Number(r.cpm) || 0,
        ctr: Number(r.ctr) || 0,
        link_clicks: actionValue(r.actions, 'link_click'),
        leads: actionValue(r.actions, 'lead'),
        purchases: actionValue(r.actions, 'purchase'),
        post_engagements: actionValue(r.actions, 'post_engagement'),
        conversations_started: actionValue(r.actions, 'onsite_conversion.messaging_conversation_started_7d'),
      })),
    };
  }

  /**
   * Refresh a long-lived token before it expires.
   * Long-lived tokens can be refreshed as long as they haven't expired yet.
   * Returns a new long-lived token valid for another 60 days.
   */
  async refreshLongLivedToken(longLivedToken, appId, appSecret) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: longLivedToken
          }
        }
      );

      return {
        success: true,
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  // =====================================================
  // OAUTH / TOKEN METHODS
  // =====================================================

  /**
   * Exchange short-lived token for long-lived token
   * @param {string} shortLivedToken - Short-lived access token
   * @param {string} appId - Facebook App ID
   * @param {string} appSecret - Facebook App Secret
   */
  async getLongLivedToken(shortLivedToken, appId, appSecret) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken
          }
        }
      );
      
      return {
        success: true,
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging token:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Debug/validate an access token
   * @param {string} accessToken - Token to validate
   * @param {string} appToken - App access token (appId|appSecret)
   */
  async debugToken(accessToken, appToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/debug_token`,
        {
          params: {
            input_token: accessToken,
            access_token: appToken
          }
        }
      );
      
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error debugging token:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Get the OAuth login URL for connecting accounts.
   * Uses Facebook Login for Business flow with config_id (required for new Business apps).
   * The config_id is created in Meta Dev Portal → Facebook Login for Business → Configuraciones.
   * Permissions are defined inside the configuration, not passed as scopes.
   *
   * @param {string} appId - Facebook App ID
   * @param {string} redirectUri - Redirect URI after auth
   * @param {string} state - Optional state parameter for CSRF protection
   * @param {string} configId - Facebook Login for Business configuration ID
   */
  getOAuthUrl(appId, redirectUri, state = '', configId = null) {
    // Facebook Login for Business uses config_id + override_default_response_type
    // instead of the classic scope parameter
    if (configId) {
      return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?` +
             `client_id=${appId}` +
             `&redirect_uri=${encodeURIComponent(redirectUri)}` +
             `&config_id=${configId}` +
             `&override_default_response_type=true` +
             `&response_type=code` +
             `&state=${state}`;
    }

    // Fallback: classic Facebook Login with scope parameter (legacy apps)
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_read_user_content',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'business_management',
      // Marketing API: read ad accounts + spend/performance insights.
      'ads_read'
    ].join(',');

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?` +
           `client_id=${appId}` +
           `&redirect_uri=${encodeURIComponent(redirectUri)}` +
           `&scope=${scopes}` +
           `&state=${state}` +
           // Force Facebook to re-prompt for newly-added permissions (e.g.
           // ads_read) even when the user already connected the app before.
           `&auth_type=rerequest` +
           `&response_type=code`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth
   * @param {string} appId - Facebook App ID
   * @param {string} appSecret - Facebook App Secret
   * @param {string} redirectUri - Redirect URI used in OAuth
   */
  async exchangeCodeForToken(code, appId, appSecret, redirectUri) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/access_token`,
        {
          params: {
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code: code
          }
        }
      );
      
      return {
        success: true,
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}

module.exports = new MetaService();

