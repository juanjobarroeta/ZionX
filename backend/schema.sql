-- ==============================================================================
-- CrediYA Database Schema - Single Source of Truth
-- ==============================================================================
-- This is the authoritative schema for the CrediYA application
-- All table definitions, constraints, and indexes are defined here
-- ==============================================================================

-- Drop all tables if they exist (for clean reset)
DROP TABLE IF EXISTS loan_status_logs CASCADE;
DROP TABLE IF EXISTS loan_resolutions CASCADE;
DROP TABLE IF EXISTS loan_investigations CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS collection_actions CASCADE;
DROP TABLE IF EXISTS collection_notes CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;
DROP TABLE IF EXISTS payment_breakdowns CASCADE;
DROP TABLE IF EXISTS customer_references CASCADE;
DROP TABLE IF EXISTS customer_avals CASCADE;
DROP TABLE IF EXISTS customer_notes CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS loan_installments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS inventory_requests CASCADE;
DROP TABLE IF EXISTS financial_products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS public_applications CASCADE;
DROP TABLE IF EXISTS accounting_closures CASCADE;
DROP TABLE IF EXISTS financial_movements CASCADE;
DROP TABLE IF EXISTS balance_weeks CASCADE;
DROP TABLE IF EXISTS balance_sheet_entries CASCADE;
DROP TABLE IF EXISTS accounting_manual_entries CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;

-- ==============================================================================
-- CORE TABLES
-- ==============================================================================

-- Stores table
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  manager_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table with enhanced permissions
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  store_id INTEGER REFERENCES stores(id),
  phone VARCHAR(20),
  avatar_url TEXT,
  permissions JSONB DEFAULT '{}',
  last_login TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Activity Audit Log
CREATE TABLE user_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions for enhanced security
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Permissions Templates (for easy role management)
CREATE TABLE permission_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default permission templates
INSERT INTO permission_templates (name, description, permissions) VALUES
('admin', 'Administrador con acceso completo', '{
  "canAccessLoanQuotes": true,
  "canCreateLoans": true,
  "canApproveLoan": true,
  "canRegisterPayments": true,
  "canViewLoanDetails": true,
  "canResolveLoan": true,
  "canManageInventory": true,
  "canEditInventory": true,
  "canAssignIMEI": true,
  "canTransferInventory": true,
  "canReceiveInventory": true,
  "canRequestInventory": true,
  "canViewAccounting": true,
  "canViewReports": true,
  "canClosePeriods": true,
  "canManualEntry": true,
  "canViewBalanceSheet": true,
  "canViewIncomeStatement": true,
  "canManageUsers": true,
  "canViewAuditLogs": true,
  "canManageStores": true,
  "canCreateLoans": true,
  "canManageLoans": true,
  "canViewLoans": true,
  "canManageInventory": true,
  "canManageExpenses": true,
  "canConfigureSystem": true,
  "canResetDatabase": true,
  "canManagePromotions": true,
  "canViewDashboard": true,
  "canAccessCRM": true,
  "canManageCustomers": true,
  "canViewNotifications": true
}'),
('store_manager', 'Gerente de sucursal', '{
  "canViewDashboard": true,
  "canAccessLoanQuotes": true,
  "canCreateLoans": true,
  "canApproveLoan": true,
  "canRegisterPayments": true,
  "canViewLoanDetails": true,
  "canManageInventory": true,
  "canEditInventory": true,
  "canAssignIMEI": true,
  "canTransferInventory": true,
  "canReceiveInventory": true,
  "canRequestInventory": true,
  "canAccessCRM": true,
  "canManageCustomers": true,
  "canViewReports": true,
  "canViewNotifications": true
}'),
('store_staff', 'Personal de sucursal', '{
  "canViewDashboard": true,
  "canAccessLoanQuotes": true,
  "canCreateLoans": true,
  "canRegisterPayments": true,
  "canViewLoanDetails": true,
  "canAccessCRM": true,
  "canManageCustomers": true,
  "canViewNotifications": true
}'),
('warehouse', 'Personal de almacén', '{
  "canViewDashboard": true,
  "canManageInventory": true,
  "canEditInventory": true,
  "canAssignIMEI": true,
  "canTransferInventory": true,
  "canReceiveInventory": true,
  "canRequestInventory": true,
  "canViewNotifications": true
}'),
('accounting', 'Personal de contabilidad', '{
  "canViewDashboard": true,
  "canViewAccounting": true,
  "canViewReports": true,
  "canClosePeriods": true,
  "canManualEntry": true,
  "canViewBalanceSheet": true,
  "canViewIncomeStatement": true,
  "canViewNotifications": true
}');

