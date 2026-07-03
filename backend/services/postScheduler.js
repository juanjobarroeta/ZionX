/**
 * Post Scheduler Service
 * Checks for scheduled posts that are due and publishes them via Meta API.
 * Runs every minute via setInterval (no external dependency needed).
 *
 * Reliability guarantees:
 *  - Due posts are never silently dropped. Anything past due is either
 *    published (within the catch-up window) or marked `failed` with a
 *    "missed window" message so it's visible — never skipped into the void.
 *  - A post is claimed atomically (status flips scheduled -> publishing via a
 *    single locking UPDATE with SKIP LOCKED), so two workers or an overlapping
 *    run can't publish the same post twice.
 *  - Posts stranded in `publishing` by a crash are recovered on each cycle.
 */

const metaService = require('./metaService');

// How long after its scheduled time a post may still auto-publish. Beyond this
// it's marked failed ("missed window") rather than posting stale content.
const MAX_CATCHUP_MIN = parseInt(process.env.SCHEDULER_MAX_DELAY_MINUTES, 10) || 360; // 6h
// A post left in `publishing` longer than this is assumed crashed and recovered.
const STUCK_MIN = parseInt(process.env.SCHEDULER_STUCK_MINUTES, 10) || 15;
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

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

    console.log(`📅 Post scheduler started — checking every 60s (catch-up window ${MAX_CATCHUP_MIN}min)`);
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
   * Recover posts stranded in `publishing` by a crash/restart and put them
   * back in the queue so they get retried (respecting the retry cap).
   */
  async recoverStuck() {
    try {
      const stuck = await this.pool.query(
        `UPDATE scheduled_posts
           SET status = CASE WHEN retry_count >= $2 THEN 'failed' ELSE 'scheduled' END,
               error_message = 'Recovered from an interrupted publish',
               updated_at = NOW()
         WHERE status = 'publishing'
           AND updated_at < NOW() - make_interval(mins => $1)
         RETURNING id, status`,
        [STUCK_MIN, MAX_RETRIES]
      );
      if (stuck.rows.length > 0) {
        console.log(`🩹 Recovered ${stuck.rows.length} post(s) stuck in publishing`);
      }
    } catch (error) {
      console.error('❌ Stuck-post recovery error:', error.message);
    }
  }

  /**
   * Find and publish all posts that are due.
   */
  async processDuePosts() {
    if (this.isRunning) return; // Avoid overlapping timer runs
    this.isRunning = true;

    try {
      await this.recoverStuck();

      // Atomically claim due posts: flip scheduled -> publishing under a row
      // lock so no other run/instance can grab the same rows. SKIP LOCKED lets
      // concurrent workers take different rows instead of blocking.
      const claimed = await this.pool.query(
        `WITH due AS (
           SELECT sp.id
             FROM scheduled_posts sp
             JOIN social_accounts sa ON sp.social_account_id = sa.id
            WHERE sp.status = 'scheduled'
              AND sp.scheduled_for <= NOW()
              AND sa.is_active = true
            ORDER BY sp.scheduled_for ASC
            FOR UPDATE OF sp SKIP LOCKED
            LIMIT $1
         )
         UPDATE scheduled_posts sp
            SET status = 'publishing', updated_at = NOW()
           FROM due
          WHERE sp.id = due.id
        RETURNING sp.id`,
        [BATCH_SIZE]
      );

      if (claimed.rows.length === 0) return;

      const ids = claimed.rows.map((r) => r.id);

      // Hydrate the claimed rows with the account fields needed to publish.
      const posts = await this.pool.query(
        `SELECT sp.*,
                sa.platform,
                sa.platform_account_id,
                sa.access_token,
                sa.token_expires_at,
                sa.instagram_account_id
           FROM scheduled_posts sp
           JOIN social_accounts sa ON sp.social_account_id = sa.id
          WHERE sp.id = ANY($1::int[])
          ORDER BY sp.scheduled_for ASC`,
        [ids]
      );

      console.log(`📤 Processing ${posts.rows.length} due post(s)...`);

      for (const post of posts.rows) {
        await this.publishPost(post);
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Publish a single claimed post (already in `publishing` status).
   */
  async publishPost(post) {
    const postId = post.id;

    try {
      // Too far past its slot — don't silently drop it and don't post stale
      // content; mark it failed so it surfaces for a human.
      const overdueMin = (Date.now() - new Date(post.scheduled_for).getTime()) / 60000;
      if (overdueMin > MAX_CATCHUP_MIN) {
        const overdueH = Math.max(1, Math.round(overdueMin / 60));
        await this.markFailed(postId, `Missed publish window — was due ~${overdueH}h ago`);
        return;
      }

      // Check token expiration
      if (post.token_expires_at && new Date(post.token_expires_at) < new Date()) {
        await this.markFailed(postId, 'Token expired — reconnect the account');
        return;
      }

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
   * Handle a failed post — retry up to MAX_RETRIES, then mark as failed
   */
  async handleFailure(postId, post, errorMessage) {
    const retryCount = (post.retry_count || 0) + 1;

    if (retryCount < MAX_RETRIES) {
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

      console.log(`⚠️ Post #${postId} failed (attempt ${retryCount}/${MAX_RETRIES}), retrying in 5min: ${errorMessage}`);
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
