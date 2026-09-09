const express = require('express');
const zoom = require('../services/zoom');
const { notifyUser } = require('../services/notify');
const { userIdsForTeamMembers } = require('../services/identity');

/**
 * Juntas con cliente. Dos routers: el del equipo, con sesión, y el webhook,
 * que no puede tenerla —lo llama Zoom— y se autentica con su propia firma.
 */
const equipo = express.Router();
const webhook = express.Router();

// ---- Equipo -----------------------------------------------------------------

equipo.get('/zoom/health', (req, res) => {
  res.json({ configured: zoom.isConfigured() });
});

// GET /api/zoom/customer/:id — las juntas de un cliente, la próxima primero.
equipo.get('/zoom/customer/:id', async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      `SELECT id, zoom_meeting_id, topic, start_time, duration, join_url, status,
              summary, next_steps, next_steps_procesados_at, transcript_path
         FROM zoom_meetings WHERE customer_id = $1
        ORDER BY start_time DESC NULLS LAST LIMIT 50`,
      [req.params.id]
    );
    res.json({ configured: zoom.isConfigured(), juntas: rows });
  } catch (e) {
    console.error('Error listing meetings:', e);
    res.status(500).json({ error: 'No se pudieron leer las juntas' });
  }
});

// POST /api/zoom/customer/:id — agendar.
equipo.post('/zoom/customer/:id', async (req, res) => {
  try {
    if (!zoom.isConfigured()) return res.status(409).json({ error: 'Zoom no está configurado' });
    const customerId = parseInt(req.params.id, 10);
    const { topic, cuando, minutos, agenda } = req.body || {};
    if (!cuando) return res.status(400).json({ error: 'Falta la fecha' });
    const fecha = new Date(cuando);
    if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'La fecha no es válida' });
    if (fecha.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Esa fecha ya pasó' });

    const c = await req.pool.query(
      `SELECT COALESCE(NULLIF(commercial_name,''), NULLIF(business_name,''), 'Cliente') AS nombre
         FROM customers WHERE id = $1`, [customerId]);
    if (!c.rows.length) return res.status(404).json({ error: 'El cliente no existe' });

    const m = await zoom.agendar({
      topic: topic || `ZIONX · ${c.rows[0].nombre}`,
      cuando: fecha, minutos: parseInt(minutos, 10) || 60, agenda,
    });
    const ins = await req.pool.query(
      `INSERT INTO zoom_meetings (customer_id, zoom_meeting_id, zoom_uuid, topic, start_time,
         duration, join_url, start_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [customerId, m.id, m.uuid, m.topic, m.start_time, m.duration, m.join_url, m.start_url, req.user?.id || null]
    );
    res.json({
      success: true,
      id: ins.rows[0].id,        // el de ZionX: con este se cancela
      zoom_id: m.id,             // el de Zoom
      uuid: m.uuid, topic: m.topic, start_time: m.start_time,
      duration: m.duration, join_url: m.join_url,
    });
  } catch (e) {
    console.error('Error scheduling meeting:', e.message);
    res.status(502).json({ error: e.message || 'No se pudo agendar' });
  }
});

// DELETE /api/zoom/:id — cancelar.
equipo.delete('/zoom/:id', async (req, res) => {
  try {
    const { rows } = await req.pool.query('SELECT zoom_meeting_id FROM zoom_meetings WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No existe' });
    if (rows[0].zoom_meeting_id) await zoom.cancelar(rows[0].zoom_meeting_id).catch(() => {});
    await req.pool.query(`UPDATE zoom_meetings SET status='cancelada', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error cancelling meeting:', e);
    res.status(500).json({ error: 'No se pudo cancelar' });
  }
});

/**
 * POST /api/zoom/:id/acuerdos — convertir los próximos pasos en tareas.
 *
 * Llegan como borrador y alguien los confirma aquí. La transcripción en español
 * no es lo bastante fiable como para asignarle trabajo a una persona sin que un
 * humano lo lea primero — y el manual pide responsable y fecha, que Zoom no sabe.
 */
equipo.post('/zoom/:id/acuerdos', async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      'SELECT customer_id, next_steps, topic FROM zoom_meetings WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No existe' });
    const elegidos = Array.isArray(req.body?.pasos) ? req.body.pasos : [];
    if (!elegidos.length) return res.status(400).json({ error: 'No elegiste ningún acuerdo' });

    const creadas = [];
    for (const paso of elegidos) {
      const texto = String(paso?.texto || paso || '').trim().slice(0, 255);
      if (!texto) continue;
      const t = await req.pool.query(
        `INSERT INTO tasks (title, description, status, priority, due_date, customer_id,
           created_by, origen, origen_id, es_borrador)
         VALUES ($1,$2,'todo',COALESCE($3,'medium'),$4,$5,$6,'junta',$7,false) RETURNING id`,
        [texto, `Acordado en: ${rows[0].topic || 'junta con cliente'}`,
         paso?.prioridad || null, paso?.fecha || null, rows[0].customer_id, req.user?.id || null, req.params.id]
      );
      if (paso?.responsable) {
        await req.pool.query(
          `INSERT INTO task_assignments (task_id, assignee_id, assignment_type)
           VALUES ($1,$2,'primary') ON CONFLICT DO NOTHING`,
          [t.rows[0].id, paso.responsable]
        ).catch(() => {});
      }
      creadas.push(t.rows[0].id);
    }
    await req.pool.query(
      'UPDATE zoom_meetings SET next_steps_procesados_at = NOW(), updated_at = NOW() WHERE id = $1',
      [req.params.id]);
    res.json({ success: true, creadas: creadas.length, ids: creadas });
  } catch (e) {
    console.error('Error creating tasks from meeting:', e);
    res.status(500).json({ error: 'No se pudieron crear las tareas' });
  }
});

