const express = require('express');
const router = express.Router();
const { teamMemberIdForUser, resolveNotifyUserIds } = require('../services/identity');

// Standalone tasks — not tied to a project or a social post. A task is either
// assigned to a team member (assignee_kind='team', linked via task_assignments)
// or to a client (assignee_kind='client', tracked by customer_id and shown in
// that client's portal). project_id stays NULL for these.

const CUSTOMER_NAME_SQL =
  `COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente')`;

// Base select shared by list endpoints. Resolves the primary team assignee and
// the linked client name.
const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
         t.completed_at, t.created_at, t.customer_id, t.assignee_kind,
         ta.assignee_id AS assignee_member_id,
         tm.name AS assignee_name,
         ${CUSTOMER_NAME_SQL} AS customer_name
    FROM tasks t
    LEFT JOIN task_assignments ta ON ta.task_id = t.id AND ta.assignment_type = 'primary'
    LEFT JOIN team_members tm ON tm.id = ta.assignee_id
    LEFT JOIN customers c ON c.id = t.customer_id
   WHERE t.project_id IS NULL
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
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ error: 'El título es obligatorio' });
    const kind = assignee_kind === 'client' ? 'client' : 'team';
    if (kind === 'client' && !customer_id) return res.status(400).json({ error: 'Selecciona un cliente' });

    const ins = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, created_by, customer_id, assignee_kind)
       VALUES ($1, $2, 'todo', $3, $4, $5, $6, $7)
       RETURNING id`,
      [title.trim(), description, priority, due_date || null, req.user.id, customer_id || null, kind]
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
    const { status, customer_id, assignee_member_id, kind } = req.query;
    const clauses = [];
    const params = [];
    if (status && status !== 'all') { params.push(status); clauses.push(`t.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id); clauses.push(`t.customer_id = $${params.length}`); }
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
    const { status, title, description, priority, due_date } = req.body;
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
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idIdx} AND project_id IS NULL${scope} RETURNING id`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
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
      'DELETE FROM tasks WHERE id = $1 AND project_id IS NULL RETURNING id',
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
