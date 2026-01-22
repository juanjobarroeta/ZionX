const { Pool } = require('pg');

// Safe database reset script
// This preserves table structure and only clears data
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const TABLES_TO_RESET = [
  // Order matters - respect foreign key constraints
  'journal_entries',
  'payments', 
  'loan_installments',
  'loans',
  'inventory_items',
  'inventory_requests',
  'customers',
  'users', // Keep admin user
  'stores'
];

const PRESERVE_DATA = {
  users: "WHERE email = 'admin@crediya.com'", // Keep admin
  chart_of_accounts: "1=1", // Keep all accounts
  financial_products: "1=1" // Keep financial products
};

async function safeReset() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 Starting safe database reset...');
    
    // 1. Create backup counts
    const backupInfo = {};
    for (const table of TABLES_TO_RESET) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      backupInfo[table] = result.rows[0].count;
    }
    
    console.log('📊 Current data counts:', backupInfo);
    
    // 2. Reset tables in order (respecting foreign keys)
    for (const table of TABLES_TO_RESET) {
      if (PRESERVE_DATA[table]) {
        // Selective delete - preserve important data
        await client.query(`DELETE FROM ${table} WHERE NOT (${PRESERVE_DATA[table]})`);
        console.log(`🧹 Partially cleared ${table} (preserved important data)`);
      } else {
        // Full clear
        await client.query(`DELETE FROM ${table}`);
        console.log(`🧹 Cleared ${table}`);
      }
    }
    
    // 3. Reset sequences for clean IDs
    const sequences = [
      'customers_id_seq',
      'loans_id_seq', 
      'inventory_items_id_seq',
      'inventory_requests_id_seq',
      'journal_entries_id_seq',
      'payments_id_seq'
    ];
    
    for (const seq of sequences) {
      try {
        await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
        console.log(`🔢 Reset sequence ${seq}`);
      } catch (err) {
        console.log(`⚠️ Sequence ${seq} may not exist:`, err.message);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Safe database reset completed successfully!');
    console.log('📋 Preserved: Admin user, Chart of Accounts, Financial Products');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed, rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { safeReset };

// Allow running directly
if (require.main === module) {
  safeReset()
    .then(() => {
      console.log('🎉 Reset completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reset failed:', error);
      process.exit(1);
    });
}