// ---- Webhook ----------------------------------------------------------------

/**
 * Lo llama Zoom, no una persona. Se valida con la firma; sin ella, cualquiera
 * podría inventar acuerdos de junta en tu base.
 */
webhook.post('/', async (req, res) => {
  const crudo = req.rawBody != null ? req.rawBody : JSON.stringify(req.body || {});
  const evento = req.body || {};

  // El reto de alta del endpoint se contesta antes de validar nada: es
  // precisamente el paso donde Zoom comprueba que compartimos el secreto.
  if (evento.event === 'endpoint.url_validation') {
    if (!zoom.CFG().webhookSecret) return res.status(409).json({ error: 'Falta ZOOM_WEBHOOK_SECRET' });
    return res.json(zoom.respuestaDeValidacion(evento.payload?.plainToken));
  }

  if (!zoom.firmaValida(crudo, req.headers['x-zm-signature'], req.headers['x-zm-request-timestamp'])) {
    console.warn('Zoom webhook con firma inválida — descartado');
    return res.status(401).json({ error: 'Firma inválida' });
  }
  // Se contesta ya: Zoom reintenta si tardamos, y el trabajo puede seguir aparte.
  res.json({ ok: true });

  try {
    if (evento.event === 'recording.completed' || evento.event === 'meeting.aic_transcript_completed') {
      await guardarResultado(req.pool, evento);
    }
  } catch (e) {
    console.error('Zoom webhook:', e.message);
  }
});

/** Guarda transcripción, resumen y próximos pasos, y avisa a quien lleva la cuenta. */
async function guardarResultado(pool, evento) {
  const obj = evento.payload?.object || {};
  const meetingId = obj.id;
  if (!meetingId) return;

  const { rows } = await pool.query(
    `SELECT z.id, z.customer_id, z.created_by, c.assigned_community, c.assigned_senior,
            COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), 'Cliente') AS cliente
       FROM zoom_meetings z LEFT JOIN customers c ON c.id = z.customer_id
      WHERE z.zoom_meeting_id = $1`, [meetingId]);
  if (!rows.length) return; // una junta que no salió de ZIONX
  const junta = rows[0];

  const archivos = obj.recording_files || [];
  const de = (tipo) => archivos.find((f) => String(f.recording_type || f.file_type || '').toLowerCase() === tipo);

  let transcripcion = null;
  const vtt = de('transcript') || archivos.find((f) => String(f.file_type).toUpperCase() === 'TRANSCRIPT');
  if (vtt?.download_url) transcripcion = await zoom.descargar(vtt.download_url).catch(() => null);

  let resumen = null;
  const s = de('summary');
  if (s?.download_url) resumen = await zoom.descargar(s.download_url).catch(() => null);

  let pasos = null;
  const ns = de('summary_next_steps');
  if (ns?.download_url) {
    const crudo = await zoom.descargar(ns.download_url).catch(() => null);
    pasos = interpretarPasos(crudo);
  }

  await pool.query(
    `UPDATE zoom_meetings
        SET status = 'terminada', transcript_path = COALESCE($2, transcript_path),
            summary = COALESCE($3, summary), next_steps = COALESCE($4, next_steps), updated_at = NOW()
      WHERE id = $1`,
    [junta.id, transcripcion, resumen, pasos ? JSON.stringify(pasos) : null]
  );

  const porMiembro = await userIdsForTeamMembers(pool, [junta.assigned_community, junta.assigned_senior].filter(Boolean));
  const destino = porMiembro.get(junta.assigned_community) || porMiembro.get(junta.assigned_senior) || junta.created_by;
  if (!destino) return;

  const cuantos = pasos?.length || 0;
  await notifyUser(pool, destino, {
    type: 'junta_terminada',
    title: cuantos ? 'La junta dejó acuerdos por confirmar' : 'Terminó la junta',
    message: cuantos
      ? `${junta.cliente} · ${cuantos} acuerdo${cuantos === 1 ? '' : 's'} esperando que los conviertas en tareas`
      : `${junta.cliente} · ya está la transcripción`,
    link: `/customer/${junta.customer_id}`,
    itemId: junta.id,
    itemType: 'zoom_meeting',
  });
}

/**
 * Zoom entrega los próximos pasos como texto. Se parten por renglón y se
 * limpian las viñetas; no se intenta adivinar responsable ni fecha, que es
 * justo lo que un humano tiene que poner.
 */
function interpretarPasos(crudo) {
  if (!crudo) return null;
  try {
    const j = JSON.parse(crudo);
    const lista = j.next_steps || j.nextSteps || j.summary_next_steps;
    if (Array.isArray(lista)) return lista.map((x) => ({ texto: String(x.text || x).trim() })).filter((x) => x.texto);
  } catch { /* no era JSON: se trata como texto */ }
  return String(crudo)
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*••]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, 30)
    .map((texto) => ({ texto }));
}

module.exports = { equipo, webhook, interpretarPasos };
