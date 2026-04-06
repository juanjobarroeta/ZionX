/**
 * Post Scheduler Service
 * Checks for scheduled posts that are due and publishes them via Meta API.
 * Runs every minute via setInterval (no external dependency needed).
 */

const metaService = require('./metaService');

class PostScheduler {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Start the scheduler — checks every 60 seconds for due posts
   */
  start() {
    if (this.intervalId) return;

    console.log('📅 Post scheduler started — checking every 60s');
    // Run immediately on start, then every 60 seconds
    this.processDuePosts();
    this.intervalId = setInterval(() => this.processDuePosts(), 60000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📅 Post scheduler stopped');
    }
  }

  /**
   * Find and publish all posts that are due
   */
  async processDuePosts() {
    if (this.isRunning) return; // Prevent overlapping runs
    this.isRunning = true;

    try {
      // Find posts due for publishing (scheduled time has passed, within last 1 hour)
      const result = await this.pool.query(`
        SELECT
          sp.*,
          sa.platform,
          sa.platform_account_id,
          sa.access_token,
          sa.token_expires_at,
          sa.instagram_account_id
        FROM scheduled_posts sp
        JOIN social_accounts sa ON sp.social_account_id = sa.id
        WHERE sp.status = 'scheduled'
          AND sp.scheduled_for <= NOW()
          AND sp.scheduled_for > NOW() - INTERVAL '1 hour'
          AND sa.is_active = true
        ORDER BY sp.scheduled_for ASC
        LIMIT 10
      `);

      if (result.rows.length === 0) return;

      console.log(`📤 Processing ${result.rows.length} due post(s)...`);

      for (const post of result.rows) {
        await this.publishPost(post);
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Publish a single scheduled post
   */
  async publishPost(post) {
    const postId = post.id;

    try {
      // Check token expiration
      if (post.token_expires_at && new Date(post.token_expires_at) < new Date()) {
        await this.markFailed(postId, 'Token expired — reconnect the account');
        return;
      }

      // Mark as publishing
      await this.pool.query(
        "UPDATE scheduled_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1",
        [postId]
      );

      let result;

      if (post.platform === 'facebook') {
        result = await metaService.postToFacebookPage(
          post.platform_account_id,
          post.access_token,
          {
            message: post.message,
            photoUrl: post.media_urls?.[0],
            link: post.link_url
          }
        );
      } else if (post.platform === 'instagram') {
        const igAccountId = post.instagram_account_id || post.platform_account_id;

        if (!post.media_urls?.length) {
          await this.markFailed(postId, 'Instagram requires at least one image');
          return;
        }

        if (post.media_urls.length === 1) {
          result = await metaService.postToInstagram(
            igAccountId,
            post.access_token,
            { imageUrl: post.media_urls[0], caption: post.message }
          );
        } else {
          result = await metaService.postCarouselToInstagram(
            igAccountId,
            post.access_token,
            { imageUrls: post.media_urls, caption: post.message }
          );
        }
      } else {
        await this.markFailed(postId, `Unsupported platform: ${post.platform}`);
        return;
      }

      if (result.success) {
        await this.pool.query(`
          UPDATE scheduled_posts SET
            status = 'published',
            published_at = NOW(),
            platform_post_id = $1,
            error_message = NULL,
            updated_at = NOW()
          WHERE id = $2
        `, [result.postId || result.mediaId, postId]);

        console.log(`✅ Published post #${postId} to ${post.platform}: ${result.postId || result.mediaId}`);
      } else {
        await this.handleFailure(postId, post, result.error);
      }
    } catch (error) {
      await this.handleFailure(postId, post, error.message);
    }
  }

  /**
   * Handle a failed post — retry up to 3 times, then mark as failed
   */
  async handleFailure(postId, post, errorMessage) {
    const retryCount = (post.retry_count || 0) + 1;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Put back to scheduled with incremented retry count and 5-minute delay
      await this.pool.query(`
        UPDATE scheduled_posts SET
          status = 'scheduled',
          retry_count = $1,
          error_message = $2,
          scheduled_for = NOW() + INTERVAL '5 minutes',
          updated_at = NOW()
        WHERE id = $3
      `, [retryCount, errorMessage, postId]);

      console.log(`⚠️ Post #${postId} failed (attempt ${retryCount}/${maxRetries}), retrying in 5min: ${errorMessage}`);
    } else {
      await this.markFailed(postId, errorMessage);
    }
  }

  async markFailed(postId, errorMessage) {
    await this.pool.query(`
      UPDATE scheduled_posts SET
        status = 'failed',
        error_message = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [errorMessage, postId]);

    console.error(`❌ Post #${postId} permanently failed: ${errorMessage}`);
  }
}

module.exports = PostScheduler;
