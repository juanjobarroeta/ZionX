const { Pool } = require('pg');
const readline = require('readline');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Record payroll payment with proper accounting
 * Creates journal entries for:
 * - Salary expense
 * - Bank payment
 * - Tax withholdings (ISR, IMSS)
 */
async function recordPayrollPayment() {
  const client = await pool.connect();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              REGISTRAR PAGO DE NÓMINA                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Get active employees
    const employees = await client.query(`
      SELECT id, name, monthly_wage, department
      FROM team_members
      WHERE is_active = true AND monthly_wage > 0
      ORDER BY monthly_wage DESC
    `);
    
    console.log('👥 EMPLEADOS ACTIVOS:\n');
    let totalPayroll = 0;
    employees.rows.forEach((emp, i) => {
      const wage = parseFloat(emp.monthly_wage);
      totalPayroll += wage;
      console.log(`${i + 1}. ${emp.name.substring(0, 40)} - ${emp.department} - $${wage.toLocaleString('es-MX')}`);
    });
    
    console.log(`\n💰 TOTAL NÓMINA MENSUAL: $${totalPayroll.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n`);
    console.log('─'.repeat(70));
    
    const period = await question('\nPeríodo de pago (ej: Quincena 1 - Marzo 2026): ');
    const paymentDate = await question('Fecha de pago (YYYY-MM-DD) [Enter = hoy]: ') || new Date().toISOString().split('T')[0];
    const paymentMethod = await question('Pagar desde (banco/efectivo): ');
    
    const confirm = await question(`\n⚠️  Esto registrará pago de $${totalPayroll.toFixed(2)}. Continuar? (YES/no): `);
    
    if (confirm !== 'YES') {
      console.log('❌ Cancelado.');
      rl.close();
      await pool.end();
      return;
    }
    
    await client.query('BEGIN');
    
    // Calculate tax withholdings (simplified - you can adjust these)
    const ISR_RATE = 0.10; // 10% ISR estimate
    const IMSS_RATE = 0.025; // 2.5% IMSS employee portion estimate
    
    const isrWithheld = Math.round(totalPayroll * ISR_RATE * 100) / 100;
    const imssWithheld = Math.round(totalPayroll * IMSS_RATE * 100) / 100;
    const netPay = totalPayroll - isrWithheld - imssWithheld;
    
    console.log(`\n💵 Desglose de nómina:`);
    console.log(`   Sueldo bruto:       $${totalPayroll.toFixed(2)}`);
    console.log(`   ISR retenido:      -$${isrWithheld.toFixed(2)}`);
    console.log(`   IMSS retenido:     -$${imssWithheld.toFixed(2)}`);
    console.log(`   ${''.padEnd(45, '-')}`);
    console.log(`   Pago neto:          $${netPay.toFixed(2)}\n`);
    
    const accountCode = paymentMethod === 'efectivo' ? '1101' : '1102';
    
    // Journal entries for payroll:
    // 1. Debit: Salary Expense (6000) - increases expense
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
      VALUES ($1, $2, '6000', $3, 0, 'payroll', 0)
    `, [paymentDate, `Nómina - ${period}`, totalPayroll]);
    
    // 2. Credit: Bank/Cash - net pay (decreases cash)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
      VALUES ($1, $2, $3, 0, $4, 'payroll', 0)
    `, [paymentDate, `Pago Nómina - ${period}`, accountCode, netPay]);
    
    // 3. Credit: ISR Withheld Payable (2106) - liability for tax payment later
    if (isrWithheld > 0) {
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
        VALUES ($1, $2, '2106', 0, $3, 'payroll', 0)
      `, [paymentDate, `ISR Retenido - ${period}`, isrWithheld]);
    }
    
    // 4. Credit: IMSS Withheld Payable (2107) - liability for IMSS payment later
    if (imssWithheld > 0) {
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
        VALUES ($1, $2, '2107', 0, $3, 'payroll', 0)
      `, [paymentDate, `IMSS Retenido - ${period}`, imssWithheld]);
    }
    
    await client.query('COMMIT');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ PAGO DE NÓMINA REGISTRADO                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📅 Período: ${period}`);
    console.log(`💵 Monto bruto: $${totalPayroll.toFixed(2)}`);
    console.log(`💰 Pago neto: $${netPay.toFixed(2)}`);
    console.log(`🏦 Pagado desde: ${paymentMethod === 'efectivo' ? 'Caja' : 'Banco'}`);
    console.log();
    console.log('📒 Asientos contables creados:');
    console.log(`   Debe:  6000 (Sueldos) ............... $${totalPayroll.toFixed(2)}`);
    console.log(`   Haber: ${accountCode} (${paymentMethod === 'efectivo' ? 'Caja' : 'Banco'}) .......... $${netPay.toFixed(2)}`);
    console.log(`   Haber: 2106 (ISR por Pagar) ......... $${isrWithheld.toFixed(2)}`);
    console.log(`   Haber: 2107 (IMSS por Pagar) ........ $${imssWithheld.toFixed(2)}`);
    console.log();
    console.log('💡 Recuerda pagar ISR e IMSS al SAT cuando corresponda.');
    console.log();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    rl.close();
  }
}

recordPayrollPayment();
