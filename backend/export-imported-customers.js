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
 * Export imported ZIONX customers to Excel for review
 */
async function exportCustomers() {
  const client = await pool.connect();
  
  try {
    console.log('📖 Reading customers from database...');
    
    const result = await client.query(`
      SELECT 
        id,
        first_name,
        last_name,
        phone,
        email,
        address,
        employment,
        income,
        curp,
        created_at
      FROM customers 
      WHERE id <= 18
      ORDER BY id
    `);
    
    console.log(`📊 Found ${result.rows.length} customers\n`);
    
    // Parse business information from address field
    const exportData = result.rows.map(customer => {
      const addr = customer.address || '';
      
      // Extract fields from address
      const extractField = (fieldName) => {
        const regex = new RegExp(`${fieldName}: ([^|]+)`);
        const match = addr.match(regex);
        return match ? match[1].trim() : '';
      };
      
      return {
        'ID': customer.id,
        'Marca': extractField('Marca'),
        'Razón Social': extractField('Razón Social'),
        'RFC': extractField('RFC'),
        'Régimen Fiscal': extractField('Régimen Fiscal'),
        'Nombre Contacto': customer.first_name,
        'Apellidos Contacto': customer.last_name,
        'Puesto': customer.employment || '',
        'Teléfono': customer.phone || '',
        'Email': customer.email || '',
        'Requiere Factura': extractField('Facturación'),
        'Presupuesto Marketing': extractField('Presupuesto Marketing'),
        'Facturación Anual': extractField('Facturación Anual'),
        'Tamaño Empresa': extractField('Tamaño'),
        'Número Empleados': extractField('Empleados'),
        'Mercado Objetivo': extractField('Mercado Objetivo'),
        'Canales Actuales': extractField('Canales'),
        'Ingreso Mensual Estimado': customer.income ? `$${customer.income.toFixed(2)}` : '',
        'Fecha de Importación': customer.created_at.toISOString().split('T')[0]
      };
    });
    
    // Create workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // ID
      { wch: 25 }, // Marca
      { wch: 35 }, // Razón Social
      { wch: 15 }, // RFC
      { wch: 45 }, // Régimen Fiscal
      { wch: 20 }, // Nombre Contacto
      { wch: 20 }, // Apellidos Contacto
      { wch: 15 }, // Puesto
      { wch: 15 }, // Teléfono
      { wch: 30 }, // Email
      { wch: 20 }, // Requiere Factura
      { wch: 20 }, // Presupuesto Marketing
      { wch: 20 }, // Facturación Anual
      { wch: 15 }, // Tamaño Empresa
      { wch: 15 }, // Número Empleados
      { wch: 20 }, // Mercado Objetivo
      { wch: 20 }, // Canales Actuales
      { wch: 25 }, // Ingreso Mensual
      { wch: 18 }  // Fecha de Importación
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes Importados');
    
    // Save file
    const outputPath = '/Users/juanjosebarroeta/Downloads/CLIENTES_ZIONX_IMPORTADOS.xlsx';
    XLSX.writeFile(wb, outputPath);
    
    console.log('✅ Archivo exportado exitosamente!');
    console.log(`📁 Ubicación: ${outputPath}`);
    console.log(`📊 Total de clientes: ${exportData.length}`);
    console.log('\n💡 Abre el archivo en Excel para revisar todos los detalles.');
    
  } catch (error) {
    console.error('❌ Error al exportar:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run export
exportCustomers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
