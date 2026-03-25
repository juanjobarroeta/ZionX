const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * Add missing essential accounts for marketing business
 */
async function addMarketingAccounts() {
  const client = await pool.connect();
  
  try {
    console.log('📊 ADDING MARKETING-SPECIFIC ACCOUNTS...\n');
    
    await client.query('BEGIN');
    
    const accountsToAdd = [
      // Assets - if missing
      { code: '1101', name: 'Caja', type: 'ACTIVO', group: 'ACTIVO CIRCULANTE' },
      { code: '1102', name: 'Banco', type: 'ACTIVO', group: 'ACTIVO CIRCULANTE' },
      { code: '1103', name: 'Clientes', type: 'ACTIVO', group: 'ACTIVO CIRCULANTE' },
      
      // Revenue - Marketing specific
      { code: '4010', name: 'Ingresos por Social Media Management', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4011', name: 'Ingresos por Contenido', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4012', name: 'Ingresos por Paid Ads', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4013', name: 'Ingresos por Diseño', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4014', name: 'Ingresos por Video/Producción', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4015', name: 'Ingresos por Consultoría', type: 'INGRESO', group: 'OPERATIVO' },
      { code: '4020', name: 'Ingresos por Suscripciones', type: 'INGRESO', group: 'OPERATIVO' },
      
      // Expenses - Marketing Operations
      { code: '6001', name: 'Gastos de Meta Ads (Facebook/Instagram)', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      { code: '6002', name: 'Gastos de Google Ads', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      { code: '6003', name: 'Gastos de TikTok Ads', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      { code: '6004', name: 'Herramientas de Marketing', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      { code: '6005', name: 'Stock Photos / Assets', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      { code: '6006', name: 'Freelancers / Contratistas', type: 'EGRESO', group: 'GASTOS OPERATIVOS' },
      
      // Payroll related (if missing)
      { code: '2105', name: 'Sueldos por Pagar', type: 'PASIVO', group: 'PASIVO CIRCULANTE' },
      { code: '2106', name: 'ISR Retenido por Pagar', type: 'PASIVO', group: 'PASIVO CIRCULANTE' },
      { code: '2107', name: 'IMSS Retenido por Pagar', type: 'PASIVO', group: 'PASIVO CIRCULANTE' },
      
      // IVA
      { code: '2003', name: 'IVA por Cobrar', type: 'PASIVO', group: 'PASIVO CIRCULANTE' },
      { code: '2004', name: 'IVA por Pagar', type: 'PASIVO', group: 'PASIVO CIRCULANTE' },
    ];
    
    let added = 0;
    let skipped = 0;
    
    for (const account of accountsToAdd) {
      try {
        const result = await client.query(`
          INSERT INTO chart_of_accounts (code, name, type, group_name, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (code) DO NOTHING
          RETURNING code
        `, [account.code, account.name, account.type, account.group]);
        
        if (result.rows.length > 0) {
          console.log(`   ✅ ${account.code} - ${account.name}`);
          added++;
        } else {
          console.log(`   ⏭️  ${account.code} - ${account.name} (already exists)`);
          skipped++;
        }
      } catch (err) {
        console.log(`   ❌ ${account.code}: ${err.message}`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(70));
    console.log(`✅ Cuentas agregadas: ${added}`);
    console.log(`⏭️  Ya existían: ${skipped}`);
    console.log('='.repeat(70));
    
    // Show final count
    const count = await client.query('SELECT COUNT(*) as count FROM chart_of_accounts');
    console.log(`\n📊 Total cuentas en catálogo: ${count.rows[0].count}\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMarketingAccounts()
  .then(() => {
    console.log('✅ Catálogo de cuentas actualizado!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
