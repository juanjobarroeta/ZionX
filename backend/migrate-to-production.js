const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Parse salary from Excel formula or number
 */
function parseSalary(salaryValue) {
  if (!salaryValue) return null;
  if (typeof salaryValue === 'number') return salaryValue;
  if (typeof salaryValue === 'string') {
    const match = salaryValue.match(/\((\d+)\s*\*\s*2\)/);
    if (match) {
      const biweekly = parseInt(match[1]);
      return biweekly * 2;
    }
    const num = parseFloat(salaryValue.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Determine system role based on job roles
 */
function determineSystemRole(rolesString) {
  if (!rolesString) return 'user';
  const rolesLower = rolesString.toLowerCase();
  if (rolesLower.includes('dirección general') || rolesLower.includes('director')) {
    return 'admin';
  }
  if (rolesLower.includes('manager') || rolesLower.includes('project manager')) {
    return 'manager';
  }
  return 'user';
}

/**
 * Get permissions based on role
 */
function getPermissions(role) {
  const basePermissions = {
    canViewDashboard: true,
    canAccessCRM: true,
    canManageCustomers: false,
    canViewProjects: true,
    canCreateProjects: false,
    canManageContent: false,
    canViewReports: false,
    canManageUsers: false
  };
  
  if (role === 'admin') {
    return {
      ...basePermissions,
      canManageCustomers: true,
      canCreateProjects: true,
      canManageContent: true,
      canViewReports: true,
      canManageUsers: true,
      canManageSettings: true,
      canApproveContent: true
    };
  }
  
  if (role === 'manager') {
    return {
      ...basePermissions,
      canManageCustomers: true,
      canCreateProjects: true,
      canManageContent: true,
      canViewReports: true,
      canApproveContent: true
    };
  }
  
  return { ...basePermissions, canManageContent: true };
}

/**
 * Main migration to production
 */
async function migrateToProduction() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        MIGRACIÓN A PRODUCCIÓN - ZIONX Marketing                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  // Get DATABASE_URL
  let DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.log('⚠️  DATABASE_URL not found in environment.');
    console.log('📝 Get your production DATABASE_URL from:');
    console.log('   Railway Dashboard > Your Project > PostgreSQL > Connect\n');
    DATABASE_URL = await question('Paste your production DATABASE_URL: ');
  }
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is required!');
    rl.close();
    process.exit(1);
  }
  
  console.log('\n✅ Connecting to production database...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    // Test connection
    await client.query('SELECT NOW()');
    console.log('✅ Connected to production database\n');
    
    // Confirm action
    console.log('⚠️  WARNING: This will import data to your PRODUCTION database.');
    console.log('    - 18 customers will be added');
    console.log('    - 7 employees will be added');
    console.log();
    const confirm = await question('Type "YES" to proceed: ');
    
    if (confirm !== 'YES') {
      console.log('❌ Migration cancelled.');
      rl.close();
      await pool.end();
      return;
    }
    
    console.log('\n📖 Reading ZIONX data files...');
    
    // Read Excel file
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    
    // ===== MIGRATE CUSTOMERS =====
    console.log('\n' + '='.repeat(70));
    console.log('👥 MIGRANDO CLIENTES...');
    console.log('='.repeat(70));
    
    const customerSheet = workbook.Sheets['CLIENTES'];
    const customerRows = XLSX.utils.sheet_to_json(customerSheet, { header: 1 }).slice(2);
    
    await client.query('BEGIN');
    
    let customersImported = 0;
    let customersSkipped = 0;
    
    for (let i = 0; i < customerRows.length; i++) {
      const row = customerRows[i];
      
      if (!row[1] && !row[2]) {
        customersSkipped++;
        continue;
      }
      
      const brandName = row[1];
      const legalName = row[2];
      const rfc = row[3];
      const taxRegime = row[4];
      const fiscalAddress = row[5];
      const additionalAddress = row[6];
      const postalCode = row[7];
      const city = row[8];
      const contactFirstName = row[9];
      const contactLastName = row[10];
      const position = row[11];
      const contactEmail = row[12];
      const contactPhone = row[13];
      const contactMobile = row[14];
      const annualRevenue = row[17];
      const marketingBudget = row[18];
      const requiresInvoice = row[0];
      
      if (!contactFirstName) {
        customersSkipped++;
        continue;
      }
      
      // Build address
      let fullAddress = '';
      if (fiscalAddress) fullAddress += fiscalAddress;
      if (additionalAddress) fullAddress += (fullAddress ? ', ' : '') + additionalAddress;
      if (city) fullAddress += (fullAddress ? ', ' : '') + city;
      if (postalCode) fullAddress += (fullAddress ? ' CP ' : 'CP ') + postalCode;
      
      // Build notes
      let notes = [];
      if (brandName) notes.push(`Marca: ${brandName}`);
      if (legalName && legalName !== brandName) notes.push(`Razón Social: ${legalName}`);
      if (rfc && rfc !== 'Pendiente') notes.push(`RFC: ${rfc}`);
      if (taxRegime) notes.push(`Régimen Fiscal: ${taxRegime}`);
      if (requiresInvoice) notes.push(`Facturación: ${requiresInvoice}`);
      if (position) notes.push(`Contacto: ${position}`);
      if (annualRevenue) notes.push(`Facturación Anual: $${parseFloat(annualRevenue).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
      if (marketingBudget) notes.push(`Presupuesto Marketing: $${parseFloat(marketingBudget).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
      
      const notesText = notes.join(' | ');
      const finalAddress = [fullAddress, notesText].filter(x => x).join(' | ');
      
      const phone = contactPhone || contactMobile;
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
      const monthlyIncome = annualRevenue && typeof annualRevenue === 'number' ? annualRevenue / 12 : null;
      
      try {
        const result = await client.query(`
          INSERT INTO customers (
            first_name, last_name, email, phone, address, employment, income
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, first_name, last_name
        `, [
          contactFirstName?.trim() || 'Sin Nombre',
          contactLastName?.trim() || brandName || legalName || 'Sin Apellido',
          contactEmail?.trim() || null,
          cleanPhone,
          finalAddress || null,
          position?.trim() || null,
          monthlyIncome
        ]);
        
        const displayName = brandName || `${result.rows[0].first_name} ${result.rows[0].last_name}`;
        console.log(`   ✅ ${result.rows[0].id}. ${displayName}`);
        customersImported++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        customersSkipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n   📊 Clientes importados: ${customersImported}`);
    console.log(`   ⏭️  Omitidos: ${customersSkipped}`);
    
    // ===== MIGRATE EMPLOYEES =====
    console.log('\n' + '='.repeat(70));
    console.log('👔 MIGRANDO EMPLEADOS...');
    console.log('='.repeat(70));
    
    const employeeSheet = workbook.Sheets['MINIONS'];
    const employeeRows = XLSX.utils.sheet_to_json(employeeSheet, { header: 1 }).slice(2);
    
    await client.query('BEGIN');
    
    let employeesImported = 0;
    let employeesSkipped = 0;
    
    const defaultPassword = 'zionx2024';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    for (let i = 0; i < employeeRows.length; i++) {
      const row = employeeRows[i];
      
      if (!row[0] && !row[1]) {
        employeesSkipped++;
        continue;
      }
      
      const name = row[0];
      const email = row[1];
      const phone = row[2];
      const roles = row[4];
      const department = row[5];
      
      if (!name || !email) {
        employeesSkipped++;
        continue;
      }
      
      const systemRole = determineSystemRole(roles);
      const permissions = getPermissions(systemRole);
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
      
      try {
        // Check if user already exists
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        
        if (existing.rows.length > 0) {
          console.log(`   ⏭️  ${name} (ya existe)`);
          employeesSkipped++;
          continue;
        }
        
        const result = await client.query(`
          INSERT INTO users (name, email, password, role, phone, department, permissions, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING id, name, email, role
        `, [
          name.trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          systemRole,
          cleanPhone,
          department?.trim() || null,
          JSON.stringify(permissions)
        ]);
        
        console.log(`   ✅ ${result.rows[0].id}. ${result.rows[0].name} (${result.rows[0].role})`);
        employeesImported++;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        employeesSkipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n   📊 Empleados importados: ${employeesImported}`);
    console.log(`   ⏭️  Omitidos: ${employeesSkipped}`);
    
    // ===== FINAL SUMMARY =====
    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRACIÓN A PRODUCCIÓN COMPLETADA');
    console.log('='.repeat(70));
    
    const finalCustomers = await client.query('SELECT COUNT(*) FROM customers');
    const finalUsers = await client.query('SELECT COUNT(*) FROM users');
    
    console.log(`\n📊 Estado final de la base de datos:`);
    console.log(`   Clientes totales: ${finalCustomers.rows[0].count}`);
    console.log(`   Usuarios totales: ${finalUsers.rows[0].count}`);
    
    console.log('\n🔐 Credenciales de empleados:');
    console.log(`   Password temporal para TODOS: "${defaultPassword}"`);
    console.log('   Cada empleado debe cambiar su contraseña.');
    
    console.log('\n🌐 Acceso al sistema:');
    console.log('   URL: https://zionx-marketing.vercel.app/');
    console.log('   (O tu URL de Vercel configurada)');
    
    console.log('\n🎉 ¡Tu equipo y clientes ya están en producción!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error en migración:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
    rl.close();
  }
}

// Run migration
console.log('\n📝 NOTA: Puedes pasar DATABASE_URL como argumento:');
console.log('   node migrate-to-production.js "postgresql://user:pass@host:port/db"\n');

migrateToProduction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    rl.close();
    process.exit(1);
  });
