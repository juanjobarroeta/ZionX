// ==============================================================================
// CrediYA Database Management Module
// ==============================================================================
// Handles database connection, table creation, and schema management
// ==============================================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection pool with fallback configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.DB_USER || process.env.PGUSER || "postgres",
  host: process.env.DB_HOST || process.env.PGHOST || "localhost", 
  database: process.env.DB_NAME || process.env.PGDATABASE || "crediya",
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "",
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Initialize database with clean schema
 */
async function initializeDatabase() {
  try {
    console.log("🔄 Initializing CrediYa database...");
    
    // Read the authoritative schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSql);
    
    console.log("✅ Database schema created successfully");
    
    // Seed essential data
    await seedEssentialData();
    
    console.log("✅ Database initialization complete");
    
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

/**
 * Seed essential data for application to function
 */
async function seedEssentialData() {
  try {
    console.log("🌱 Seeding essential data...");
    
    // 1. Create default stores
    await pool.query(`
      INSERT INTO stores (id, name, address, phone) VALUES 
        (1, 'Atlixco', 'Centro de Atlixco, Puebla', '222-123-4567'),
        (2, 'Chipilo', 'Centro de Chipilo, Puebla', '222-234-5678'),
        (3, 'Cholula', 'Centro de Cholula, Puebla', '222-345-6789'),
        (4, 'Almacén Central', 'Bodega Principal', '222-456-7890')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // 2. Create default admin user
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (id, name, email, password, role, store_id) VALUES 
        (1, 'Admin User', 'admin@test.com', $1, 'admin', 1)
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);
    
    // 3. Create Chart of Accounts - Essential accounts
    await pool.query(`
      INSERT INTO chart_of_accounts (code, name, type, group_name) VALUES 
        -- Assets
        ('1101', 'Caja', 'asset', 'current_assets'),
        ('1102', 'Banco', 'asset', 'current_assets'),
        ('1103', 'Clientes', 'asset', 'current_assets'),
        ('1104', 'Almacén Teléfonos', 'asset', 'current_assets'),
        ('1105', 'Cuentas Incobrables - Repossessed Inventory', 'asset', 'current_assets'),
        ('1106', 'Anticipos a Proveedores', 'asset', 'current_assets'),
        ('1500', 'Activos Fijos', 'asset', 'fixed_assets'),
        
        -- Liabilities
        ('2100', 'Proveedores', 'liability', 'current_liabilities'),
        ('2200', 'Acreedores Diversos', 'liability', 'current_liabilities'),
        
        -- Equity
        ('3000', 'Utilidades Retenidas', 'equity', 'retained_earnings'),
        ('3100', 'Aportaciones de Capital', 'equity', 'capital'),
        
        -- Revenue
        ('4000', 'Ventas', 'revenue', 'sales'),
        ('4100', 'Intereses Clientes', 'revenue', 'interest_income'),
        ('4101', 'Penalidades Clientes', 'revenue', 'penalty_income'),
        
        -- Expenses
        ('5000', 'COGS', 'expense', 'cost_of_goods'),
        ('5100', 'Costo de Ventas', 'expense', 'cost_of_goods'),
        ('6000', 'Sueldos/Gastos Generales', 'expense', 'operating_expenses'),
        ('6100', 'Marketing', 'expense', 'operating_expenses'),
        ('6200', 'Renta', 'expense', 'operating_expenses'),
        ('6210', 'Agua', 'expense', 'operating_expenses'),
        ('6220', 'Luz', 'expense', 'operating_expenses'),
        ('6230', 'Internet', 'expense', 'operating_expenses'),
        ('6240', 'Software', 'expense', 'operating_expenses'),
        ('6250', 'Limpieza', 'expense', 'operating_expenses'),
        ('6260', 'Seguridad', 'expense', 'operating_expenses'),
        ('6300', 'Papelería', 'expense', 'operating_expenses'),
        ('6500', 'Gastos por Cuentas Incobrables - Bad Debt Expense', 'expense', 'bad_debt')
      ON CONFLICT (code) DO NOTHING
    `);
    
    // 4. Create default financial products
    await pool.query(`
      INSERT INTO financial_products (id, name, interest_rate, term_weeks, description) VALUES 
        (1, 'Préstamo Estándar 24 semanas', 120.00, 24, 'Préstamo estándar para productos'),
        (2, 'Préstamo Express 12 semanas', 150.00, 12, 'Préstamo express corto plazo'),
        (3, 'Préstamo Flexible 36 semanas', 100.00, 36, 'Préstamo largo plazo tasa preferencial')
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log("✅ Essential data seeded successfully");
    
  } catch (error) {
    console.error("❌ Data seeding failed:", error);
    throw error;
  }
}

/**
 * Get database connection pool
 */
function getPool() {
  return pool;
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log("✅ Database connection successful:", result.rows[0].now);
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

/**
 * Reset database to clean state
 */
async function resetDatabase() {
  try {
    console.log("🔄 Resetting database to clean state...");
    await initializeDatabase();
    console.log("✅ Database reset complete");
  } catch (error) {
    console.error("❌ Database reset failed:", error);
    throw error;
  }
}

module.exports = {
  pool,
  getPool,
  initializeDatabase,
  testConnection,
  resetDatabase,
  seedEssentialData
};
