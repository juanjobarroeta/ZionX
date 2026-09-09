const express = require('express');
const acuerdos = require('../services/acuerdos');

/**
 * El acuerdo de servicio: lo que el equipo prepara y lo que el cliente firma.
 *
 * Dos routers porque son dos mundos: uno pide sesión, el otro no puede pedirla
 * —quien firma no tiene cuenta en ZIONX— y se autentica con el token de la liga,
 * igual que la aprobación mensual.
 */
const equipo = express.Router();
const publico = express.Router();

// GET /api/acuerdos/customer/:id — términos vigentes y su historial.
equipo.get('/acuerdos/customer/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [terminos, historial] = await Promise.all([
      acuerdos.terminosDe(req.pool, id),
      req.pool.query(
        `SELECT id, token, terms, sent_at, signed_at, signed_by_name, revoked_at
           FROM service_agreements WHERE customer_id = $1 ORDER BY id DESC LIMIT 20`, [id]
      ),
    ]);
    res.json({ terminos, acuerdos: historial.rows });
  } catch (e) {
    console.error('Error fetching agreement terms:', e);
    res.status(500).json({ error: 'No se pudieron leer los términos' });
  }
});

// POST /api/acuerdos/customer/:id — prepara el acuerdo y devuelve su liga.
equipo.post('/acuerdos/customer/:id', async (req, res) => {
  try {
    const r = await acuerdos.preparar(req.pool, parseInt(req.params.id, 10), req.user?.id);
    if (r.notFound) return res.status(404).json({ error: 'El cliente no existe' });
    const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ ...r, url: `${base.replace(/\/$/, '')}/acuerdo/${r.token}` });
  } catch (e) {
    console.error('Error preparing agreement:', e);
    res.status(500).json({ error: 'No se pudo preparar el acuerdo' });
  }
});

// POST /api/acuerdos/:id/revocar — deja de regir sin borrar el rastro.
equipo.post('/acuerdos/:id/revocar', async (req, res) => {
  try {
    await req.pool.query('UPDATE service_agreements SET revoked_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error revoking agreement:', e);
    res.status(500).json({ error: 'No se pudo revocar' });
  }
});

// ---- Público: sin sesión, el token es la credencial --------------------------

// GET /api/acuerdos/publico/:token
publico.get('/publico/:token', async (req, res) => {
  try {
    const a = await acuerdos.porToken(req.pool, req.params.token);
    if (!a) return res.status(404).json({ error: 'Liga no válida' });
    if (a.revoked_at) return res.status(410).json({ error: 'Este acuerdo fue revocado' });
    res.json({
      cliente: a.cliente, body: a.body, terms: a.terms,
      firmado: Boolean(a.signed_at), firmadoEl: a.signed_at, firmadoPor: a.signed_by_name,
    });
  } catch (e) {
    console.error('Error fetching public agreement:', e);
    res.status(500).json({ error: 'No se pudo abrir el acuerdo' });
  }
});

// POST /api/acuerdos/publico/:token/firmar
publico.post('/publico/:token/firmar', async (req, res) => {
  try {
    const r = await acuerdos.firmar(req.pool, req.params.token, {
      nombre: req.body?.nombre,
      email: req.body?.email,
      // Detrás del proxy de Railway la IP real llega en la cabecera.
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (r.error) return res.status(r.yaFirmado ? 409 : 400).json({ error: r.error });
    res.json({ success: true, firmadoEl: r.signed_at });
  } catch (e) {
    console.error('Error signing agreement:', e);
    res.status(500).json({ error: 'No se pudo firmar' });
  }
});

module.exports = { equipo, publico };
