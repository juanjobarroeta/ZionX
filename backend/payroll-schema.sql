-- =====================================================
-- PAYROLL & HR MANAGEMENT SCHEMA
-- For tracking employee wages, payroll, and labor costs
-- =====================================================

-- Extend team_members with additional HR fields
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50) DEFAULT 'full_time',
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) DEFAULT 'permanent',
ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS clabe VARCHAR(20),
ADD COLUMN IF NOT EXISTS rfc VARCHAR(15),
ADD COLUMN IF NOT EXISTS curp VARCHAR(20),
ADD COLUMN IF NOT EXISTS imss_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Employee types: full_time, part_time, contractor, freelance, admin

-- =====================================================
-- PAYROLL PERIODS
-- =====================================================
CREATE TABLE IF NOT EXISTS payroll_periods (
  id SERIAL PRIMARY KEY,
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'open', -- open, processing, closed, paid
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  total_net NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);

-- =====================================================
-- PAYROLL ENTRIES (individual employee payments)
-- =====================================================
CREATE TABLE IF NOT EXISTS payroll_entries (
  id SERIAL PRIMARY KEY,
  payroll_period_id INTEGER REFERENCES payroll_periods(id) ON DELETE CASCADE,
  team_member_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE,
  
  -- Earnings
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_pay NUMERIC(10,2) DEFAULT 0,
  bonuses NUMERIC(10,2) DEFAULT 0,
  commissions NUMERIC(10,2) DEFAULT 0,
  other_earnings NUMERIC(10,2) DEFAULT 0,
  gross_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Deductions
  isr_tax NUMERIC(10,2) DEFAULT 0,
  imss_employee NUMERIC(10,2) DEFAULT 0,
  infonavit NUMERIC(10,2) DEFAULT 0,
  loans_deduction NUMERIC(10,2) DEFAULT 0,
  other_deductions NUMERIC(10,2) DEFAULT 0,
  total_deductions NUMERIC(10,2) DEFAULT 0,
  
  -- Net pay
  net_pay NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Payment info
  payment_method VARCHAR(50) DEFAULT 'transfer',
  payment_reference VARCHAR(255),
  paid_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_member ON payroll_entries(team_member_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_status ON payroll_entries(status);

-- =====================================================
-- EXPENSE CATEGORIES (for P&L)
-- =====================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  account_code VARCHAR(20), -- Links to chart_of_accounts
  parent_id INTEGER REFERENCES expense_categories(id),
  is_active BOOLEAN DEFAULT true,
  description TEXT
);

-- Insert default expense categories
INSERT INTO expense_categories (name, code, account_code, description) VALUES
  ('Nómina', 'PAYROLL', '6000', 'Sueldos y salarios'),
  ('Impuestos sobre Nómina', 'PAYROLL_TAX', '6001', 'ISR, IMSS patronal, etc.'),
  ('Prestaciones', 'BENEFITS', '6002', 'Aguinaldo, vacaciones, etc.'),
  ('Renta', 'RENT', '6200', 'Renta de oficina'),
  ('Servicios', 'UTILITIES', '6210', 'Agua, luz, internet'),
  ('Software', 'SOFTWARE', '6240', 'Suscripciones de software'),
  ('Marketing', 'MARKETING', '6100', 'Gastos de marketing propio'),
  ('Equipo', 'EQUIPMENT', '6300', 'Equipo y herramientas'),
  ('Otros Gastos', 'OTHER', '6999', 'Gastos varios')
ON CONFLICT DO NOTHING;

-- =====================================================
-- OPERATING EXPENSES (non-payroll)
-- =====================================================
CREATE TABLE IF NOT EXISTS operating_expenses (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES expense_categories(id),
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor VARCHAR(255),
  invoice_number VARCHAR(100),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_frequency VARCHAR(20), -- monthly, quarterly, annual
  receipt_path VARCHAR(500),
  notes TEXT,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operating_expenses_date ON operating_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category ON operating_expenses(category_id);

-- =====================================================
-- VIEWS FOR FINANCIAL STATEMENTS
-- =====================================================

-- Monthly Labor Cost Summary
CREATE OR REPLACE VIEW v_monthly_labor_cost AS
SELECT 
  TO_CHAR(pp.end_date, 'YYYY-MM') as month,
  COUNT(DISTINCT pe.team_member_id) as employee_count,
  SUM(pe.gross_pay) as total_gross,
  SUM(pe.total_deductions) as total_deductions,
  SUM(pe.net_pay) as total_net,
  SUM(pe.isr_tax) as total_isr,
  SUM(pe.imss_employee) as total_imss
FROM payroll_periods pp
JOIN payroll_entries pe ON pp.id = pe.payroll_period_id
WHERE pp.status = 'paid'
GROUP BY TO_CHAR(pp.end_date, 'YYYY-MM')
ORDER BY month DESC;

-- Monthly Operating Expenses Summary
CREATE OR REPLACE VIEW v_monthly_expenses AS
SELECT 
  TO_CHAR(expense_date, 'YYYY-MM') as month,
  ec.name as category,
  SUM(oe.amount) as total_amount,
  COUNT(*) as transaction_count
FROM operating_expenses oe
LEFT JOIN expense_categories ec ON oe.category_id = ec.id
GROUP BY TO_CHAR(expense_date, 'YYYY-MM'), ec.name
ORDER BY month DESC, category;

-- Profit & Loss Summary View
CREATE OR REPLACE VIEW v_profit_loss_summary AS
SELECT 
  month,
  revenue_total,
  labor_cost,
  operating_expenses,
  (revenue_total - labor_cost - operating_expenses) as net_income,
  CASE 
    WHEN revenue_total > 0 THEN 
      ROUND(((revenue_total - labor_cost - operating_expenses) / revenue_total) * 100, 2)
    ELSE 0 
  END as profit_margin_pct
FROM (
  SELECT 
    COALESCE(r.month, l.month, e.month) as month,
    COALESCE(r.total_revenue, 0) as revenue_total,
    COALESCE(l.total_net, 0) as labor_cost,
    COALESCE(e.total_expenses, 0) as operating_expenses
  FROM (
    SELECT 
      TO_CHAR(paid_at, 'YYYY-MM') as month,
      SUM(amount) as total_revenue
    FROM invoice_payments
    GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
  ) r
  FULL OUTER JOIN (
    SELECT month, total_net FROM v_monthly_labor_cost
  ) l ON r.month = l.month
  FULL OUTER JOIN (
    SELECT 
      TO_CHAR(expense_date, 'YYYY-MM') as month,
      SUM(amount) as total_expenses
    FROM operating_expenses
    GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
  ) e ON COALESCE(r.month, l.month) = e.month
) combined
ORDER BY month DESC;

-- Employee Cost Summary
CREATE OR REPLACE VIEW v_employee_cost_summary AS
SELECT 
  tm.id,
  tm.name,
  tm.role,
  tm.department,
  tm.employee_type,
  tm.monthly_wage,
  COALESCE(ytd.ytd_gross, 0) as ytd_gross_pay,
  COALESCE(ytd.ytd_net, 0) as ytd_net_pay,
  COALESCE(ytd.payments_count, 0) as payments_this_year
FROM team_members tm
LEFT JOIN (
  SELECT 
    pe.team_member_id,
    SUM(pe.gross_pay) as ytd_gross,
    SUM(pe.net_pay) as ytd_net,
    COUNT(*) as payments_count
  FROM payroll_entries pe
  JOIN payroll_periods pp ON pe.payroll_period_id = pp.id
  WHERE EXTRACT(YEAR FROM pp.end_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND pp.status = 'paid'
  GROUP BY pe.team_member_id
) ytd ON tm.id = ytd.team_member_id
WHERE tm.is_active = true
ORDER BY tm.name;

-- Add payroll account codes to chart_of_accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, category, is_active) VALUES
  ('6001', 'Impuestos sobre Nómina', 'EGRESO', 'GASTOS OPERATIVOS', true),
  ('6002', 'Prestaciones de Ley', 'EGRESO', 'GASTOS OPERATIVOS', true),
  ('6003', 'IMSS Patronal', 'EGRESO', 'GASTOS OPERATIVOS', true),
  ('2102', 'ISR por Pagar', 'PASIVO', 'PASIVO CIRCULANTE', true),
  ('2104', 'IMSS por Pagar', 'PASIVO', 'PASIVO CIRCULANTE', true),
  ('2105', 'Nómina por Pagar', 'PASIVO', 'PASIVO CIRCULANTE', true)
ON CONFLICT (account_code) DO NOTHING;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Payroll schema created successfully!'; END $$;


