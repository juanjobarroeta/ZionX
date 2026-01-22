-- =====================================================
-- BUSINESS CUSTOMER MIGRATION FOR MARKETING PLATFORM
-- =====================================================

-- Add new business-specific columns to existing customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS commercial_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS rfc VARCHAR(13),
ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(100),
ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'Persona Moral',
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),

-- Fiscal address fields
ADD COLUMN IF NOT EXISTS fiscal_address TEXT,
ADD COLUMN IF NOT EXISTS fiscal_address2 TEXT,
ADD COLUMN IF NOT EXISTS fiscal_postal_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS fiscal_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS fiscal_state VARCHAR(100),

-- Contact person fields
ADD COLUMN IF NOT EXISTS contact_first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS contact_last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS contact_position VARCHAR(100),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(100),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_mobile VARCHAR(20),

-- Marketing-specific fields
ADD COLUMN IF NOT EXISTS business_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS employees_count INTEGER,
ADD COLUMN IF NOT EXISTS annual_revenue DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS target_market TEXT,
ADD COLUMN IF NOT EXISTS current_marketing_channels TEXT,

-- Additional business info
ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255),

-- Business document paths
ADD COLUMN IF NOT EXISTS business_license_path TEXT,
ADD COLUMN IF NOT EXISTS tax_certificate_path TEXT,
ADD COLUMN IF NOT EXISTS fiscal_address_proof_path TEXT,
ADD COLUMN IF NOT EXISTS legal_representative_id_path TEXT;

-- Update existing personal customers to have a business_type
UPDATE customers 
SET business_type = 'Persona Física' 
WHERE business_type IS NULL;

-- Create index on RFC for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_rfc ON customers(rfc);

-- Create index on business_name for faster searches
CREATE INDEX IF NOT EXISTS idx_customers_business_name ON customers(business_name);

-- Create index on industry for filtering
CREATE INDEX IF NOT EXISTS idx_customers_industry ON customers(industry);

COMMENT ON COLUMN customers.business_name IS 'Legal business name (Razón Social)';
COMMENT ON COLUMN customers.commercial_name IS 'Commercial name if different from legal name';
COMMENT ON COLUMN customers.rfc IS 'Mexican tax identification number';
COMMENT ON COLUMN customers.tax_regime IS 'Tax regime type';
COMMENT ON COLUMN customers.contact_first_name IS 'Primary contact person first name';
COMMENT ON COLUMN customers.contact_last_name IS 'Primary contact person last name';
COMMENT ON COLUMN customers.contact_position IS 'Contact person position/title';
COMMENT ON COLUMN customers.target_market IS 'Description of target market and demographics';
COMMENT ON COLUMN customers.current_marketing_channels IS 'Current marketing channels being used';





