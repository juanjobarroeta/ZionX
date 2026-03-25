const XLSX = require('xlsx');

/**
 * Preview ZIONX employee data migration
 * Shows what will be imported WITHOUT making database changes
 */
async function previewEmployeeMigration() {
  try {
    console.log('📖 Reading ZIONX employee data (MINIONS sheet)...\n');
    
    // Read the Excel file
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets['MINIONS'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Skip header rows (first 2 rows)
    const dataRows = rows.slice(2);
    
    console.log(`📊 Total registros encontrados: ${dataRows.length}\n`);
    console.log('='.repeat(90));
    console.log('PREVIEW DE MIGRACIÓN DE EMPLEADOS');
    console.log('='.repeat(90));
    console.log();
    
    let validCount = 0;
    let invalidCount = 0;
    
    dataRows.forEach((row, i) => {
      // Skip empty rows
      if (!row[0] && !row[1]) {
        invalidCount++;
        return;
      }
      
      const rowNum = i + 3;
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
      
      // Parse salary (handle formulas like "=(12500*2)")
      let monthlySalary = null;
      if (salary) {
        if (typeof salary === 'string' && salary.includes('=')) {
          // Extract formula like =(12500*2)
          const match = salary.match(/\((\d+)\s*\*\s*2\)/);
          if (match) {
            const biweekly = parseInt(match[1]);
            monthlySalary = biweekly * 2; // Convert to monthly
          }
        } else if (typeof salary === 'number') {
          monthlySalary = salary;
        }
      }
      
      // Determine system role based on position
      let systemRole = 'user';
      if (roles && typeof roles === 'string') {
        const rolesLower = roles.toLowerCase();
        if (rolesLower.includes('dirección general') || rolesLower.includes('director')) {
          systemRole = 'admin';
        } else if (rolesLower.includes('manager') || rolesLower.includes('project manager')) {
          systemRole = 'manager';
        }
      }
      
      // Clean phone
      let cleanPhone = null;
      if (phone) {
        cleanPhone = String(phone).replace(/[\s\(\)\-\.]/g, '');
      }
      
      // Validate required fields
      if (!name || !email) {
        console.log(`❌ Fila ${rowNum}: ${name || 'Sin nombre'}`);
        console.log(`   Problema: Falta ${!name ? 'nombre' : 'email'}`);
        console.log();
        invalidCount++;
        return;
      }
      
      validCount++;
      
      // Show what will be created
      console.log(`✅ ${validCount}. ${name}`);
      console.log(`   Email: ${email}`);
      console.log(`   Teléfono: ${cleanPhone || 'Sin teléfono'}`);
      console.log(`   Rol en sistema: ${systemRole}`);
      console.log(`   Departamento: ${department || 'No especificado'}`);
      console.log(`   Roles: ${roles || 'No especificado'}`);
      console.log(`   Tipo: ${empType || 'No especificado'}`);
      console.log(`   Salario mensual: ${monthlySalary ? `$${monthlySalary.toLocaleString('es-MX')}` : 'No especificado'}`);
      console.log(`   Fecha contratación: ${hireDate || 'No especificada'}`);
      console.log(`   RFC: ${rfc || 'Pendiente'}`);
      console.log(`   IMSS: ${imss || 'Pendiente'}`);
      console.log(`   Banco: ${bank || 'No especificado'}`);
      console.log();
    });
    
    console.log('='.repeat(90));
    console.log('RESUMEN');
    console.log('='.repeat(90));
    console.log(`✅ Empleados válidos: ${validCount}`);
    console.log(`❌ Registros inválidos/vacíos: ${invalidCount}`);
    console.log(`📊 Total: ${dataRows.length}`);
    console.log('='.repeat(90));
    console.log();
    console.log('🔐 IMPORTANTE: Los empleados se crearán con una contraseña temporal.');
    console.log('   Password por defecto: "zionx2024"');
    console.log('   Cada empleado deberá cambiar su contraseña al primer login.');
    console.log();
    console.log('💡 Para ejecutar la migración:');
    console.log('   node migrate-employees.js');
    console.log();
    
  } catch (error) {
    console.error('❌ Error en preview:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run preview
previewEmployeeMigration()
  .then(() => {
    console.log('✅ Preview completo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
