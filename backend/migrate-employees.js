const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
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
 * Parse salary from Excel formula or number
 * Formulas like "=(12500*2)" mean biweekly salary (quincenal)
 * Result is monthly salary
 */
function parseSalary(salaryValue) {
  if (!salaryValue) return null;
  
  if (typeof salaryValue === 'number') {
    return salaryValue;
  }
  
  if (typeof salaryValue === 'string') {
    // Handle formula like "=(12500*2)"
    const match = salaryValue.match(/\((\d+)\s*\*\s*2\)/);
    if (match) {
      const biweekly = parseInt(match[1]);
      return biweekly * 2; // Convert to monthly (2 quincenas)
    }
    
    // Try to parse as number
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
function getPermissions(role, department) {
  const basePermissions = {
    canViewDashboard: true,
    canAccessCRM: true,
    canManageCustomers: false,
    canViewProjects: true,
    canCreateProjects: false,
    canManageContent: false,
    canViewReports: false,
    canManageUsers: false,
    canViewFinancials: false
  };
  
  if (role === 'admin') {
    return {
      ...basePermissions,
      canManageCustomers: true,
      canCreateProjects: true,
      canManageContent: true,
      canViewReports: true,
      canManageUsers: true,
      canViewFinancials: true,
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
  
  // Regular user - adjust based on department
  if (department) {
    const deptLower = department.toLowerCase();
    if (deptLower.includes('creativo') || deptLower.includes('producción')) {
      basePermissions.canManageContent = true;
    }
    if (deptLower.includes('social media')) {
      basePermissions.canManageContent = true;
    }
  }
  
  return basePermissions;
}

/**
 * Migration script for ZIONX employees
 */
async function migrateEmployees() {
  const client = await pool.connect();
  
  try {
    console.log('📖 Reading ZIONX employee data (MINIONS sheet)...');
    
    // Read the Excel file
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets['MINIONS'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Skip header rows (first 2 rows)
    const dataRows = rows.slice(2);
    
    console.log(`📊 Found ${dataRows.length} records to process\n`);
    
    await client.query('BEGIN');
    
    let imported = 0;
    let skipped = 0;
    let errors = [];
    
    // Default password for all employees (they should change it)
    const defaultPassword = 'zionx2024';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 3;
      
      try {
        // Skip empty rows
        if (!row[0] && !row[1]) {
          skipped++;
          continue;
        }
        
        // Map columns
        const name = row[0];
        const email = row[1];
        const phone = row[2];
        const hireDate = row[3];
        const roles = row[4];
        const department = row[5];
        const empType = row[6];
        const salary = row[7];
        const bank = row[8];
        const clabe = row[9];
        const rfc = row[10];
        const curp = row[11];
        const imss = row[12];
        
        // Validate required fields
        if (!name || !email) {
          errors.push(`Fila ${rowNum}: Falta ${!name ? 'nombre' : 'email'} para ${name || email}`);
          skipped++;
          continue;
        }
        
        // Process data
        const monthlySalary = parseSalary(salary);
        const systemRole = determineSystemRole(roles);
        const permissions = getPermissions(systemRole, department);
        
        // Clean phone
        const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
        
        // Clean CLABE
        const cleanClabe = clabe ? String(clabe).replace(/[\s\-]/g, '') : null;
        
        // Build employee info notes
        let employeeInfo = [];
        if (roles) employeeInfo.push(`Roles: ${roles}`);
        if (empType) employeeInfo.push(`Tipo: ${empType}`);
        if (monthlySalary) employeeInfo.push(`Salario: $${monthlySalary.toLocaleString('es-MX')}`);
        if (bank) employeeInfo.push(`Banco: ${bank}`);
        if (cleanClabe) employeeInfo.push(`CLABE: ${cleanClabe}`);
        if (rfc) employeeInfo.push(`RFC: ${rfc}`);
        if (curp) employeeInfo.push(`CURP: ${curp}`);
        if (imss) employeeInfo.push(`IMSS: ${imss}`);
        if (hireDate) employeeInfo.push(`Contratación: ${hireDate}`);
        
        // Insert user
        const result = await client.query(`
          INSERT INTO users (
            name,
            email,
            password,
            role,
            phone,
            department,
            permissions,
            is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
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
        
        const user = result.rows[0];
        console.log(`   ✅ ${user.id}. ${user.name}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Dept: ${department || 'N/A'}`);
        console.log(`      Salary: ${monthlySalary ? '$' + monthlySalary.toLocaleString('es-MX') : 'N/A'}`);
        console.log();
        
        imported++;
        
      } catch (error) {
        console.error(`   ❌ Error en fila ${rowNum}:`, error.message);
        errors.push(`Fila ${rowNum}: ${error.message}`);
        skipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Migración de empleados completada!');
    console.log(`   📥 Importados: ${imported} empleados`);
    console.log(`   ⏭️  Omitidos: ${skipped} filas`);
    if (errors.length > 0) {
      console.log(`   ⚠️  Errores: ${errors.length}`);
      console.log('\nPrimeros errores:');
      errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    }
    console.log('='.repeat(70));
    
    // Show final counts by role
    const roleCount = await client.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY role
    `);
    
    console.log('\n📊 Usuarios por rol:');
    roleCount.rows.forEach(r => {
      console.log(`   ${r.role}: ${r.count}`);
    });
    
    const totalUsers = await client.query('SELECT COUNT(*) FROM users');
    console.log(`\n📊 Total de usuarios en sistema: ${totalUsers.rows[0].count}`);
    
    console.log('\n🔐 IMPORTANTE: Credenciales de acceso');
    console.log('=' .repeat(70));
    console.log(`   Password temporal para TODOS: "${defaultPassword}"`);
    console.log('   Cada empleado debe cambiar su contraseña al primer login.');
    console.log('='.repeat(70));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migración fallida:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
migrateEmployees()
  .then(() => {
    console.log('\n🎉 ¡Migración de empleados exitosa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error en migración:', error);
    process.exit(1);
  });
