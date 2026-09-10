/**
 * Canva: traer el arte terminado al post.
 *
 * Canva NO deja componer un diseño por API —no hay capas, ni texto, ni
 * posiciones—. Lo que sí deja es exportar uno ya hecho, y ése es el trabajo que
 * quita de encima: hoy alguien baja un PNG y lo vuelve a subir, y en ese paso es
 * donde se cuela la versión equivocada.
 *
 * Guardamos el ID del diseño, no sólo el archivo: así se puede volver a exportar
 * la versión actual, y el arte del post es el arte de Canva por construcción.
 *
 * Es por persona: cada quien conecta su Canva. Y el refresh token ROTA en cada
 * renovación — si no se guarda el nuevo, la siguiente falla y hay que reconectar.
 */

const crypto = require('crypto');
const path = require('path');
const fsp = require('fs/promises');
const { UPLOAD_DIR } = require('../config/storage');

const AUTORIZA = 'https://www.canva.com/api/oauth/authorize';
const TOKEN = 'https://api.canva.com/rest/v1/oauth/token';
const API = 'https://api.canva.com/rest/v1';

// Sólo lo que hace falta para exportar. Pedir de más es pedirle al usuario que
// conceda lo que no vamos a usar.
const SCOPES = 'design:meta:read design:content:read asset:read';

const CFG = () => ({
  clientId: process.env.CANVA_CLIENT_ID || '',
  clientSecret: process.env.CANVA_CLIENT_SECRET || '',
  redirect: process.env.CANVA_REDIRECT_URI || '',
});

const isConfigured = () => {
  const c = CFG();
  return Boolean(c.clientId && c.clientSecret && c.redirect);
};

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * La liga de autorización, con PKCE.
 *
 * El `code_verifier` se guarda contra el usuario porque hay que presentarlo al
 * canjear el código: es lo que demuestra que quien vuelve del navegador es quien
 * inició, y no alguien que interceptó el código por el camino.
 */