-- Financial Products table
CREATE TABLE financial_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  interest_rate NUMERIC(5,2) NOT NULL,
  term_weeks INTEGER NOT NULL,
  payment_frequency VARCHAR(20) DEFAULT 'weekly',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  curp VARCHAR(18),
  rfc VARCHAR(13),
  date_of_birth DATE,
  occupation VARCHAR(100),
  monthly_income NUMERIC(10,2),
  credit_score INTEGER,
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  -- File upload paths
  ine_path VARCHAR(255),
  bureau_path VARCHAR(255),
  proof_income_path VARCHAR(255),
  proof_address_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INVENTORY MANAGEMENT
-- ==============================================================================

-- Inventory Requests table
CREATE TABLE inventory_requests (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  color VARCHAR(50),
  ram VARCHAR(20),
  storage VARCHAR(20),
  amount NUMERIC(10,2),
  quantity INTEGER DEFAULT 1,
  priority VARCHAR(20) DEFAULT 'normal',
  supplier VARCHAR(100),
  expected_delivery DATE,
  approval_required BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Workflow columns
  created_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  approval_notes TEXT,
  payment_method VARCHAR(20),
  payment_reference VARCHAR(100),
  payment_notes TEXT,
  paid_at TIMESTAMP,
  received_quantity INTEGER,
  received_condition VARCHAR(20),
  reception_notes TEXT,
  received_at TIMESTAMP,
  quote_file VARCHAR(255),
  store_id INTEGER REFERENCES stores(id)
);

-- Inventory Items table
CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  inventory_request_id INTEGER REFERENCES inventory_requests(id),
  store_id INTEGER REFERENCES stores(id),
  category VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  color VARCHAR(50),
  ram VARCHAR(20),
  storage VARCHAR(20),
  imei VARCHAR(15) UNIQUE,
  serial_number VARCHAR(50),
  purchase_price NUMERIC(10,2),
  sale_price NUMERIC(10,2),
  quantity INTEGER DEFAULT 1,
  condition VARCHAR(20) DEFAULT 'new',
  status VARCHAR(20) DEFAULT 'pendiente',
  store VARCHAR(50) DEFAULT 'warehouse', -- Legacy field, will migrate to store_id
  location_details TEXT,
  
  -- Tracking fields
  assigned_to_loan_id INTEGER REFERENCES loans(id),
  sold_at TIMESTAMP,
  recovered_at TIMESTAMP,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- LOAN MANAGEMENT
-- ==============================================================================

-- Loans table
CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  customer_id INTEGER REFERENCES customers(id),
  inventory_item_id INTEGER REFERENCES inventory_items(id),
  financial_product_id INTEGER REFERENCES financial_products(id),
  store_id INTEGER REFERENCES stores(id),
  amount NUMERIC(10,2) NOT NULL,
  interest_rate NUMERIC(5,2) DEFAULT 120.00,
  term_weeks INTEGER NOT NULL,
  payment_frequency VARCHAR(20) DEFAULT 'weekly',
  down_payment NUMERIC(10,2) DEFAULT 0,
  loan_type VARCHAR(20) DEFAULT 'producto',
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  
  -- Approval workflow fields
  approved_by INTEGER REFERENCES users(id),
  approval_notes TEXT,
  approved_at TIMESTAMP,
  
  -- Contract generation fields
  contract_generated_by INTEGER REFERENCES users(id),
  contract_generated_at TIMESTAMP,
  contract_url TEXT,
  
  -- Delivery fields
  delivered_by INTEGER REFERENCES users(id),
  delivery_date TIMESTAMP,
  delivery_notes TEXT,
  
  -- Status tracking
  status_updated_at TIMESTAMP,
  
  -- Additional loan tracking
  remaining_balance NUMERIC(10,2),
  next_payment_date DATE,
  last_payment_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Installments table
