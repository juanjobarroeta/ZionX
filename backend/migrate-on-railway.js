const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * This script is designed to run ON Railway
 * It uses Railway's environment variables automatically
 * 
 * USAGE:
 * 1. Upload this file to your Railway backend
 * 2. Upload BASE DE DATOS ZIONX.xlsx to Railway
 * 3. Run via Railway shell or create temporary endpoint
 */

// Use Railway's environment variable
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment!');
  console.error('💡 This script should run ON Railway where DATABASE_URL is available.');
  process.exit(1);
}

console.log('✅ DATABASE_URL found in environment');
console.log(`🔗 Connecting to: ${DATABASE_URL.substring(0, 30)}...`);

/**
 * Helper functions
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
 * Main migration
 */
async function migrateOnRailway() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        MIGRACIÓN EN RAILWAY - ZIONX Marketing                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  // Check if Excel file exists
  const excelPath = path.join(__dirname, 'BASE_DE_DATOS_ZIONX.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.error('❌ Error: BASE_DE_DATOS_ZIONX.xlsx no encontrado');
    console.error('📝 Sube el archivo Excel a la carpeta backend en Railway');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    console.log('✅ Conectado a base de datos de producción\n');
    
    // Read Excel
    const workbook = XLSX.readFile(excelPath);
    
    // ===== CUSTOMERS =====
    console.log('👥 IMPORTANDO CLIENTES...\n');
    
    const customerSheet = workbook.Sheets['CLIENTES'];
    const customerRows = XLSX.utils.sheet_to_json(customerSheet, { header: 1 }).slice(2);
    
    await client.query('BEGIN');
    
    let customersImported = 0;
    
    for (const row of customerRows) {
      if (!row[1] && !row[2]) continue;
      if (!row[9]) continue; // Need contact name
      
      const brandName = row[1];
      const contactFirstName = row[9];
      const contactLastName = row[10];
      const contactPhone = row[13] || row[14];
      const contactEmail = row[12];
      const rfc = row[3];
      const taxRegime = row[4];
      const requiresInvoice = row[0];
      const marketingBudget = row[18];
      
      const cleanPhone = contactPhone ? String(contactPhone).replace(/[\s\(\)\-\.]/g, '') : null;
      
      const notes = [
        brandName ? `Marca: ${brandName}` : '',
        rfc && rfc !== 'Pendiente' ? `RFC: ${rfc}` : '',
        taxRegime ? `Régimen: ${taxRegime}` : '',
        requiresInvoice ? `Facturación: ${requiresInvoice}` : '',
        marketingBudget ? `Presupuesto: $${marketingBudget}` : ''
      ].filter(x => x).join(' | ');
      
      try {
        const result = await client.query(`
          INSERT INTO customers (first_name, last_name, email, phone, address)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          contactFirstName?.trim(),
          contactLastName?.trim() || brandName,
          contactEmail?.trim() || null,
          cleanPhone,
          notes
        ]);
        
        console.log(`   ✅ ${result.rows[0].id}. ${brandName || contactFirstName}`);
        customersImported++;
      } catch (err) {
        console.log(`   ⏭️  Error: ${err.message}`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n   📊 Total clientes: ${customersImported}\n`);
    
    // ===== EMPLOYEES =====
    console.log('👔 IMPORTANDO EMPLEADOS...\n');
    
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
      
      const systemRole = determineSystemRole(roles);
      const permissions = getPermissions(systemRole);
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
      
      try {
        // Check if exists
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (existing.rows.length > 0) {
          console.log(`   ⏭️  ${name} (ya existe)`);
          continue;
        }
        
        const result = await client.query(`
          INSERT INTO users (name, email, password, role, phone, department, permissions, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING id, name, role
        `, [name.trim(), email.trim().toLowerCase(), hashedPassword, systemRole, cleanPhone, department?.trim(), JSON.stringify(permissions)]);
        
        console.log(`   ✅ ${result.rows[0].id}. ${result.rows[0].name} (${result.rows[0].role})`);
        employeesImported++;
      } catch (err) {
        console.log(`   ⏭️  Error: ${err.message}`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n   📊 Total empleados: ${employeesImported}\n`);
    
    // Summary
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ MIGRACIÓN EXITOSA                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Base de datos de producción:`);
    console.log(`   Clientes: ${customerCount.rows[0].count}`);
    console.log(`   Usuarios: ${userCount.rows[0].count}`);
    console.log('\n🎉 ¡Datos en producción!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateOnRailway()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
