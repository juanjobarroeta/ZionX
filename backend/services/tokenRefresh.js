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
const { notifyUser } = require('./notify');

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
        await notifyUser(pool, account.user_id, {
          type: 'social_token',
          title: 'Conexión por expirar',
          message: `La conexión de ${account.platform || 'la cuenta'} no se pudo renovar. Reconéctala para no perder publicaciones.`,
          link: '/conexiones',
          itemId: account.id,
          itemType: 'social_account',
        });
      }
    }
  }

  return { refreshed, failed, total: expiring.rows.length };
}

/**
 * Ad-account tokens expire too — and nothing refreshed them, so spend sync went
 * quiet roughly 60 days after each connection. Same exchange, different table.
 */
async function refreshExpiringAdTokens(pool) {
  const { appId, appSecret } = metaCreds();
  if (!appId || !appSecret) {
    return { skipped: true, reason: 'Meta credentials not configured', refreshed: 0, failed: 0, total: 0 };
  }

  const expiring = await pool.query(`
    SELECT * FROM ad_accounts
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
      await pool.query(
        `UPDATE ad_accounts SET
           access_token = $1,
           token_expires_at = NOW() + ($2 || ' seconds')::interval,
           updated_at = NOW()
         WHERE id = $3`,
        [result.accessToken, String(Math.floor(result.expiresIn || 5184000)), account.id]
      );
      refreshed++;
    } else {
      failed++;
      console.error(`Token refresh failed for ad_account ${account.id}:`, result.error);
      if (account.user_id) {
        await notifyUser(pool, account.user_id, {
          type: 'ads_token',
          title: 'Conexión publicitaria por expirar',
          message: `La cuenta ${account.account_name || account.platform_account_id} no se pudo renovar. Reconéctala para no perder el registro de inversión.`,
          link: '/conexiones',
          itemId: account.id,
          itemType: 'ad_account',
        });
      }
    }
  }

  return { refreshed, failed, total: expiring.rows.length };
}

module.exports = { refreshExpiringTokens, refreshExpiringAdTokens };
