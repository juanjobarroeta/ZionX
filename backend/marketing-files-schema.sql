-- =====================================================
-- MARKETING FILES MANAGEMENT SCHEMA
-- =====================================================

-- Customer Files Table for Marketing Assets
CREATE TABLE IF NOT EXISTS customer_files (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    category VARCHAR(50) NOT NULL, -- branding, media, escaleta, designs, reportes
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    mime_type VARCHAR(100),
    description TEXT,
    tags TEXT[],
    metadata JSONB,
    uploaded_by INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly Reports Table
CREATE TABLE IF NOT EXISTS customer_reports (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    report_period VARCHAR(20) NOT NULL, -- 'YYYY-MM' format
    report_type VARCHAR(50) DEFAULT 'social_media', -- social_media, campaign, analytics
    file_path VARCHAR(500),
    metrics JSONB, -- Store metrics like reach, engagement, clicks, etc.
    status VARCHAR(20) DEFAULT 'draft', -- draft, ready, sent, approved
    generated_by INTEGER,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, report_period, report_type)
);

-- Content Calendar/Escaleta Table
CREATE TABLE IF NOT EXISTS content_calendar (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50), -- post, story, reel, campaign, etc.
    platform VARCHAR(50), -- instagram, facebook, linkedin, etc.
    scheduled_date DATE,
    scheduled_time TIME,
    status VARCHAR(20) DEFAULT 'planned', -- planned, created, approved, published
    file_attachments TEXT[], -- Array of file paths
    hashtags TEXT[],
    target_audience VARCHAR(255),
    campaign_id INTEGER,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brand Guidelines Table
CREATE TABLE IF NOT EXISTS brand_guidelines (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    primary_color VARCHAR(7), -- Hex color
    secondary_color VARCHAR(7),
    accent_color VARCHAR(7),
    primary_font VARCHAR(100),
    secondary_font VARCHAR(100),
    logo_usage_rules TEXT,
    tone_of_voice TEXT,
    brand_values TEXT[],
    do_not_use TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_files_customer_category ON customer_files(customer_id, category);
CREATE INDEX IF NOT EXISTS idx_customer_reports_customer_period ON customer_reports(customer_id, report_period);
CREATE INDEX IF NOT EXISTS idx_content_calendar_customer_date ON content_calendar(customer_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_customer ON brand_guidelines(customer_id);
