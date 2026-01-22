const express = require('express');
const router = express.Router();

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
        cc.copy_in,
        cc.copy_out,
        cc.idea_tema,
        cc.pilar,
        cc.referencia,
        cc.priority,
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
    
    // Filter by assigned approver
    if (approver_id) {
      params.push(parseInt(approver_id));
      query += ` AND cc.assigned_approver = $${params.length}`;
    }
    
    query += ` ORDER BY cc.scheduled_date ASC, cc.priority DESC`;
    
    const result = await req.pool.query(query, params);
    
    // Get stats
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
    
    // Update content calendar
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
    
    // Log approval action
    await req.pool.query(`
      INSERT INTO content_approvals 
        (content_id, content_type, submitted_by, assigned_approver, action, feedback, revision_number)
      VALUES ($1, 'calendar_post', $2, $3, 'submitted', $4, $5)
    `, [contentId, submittedBy, assigned_approver, notes, result.rows[0].current_revision || 1]);
    
    // Send notification to assigned approver
    if (assigned_approver) {
      const content = result.rows[0];
      await req.pool.query(`
        INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
        VALUES ($1, 'approval_needed', $2, '/team-dashboard', $3, 'content')
      `, [assigned_approver, `📋 Contenido pendiente de aprobación: "${content.campaign || 'Post'}"`, contentId]);
      console.log(`🔔 Notification sent to approver ${assigned_approver}`);
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(500).json({ message: 'Error submitting for review' });
  }
});

// Approve content
router.post('/approve/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { feedback, internal_notes } = req.body;
    const approvedBy = req.user.id;
    
    // Update content calendar
    const result = await req.pool.query(`
      UPDATE content_calendar 
      SET 
        status = 'aprobado',
        approval_status = 'approved',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = $2,
        client_approved = true,
        client_feedback = COALESCE(client_feedback, '') || CASE WHEN $3 != '' THEN E'\n[Aprobación] ' || $3 ELSE '' END,
        internal_notes = COALESCE(internal_notes, '') || CASE WHEN $4 != '' THEN E'\n' || $4 ELSE '' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [contentId, approvedBy, feedback || '', internal_notes || '']);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    
    // Log approval action
    await req.pool.query(`
      INSERT INTO content_approvals 
        (content_id, content_type, decision_by, decision_at, action, feedback, internal_notes, revision_number)
      VALUES ($1, 'calendar_post', $2, CURRENT_TIMESTAMP, 'approved', $3, $4, $5)
    `, [contentId, approvedBy, feedback, internal_notes, result.rows[0].current_revision || 1]);
    
    // Notify designer and CM that content was approved
    const content = result.rows[0];
    const usersToNotify = [content.assigned_designer, content.assigned_community_manager, content.submitted_by].filter(Boolean);
    for (const userId of [...new Set(usersToNotify)]) {
      if (userId !== approvedBy) {
        await req.pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, 'content_approved', $2, '/content-calendar', $3, 'content')
        `, [userId, `✅ ¡Contenido aprobado! "${content.campaign || 'Post'}" está listo para publicar`, contentId]);
      }
    }
    console.log(`🔔 Approval notifications sent to ${usersToNotify.length} users`);
    
    res.json({ success: true, data: result.rows[0], message: '✅ Contenido aprobado' });
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
    
    // Update content calendar
    const result = await req.pool.query(`
      UPDATE content_calendar 
      SET 
        status = CASE WHEN $5 IS NOT NULL THEN 'en_diseño' ELSE 'planificado' END,
        approval_status = 'revision_requested',
        rejected_at = CURRENT_TIMESTAMP,
        rejected_by = $2,
        rejection_reason = $3,
        client_approved = false,
        client_feedback = COALESCE(client_feedback, '') || E'\n[Revisión Solicitada] ' || $3,
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
    
    // Log rejection action
    await req.pool.query(`
      INSERT INTO content_approvals 
        (content_id, content_type, decision_by, decision_at, action, feedback, internal_notes, revision_number)
      VALUES ($1, 'calendar_post', $2, CURRENT_TIMESTAMP, 'rejected', $3, $4, $5)
    `, [contentId, rejectedBy, reason, feedback, result.rows[0].current_revision || 1]);
    
    // Notify designer/CM that revision is needed
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
    console.log(`🔔 Revision notifications sent to ${usersToNotify.length} users`);
    
    res.json({ 
      success: true, 
      data: result.rows[0], 
      message: '↩️ Contenido enviado para revisión' 
    });
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
    
    // Log reassignment
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

// Get users who can approve (for dropdown)
router.get('/approvers', async (req, res) => {
  try {
    // Get employees who can approve (managers, directors, admins, or those with approval permissions)
    const result = await req.pool.query(`
      SELECT 
        e.id,
        e.name,
        e.role,
        e.department,
        e.email,
        ap.approval_role,
        ap.approval_level
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
    // Fallback: return all active employees as potential approvers
    try {
      const fallback = await req.pool.query(`
        SELECT id, name, role, department, email
        FROM employees
        WHERE is_active = true
        ORDER BY name ASC
      `);
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

