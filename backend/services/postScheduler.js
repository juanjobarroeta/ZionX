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
const { refreshExpiringTokens, refreshExpiringAdTokens } = require('./tokenRefresh');

// How often to refresh Meta tokens expiring within the next week.
const TOKEN_REFRESH_MS = 24 * 60 * 60 * 1000; // daily

// How long after its scheduled time a post may still auto-publish. Beyond this
// it's marked failed ("missed window") rather than posting stale content.
const MAX_CATCHUP_MIN = parseInt(process.env.SCHEDULER_MAX_DELAY_MINUTES, 10) || 360; // 6h
// A post left in `publishing` longer than this is assumed crashed and recovered.
const STUCK_MIN = parseInt(process.env.SCHEDULER_STUCK_MINUTES, 10) || 15;
const BATCH_SIZE = 10;

/**
 * How long to wait before each retry. A publish fails for two very different
 * reasons and they deserve different patience:
 *
 *   · transient — Meta is rate-limiting us, timing out, or briefly down. Worth
 *     retrying, but not every five minutes: back off across half a day so a
 *     30-minute outage doesn't burn every attempt in the first quarter hour.
 *   · permanent — the token is dead, the account lost its permission, the media
 *     is unusable. No number of retries fixes those; retrying only delays the
 *     moment a human finds out.
 */
const RETRY_DELAYS_MIN = [5, 20, 60, 180, 360];
const MAX_RETRIES = RETRY_DELAYS_MIN.length;
// Meta's rate limits reset hourly, so there is no point trying again in five
// minutes when that is what we were told.
const RATE_LIMIT_FIRST_DELAY_MIN = 60;

/**
 * Is this failure worth retrying?
 *
 * Meta's error codes are the reliable signal; the message text is the fallback
 * for our own pre-flight refusals (missing media, unsupported format), which
 * never come from Meta at all.
 */
const PERMANENT_CODES = new Set([
  190, // access token invalid or expired
  200, // permission denied
  10,  // permission denied (app-level)
  3,   // capability disabled for this app
  368, // temporarily blocked for policy violations — needs a human either way
  100, // invalid parameter: bad media URL, bad aspect ratio, unusable file
]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80001, 80002, 80004]);

function classifyFailure(error, message) {
  const code = error?.response?.data?.error?.code ?? error?.code ?? null;
  const text = String(message || error?.message || '').toLowerCase();

  if (RATE_LIMIT_CODES.has(code) || /rate limit|too many calls|request limit/.test(text)) {
    return { permanent: false, rateLimited: true };
  }
  if (PERMANENT_CODES.has(code)) return { permanent: true };
  // Our own refusals before Meta is ever called.
  if (/necesita al menos|no está soportado|unsupported platform|token expired|reconnect|expiró/.test(text)) {
    return { permanent: true };
  }
  if (/permission|not authorized|administrator, editor, or moderator|does not exist|invalid/.test(text)) {
    return { permanent: true };
  }
  return { permanent: false, rateLimited: false };
}

class PostScheduler {
  constructor(pool) {
    this.pool = pool;
    this.isRunning = false;
    this.intervalId = null;
    this.tokenIntervalId = null;
  }

  /**
   * Start the scheduler — checks every 60 seconds for due posts, and refreshes
   * expiring Meta tokens once a day (and once on start).
   */
  start() {
    if (this.intervalId) return;

    console.log(`📅 Post scheduler started — checking every 60s (catch-up window ${MAX_CATCHUP_MIN}min)`);
    // Run immediately on start, then every 60 seconds
    this.processDuePosts();
    this.intervalId = setInterval(() => this.processDuePosts(), 60000);

    // Keep Meta connections alive: refresh tokens expiring within a week.
    this.refreshTokensSafe();
    this.tokenIntervalId = setInterval(() => this.refreshTokensSafe(), TOKEN_REFRESH_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.tokenIntervalId) {
      clearInterval(this.tokenIntervalId);
      this.tokenIntervalId = null;
    }
    console.log('📅 Post scheduler stopped');
  }

  /**
   * Route one due post to the right Meta publish call by platform and format.
   * A post's format decides the mechanics: a story has no caption and dies in
   * 24h, a reel is a video with a long transcode, a carousel is many images.
   * Returns { success, ... } from metaService, or { skipped, error } when the
   * post can't be routed at all.
   */
  async publishToPlatform(post) {
    const isVideoUrl = (u) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '');
    const type = (post.content_type || '').toLowerCase();

    if (post.platform === 'facebook') {
      const media = post.media_urls || [];
      if (type === 'story') {
        if (!media.length) return { skipped: true, error: 'Una historia necesita imagen o video' };
        return metaService.postStoryToFacebookPage(post.platform_account_id, post.access_token, {
          mediaUrl: media[0],
          isVideo: isVideoUrl(media[0]),
        });
      }
      if (type === 'reel' || type === 'video' || isVideoUrl(media[0])) {
        if (!media.length) return { skipped: true, error: 'Un reel necesita un video' };
        return metaService.postReelToFacebookPage(post.platform_account_id, post.access_token, {
          videoUrl: media[0],
          description: post.message,
        });
      }
      return metaService.postToFacebookPage(post.platform_account_id, post.access_token, {
        message: post.message,
        photoUrl: media[0],
        link: post.link_url,
      });
    }

