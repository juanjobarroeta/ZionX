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
 * Migration script for ZIONX customer data
 * Maps business-focused data to the customer management system
 */
async function migrateZionxCustomers() {
  const client = await pool.connect();
  
  try {
    console.log('📖 Reading ZIONX customer data...');
    
    // Read the Excel file from Downloads
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Skip header rows (first 2 rows)
    const dataRows = rows.slice(2);
    
    console.log(`📊 Found ${dataRows.length} customers to migrate\n`);
    
    await client.query('BEGIN');
    
    let imported = 0;
    let skipped = 0;
    let errors = [];
    
    // Process each row within a transaction
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 3; // Excel row number (accounting for 2 header rows + 0-indexing)
      
      try {
        // Skip empty rows
        if (!row[1] && !row[2]) {
          skipped++;
          continue;
        }
        
        // Map columns from ZIONX format
        const requiresInvoice = row[0]; // "Requiere factura" / "No requiere factura"
        const brandName = row[1]; // MARCA
        const legalName = row[2]; // CLIENTE (legal name)
        const rfc = row[3]; // RFC
        const taxRegime = row[4]; // REGIMEN FISCAL
        const fiscalAddress = row[5]; // Dirección Fiscal
        const additionalAddress = row[6]; // Información adicional (dirección)
        const postalCode = row[7]; // CP
        const city = row[8]; // Ciudad
        const contactFirstName = row[9]; // Nombre del contacto
        const contactLastName = row[10]; // Apellidos del contacto
        const position = row[11]; // Puesto / Cargo
        const contactEmail = row[12]; // Email del contacto
        const contactPhone = row[13]; // Teléfono del contacto
        const contactMobile = row[14]; // Móvil del contacto
        const companySize = row[15]; // Tamaño de empresa
        const employeeCount = row[16]; // Número de empleados
        const annualRevenue = row[17]; // Facturación anual
        const marketingBudget = row[18]; // Presupuesto de Marketing
        const targetMarket = row[19]; // Mercado Objetivo
        const currentChannels = row[20]; // Canales actuales
        
        // Build full address
        let fullAddress = '';
        if (fiscalAddress) fullAddress += fiscalAddress;
        if (additionalAddress) fullAddress += (fullAddress ? ', ' : '') + additionalAddress;
        if (city) fullAddress += (fullAddress ? ', ' : '') + city;
        if (postalCode) fullAddress += (fullAddress ? ' CP ' : 'CP ') + postalCode;
        
        // Use contact phone or mobile
        const phone = contactPhone || contactMobile;
        
        // Build comprehensive notes
        let notes = [];
        if (brandName) notes.push(`Marca: ${brandName}`);
        if (legalName && legalName !== brandName) notes.push(`Razón Social: ${legalName}`);
        if (rfc && rfc !== 'Pendiente') notes.push(`RFC: ${rfc}`);
        if (taxRegime) notes.push(`Régimen Fiscal: ${taxRegime}`);
        if (requiresInvoice) notes.push(`Facturación: ${requiresInvoice}`);
        if (position) notes.push(`Contacto: ${position}`);
        if (companySize) notes.push(`Tamaño: ${companySize}`);
        if (employeeCount) notes.push(`Empleados: ${employeeCount}`);
        if (annualRevenue) notes.push(`Facturación Anual: $${parseFloat(annualRevenue).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
        if (marketingBudget) notes.push(`Presupuesto Marketing: $${parseFloat(marketingBudget).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
        if (targetMarket) notes.push(`Mercado Objetivo: ${targetMarket}`);
        if (currentChannels) notes.push(`Canales: ${currentChannels}`);
        
        const notesText = notes.join(' | ');
        
        // Calculate monthly income from annual revenue (if available)
        let monthlyIncome = null;
        if (annualRevenue && typeof annualRevenue === 'number') {
          monthlyIncome = annualRevenue / 12;
        }
        
        // Clean phone number (remove spaces, parentheses, dashes)
        let cleanPhone = null;
        if (phone) {
          cleanPhone = String(phone)
            .replace(/[\s\(\)\-\.]/g, '')
            .trim();
        }
        
        // Validate we have contact name
        if (!contactFirstName) {
          errors.push(`Fila ${rowNum}: Falta nombre de contacto para ${brandName || legalName}`);
          skipped++;
          continue;
        }
        
        // Build comprehensive address with business info
        let addressWithNotes = [];
        if (fullAddress) addressWithNotes.push(fullAddress);
        if (notesText) addressWithNotes.push(notesText);
        const finalAddress = addressWithNotes.join(' | ');
        
        // Insert customer (using actual table structure)
        const result = await client.query(`
          INSERT INTO customers (
            first_name,
            last_name,
            email,
            phone,
            address,
            employment,
            income,
            curp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, first_name, last_name
        `, [
          contactFirstName?.trim() || 'Sin Nombre',
          contactLastName?.trim() || brandName || legalName || 'Sin Apellido',
          contactEmail?.trim() || null,
          cleanPhone,
          finalAddress || null,
          position?.trim() || null,
          monthlyIncome,
          null // curp - not in source data
        ]);
        
        const customer = result.rows[0];
        const displayName = brandName || `${customer.first_name} ${customer.last_name}`;
        
        console.log(`   ✅ ${customer.id}. ${displayName} (${cleanPhone || contactEmail || 'Sin contacto'})`);
        imported++;
        
      } catch (error) {
        console.error(`   ❌ Error en fila ${rowNum}:`, error.message);
        errors.push(`Fila ${rowNum}: ${error.message}`);
        skipped++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migración completada!');
    console.log(`   📥 Importados: ${imported} clientes`);
    console.log(`   ⏭️  Omitidos: ${skipped} filas`);
    if (errors.length > 0) {
      console.log(`   ⚠️  Errores: ${errors.length}`);
      console.log('\nPrimeros errores:');
      errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    }
    console.log('='.repeat(60));
    
    // Show final count
    const count = await client.query('SELECT COUNT(*) FROM customers');
    console.log(`\n📊 Total de clientes en base de datos: ${count.rows[0].count}`);
    
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
migrateZionxCustomers()
  .then(() => {
    console.log('\n🎉 ¡Migración exitosa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error en migración:', error);
    process.exit(1);
  });
