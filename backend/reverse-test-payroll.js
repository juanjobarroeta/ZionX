const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Simple script to reverse test payroll period 3 ($5,000)
 */
async function reverseTestPayroll() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 REVERSING TEST PAYROLL (Period 3)...\n');
    
    await client.query('BEGIN');
    
    // Get payroll period 3
    const period = await client.query('SELECT * FROM payroll_periods WHERE id = 3');
    
    if (!period.rows.length) {
      console.log('⚠️  Period 3 not found (might already be deleted)');
      await pool.end();
      return;
    }
    
    const payroll = period.rows[0];
    console.log(`Found: ${payroll.period_name} - $${payroll.total_gross} - ${payroll.status}`);
    
    // Find journal entries for this payroll
    const entries = await client.query(`
      SELECT id, account_code, debit, credit, description
      FROM journal_entries
      WHERE source_type = 'payroll' 
        AND (source_id = 3 OR description LIKE '%2da Quincena%')
    `);
    
    console.log(`\nFound ${entries.rows.length} journal entries to reverse:\n`);
    
    // Create reversal entries
    for (const entry of entries.rows) {
      console.log(`  Reversing: ${entry.account_code} D:${entry.debit} C:${entry.credit}`);
      
      await client.query(`
        INSERT INTO journal_entries (
          date, description, account_code, debit, credit,
          source_type, source_id
        ) VALUES (
          CURRENT_DATE, $1, $2, $3, $4, 'payroll_reversal', 3
        )
      `, [
        `REVERSA: ${payroll.period_name} - Test payroll cleanup`,
        entry.account_code,
        entry.credit, // Swap
        entry.debit   // Swap
      ]);
      
      console.log(`  ✅ Created reversal: ${entry.account_code} D:${entry.credit} C:${entry.debit}`);
    }
    
    // Update period status
    await client.query(`
      UPDATE payroll_periods SET
        status = 'reversed',
        notes = 'REVERSED: Test payroll - cleanup',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 3
    `);
    
    await client.query('COMMIT');
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ PAYROLL REVERSED SUCCESSFULLY                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n✅ Period 3 reversed`);
    console.log(`✅ ${entries.rows.length} journal entries reversed`);
    console.log('✅ Estado de Resultados updated');
    console.log('✅ Bank balance restored\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

reverseTestPayroll()
  .then(() => {
    console.log('🎯 Next: Delete draft periods 4, 5, 6 from web interface');
    console.log('      Then start with real payroll!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
