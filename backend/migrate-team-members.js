const XLSX = require('xlsx');
const { Pool } = require('pg');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function parseSalary(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const match = String(val).match(/\((\d+)\s*\*\s*2\)/);
  if (match) return parseInt(match[1]) * 2;
  return parseFloat(String(val).replace(/[^0-9.]/g, '')) || null;
}

function parseHireDate(val) {
  if (!val) return null;
  
  // Handle Excel date serial
  if (typeof val === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(val);
    return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
  }
  
  // Handle string dates like "18-11-2019" (DD-MM-YYYY)
  if (typeof val === 'string') {
    const parts = val.split('-');
    if (parts.length === 3 && parts[0].length <= 2) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  
  return null;
}

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('👔 MIGRATING TO team_members TABLE...\n');
    
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets['MINIONS'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(2);
    
    let imported = 0;
    
    for (const row of rows) {
      if (!row[0] || !row[1]) continue;
      
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
      
      const monthlySalary = parseSalary(salary);
      const parsedHireDate = parseHireDate(hireDate);
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : null;
      const cleanClabe = clabe ? String(clabe).replace(/[\s\-]/g, '') : null;
      
      // Get corresponding user_id
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;
      
      try {
        // Check if already exists
        const existing = await client.query('SELECT id FROM team_members WHERE email = $1', [email.trim().toLowerCase()]);
        if (existing.rows.length > 0) {
          console.log(`   ⏭️  ${name.substring(0, 35)} (already exists)`);
          continue;
        }
        
        const result = await client.query(`
          INSERT INTO team_members (
            user_id, name, email, role, department, phone,
            employee_type, hire_date, monthly_wage, payment_frequency,
            bank_name, clabe, rfc, curp, imss_number,
            is_active, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, 'active')
          RETURNING id, name, monthly_wage
        `, [
          userId,
          name.trim(),
          email.trim().toLowerCase(),
          roles?.substring(0, 100) || null,
          department?.trim() || null,
          cleanPhone,
          empType === 'TIEMPO COMPLETO' ? 'full_time' : 'project_based',
          parsedHireDate,
          monthlySalary,
          'monthly',
          bank?.trim() || null,
          cleanClabe,
          rfc?.trim() || null,
          curp?.trim() || null,
          imss ? String(imss) : null
        ]);
        
        console.log(`   ✅ ${imported + 1}. ${name.substring(0, 40)} - $${result.rows[0].monthly_wage || 0}/mes`);
        imported++;
      } catch (err) {
        console.log(`   ❌ ${name.substring(0, 40)}: ${err.message}`);
      }
    }
    
    console.log(`\n   📊 Empleados migrados a team_members: ${imported}\n`);
    
    const count = await client.query('SELECT COUNT(*) FROM team_members');
    const total = await client.query('SELECT SUM(monthly_wage) as total_payroll FROM team_members WHERE is_active = true');
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║            ✅ MIGRACIÓN A team_members EXITOSA                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Total team_members en producción: ${count.rows[0].count}`);
    console.log(`💰 Nómina mensual total: $${parseFloat(total.rows[0].total_payroll || 0).toLocaleString('es-MX')}`);
    console.log(`\n🌐 Refresca Vercel y ve a la página de Empleados/Equipo (/people)`);
    console.log(`   ¡Deberías ver ${count.rows[0].count} empleados ahora!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
