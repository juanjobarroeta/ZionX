const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Clean up test transactions while keeping real data
 * Keeps: customers, users, team_members, chart_of_accounts
 * Removes: test invoices, test payroll, related journal entries
 */
async function cleanupTestData() {
  const client = await pool.connect();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           🧹 LIMPIEZA DE TRANSACCIONES DE PRUEBA               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log('⚠️  WARNING: This will delete:');
    console.log('   • All invoices and payments');
    console.log('   • All payroll periods and entries');
    console.log('   • All journal entries');
    console.log('   • All expenses\n');
    
    console.log('✅ This will KEEP:');
    console.log('   • 19 customers');
    console.log('   • 11 users');
    console.log('   • 8 team members');
    console.log('   • 56 chart of accounts');
    console.log('   • All subscriptions\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('Type "YES" to proceed with cleanup: ', resolve);
    });
    rl.close();
    
    if (answer !== 'YES') {
      console.log('❌ Cleanup cancelled');
      await pool.end();
      return;
    }
    
    await client.query('BEGIN');
    
    console.log('\n🗑️  Deleting test transactions...\n');
    
    // Delete in correct order (foreign keys)
    
    const deleted = {};
    
    // Payments first
    const payments = await client.query('DELETE FROM invoice_payments RETURNING id');
    deleted.payments = payments.rows.length;
    console.log(`   ✓ Deleted ${deleted.payments} invoice payments`);
    
    // Invoices
    const invoices = await client.query('DELETE FROM invoices RETURNING id');
    deleted.invoices = invoices.rows.length;
    console.log(`   ✓ Deleted ${deleted.invoices} invoices`);
    
    // Invoice items
    const invoiceItems = await client.query('DELETE FROM invoice_items RETURNING id');
    deleted.invoiceItems = invoiceItems.rows.length;
    console.log(`   ✓ Deleted ${deleted.invoiceItems} invoice items`);
    
    // Payroll entries
    const payrollEntries = await client.query('DELETE FROM payroll_entries RETURNING id');
    deleted.payrollEntries = payrollEntries.rows.length;
    console.log(`   ✓ Deleted ${deleted.payrollEntries} payroll entries`);
    
    // Payroll periods
    const payrollPeriods = await client.query('DELETE FROM payroll_periods RETURNING id');
    deleted.payrollPeriods = payrollPeriods.rows.length;
    console.log(`   ✓ Deleted ${deleted.payrollPeriods} payroll periods`);
    
    // Expenses
    const expenses = await client.query('DELETE FROM expenses RETURNING id');
    deleted.expenses = expenses.rows.length;
    console.log(`   ✓ Deleted ${deleted.expenses} expenses`);
    
    // Journal entries (all transaction-related)
    const journalEntries = await client.query('DELETE FROM journal_entries RETURNING id');
    deleted.journalEntries = journalEntries.rows.length;
    console.log(`   ✓ Deleted ${deleted.journalEntries} journal entries`);
    
    // Reset sequences
    await client.query('ALTER SEQUENCE invoices_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE payroll_periods_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE journal_entries_id_seq RESTART WITH 1');
    console.log('   ✓ Reset ID sequences');
    
    await client.query('COMMIT');
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                 ✅ CLEANUP COMPLETED                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n📊 Summary:');
    console.log(`   Deleted: ${deleted.invoices} invoices`);
    console.log(`   Deleted: ${deleted.payments} payments`);
    console.log(`   Deleted: ${deleted.payrollPeriods} payroll periods`);
    console.log(`   Deleted: ${deleted.expenses} expenses`);
    console.log(`   Deleted: ${deleted.journalEntries} journal entries`);
    
    // Check what remains
    const remainingCustomers = await client.query('SELECT COUNT(*) FROM customers');
    const remainingUsers = await client.query('SELECT COUNT(*) FROM users');
    const remainingTeam = await client.query('SELECT COUNT(*) FROM team_members');
    const remainingAccounts = await client.query('SELECT COUNT(*) FROM chart_of_accounts');
    
    console.log('\n✅ Preserved:');
    console.log(`   Customers: ${remainingCustomers.rows[0].count}`);
    console.log(`   Users: ${remainingUsers.rows[0].count}`);
    console.log(`   Team Members: ${remainingTeam.rows[0].count}`);
    console.log(`   Chart of Accounts: ${remainingAccounts.rows[0].count}`);
    
    console.log('\n🎯 Database is now clean and ready for real transactions!');
    console.log('   Start by:');
    console.log('   1. Creating real invoices for clients');
    console.log('   2. Processing actual payroll');
    console.log('   3. Recording real operational expenses\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupTestData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
