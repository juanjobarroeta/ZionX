/**
 * Where uploaded files live.
 *
 * Uploads used to be written next to the code, inside the container image — so
 * every redeploy wiped them. A post whose arte was uploaded on Monday and
 * published on Wednesday could find its media gone, and Meta would fetch a 404.
 * The directory is now a single configurable location: point UPLOAD_DIR at a
 * mounted volume (Railway: /data/uploads) and the files outlive deploys.
 *
 * Every multer destination and the static route read from here, so there is one
 * answer to "where do files go" instead of five.
 */

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

// Create on boot: multer fails the request rather than creating a missing dir.
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.error(`❌ Could not create upload directory ${UPLOAD_DIR}:`, err.message);
}

/**
 * A safe on-disk name for an uploaded file.
 *
 * multer does not sanitize `originalname` — a crafted name ("../../index.js")
 * would otherwise decide where the file lands. Keep the random prefix for
 * uniqueness, then flatten the client-supplied part to a basename and strip
 * anything that isn't a plain filename character.
 */
function safeFilename(originalname) {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const base = path
    .basename(String(originalname || 'file'))
    .replace(/[^\w.\- ]+/g, '_')
    .slice(-120);
  return `${unique}-${base || 'file'}`;
}

/** Multer disk storage, shared by every upload route. */
const diskStorage = (multer) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, safeFilename(file.originalname)),
  });

module.exports = { UPLOAD_DIR, safeFilename, diskStorage };
