// Railway-safe database reset endpoint
// This should be added to the main index.js file

app.post("/admin/reset-database", authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log("🗑️ Admin requested database reset...");
    
    // Get all table names to drop them
    const tablesQuery = `
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
      ORDER BY tablename;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.tablename);
    
    console.log(`📋 Found ${tables.length} tables to drop:`, tables);
    
    // Drop all tables (this will cascade and remove all data)
    for (const table of tables) {
      console.log(`🗑️ Dropping table: ${table}`);
      await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
    
    console.log("✅ All tables dropped successfully");
    
    // Now recreate all tables fresh by calling the createTables function
    console.log("🔨 Recreating tables...");
    await createTables();
    
    console.log("✅ All tables recreated successfully");
    
    // Insert essential seed data
    console.log("🌱 Inserting essential seed data...");
    
    // Create a default store
    const storeResult = await pool.query(`
      INSERT INTO stores (name, address, phone) 
      VALUES ($1, $2, $3) RETURNING id
    `, ["Test Store", "Test Address", "1234567890"]);
    
    // Create a default admin user
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    await pool.query(`
      INSERT INTO users (name, email, password, role, store_id) 
      VALUES ($1, $2, $3, $4, $5)
    `, ["Admin User", "admin@test.com", hashedPassword, "admin", storeResult.rows[0].id]);
    
    // Insert basic chart of accounts
    await pool.query(`
      INSERT INTO chart_of_accounts (account_code, account_name, account_type) VALUES
        ('1000', 'Assets', 'asset'),
        ('1100', 'Cash and Cash Equivalents', 'asset'),
        ('1200', 'Accounts Receivable', 'asset'),
        ('1300', 'Inventory', 'asset'),
        ('2000', 'Liabilities', 'liability'),
        ('2100', 'Accounts Payable', 'liability'),
        ('3000', 'Equity', 'equity'),
        ('3100', 'Retained Earnings', 'equity'),
        ('4000', 'Revenue', 'revenue'),
        ('4100', 'Interest Income', 'revenue'),
        ('5000', 'Expenses', 'expense'),
        ('5100', 'Interest Expense', 'expense')
    `);
    
    console.log("✅ Essential seed data inserted");
    
    res.json({
      success: true,
      message: "Database reset completed successfully",
      credentials: {
        email: "admin@test.com",
        password: "admin123"
      },
      note: "Financial products will be created through the software interface for testing"
    });
    
  } catch (err) {
    console.error("❌ Error resetting database:", err);
    res.status(500).json({
      success: false,
      message: "Database reset failed",
      error: err.message
    });
  }
});
