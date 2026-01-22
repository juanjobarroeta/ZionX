-- =====================================================
-- ZIONX PROJECT MANAGEMENT SYSTEM DATABASE SCHEMA
-- =====================================================

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    customer_id INTEGER,
    project_manager_id INTEGER,
    status VARCHAR(50) DEFAULT 'planning', -- planning, active, on_hold, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    start_date DATE,
    due_date DATE,
    budget DECIMAL(12,2),
    actual_cost DECIMAL(12,2) DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    project_type VARCHAR(100), -- marketing_campaign, website_design, seo_audit, etc.
    tags TEXT[], -- array of tags for categorization
    custom_fields JSONB, -- flexible custom fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Templates (for quick project creation)
CREATE TABLE IF NOT EXISTS project_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(100),
    default_duration_days INTEGER,
    template_data JSONB, -- stores default tasks, stages, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Stages/Phases
CREATE TABLE IF NOT EXISTS project_stages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed
    start_date DATE,
    end_date DATE,
    dependencies TEXT[], -- array of stage IDs that must complete first
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    stage_id INTEGER REFERENCES project_stages(id),
    parent_task_id INTEGER REFERENCES tasks(id), -- for subtasks
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo', -- todo, in_progress, review, completed, blocked
    priority VARCHAR(20) DEFAULT 'medium',
    task_type VARCHAR(100), -- design, development, content, review, etc.
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2) DEFAULT 0,
    start_date DATE,
    due_date DATE,
    completion_date TIMESTAMP,
    tags TEXT[],
    custom_fields JSONB,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'finish_to_start', -- finish_to_start, start_to_start, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(100), -- project_manager, developer, designer, content_writer, etc.
    department VARCHAR(100),
    skills TEXT[], -- array of skills
    hourly_rate DECIMAL(8,2),
    capacity_hours_per_week INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT true,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Assignments
CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    assignee_id INTEGER REFERENCES team_members(id),
    assigned_by INTEGER REFERENCES team_members(id),
    assignment_type VARCHAR(50) DEFAULT 'primary', -- primary, collaborator, reviewer
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    notes TEXT
);

-- Task Comments/Updates
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES team_members(id),
    comment_type VARCHAR(50) DEFAULT 'comment', -- comment, status_change, file_upload, time_log
    content TEXT,
    metadata JSONB, -- for storing additional data like file paths, time logged, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time Tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    team_member_id INTEGER REFERENCES team_members(id),
    project_id INTEGER REFERENCES projects(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    description TEXT,
    billable BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up System
CREATE TABLE IF NOT EXISTS follow_ups (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    task_id INTEGER REFERENCES tasks(id),
    assignee_id INTEGER REFERENCES team_members(id),
    follow_up_type VARCHAR(100), -- reminder, status_check, deadline_warning, overdue_alert
    title VARCHAR(500),
    message TEXT,
    scheduled_for TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium',
    auto_generated BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Automation Rules
CREATE TABLE IF NOT EXISTS workflow_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id INTEGER REFERENCES projects(id), -- null for global rules
    trigger_event VARCHAR(100), -- task_created, status_changed, due_date_approaching, etc.
    trigger_conditions JSONB, -- conditions that must be met
    actions JSONB, -- actions to execute (send_email, create_task, assign_user, etc.)
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES team_members(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Files/Attachments
CREATE TABLE IF NOT EXISTS project_files (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    task_id INTEGER REFERENCES tasks(id),
    file_name VARCHAR(500),
    file_path VARCHAR(1000),
    file_size INTEGER,
    file_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES team_members(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Activity Log
CREATE TABLE IF NOT EXISTS project_activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    task_id INTEGER REFERENCES tasks(id),
    user_id INTEGER REFERENCES team_members(id),
    activity_type VARCHAR(100), -- created, updated, assigned, completed, commented, etc.
    description TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id INTEGER REFERENCES team_members(id),
    sender_id INTEGER REFERENCES team_members(id),
    project_id INTEGER REFERENCES projects(id),
    task_id INTEGER REFERENCES tasks(id),
    notification_type VARCHAR(100), -- assignment, mention, due_date, status_change, etc.
    title VARCHAR(500),
    message TEXT,
    read_at TIMESTAMP,
    action_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON task_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assignee ON follow_ups(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_member ON time_entries(team_member_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities(project_id);

-- Sample Data for Testing
INSERT INTO team_members (name, email, role, department, skills) VALUES
('Juan José Barroeta', 'juan@zionx.com', 'Project Manager', 'Management', ARRAY['leadership', 'planning', 'communication']),
('Alice Johnson', 'alice@zionx.com', 'Senior Developer', 'Development', ARRAY['react', 'node.js', 'postgresql']),
('Bob Smith', 'bob@zionx.com', 'UI/UX Designer', 'Design', ARRAY['figma', 'adobe-creative', 'user-research']),
('Carol Davis', 'carol@zionx.com', 'Content Strategist', 'Marketing', ARRAY['copywriting', 'seo', 'social-media'])
ON CONFLICT (email) DO NOTHING;

-- Sample Project Templates
INSERT INTO project_templates (name, description, project_type, default_duration_days, template_data) VALUES
('Marketing Campaign Launch', 'Complete marketing campaign from strategy to execution', 'marketing_campaign', 60, 
 '{"stages": [
    {"name": "Strategy & Planning", "duration": 14, "tasks": ["Market Research", "Target Audience Analysis", "Campaign Strategy"]},
    {"name": "Creative Development", "duration": 21, "tasks": ["Brand Guidelines", "Creative Concepts", "Asset Creation"]},
    {"name": "Execution & Launch", "duration": 14, "tasks": ["Campaign Setup", "Launch", "Monitoring"]},
    {"name": "Analysis & Optimization", "duration": 11, "tasks": ["Performance Analysis", "Optimization", "Reporting"]}
  ]}'),
('Website Redesign', 'Complete website redesign project', 'website_design', 90,
 '{"stages": [
    {"name": "Discovery & Research", "duration": 14, "tasks": ["Requirements Gathering", "User Research", "Competitor Analysis"]},
    {"name": "Design & Prototyping", "duration": 28, "tasks": ["Wireframes", "UI Design", "Prototyping", "User Testing"]},
    {"name": "Development", "duration": 35, "tasks": ["Frontend Development", "Backend Integration", "Testing"]},
    {"name": "Launch & Optimization", "duration": 13, "tasks": ["Deployment", "Performance Optimization", "Training"]}
  ]}')
ON CONFLICT DO NOTHING;
