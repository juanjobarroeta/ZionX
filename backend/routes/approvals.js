const express = require('express');
const crypto = require('crypto');
const router = express.Router();

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

    // Fetch posts ready for client review
    const posts = await req.pool.query(`
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

    // If internally approved too, auto-schedule the post
    const post = validation.post;
    let autoScheduled = false;
    if (post.approval_status === 'approved' || post.status === 'aprobado') {
      autoScheduled = await tryAutoSchedule(req.pool, post);
    }

    // Notify internal team
    const usersToNotify = [post.assigned_designer, post.assigned_community_manager, post.assigned_approver, post.submitted_by].filter(Boolean);
    for (const userId of [...new Set(usersToNotify)]) {
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

    // Notify internal team
    const post = validation.post;
    const usersToNotify = [post.assigned_designer, post.assigned_community_manager, post.assigned_approver, post.submitted_by].filter(Boolean);
    for (const userId of [...new Set(usersToNotify)]) {
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

  const postResult = await pool.query(
    `SELECT * FROM content_calendar WHERE id = $1 AND customer_id = $2 AND month_year = $3`,
    [postId, tokenData.customer_id, tokenData.month_year]
  );
  if (!postResult.rows.length) return { error: 'Post no encontrado', status: 404 };

  return { post: postResult.rows[0] };
}

// Helper: auto-schedule a post after approval
async function tryAutoSchedule(pool, post) {
  if (!post.scheduled_date) return false;
  const message = post.copy_out || post.copy_in;
  if (!message) return false;

  // Find matching social account for this customer + platform
  const accountResult = await pool.query(
    `SELECT id FROM social_accounts
     WHERE customer_id = $1 AND platform = $2 AND is_active = true
     LIMIT 1`,
    [post.customer_id, post.platform]
  );

  if (!accountResult.rows.length) return false;

  const accountId = accountResult.rows[0].id;

  // Check for duplicate
  const existing = await pool.query(
    `SELECT id FROM scheduled_posts
     WHERE social_account_id = $1 AND scheduled_for::date = $2::date AND status != 'cancelled'
       AND message = $3`,
    [accountId, post.scheduled_date, message]
  );
  if (existing.rows.length > 0) return false;

  const mediaUrls = [];
  if (post.arte) mediaUrls.push(post.arte);

  await pool.query(`
    INSERT INTO scheduled_posts (
      social_account_id, customer_id, content_type, message,
      media_urls, scheduled_for, status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
  `, [
    accountId, post.customer_id,
    post.content_type || post.formato || 'post',
    message, mediaUrls.length > 0 ? mediaUrls : null,
    post.scheduled_date
  ]);

  await pool.query(
    "UPDATE content_calendar SET status = 'programado', updated_at = NOW() WHERE id = $1",
    [post.id]
  );

  console.log(`📅 Auto-scheduled post #${post.id} for ${post.scheduled_date}`);
  return true;
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
      ON CONFLICT (customer_id, month_year) DO UPDATE SET
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
      LEFT JOIN employees approver ON cc.assigned_approver = approver.id
      LEFT JOIN employees submitter ON cc.submitted_by = submitter.id
      LEFT JOIN employees designer ON cc.assigned_designer = designer.id
      LEFT JOIN employees cm ON cc.assigned_community_manager = cm.id
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
      await req.pool.query(`
        INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
        VALUES ($1, 'approval_needed', $2, '/team-dashboard', $3, 'content')
      `, [assigned_approver, `📋 Contenido pendiente de aprobacion: "${content.campaign || 'Post'}"`, contentId]);
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

    // Notify team
    const content = result.rows[0];
    const usersToNotify = [content.assigned_designer, content.assigned_community_manager, content.submitted_by].filter(Boolean);
    for (const userId of [...new Set(usersToNotify)]) {
      if (userId !== approvedBy) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'content_approved', $2, '/content-calendar', $3, 'content')
        `, [userId, `✅ Contenido aprobado! "${content.campaign || 'Post'}" esta listo para publicar`, contentId]);
      }
    }

    // Auto-schedule if client also approved (or if no client review needed)
    let autoScheduled = false;
    if (content.client_status === 'approved' || !content.client_status) {
      autoScheduled = await tryAutoSchedule(req.pool, content);
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

    const content = result.rows[0];
    const usersToNotify = [send_back_to, content.assigned_designer, content.assigned_community_manager, content.submitted_by].filter(Boolean);
    for (const userId of [...new Set(usersToNotify)]) {
      if (userId !== rejectedBy) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'revision_requested', $2, '/employee-dashboard', $3, 'content')
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
      LEFT JOIN employees submitter ON ca.submitted_by = submitter.id
      LEFT JOIN employees decider ON ca.decision_by = decider.id
      LEFT JOIN employees approver ON ca.assigned_approver = approver.id
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
      FROM employees e
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
        'SELECT id, name, role, department, email FROM employees WHERE is_active = true ORDER BY name ASC'
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
