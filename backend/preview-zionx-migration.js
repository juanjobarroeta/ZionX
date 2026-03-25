const XLSX = require('xlsx');

/**
 * Preview ZIONX customer data migration
 * Shows what will be imported WITHOUT making database changes
 * No database connection required - just reads the Excel file
 */
async function previewMigration() {
  try {
    console.log('📖 Reading ZIONX customer data...\n');
    
    // Read the Excel file
    const workbook = XLSX.readFile('/Users/juanjosebarroeta/Downloads/BASE DE DATOS ZIONX.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Skip header rows
    const dataRows = rows.slice(2);
    
    console.log(`📊 Total registros encontrados: ${dataRows.length}\n`);
    console.log('='.repeat(80));
    console.log('PREVIEW DE MIGRACIÓN');
    console.log('='.repeat(80));
    console.log();
    
    let validCount = 0;
    let invalidCount = 0;
    
    dataRows.forEach((row, i) => {
      // Skip empty rows
      if (!row[1] && !row[2]) {
        invalidCount++;
        return;
      }
      
      const rowNum = i + 3;
      const brandName = row[1];
      const legalName = row[2];
      const rfc = row[3];
      const taxRegime = row[4];
      const fiscalAddress = row[5];
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
      
      // Build display
      const displayBrand = brandName || legalName || 'Sin Marca';
      const phone = contactPhone || contactMobile;
      const cleanPhone = phone ? String(phone).replace(/[\s\(\)\-\.]/g, '') : 'Sin teléfono';
      const email = contactEmail || 'Sin email';
      
      // Check if valid
      const hasContact = contactFirstName;
      const hasPhoneOrEmail = phone || contactEmail;
      
      if (!hasContact || !hasPhoneOrEmail) {
        console.log(`❌ Fila ${rowNum}: ${displayBrand}`);
        console.log(`   Problema: ${!hasContact ? 'Falta nombre de contacto' : 'Falta teléfono/email'}`);
        console.log();
        invalidCount++;
        return;
      }
      
      validCount++;
      
      // Show what will be created
      console.log(`✅ ${validCount}. ${displayBrand}`);
      console.log(`   Contacto: ${contactFirstName} ${contactLastName || ''}`);
      console.log(`   RFC: ${rfc === 'Pendiente' ? '(Sin RFC)' : rfc || '(Sin RFC)'}`);
      console.log(`   Teléfono: ${cleanPhone}`);
      console.log(`   Email: ${email}`);
      
      if (annualRevenue) {
        const monthly = parseFloat(annualRevenue) / 12;
        console.log(`   Facturación: $${parseFloat(annualRevenue).toLocaleString('es-MX', { minimumFractionDigits: 2 })} anual (~$${monthly.toLocaleString('es-MX', { minimumFractionDigits: 2 })} mensual)`);
      }
      
      if (marketingBudget) {
        console.log(`   Presupuesto Marketing: $${parseFloat(marketingBudget).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
      }
      
      console.log(`   Facturación: ${requiresInvoice || 'No especificado'}`);
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log('RESUMEN');
    console.log('='.repeat(80));
    console.log(`✅ Registros válidos: ${validCount}`);
    console.log(`❌ Registros inválidos/vacíos: ${invalidCount}`);
    console.log(`📊 Total: ${dataRows.length}`);
    console.log('='.repeat(80));
    console.log();
    console.log('💡 Para ejecutar la migración, ejecuta:');
    console.log('   node migrate-zionx-customers.js');
    console.log();
    
  } catch (error) {
    console.error('❌ Error en preview:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run preview
previewMigration()
  .then(() => {
    console.log('✅ Preview completo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
