/**
 * Meta (Facebook & Instagram) Graph API Service
 * Handles posting content and fetching analytics from Meta platforms
 */

const axios = require('axios');

class MetaService {
  constructor() {
    this.apiVersion = 'v18.0';
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

      // Step 2: Publish the container
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

      // Step 2: Create carousel container
      const carouselResponse = await axios.post(
        `${this.baseUrl}/${igAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: containerIds.join(','),
          caption: caption,
          access_token: accessToken
        }
      );

      // Step 3: Publish
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
      const metrics = [
        'impressions',
        'reach',
        'profile_views',
        'website_clicks',
        'follower_count'
      ].join(',');

      const response = await axios.get(
        `${this.baseUrl}/${igAccountId}/insights`,
        {
          params: {
            metric: metrics,
            period: period,
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

