/**
 * Las alertas operativas del manual.
 *
 * El Manual Operativo v1 define cuándo el sistema debe avisar, y lo hace con
 * una tesis detrás: «una tarea vencida sin aviso previo es incumplimiento; una
 * tarea en riesgo reportada antes de vencer es un problema gestionado». Por eso
 * todo esto avisa ANTES, no después: avisar de lo ya vencido sólo documenta el
 * fallo.
 *
 * Reglas implementadas aquí (§G y «Automatizaciones recomendadas»):
 *   • Publicación en las próximas 24 h sin estar programada.
 *   • Tarea que vence en 48 h y no está en revisión ni lista.
 *
 * Cada alerta se manda UNA VEZ por objeto y ventana. Un aviso que se repite
 * cada hora deja de leerse, y entonces la siguiente alerta de verdad tampoco se
 * lee — que es exactamente el problema que el manual quiere resolver.
 */

const { notifyUser } = require('./notify');
const { userIdsForTeamMembers } = require('./identity');

/** ¿Ya avisamos de esto? El propio historial de avisos es el registro. */
async function yaAvisado(pool, tipo, itemId, itemType, dentroDeHoras) {
  const { rows } = await pool.query(
    `SELECT 1 FROM notifications
      WHERE type = $1 AND item_id = $2 AND item_type = $3
        AND created_at > NOW() - ($4 || ' hours')::interval
      LIMIT 1`,
    [tipo, itemId, itemType, String(dentroDeHoras)]
  );
  return rows.length > 0;
}

/**
 * §G — «Alerta roja: publicación de las próximas 24 h sin aprobar/programar».
 *
 * Se mira el calendario, no la cola: una entrada que nunca llegó a la cola es
 * justo la que se va a perder, y desde la cola no se ve porque no está.
 */
async function publicacionesSinProgramar(pool) {
  const { rows } = await pool.query(
    `SELECT cc.id, cc.title, cc.scheduled_date, cc.scheduled_time, cc.status,
            cc.assigned_community_manager, cc.assigned_designer, cc.created_by,
            c.assigned_community, c.assigned_senior,
            COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), 'Cliente') AS cliente,
            sp.status AS publish_status
       FROM content_calendar cc
       LEFT JOIN customers c ON c.id = cc.customer_id
       LEFT JOIN scheduled_posts sp ON sp.id = cc.scheduled_post_id
      WHERE cc.scheduled_date IS NOT NULL
        AND (cc.scheduled_date + COALESCE(cc.scheduled_time, '09:00'::time))
            BETWEEN NOW() AND NOW() + interval '24 hours'
        AND (sp.id IS NULL OR sp.status NOT IN ('scheduled', 'publishing', 'published'))`
  );
  if (!rows.length) return { revisadas: 0, avisadas: 0 };

  // Los responsables se guardan como team_members; los avisos van a la cuenta.
  const miembros = rows.flatMap((r) => [
    r.assigned_community_manager, r.assigned_designer, r.assigned_community, r.assigned_senior,
  ]).filter(Boolean);
  const porMiembro = await userIdsForTeamMembers(pool, miembros);

  let avisadas = 0;
  for (const r of rows) {
    if (await yaAvisado(pool, 'pub_sin_programar', r.id, 'content_calendar', 20)) continue;
    const destino =
      porMiembro.get(r.assigned_community_manager) ||
      porMiembro.get(r.assigned_designer) ||
      porMiembro.get(r.assigned_community) ||
      porMiembro.get(r.assigned_senior) ||
      r.created_by;
    if (!destino) continue;

    const hora = String(r.scheduled_time || '09:00').slice(0, 5);
    await notifyUser(pool, destino, {
      type: 'pub_sin_programar',
      title: 'Publica en menos de 24 h y no está programada',
      message: `${r.title || 'Sin título'} · ${r.cliente} · sale a las ${hora}`,
      link: `/post/${r.id}`,
      itemId: r.id,
      itemType: 'content_calendar',
    });
    avisadas += 1;
  }
  return { revisadas: rows.length, avisadas };
}

/**
 * §G — «Alerta amarilla: tarea vence en 48 h y no está en revisión/lista».
 */
async function tareasPorVencer(pool) {
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.due_date, t.status, t.created_by,
            ta.assignee_id,
            COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,'')) AS cliente
       FROM tasks t
       LEFT JOIN task_assignments ta ON ta.task_id = t.id AND ta.assignment_type = 'primary'
       LEFT JOIN customers c ON c.id = t.customer_id
      WHERE t.due_date IS NOT NULL
        AND t.due_date BETWEEN NOW() AND NOW() + interval '48 hours'
        AND LOWER(COALESCE(t.status, '')) NOT IN ('completed', 'done', 'review', 'cancelled')`
  );
  if (!rows.length) return { revisadas: 0, avisadas: 0 };

  const porMiembro = await userIdsForTeamMembers(pool, rows.map((r) => r.assignee_id).filter(Boolean));

  let avisadas = 0;
  for (const r of rows) {
    if (await yaAvisado(pool, 'tarea_por_vencer', r.id, 'task', 44)) continue;
    const destino = porMiembro.get(r.assignee_id) || r.created_by;
    if (!destino) continue;

    const cuando = new Date(r.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    await notifyUser(pool, destino, {
      type: 'tarea_por_vencer',
      title: 'Vence en menos de 48 h',
      message: `${r.title}${r.cliente ? ` · ${r.cliente}` : ''} · para el ${cuando}`,
      link: '/my-work',
      itemId: r.id,
      itemType: 'task',
    });
    avisadas += 1;
  }
  return { revisadas: rows.length, avisadas };
}

/** Corre las dos y devuelve el resumen para el log. */
async function correr(pool) {
  const pubs = await publicacionesSinProgramar(pool).catch((e) => {
    console.error('alertas/publicaciones:', e.message); return { revisadas: 0, avisadas: 0, error: e.message };
  });
  const tareas = await tareasPorVencer(pool).catch((e) => {
    console.error('alertas/tareas:', e.message); return { revisadas: 0, avisadas: 0, error: e.message };
  });
  return { pubs, tareas };
}

module.exports = { correr, publicacionesSinProgramar, tareasPorVencer };
