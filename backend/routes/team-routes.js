const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Multer setup for task file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// =====================================================
// TEAM CONTENT TASKS
// =====================================================

router.get("/api/team/content-tasks", async (req, res) => {
  try {
    const { status, assigned_to, days = 30 } = req.query;
    const pool = req.pool;
    const daysInt = parseInt(days) || 30;

    let query = `
      SELECT
        cc.id,
        cc.customer_id,
        c.business_name as customer_name,
        cc.post_number,
        cc.month_year,
        cc.campaign,
        cc.platform,
        cc.pilar,
        cc.content_type,
        cc.scheduled_date,
        cc.status,
        cc.idea_tema,
        cc.copy_in,
        cc.copy_out,
        cc.arte,
        cc.assigned_designer,
        cc.assigned_community_manager,
        cc.priority,
        cc.created_at,
        cc.updated_at,
        designer.name as designer_name,
        cm.name as cm_name
      FROM content_calendar cc
      LEFT JOIN customers c ON cc.customer_id = c.id
      LEFT JOIN employees designer ON cc.assigned_designer = designer.id
      LEFT JOIN employees cm ON cc.assigned_community_manager = cm.id
      WHERE cc.scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
        AND cc.scheduled_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
    `;

    const params = [daysInt];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND cc.status = $${params.length}`;
    }

    if (assigned_to) {
      params.push(parseInt(assigned_to));
      query += ` AND (cc.assigned_designer = $${params.length} OR cc.assigned_community_manager = $${params.length})`;
    }

    query += ` ORDER BY cc.scheduled_date ASC, cc.priority DESC`;

    const result = await pool.query(query, params);

    // Group by status for dashboard
    const tasks = result.rows;
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'planificado' || t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'en_diseño' || t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'revision' || t.status === 'aprobado').length,
      completed: tasks.filter(t => t.status === 'publicado' || t.status === 'completed').length,
      overdue: tasks.filter(t => new Date(t.scheduled_date) < new Date() && t.status !== 'publicado').length
    };

    res.json({ tasks, stats });
  } catch (error) {
    console.error("Error fetching team content tasks:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Get team workload summary
router.get("/api/team/workload", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT
        e.id,
        e.name,
        e.role,
        e.department,
        COUNT(CASE WHEN cc.assigned_designer = e.id THEN 1 END) as design_tasks,
        COUNT(CASE WHEN cc.assigned_community_manager = e.id THEN 1 END) as cm_tasks,
        COUNT(CASE WHEN (cc.assigned_designer = e.id OR cc.assigned_community_manager = e.id)
              AND cc.status NOT IN ('publicado', 'completed') THEN 1 END) as active_tasks,
        COUNT(CASE WHEN (cc.assigned_designer = e.id OR cc.assigned_community_manager = e.id)
              AND cc.status IN ('publicado', 'completed') THEN 1 END) as completed_tasks
      FROM employees e
      LEFT JOIN content_calendar cc ON (cc.assigned_designer = e.id OR cc.assigned_community_manager = e.id)
        AND cc.scheduled_date >= CURRENT_DATE - INTERVAL '30 days'
      WHERE e.is_active = true
      GROUP BY e.id, e.name, e.role, e.department
      ORDER BY active_tasks DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching team workload:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// =====================================================
// PROJECTS
// =====================================================

router.get("/projects", async (req, res) => {
  try {
    const pool = req.pool;
    const { customer_id, status, page = 1, limit = 20 } = req.query;

    let whereClause = '';
    const queryParams = [];
    let paramCount = 0;

    if (customer_id) {
      whereClause += ` AND p.customer_id = $${++paramCount}`;
      queryParams.push(customer_id);
    }

    if (status && status !== 'all') {
      whereClause += ` AND p.status = $${++paramCount}`;
      queryParams.push(status);
    }

    const offset = (page - 1) * limit;
    const query = `
      SELECT
        p.*,
        COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Customer') as customer_name,
        COALESCE(tm.name, 'Unassigned') as project_manager_name,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        CASE
          WHEN COUNT(t.id) > 0 THEN ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0) / COUNT(t.id), 2)
          ELSE 0
        END as completion_percentage
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN team_members tm ON p.project_manager_id = tm.id
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE 1=1 ${whereClause}
      GROUP BY p.id, c.first_name, c.last_name, tm.name
      ORDER BY p.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);
    const result = await pool.query(query, queryParams);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get("/projects/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    const projectQuery = `
      SELECT
        p.*,
        COALESCE(c.first_name || ' ' || c.last_name, 'Unknown Customer') as customer_name,
        COALESCE(c.email, '') as customer_email,
        COALESCE(tm.name, 'Unassigned') as project_manager_name
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN team_members tm ON p.project_manager_id = tm.id
      WHERE p.id = $1
    `;

    const tasksQuery = `
      SELECT
        t.*,
        COALESCE(tm.name, 'Unassigned') as assignee_name
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_type = 'primary'
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id
      WHERE t.project_id = $1
      ORDER BY t.created_at
    `;

    const stagesQuery = `
      SELECT * FROM project_stages
      WHERE project_id = $1
      ORDER BY stage_order
    `;

    const activityQuery = `
      SELECT
        pa.*,
        COALESCE(tm.name, 'System') as user_name
      FROM project_activities pa
      LEFT JOIN team_members tm ON pa.user_id = tm.id
      WHERE pa.project_id = $1
      ORDER BY pa.created_at DESC
      LIMIT 20
    `;

    const [projectResult, tasksResult, stagesResult, activityResult] = await Promise.all([
      pool.query(projectQuery, [id]),
      pool.query(tasksQuery, [id]),
      pool.query(stagesQuery, [id]),
      pool.query(activityQuery, [id])
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: projectResult.rows[0],
      tasks: tasksResult.rows,
      stages: stagesResult.rows,
      recent_activity: activityResult.rows
    });

  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Create new project
router.post("/projects", async (req, res) => {
  try {
    const pool = req.pool;
    const {
      name,
      description,
      customer_id,
      project_manager_id,
      start_date,
      due_date,
      budget,
      project_type,
      priority = 'medium'
    } = req.body;

    const query = `
      INSERT INTO projects (
        name, description, customer_id, project_manager_id,
        start_date, due_date, budget, project_type, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name, description, customer_id, project_manager_id,
      start_date, due_date, budget, project_type, priority
    ]);

    const project = result.rows[0];

    // Log activity
    const activityQuery = `
      INSERT INTO project_activities (project_id, user_id, activity_type, description)
      VALUES ($1, $2, 'created', 'Project created')
    `;
    await pool.query(activityQuery, [project.id, project_manager_id || 1]);

    res.status(201).json({ project, message: 'Project created successfully' });

  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// =====================================================
