const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testConnection() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          PROBAR CONEXIÓN A RAILWAY                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🔍 Obtén tu DATABASE_URL fresco desde Railway:');
  console.log('   1. https://railway.app/dashboard');
  console.log('   2. Tu proyecto → PostgreSQL');
  console.log('   3. Tab "Variables"');
  console.log('   4. DATABASE_PUBLIC_URL o DATABASE_URL');
  console.log('   5. Click "Copy" 📋\n');
  
  const DATABASE_URL = await question('Pega tu DATABASE_URL aquí: ');
  
  if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL inválido. Debe empezar con postgresql://');
    rl.close();
    process.exit(1);
  }
  
  console.log('\n🔗 Probando conexión...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL.trim(),
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const client = await pool.connect();
    
    // Test query
    const result = await client.query('SELECT NOW(), current_database() as db');
    console.log('✅ ¡Conexión exitosa!\n');
    console.log('📊 Info de base de datos:');
    console.log(`   Database: ${result.rows[0].db}`);
    console.log(`   Time: ${result.rows[0].now}`);
    
    // Check existing data
    const customers = await client.query('SELECT COUNT(*) FROM customers');
    const users = await client.query('SELECT COUNT(*) FROM users');
    
    console.log('\n📈 Datos actuales en producción:');
    console.log(`   Clientes: ${customers.rows[0].count}`);
    console.log(`   Usuarios: ${users.rows[0].count}`);
    
    console.log('\n✅ La conexión funciona correctamente!');
    console.log('🚀 Ahora puedes ejecutar: node migrate-to-production.js');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 El password es incorrecto o cambió.');
      console.error('   1. Ve a Railway Dashboard');
      console.error('   2. PostgreSQL > Variables');
      console.error('   3. Verifica que estás copiando DATABASE_PUBLIC_URL');
      console.error('   4. Copia el valor más reciente');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 El host no se encuentra.');
      console.error('   1. Verifica que copiaste la URL completa');
      console.error('   2. Usa DATABASE_PUBLIC_URL (no DATABASE_URL interno)');
    } else {
      console.error('\n💡 Error desconocido. Verifica:');
      console.error('   1. Que Railway esté activo');
      console.error('   2. Que el servicio PostgreSQL esté corriendo');
      console.error('   3. Que copiaste la URL completa');
    }
    
    await pool.end();
    process.exit(1);
  } finally {
    rl.close();
  }
}

testConnection();
