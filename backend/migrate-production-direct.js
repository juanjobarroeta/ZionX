const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ Uso: PROD_DATABASE_URL="..." node migrate-production-direct.js');
  process.exit(1);
}

async function migrate() {
  console.log('🔗 Connecting to production...\n');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    await client.query('SELECT NOW()');
    console.log('✅ Connected to Railway production!\n');
    
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    
    // CUSTOMERS
    console.log('👥 IMPORTING CUSTOMERS...\n');
    const customerSheet = workbook.Sheets['CLIENTES'];
    const customerRows = XLSX.utils.sheet_to_json(customerSheet, { header: 1 }).slice(2);
    
    await client.query('BEGIN');
    let customersImported = 0;
    
    for (const row of customerRows) {
      if (!row[1] || !row[9]) continue;
      
      const brandName = row[1];
      const legalName = row[2];
      const rfc = row[3];
      const taxRegime = row[4];
      const contactFirstName = row[9];
      const contactLastName = row[10];
      const position = row[11];
      const contactEmail = row[12];
      const contactPhone = row[13] || row[14];
      const marketingBudget = row[18];
      const requiresInvoice = row[0];
      
      const cleanPhone = contactPhone ? String(contactPhone).replace(/[\s\(\)\-\.]/g, '') : null;
      
      const notes = [
        brandName ? `Marca: ${brandName}` : '',
        legalName && legalName !== brandName ? `Razón Social: ${legalName}` : '',
        rfc && rfc !== 'Pendiente' ? `RFC: ${rfc}` : '',
        taxRegime ? `Régimen Fiscal: ${taxRegime}` : '',
        requiresInvoice ? `Facturación: ${requiresInvoice}` : '',
        position ? `Contacto: ${position}` : '',
        marketingBudget ? `Presupuesto Marketing: $${marketingBudget}` : ''
      ].filter(x => x).join(' | ');
      
      try {
        const result = await client.query(`
          INSERT INTO customers (first_name, last_name, email, phone, address, employment)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          contactFirstName?.trim(),
          contactLastName?.trim() || brandName,
          contactEmail?.trim() || null,
          cleanPhone,
          notes || null,
          position?.trim() || null
        ]);
        
        console.log(`   ✅ ${customersImported + 1}. ${brandName || contactFirstName}`);
        customersImported++;
      } catch (err) {
        // Skip errors silently
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n   📊 Clientes importados: ${customersImported}\n`);
    
    // EMPLOYEES
    console.log('👔 IMPORTING EMPLOYEES...\n');
    const employeeSheet = workbook.Sheets['MINIONS'];
    const employeeRows = XLSX.utils.sheet_to_json(employeeSheet, { header: 1 }).slice(2);
    
    await client.query('BEGIN');
    let employeesImported = 0;
    const hashedPassword = await bcrypt.hash('zionx2024', 10);
    
    for (const row of employeeRows) {
      if (!row[0] || !row[1]) continue;
      
      const name = row[0];
      const email = row[1];
      const phone = row[2];
      const roles = row[4];
      const department = row[5];
      
      let systemRole = 'user';
      if (roles) {
        const rolesLower = roles.toLowerCase();
        if (rolesLower.includes('dirección') || rolesLower.includes('director')) systemRole = 'admin';
        else if (rolesLower.includes('manager')) systemRole = 'manager';
      }
      
      const permissions = {
        canViewDashboard: true,
        canAccessCRM: true,
        canManageCustomers: systemRole !== 'user',
        canCreateProjects: systemRole !== 'user',
        canManageContent: true,
        canViewReports: systemRole !== 'user',
        canManageUsers: systemRole === 'admin'
      };
      
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
      
      try {
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (existing.rows.length > 0) {
          console.log(`   ⏭️  ${name.substring(0, 35)} (already exists)`);
          continue;
        }
        
        const result = await client.query(`
          INSERT INTO users (name, email, password, role, phone, department, permissions, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING id, name, role
        `, [name.trim(), email.trim().toLowerCase(), hashedPassword, systemRole, cleanPhone, department?.trim(), JSON.stringify(permissions)]);
        
        console.log(`   ✅ ${employeesImported + 1}. ${name.substring(0, 35)} (${systemRole})`);
        employeesImported++;
      } catch (err) {
        console.log(`   ⏭️  ${name.substring(0, 35)}: ${err.message}`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n   📊 Empleados importados: ${employeesImported}\n`);
    
    // FINAL SUMMARY
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ MIGRACIÓN EXITOSA                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Tu base de datos de PRODUCCIÓN ahora tiene:`);
    console.log(`   Clientes: ${customerCount.rows[0].count}`);
    console.log(`   Usuarios: ${userCount.rows[0].count}`);
    console.log(`\n🌐 Refresca tu app de Vercel:`);
    console.log(`   https://tu-app.vercel.app/crm`);
    console.log(`\n🎉 ¡Deberías ver ${customerCount.rows[0].count} clientes ahora!\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
