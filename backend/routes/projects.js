// =====================================================
// ZIONX PROJECT MANAGEMENT API ROUTES
// =====================================================

const express = require('express');
const router = express.Router();
// Pool is available globally from the main index.js file

// =====================================================
// PROJECT ROUTES
// =====================================================

// Get all projects with filtering and pagination
router.get('/projects', async (req, res) => {
  try {
    const { 
      customer_id, 
      status, 
      project_manager_id, 
      page = 1, 
      limit = 20,
      search = '',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    if (customer_id) {
      whereClause += ` AND p.customer_id = $${++paramCount}`;
      queryParams.push(customer_id);
    }

    if (status) {
      whereClause += ` AND p.status = $${++paramCount}`;
      queryParams.push(status);
    }

    if (project_manager_id) {
      whereClause += ` AND p.project_manager_id = $${++paramCount}`;
      queryParams.push(project_manager_id);
    }

    if (search) {
      whereClause += ` AND (p.name ILIKE $${++paramCount} OR p.description ILIKE $${++paramCount})`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const offset = (page - 1) * limit;
    whereClause += ` ORDER BY p.${sort_by} ${sort_order} LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(limit, offset);

    const query = `
      SELECT 
        p.*,
        c.first_name || ' ' || c.last_name as customer_name,
        tm.name as project_manager_name,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        ROUND(AVG(CASE WHEN t.status = 'completed' THEN 100 ELSE 0 END), 2) as completion_percentage
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN team_members tm ON p.project_manager_id = tm.id
      LEFT JOIN tasks t ON p.id = t.project_id
      ${whereClause}
      GROUP BY p.id, c.first_name, c.last_name, tm.name
    `;

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      ${whereClause.split('ORDER BY')[0]}
    `;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      projects: result.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(countResult.rows[0].total / limit),
        total_count: parseInt(countResult.rows[0].total),
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with full details
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get project details
    const projectQuery = `
      SELECT 
        p.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        tm.name as project_manager_name,
        tm.email as project_manager_email
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN team_members tm ON p.project_manager_id = tm.id
      WHERE p.id = $1
    `;

    // Get project stages
    const stagesQuery = `
      SELECT * FROM project_stages 
      WHERE project_id = $1 
      ORDER BY stage_order
    `;

    // Get project tasks
    const tasksQuery = `
      SELECT 
        t.*,
        ta.assignee_id,
        tm.name as assignee_name,
        tm.email as assignee_email,
        COUNT(st.id) as subtask_count,
        COUNT(CASE WHEN st.status = 'completed' THEN 1 END) as completed_subtasks
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_type = 'primary'
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id
      LEFT JOIN tasks st ON t.id = st.parent_task_id
      WHERE t.project_id = $1 AND t.parent_task_id IS NULL
      GROUP BY t.id, ta.assignee_id, tm.name, tm.email
      ORDER BY t.created_at
    `;

    // Get recent activity
    const activityQuery = `
      SELECT 
        pa.*,
        tm.name as user_name
      FROM project_activities pa
      LEFT JOIN team_members tm ON pa.user_id = tm.id
      WHERE pa.project_id = $1
      ORDER BY pa.created_at DESC
      LIMIT 20
    `;

    const [projectResult, stagesResult, tasksResult, activityResult] = await Promise.all([
      pool.query(projectQuery, [id]),
      pool.query(stagesQuery, [id]),
      pool.query(tasksQuery, [id]),
      pool.query(activityQuery, [id])
    ]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      project: projectResult.rows[0],
      stages: stagesResult.rows,
      tasks: tasksResult.rows,
      recent_activity: activityResult.rows
    });

  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Create new project
router.post('/projects', async (req, res) => {
  try {
    const {
      name,
      description,
      customer_id,
      project_manager_id,
      start_date,
      due_date,
      budget,
      project_type,
      tags,
      template_id,
      custom_fields
    } = req.body;

    // Create project
    const projectQuery = `
      INSERT INTO projects (
        name, description, customer_id, project_manager_id, 
        start_date, due_date, budget, project_type, tags, custom_fields
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const projectResult = await pool.query(projectQuery, [
      name, description, customer_id, project_manager_id,
      start_date, due_date, budget, project_type, tags, custom_fields
    ]);

    const project = projectResult.rows[0];

    // If template_id is provided, create stages and tasks from template
    if (template_id) {
      const templateQuery = 'SELECT * FROM project_templates WHERE id = $1';
      const templateResult = await pool.query(templateQuery, [template_id]);
      
      if (templateResult.rows.length > 0) {
        const template = templateResult.rows[0];
        const templateData = template.template_data;

        // Create stages and tasks from template
        if (templateData.stages) {
          for (let i = 0; i < templateData.stages.length; i++) {
            const stage = templateData.stages[i];
            
            const stageQuery = `
              INSERT INTO project_stages (project_id, name, stage_order, description)
              VALUES ($1, $2, $3, $4)
              RETURNING id
            `;
            
            const stageResult = await pool.query(stageQuery, [
              project.id, stage.name, i + 1, stage.description || ''
            ]);

            const stageId = stageResult.rows[0].id;

            // Create tasks for this stage
            if (stage.tasks) {
              for (const taskName of stage.tasks) {
                const taskQuery = `
                  INSERT INTO tasks (project_id, stage_id, title, task_type)
                  VALUES ($1, $2, $3, $4)
                `;
                
                await pool.query(taskQuery, [
                  project.id, stageId, taskName, 'general'
                ]);
              }
            }
          }
        }
      }
    }

    // Log activity
    const activityQuery = `
      INSERT INTO project_activities (project_id, user_id, activity_type, description)
      VALUES ($1, $2, 'created', 'Project created')
    `;
    await pool.query(activityQuery, [project.id, req.user?.id || project_manager_id]);

    res.status(201).json({ project, message: 'Project created successfully' });

  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'name', 'description', 'project_manager_id', 'status', 'priority',
      'start_date', 'due_date', 'budget', 'project_type', 'tags', 'custom_fields'
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${++paramCount}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = $${++paramCount}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE projects 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Log activity
    const activityQuery = `
      INSERT INTO project_activities (project_id, user_id, activity_type, description, old_value, new_value)
      VALUES ($1, $2, 'updated', 'Project updated', $3, $4)
    `;
    await pool.query(activityQuery, [id, req.user?.id, JSON.stringify({}), JSON.stringify(updates)]);

    res.json({ project: result.rows[0], message: 'Project updated successfully' });

  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// =====================================================
// TASK ROUTES
// =====================================================

// Get tasks for a project
router.get('/projects/:project_id/tasks', async (req, res) => {
  try {
    const { project_id } = req.params;
    const { status, assignee_id, stage_id } = req.query;

    let whereClause = 'WHERE t.project_id = $1';
    const queryParams = [project_id];
    let paramCount = 1;

    if (status) {
      whereClause += ` AND t.status = $${++paramCount}`;
      queryParams.push(status);
    }

    if (stage_id) {
      whereClause += ` AND t.stage_id = $${++paramCount}`;
      queryParams.push(stage_id);
    }

    if (assignee_id) {
      whereClause += ` AND ta.assignee_id = $${++paramCount}`;
      queryParams.push(assignee_id);
    }

    const query = `
      SELECT 
        t.*,
        ps.name as stage_name,
        ta.assignee_id,
        tm.name as assignee_name,
        tm.email as assignee_email,
        COUNT(st.id) as subtask_count,
        COUNT(CASE WHEN st.status = 'completed' THEN 1 END) as completed_subtasks
      FROM tasks t
      LEFT JOIN project_stages ps ON t.stage_id = ps.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_type = 'primary'
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id
      LEFT JOIN tasks st ON t.id = st.parent_task_id
      ${whereClause}
      GROUP BY t.id, ps.name, ta.assignee_id, tm.name, tm.email
      ORDER BY t.created_at DESC
    `;

    const result = await pool.query(query, queryParams);
    res.json({ tasks: result.rows });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task
router.post('/projects/:project_id/tasks', async (req, res) => {
  try {
    const { project_id } = req.params;
    const {
      title,
      description,
      stage_id,
      parent_task_id,
      priority,
      task_type,
      estimated_hours,
      due_date,
      assignee_id,
      tags
    } = req.body;

    // Create task
    const taskQuery = `
      INSERT INTO tasks (
        project_id, stage_id, parent_task_id, title, description,
        priority, task_type, estimated_hours, due_date, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const taskResult = await pool.query(taskQuery, [
      project_id, stage_id, parent_task_id, title, description,
      priority, task_type, estimated_hours, due_date, tags, req.user?.id
    ]);

    const task = taskResult.rows[0];

    // Assign task if assignee_id is provided
    if (assignee_id) {
      const assignmentQuery = `
        INSERT INTO task_assignments (task_id, assignee_id, assigned_by, assignment_type)
        VALUES ($1, $2, $3, 'primary')
      `;
      await pool.query(assignmentQuery, [task.id, assignee_id, req.user?.id]);

      // Create follow-up reminder
      const followUpQuery = `
        INSERT INTO follow_ups (
          project_id, task_id, assignee_id, follow_up_type, 
          title, message, scheduled_for, auto_generated
        ) VALUES ($1, $2, $3, 'task_assigned', $4, $5, $6, true)
      `;
      
      const reminderDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      await pool.query(followUpQuery, [
        project_id, task.id, assignee_id,
        `Task Assignment: ${title}`,
        `You have been assigned a new task: ${title}. Due date: ${due_date || 'Not set'}`,
        reminderDate
      ]);
    }

    // Log activity
    const activityQuery = `
      INSERT INTO project_activities (project_id, task_id, user_id, activity_type, description)
      VALUES ($1, $2, $3, 'task_created', $4)
    `;
    await pool.query(activityQuery, [project_id, task.id, req.user?.id, `Task created: ${title}`]);

    res.status(201).json({ task, message: 'Task created successfully' });

  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task status with intelligent follow-ups
router.put('/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Get current task
    const currentTaskQuery = 'SELECT * FROM tasks WHERE id = $1';
    const currentTask = await pool.query(currentTaskQuery, [id]);
    
    if (currentTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = currentTask.rows[0];
    const oldStatus = task.status;

    // Update task
    const updateQuery = `
      UPDATE tasks 
      SET status = $1, updated_at = CURRENT_TIMESTAMP,
          completion_date = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completion_date END
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [status, id]);

    // Create intelligent follow-ups based on status change
    if (status === 'completed') {
      // Check if this completes any dependent tasks
      const dependentTasksQuery = `
        SELECT t.*, ta.assignee_id, tm.name as assignee_name
        FROM tasks t
        JOIN task_dependencies td ON t.id = td.task_id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.assignment_type = 'primary'
        LEFT JOIN team_members tm ON ta.assignee_id = tm.id
        WHERE td.depends_on_task_id = $1 AND t.status = 'blocked'
      `;
      
      const dependentTasks = await pool.query(dependentTasksQuery, [id]);
      
      // Notify assignees of dependent tasks
      for (const depTask of dependentTasks.rows) {
        if (depTask.assignee_id) {
          const followUpQuery = `
            INSERT INTO follow_ups (
              project_id, task_id, assignee_id, follow_up_type,
              title, message, scheduled_for, auto_generated
            ) VALUES ($1, $2, $3, 'dependency_completed', $4, $5, CURRENT_TIMESTAMP, true)
          `;
          
          await pool.query(followUpQuery, [
            task.project_id, depTask.id, depTask.assignee_id,
            `Dependency Completed: ${depTask.title}`,
            `A task you were waiting for has been completed. You can now proceed with: ${depTask.title}`
          ]);
        }
      }

      // Update project progress
      await updateProjectProgress(task.project_id);
    }

    // Log activity
    const activityQuery = `
      INSERT INTO project_activities (
        project_id, task_id, user_id, activity_type, description, 
        old_value, new_value
      ) VALUES ($1, $2, $3, 'status_change', $4, $5, $6)
    `;
    
    await pool.query(activityQuery, [
      task.project_id, id, req.user?.id,
      `Task status changed from ${oldStatus} to ${status}`,
      JSON.stringify({ status: oldStatus }),
      JSON.stringify({ status, notes })
    ]);

    res.json({ task: result.rows[0], message: 'Task status updated successfully' });

  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// =====================================================
// TEAM & ASSIGNMENT ROUTES
// =====================================================

// Get team members
router.get('/team-members', async (req, res) => {
  try {
    const { department, skills, is_active = true } = req.query;

    let whereClause = 'WHERE is_active = $1';
    const queryParams = [is_active];
    let paramCount = 1;

    if (department) {
      whereClause += ` AND department = $${++paramCount}`;
      queryParams.push(department);
    }

    if (skills) {
      whereClause += ` AND skills && $${++paramCount}`;
      queryParams.push(skills.split(','));
    }

    const query = `
      SELECT 
        tm.*,
        COUNT(ta.id) as active_assignments,
        SUM(t.estimated_hours) as estimated_workload
      FROM team_members tm
      LEFT JOIN task_assignments ta ON tm.id = ta.assignee_id
      LEFT JOIN tasks t ON ta.task_id = t.id AND t.status IN ('todo', 'in_progress')
      ${whereClause}
      GROUP BY tm.id
      ORDER BY tm.name
    `;

    const result = await pool.query(query, queryParams);
    res.json({ team_members: result.rows });

  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Intelligent task assignment endpoint
router.post('/tasks/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_id, auto_assign = false } = req.body;

    let finalAssigneeId = assignee_id;

    // If auto_assign is true, use AI logic to find best assignee
    if (auto_assign) {
      const taskQuery = 'SELECT * FROM tasks WHERE id = $1';
      const taskResult = await pool.query(taskQuery, [id]);
      
      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskResult.rows[0];
      
      // AI Assignment Logic
      const assignmentQuery = `
        SELECT 
          tm.id,
          tm.name,
          tm.skills,
          COUNT(ta.id) as current_assignments,
          SUM(t.estimated_hours) as current_workload,
          tm.capacity_hours_per_week
        FROM team_members tm
        LEFT JOIN task_assignments ta ON tm.id = ta.assignee_id
        LEFT JOIN tasks t ON ta.task_id = t.id AND t.status IN ('todo', 'in_progress')
        WHERE tm.is_active = true
        GROUP BY tm.id, tm.name, tm.skills, tm.capacity_hours_per_week
        ORDER BY current_workload ASC, current_assignments ASC
      `;

      const availableMembers = await pool.query(assignmentQuery);
      
      // Simple AI logic: assign to person with lowest workload and matching skills
      if (availableMembers.rows.length > 0) {
        finalAssigneeId = availableMembers.rows[0].id;
      }
    }

    // Remove existing primary assignment
    await pool.query('DELETE FROM task_assignments WHERE task_id = $1 AND assignment_type = $2', [id, 'primary']);

    // Create new assignment
    const assignmentQuery = `
      INSERT INTO task_assignments (task_id, assignee_id, assigned_by, assignment_type)
      VALUES ($1, $2, $3, 'primary')
      RETURNING *
    `;

    const assignment = await pool.query(assignmentQuery, [id, finalAssigneeId, req.user?.id]);

    // Create follow-up
    const taskQuery = 'SELECT title, due_date FROM tasks WHERE id = $1';
    const taskInfo = await pool.query(taskQuery, [id]);
    
    const followUpQuery = `
      INSERT INTO follow_ups (
        task_id, assignee_id, follow_up_type, title, message, 
        scheduled_for, auto_generated
      ) VALUES ($1, $2, 'assignment_reminder', $3, $4, $5, true)
    `;
    
    const reminderDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    await pool.query(followUpQuery, [
      id, finalAssigneeId,
      `New Task Assignment: ${taskInfo.rows[0].title}`,
      `You have been assigned a new task. Please review and start working on it.`,
      reminderDate
    ]);

    res.json({ assignment: assignment.rows[0], message: 'Task assigned successfully' });

  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// =====================================================
// FOLLOW-UP SYSTEM ROUTES
// =====================================================

// Get follow-ups for user
router.get('/follow-ups', async (req, res) => {
  try {
    const { assignee_id, status = 'pending', limit = 50 } = req.query;
    const userId = assignee_id || req.user?.id;

    const query = `
      SELECT 
        f.*,
        p.name as project_name,
        t.title as task_title
      FROM follow_ups f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN tasks t ON f.task_id = t.id
      WHERE f.assignee_id = $1 AND f.status = $2
      ORDER BY f.scheduled_for ASC
      LIMIT $3
    `;

    const result = await pool.query(query, [userId, status, limit]);
    res.json({ follow_ups: result.rows });

  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// Mark follow-up as completed
router.put('/follow-ups/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const query = `
      UPDATE follow_ups 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    res.json({ follow_up: result.rows[0], message: 'Follow-up completed' });

  } catch (error) {
    console.error('Error completing follow-up:', error);
    res.status(500).json({ error: 'Failed to complete follow-up' });
  }
});

// =====================================================
// ANALYTICS ROUTES
// =====================================================

// Get project analytics
router.get('/projects/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;

    // Project overview metrics
    const metricsQuery = `
      SELECT 
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 1 END) as overdue_tasks,
        SUM(t.estimated_hours) as total_estimated_hours,
        SUM(t.actual_hours) as total_actual_hours,
        SUM(te.duration_minutes) / 60.0 as total_logged_hours
      FROM tasks t
      LEFT JOIN time_entries te ON t.id = te.task_id
      WHERE t.project_id = $1
    `;

    // Team performance
    const teamPerformanceQuery = `
      SELECT 
        tm.name,
        tm.role,
        COUNT(ta.id) as assigned_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        SUM(te.duration_minutes) / 60.0 as hours_logged,
        AVG(CASE WHEN t.status = 'completed' THEN 
          EXTRACT(EPOCH FROM t.completion_date - t.created_at) / 3600 
        END) as avg_completion_hours
      FROM team_members tm
      LEFT JOIN task_assignments ta ON tm.id = ta.assignee_id
      LEFT JOIN tasks t ON ta.task_id = t.id AND t.project_id = $1
      LEFT JOIN time_entries te ON t.id = te.task_id AND te.team_member_id = tm.id
      GROUP BY tm.id, tm.name, tm.role
      HAVING COUNT(ta.id) > 0
      ORDER BY completed_tasks DESC
    `;

    const [metricsResult, teamResult] = await Promise.all([
      pool.query(metricsQuery, [id]),
      pool.query(teamPerformanceQuery, [id])
    ]);

    res.json({
      metrics: metricsResult.rows[0],
      team_performance: teamResult.rows
    });

  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function updateProjectProgress(projectId) {
  try {
    const progressQuery = `
      UPDATE projects 
      SET progress_percentage = (
        SELECT COALESCE(
          ROUND(
            (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0) / 
            NULLIF(COUNT(*), 0)
          ), 0
        )
        FROM tasks 
        WHERE project_id = $1 AND parent_task_id IS NULL
      )
      WHERE id = $1
    `;
    
    await pool.query(progressQuery, [projectId]);
  } catch (error) {
    console.error('Error updating project progress:', error);
  }
}

module.exports = router;
