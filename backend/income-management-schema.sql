-- =====================================================
-- INCOME MANAGEMENT FOR MARKETING AGENCY
-- =====================================================
-- Tracks service packages, add-ons, billing, and invoices

-- Service Packages (Monthly Retainers / Service Plans)
CREATE TABLE IF NOT EXISTS service_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, quarterly, annual, one-time
  
  -- What's included in this package
  posts_per_month INTEGER DEFAULT 0,
  platforms_included TEXT[], -- ['instagram', 'facebook', 'tiktok']
  stories_per_week INTEGER DEFAULT 0,
  reels_per_month INTEGER DEFAULT 0,
  reports_included BOOLEAN DEFAULT true,
  community_management BOOLEAN DEFAULT false,
  
  -- Package details
  features JSONB, -- Store additional features as JSON
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Add-ons Catalog
CREATE TABLE IF NOT EXISTS service_addons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'content', 'design', 'video', 'ads', 'consulting', 'platform', 'other'
  
  -- Pricing structure
  price NUMERIC(10,2) NOT NULL,
  pricing_type VARCHAR(20) DEFAULT 'fixed', -- 'fixed', 'per_unit', 'hourly', 'percentage'
  billing_frequency VARCHAR(20) DEFAULT 'one-time', -- 'one-time', 'monthly', 'per-use'
  
  -- Usage tracking
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Subscriptions (Links customers to their service packages)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  service_package_id INTEGER REFERENCES service_packages(id),
  
  -- Subscription details
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'cancelled', 'expired'
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  next_billing_date DATE,
  
  -- Custom pricing (override package price if negotiated)
  custom_monthly_price NUMERIC(10,2),
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Custom package modifications
  custom_posts_per_month INTEGER,
  custom_platforms TEXT[],
  custom_features JSONB,
  
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Add-ons (Track which add-ons customers purchased)
CREATE TABLE IF NOT EXISTS customer_addon_purchases (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES customer_subscriptions(id),
  addon_id INTEGER REFERENCES service_addons(id),
  
  -- Purchase details
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  
  -- Billing
  billing_period VARCHAR(20), -- 'YYYY-MM' format for monthly add-ons
  is_recurring BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'invoiced', 'cancelled'
  
  -- Context
  description TEXT, -- What exactly was delivered
  project_id INTEGER, -- Link to project if applicable
  task_id INTEGER, -- Link to specific task
  
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices (Billing documents)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES customer_subscriptions(id),
  
  -- Invoice details
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  billing_period_start DATE,
  billing_period_end DATE,
  
  -- Amounts
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_percentage NUMERIC(5,2) DEFAULT 16, -- IVA in Mexico
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  
  -- Payment tracking
  amount_paid NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'
  
  -- Delivery
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  
  -- Files
  invoice_file_path VARCHAR(500),
  
  notes TEXT,
  internal_notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Line Items (Detailed breakdown of what's being billed)
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Item details
  item_type VARCHAR(30) NOT NULL, -- 'subscription', 'addon', 'project', 'hours', 'expense', 'custom'
  description TEXT NOT NULL,
  
  -- Pricing
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  
  -- References
  reference_id INTEGER, -- ID of subscription, addon, project, etc.
  reference_type VARCHAR(50), -- 'service_package', 'addon', 'project', 'time_entry'
  
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Payments (Track partial and full payments)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'transferencia', 'efectivo', 'tarjeta', 'cheque'
  payment_date DATE DEFAULT CURRENT_DATE,
  
  reference_number VARCHAR(255),
  notes TEXT,
  
  -- Accounting integration
  journal_entry_id INTEGER,
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billable Time Entries (For hourly add-ons or consulting)
CREATE TABLE IF NOT EXISTS billable_time_entries (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  project_id INTEGER,
  task_id INTEGER,
  team_member_id INTEGER,
  
  -- Time details
  work_date DATE DEFAULT CURRENT_DATE,
  hours NUMERIC(5,2) NOT NULL,
  description TEXT NOT NULL,
  
  -- Billing
  hourly_rate NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  is_billable BOOLEAN DEFAULT true,
  is_invoiced BOOLEAN DEFAULT false,
  invoice_id INTEGER REFERENCES invoices(id),
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pass-through Expenses (Ads spend, stock photos, etc. billed to client)
CREATE TABLE IF NOT EXISTS client_expenses (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  project_id INTEGER,
  
  -- Expense details
  expense_date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(100) NOT NULL, -- 'ads_spend', 'stock_photos', 'software', 'printing', 'other'
  description TEXT NOT NULL,
  
  -- Amounts
  cost NUMERIC(10,2) NOT NULL, -- What we paid
  markup_percentage NUMERIC(5,2) DEFAULT 0, -- Markup we add
  client_price NUMERIC(10,2) NOT NULL, -- What we charge client
  
  -- Billing
  is_invoiced BOOLEAN DEFAULT false,
  invoice_id INTEGER REFERENCES invoices(id),
  
  -- Documentation
  receipt_path VARCHAR(500),
  vendor VARCHAR(255),
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Templates (For recurring invoices)
CREATE TABLE IF NOT EXISTS invoice_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Template structure
  template_items JSONB, -- Predefined line items
  
  -- Settings
  auto_generate BOOLEAN DEFAULT false,
  generation_day INTEGER DEFAULT 1, -- Day of month to generate
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Revenue Recognition (For accounting - track when revenue is earned vs received)
CREATE TABLE IF NOT EXISTS revenue_recognition (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  
  recognition_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  recognition_type VARCHAR(50), -- 'immediate', 'deferred', 'installment'
  
  description TEXT,
  journal_entry_id INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_next_billing ON customer_subscriptions(next_billing_date);

CREATE INDEX IF NOT EXISTS idx_customer_addon_purchases_customer ON customer_addon_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addon_purchases_period ON customer_addon_purchases(billing_period);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_billable_time_customer ON billable_time_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_billable_time_invoiced ON billable_time_entries(is_invoiced);

CREATE INDEX IF NOT EXISTS idx_client_expenses_customer ON client_expenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_client_expenses_invoiced ON client_expenses(is_invoiced);

-- =====================================================
-- CHART OF ACCOUNTS ENTRIES FOR INCOME MANAGEMENT
-- =====================================================

-- Add income-specific accounts to chart_of_accounts if they don't exist
INSERT INTO chart_of_accounts (code, name, type, category, group_name) VALUES
-- Revenue accounts for marketing services
('4002', 'Ingresos por Ventas', 'revenue', 'Ingresos', 'Ingresos'),
('4003', 'Ingresos por Servicios de Marketing', 'revenue', 'Ingresos', 'Ingresos'),
('4004', 'Ingresos por Consultoría', 'revenue', 'Ingresos', 'Ingresos'),

-- IVA account
('2003', 'IVA por Cobrar', 'liability', 'Pasivos Circulantes', 'Pasivos Circulantes'),

-- Customer receivables (base account)
('1103', 'Cuentas por Cobrar - Clientes', 'asset', 'Activos Circulantes', 'Activos Circulantes')

ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Sample Service Packages
INSERT INTO service_packages (name, description, base_price, posts_per_month, platforms_included, stories_per_week, reels_per_month, features) VALUES
('Plan Básico', 'Gestión básica de redes sociales - Ideal para empezar', 5000.00, 12, ARRAY['instagram', 'facebook'], 3, 2, 
 '{"community_management": false, "monthly_report": true, "content_calendar": true, "revisions": 2}'::jsonb),

('Plan Profesional', 'Gestión completa con estrategia - Para empresas en crecimiento', 12000.00, 20, ARRAY['instagram', 'facebook', 'tiktok'], 7, 6, 
 '{"community_management": true, "monthly_report": true, "content_calendar": true, "strategy_session": true, "revisions": 3, "analytics_deep_dive": true}'::jsonb),

('Plan Premium', 'Servicio completo + campañas - Para marcas establecidas', 25000.00, 30, ARRAY['instagram', 'facebook', 'tiktok', 'linkedin'], 10, 12, 
 '{"community_management": true, "monthly_report": true, "content_calendar": true, "strategy_session": true, "paid_ads_basic": true, "revisions": "unlimited", "priority_support": true}'::jsonb),

('Proyecto Web', 'Diseño y desarrollo de sitio web', 45000.00, 0, ARRAY[]::text[], 0, 0, 
 '{"type": "one-time", "includes": ["design", "development", "seo_basic", "responsive", "hosting_1year"]}'::jsonb)

ON CONFLICT DO NOTHING;

-- Sample Add-ons
INSERT INTO service_addons (name, description, category, price, pricing_type, billing_frequency) VALUES
-- Content Add-ons
('Post Extra', 'Publicación adicional (diseño + copy)', 'content', 500.00, 'per_unit', 'one-time'),
('Reel Extra', 'Reel adicional con edición profesional', 'content', 1200.00, 'per_unit', 'one-time'),
('Historia Extra (Pack 3)', 'Pack de 3 historias adicionales', 'content', 400.00, 'fixed', 'one-time'),
('Video Profesional', 'Video con edición avanzada (hasta 60 seg)', 'video', 3500.00, 'per_unit', 'one-time'),

-- Platform Add-ons
('Plataforma Adicional', 'Gestión de plataforma adicional por mes', 'platform', 2500.00, 'fixed', 'monthly'),
('LinkedIn Management', 'Gestión completa de LinkedIn empresarial', 'platform', 4000.00, 'fixed', 'monthly'),

-- Design Add-ons
('Diseño de Logo', 'Diseño profesional de identidad de marca', 'design', 8000.00, 'fixed', 'one-time'),
('Manual de Marca', 'Manual completo de identidad corporativa', 'design', 15000.00, 'fixed', 'one-time'),
('Rediseño de Feed', 'Rediseño completo de feed de Instagram', 'design', 5000.00, 'fixed', 'one-time'),

-- Ads Add-ons
('Gestión de Ads Básica', 'Administración de campañas pagadas (hasta $5K)', 'ads', 3000.00, 'fixed', 'monthly'),
('Gestión de Ads Premium', 'Administración de campañas pagadas (hasta $20K)', 'ads', 6000.00, 'fixed', 'monthly'),

-- Consulting Add-ons
('Hora de Consultoría', 'Consultoría estratégica por hora', 'consulting', 1500.00, 'hourly', 'per-use'),
('Sesión de Estrategia', 'Sesión completa de planificación estratégica', 'consulting', 5000.00, 'fixed', 'one-time'),

-- Other Add-ons
('Sesión Fotográfica', 'Sesión de fotos profesional (2 horas)', 'photography', 4000.00, 'fixed', 'one-time'),
('Entrega Express', 'Entrega urgente en 24 horas', 'other', 2000.00, 'fixed', 'one-time'),
('Revisiones Adicionales', 'Pack de 3 rondas extra de revisiones', 'other', 1000.00, 'fixed', 'one-time'),
('Campaña WhatsApp', 'Diseño y envío de campaña WhatsApp masiva', 'communication', 2500.00, 'fixed', 'one-time')

ON CONFLICT DO NOTHING;

-- =====================================================
-- HELPFUL VIEWS
-- =====================================================

-- Active subscriptions with customer info
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT 
  cs.id,
  cs.customer_id,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email,
  sp.name as package_name,
  COALESCE(cs.custom_monthly_price, sp.base_price) as monthly_price,
  cs.status,
  cs.next_billing_date,
  cs.start_date
FROM customer_subscriptions cs
JOIN customers c ON cs.customer_id = c.id
JOIN service_packages sp ON cs.service_package_id = sp.id
WHERE cs.status = 'active';

-- Pending invoices
CREATE OR REPLACE VIEW v_pending_invoices AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_id,
  c.first_name || ' ' || c.last_name as customer_name,
  i.invoice_date,
  i.due_date,
  i.total,
  i.amount_paid,
  (i.total - i.amount_paid) as amount_due,
  i.status,
  CASE 
    WHEN i.due_date < CURRENT_DATE AND i.status != 'paid' THEN 'overdue'
    ELSE i.status
  END as current_status
FROM invoices i
JOIN customers c ON i.customer_id = c.id
WHERE i.status != 'cancelled' AND i.status != 'paid';

-- Monthly revenue summary
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT 
  TO_CHAR(invoice_date, 'YYYY-MM') as month,
  COUNT(*) as invoice_count,
  SUM(subtotal) as subtotal,
  SUM(tax_amount) as tax,
  SUM(total) as total_billed,
  SUM(amount_paid) as total_paid,
  SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as confirmed_revenue
FROM invoices
WHERE status != 'cancelled'
GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
ORDER BY month DESC;