async function ligaDeAutorizacion(pool, userId) {
  const c = CFG();
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  await pool.query(
    `INSERT INTO canva_connections (user_id, pending_verifier, pending_state, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (user_id) DO UPDATE SET pending_verifier = $2, pending_state = $3, updated_at = NOW()`,
    [userId, verifier, state]
  );

  const p = new URLSearchParams({
    code_challenge: challenge,
    code_challenge_method: 'S256',
    client_id: c.clientId,
    redirect_uri: c.redirect,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${AUTORIZA}?${p.toString()}`;
}

/** Guarda el token con la vigencia que dice Canva y el refresh NUEVO. */
async function guardarToken(pool, userId, data) {
  const segundos = Number(data.expires_in) > 0 ? Number(data.expires_in) : 14400;
  await pool.query(
    `UPDATE canva_connections
        SET access_token = $2, refresh_token = COALESCE($3, refresh_token),
            expires_at = NOW() + ($4 || ' seconds')::interval,
            scopes = COALESCE($5, scopes), connected_at = COALESCE(connected_at, NOW()),
            pending_verifier = NULL, pending_state = NULL, updated_at = NOW()
      WHERE user_id = $1`,
    [userId, data.access_token, data.refresh_token || null,
     String(Math.max(60, segundos - 120)), data.scope || null]
  );
}

/** Canjea el código de vuelta del navegador. */
async function canjear(pool, userId, code, state) {
  const c = CFG();
  const { rows } = await pool.query(
    'SELECT pending_verifier, pending_state FROM canva_connections WHERE user_id = $1', [userId]);
  const guardado = rows[0];
  if (!guardado?.pending_verifier) throw new Error('No hay una conexión en curso. Empieza de nuevo.');
  // El state ata esta vuelta con aquella salida: sin comprobarlo, otro sitio
  // podría empujar su propio código y dejarnos conectados a su cuenta.
  if (state && guardado.pending_state && state !== guardado.pending_state) {
    throw new Error('La respuesta de Canva no corresponde a esta solicitud.');
  }

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: guardado.pending_verifier,
      redirect_uri: c.redirect,
    }),
  });
  if (!res.ok) throw new Error(`Canva rechazó el código (${res.status}): ${(await res.text()).slice(0, 160)}`);
  await guardarToken(pool, userId, await res.json());
  return { ok: true };
}

/**
 * El token vigente. Renueva con el refresh antes de que caduque; el refresh
 * rota, así que el nuevo se guarda en el mismo paso.
 */
async function token(pool, userId) {
  const { rows } = await pool.query(
    'SELECT access_token, refresh_token, expires_at FROM canva_connections WHERE user_id = $1', [userId]);
  const con = rows[0];
  if (!con?.access_token && !con?.refresh_token) {
    const err = new Error('Conecta tu cuenta de Canva primero.');
    err.necesitaConectar = true;
    throw err;
  }
  if (con.access_token && con.expires_at && new Date(con.expires_at) > new Date()) return con.access_token;
  if (!con.refresh_token) {
    const err = new Error('La conexión con Canva caducó. Vuelve a conectarla.');
    err.necesitaConectar = true;
    throw err;
  }

  const c = CFG();
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: con.refresh_token }),
  });
  if (!res.ok) {
    await pool.query('UPDATE canva_connections SET access_token = NULL, refresh_token = NULL WHERE user_id = $1', [userId]);
    const err = new Error('La conexión con Canva ya no sirve. Vuelve a conectarla.');
    err.necesitaConectar = true;
    throw err;
  }
  const data = await res.json();
  await guardarToken(pool, userId, data);
  return data.access_token;
}

async function api(pool, userId, ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${ruta}`, {
    method,
    headers: { Authorization: `Bearer ${await token(pool, userId)}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { raw: texto }; }
  if (!res.ok) throw new Error(json?.message || `Canva ${res.status}: ${texto.slice(0, 160)}`);
  return json;
}

/**
 * El ID de diseño dentro de una liga de Canva.
 * Formas conocidas: /design/DAF.../edit, /design/DAF.../view, o el ID pelado.
 */
function idDeDiseño(entrada) {
  const s = String(entrada || '').trim();
  if (!s) return null;
  const m = s.match(/\/design\/([A-Za-z0-9_-]{8,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{8,}$/.test(s)) return s;
  return null;
}

// Los dominios de liga corta de Canva. La lista es cerrada a propósito: esto
// sale a pedir una URL que nos dieron, y sólo debe alcanzar a Canva.
const CORTAS = new Set(['canva.link', 'www.canva.link']);

/**
 * El ID del diseño, resolviendo la liga corta si hace falta.
 *
 * El botón «Compartir» de Canva da `canva.link/xxxx`, que NO contiene el ID:
 * es un redirect. Se pide sólo el `Location` y no se sigue hasta la página —
 * canva.com le responde 403 a un cliente que no es navegador, pero el redirect
 * ya trae `/design/<ID>/`, que es todo lo que hace falta.
 */
async function resolverDiseño(entrada) {
  const directo = idDeDiseño(entrada);
  if (directo) return directo;

  let u;
  try { u = new URL(String(entrada || '').trim()); } catch { return null; }
  if (u.protocol !== 'https:' || !CORTAS.has(u.hostname)) return null;

  const ctl = new AbortController();
  const alarma = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(u.toString(), { redirect: 'manual', signal: ctl.signal });
    const destino = r.headers.get('location');
    return destino ? idDeDiseño(destino) : null;
  } catch {
    return null; // una liga corta que no resuelve se trata como liga inválida
  } finally {
    clearTimeout(alarma);
  }
}

/**
 * Exporta un diseño y devuelve la URL del archivo.
 *
 * La exportación es un trabajo asíncrono: se crea y se pregunta hasta que
 * termina. Se acota el número de vueltas — un diseño que no exporta en un minuto
 * es un problema que hay que contar, no algo que esperar para siempre.
 */
async function exportar(pool, userId, designId, formato = 'png') {
  const job = await api(pool, userId, '/exports', {
    method: 'POST',
    body: { design_id: designId, format: { type: formato } },
  });
  let estado = job?.job;
  for (let i = 0; i < 20 && estado?.status === 'in_progress'; i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await api(pool, userId, `/exports/${estado.id}`);
    estado = r?.job;
  }
  if (estado?.status !== 'success') {
    throw new Error(estado?.error?.message || 'Canva no terminó de exportar el diseño.');
  }
  const url = estado.urls?.[0];
  if (!url) throw new Error('Canva no devolvió el archivo exportado.');
  return url;
}

/** Baja el export al volumen y devuelve su ruta pública. */
async function traerArte(pool, userId, designId, formato = 'png') {
  const url = await exportar(pool, userId, designId, formato);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar el arte (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('El archivo vino vacío.');

  const dir = path.join(UPLOAD_DIR, 'canva');
  await fsp.mkdir(dir, { recursive: true });
  // El nombre lleva la hora: exportar otra vez tras un cambio tiene que dar un
  // archivo distinto, o el navegador seguiría enseñando el viejo de su caché.
  const nombre = `${designId}-${Date.now()}.${formato}`;
  const tmp = path.join(dir, `${nombre}.part`);
  await fsp.writeFile(tmp, buf);
  await fsp.rename(tmp, path.join(dir, nombre));
  return `/uploads/canva/${nombre}`;
}

/** ¿Esta persona tiene Canva conectado? */
async function estado(pool, userId) {
  if (!isConfigured()) return { configurado: false, conectado: false };
  const { rows } = await pool.query(
    'SELECT connected_at, expires_at, refresh_token FROM canva_connections WHERE user_id = $1', [userId]);
  const c = rows[0];
  return {
    configurado: true,
    conectado: Boolean(c?.connected_at && c?.refresh_token),
    desde: c?.connected_at || null,
  };
}

module.exports = { isConfigured, CFG, ligaDeAutorizacion, canjear, token, api, idDeDiseño, resolverDiseño, exportar, traerArte, estado, SCOPES };
