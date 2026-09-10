const express = require('express');
const canva = require('../services/canva');

const conexion = express.Router();
const contenido = express.Router();

// GET /api/canva/estado — ¿está configurado y conectado?
conexion.get('/canva/estado', async (req, res) => {
  try {
    res.json(await canva.estado(req.pool, req.user.id));
  } catch (e) {
    console.error('Error reading Canva status:', e);
    res.status(500).json({ error: 'No se pudo leer el estado de Canva' });
  }
});

// POST /api/canva/conectar — devuelve la liga de autorización.
conexion.post('/canva/conectar', async (req, res) => {
  try {
    if (!canva.isConfigured()) return res.status(409).json({ error: 'Canva no está configurado' });
    res.json({ url: await canva.ligaDeAutorizacion(req.pool, req.user.id) });
  } catch (e) {
    console.error('Error building Canva auth url:', e);
    res.status(500).json({ error: 'No se pudo iniciar la conexión' });
  }
});

// POST /api/canva/callback — el código que vuelve del navegador.
conexion.post('/canva/callback', async (req, res) => {
  try {
    const { code, state } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Falta el código de Canva' });
    await canva.canjear(req.pool, req.user.id, code, state);
    res.json({ success: true });
  } catch (e) {
    console.error('Error exchanging Canva code:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/canva/conexion — desconectar.
conexion.delete('/canva/conexion', async (req, res) => {
  try {
    await req.pool.query('DELETE FROM canva_connections WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error disconnecting Canva:', e);
    res.status(500).json({ error: 'No se pudo desconectar' });
  }
});

/**
 * POST /content-calendar/:id/canva — ligar un diseño y traer su arte.
 *
 * Se guarda el ID del diseño además del archivo: con eso se puede volver a
 * exportar la versión actual, que es la diferencia entre «una copia de aquel
 * día» y «el arte que está en Canva».
 */
contenido.post('/content-calendar/:id/canva', async (req, res) => {
  try {
    const designId = canva.idDeDiseño(req.body?.design || req.body?.url);
    if (!designId) {
      return res.status(400).json({ error: 'Esa no parece una liga de diseño de Canva.' });
    }
    const arte = await canva.traerArte(req.pool, req.user.id, designId, req.body?.formato || 'png');
    const { rows } = await req.pool.query(
      `UPDATE content_calendar
          SET arte = $2, canva_design_id = $3, canva_synced_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING id, arte, canva_design_id, canva_synced_at`,
      [req.params.id, arte, designId]
    );
    if (!rows.length) return res.status(404).json({ error: 'La publicación no existe' });
    res.json({ success: true, ...rows[0] });
  } catch (e) {
    console.error('Error importing from Canva:', e.message);
    res.status(e.necesitaConectar ? 409 : 502).json({ error: e.message, necesitaConectar: !!e.necesitaConectar });
  }
});

/** POST /content-calendar/:id/canva/actualizar — volver a exportar el mismo diseño. */
contenido.post('/content-calendar/:id/canva/actualizar', async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      'SELECT canva_design_id FROM content_calendar WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'La publicación no existe' });
    const designId = rows[0].canva_design_id;
    if (!designId) return res.status(400).json({ error: 'Esta publicación no viene de un diseño de Canva.' });

    const arte = await canva.traerArte(req.pool, req.user.id, designId, req.body?.formato || 'png');
    const upd = await req.pool.query(
      `UPDATE content_calendar SET arte = $2, canva_synced_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING id, arte, canva_synced_at`,
      [req.params.id, arte]
    );
    res.json({ success: true, ...upd.rows[0] });
  } catch (e) {
    console.error('Error refreshing from Canva:', e.message);
    res.status(e.necesitaConectar ? 409 : 502).json({ error: e.message, necesitaConectar: !!e.necesitaConectar });
  }
});

module.exports = { conexion, contenido };
