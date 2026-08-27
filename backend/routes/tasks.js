const express = require('express');
const router = express.Router();
const { teamMemberIdForUser, resolveNotifyUserIds } = require('../services/identity');

// The team's task board. A task is assigned to a team member
// (assignee_kind='team', linked via task_assignments) or to a client
// (assignee_kind='client', shown in that client's portal), and may live inside
// a project — the board folders tasks by project and by client.

// Customer display name, parameterized by table alias (no trailing fallback so
// a missing name coalesces to the project's client instead of 'Cliente').
const nameOf = (a) =>
  `COALESCE(NULLIF(${a}.commercial_name,''), NULLIF(${a}.business_name,''), NULLIF(TRIM(${a}.first_name || ' ' || ${a}.last_name),''))`;

// The client a task belongs to: its own, else its project's.

// Base select shared by list endpoints. Resolves the primary team assignee,
// the project, and the effective client.
const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
         t.completed_at, t.created_at, t.customer_id, t.assignee_kind,
         t.project_id, proj.name AS project_name,
         ta.assignee_id AS assignee_member_id,
         tm.name AS assignee_name,
         COALESCE(t.customer_id, proj.customer_id) AS effective_customer_id,
         COALESCE(${nameOf('c')}, ${nameOf('pc')}) AS customer_name
    FROM tasks t
    LEFT JOIN projects proj ON proj.id = t.project_id
    LEFT JOIN task_assignments ta ON ta.task_id = t.id AND ta.assignment_type = 'primary'
    LEFT JOIN team_members tm ON tm.id = ta.assignee_id
    LEFT JOIN customers c ON c.id = t.customer_id
    LEFT JOIN customers pc ON pc.id = proj.customer_id
   WHERE TRUE
`;

/**
 * POST /api/tasks
 * Create a standalone task and (optionally) assign it.
 */
router.post('/', async (req, res) => {
  try {
    const pool = req.pool;
    const {
      title, description = null, priority = 'medium', due_date = null,
      assignee_kind = 'team', assignee_member_id = null, customer_id = null,
      project_id = null,
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
    const kind = assignee_kind === 'client' ? 'client' : 'team';
    if (kind === 'client' && !customer_id) return res.status(400).json({ error: 'Selecciona un cliente' });

    const ins = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, created_by, customer_id, assignee_kind, project_id)
       VALUES ($1, $2, 'todo', $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title.trim(), description, priority, due_date || null, req.user.id, customer_id || null, kind, project_id || null]
    );
    const taskId = ins.rows[0].id;

    if (kind === 'team' && assignee_member_id) {
      await pool.query(
        `INSERT INTO task_assignments (task_id, assignee_id, assignment_type, assigned_by)
         VALUES ($1, $2, 'primary', $3)
         ON CONFLICT (task_id, assignee_id, assignment_type) DO NOTHING`,
        [taskId, assignee_member_id, req.user.id]
      );

      // Best-effort in-app notification for the assignee.
      try {
        const userIds = await resolveNotifyUserIds(pool, { memberIds: [assignee_member_id] });
        for (const uid of userIds) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, message, link, item_id, item_type, created_at)
             VALUES ($1, 'task_assigned', $2, '/my-work', $3, 'task', NOW())`,
            [uid, `Nueva tarea: ${title.trim()}`, taskId]
          );
        }
      } catch (_) { /* notifications table/columns may vary — non-fatal */ }
    }

    const row = await pool.query(`${TASK_SELECT} AND t.id = $1`, [taskId]);
    res.status(201).json({ success: true, task: row.rows[0] });
  } catch (e) {
    console.error('Error creating task:', e);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

/**
 * GET /api/tasks
 * List standalone tasks (lead view). Filters: status, customer_id,
 * assignee_member_id, kind.
 */
router.get('/', async (req, res) => {
  try {
    const pool = req.pool;
    const { status, customer_id, assignee_member_id, kind, project_id } = req.query;
    const clauses = [];
    const params = [];
    if (status && status !== 'all') { params.push(status); clauses.push(`t.status = $${params.length}`); }
    // Client filter matches the task's effective client — its own or, when the
    // task sits in a project, the project's.
    if (customer_id) { params.push(customer_id); clauses.push(`COALESCE(t.customer_id, proj.customer_id) = $${params.length}`); }
    if (project_id === 'none') clauses.push('t.project_id IS NULL');
    else if (project_id) { params.push(project_id); clauses.push(`t.project_id = $${params.length}`); }
    if (kind) { params.push(kind); clauses.push(`t.assignee_kind = $${params.length}`); }
    if (assignee_member_id) { params.push(assignee_member_id); clauses.push(`ta.assignee_id = $${params.length}`); }
    const where = clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
    const rows = await pool.query(
      `${TASK_SELECT}${where} ORDER BY (t.status='completed'), t.due_date ASC NULLS LAST, t.id DESC`,
      params
    );
    res.json({ tasks: rows.rows });
  } catch (e) {
    console.error('Error listing tasks:', e);
    res.status(500).json({ error: 'Error al listar tareas' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update status or fields. Stamps completed_at when moving to completed.
 */
router.patch('/:id', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { status, title, description, priority, due_date, project_id } = req.body;
    const sets = [];
    const params = [];
    if (status !== undefined) {
      params.push(status); sets.push(`status = $${params.length}`);
      sets.push(`completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}`);
    }
    if (title !== undefined) { params.push(title); sets.push(`title = $${params.length}`); }
    if (description !== undefined) { params.push(description); sets.push(`description = $${params.length}`); }
    if (priority !== undefined) { params.push(priority); sets.push(`priority = $${params.length}`); }
    if (due_date !== undefined) { params.push(due_date || null); sets.push(`due_date = $${params.length}`); }
    if (project_id !== undefined) { params.push(project_id || null); sets.push(`project_id = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    sets.push('updated_at = NOW()');
    params.push(id);
    const idIdx = params.length;
    // Client-portal users may only touch their own client-assigned tasks.
    let scope = '';
    if (req.user.role === 'client') {
      params.push(req.user.customer_id);
      scope = ` AND customer_id = $${params.length} AND assignee_kind = 'client'`;
    }
    const r = await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idIdx}${scope} RETURNING id, project_id`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });

    // Project tasks can gate each other (task_dependencies). Completing one
    // frees any dependent whose prerequisites are now all done. Best-effort:
    // the dependencies table only exists where the projects module created it.
    if (status === 'completed' && r.rows[0].project_id) {
      await pool.query(`
        UPDATE tasks SET status = 'todo', updated_at = NOW()
         WHERE status = 'blocked'
           AND id IN (SELECT task_id FROM task_dependencies WHERE depends_on_task_id = $1)
           AND NOT EXISTS (
             SELECT 1 FROM task_dependencies td
             JOIN tasks dep ON dep.id = td.depends_on_task_id
            WHERE td.task_id = tasks.id AND dep.status <> 'completed'
           )
      `, [id]).catch(() => {});
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Error updating task:', e);
    res.status(500).json({ error: 'Error al actualizar la tarea' });
  }
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const r = await req.pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting task:', e);
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

module.exports = router;
