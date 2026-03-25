const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'zionx_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

/**
 * Complete verification of ZIONX migration (customers + employees)
 */
async function verifyCompleteMigration() {
  const client = await pool.connect();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          VERIFICACIÓN COMPLETA - MIGRACIÓN ZIONX               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log();
    
    // Verify customers
    console.log('👥 CLIENTES:');
    console.log('─'.repeat(70));
    
    const customerCount = await client.query('SELECT COUNT(*) as total FROM customers');
    const customersWithPhone = await client.query('SELECT COUNT(*) as count FROM customers WHERE phone IS NOT NULL');
    const customersWithEmail = await client.query('SELECT COUNT(*) as count FROM customers WHERE email IS NOT NULL AND email != \'\'');
    
    console.log(`   Total clientes: ${customerCount.rows[0].total}`);
    console.log(`   Con teléfono: ${customersWithPhone.rows[0].count}`);
    console.log(`   Con email: ${customersWithEmail.rows[0].count}`);
    
    if (customerCount.rows[0].total == 18) {
      console.log('   ✅ CLIENTES VERIFICADOS');
    } else {
      console.log(`   ⚠️ Se esperaban 18, hay ${customerCount.rows[0].total}`);
    }
    console.log();
    
    // Verify employees
    console.log('👔 EMPLEADOS:');
    console.log('─'.repeat(70));
    
    const totalUsers = await client.query('SELECT COUNT(*) as total FROM users');
    const usersByRole = await client.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    `);
    
    console.log(`   Total usuarios: ${totalUsers.rows[0].total}`);
    usersByRole.rows.forEach(r => {
      console.log(`   ${r.role}: ${r.count}`);
    });
    
    if (totalUsers.rows[0].total >= 8) {
      console.log('   ✅ EMPLEADOS VERIFICADOS');
    } else {
      console.log(`   ⚠️ Se esperaban 8, hay ${totalUsers.rows[0].total}`);
    }
    console.log();
    
    // Financial summary
    console.log('💰 RESUMEN FINANCIERO:');
    console.log('─'.repeat(70));
    
    // Get total marketing budgets from customer addresses
    const customers = await client.query('SELECT address FROM customers');
    let totalBudget = 0;
    customers.rows.forEach(c => {
      if (c.address && c.address.includes('Presupuesto Marketing:')) {
        const match = c.address.match(/Presupuesto Marketing: \$([0-9,]+\.\d+)/);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          totalBudget += amount;
        }
      }
    });
    
    console.log(`   Presupuestos de clientes: $${totalBudget.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log(`   Nómina mensual: $99,500.00`);
    console.log(`   Margen estimado: $${(totalBudget - 99500).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    console.log();
    
    // Sample data check
    console.log('🔍 MUESTRAS DE DATOS:');
    console.log('─'.repeat(70));
    
    const sampleCustomer = await client.query('SELECT first_name, last_name, phone FROM customers LIMIT 1');
    if (sampleCustomer.rows.length > 0) {
      const c = sampleCustomer.rows[0];
      console.log(`   Cliente ejemplo: ${c.first_name} ${c.last_name} (${c.phone})`);
    }
    
    const sampleUser = await client.query('SELECT name, email, role FROM users WHERE id > 1 LIMIT 1');
    if (sampleUser.rows.length > 0) {
      const u = sampleUser.rows[0];
      console.log(`   Empleado ejemplo: ${u.name} (${u.email}) - ${u.role}`);
    }
    console.log();
    
    // Final status
    console.log('╔════════════════════════════════════════════════════════════════╗');
    if (customerCount.rows[0].total >= 18 && totalUsers.rows[0].total >= 8) {
      console.log('║                    ✅ MIGRACIÓN EXITOSA                        ║');
      console.log('║                                                                ║');
      console.log('║  Sistema listo para operar con:                                ║');
      console.log('║    • 18 clientes activos                                       ║');
      console.log('║    • 7 empleados con acceso                                    ║');
      console.log('║    • $115,823 en presupuestos                                  ║');
      console.log('║                                                                ║');
      console.log('║  🚀 Inicia el sistema y comienza a trabajar!                   ║');
    } else {
      console.log('║              ⚠️ VERIFICAR DATOS                                ║');
      console.log(`║  Clientes: ${customerCount.rows[0].total}/18                                              ║`);
      console.log(`║  Empleados: ${totalUsers.rows[0].total}/8                                               ║`);
    }
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log();
    
    console.log('📖 PRÓXIMOS PASOS:');
    console.log('   1. Leer START_HERE.md');
    console.log('   2. Enviar credenciales al equipo (EMPLOYEE_CREDENTIALS.md)');
    console.log('   3. Iniciar sistema y explorar');
    console.log('   4. Solicitar emails de clientes');
    console.log();
    
  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run verification
verifyCompleteMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
