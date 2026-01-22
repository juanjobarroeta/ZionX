const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Complete Database Setup...\n');
    
    // Step 1: Main schema
    console.log('📋 Step 1/4: Creating main schema (customers, users, loans, etc.)...');
    const mainSchema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(mainSchema);
    console.log('✅ Main schema created\n');
    
    // Step 2: Marketing features
    console.log('📋 Step 2/4: Adding marketing features (content calendar, projects, files)...');
    
    // Content calendar
    if (fs.existsSync(path.join(__dirname, 'content-calendar-schema.sql'))) {
      const contentCalendarSchema = fs.readFileSync(path.join(__dirname, 'content-calendar-schema.sql'), 'utf8');
      await client.query(contentCalendarSchema);
      console.log('✅ Content calendar schema added');
    }
    
    // Project management
    if (fs.existsSync(path.join(__dirname, 'project-management-schema.sql'))) {
      const projectSchema = fs.readFileSync(path.join(__dirname, 'project-management-schema.sql'), 'utf8');
      await client.query(projectSchema);
      console.log('✅ Project management schema added');
    }
    
    // Marketing files
    if (fs.existsSync(path.join(__dirname, 'marketing-files-schema.sql'))) {
      const filesSchema = fs.readFileSync(path.join(__dirname, 'marketing-files-schema.sql'), 'utf8');
      await client.query(filesSchema);
      console.log('✅ Marketing files schema added');
    }
    
    // WhatsApp
    if (fs.existsSync(path.join(__dirname, 'whatsapp-schema.sql'))) {
      const whatsappSchema = fs.readFileSync(path.join(__dirname, 'whatsapp-schema.sql'), 'utf8');
      await client.query(whatsappSchema);
      console.log('✅ WhatsApp schema added');
    }
    
    console.log('');
    
    // Step 3: Income management
    console.log('📋 Step 3/4: Adding income management (invoices, subscriptions, add-ons)...');
    const incomeSchema = fs.readFileSync(path.join(__dirname, 'income-management-schema.sql'), 'utf8');
    await client.query(incomeSchema);
    console.log('✅ Income management schema created\n');
    
    // Step 4: Verify and report
    console.log('📋 Step 4/4: Verification and summary...\n');
    
    // Count all tables
    const allTablesResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`✅ Total tables created: ${allTablesResult.rows[0].count}`);
    
    // Income-specific tables
    const incomeTables = await client.query(`
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
    console.log(`✅ Income management tables: ${incomeTables.rows.length}/9`);
    
    // Check sample data
    const packagesResult = await client.query('SELECT COUNT(*) FROM service_packages');
    const addonsResult = await client.query('SELECT COUNT(*) FROM service_addons');
    const customersResult = await client.query('SELECT COUNT(*) FROM customers');
    
    console.log('\n📊 Sample Data:');
    console.log(`   - Service Packages: ${packagesResult.rows[0].count}`);
    console.log(`   - Service Add-ons: ${addonsResult.rows[0].count}`);
    console.log(`   - Customers: ${customersResult.rows[0].count}`);
    
    // Show packages
    const packages = await client.query(`
      SELECT id, name, base_price, billing_cycle, posts_per_month
      FROM service_packages 
      ORDER BY base_price
    `);
    
    console.log('\n📦 Service Packages Available:');
    packages.rows.forEach(pkg => {
      const priceWithIVA = parseFloat(pkg.base_price) * 1.16;
      console.log(`   ${pkg.id}. ${pkg.name}`);
      console.log(`      Precio base: $${parseFloat(pkg.base_price).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
      console.log(`      Con IVA (16%): $${priceWithIVA.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
      console.log(`      Posts/mes: ${pkg.posts_per_month}`);
      console.log('');
    });
    
    // Show top add-ons
    const topAddons = await client.query(`
      SELECT name, category, price, pricing_type
      FROM service_addons
      WHERE is_active = true
      ORDER BY price DESC
      LIMIT 5
    `);
    
    console.log('➕ Top 5 Add-ons (by price):');
    topAddons.rows.forEach(addon => {
      const priceWithIVA = parseFloat(addon.price) * 1.16;
      console.log(`   - ${addon.name} (${addon.category})`);
      console.log(`     $${parseFloat(addon.price).toLocaleString('es-MX', {minimumFractionDigits: 2})} + IVA = $${priceWithIVA.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
    });
    
    console.log('\n🎉 Database setup complete!');
    console.log('\n🚀 Ready to use Income Management API!');
    console.log('   See: INCOME_API_ENDPOINTS.md for complete API reference');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();




