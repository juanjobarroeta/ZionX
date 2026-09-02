/**
 * Si una conexión deja de dar datos, alguien tiene que enterarse.
 *
 * Los errores del sync vivían sólo en los logs de Railway. Veintidós cuentas
 * llevaban días sin sincronizar —páginas donde la cuenta conectada perdió el
 * rol de admin, cuentas publicitarias sin `ads_management`— y el equipo no lo
 * sabía: el rendimiento de esos clientes simplemente aparecía vacío, y su
 * reporte mensual salía corto sin explicar por qué.
 *
 * Esto guarda el resultado de cada intento en la propia cuenta, y avisa cuando
 * lleva suficientes fallos seguidos como para no ser un tropiezo pasajero.
 */

const { notifyUser } = require('./notify');

/**
 * Lo que Meta dijo, dicho de forma accionable.
 *
 * Sus mensajes vienen en inglés y describen el mecanismo, no el arreglo:
 * «must be an administrator... in order to impersonate it» no le dice a nadie
 * qué hacer. Vive aquí y no en la página porque el aviso al teléfono tiene que
 * decir lo mismo — /connections lo devuelve ya traducido.
 */
function explainSyncError(raw) {
  const m = String(raw || '');
  if (/administrator, editor, or moderator/i.test(m)) {
    return 'Perdiste el rol de administrador en esta página. Pídelo de nuevo en Meta Business y reconecta.';
  }
  if (/ads_management|ads_read/i.test(m)) {
    return 'El dueño de la cuenta publicitaria no le ha dado permiso a ZIONX. Que te asigne acceso en Meta Business.';
  }
  if (/Two Factor Authentication/i.test(m)) {
    return 'La página exige verificación en dos pasos en la cuenta conectada.';
  }
  if (/invalid oauth access token|access token has expired|session has been invalidated|cannot parse access token/i.test(m)
      || (/token/i.test(m) && /expired|session/i.test(m))) {
    return 'La sesión con Meta caducó o se invalidó. Reconecta la cuenta.';
  }
  return m.replace(/^\(#\d+\)\s*/, '').slice(0, 180);
}

// Un fallo puede ser un hipo de Meta. Tres seguidos (18h con syncs de 6h) ya no.
const ALERT_AFTER = 3;
// Y no se vuelve a avisar de lo mismo hasta pasado esto, para no gotear cada 6h.
const REALERT_MS = 7 * 24 * 60 * 60 * 1000;

const TABLES = {
  social: { table: 'social_accounts', label: 'la cuenta' },
  ad: { table: 'ad_accounts', label: 'la cuenta publicitaria' },
};

/** El sync de esta cuenta salió bien: se limpia el historial de fallos. */
async function markHealthy(pool, kind, accountId) {
  const t = TABLES[kind];
  if (!t || !accountId) return;
  await pool.query(
    `UPDATE ${t.table}
        SET last_sync_error = NULL, sync_failures = 0,
            last_sync_ok_at = NOW(), sync_alerted_at = NULL
      WHERE id = $1`,
    [accountId]
  ).catch((e) => console.error('markHealthy:', e.message));
}

/**
 * El sync de esta cuenta falló. Guarda el motivo, cuenta el fallo, y avisa a
 * quien la conectó si ya lleva demasiados seguidos.
 */
async function markFailed(pool, kind, accountId, error) {
  const t = TABLES[kind];
  if (!t || !accountId) return;
  const message = String(error || 'Error desconocido').slice(0, 500);

  let row;
  try {
    const r = await pool.query(
      `UPDATE ${t.table}
          SET last_sync_error = $2, sync_failures = COALESCE(sync_failures, 0) + 1
        WHERE id = $1
        RETURNING id, user_id, customer_id, account_name, platform, sync_failures, sync_alerted_at`,
      [accountId, message]
    );
    row = r.rows[0];
  } catch (e) {
    console.error('markFailed:', e.message);
    return;
  }
  if (!row) return;

  if (row.sync_failures < ALERT_AFTER) return;
  const alerted = row.sync_alerted_at ? new Date(row.sync_alerted_at).getTime() : 0;
  if (Date.now() - alerted < REALERT_MS) return;

  const who = row.account_name || row.platform || 'una cuenta';
  await notifyUser(pool, row.user_id, {
    type: 'sync_failed',
    title: 'Una conexión dejó de dar datos',
    message: `${who}: ${explainSyncError(message)}`,
    link: '/conexiones',
    itemId: row.id,
    itemType: kind === 'ad' ? 'ad_account' : 'social_account',
  });
  await pool.query(`UPDATE ${t.table} SET sync_alerted_at = NOW() WHERE id = $1`, [row.id])
    .catch(() => {});
}

module.exports = { markHealthy, markFailed, explainSyncError, ALERT_AFTER };
