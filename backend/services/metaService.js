/**
 * Meta (Facebook & Instagram) Graph API Service
 * Handles posting content and fetching analytics from Meta platforms
 */

const axios = require('axios');

class MetaService {
  constructor() {
    this.apiVersion = 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
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
   * Get Facebook Page Insights
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page access token
   * @param {string} period - 'day', 'week', 'days_28'
   */
  async getFacebookPageInsights(pageId, pageAccessToken, period = 'days_28') {
    try {
      const metrics = [
        'page_impressions',
        'page_impressions_unique',
        'page_engaged_users',
        'page_post_engagements',
        'page_fans',
        'page_fans_online',
        'page_views_total'
      ].join(',');

      const response = await axios.get(
        `${this.baseUrl}/${pageId}/insights`,
        {
          params: {
            metric: metrics,
            period: period,
            access_token: pageAccessToken
          }
        }
      );
      
      return {
        success: true,
        insights: response.data.data || []
      };
    } catch (error) {
      console.error('Error fetching page insights:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
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
   * Get Instagram Insights for the account
   * @param {string} igAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access token
   */
  async getInstagramInsights(igAccountId, accessToken, period = 'day') {
    try {
      // v21.0 uses metric_type parameter; 'impressions' and 'reach' require period='day'
      // 'follower_count' requires period='day' and metric_type='time_series'
      const metrics = [
        'impressions',
        'reach',
        'profile_views',
        'accounts_engaged',
        'follower_count'
      ].join(',');

      const response = await axios.get(
        `${this.baseUrl}/${igAccountId}/insights`,
        {
          params: {
            metric: metrics,
            period: period,
            metric_type: 'time_series',
            access_token: accessToken
          }
        }
      );

      return {
        success: true,
        insights: response.data.data || []
      };
    } catch (error) {
      console.error('Error fetching Instagram insights:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
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
   * Get the OAuth login URL for connecting accounts
   * @param {string} appId - Facebook App ID
   * @param {string} redirectUri - Redirect URI after auth
   * @param {string} state - Optional state parameter
   */
  getOAuthUrl(appId, redirectUri, state = '') {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_read_user_content',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'business_management'
    ].join(',');

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?` +
           `client_id=${appId}` +
           `&redirect_uri=${encodeURIComponent(redirectUri)}` +
           `&scope=${scopes}` +
           `&state=${state}` +
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

