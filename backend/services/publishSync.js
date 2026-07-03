/**
 * Publish sync — the bridge between the content plan (content_calendar) and the
 * publish queue (scheduled_posts).
 *
 * A plan entry is "ready to publish" when it's internally approved, not blocked
 * by the client, has copy, has media (for platforms that require it), has a date,
 * and its client has a connected account for the platform. `promote()` turns a
 * ready entry into a queued post (creating or updating), and links both rows so
 * they stay in sync and the scheduler can flip the plan to "publicado" when it
 * actually goes out.
 */

const APPROVED_INTERNAL = new Set(["aprobado", "approved", "publicado", "published", "listo"]);
const CLIENT_BLOCKED = new Set(["changes_requested", "rejected", "rechazado"]);
const PLATFORM_LABEL = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn" };

const platLabel = (p) => PLATFORM_LABEL[(p || "").toLowerCase()] || (p || "la plataforma");
const hasText = (v) => !!(v && String(v).trim());

// Make an upload path absolute so Meta can fetch it. Relative paths (e.g.
// /uploads/x.png) are prefixed with the public API base.
function absolutize(url, base) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base.replace(/\/$/, "")}${path}`;
}

async function resolveAccount(pool, customerId, platform) {
  const p = (platform || "").toLowerCase();
  const cond =
    p === "instagram"
      ? "(LOWER(platform) = 'instagram' OR instagram_account_id IS NOT NULL)"
      : "LOWER(platform) = $2";
  const params = p === "instagram" ? [customerId] : [customerId, p];
  const { rows } = await pool.query(
    `SELECT * FROM social_accounts
      WHERE customer_id = $1 AND is_active = true AND ${cond}
      ORDER BY id ASC LIMIT 1`,
    params
  );
  return rows[0] || null;
}

// Pure readiness check. `hasAccount` is passed in so callers can supply it from a
// batch query (the range endpoint) or a single resolveAccount() lookup.
function computeReadiness(entry, hasAccount) {
  const missing = [];
  if (!APPROVED_INTERNAL.has((entry.status || "").toLowerCase())) missing.push("aprobación interna");
  if (CLIENT_BLOCKED.has((entry.client_status || "").toLowerCase())) missing.push("aprobación del cliente");
  if (!hasText(entry.copy_out) && !hasText(entry.copy_in)) missing.push("copy");
  if ((entry.platform || "").toLowerCase() === "instagram" && !hasText(entry.arte)) missing.push("arte");
  if (!entry.scheduled_date && !entry.publish_date) missing.push("fecha");
  if (!hasAccount) missing.push(`cuenta de ${platLabel(entry.platform)} conectada`);
  return { ready: missing.length === 0, missing };
}

// Promote a plan entry into the publish queue. Returns { ok, readiness, scheduled_post }.
async function promote(pool, entryId, publicBase) {
  const { rows } = await pool.query("SELECT * FROM content_calendar WHERE id = $1", [entryId]);
  if (!rows.length) return { ok: false, notFound: true };
  const entry = rows[0];

  const account = await resolveAccount(pool, entry.customer_id, entry.platform);
  const readiness = computeReadiness(entry, !!account);
  if (!readiness.ready) return { ok: false, readiness };

  const message = entry.copy_out || entry.copy_in || "";
  const media = [entry.arte, entry.fotos_video].filter(Boolean).map((u) => absolutize(u, publicBase));
  const when = entry.scheduled_date || entry.publish_date;
  const contentType = entry.content_type || entry.formato || "post";

  let post;
  // If already linked and the queued post hasn't gone out yet, update it in place.
  if (entry.scheduled_post_id) {
    const upd = await pool.query(
      `UPDATE scheduled_posts SET
         social_account_id = $1, customer_id = $2, content_calendar_id = $3,
         content_type = $4, message = $5, media_urls = $6, scheduled_for = $7,
         status = CASE WHEN status IN ('published','publishing') THEN status ELSE 'scheduled' END,
         error_message = NULL, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [account.id, entry.customer_id, entryId, contentType, message, media.length ? media : null, when, entry.scheduled_post_id]
    );
    post = upd.rows[0];
  }

  if (!post) {
    const ins = await pool.query(
      `INSERT INTO scheduled_posts
         (social_account_id, customer_id, content_calendar_id, content_type, message, media_urls, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled') RETURNING *`,
      [account.id, entry.customer_id, entryId, contentType, message, media.length ? media : null, when]
    );
    post = ins.rows[0];
    await pool.query("UPDATE content_calendar SET scheduled_post_id = $1, updated_at = NOW() WHERE id = $2", [post.id, entryId]);
  }

  return { ok: true, readiness, scheduled_post: post, account };
}

// Remove a plan entry from the publish queue (cancel the queued post, drop the link).
async function unschedule(pool, entryId) {
  const { rows } = await pool.query("SELECT scheduled_post_id FROM content_calendar WHERE id = $1", [entryId]);
  if (!rows.length) return { ok: false, notFound: true };
  const spId = rows[0].scheduled_post_id;
  if (spId) {
    // Only cancel if it hasn't already published.
    await pool.query(
      "UPDATE scheduled_posts SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status NOT IN ('published','publishing')",
      [spId]
    );
  }
  await pool.query("UPDATE content_calendar SET scheduled_post_id = NULL, updated_at = NOW() WHERE id = $1", [entryId]);
  return { ok: true };
}

module.exports = { promote, unschedule, resolveAccount, computeReadiness, absolutize };
