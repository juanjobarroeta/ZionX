/**
 * Los términos que rigen a un cliente, y el acuerdo que los hace exigibles.
 *
 * El manual pone la falta de un SLA de aprobación entre los diez vacíos más
 * peligrosos, y la razón es concreta: sin un plazo acordado, un cliente que
 * tarda cuatro días en aprobar produce una publicación tardía que parece un
 * incumplimiento de la agencia. No hay línea que reparta la culpa, así que cae
 * de nuestro lado.
 *
 * Aquí los términos se resuelven en cascada —suscripción, luego paquete, luego
 * el mínimo del sistema— y se congelan al firmar. Un acuerdo cuyos términos
 * cambian solos no es un acuerdo.
 */

const crypto = require('crypto');

/** El mínimo del sistema. Se usa sólo si nadie definió nada. */
const POR_DEFECTO = {
  approval_sla_hours: 48,
  revision_rounds: 2,
  // Qué pasa al vencer el plazo sin respuesta. `reprograma` es lo prudente:
  // publicar sin aprobación es una decisión que el cliente no tomó.
  sla_breach: 'reprograma',
};

const LEYENDA_BREACH = {
  reprograma: 'La publicación se mueve al siguiente espacio disponible y la fecha original se da por perdida.',
  publica: 'La publicación sale tal como se envió a revisión.',
  siguiente_espacio: 'La pieza pasa al siguiente ciclo de calendario.',
};

/**
 * Términos vigentes de un cliente.
 *
 * Manda lo firmado: si hay un acuerdo vivo, sus condiciones son las que rigen
 * aunque el paquete haya cambiado después. Sin acuerdo firmado se devuelven las
 * condiciones propuestas, marcadas como no vinculantes.
 */
async function terminosDe(pool, customerId) {
  const firmado = await pool.query(
    `SELECT id, terms, signed_at, signed_by_name
       FROM service_agreements
      WHERE customer_id = $1 AND signed_at IS NOT NULL AND revoked_at IS NULL
      ORDER BY signed_at DESC LIMIT 1`,
    [customerId]
  );
  if (firmado.rows.length) {
    const a = firmado.rows[0];
    return {
      ...POR_DEFECTO, ...(a.terms || {}),
      firmado: true, acuerdoId: a.id, firmadoEl: a.signed_at, firmadoPor: a.signed_by_name,
    };
  }

  const { rows } = await pool.query(
    `SELECT cs.approval_sla_hours AS s_sla, cs.revision_rounds AS s_rev, cs.sla_breach AS s_breach,
            sp.approval_sla_hours AS p_sla, sp.revision_rounds AS p_rev, sp.sla_breach AS p_breach,
            sp.name AS paquete
       FROM customer_subscriptions cs
       LEFT JOIN service_packages sp ON sp.id = cs.service_package_id
      WHERE cs.customer_id = $1 AND LOWER(COALESCE(cs.status,'active')) = 'active'
      ORDER BY cs.start_date DESC NULLS LAST, cs.id DESC LIMIT 1`,
    [customerId]
  );
  const r = rows[0] || {};
  return {
    approval_sla_hours: r.s_sla ?? r.p_sla ?? POR_DEFECTO.approval_sla_hours,
    revision_rounds: r.s_rev ?? r.p_rev ?? POR_DEFECTO.revision_rounds,
    sla_breach: r.s_breach ?? r.p_breach ?? POR_DEFECTO.sla_breach,
    paquete: r.paquete || null,
    firmado: false,
  };
}

