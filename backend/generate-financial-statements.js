const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Generate complete financial statements
 * - Estado de Resultados (P&L / Income Statement)
 * - Flujo de Efectivo (Cashflow Statement)
 * - Balance General Summary
 */
async function generateStatements() {
  const client = await pool.connect();
  
  try {
    const month = process.argv[3] || new Date().toISOString().slice(0, 7); // YYYY-MM
    const year = month.split('-')[0];
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          ESTADOS FINANCIEROS - ZIONX Marketing                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📅 Período: ${month}\n`);
    
    // ===== ESTADO DE RESULTADOS (P&L) =====
    console.log('═'.repeat(70));
    console.log('📊 ESTADO DE RESULTADOS (P&L)');
    console.log('═'.repeat(70));
    console.log();
    
    // INGRESOS
    const revenue = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN debit > 0 THEN 0 ELSE credit END), 0) as total
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.type IN ('INGRESO', 'revenue')
        AND TO_CHAR(je.date, 'YYYY-MM') = $1
    `, [month]);
    
    const revenueByAccount = await client.query(`
      SELECT 
        coa.name as account_name,
        SUM(CASE WHEN je.debit > 0 THEN 0 ELSE je.credit END) as amount
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.type IN ('INGRESO', 'revenue')
        AND TO_CHAR(je.date, 'YYYY-MM') = $1
      GROUP BY coa.name
      ORDER BY amount DESC
    `, [month]);
    
    console.log('💰 INGRESOS:');
    let totalRevenue = 0;
    revenueByAccount.rows.forEach(r => {
      const amount = parseFloat(r.amount);
      totalRevenue += amount;
      console.log(`   ${r.account_name.padEnd(45)} $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    });
    console.log(`   ${''.padEnd(45, '-')} ${'-'.repeat(20)}`);
    console.log(`   ${'TOTAL INGRESOS'.padEnd(45)} $${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // COSTOS
    const cogs = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN debit > 0 THEN debit ELSE 0 END), 0) as total
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.code LIKE '5%'
        AND TO_CHAR(je.date, 'YYYY-MM') = $1
    `, [month]);
    
    const totalCOGS = parseFloat(cogs.rows[0].total);
    console.log('📦 COSTOS DE SERVICIOS:');
    console.log(`   ${'Costo de servicios prestados'.padEnd(45)} $${totalCOGS.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    const grossProfit = totalRevenue - totalCOGS;
    console.log('💵 UTILIDAD BRUTA:');
    console.log(`   ${''.padEnd(45)} $${grossProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`   ${'Margen bruto'.padEnd(45)} ${totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0}%`);
    console.log();
    
    // GASTOS OPERATIVOS
    const expenses = await client.query(`
      SELECT 
        coa.name as account_name,
        SUM(CASE WHEN je.debit > 0 THEN je.debit ELSE 0 END) as amount
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.code LIKE '6%'
        AND TO_CHAR(je.date, 'YYYY-MM') = $1
      GROUP BY coa.name
      ORDER BY amount DESC
    `, [month]);
    
    console.log('💼 GASTOS OPERATIVOS:');
    let totalExpenses = 0;
    expenses.rows.forEach(e => {
      const amount = parseFloat(e.amount);
      totalExpenses += amount;
      console.log(`   ${e.account_name.padEnd(45)} $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    });
    console.log(`   ${''.padEnd(45, '-')} ${'-'.repeat(20)}`);
    console.log(`   ${'TOTAL GASTOS OPERATIVOS'.padEnd(45)} $${totalExpenses.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // UTILIDAD NETA
    const netIncome = grossProfit - totalExpenses;
    const netMargin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0;
    
    console.log('═'.repeat(70));
    console.log('🎯 UTILIDAD NETA:');
    console.log(`   ${''.padEnd(45)} $${netIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`   ${'Margen neto'.padEnd(45)} ${netMargin}%`);
    console.log('═'.repeat(70));
    console.log();
    
    // ===== FLUJO DE EFECTIVO (CASHFLOW) =====
    console.log('═'.repeat(70));
    console.log('💵 FLUJO DE EFECTIVO (CASHFLOW)');
    console.log('═'.repeat(70));
    console.log();
    
    // Cash beginning balance
    const cashBeginning = await client.query(`
      SELECT 
        COALESCE(SUM(debit - credit), 0) as balance
      FROM journal_entries je
      WHERE account_code IN ('1101', '1102')
        AND date < $1
    `, [month + '-01']);
    
    const beginningCash = parseFloat(cashBeginning.rows[0].balance);
    console.log(`💰 Efectivo al inicio del mes:      $${beginningCash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // Cash inflows
    const cashInflows = await client.query(`
      SELECT 
        COALESCE(SUM(debit), 0) as inflows
      FROM journal_entries
      WHERE account_code IN ('1101', '1102')
        AND TO_CHAR(date, 'YYYY-MM') = $1
        AND debit > 0
    `, [month]);
    
    const totalInflows = parseFloat(cashInflows.rows[0].inflows);
    console.log('📈 Entradas de efectivo:');
    console.log(`   ${'Cobros de clientes'.padEnd(45)} $${totalInflows.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // Cash outflows
    const cashOutflows = await client.query(`
      SELECT 
        COALESCE(SUM(credit), 0) as outflows
      FROM journal_entries
      WHERE account_code IN ('1101', '1102')
        AND TO_CHAR(date, 'YYYY-MM') = $1
        AND credit > 0
    `, [month]);
    
    const totalOutflows = parseFloat(cashOutflows.rows[0].outflows);
    console.log('📉 Salidas de efectivo:');
    console.log(`   ${'Pagos (nómina, gastos, etc.)'.padEnd(45)} $${totalOutflows.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    const netCashFlow = totalInflows - totalOutflows;
    const endingCash = beginningCash + netCashFlow;
    
    console.log('═'.repeat(70));
    console.log(`💵 Flujo neto del mes:               $${netCashFlow.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`💰 Efectivo al final del mes:        $${endingCash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log('═'.repeat(70));
    console.log();
    
    // ===== BALANCE GENERAL (Balance Sheet Summary) =====
    console.log('═'.repeat(70));
    console.log('⚖️  BALANCE GENERAL (Resumen)');
    console.log('═'.repeat(70));
    console.log();
    
    // Assets
    const assets = await client.query(`
      SELECT COALESCE(SUM(debit - credit), 0) as total
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.type IN ('ACTIVO', 'asset')
        AND je.date <= $1
    `, [month + '-31']);
    
    const totalAssets = parseFloat(assets.rows[0].total);
    console.log(`📊 Activos:                          $${totalAssets.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    
    // Liabilities
    const liabilities = await client.query(`
      SELECT COALESCE(SUM(credit - debit), 0) as total
      FROM journal_entries je
      JOIN chart_of_accounts coa ON je.account_code = coa.code
      WHERE coa.type IN ('PASIVO', 'liability')
        AND je.date <= $1
    `, [month + '-31']);
    
    const totalLiabilities = parseFloat(liabilities.rows[0].total);
    console.log(`📊 Pasivos:                          $${totalLiabilities.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    
    // Equity
    const equity = totalAssets - totalLiabilities;
    console.log(`📊 Capital:                          $${equity.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // ===== KEY METRICS =====
    console.log('═'.repeat(70));
    console.log('📈 MÉTRICAS CLAVE');
    console.log('═'.repeat(70));
    console.log();
    
    console.log(`💰 Ingresos del mes:                 $${totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`💸 Gastos del mes:                   $${totalExpenses.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`🎯 Utilidad del mes:                 $${netIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (${netMargin}%)`);
    console.log(`💵 Efectivo disponible:              $${endingCash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // Get employee count and payroll
    const teamStats = await client.query('SELECT COUNT(*) as count, SUM(monthly_wage) as payroll FROM team_members WHERE is_active = true');
    const employeeCount = teamStats.rows[0].count;
    const monthlyPayroll = parseFloat(teamStats.rows[0].payroll || 0);
    
    console.log(`👥 Empleados activos:                ${employeeCount}`);
    console.log(`💼 Nómina mensual:                   $${monthlyPayroll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`📊 Ingresos por empleado:            $${employeeCount > 0 ? (totalRevenue / employeeCount).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}`);
    console.log();
    
    console.log('═'.repeat(70));
    console.log('💡 Para generar otro período, ejecuta:');
    console.log('   node generate-financial-statements.js [DATABASE_URL] [YYYY-MM]');
    console.log('   Ejemplo: node generate-financial-statements.js "" 2026-02');
    console.log('═'.repeat(70));
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

generateStatements()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
