const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { resolveNotifyUserIds } = require('../services/identity');
const { setStageStatus, advanceAfter } = require('../services/pipeline');
const publishSync = require('../services/publishSync');

// Public base for absolutizing media when promoting to the publish queue.
const publicBase = (req) => process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;

// =====================================================
// PUBLIC CLIENT APPROVAL ENDPOINTS (no auth required)
// =====================================================

// Get posts for client review via token
router.get('/client/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Look up token
    const tokenResult = await req.pool.query(
      `SELECT cat.*, c.business_name, c.commercial_name
       FROM client_approval_tokens cat
       JOIN customers c ON cat.customer_id = c.id
       WHERE cat.token = $1`,
      [token]
    );

    if (!tokenResult.rows.length) {
      return res.status(404).json({ error: 'Enlace no valido o expirado' });
    }

    const tokenData = tokenResult.rows[0];

    // Check expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Este enlace ha expirado. Solicita uno nuevo a tu equipo.' });
    }

    // Fetch posts ready for client review. A post-scoped token (content_calendar_id
    // set) shows just that one post; a month token shows the month's posts.
    const posts = tokenData.content_calendar_id
      ? await req.pool.query(`
          SELECT
            cc.id, cc.post_number, cc.campaign, cc.platform, cc.content_type,
            cc.scheduled_date, cc.status, cc.copy_in, cc.copy_out,
            cc.arte, cc.arte_files, cc.idea_tema, cc.pilar,
            cc.client_status, cc.client_feedback_text, cc.client_reviewed_at,
            cc.revision_count
          FROM content_calendar cc
          WHERE cc.id = $1
        `, [tokenData.content_calendar_id])
      : await req.pool.query(`
          SELECT
            cc.id, cc.post_number, cc.campaign, cc.platform, cc.content_type,
            cc.scheduled_date, cc.status, cc.copy_in, cc.copy_out,
            cc.arte, cc.arte_files, cc.idea_tema, cc.pilar,
            cc.client_status, cc.client_feedback_text, cc.client_reviewed_at,
            cc.revision_count
          FROM content_calendar cc
          WHERE cc.customer_id = $1
            AND cc.month_year = $2
            AND cc.status IN ('revision', 'aprobado', 'programado', 'publicado')
            AND (cc.arte IS NOT NULL OR cc.arte_files IS NOT NULL)
          ORDER BY cc.post_number ASC
        `, [tokenData.customer_id, tokenData.month_year]);

    res.json({
      customer: tokenData.business_name || tokenData.commercial_name,
      month_year: tokenData.month_year,
      posts: posts.rows
    });
  } catch (error) {
    console.error('Error fetching client approval:', error);
    res.status(500).json({ error: 'Error al cargar el contenido' });
  }
});