    if (post.platform === 'instagram') {
      const igAccountId = post.instagram_account_id || post.platform_account_id;
      const media = post.media_urls || [];
      if (!media.length) {
        return { skipped: true, error: 'Instagram necesita al menos una imagen o video' };
      }

      if (type === 'story') {
        return metaService.postStoryToInstagram(igAccountId, post.access_token, {
          mediaUrl: media[0],
          isVideo: isVideoUrl(media[0]),
        });
      }
      if (type === 'reel' || type === 'video' || isVideoUrl(media[0])) {
        return metaService.postReelToInstagram(igAccountId, post.access_token, {
          videoUrl: media[0],
          caption: post.message,
        });
      }
      if (media.length > 1) {
        return metaService.postCarouselToInstagram(igAccountId, post.access_token, {
          imageUrls: media,
          caption: post.message,
        });
      }
      return metaService.postToInstagram(igAccountId, post.access_token, {
        imageUrl: media[0],
        caption: post.message,
      });
    }

    return { skipped: true, error: `Unsupported platform: ${post.platform}` };
  }

  /** Daily Meta token refresh; never throws (a failure must not kill the loop). */
  async refreshTokensSafe() {
    try {
      const r = await refreshExpiringTokens(this.pool);
      if (!r.skipped && r.total > 0) {
        console.log(`🔄 Token refresh: ${r.refreshed} refreshed, ${r.failed} failed of ${r.total} expiring`);
      }
      // Ad-account tokens live in their own table and expire on the same clock.
      const a = await refreshExpiringAdTokens(this.pool);
      if (!a.skipped && a.total > 0) {
        console.log(`🔄 Ad token refresh: ${a.refreshed} refreshed, ${a.failed} failed of ${a.total} expiring`);
      }
    } catch (e) {
      console.error('Token refresh pass failed:', e.message);
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
        await this.markFailed(postId, `Missed publish window — was due ~${overdueH}h ago`, post);
        return;
      }

      // Check token expiration
      if (post.token_expires_at && new Date(post.token_expires_at) < new Date()) {
        await this.markFailed(postId, 'Token expired — reconnect the account', post);
        return;
      }

      const result = await this.publishToPlatform(post);
      if (result.skipped) {
        await this.markFailed(postId, result.error, post);
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

        // Backfill the plan entry so the calendar reflects what actually shipped.
        if (post.content_calendar_id) {
          await this.pool.query(
            "UPDATE content_calendar SET status = 'publicado', updated_at = NOW() WHERE id = $1",
            [post.content_calendar_id]
          ).catch((e) => console.warn(`⚠️ Could not backfill content_calendar #${post.content_calendar_id}:`, e.message));
        }

        console.log(`✅ Published post #${postId} to ${post.platform}: ${result.postId || result.mediaId}`);
      } else {
        await this.handleFailure(postId, post, result.error, result.errorObject || null);
      }
    } catch (error) {
      await this.handleFailure(postId, post, error.message, error);
    }
  }

  /**
   * Decide what happens to a post that didn't publish: back off and try again,
   * or stop and tell someone.
   */
  async handleFailure(postId, post, errorMessage, error = null) {
    const verdict = classifyFailure(error, errorMessage);

    if (verdict.permanent) {
      await this.markFailed(postId, errorMessage, post);
      return;
    }

    const attempt = (post.retry_count || 0) + 1;
    if (attempt > MAX_RETRIES) {
      await this.markFailed(postId, `${errorMessage} (tras ${MAX_RETRIES} reintentos)`, post);
      return;
    }

    const delay = verdict.rateLimited
      ? Math.max(RATE_LIMIT_FIRST_DELAY_MIN, RETRY_DELAYS_MIN[attempt - 1])
      : RETRY_DELAYS_MIN[attempt - 1];

    await this.pool.query(`
      UPDATE scheduled_posts SET
        status = 'scheduled',
        retry_count = $1,
        error_message = $2,
        scheduled_for = NOW() + make_interval(mins => $3),
        updated_at = NOW()
      WHERE id = $4
    `, [attempt, errorMessage, delay, postId]);

    console.log(`⚠️ Post #${postId} failed (intento ${attempt}/${MAX_RETRIES}), reintenta en ${delay}min: ${errorMessage}`);
  }

  /**
   * Stop trying, and make sure a person hears about it. A failed post that
   * nobody is told about is a post that silently didn't happen.
   */
  async markFailed(postId, errorMessage, post = null) {
    await this.pool.query(`
      UPDATE scheduled_posts SET
        status = 'failed',
        error_message = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [errorMessage, postId]);

    console.error(`❌ Post #${postId} permanently failed: ${errorMessage}`);

    const userId = post?.created_by;
    if (!userId) return;
    await this.pool.query(
      `INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
       VALUES ($1, 'post_failed', $2, '/social-hub', $3, 'scheduled_post')`,
      [userId, `❌ No se pudo publicar: ${String(errorMessage).slice(0, 160)}`, postId]
    ).catch((e) => console.error('Could not notify about failed post:', e.message));
  }
}

module.exports = PostScheduler;
