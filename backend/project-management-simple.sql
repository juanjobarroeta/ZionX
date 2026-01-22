-- =====================================================
-- ZIONX PROJECT MANAGEMENT SYSTEM - SIMPLIFIED SCHEMA
-- =====================================================

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    customer_id INTEGER,
    project_manager_id INTEGER,
    status VARCHAR(50) DEFAULT 'planning',
    priority VARCHAR(20) DEFAULT 'medium',
    start_date DATE,
    due_date DATE,
    budget DECIMAL(12,2),
    actual_cost DECIMAL(12,2) DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    project_type VARCHAR(100),
    tags TEXT[],
    custom_fields JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(100),
    department VARCHAR(100),
    skills TEXT[],
    hourly_rate DECIMAL(8,2),
    capacity_hours_per_week INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT true,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    stage_id INTEGER,
    parent_task_id INTEGER,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(20) DEFAULT 'medium',
    task_type VARCHAR(100),
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

-- Task Assignments
CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER,
    assignee_id INTEGER,
    assigned_by INTEGER,
    assignment_type VARCHAR(50) DEFAULT 'primary',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    notes TEXT
);

-- Project Stages/Phases
CREATE TABLE IF NOT EXISTS project_stages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    start_date DATE,
    end_date DATE,
    dependencies TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up System
CREATE TABLE IF NOT EXISTS follow_ups (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    task_id INTEGER,
    assignee_id INTEGER,
    follow_up_type VARCHAR(100),
    title VARCHAR(500),
    message TEXT,
    scheduled_for TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    auto_generated BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Activity Log
CREATE TABLE IF NOT EXISTS project_activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    task_id INTEGER,
    user_id INTEGER,
    activity_type VARCHAR(100),
    description TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time Tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    task_id INTEGER,
    team_member_id INTEGER,
    project_id INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    description TEXT,
    billable BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Team Members
INSERT INTO team_members (name, email, role, department, skills) VALUES
('Juan José Barroeta', 'juan@zionx.com', 'Project Manager', 'Management', ARRAY['leadership', 'planning', 'communication']),
('Alice Johnson', 'alice@zionx.com', 'Senior Developer', 'Development', ARRAY['react', 'node.js', 'postgresql']),
('Bob Smith', 'bob@zionx.com', 'UI/UX Designer', 'Design', ARRAY['figma', 'adobe-creative', 'user-research']),
('Carol Davis', 'carol@zionx.com', 'Content Strategist', 'Marketing', ARRAY['copywriting', 'seo', 'social-media'])
ON CONFLICT (email) DO NOTHING;





