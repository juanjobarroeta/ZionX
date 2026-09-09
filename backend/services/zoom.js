/**
 * Juntas con cliente: agendarlas y recoger lo que se acordó.
 *
 * El manual es tajante — «ningún acuerdo recibido por WhatsApp, llamada o junta
 * se considera asignado hasta quedar registrado en la app» y «toda decisión
 * termina en la app». El hueco que eso describe es real: se acuerda algo en una
 * llamada y nadie lo escribe.
 *
 * Lo valioso de Zoom aquí NO es la transcripción. Una hora de junta son treinta
 * páginas que nadie lee. Lo valioso son los `summary_next_steps` del AI
 * Companion: Zoom entrega justo la lista que el manual exige que exista.
 *
 * Config-gated como el puente fiscal: sin credenciales, isConfigured() es false
 * y todo esto no hace nada.
 */

const crypto = require('crypto');

const CFG = () => ({
  accountId: process.env.ZOOM_ACCOUNT_ID || '',
  clientId: process.env.ZOOM_CLIENT_ID || '',
  clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
  // El secreto del webhook es distinto del de la app: firma lo que Zoom manda.
  webhookSecret: process.env.ZOOM_WEBHOOK_SECRET || '',
  usuario: process.env.ZOOM_HOST_USER || 'me',
});

const isConfigured = () => {
  const c = CFG();
  return Boolean(c.accountId && c.clientId && c.clientSecret);
};

// ---- Autenticación ----------------------------------------------------------
// Server-to-Server OAuth: la app habla por la cuenta, no por cada persona. Así
// agendar no exige que cada quien conecte su Zoom, a diferencia de Meta.
let _token = null;
let _exp = 0;

async function token() {
  if (_token && Date.now() < _exp) return _token;
  const c = CFG();
  const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(c.accountId)}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } }
  );
  if (!res.ok) {
    throw new Error(`Zoom login falló (${res.status}): ${(await res.text()).slice(0, 160)}`);
  }
  const data = await res.json();
  _token = data.access_token;
  // Zoom emite una hora; se respeta lo que dice, con margen.
  _exp = Date.now() + Math.max(60, (data.expires_in || 3600) - 120) * 1000;
  return _token;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { raw: texto }; }
  if (!res.ok) {
    const err = new Error(json?.message || texto.slice(0, 200) || `Zoom ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Agenda una junta y devuelve las dos ligas: la del cliente y la del anfitrión.
 * La grabación en la nube se pide aquí — sin ella no hay transcripción después.
 */
async function agendar({ topic, cuando, minutos = 60, agenda, grabar = true }) {
  const c = CFG();
  const m = await api(`/users/${encodeURIComponent(c.usuario)}/meetings`, {
    method: 'POST',
    body: {
      topic,
      type: 2, // programada
      start_time: new Date(cuando).toISOString(),
      duration: minutos,
      timezone: process.env.SCHEDULE_TZ || 'America/Mexico_City',
      agenda: agenda || undefined,
      settings: {
        auto_recording: grabar ? 'cloud' : 'none',
        join_before_host: false,
        waiting_room: true,
      },
    },
  });
  return {
    id: m.id, uuid: m.uuid, topic: m.topic,
    start_time: m.start_time, duration: m.duration,
    join_url: m.join_url, start_url: m.start_url,
  };
}

/** Cancelar. Zoom devuelve 204 sin cuerpo. */
async function cancelar(meetingId) {
  await api(`/meetings/${meetingId}`, { method: 'DELETE' });
  return { ok: true };
}

// ---- Webhooks ---------------------------------------------------------------

/**
 * La firma de Zoom: HMAC-SHA256 de `v0:{timestamp}:{cuerpo crudo}` con el
 * secreto del webhook, prefijado con `v0=`.
 *
 * Se compara en tiempo constante: un `===` filtra por cuánto tarda en fallar, y
 * quien pueda medir eso puede adivinar la firma byte a byte. Y el cuerpo tiene
 * que ser el CRUDO — si se re-serializa el JSON, cualquier diferencia de
 * espacios cambia el hash y nada valida nunca.
 */
function firmaValida(cuerpoCrudo, firma, timestamp) {
  const c = CFG();
  if (!c.webhookSecret || !firma || !timestamp) return false;
  const esperada = 'v0=' + crypto
    .createHmac('sha256', c.webhookSecret)
    .update(`v0:${timestamp}:${cuerpoCrudo}`)
    .digest('hex');
  const a = Buffer.from(esperada);
  const b = Buffer.from(String(firma));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** La respuesta al reto de validación de Zoom al dar de alta el endpoint. */
function respuestaDeValidacion(plainToken) {
  const c = CFG();
  return {
    plainToken,
    encryptedToken: crypto.createHmac('sha256', c.webhookSecret).update(plainToken).digest('hex'),
  };
}

/** Las grabaciones de una junta, por si el webhook se perdió. */
async function grabaciones(meetingIdOrUuid) {
  return api(`/meetings/${encodeURIComponent(meetingIdOrUuid)}/recordings`);
}

/**
 * Bajar un archivo de grabación. El `download_url` necesita el token: sin él
 * Zoom devuelve la página de inicio de sesión, no el archivo.
 */
async function descargar(downloadUrl) {
  const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`No se pudo bajar (${res.status})`);
  return res.text();
}

module.exports = {
  isConfigured, CFG, agendar, cancelar, grabaciones, descargar,
  firmaValida, respuestaDeValidacion, api,
};
