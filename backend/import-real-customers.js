const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:scaramanga@localhost:5432/crediya'
});

// Function to parse Excel date serial number
function parseExcelDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel serial date starts from 1899-12-30
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Function to parse Mexican currency string to number
function parseCurrency(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  // Remove currency symbol, spaces, and convert comma decimal to period
  const cleaned = value.toString()
    .replace(/[$\s]/g, '')
    .replace(/\./g, '') // Remove thousand separators (.)
    .replace(',', '.'); // Convert decimal comma to period
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function importCustomers() {
  const client = await pool.connect();
  
  try {
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Desktop/Clientes zion.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`📊 Found ${rows.length} customers in Excel file`);
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log('\n🗑️  Clearing existing data (with CASCADE)...');
    
    // Delete related data first (tables with foreign keys to customers)
    const relatedTables = [
      'billable_time_entries',
      'client_expenses',
      'customer_addon_purchases',
      'customer_subscriptions',
      'invoices',
      'customer_files',
      'customer_notes',
      'customer_references',
      'customer_avals',
      'content_calendar',
      'customer_reports',
      'brand_guidelines'
    ];
    
    for (const table of relatedTables) {
      try {
        await client.query(`DELETE FROM ${table}`);
        console.log(`   ✓ Cleared ${table}`);
      } catch (e) {
        console.log(`   ⚠ ${table}: ${e.message}`);
      }
    }
    
    // Update leads to remove customer references
    await client.query('UPDATE leads SET converted_to_customer_id = NULL WHERE converted_to_customer_id IS NOT NULL');
    console.log('   ✓ Cleared lead references');
    
    // Update loans to remove customer references
    await client.query('UPDATE loans SET customer_id = NULL WHERE customer_id IS NOT NULL');
    console.log('   ✓ Cleared loan references');
    
    // Now delete all customers
    await client.query('DELETE FROM customers');
    console.log('   ✓ Cleared customers table');
    
    // Reset the sequence
    await client.query('ALTER SEQUENCE customers_id_seq RESTART WITH 1');
    console.log('   ✓ Reset ID sequence');
    
    console.log('\n📥 Importing customers...\n');
    
    let imported = 0;
    let errors = 0;
    
    for (const row of rows) {
      try {
        // Determine if this is a business (no last_name) or individual
        const isBusinessOnly = !row.last_name && row.first_name;
        
        const result = await client.query(`
          INSERT INTO customers (
            first_name,
            last_name,
            email,
            phone,
            address,
            curp,
            rfc,
            birthdate,
            employment,
            income,
            business_name,
            industry
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, first_name, last_name, business_name
        `, [
          isBusinessOnly ? null : row.first_name,
          row.last_name || null,
          row.email || null,
          row.phone ? String(row.phone) : null,
          row.address || null,
          row.curp || null,
          row.rfc || null,
          parseExcelDate(row.date_of_birth),
          row.occupation || null,
          parseCurrency(row.monthly_income),
          isBusinessOnly ? row.first_name : null,
          row.occupation || null
        ]);
        
        const customer = result.rows[0];
        const displayName = customer.business_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        console.log(`   ✅ ${customer.id}. ${displayName}`);
        imported++;
        
      } catch (e) {
        console.error(`   ❌ Error importing ${row.first_name}: ${e.message}`);
        errors++;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Import complete!`);
    console.log(`   📥 Imported: ${imported} customers`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    
    // Show final count
    const count = await client.query('SELECT COUNT(*) FROM customers');
    console.log(`\n📊 Total customers in database: ${count.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importCustomers().catch(console.error);


