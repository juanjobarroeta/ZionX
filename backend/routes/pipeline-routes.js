const express = require('express');
const router = express.Router();
const {
  CANONICAL_STAGES,
  STAGE_STATUSES,
  ROSTER_FIELDS,
  isValidStageKey,
  stageDef,
  nextRequiredStage,
  seedStagesForPost,
  advanceAfter,
} = require('../services/pipeline');
const { userIdsForTeamMembers, teamMemberIdForUser } = require('../services/identity');
const { generateCaptionDraft, generateIdeaDraft } = require('../services/ai-caption');

// =====================================================
// POST PRODUCTION PIPELINE ROUTES
//
// Owned, stateful stages on top of a content_calendar post. Mounted at root
// behind withPool + authenticateToken (same as content-calendar-routes).
// =====================================================

// Best-effort notification to the login user behind a team_members owner_id.
// Follows the app's internal insert shape (see team-routes.js). Never throws.
async function notifyOwner(pool, ownerMemberId, message, postId) {
  try {
    if (ownerMemberId == null) return;
    const userMap = await userIdsForTeamMembers(pool, [ownerMemberId]);
    const userId = userMap.get(ownerMemberId);
    if (userId == null) return;
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
       VALUES ($1, 'pipeline', $2, $3, $4, 'content_calendar')`,
      [userId, message, `/content-calendar/${postId}`, postId]
    );
  } catch (err) {
    console.error('⚠️ pipeline notifyOwner failed:', err.message);
  }
}

// Map an approval-stage transition to the content_calendar approval columns the
// publish path actually gates on. Only the two approval stages drive state;
// other stages are pure workflow. Best-effort — never throws.
async function syncApprovalFromStage(pool, postId, stageKey, status) {
  try {
    if (stageKey === 'internal_approval') {
      if (status === 'listo') {
        await pool.query(
          `UPDATE content_calendar SET approval_status = 'approved', status = 'aprobado', updated_at = NOW() WHERE id = $1`,
          [postId]
        );
      } else if (status === 'cambios') {
        await pool.query(
          `UPDATE content_calendar SET approval_status = 'revision_requested', status = 'en_diseño', updated_at = NOW() WHERE id = $1`,
          [postId]
        );
      }
    } else if (stageKey === 'client_approval') {
      if (status === 'listo') {
        await pool.query(
          `UPDATE content_calendar SET client_status = 'approved', client_reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [postId]
        );
      } else if (status === 'cambios') {
        await pool.query(
          `UPDATE content_calendar SET client_status = 'changes_requested', updated_at = NOW() WHERE id = $1`,
          [postId]
        );
      }
    }
  } catch (err) {
    console.error(`⚠️ syncApprovalFromStage(${postId}, ${stageKey}) skipped:`, err.message);
  }
}

// Human label for a post used inside notification copy.
function postLabel(post) {
  if (!post) return 'Post';
  return post.title || post.campaign || (post.post_number ? `Post ${post.post_number}` : `Post ${post.id}`);
}