CREATE TABLE loan_installments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount_due NUMERIC(10,2) NOT NULL,
  capital_portion NUMERIC(10,2) DEFAULT 0,
  interest_portion NUMERIC(10,2) DEFAULT 0,
  penalty_applied NUMERIC(10,2) DEFAULT 0,
  capital_paid NUMERIC(10,2) DEFAULT 0,
  interest_paid NUMERIC(10,2) DEFAULT 0,
  penalty_paid NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  last_penalty_applied TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  store_id INTEGER REFERENCES stores(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(20) DEFAULT 'efectivo',
  payment_type VARCHAR(20) DEFAULT 'regular',
  installment_week INTEGER,
  component VARCHAR(20), -- 'capital', 'interest', 'penalty'
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- CUSTOMER RELATIONSHIP MANAGEMENT
-- ==============================================================================

-- Customer Notes table
CREATE TABLE customer_notes (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  note TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Guarantors (Avals) table
CREATE TABLE customer_avals (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  aval_name VARCHAR(200) NOT NULL,
  aval_phone VARCHAR(20),
  aval_address TEXT,
  relationship VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer References table
CREATE TABLE customer_references (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  reference_name VARCHAR(200) NOT NULL,
  reference_phone VARCHAR(20),
  relationship VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- BUSINESS MANAGEMENT
-- ==============================================================================

-- Expenses table
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'pending',
  store_id INTEGER REFERENCES stores(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budgets table
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  period VARCHAR(20) DEFAULT 'monthly',
  start_date DATE,
  end_date DATE,
  description TEXT,
  store_id INTEGER REFERENCES stores(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promotions table
CREATE TABLE promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20), -- 'percentage', 'fixed'
  discount_value NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Public Applications table
CREATE TABLE public_applications (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  desired_amount NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ACCOUNTING SYSTEM
-- ==============================================================================

-- Chart of Accounts table
CREATE TABLE chart_of_accounts (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  category VARCHAR(100), -- Added for compatibility with updated backend
  group_name VARCHAR(100),
  parent_code VARCHAR(20) REFERENCES chart_of_accounts(code),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal Entries table (Double-entry bookkeeping)
CREATE TABLE journal_entries (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  account_code VARCHAR(20) REFERENCES chart_of_accounts(code),
  debit NUMERIC(12,2) DEFAULT 0,
  credit NUMERIC(12,2) DEFAULT 0,
  source_type VARCHAR(50), -- 'loan', 'payment', 'expense', 'manual_entry', etc.
  source_id VARCHAR(50),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual Accounting Entries table
CREATE TABLE accounting_manual_entries (
  id SERIAL PRIMARY KEY,
  entry_type VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  source_account VARCHAR(20),
  destination_account VARCHAR(20),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- COLLECTION & RESOLUTION
-- ==============================================================================

-- Collection Notes table
CREATE TABLE collection_notes (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  note TEXT NOT NULL,
  action_taken VARCHAR(100),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collection Actions table
CREATE TABLE collection_actions (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Investigations table
CREATE TABLE loan_investigations (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  investigation_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  findings TEXT,
  investigator_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Resolutions table
CREATE TABLE loan_resolutions (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  resolution_type VARCHAR(50) NOT NULL, -- 'settlement', 'writeoff', 'repossession'
  amount NUMERIC(10,2) DEFAULT 0,
  write_off_amount NUMERIC(10,2) DEFAULT 0,
  recovery_costs NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  reason TEXT,
  recovery_attempts INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Status Logs table
CREATE TABLE loan_status_logs (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  notes TEXT,
  changed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ADVANCED FEATURES
-- ==============================================================================

-- Payment Breakdowns table
CREATE TABLE payment_breakdowns (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id),
  capital_amount NUMERIC(10,2) DEFAULT 0,
  interest_amount NUMERIC(10,2) DEFAULT 0,
  penalty_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Plans table
CREATE TABLE payment_plans (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER REFERENCES loans(id),
  plan_type VARCHAR(50),
  original_amount NUMERIC(10,2),
  negotiated_amount NUMERIC(10,2),
  payment_schedule TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Receipts table
CREATE TABLE payment_receipts (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id),
  receipt_number VARCHAR(50) UNIQUE,
  receipt_url TEXT,
  issued_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- FINANCIAL REPORTING
-- ==============================================================================

-- Accounting Closures table
CREATE TABLE accounting_closures (
  id SERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  closure_type VARCHAR(20) DEFAULT 'monthly',
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_expenses NUMERIC(12,2) DEFAULT 0,
  net_income NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open',
  closed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial Movements table
CREATE TABLE financial_movements (
  id SERIAL PRIMARY KEY,
  movement_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  account_affected VARCHAR(20),
  movement_date DATE DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balance Weeks table
CREATE TABLE balance_weeks (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  closing_balance NUMERIC(12,2) DEFAULT 0,
  total_collections NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balance Sheet Entries table
CREATE TABLE balance_sheet_entries (
  id SERIAL PRIMARY KEY,
  entry_date DATE DEFAULT CURRENT_DATE,
  account_code VARCHAR(20) REFERENCES chart_of_accounts(code),
  account_name VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  entry_type VARCHAR(20), -- 'debit', 'credit'
  period_month INTEGER,
  period_year INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- SEED DATA
-- ==============================================================================

-- Basic Chart of Accounts (Mexican accounting structure)
INSERT INTO chart_of_accounts (code, name, type, category, group_name) VALUES
-- Assets
('1001', 'Caja', 'asset', 'Activos Circulantes', 'Activos Circulantes'),
('1002', 'Bancos', 'asset', 'Activos Circulantes', 'Activos Circulantes'),
('1003', 'Cuentas por Cobrar - Clientes', 'asset', 'Activos Circulantes', 'Activos Circulantes'),
('1004', 'Inventario', 'asset', 'Activos Circulantes', 'Activos Circulantes'),
('1005', 'Anticipo a Proveedores', 'asset', 'Activos Circulantes', 'Activos Circulantes'),
('1101', 'Equipo de Cómputo', 'asset', 'Activos Fijos', 'Activos Fijos'),
('1102', 'Mobiliario y Equipo', 'asset', 'Activos Fijos', 'Activos Fijos'),

-- Liabilities  
('2001', 'Cuentas por Pagar - Proveedores', 'liability', 'Pasivos Circulantes', 'Pasivos Circulantes'),
('2002', 'Préstamos por Pagar', 'liability', 'Pasivos Circulantes', 'Pasivos Circulantes'),
('2003', 'IVA por Pagar', 'liability', 'Pasivos Circulantes', 'Pasivos Circulantes'),

-- Equity
('3001', 'Capital Social', 'equity', 'Capital', 'Capital'),
('3002', 'Utilidades Retenidas', 'equity', 'Capital', 'Capital'),

-- Revenue
('4001', 'Ingresos por Intereses', 'revenue', 'Ingresos', 'Ingresos'),
('4002', 'Ingresos por Ventas', 'revenue', 'Ingresos', 'Ingresos'),
('4003', 'Otros Ingresos', 'revenue', 'Ingresos', 'Ingresos'),

-- Expenses
('5001', 'Gastos de Operación', 'expense', 'Gastos', 'Gastos'),
('5002', 'Gastos de Administración', 'expense', 'Gastos', 'Gastos'),
('5003', 'Gastos Financieros', 'expense', 'Gastos', 'Gastos'),
('5004', 'Pérdidas por Incobrabilidad', 'expense', 'Gastos', 'Gastos'),
('5005', 'Costo de Ventas (COGS)', 'expense', 'Gastos', 'Gastos'),
('5006', 'Multas y Recargos', 'revenue', 'Ingresos', 'Ingresos')
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Primary relationship indexes
CREATE INDEX idx_loans_customer_id ON loans(customer_id);
CREATE INDEX idx_loans_inventory_item_id ON loans(inventory_item_id);
CREATE INDEX idx_loan_installments_loan_id ON loan_installments(loan_id);
CREATE INDEX idx_payments_loan_id ON payments(loan_id);
CREATE INDEX idx_inventory_items_request_id ON inventory_items(inventory_request_id);

-- Status and filtering indexes
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);
CREATE INDEX idx_inventory_requests_status ON inventory_requests(status);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Accounting indexes
CREATE INDEX idx_journal_entries_account_code ON journal_entries(account_code);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_entries_source ON journal_entries(source_type, source_id);

-- Search indexes
CREATE INDEX idx_customers_name ON customers(first_name, last_name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_inventory_items_imei ON inventory_items(imei);

-- ==============================================================================
-- CONSTRAINTS AND TRIGGERS
-- ==============================================================================

-- Ensure positive amounts
ALTER TABLE loans ADD CONSTRAINT check_positive_amount CHECK (amount > 0);
ALTER TABLE payments ADD CONSTRAINT check_positive_payment CHECK (amount > 0);
ALTER TABLE inventory_items ADD CONSTRAINT check_positive_prices CHECK (purchase_price >= 0 AND sale_price >= 0);

-- Ensure valid dates
ALTER TABLE loan_installments ADD CONSTRAINT check_valid_due_date CHECK (due_date >= CURRENT_DATE - INTERVAL '1 year');
ALTER TABLE expenses ADD CONSTRAINT check_valid_expense_date CHECK (expense_date <= CURRENT_DATE + INTERVAL '1 day');

-- Ensure accounting balance (debits = credits for same source)
-- This will be enforced at application level

-- ==============================================================================
-- END OF SCHEMA
-- ==============================================================================
