-- =====================================================
-- SOCIAL MEDIA INTEGRATION SCHEMA
-- For connecting Meta (Facebook/Instagram) accounts
-- and managing social media posting
-- =====================================================

-- =====================================================
-- CONNECTED SOCIAL ACCOUNTS
-- Stores OAuth credentials for connected platforms
-- =====================================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id), -- Who connected this account
  
  -- Platform info
  platform VARCHAR(50) NOT NULL, -- 'facebook', 'instagram', 'tiktok', 'linkedin'
  platform_account_id VARCHAR(255) NOT NULL, -- Platform's ID for this account
  account_name VARCHAR(255),
  account_username VARCHAR(255),
  account_picture_url TEXT,
  account_type VARCHAR(50), -- 'page', 'business', 'personal'
  
  -- Access credentials (encrypted in production)
  access_token TEXT,
  token_expires_at TIMESTAMP,
  refresh_token TEXT,
  
  -- For Facebook Pages with Instagram
  instagram_account_id VARCHAR(255),
  instagram_username VARCHAR(255),
  
  -- Metadata
  followers_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_customer ON social_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

-- =====================================================
-- SCHEDULED POSTS
-- Posts queued for publishing
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
  
  -- Content
  content_type VARCHAR(50) DEFAULT 'post', -- 'post', 'story', 'reel', 'carousel'
  message TEXT,
  media_urls TEXT[], -- Array of media URLs
  link_url TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- 'draft', 'scheduled', 'publishing', 'published', 'failed'
  published_at TIMESTAMP,
  platform_post_id VARCHAR(255), -- ID returned by platform after publishing
  platform_post_url TEXT,
  error_message TEXT,
  
  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_customer ON scheduled_posts(customer_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

-- =====================================================
-- POST ANALYTICS
-- Stores fetched analytics for published posts
-- =====================================================
CREATE TABLE IF NOT EXISTS post_analytics (
  id SERIAL PRIMARY KEY,
  scheduled_post_id INTEGER REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform_post_id VARCHAR(255),
  
  -- Engagement metrics
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  
  -- Calculated
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_post ON post_analytics(scheduled_post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_account ON post_analytics(social_account_id);

-- =====================================================
-- ACCOUNT ANALYTICS SNAPSHOTS
-- Daily/weekly snapshots of account-level metrics
-- =====================================================
CREATE TABLE IF NOT EXISTS account_analytics (
  id SERIAL PRIMARY KEY,
  social_account_id INTEGER REFERENCES social_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Follower metrics
  followers_count INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  followers_lost INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_impressions INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  website_clicks INTEGER DEFAULT 0,
  
  -- Content metrics
  posts_published INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(social_account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_account_analytics_account ON account_analytics(social_account_id);
CREATE INDEX IF NOT EXISTS idx_account_analytics_date ON account_analytics(snapshot_date);

-- =====================================================
-- CONTENT TEMPLATES
-- Reusable post templates
-- =====================================================
CREATE TABLE IF NOT EXISTS content_templates (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'promotional', 'educational', 'engagement', etc.
  
  -- Template content
  message_template TEXT,
  hashtags TEXT[],
  
  -- Media
  default_media_urls TEXT[],
  
  -- Settings
  platforms TEXT[], -- Which platforms this template is for
  is_active BOOLEAN DEFAULT true,
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_templates_customer ON content_templates(customer_id);

-- =====================================================
-- HASHTAG PERFORMANCE
-- Track which hashtags perform best
-- =====================================================
CREATE TABLE IF NOT EXISTS hashtag_performance (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  hashtag VARCHAR(255) NOT NULL,
  
  times_used INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
  
  last_used_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(customer_id, hashtag)
);

CREATE INDEX IF NOT EXISTS idx_hashtag_customer ON hashtag_performance(customer_id);

-- =====================================================
-- VIEWS
-- =====================================================

-- Upcoming scheduled posts
CREATE OR REPLACE VIEW v_upcoming_posts AS
SELECT 
  sp.*,
  sa.platform,
  sa.account_name,
  sa.account_username,
  c.business_name as customer_name
FROM scheduled_posts sp
JOIN social_accounts sa ON sp.social_account_id = sa.id
LEFT JOIN customers c ON sp.customer_id = c.id
WHERE sp.status = 'scheduled' AND sp.scheduled_for > NOW()
ORDER BY sp.scheduled_for ASC;

-- Posts due for publishing (within next 5 minutes)
CREATE OR REPLACE VIEW v_posts_due AS
SELECT 
  sp.*,
  sa.platform,
  sa.access_token,
  sa.instagram_account_id
FROM scheduled_posts sp
JOIN social_accounts sa ON sp.social_account_id = sa.id
WHERE sp.status = 'scheduled' 
  AND sp.scheduled_for <= NOW() + INTERVAL '5 minutes'
  AND sp.scheduled_for > NOW() - INTERVAL '1 hour';

-- Success message
DO $$ BEGIN RAISE NOTICE 'Social media schema created successfully!'; END $$;