// Client approves a post
router.post('/client/:token/approve/:postId', async (req, res) => {
  try {
    const { token, postId } = req.params;
    const { feedback } = req.body;

    // Validate token and post ownership
    const validation = await validateTokenAndPost(req.pool, token, postId);
    if (validation.error) return res.status(validation.status).json({ error: validation.error });

    // Update client approval status
    await req.pool.query(`
      UPDATE content_calendar SET
        client_status = 'approved',
        client_feedback_text = COALESCE(client_feedback_text, '') || CASE WHEN $2 != '' THEN E'\n[Cliente] ' || $2 ELSE '' END,
        client_reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [postId, feedback || '']);

    // Keep the pipeline in sync: client approval completes the client_approval
    // stage and flows work to the next stage.
    await setStageStatus(req.pool, postId, 'client_approval', 'listo');
    await advanceAfter(req.pool, postId, 'client_approval');

    // If internally approved too, auto-schedule the post
    const post = validation.post;
    let autoScheduled = false;
    if (post.approval_status === 'approved' || post.status === 'aprobado') {
      autoScheduled = await tryAutoSchedule(req.pool, post, publicBase(req));
    }

    // Notify internal team. assigned_* are team_members.id (resolve to users.id
    // via user_id FK); submitted_by is already a users.id.
    const notifyUserIds = await resolveNotifyUserIds(req.pool, {
      memberIds: [post.assigned_designer, post.assigned_community_manager, post.assigned_approver],
      userIds: [post.submitted_by],
    });
    for (const userId of notifyUserIds) {
      await req.pool.query(`
        INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
        VALUES ($1, 'client_approved', $2, '/content-calendar', $3, 'content')
      `, [userId, `✅ Cliente aprobo: "${post.campaign || 'Post #' + post.post_number}"`, postId]);
    }

    res.json({
      success: true,
      message: 'Contenido aprobado',
      auto_scheduled: autoScheduled
    });
  } catch (error) {
    console.error('Error in client approval:', error);
    res.status(500).json({ error: 'Error al aprobar' });
  }
});

// Client requests changes
router.post('/client/:token/request-changes/:postId', async (req, res) => {
  try {
    const { token, postId } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ error: 'Por favor describe los cambios que necesitas' });
    }

    const validation = await validateTokenAndPost(req.pool, token, postId);
    if (validation.error) return res.status(validation.status).json({ error: validation.error });

    await req.pool.query(`
      UPDATE content_calendar SET
        client_status = 'changes_requested',
        client_feedback_text = COALESCE(client_feedback_text, '') || E'\n[Cambios solicitados] ' || $2,
        client_reviewed_at = NOW(),
        status = 'en_diseño',
        approval_status = 'revision_requested',
        revision_count = COALESCE(revision_count, 0) + 1,
        updated_at = NOW()
      WHERE id = $1
    `, [postId, feedback]);

    // Reflect the client's request for changes on the pipeline stage.
    await setStageStatus(req.pool, postId, 'client_approval', 'cambios');

    // Notify internal team (assigned_* are team_members.id → users.id; submitted_by is users.id)
    const post = validation.post;
    const notifyUserIds = await resolveNotifyUserIds(req.pool, {
      memberIds: [post.assigned_designer, post.assigned_community_manager, post.assigned_approver],
      userIds: [post.submitted_by],
    });
    for (const userId of notifyUserIds) {
      await req.pool.query(`
        INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
        VALUES ($1, 'client_revision', $2, '/content-calendar', $3, 'content')
      `, [userId, `↩️ Cliente solicita cambios: "${post.campaign || 'Post'}" - ${feedback.substring(0, 50)}...`, postId]);
    }

    res.json({ success: true, message: 'Cambios solicitados enviados al equipo' });
  } catch (error) {
    console.error('Error in client revision request:', error);
    res.status(500).json({ error: 'Error al solicitar cambios' });
  }
});

// Helper: validate token ownership of a post
async function validateTokenAndPost(pool, token, postId) {
  const tokenResult = await pool.query(
    'SELECT * FROM client_approval_tokens WHERE token = $1', [token]
  );
  if (!tokenResult.rows.length) return { error: 'Enlace invalido', status: 404 };

  const tokenData = tokenResult.rows[0];
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return { error: 'Enlace expirado', status: 410 };
  }

  // A post-scoped token only authorizes its own post; a month token authorizes
  // any post of that customer+month.
  const postResult = tokenData.content_calendar_id
    ? await pool.query(
        `SELECT * FROM content_calendar WHERE id = $1 AND id = $2`,
        [postId, tokenData.content_calendar_id]
      )
    : await pool.query(
        `SELECT * FROM content_calendar WHERE id = $1 AND customer_id = $2 AND month_year = $3`,
        [postId, tokenData.customer_id, tokenData.month_year]
      );
  if (!postResult.rows.length) return { error: 'Post no encontrado', status: 404 };

  return { post: postResult.rows[0] };
}

// Helper: auto-schedule a post after approval. Delegates to publishSync.promote,
// the single gated path — it runs the full readiness check, resolves the account
// (incl. the Instagram special case), and links scheduled_posts.content_calendar_id
// so the scheduler can flip the calendar to 'publicado' when it goes out.
async function tryAutoSchedule(pool, post, base) {
  try {
    const result = await publishSync.promote(pool, post.id, base);
    if (result.ok) {
      await pool.query(
        "UPDATE content_calendar SET status = 'programado', updated_at = NOW() WHERE id = $1 AND status <> 'publicado'",
        [post.id]
      );
      console.log(`📅 Auto-scheduled post #${post.id}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`⚠️ tryAutoSchedule(${post.id}) skipped:`, err.message);
    return false;
  }
}

// =====================================================
// AUTHENTICATED ENDPOINTS (require login)
// =====================================================

// Generate client approval link
router.post('/generate-client-link', async (req, res) => {
  try {
    const { customer_id, month_year, client_name, client_email } = req.body;

    if (!customer_id || !month_year) {
      return res.status(400).json({ error: 'customer_id and month_year are required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiration

    await req.pool.query(`
      INSERT INTO client_approval_tokens (customer_id, month_year, token, client_name, client_email, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (customer_id, month_year) WHERE content_calendar_id IS NULL DO UPDATE SET
        token = $3, client_name = $4, client_email = $5, created_by = $6, expires_at = $7, created_at = NOW()
      RETURNING *
    `, [customer_id, month_year, token, client_name || null, client_email || null, req.user.id, expiresAt]);

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const approvalUrl = `${baseUrl}/client-approval/${token}`;

    console.log(`🔗 Client approval link generated for customer ${customer_id}, month ${month_year}`);
    res.json({ success: true, url: approvalUrl, token, expires_at: expiresAt });
  } catch (error) {
    console.error('Error generating client link:', error);
    res.status(500).json({ error: 'Failed to generate client link' });
  }
});

// Generate a client approval link for a SINGLE post (per-post sign-off).
// Body: { content_calendar_id, client_name?, client_email? }
router.post('/generate-post-link', async (req, res) => {
  try {
    const { content_calendar_id, client_name, client_email } = req.body;
    if (!content_calendar_id) {
      return res.status(400).json({ error: 'content_calendar_id is required' });
    }

    const postRes = await req.pool.query(
      'SELECT id, customer_id, month_year FROM content_calendar WHERE id = $1',
      [content_calendar_id]
    );
    if (!postRes.rows.length) return res.status(404).json({ error: 'Post no encontrado' });
    const post = postRes.rows[0];

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Manual upsert on content_calendar_id (one live token per post).
    const existing = await req.pool.query(
      'SELECT id FROM client_approval_tokens WHERE content_calendar_id = $1',
      [content_calendar_id]
    );
    if (existing.rows.length) {
      await req.pool.query(
        `UPDATE client_approval_tokens SET token = $1, client_name = $2, client_email = $3,
           created_by = $4, expires_at = $5, created_at = NOW(), month_year = $6, customer_id = $7
         WHERE id = $8`,
        [token, client_name || null, client_email || null, req.user.id, expiresAt, post.month_year, post.customer_id, existing.rows[0].id]
      );
    } else {
      await req.pool.query(
        `INSERT INTO client_approval_tokens
           (customer_id, month_year, token, client_name, client_email, created_by, expires_at, content_calendar_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [post.customer_id, post.month_year, token, client_name || null, client_email || null, req.user.id, expiresAt, content_calendar_id]
      );
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const approvalUrl = `${baseUrl}/client-approval/${token}`;
    console.log(`🔗 Per-post client link generated for post ${content_calendar_id}`);
    res.json({ success: true, url: approvalUrl, token, expires_at: expiresAt });
  } catch (error) {
    console.error('Error generating per-post client link:', error);
    res.status(500).json({ error: 'No se pudo generar el enlace del cliente' });
  }
});

// Get approval queue (posts pending review)
router.get('/queue', async (req, res) => {
  try {
    const { status, approver_id } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT
        cc.id,
        cc.customer_id,
        c.business_name as customer_name,
        cc.campaign,
        cc.platform,
        cc.content_type,
        cc.scheduled_date,
        cc.status,
        cc.approval_status,
        cc.assigned_approver,
        cc.submitted_for_review_at,
        cc.submitted_by,
        cc.current_revision,
        cc.revision_count,
        cc.rejection_reason,
        cc.arte,
        cc.arte_files,
        cc.copy_in,
        cc.copy_out,
        cc.idea_tema,
        cc.pilar,
        cc.referencia,
        cc.priority,
        cc.client_status,
        approver.name as approver_name,
        submitter.name as submitted_by_name,
        designer.name as designer_name,
        cm.name as cm_name
      FROM content_calendar cc
      LEFT JOIN customers c ON cc.customer_id = c.id
      LEFT JOIN team_members approver ON cc.assigned_approver = approver.id
      LEFT JOIN users submitter ON cc.submitted_by = submitter.id
      LEFT JOIN team_members designer ON cc.assigned_designer = designer.id
      LEFT JOIN team_members cm ON cc.assigned_community_manager = cm.id
      WHERE (cc.status = 'revision' OR cc.approval_status IN ('pending_review', 'in_review'))
    `;

    const params = [];

    if (approver_id) {
      params.push(parseInt(approver_id));
      query += ` AND cc.assigned_approver = $${params.length}`;
    }

    query += ` ORDER BY cc.scheduled_date ASC, cc.priority DESC`;

    const result = await req.pool.query(query, params);

    const stats = {
      total: result.rows.length,
      pending: result.rows.filter(r => r.approval_status === 'pending_review').length,
      in_review: result.rows.filter(r => r.approval_status === 'in_review').length,
      my_queue: result.rows.filter(r => r.assigned_approver === userId).length
    };

    res.json({ items: result.rows, stats });
  } catch (error) {
    console.error('Error fetching approval queue:', error);
    res.status(500).json({ message: 'Error fetching approval queue' });
  }
});

// Submit content for review
router.post('/submit/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { assigned_approver, notes } = req.body;
    const submittedBy = req.user.id;

    const result = await req.pool.query(`
      UPDATE content_calendar
      SET
        status = 'revision',
        approval_status = 'pending_review',
        assigned_approver = $2,
        submitted_for_review_at = CURRENT_TIMESTAMP,
        submitted_by = $3,
        internal_notes = COALESCE(internal_notes, '') || E'\n' || $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [contentId, assigned_approver, submittedBy, notes || '']);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    await req.pool.query(`
      INSERT INTO content_approvals
        (content_id, content_type, submitted_by, assigned_approver, action, feedback, revision_number)
      VALUES ($1, 'calendar_post', $2, $3, 'submitted', $4, $5)
    `, [contentId, submittedBy, assigned_approver, notes, result.rows[0].current_revision || 1]);

    if (assigned_approver) {
      const content = result.rows[0];
      // assigned_approver is a team_members.id → resolve to the approver's login.
      const [approverUserId] = await resolveNotifyUserIds(req.pool, { memberIds: [assigned_approver] });
      if (approverUserId) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'approval_needed', $2, '/approvals', $3, 'content')
        `, [approverUserId, `📋 Contenido pendiente de aprobacion: "${content.campaign || 'Post'}"`, contentId]);
      }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(500).json({ message: 'Error submitting for review' });
  }
});

// Approve content (with auto-schedule)
router.post('/approve/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { feedback, internal_notes } = req.body;
    const approvedBy = req.user.id;

    const result = await req.pool.query(`
      UPDATE content_calendar
      SET
        status = 'aprobado',
        approval_status = 'approved',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = $2,
        client_approved = true,
        client_feedback = COALESCE(client_feedback, '') || CASE WHEN $3 != '' THEN E'\n[Aprobacion] ' || $3 ELSE '' END,
        internal_notes = COALESCE(internal_notes, '') || CASE WHEN $4 != '' THEN E'\n' || $4 ELSE '' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [contentId, approvedBy, feedback || '', internal_notes || '']);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    await req.pool.query(`
      INSERT INTO content_approvals
        (content_id, content_type, decision_by, decision_at, action, feedback, internal_notes, revision_number)
      VALUES ($1, 'calendar_post', $2, CURRENT_TIMESTAMP, 'approved', $3, $4, $5)
    `, [contentId, approvedBy, feedback, internal_notes, result.rows[0].current_revision || 1]);

    // Notify team. assigned_* are team_members.id → users.id; submitted_by and
    // approvedBy are already users.id, so the self-skip is now a like-for-like compare.
    const content = result.rows[0];
    const notifyUserIds = await resolveNotifyUserIds(req.pool, {
      memberIds: [content.assigned_designer, content.assigned_community_manager],
      userIds: [content.submitted_by],
    });
    for (const userId of notifyUserIds) {
      if (userId !== approvedBy) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'content_approved', $2, '/content-calendar', $3, 'content')
        `, [userId, `✅ Contenido aprobado! "${content.campaign || 'Post'}" esta listo para publicar`, contentId]);
      }
    }

    // Keep the pipeline in sync: internal approval completes the
    // internal_approval stage and flows work to the next stage.
    await setStageStatus(req.pool, contentId, 'internal_approval', 'listo');
    await advanceAfter(req.pool, contentId, 'internal_approval');

    // Auto-schedule if client also approved (or if no client review needed)
    let autoScheduled = false;
    if (content.client_status === 'approved' || !content.client_status) {
      autoScheduled = await tryAutoSchedule(req.pool, content, publicBase(req));
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: '✅ Contenido aprobado',
      auto_scheduled: autoScheduled
    });
  } catch (error) {
    console.error('Error approving content:', error);
    res.status(500).json({ message: 'Error approving content' });
  }
});

