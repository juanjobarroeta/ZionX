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
 * Verify ZIONX customer migration
 */
async function verifyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando migración de clientes ZIONX...\n');
    console.log('='.repeat(70));
    
    // Check total customers
    const countResult = await client.query('SELECT COUNT(*) as total FROM customers');
    const total = parseInt(countResult.rows[0].total);
    console.log(`📊 Total de clientes: ${total}`);
    
    // Check customers with phone
    const phoneResult = await client.query('SELECT COUNT(*) as with_phone FROM customers WHERE phone IS NOT NULL AND phone != \'\'');
    console.log(`📱 Clientes con teléfono: ${phoneResult.rows[0].with_phone}`);
    
    // Check customers with email
    const emailResult = await client.query('SELECT COUNT(*) as with_email FROM customers WHERE email IS NOT NULL AND email != \'\'');
    console.log(`📧 Clientes con email: ${emailResult.rows[0].with_email}`);
    
    // Check customers with RFC
    const rfcResult = await client.query('SELECT COUNT(*) as with_rfc FROM customers WHERE address LIKE \'%RFC:%\' AND address NOT LIKE \'%Sin RFC%\'');
    console.log(`📄 Clientes con RFC: ${rfcResult.rows[0].with_rfc}`);
    
    // Check customers with address info
    const addressResult = await client.query('SELECT COUNT(*) as with_address FROM customers WHERE address IS NOT NULL AND address != \'\'');
    console.log(`📍 Clientes con información: ${addressResult.rows[0].with_address}`);
    
    console.log('='.repeat(70));
    console.log();
    
    // Show sample customer
    console.log('📋 Ejemplo de cliente importado:\n');
    const sampleResult = await client.query(`
      SELECT id, first_name, last_name, phone, address 
      FROM customers 
      WHERE id = 7
    `);
    
    if (sampleResult.rows.length > 0) {
      const customer = sampleResult.rows[0];
      console.log(`ID: ${customer.id}`);
      console.log(`Nombre: ${customer.first_name} ${customer.last_name}`);
      console.log(`Teléfono: ${customer.phone}`);
      console.log(`\nInformación completa:`);
      console.log(customer.address);
    }
    
    console.log('\n' + '='.repeat(70));
    
    // Summary
    if (total === 18) {
      console.log('✅ Migración VERIFICADA - Todos los clientes importados correctamente');
    } else if (total > 18) {
      console.log(`⚠️ Hay ${total} clientes (se esperaban 18) - Puede haber datos previos`);
    } else {
      console.log(`❌ Solo ${total} clientes (se esperaban 18) - Migración incompleta`);
    }
    
    console.log('='.repeat(70));
    console.log();
    
    // Action items
    console.log('📝 Pendientes:');
    if (emailResult.rows[0].with_email == 0) {
      console.log('   ⚠️ NINGÚN cliente tiene email - solicitar a todos los contactos');
    }
    
    const withoutRfc = total - parseInt(rfcResult.rows[0].with_rfc);
    if (withoutRfc > 0) {
      console.log(`   ⚠️ ${withoutRfc} clientes sin RFC - solicitar a los que requieran factura`);
    }
    
    console.log();
    console.log('🚀 Para acceder al sistema:');
    console.log('   1. Backend: cd ~/zionx-marketing/backend && npm start');
    console.log('   2. Frontend: cd ~/zionx-marketing/frontend && npm run dev');
    console.log('   3. Abrir: http://localhost:5174/crm');
    console.log();
    
  } catch (error) {
    console.error('❌ Error al verificar:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run verification
verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
