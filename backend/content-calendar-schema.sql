-- =====================================================
-- CONTENT CALENDAR & PRODUCTION PIPELINE SCHEMA
-- =====================================================

-- Content Calendar Table (Your Excel Structure)
CREATE TABLE IF NOT EXISTS content_calendar (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    post_number INTEGER NOT NULL, -- Row number for the month
    month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM' format
    
    -- Content Planning Fields (Your Excel Columns)
    publish_date DATE, -- 1. Date to be published
    campaign VARCHAR(255), -- 2. Campaign name
    status VARCHAR(50) DEFAULT 'planificado', -- 3. Status (planificado, en_diseño, aprobado, publicado)
    enfoque VARCHAR(255), -- 4. Enfoque/Focus
    formato VARCHAR(50), -- 5. Formato (reel, post, story, tiktok, etc)
    idea_theme TEXT, -- 6. Idea or theme
    elements_to_use TEXT, -- 7. Elements to use (with links to files)
    file_references TEXT[], -- Array of file IDs from customer_files
    inspiration_references TEXT, -- 8. References (inspiration posts)
    copy_in TEXT, -- 9. Copy in (text in the post)
    copy_out TEXT, -- 10. Copy out (caption)
    arte_file_id INTEGER, -- 11. Arte (finished design file ID)
    requires_photography BOOLEAN DEFAULT false, -- 12. Requires photography
    
    -- Workflow Management
    assigned_designer INTEGER, -- Team member ID
    assigned_community_manager INTEGER, -- Team member ID
    estimated_hours DECIMAL(4,2), -- Time estimation
    actual_hours DECIMAL(4,2), -- Actual time spent
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    
    -- Approval Workflow
    client_approved BOOLEAN DEFAULT false,
    client_feedback TEXT,
    internal_notes TEXT,
    revision_count INTEGER DEFAULT 0,
    
    -- Performance Tracking (Post-Publication)
    published_url VARCHAR(500),
    performance_metrics JSONB, -- likes, comments, shares, reach, etc.
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(customer_id, month_year, post_number)
);

-- Team Members Extended for Workload Management
CREATE TABLE IF NOT EXISTS team_workload (
    id SERIAL PRIMARY KEY,
    team_member_id INTEGER REFERENCES team_members(id),
    month_year VARCHAR(7) NOT NULL,
    role VARCHAR(50) NOT NULL, -- designer, community_manager, strategist
    max_capacity_hours DECIMAL(6,2) DEFAULT 160, -- Monthly capacity
    current_assigned_hours DECIMAL(6,2) DEFAULT 0,
    availability_percentage DECIMAL(5,2) DEFAULT 100,
    skills TEXT[], -- Array of skills/specializations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_member_id, month_year)
);

-- Content Templates for Reusability
CREATE TABLE IF NOT EXISTS content_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    formato VARCHAR(50), -- reel, post, story, etc.
    template_fields JSONB, -- Predefined structure
    estimated_hours DECIMAL(4,2),
    required_skills TEXT[],
    template_files TEXT[], -- Associated template files
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Assignment History
CREATE TABLE IF NOT EXISTS content_assignments (
    id SERIAL PRIMARY KEY,
    content_calendar_id INTEGER REFERENCES content_calendar(id),
    assigned_to INTEGER REFERENCES team_members(id),
    assignment_type VARCHAR(50), -- design, copy, photography, review, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, revision_needed
    due_date DATE,
    estimated_hours DECIMAL(4,2),
    actual_hours DECIMAL(4,2),
    notes TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Analytics
CREATE TABLE IF NOT EXISTS content_performance (
    id SERIAL PRIMARY KEY,
    content_calendar_id INTEGER REFERENCES content_calendar(id),
    platform VARCHAR(50), -- instagram, facebook, tiktok, etc.
    post_url VARCHAR(500),
    published_at TIMESTAMP,
    metrics JSONB, -- Platform-specific metrics
    engagement_rate DECIMAL(5,2),
    reach INTEGER,
    impressions INTEGER,
    clicks INTEGER,
    saves INTEGER,
    shares INTEGER,
    comments_count INTEGER,
    likes_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_calendar_customer_month ON content_calendar(customer_id, month_year);
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_content_calendar_assigned ON content_calendar(assigned_designer, assigned_community_manager);
CREATE INDEX IF NOT EXISTS idx_team_workload_member_month ON team_workload(team_member_id, month_year);
CREATE INDEX IF NOT EXISTS idx_content_assignments_assigned ON content_assignments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_content_performance_calendar ON content_performance(content_calendar_id);