// TEAM MEMBERS
// =====================================================

// Get team members
router.get("/team-members", async (req, res) => {
  try {
    const pool = req.pool;
    const query = `
      SELECT
        tm.*,
        COUNT(ta.id) as active_assignments,
        COALESCE(SUM(t.estimated_hours), 0) as estimated_workload
      FROM team_members tm
      LEFT JOIN task_assignments ta ON tm.id = ta.assignee_id
      LEFT JOIN tasks t ON ta.task_id = t.id AND t.status IN ('todo', 'in_progress')
      WHERE tm.is_active = true
      GROUP BY tm.id
      ORDER BY tm.name
    `;

    const result = await pool.query(query);
    res.json({ team_members: result.rows });

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Create team member
router.post("/team-members", async (req, res) => {
  try {
    const pool = req.pool;
    const { name, email, role, skills, monthly_wage, max_daily_tasks, phone, status } = req.body;

    const result = await pool.query(`
      INSERT INTO team_members (name, email, role, department, skills, monthly_wage, max_daily_tasks, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, email, role, 'Marketing', skills, monthly_wage, max_daily_tasks, phone, status === 'active']);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

// Update team member
router.put("/team-members/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { name, email, role, skills, monthly_wage, max_daily_tasks, phone, status } = req.body;

    const result = await pool.query(`
      UPDATE team_members
      SET name = $1, email = $2, role = $3, skills = $4, monthly_wage = $5,
          max_daily_tasks = $6, phone = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, email, role, skills, monthly_wage, max_daily_tasks, phone, status === 'active', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Delete team member (soft delete)
router.delete("/team-members/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE team_members
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json({ success: true, message: 'Team member deactivated' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

// =====================================================
// TASK MANAGEMENT
// =====================================================

// Create task
router.post("/tasks", async (req, res) => {
  try {
    const pool = req.pool;
    const {
      title, description, assigned_to, customer_id, post_id, post_number,
      due_date, task_type, priority, required_files, content_details
    } = req.body;

    // Map to actual table columns
    const result = await pool.query(`
      INSERT INTO tasks (
        title, description, due_date, task_type, priority,
        custom_fields, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'todo', $7)
      RETURNING *
    `, [
      title,
      description,
      due_date,
      task_type,
      priority,
      JSON.stringify({
        assigned_to,
        customer_id,
        post_id,
        post_number,
        required_files,
        content_details
      }),
      assigned_to
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get tasks for team member
router.get("/team-members/:id/tasks", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { status } = req.query;

    let query = `
      SELECT t.*,
             (t.custom_fields->>'customer_id')::int as customer_id,
             (t.custom_fields->>'assigned_to')::int as assigned_to,
             (t.custom_fields->>'post_number')::int as post_number,
             t.custom_fields->>'required_files' as required_files,
             t.custom_fields->>'content_details' as content_details
      FROM tasks t
      WHERE (t.custom_fields->>'assigned_to')::int = $1
    `;

    const params = [id];

    if (status && status !== 'all') {
      query += ` AND t.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY t.due_date ASC, t.created_at DESC`;

    const result = await pool.query(query, params);

    // Parse JSON fields and add customer name
    const tasksWithDetails = await Promise.all(result.rows.map(async (task) => {
      let customerName = 'Cliente';
      if (task.customer_id) {
        try {
          const customerResult = await pool.query('SELECT business_name FROM customers WHERE id = $1', [task.customer_id]);
          customerName = customerResult.rows[0]?.business_name || 'Cliente';
        } catch (err) {
          console.error('Error fetching customer name:', err);
        }
      }

      return {
        ...task,
        customer_name: customerName,
        required_files: task.required_files ? JSON.parse(task.required_files) : [],
        content_details: task.content_details ? JSON.parse(task.content_details) : {}
      };
    }));

    res.json(tasksWithDetails);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get all tasks for a specific post
router.get("/tasks/by-post/:customer_id/:post_number", async (req, res) => {
  try {
    const pool = req.pool;
    const { customer_id, post_number } = req.params;

    const result = await pool.query(`
      SELECT
        t.*,
        tm.name as assigned_to_name
      FROM tasks t
      LEFT JOIN team_members tm ON (t.custom_fields->>'assigned_to')::int = tm.id
      WHERE
        (t.custom_fields->>'customer_id')::int = $1
        AND (t.custom_fields->>'post_number')::int = $2
      ORDER BY t.created_at
    `, [customer_id, post_number]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks by post:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Update task status
router.put("/tasks/:id/status", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { status } = req.body;

    // Get old task info first for notifications
    const oldTaskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    const oldTask = oldTaskResult.rows[0];
    const oldStatus = oldTask?.status;

    const result = await pool.query(`
      UPDATE tasks
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = result.rows[0];

    // ==========================================
    // SEND NOTIFICATIONS ON STATUS CHANGES
    // ==========================================
    try {
      const assignedTo = updatedTask.assigned_to || updatedTask.custom_fields?.assigned_to;
      const taskTitle = updatedTask.title || 'Tarea';

      // Notification messages based on status transition
      const notificationMessages = {
        'in_progress': {
          message: `🔄 Tarea iniciada: "${taskTitle}"`,
          type: 'task_started'
        },
        'review': {
          message: `👀 Tarea enviada a revisión: "${taskTitle}"`,
          type: 'task_review'
        },
        'completed': {
          message: `✅ Tarea completada: "${taskTitle}"`,
          type: 'task_completed'
        },
        'revision_requested': {
          message: `↩️ Correcciones solicitadas: "${taskTitle}"`,
          type: 'task_revision'
        }
      };

      if (notificationMessages[status] && assignedTo) {
        // Notify the assigned user
        await pool.query(`
          INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
          VALUES ($1, $2, $3, $4, $5, 'task')
        `, [assignedTo, notificationMessages[status].type, notificationMessages[status].message, '/employee-dashboard', id]);
        console.log(`🔔 Notification sent to user ${assignedTo}: ${notificationMessages[status].message}`);
      }

      // If sent to review, notify managers/approvers
      if (status === 'review') {
        // Get all users who can approve (managers, leads, admins)
        const approversResult = await pool.query(`
          SELECT id FROM employees
          WHERE is_active = true
            AND role IN ('manager', 'director', 'admin', 'lead', 'supervisor', 'jefe')
          LIMIT 5
        `);

        for (const approver of approversResult.rows) {
          if (approver.id !== assignedTo) {
            await pool.query(`
              INSERT INTO notifications (user_id, type, message, link, item_id, item_type)
              VALUES ($1, 'approval_needed', $2, '/team-dashboard', $3, 'task')
            `, [approver.id, `📋 Nueva tarea para revisar: "${taskTitle}"`, id]);
          }
        }
        console.log(`🔔 Notified ${approversResult.rows.length} approvers about new review`);
      }

    } catch (notifError) {
      console.error('⚠️ Error sending notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    // Update content calendar status based on task progress
    const customerId = updatedTask.customer_id || updatedTask.custom_fields?.customer_id;
    const postNumber = updatedTask.post_number || updatedTask.custom_fields?.post_number;

    if (customerId && postNumber) {
      try {
        // Get all tasks for this post to determine overall status
        const allTasks = await pool.query(`
          SELECT status FROM tasks
          WHERE (customer_id = $1 OR (custom_fields->>'customer_id')::int = $1)
            AND (post_number = $2 OR (custom_fields->>'post_number')::int = $2)
        `, [customerId, postNumber]);

        const taskStatuses = allTasks.rows.map(t => t.status);
        const allCompleted = taskStatuses.every(s => s === 'completed');
        const allInReview = taskStatuses.every(s => s === 'review' || s === 'completed');
        const anyInProgress = taskStatuses.some(s => s === 'in_progress' || s === 'review' || s === 'completed');

        // Determine calendar status
        let calendarStatus = 'planificado';
        if (allCompleted) {
          calendarStatus = 'aprobado';
        } else if (allInReview) {
          calendarStatus = 'revision';
        } else if (anyInProgress) {
          calendarStatus = 'en_diseño';
        }

        // Update content calendar status
        const monthYear = updatedTask.due_date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
        await pool.query(`
          UPDATE content_calendar
          SET status = $1
          WHERE customer_id = $2 AND post_number = $3 AND month_year = $4
        `, [calendarStatus, customerId, postNumber, monthYear]);

        console.log(`✅ Updated calendar status to "${calendarStatus}" for customer ${customerId}, post ${postNumber}`);
      } catch (calendarError) {
        console.error('⚠️ Error updating calendar status:', calendarError);
        // Don't fail the request if calendar update fails
      }
    }

    res.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Upload files for task
router.post("/tasks/:id/upload", upload.single('file'), async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { customer_id, post_number } = req.body;

    console.log('📤 Upload request for task:', id);
    console.log('📤 Customer ID:', customer_id, 'Post Number:', post_number);
    console.log('📤 File received:', req.file ? req.file.originalname : 'No file');

    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file_url = `/uploads/${req.file.filename}`;

    // Get current task to update custom_fields
    const taskResult = await pool.query('SELECT custom_fields FROM tasks WHERE id = $1', [id]);
    if (taskResult.rows.length === 0) {
      console.error('❌ Task not found:', id);
      return res.status(404).json({ error: 'Task not found' });
    }

    const customFields = taskResult.rows[0].custom_fields || {};
    customFields.deliverable_file = file_url;
    customFields.deliverable_file_name = req.file.originalname;

    // Store the file reference with the task
    await pool.query(`
      UPDATE tasks
      SET custom_fields = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(customFields), id]);

    console.log('✅ Task updated with file:', file_url);

    // Also update the content_calendar arte field for this post
    if (customer_id && post_number) {
      const calendarUpdate = await pool.query(`
        UPDATE content_calendar
        SET arte = $1
        WHERE customer_id = $2 AND post_number = $3
        RETURNING id
      `, [file_url, customer_id, post_number]);

      console.log('✅ Content calendar updated:', calendarUpdate.rows.length > 0 ? 'Success' : 'No rows updated');
    }

    res.json({
      success: true,
      file_url,
      file_name: req.file.originalname
    });
  } catch (error) {
    console.error('❌ Error uploading task file:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

// =====================================================
// FOLLOW-UPS
// =====================================================

router.get("/follow-ups", async (req, res) => {
  try {
    const pool = req.pool;
    const { assignee_id, status = 'pending', limit = 50 } = req.query;

    const query = `
      SELECT
        f.*,
        COALESCE(p.name, 'Unknown Project') as project_name,
        COALESCE(t.title, 'General Follow-up') as task_title
      FROM follow_ups f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN tasks t ON f.task_id = t.id
      WHERE f.status = $1
      ORDER BY f.scheduled_for ASC
      LIMIT $2
    `;

    const result = await pool.query(query, [status, limit]);
    res.json({ follow_ups: result.rows });

  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

module.exports = router;
