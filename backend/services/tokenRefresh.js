/**
 * Meta long-lived token refresh.
 *
 * Meta page/IG tokens last ~60 days. The refresh logic existed only behind a
 * manual endpoint that nothing called, so connections silently expired and
 * posts started failing with "reconnect the account". This runs the same
 * refresh on a daily schedule (see postScheduler) and, when a token can't be
 * refreshed, notifies the account owner to reconnect.
 */

const metaService = require('./metaService');

const metaCreds = () => ({
  appId: process.env.META_APP_ID || process.env.FACEBOOK_APP_ID,
  appSecret: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET,
});

/**
 * Refresh every active account whose token expires within 7 days (and hasn't
 * already expired). Returns a summary. On failure, alerts the account owner.
 */
async function refreshExpiringTokens(pool) {
  const { appId, appSecret } = metaCreds();
  if (!appId || !appSecret) {
    return { skipped: true, reason: 'Meta credentials not configured', refreshed: 0, failed: 0, total: 0 };
  }

  const expiring = await pool.query(`
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
    const result = await metaService.refreshLongLivedToken(account.access_token, appId, appSecret);
    if (result.success) {
      const expiresIn = String(Math.floor(result.expiresIn || 5184000));
      await pool.query(
        `UPDATE social_accounts SET
           access_token = $1,
           token_expires_at = NOW() + ($2 || ' seconds')::interval,
           updated_at = NOW()
         WHERE id = $3`,
        [result.accessToken, expiresIn, account.id]
      );
      refreshed++;
    } else {
      failed++;
      console.error(`Token refresh failed for social_account ${account.id} (${account.platform}):`, result.error);
      // Alert the account owner to reconnect before it fully expires.
      if (account.user_id) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
           VALUES ($1, 'social_token', $2, '/social/accounts', $3, 'social_account')`,
          [account.user_id,
           `⚠️ La conexión de ${account.platform || 'la cuenta'} está por expirar y no se pudo renovar automáticamente. Reconéctala para no perder publicaciones.`,
           account.id]
        ).catch((e) => console.error('Could not notify about token expiry:', e.message));
      }
    }
  }

  return { refreshed, failed, total: expiring.rows.length };
}

module.exports = { refreshExpiringTokens };
