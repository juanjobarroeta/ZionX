const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Income Management Migration...\n');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'income-management-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Running income-management-schema.sql...');
    await client.query(schemaSql);
    console.log('✅ Income management tables created successfully\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'service_packages',
          'service_addons',
          'customer_subscriptions',
          'customer_addon_purchases',
          'invoices',
          'invoice_items',
          'invoice_payments',
          'billable_time_entries',
          'client_expenses'
        )
      ORDER BY table_name
    `);
    
    console.log(`✅ Found ${tableCheck.rows.length} income tables:`);
    tableCheck.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log('');
    
    // Check sample data
    const packagesCount = await client.query('SELECT COUNT(*) as count FROM service_packages');
    const addonsCount = await client.query('SELECT COUNT(*) as count FROM service_addons');
    
    console.log('📊 Sample data loaded:');
    console.log(`   - Service Packages: ${packagesCount.rows[0].count}`);
    console.log(`   - Service Add-ons: ${addonsCount.rows[0].count}`);
    console.log('');
    
    // Show sample packages
    const packages = await client.query('SELECT id, name, base_price FROM service_packages ORDER BY base_price');
    console.log('📦 Available Service Packages:');
    packages.rows.forEach(pkg => {
      console.log(`   ${pkg.id}. ${pkg.name} - $${parseFloat(pkg.base_price).toFixed(2)} MXN/mes`);
    });
    console.log('');
    
    // Show sample addons by category
    const addons = await client.query(`
      SELECT category, COUNT(*) as count, SUM(price) as total_value
      FROM service_addons 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
    `);
    console.log('➕ Add-ons by Category:');
    addons.rows.forEach(cat => {
      console.log(`   ${cat.category}: ${cat.count} items (Total value: $${parseFloat(cat.total_value).toFixed(2)} MXN)`);
    });
    console.log('');
    
    // Check views
    console.log('🔍 Verifying views...');
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'v_active_subscriptions',
          'v_pending_invoices',
          'v_monthly_revenue'
        )
    `);
    console.log(`✅ Found ${viewCheck.rows.length} views:`);
    viewCheck.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log('');
    
    // Check chart of accounts
    const coaCheck = await client.query(`
      SELECT code, name 
      FROM chart_of_accounts 
      WHERE code IN ('4002', '4003', '4004', '2003', '1103')
      ORDER BY code
    `);
    console.log('📒 Chart of Accounts entries:');
    coaCheck.rows.forEach(acc => {
      console.log(`   ${acc.code} - ${acc.name}`);
    });
    console.log('');
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Start your backend server');
    console.log('   2. Test the API endpoints (see INCOME_API_ENDPOINTS.md)');
    console.log('   3. Create customer subscriptions');
    console.log('   4. Purchase add-ons for customers');
    console.log('   5. Generate invoices');
    console.log('');
    console.log('🔐 All endpoints require authentication token in header:');
    console.log('   Authorization: Bearer <your_jwt_token>');
    console.log('');
    console.log('💡 Example: Create a subscription');
    console.log('   POST /api/income/subscriptions');
    console.log('   {');
    console.log('     "customer_id": 1,');
    console.log('     "service_package_id": 2,');
    console.log('     "start_date": "2025-02-01"');
    console.log('   }');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Details:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();