// Load a post's stages ordered by position, joined to the owner's name/role.
async function loadStages(pool, postId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.content_calendar_id, s.stage_key, s.owner_id, s.status,
            s.optional, s.position, s.updated_at,
            tm.name AS owner_name, tm.role AS owner_role
       FROM post_pipeline_stages s
       LEFT JOIN team_members tm ON tm.id = s.owner_id
      WHERE s.content_calendar_id = $1
      ORDER BY s.position ASC`,
    [postId]
  );
  return rows;
}

// -----------------------------------------------------
// GET /content-calendar/:id/pipeline
// The post's stages, ordered. Lazily seeds them for older posts that predate
// the pipeline, then returns.
// -----------------------------------------------------
router.get('/content-calendar/:id/pipeline', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    const postCheck = await pool.query('SELECT id FROM content_calendar WHERE id = $1', [id]);
    if (!postCheck.rows.length) return res.status(404).json({ message: 'Entrada no encontrada' });

    let stages = await loadStages(pool, id);
    if (!stages.length) {
      await seedStagesForPost(pool, id);
      stages = await loadStages(pool, id);
    }
    res.json({ post_id: Number(id), stages });
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// PATCH /content-calendar/:id/pipeline/:stageKey
// Body: { status?, owner_id? }. Updates the stage and fires best-effort
// routing notifications on listo/cambios transitions.
// -----------------------------------------------------
router.patch('/content-calendar/:id/pipeline/:stageKey', async (req, res) => {
  try {
    const pool = req.pool;
    const { id, stageKey } = req.params;
    const { status, owner_id } = req.body || {};

    if (!isValidStageKey(stageKey)) {
      return res.status(400).json({ message: 'stage_key inválido', valid: CANONICAL_STAGES.map((s) => s.stage_key) });
    }
    if (status !== undefined && !STAGE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'status inválido', valid: STAGE_STATUSES });
    }

    // Ensure the stage exists (lazily seed older posts).
    let existing = await pool.query(
      'SELECT * FROM post_pipeline_stages WHERE content_calendar_id = $1 AND stage_key = $2',
      [id, stageKey]
    );
    if (!existing.rows.length) {
      const postCheck = await pool.query('SELECT id FROM content_calendar WHERE id = $1', [id]);
      if (!postCheck.rows.length) return res.status(404).json({ message: 'Entrada no encontrada' });
      await seedStagesForPost(pool, id);
      existing = await pool.query(
        'SELECT * FROM post_pipeline_stages WHERE content_calendar_id = $1 AND stage_key = $2',
        [id, stageKey]
      );
      if (!existing.rows.length) return res.status(404).json({ message: 'Etapa no encontrada' });
    }

    // Build a dynamic update from only the fields provided.
    const sets = [];
    const params = [];
    if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
    if (owner_id !== undefined) { params.push(owner_id); sets.push(`owner_id = $${params.length}`); }
    sets.push('updated_at = NOW()');
    params.push(id, stageKey);

    const upd = await pool.query(
      `UPDATE post_pipeline_stages SET ${sets.join(', ')}
        WHERE content_calendar_id = $${params.length - 1} AND stage_key = $${params.length}
        RETURNING *`,
      params
    );
    const stage = upd.rows[0];

    // Best-effort notifications on status transitions.
    if (status !== undefined) {
      const postRes = await pool.query('SELECT * FROM content_calendar WHERE id = $1', [id]);
      const post = postRes.rows[0];
      const label = postLabel(post);

      if (status === 'listo') {
        // Auto-advance: move the next required stage into progress.
        await advanceAfter(pool, id, stageKey);
        // Notify the owner of the next non-optional stage: it's their turn.
        const next = nextRequiredStage(stageKey);
        if (next) {
          const nextStage = await pool.query(
            'SELECT owner_id FROM post_pipeline_stages WHERE content_calendar_id = $1 AND stage_key = $2',
            [id, next.stage_key]
          );
          const nextOwner = nextStage.rows[0]?.owner_id;
          await notifyOwner(pool, nextOwner, `«${label}» listo para tu etapa`, id);
        }
      } else if (status === 'cambios') {
        // Notify this stage's own owner that changes were requested.
        await notifyOwner(pool, stage.owner_id, `«${label}» requiere cambios en tu etapa`, id);
      }

      // Drive the real approval state from the approval stages, so completing
      // (or reopening) them in the pipeline actually gates publishing — the
      // publish path reads content_calendar.approval_status / client_status.
      await syncApprovalFromStage(pool, id, stageKey, status);
    }

    // Return the freshly joined stage row.
    const joined = await pool.query(
      `SELECT s.id, s.content_calendar_id, s.stage_key, s.owner_id, s.status,
              s.optional, s.position, s.updated_at,
              tm.name AS owner_name, tm.role AS owner_role
         FROM post_pipeline_stages s
         LEFT JOIN team_members tm ON tm.id = s.owner_id
        WHERE s.id = $1`,
      [stage.id]
    );
    res.json({ success: true, stage: joined.rows[0] });
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// POST /content-calendar/:id/pipeline/seed
// Force (re)seed for backfilling existing posts. Idempotent.
// -----------------------------------------------------
router.post('/content-calendar/:id/pipeline/seed', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const postCheck = await pool.query('SELECT id FROM content_calendar WHERE id = $1', [id]);
    if (!postCheck.rows.length) return res.status(404).json({ message: 'Entrada no encontrada' });

    await seedStagesForPost(pool, id);
    const stages = await loadStages(pool, id);
    res.json({ success: true, post_id: Number(id), stages });
  } catch (error) {
    console.error('Error seeding pipeline:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// POST /content-calendar/:id/pipeline/copy/ai-draft
// Generate an on-brand Spanish caption for the copy stage using the client's
// creative brief + the post's idea/pilar/platform. Accelerant for the
// community manager, not an autopublish. Degrades gracefully if the AI key
// is missing.
// -----------------------------------------------------
router.post('/content-calendar/:id/pipeline/copy/ai-draft', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const result = await generateCaptionDraft(pool, id);
    if (result.notFound) return res.status(404).json({ message: 'Entrada no encontrada' });
    if (result.draft == null) return res.status(503).json({ draft: null, error: result.error });
    res.json({ draft: result.draft });
  } catch (error) {
    console.error('Error generating AI caption:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// POST /content-calendar/:id/pipeline/idea/ai-draft
// Generate a content idea/tema (the concept a designer works from) using the
// client's brief + the post's pilar/platform. Same graceful degradation.
// -----------------------------------------------------
router.post('/content-calendar/:id/pipeline/idea/ai-draft', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const result = await generateIdeaDraft(pool, id);
    if (result.notFound) return res.status(404).json({ message: 'Entrada no encontrada' });
    if (result.draft == null) return res.status(503).json({ draft: null, error: result.error });
    res.json({ draft: result.draft });
  } catch (error) {
    console.error('Error generating AI idea:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// GET /pipeline/my-queue
// The logged-in person's personal production queue: every pipeline stage they
// own that isn't done yet, with the post + client context. A `ready` flag marks
// stages whose required predecessors are all complete (so it's actually their
// turn) vs. stages still blocked upstream.
// -----------------------------------------------------
router.get('/pipeline/my-queue', async (req, res) => {
  try {
    const pool = req.pool;
    const memberId = await teamMemberIdForUser(pool, req.user.id);
    if (!memberId) return res.json({ memberId: null, items: [] });

    const { rows } = await pool.query(
      `SELECT s.id, s.content_calendar_id AS post_id, s.stage_key, s.status,
              s.optional, s.position,
              cc.customer_id, cc.campaign, cc.idea_tema, cc.title, cc.platform,
              cc.content_type, cc.scheduled_date, cc.status AS post_status,
              COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente') AS customer_name,
              NOT EXISTS (
                SELECT 1 FROM post_pipeline_stages p
                 WHERE p.content_calendar_id = s.content_calendar_id
                   AND p.optional = false
                   AND p.position < s.position
                   AND p.status <> 'listo'
              ) AS ready
         FROM post_pipeline_stages s
         JOIN content_calendar cc ON cc.id = s.content_calendar_id
         LEFT JOIN customers c ON c.id = cc.customer_id
        WHERE s.owner_id = $1
          AND s.status <> 'listo'
        ORDER BY cc.scheduled_date ASC NULLS LAST, s.position ASC`,
      [memberId]
    );
    res.json({ memberId, items: rows });
  } catch (error) {
    console.error('Error fetching my-queue:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// GET /pipeline/supervision
// The senior's team overview: for every client where the caller is the assigned
// senior, the in-flight posts with their current active stage (lowest-position
// stage not yet 'listo'), its owner and status. Powers the supervision view —
// where each post stands and what is stuck (status 'cambios').
// -----------------------------------------------------
router.get('/pipeline/supervision', async (req, res) => {
  try {
    const pool = req.pool;
    const memberId = await teamMemberIdForUser(pool, req.user.id);
    if (!memberId) return res.json({ memberId: null, items: [] });

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (cc.id)
              cc.id AS post_id, cc.customer_id, cc.campaign, cc.idea_tema,
              cc.title, cc.platform, cc.content_type, cc.scheduled_date,
              cc.status AS post_status,
              COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente') AS customer_name,
              s.stage_key AS current_stage, s.status AS current_status,
              s.owner_id AS current_owner_id, tm.name AS current_owner_name
         FROM customers c
         JOIN content_calendar cc ON cc.customer_id = c.id
         JOIN post_pipeline_stages s
           ON s.content_calendar_id = cc.id AND s.status <> 'listo'
         LEFT JOIN team_members tm ON tm.id = s.owner_id
        WHERE c.assigned_senior = $1
        ORDER BY cc.id, s.position ASC`,
      [memberId]
    );

    // Re-sort by schedule for display (DISTINCT ON forced the cc.id order).
    rows.sort((a, b) => {
      const da = a.scheduled_date ? new Date(a.scheduled_date).getTime() : Infinity;
      const db = b.scheduled_date ? new Date(b.scheduled_date).getTime() : Infinity;
      return da - db;
    });
    res.json({ memberId, items: rows });
  } catch (error) {
    console.error('Error fetching supervision:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// GET /customers/:id/roster
// The three roster fields with resolved names.
// -----------------------------------------------------
router.get('/customers/:id/roster', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT c.assigned_designer, c.assigned_community, c.assigned_senior,
              d.name  AS assigned_designer_name,
              cm.name AS assigned_community_name,
              sr.name AS assigned_senior_name
         FROM customers c
         LEFT JOIN team_members d  ON d.id  = c.assigned_designer
         LEFT JOIN team_members cm ON cm.id = c.assigned_community
         LEFT JOIN team_members sr ON sr.id = c.assigned_senior
        WHERE c.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// PUT /customers/:id/roster
// Body: { assigned_designer?, assigned_community?, assigned_senior? }
// -----------------------------------------------------
router.put('/customers/:id/roster', async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const body = req.body || {};

    // Normalize provided roster fields (null clears an assignment).
    const sets = [];
    const params = [];
    for (const field of ROSTER_FIELDS) {
      if (body[field] !== undefined) {
        params.push(body[field] === null || body[field] === '' ? null : body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }
    if (!sets.length) {
      return res.status(400).json({ message: 'Nada que actualizar', fields: ROSTER_FIELDS });
    }
    params.push(id);
    const upd = await pool.query(
      `UPDATE customers SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, assigned_designer, assigned_community, assigned_senior`,
      params
    );
    if (!upd.rows.length) return res.status(404).json({ message: 'Cliente no encontrado' });
    res.json({ success: true, roster: upd.rows[0] });
  } catch (error) {
    console.error('Error updating roster:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// -----------------------------------------------------
// GET /pipeline/assignable?role=designer
// team_members filtered by role, for the frontend assignment dropdowns.
// (A ?role= filter was also added to GET /team-members.)
// -----------------------------------------------------
router.get('/pipeline/assignable', async (req, res) => {
  try {
    const pool = req.pool;
    const { role } = req.query;
    const params = [];
    let roleClause = '';
    if (role) {
      params.push(role);
      roleClause = ` AND role = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT id, name, email, role, department, avatar_url
         FROM team_members
        WHERE is_active = true${roleClause}
        ORDER BY name`,
      params
    );
    res.json({ team_members: rows });
  } catch (error) {
    console.error('Error fetching assignable members:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;