// Reject content (request revision)
router.post('/reject/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { reason, feedback, send_back_to } = req.body;
    const rejectedBy = req.user.id;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const result = await req.pool.query(`
      UPDATE content_calendar
      SET
        status = CASE WHEN $5 IS NOT NULL THEN 'en_diseño' ELSE 'planificado' END,
        approval_status = 'revision_requested',
        rejected_at = CURRENT_TIMESTAMP,
        rejected_by = $2,
        rejection_reason = $3,
        client_approved = false,
        client_feedback = COALESCE(client_feedback, '') || E'\n[Revision Solicitada] ' || $3,
        revision_count = COALESCE(revision_count, 0) + 1,
        current_revision = COALESCE(current_revision, 1) + 1,
        assigned_designer = COALESCE($5, assigned_designer),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [contentId, rejectedBy, reason, feedback || '', send_back_to]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    await req.pool.query(`
      INSERT INTO content_approvals
        (content_id, content_type, decision_by, decision_at, action, feedback, internal_notes, revision_number)
      VALUES ($1, 'calendar_post', $2, CURRENT_TIMESTAMP, 'rejected', $3, $4, $5)
    `, [contentId, rejectedBy, reason, feedback, result.rows[0].current_revision || 1]);

    // Reflect the rejection on the pipeline stage.
    await setStageStatus(req.pool, contentId, 'internal_approval', 'cambios');

    // send_back_to + assigned_* are team_members.id → users.id; submitted_by and
    // rejectedBy are users.id. Link points at the real route (/content-calendar),
    // not the dead /employee-dashboard.
    const content = result.rows[0];
    const notifyUserIds = await resolveNotifyUserIds(req.pool, {
      memberIds: [send_back_to, content.assigned_designer, content.assigned_community_manager],
      userIds: [content.submitted_by],
    });
    for (const userId of notifyUserIds) {
      if (userId !== rejectedBy) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'revision_requested', $2, '/content-calendar', $3, 'content')
        `, [userId, `↩️ Correcciones solicitadas: "${content.campaign || 'Post'}" - ${reason.substring(0, 50)}...`, contentId]);
      }
    }

    res.json({ success: true, data: result.rows[0], message: '↩️ Contenido enviado para revision' });
  } catch (error) {
    console.error('Error rejecting content:', error);
    res.status(500).json({ message: 'Error rejecting content' });
  }
});

