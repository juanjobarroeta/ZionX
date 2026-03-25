-- Creative Briefs System for Marketing Agency
-- Stores detailed creative briefs from prospects/clients

CREATE TABLE IF NOT EXISTS creative_briefs (
  id SERIAL PRIMARY KEY,
  
  -- Basic Info
  prospect_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  website VARCHAR(255),
  social_profiles TEXT, -- JSON or comma-separated
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, completed, converted
  customer_id INTEGER REFERENCES customers(id), -- Link to customer if converted
  
  -- General Questions (Page 1)
  why_this_business TEXT,
  what_you_love TEXT,
  what_you_dont_do TEXT,
  how_perceived TEXT,
  brand_personality TEXT,
  differentiators TEXT,
  concerns_about_exposure TEXT,
  
  -- Business Description (Page 2)
  company_description TEXT,
  history_origin TEXT,
  project_reason TEXT,
  core_concept TEXT,
  value_proposition TEXT,
  value_offer TEXT,
  services_list TEXT,
  main_service TEXT,
  
  -- Objectives
  primary_objective TEXT,
  secondary_objective TEXT,
  problem_to_solve TEXT,
  target_consumer TEXT,
  ideal_client_primary TEXT,
  ideal_client_secondary TEXT,
  
  -- Expertise & Differentiation (Page 3)
  specializations TEXT,
  confident_procedures TEXT,
  unique_differentiators TEXT,
  not_ready_for TEXT,
  clients_served VARCHAR(100),
  proud_results TEXT,
  key_selling_points TEXT,
  promise_delivery TEXT,
  central_idea TEXT,
  desired_emotions TEXT,
  brand_keywords TEXT, -- 5 words that describe
  anti_keywords TEXT, -- 5 words that don't describe
  success_definition TEXT,
  success_metrics TEXT,
  strategic_allies TEXT, -- Influencers, partners
  
  -- Competition (Page 4)
  direct_competition TEXT,
  indirect_competition TEXT,
  
  -- References (Page 5)
  brand_references TEXT, -- JSON array of image URLs or descriptions
  inspiration_notes TEXT,
  
  -- Additional fields
  budget_range VARCHAR(100),
  timeline VARCHAR(100),
  special_requirements TEXT,
  notes TEXT,
  
  -- Tracking
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  converted_at TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_creative_briefs_status ON creative_briefs(status);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_customer ON creative_briefs(customer_id);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_email ON creative_briefs(email);

-- Comments
COMMENT ON TABLE creative_briefs IS 'Creative briefs for marketing projects - detailed client questionnaires';
COMMENT ON COLUMN creative_briefs.status IS 'draft, sent, completed, converted';
COMMENT ON COLUMN creative_briefs.customer_id IS 'Links to customers table if prospect becomes client';
