-- =====================================================
-- CONTENT APPROVAL WORKFLOW SCHEMA
-- =====================================================

-- Add new columns to content_calendar for approval workflow
ALTER TABLE content_calendar 
ADD COLUMN IF NOT EXISTS assigned_approver INTEGER,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS submitted_by INTEGER,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by INTEGER,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_by INTEGER,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS current_revision INTEGER DEFAULT 1;

-- Content Approval History (tracks all approval actions)
CREATE TABLE IF NOT EXISTS content_approvals (
    id SERIAL PRIMARY KEY,
    content_id INTEGER NOT NULL,
    content_type VARCHAR(50) DEFAULT 'calendar_post',
    
    -- Approval Request
    submitted_by INTEGER,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Assigned Approver
    assigned_approver INTEGER,
    
    -- Decision
    action VARCHAR(50) NOT NULL, -- 'submitted', 'approved', 'rejected', 'revision_requested', 'reassigned'
    decision_by INTEGER,
    decision_at TIMESTAMP,
    
    -- Feedback
    feedback TEXT,
    internal_notes TEXT,
    
    -- Revision tracking
    revision_number INTEGER DEFAULT 1,
    
    -- Files attached for review
    attached_files JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Permissions (who can approve what)
CREATE TABLE IF NOT EXISTS approval_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    
    -- Permission scope
    can_approve_own_team BOOLEAN DEFAULT false,
    can_approve_all BOOLEAN DEFAULT false,
    can_approve_customer_ids INTEGER[],
    can_approve_platforms VARCHAR(50)[],
    
    -- Role-based
    approval_role VARCHAR(50), -- 'manager', 'director', 'client', 'admin'
    max_approval_value DECIMAL(10,2), -- For budget-controlled approvals
    
    -- Workflow position
    approval_level INTEGER DEFAULT 1, -- 1 = first level, 2 = second level, etc.
    requires_next_level BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Queue View (for dashboard)
CREATE OR REPLACE VIEW approval_queue AS
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
    approver.name as approver_name,
    cc.submitted_for_review_at,
    submitter.name as submitted_by_name,
    cc.current_revision,
    cc.revision_count,
    cc.rejection_reason,
    cc.arte,
    cc.copy_in,
    cc.copy_out,
    cc.idea_tema,
    designer.name as designer_name,
    cm.name as cm_name
FROM content_calendar cc
LEFT JOIN customers c ON cc.customer_id = c.id
LEFT JOIN employees approver ON cc.assigned_approver = approver.id
LEFT JOIN employees submitter ON cc.submitted_by = submitter.id
LEFT JOIN employees designer ON cc.assigned_designer = designer.id
LEFT JOIN employees cm ON cc.assigned_community_manager = cm.id
WHERE cc.status = 'revision' OR cc.approval_status IN ('pending_review', 'in_review');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_approvals_content ON content_approvals(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_approvals_approver ON content_approvals(assigned_approver);
CREATE INDEX IF NOT EXISTS idx_content_approvals_action ON content_approvals(action);
CREATE INDEX IF NOT EXISTS idx_approval_permissions_user ON approval_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_approver ON content_calendar(assigned_approver);
CREATE INDEX IF NOT EXISTS idx_content_calendar_approval_status ON content_calendar(approval_status);