// Reassign approver
router.post('/reassign/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { new_approver_id, notes } = req.body;
    const reassignedBy = req.user.id;

    const result = await req.pool.query(`
      UPDATE content_calendar
      SET
        assigned_approver = $2,
        internal_notes = COALESCE(internal_notes, '') || E'\n[Reasignado] ' || $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [contentId, new_approver_id, notes || '']);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }

    await req.pool.query(`
      INSERT INTO content_approvals
        (content_id, content_type, decision_by, decision_at, assigned_approver, action, feedback)
      VALUES ($1, 'calendar_post', $2, CURRENT_TIMESTAMP, $3, 'reassigned', $4)
    `, [contentId, reassignedBy, new_approver_id, notes]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error reassigning approver:', error);
    res.status(500).json({ message: 'Error reassigning approver' });
  }
});

// Get approval history for a content item
router.get('/history/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;

    const result = await req.pool.query(`
      SELECT
        ca.*,
        submitter.name as submitted_by_name,
        decider.name as decision_by_name,
        approver.name as approver_name
      FROM content_approvals ca
      LEFT JOIN users submitter ON ca.submitted_by = submitter.id
      LEFT JOIN users decider ON ca.decision_by = decider.id
      LEFT JOIN team_members approver ON ca.assigned_approver = approver.id
      WHERE ca.content_id = $1 AND ca.content_type = 'calendar_post'
      ORDER BY ca.created_at DESC
    `, [contentId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ message: 'Error fetching approval history' });
  }
});

// Get users who can approve
router.get('/approvers', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT
        e.id, e.name, e.role, e.department, e.email,
        ap.approval_role, ap.approval_level
      FROM team_members e
      LEFT JOIN approval_permissions ap ON e.id = ap.user_id AND ap.is_active = true
      WHERE e.is_active = true
        AND (
          e.role IN ('manager', 'director', 'admin', 'lead', 'supervisor', 'jefe')
          OR ap.can_approve_all = true
          OR ap.can_approve_own_team = true
        )
      ORDER BY ap.approval_level ASC NULLS LAST, e.name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approvers:', error);
    try {
      const fallback = await req.pool.query(
        'SELECT id, name, role, department, email FROM team_members WHERE is_active = true ORDER BY name ASC'
      );
      res.json(fallback.rows);
    } catch (e) {
      res.status(500).json({ message: 'Error fetching approvers' });
    }
  }
});

// Get approval stats for dashboard
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await req.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'revision' OR approval_status = 'pending_review') as pending_review,
        COUNT(*) FILTER (WHERE approval_status = 'approved' AND approved_at > CURRENT_DATE - INTERVAL '7 days') as approved_this_week,
        COUNT(*) FILTER (WHERE approval_status = 'revision_requested' AND rejected_at > CURRENT_DATE - INTERVAL '7 days') as revisions_this_week,
        COUNT(*) FILTER (WHERE assigned_approver = $1 AND (status = 'revision' OR approval_status = 'pending_review')) as my_pending
      FROM content_calendar
    `, [userId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({ message: 'Error fetching approval stats' });
  }
});

module.exports = router;
