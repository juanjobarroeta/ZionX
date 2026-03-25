const XLSX = require('xlsx');
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
 * Export imported employees to Excel for review
 */
async function exportEmployees() {
  const client = await pool.connect();
  
  try {
    console.log('📖 Reading employees from database...');
    
    // Get all users except the original admin
    const result = await client.query(`
      SELECT 
        id,
        name,
        email,
        role,
        phone,
        department,
        permissions,
        is_active,
        created_at
      FROM users 
      WHERE id > 1
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          ELSE 3 
        END,
        id
    `);
    
    console.log(`📊 Found ${result.rows.length} employees\n`);
    
    // Read original data from MINIONS sheet for additional info
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets['MINIONS'];
    const originalRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(2);
    
    // Create map of email to original data
    const originalDataMap = {};
    originalRows.forEach(row => {
      const email = row[1];
      if (email) {
        originalDataMap[email.toLowerCase()] = {
          roles: row[4],
          empType: row[6],
          salary: row[7],
          bank: row[8],
          clabe: row[9],
          rfc: row[10],
          curp: row[11],
          imss: row[12],
          hireDate: row[3]
        };
      }
    });
    
    // Parse salary
    const parseSalary = (salaryValue) => {
      if (!salaryValue) return '';
      if (typeof salaryValue === 'number') return `$${salaryValue.toLocaleString('es-MX')}`;
      if (typeof salaryValue === 'string') {
        const match = salaryValue.match(/\((\d+)\s*\*\s*2\)/);
        if (match) {
          const biweekly = parseInt(match[1]);
          const monthly = biweekly * 2;
          return `$${monthly.toLocaleString('es-MX')}`;
        }
      }
      return salaryValue;
    };
    
    const exportData = result.rows.map(user => {
      const original = originalDataMap[user.email.toLowerCase()] || {};
      
      return {
        'ID Sistema': user.id,
        'Nombre Completo': user.name,
        'Email': user.email,
        'Teléfono': user.phone || '',
        'Rol en Sistema': user.role,
        'Departamento': user.department || '',
        'Posiciones': original.roles || '',
        'Tipo Empleado': original.empType || '',
        'Salario Mensual': parseSalary(original.salary),
        'Fecha Contratación': original.hireDate || '',
        'RFC': original.rfc || 'Pendiente',
        'CURP': original.curp || 'Pendiente',
        'IMSS': original.imss || 'Pendiente',
        'Banco': original.bank || '',
        'CLABE': original.clabe || '',
        'Estado': user.is_active ? 'Activo' : 'Inactivo',
        'Fecha Importación': user.created_at.toISOString().split('T')[0],
        'Password Temporal': 'zionx2024'
      };
    });
    
    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // ID
      { wch: 35 }, // Nombre
      { wch: 30 }, // Email
      { wch: 15 }, // Teléfono
      { wch: 10 }, // Rol
      { wch: 20 }, // Departamento
      { wch: 40 }, // Posiciones
      { wch: 15 }, // Tipo
      { wch: 15 }, // Salario
      { wch: 18 }, // Contratación
      { wch: 15 }, // RFC
      { wch: 20 }, // CURP
      { wch: 15 }, // IMSS
      { wch: 12 }, // Banco
      { wch: 22 }, // CLABE
      { wch: 10 }, // Estado
      { wch: 18 }, // Fecha Import
      { wch: 15 }  // Password
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados ZIONX');
    
    // Save file
    const outputPath = '/Users/juanjosebarroeta/Downloads/EMPLEADOS_ZIONX_IMPORTADOS.xlsx';
    XLSX.writeFile(wb, outputPath);
    
    console.log('✅ Archivo exportado exitosamente!');
    console.log(`📁 Ubicación: ${outputPath}`);
    console.log(`📊 Total de empleados: ${exportData.length}`);
    console.log('\n⚠️  IMPORTANTE: Este archivo contiene passwords temporales.');
    console.log('    Manténlo seguro y elimínalo después de distribuir credenciales.');
    console.log('\n💡 Usa este archivo para enviar credenciales a cada empleado.');
    
  } catch (error) {
    console.error('❌ Error al exportar:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run export
exportEmployees()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