/** El texto del acuerdo, en las palabras que el cliente va a leer. */
function redactar(cliente, t) {
  const horas = t.approval_sla_hours;
  const plazo = horas % 24 === 0 ? `${horas / 24} día${horas / 24 === 1 ? '' : 's'} hábil${horas / 24 === 1 ? '' : 'es'}` : `${horas} horas hábiles`;
  return [
    `Acuerdo de servicio entre ZIONX y ${cliente}.`,
    '',
    `1. Aprobación de contenido. ZIONX envía cada pieza a revisión y ${cliente} cuenta con ${plazo} para aprobarla o pedir cambios.`,
    `2. Silencio. El silencio no equivale a aprobación. Si el plazo vence sin respuesta: ${LEYENDA_BREACH[t.sla_breach] || LEYENDA_BREACH.reprograma}`,
    `3. Rondas de cambios. El servicio incluye ${t.revision_rounds} ronda${t.revision_rounds === 1 ? '' : 's'} de ajustes por pieza. A partir de ahí, los cambios se cotizan aparte antes de ejecutarse.`,
    '4. Fuera de alcance. Cualquier trabajo no contemplado en el servicio contratado requiere aprobación comercial previa y no se ejecuta hasta obtenerla.',
    '5. Registro. La aprobación, los cambios pedidos y las fechas quedan registrados en la aplicación de ZIONX, que es la fuente oficial de la operación.',
    '',
    'Al firmar, el cliente acepta estos términos para la vigencia del servicio contratado.',
  ].join('\n');
}

/** Prepara el acuerdo y su liga. No lo firma: eso lo hace el cliente. */
async function preparar(pool, customerId, creadoPor) {
  const { rows } = await pool.query(
    `SELECT COALESCE(NULLIF(commercial_name,''), NULLIF(business_name,''), 'el cliente') AS nombre
       FROM customers WHERE id = $1`, [customerId]
  );
  if (!rows.length) return { notFound: true };
  const nombre = rows[0].nombre;

  const t = await terminosDe(pool, customerId);
  const terms = {
    approval_sla_hours: t.approval_sla_hours,
    revision_rounds: t.revision_rounds,
    sla_breach: t.sla_breach,
    paquete: t.paquete || null,
  };
  const sub = await pool.query(
    `SELECT id FROM customer_subscriptions WHERE customer_id = $1
      ORDER BY start_date DESC NULLS LAST, id DESC LIMIT 1`, [customerId]
  );

  const token = crypto.randomBytes(24).toString('hex');
  const ins = await pool.query(
    `INSERT INTO service_agreements (customer_id, subscription_id, token, terms, body, sent_at, created_by)
     VALUES ($1,$2,$3,$4,$5,NOW(),$6) RETURNING id, token`,
    [customerId, sub.rows[0]?.id || null, token, JSON.stringify(terms), redactar(nombre, terms), creadoPor || null]
  );
  return { ok: true, id: ins.rows[0].id, token: ins.rows[0].token, terms, cliente: nombre };
}

/** Lo que ve el cliente al abrir su liga. */
async function porToken(pool, token) {
  const { rows } = await pool.query(
    `SELECT a.id, a.terms, a.body, a.signed_at, a.signed_by_name, a.revoked_at,
            COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), 'Cliente') AS cliente
       FROM service_agreements a
       LEFT JOIN customers c ON c.id = a.customer_id
      WHERE a.token = $1`, [token]
  );
  return rows[0] || null;
}

/**
 * Firmar. Se guarda quién, cuándo y desde dónde: un acuerdo sin rastro de
 * quién lo aceptó no sostiene nada cuando hace falta.
 */
async function firmar(pool, token, { nombre, email, ip, userAgent }) {
  if (!nombre || String(nombre).trim().length < 3) {
    return { error: 'Escribe tu nombre completo para firmar.' };
  }
  const { rows } = await pool.query(
    `UPDATE service_agreements
        SET signed_at = NOW(), signed_by_name = $2, signed_by_email = $3,
            signed_ip = $4, signed_user_agent = $5
      WHERE token = $1 AND signed_at IS NULL AND revoked_at IS NULL
      RETURNING id, customer_id, signed_at`,
    [token, String(nombre).trim().slice(0, 160), email || null, ip || null, String(userAgent || '').slice(0, 300)]
  );
  if (!rows.length) {
    const yaEsta = await porToken(pool, token);
    if (yaEsta?.signed_at) return { error: 'Este acuerdo ya está firmado.', yaFirmado: true };
    return { error: 'La liga no es válida o fue revocada.' };
  }
  return { ok: true, ...rows[0] };
}

module.exports = { terminosDe, preparar, porToken, firmar, redactar, POR_DEFECTO, LEYENDA_BREACH };
