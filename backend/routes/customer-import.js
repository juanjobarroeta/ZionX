const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/customers/import
 * Bulk import customers from Excel file
 */
router.post('/customers/import', upload.single('file'), async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    console.log('📤 Processing customer import file:', req.file.originalname);

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    
    // Get "Clientes" sheet (or first sheet if not found)
    const sheetName = workbook.SheetNames.includes('Clientes') 
      ? 'Clientes' 
      : workbook.SheetNames[0];
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Found ${data.length} rows in sheet "${sheetName}"`);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    await client.query('BEGIN');

    let importedCount = 0;
    let skippedCount = 0;
    let errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row number (accounting for header)

      try {
        // Validate required fields
        if (!row.first_name || !row.last_name) {
          errors.push(`Fila ${rowNum}: first_name y last_name son requeridos`);
          skippedCount++;
          continue;
        }

        if (!row.email && !row.phone) {
          errors.push(`Fila ${rowNum}: Debe tener email o phone`);
          skippedCount++;
          continue;
        }

        // Parse date if provided
        let dateOfBirth = null;
        if (row.date_of_birth) {
          // Handle Excel date serial number or string
          if (typeof row.date_of_birth === 'number') {
            const excelDate = XLSX.SSF.parse_date_code(row.date_of_birth);
            dateOfBirth = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
          } else {
            dateOfBirth = row.date_of_birth;
          }
        }

        // Insert customer
        const result = await client.query(`
          INSERT INTO customers (
            first_name, last_name, email, phone, address,
            curp, rfc, date_of_birth, occupation, monthly_income,
            notes, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
          RETURNING id, first_name, last_name, email
        `, [
          row.first_name?.trim(),
          row.last_name?.trim(),
          row.email?.trim() || null,
          row.phone?.trim() || null,
          row.address?.trim() || null,
          row.curp?.trim() || null,
          row.rfc?.trim() || null,
          dateOfBirth,
          row.occupation?.trim() || null,
          row.monthly_income ? parseFloat(row.monthly_income) : null,
          row.notes?.trim() || null
        ]);

        const customer = result.rows[0];

        // Create chart of accounts for this customer (for accounting integration)
        const customerId = customer.id;
        const idPadded = customerId.toString().padStart(4, '0');
        const fullName = `${customer.first_name} ${customer.last_name}`.trim();

        try {
          await client.query(`
            INSERT INTO chart_of_accounts (code, name, type, group_name, parent_code)
            VALUES 
              ($1, $2, 'asset', 'ACTIVO CIRCULANTE', '1103'),
              ($3, $4, 'revenue', 'INGRESOS', '4002'),
              ($5, $6, 'revenue', 'INGRESOS', '4100'),
              ($7, $8, 'expense', 'COSTOS', '5000')
            ON CONFLICT (code) DO NOTHING
          `, [
            `1103-${idPadded}`, `Cuenta por Cobrar - ${fullName}`,
            `4000-${idPadded}`, `Ventas - ${fullName}`,
            `4100-${idPadded}`, `Intereses - ${fullName}`,
            `5000-${idPadded}`, `Costo - ${fullName}`
          ]);
        } catch (coaError) {
          console.log(`⚠️ Chart of accounts creation skipped for customer ${customerId}`);
        }

        importedCount++;
        console.log(`✅ Imported: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})`);

      } catch (error) {
        console.error(`❌ Error importing row ${rowNum}:`, error.message);
        errors.push(`Fila ${rowNum}: ${error.message}`);
        skippedCount++;
      }
    }

    await client.query('COMMIT');

    console.log(`\n🎉 Import completed!`);
    console.log(`   ✅ Imported: ${importedCount} customers`);
    console.log(`   ⏭️  Skipped: ${skippedCount} rows`);
    if (errors.length > 0) {
      console.log(`   ⚠️  Errors: ${errors.length}`);
    }

    res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: data.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : [] // Return first 10 errors
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', error);
    res.status(500).json({ 
      error: 'Error al importar clientes', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/customers/template
 * Download customer import template
 */
router.get('/customers/template', (req, res) => {
  const templatePath = path.join(__dirname, '..', 'Plantilla_Importacion_Clientes.xlsx');
  res.download(templatePath, 'Plantilla_Importacion_Clientes.xlsx');
});

module.exports = router;




