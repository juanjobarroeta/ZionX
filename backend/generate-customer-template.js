const XLSX = require('xlsx');
const path = require('path');

// Generate Excel template for bulk customer import
function generateCustomerTemplate() {
  console.log('📋 Generating Customer Import Template...\n');

  // Template data with instructions and example
  const templateData = [
    {
      'first_name': 'Juan',
      'last_name': 'Pérez García',
      'email': 'juan.perez@empresa.com',
      'phone': '5512345678',
      'address': 'Av. Insurgentes Sur 123, Col. Roma, CDMX',
      'curp': 'PEGJ850315HDFRNN09',
      'rfc': 'PEGJ850315ABC',
      'date_of_birth': '1985-03-15',
      'occupation': 'Empresario',
      'monthly_income': '25000.00',
      'notes': 'Cliente potencial - Marketing digital'
    },
    {
      'first_name': 'María',
      'last_name': 'González López',
      'email': 'maria.gonzalez@ejemplo.com',
      'phone': '5587654321',
      'address': 'Calle Reforma 456, Col. Juárez, CDMX',
      'curp': 'GOLM900720MDFNPR08',
      'rfc': 'GOLM900720XYZ',
      'date_of_birth': '1990-07-20',
      'occupation': 'Directora de Marketing',
      'monthly_income': '45000.00',
      'notes': 'Interesada en Plan Premium'
    },
    {
      'first_name': 'Carlos',
      'last_name': 'Martínez Rodríguez',
      'email': 'carlos.martinez@negocio.com',
      'phone': '5598765432',
      'address': 'Blvd. Manuel Ávila Camacho 789, Naucalpan',
      'curp': 'MARC880512HDFRRD01',
      'rfc': 'MARC880512123',
      'date_of_birth': '1988-05-12',
      'occupation': 'Dueño de Restaurante',
      'monthly_income': '60000.00',
      'notes': 'Necesita gestión de redes sociales'
    }
  ];

  // Instructions sheet
  const instructions = [
    ['INSTRUCCIONES PARA IMPORTAR CLIENTES'],
    [''],
    ['1. Llena la hoja "Clientes" con la información de tus clientes'],
    ['2. Los campos REQUERIDOS son: first_name, last_name, email o phone (al menos uno)'],
    ['3. Los campos opcionales puedes dejarlos vacíos'],
    ['4. Formato de fecha: YYYY-MM-DD (ejemplo: 1985-03-15)'],
    ['5. Guarda el archivo Excel'],
    ['6. En la aplicación, ve a Clientes → Importar Clientes'],
    ['7. Sube este archivo'],
    [''],
    ['CAMPOS DISPONIBLES:'],
    [''],
    ['Campo', 'Requerido', 'Formato', 'Ejemplo'],
    ['first_name', 'SÍ', 'Texto', 'Juan'],
    ['last_name', 'SÍ', 'Texto', 'Pérez García'],
    ['email', 'Recomendado', 'Email válido', 'juan@empresa.com'],
    ['phone', 'Recomendado', '10 dígitos', '5512345678'],
    ['address', 'No', 'Texto', 'Av. Insurgentes 123'],
    ['curp', 'No', '18 caracteres', 'PEGJ850315HDFRNN09'],
    ['rfc', 'No', '12-13 caracteres', 'PEGJ850315ABC'],
    ['date_of_birth', 'No', 'YYYY-MM-DD', '1985-03-15'],
    ['occupation', 'No', 'Texto', 'Empresario'],
    ['monthly_income', 'No', 'Número', '25000.00'],
    ['notes', 'No', 'Texto', 'Cualquier nota sobre el cliente'],
    [''],
    ['IMPORTANTE:'],
    ['- NO modifiques los nombres de las columnas'],
    ['- NO agregues columnas adicionales'],
    ['- Los números de teléfono deben ser 10 dígitos sin espacios ni guiones'],
    ['- Las fechas deben estar en formato YYYY-MM-DD'],
    ['- Puedes eliminar las filas de ejemplo antes de importar']
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add instructions sheet
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  // Set column widths
  wsInstructions['!cols'] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');

  // Add template sheet with examples
  const wsTemplate = XLSX.utils.json_to_sheet(templateData);
  // Set column widths
  wsTemplate['!cols'] = [
    { wch: 15 },  // first_name
    { wch: 20 },  // last_name
    { wch: 30 },  // email
    { wch: 15 },  // phone
    { wch: 40 },  // address
    { wch: 20 },  // curp
    { wch: 15 },  // rfc
    { wch: 15 },  // date_of_birth
    { wch: 20 },  // occupation
    { wch: 15 },  // monthly_income
    { wch: 40 }   // notes
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Clientes');

  // Save file
  const filename = 'Plantilla_Importacion_Clientes.xlsx';
  const filepath = path.join(__dirname, filename);
  XLSX.writeFile(wb, filepath);

  console.log(`✅ Template created: ${filename}`);
  console.log(`📁 Location: ${filepath}`);
  console.log('');
  console.log('📊 Template includes:');
  console.log('   - Instrucciones sheet (with detailed guide)');
  console.log('   - Clientes sheet (with 3 example rows)');
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Open the Excel file');
  console.log('   2. Fill with your real customer data');
  console.log('   3. Use the import endpoint to upload');
  console.log('');
  console.log('💡 You can delete the example rows and add your own data');
}

generateCustomerTemplate();




