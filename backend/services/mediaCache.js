/**
 * Nuestra copia de las miniaturas de Meta.
 *
 * Las URLs del CDN de Instagram vienen firmadas y caducan: el parámetro `oe`
 * es la hora de expiración, y dura alrededor de un día. Guardábamos esa URL en
 * post_analytics y la pintábamos tal cual, así que a las pocas horas Rendimiento
 * y —peor— el reporte mensual que abre el cliente se llenaban de imágenes rotas
 * con 403.
 *
 * Sincronizar más seguido no lo arregla: cualquier vista entre dos syncs cae en
 * la ventana muerta, y un post que deja de entrar en el barrido se rompe para
 * siempre. La única copia que no caduca es la propia.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { UPLOAD_DIR } = require('../config/storage');

const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
const MAX_BYTES = 5 * 1024 * 1024;

try {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
} catch (err) {
  console.error('❌ No se pudo crear el directorio de miniaturas:', err.message);
}

/** Un nombre estable por publicación, para no volver a bajar lo ya bajado. */
function fileFor(platformPostId, ext = 'jpg') {
  const safe = String(platformPostId).replace(/[^\w.-]+/g, '_').slice(-100);
  return `${safe}.${ext}`;
}

/**
 * Baja la miniatura una vez y devuelve la ruta pública servida por /uploads.
 * Devuelve null si no se pudo — una miniatura que falta nunca debe tumbar un
 * sync de métricas.
 *
 * @returns {Promise<string|null>} p. ej. "/uploads/thumbs/17900000000000.jpg"
 */
async function cacheThumbnail(url, platformPostId) {
  if (!url || !platformPostId) return null;
  // Ya la tenemos: es la razón de existir de este módulo.
  const name = fileFor(platformPostId);
  const dest = path.join(THUMB_DIR, name);
  const publicPath = `/uploads/thumbs/${name}`;
  try {
    const stat = await fsp.stat(dest);
    if (stat.size > 0) return publicPath;
  } catch { /* no está: hay que bajarla */ }

  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: MAX_BYTES,
      // El CDN rechaza peticiones sin un User-Agent de navegador.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZIONX/1.0)' },
    });
    const buf = Buffer.from(res.data);
    if (!buf.length) return null;
    // Escribir aparte y renombrar: un corte a media descarga dejaría un
    // archivo truncado que luego pasaría por bueno.
    const tmp = `${dest}.part`;
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, dest);
    return publicPath;
  } catch (err) {
    const code = err.response?.status || err.code || err.message;
    console.error(`No se pudo guardar la miniatura de ${platformPostId}: ${code}`);
    return null;
  }
}

module.exports = { cacheThumbnail, THUMB_DIR };
