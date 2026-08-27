/**
 * One way to tell someone something.
 *
 * Notifications were scattered: a dozen `INSERT INTO notifications` statements
 * across the routes, each with its own idea of the shape, and nothing that
 * could reach a phone. This is the single entry point — it writes the row the
 * bell reads and, if the person installed the app and allowed it, pushes to
 * their device.
 *
 * Never throws. A notification that fails must not take down the thing it was
 * announcing: a post still published even if nobody heard about it.
 */

const webpush = require('web-push');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hola@zionx.mx';

const pushReady = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (pushReady) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.log('🔕 Web push disabled (no VAPID keys) — in-app notifications only');
}

/**
 * Tell one person one thing.
 *
 * @param {object} pool
 * @param {number} userId
 * @param {object} n
 * @param {string} n.type      machine key, e.g. 'post_failed'
 * @param {string} n.message   what the person reads
 * @param {string} [n.link]    where tapping it should land
 * @param {number} [n.itemId]  the row it is about
 * @param {string} [n.itemType]
 * @param {string} [n.title]   push title; defaults to ZIONX
 * @param {boolean} [n.push]   set false for low-value notices that only belong in the bell
 */
async function notifyUser(pool, userId, n) {
  if (!userId || !n?.message) return;

  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, link_url, item_id, item_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [userId, n.type || 'info', n.title || 'ZIONX', n.message,
       n.link || null, n.link || null, n.itemId || null, n.itemType || null]
    );
  } catch (err) {
    console.error('notifyUser: could not write notification:', err.message);
  }

  if (!pushReady || n.push === false) return;

  let subs = [];
  try {
    const r = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    subs = r.rows;
  } catch (err) {
    console.error('notifyUser: could not read subscriptions:', err.message);
    return;
  }

  const payload = JSON.stringify({
    title: n.title || 'ZIONX',
    body: n.message,
    url: n.link || '/notifications',
    tag: n.itemType && n.itemId ? `${n.itemType}-${n.itemId}` : undefined,
  });

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
    } catch (err) {
      // 404/410 mean the browser threw the subscription away — uninstalled the
      // app, cleared data, revoked permission. Stop writing to a dead endpoint.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
      } else {
        console.error(`notifyUser: push failed (${err.statusCode || 'no status'}):`, err.body || err.message);
      }
    }
  }));
}

/** Tell several people the same thing, without letting one bad send stop the rest. */
async function notifyUsers(pool, userIds, n) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(unique.map((id) => notifyUser(pool, id, n)));
}

module.exports = { notifyUser, notifyUsers, pushEnabled: () => pushReady, VAPID_PUBLIC_KEY: PUBLIC_KEY };
