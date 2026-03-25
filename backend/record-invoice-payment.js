const { Pool } = require('pg');
const readline = require('readline');

const DATABASE_URL = process.env.PROD_DATABASE_URL || process.argv[2] || "postgresql://postgres:DZbeIbXnuegyTbUViwfCdcHkEzmsHvqN@interchange.proxy.rlwy.net:33454/railway";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Record an invoice payment with proper accounting
 * This script helps you record when a customer pays an invoice
 * It creates the correct journal entries to update Bank/Cash and reduce receivables
 */
async function recordPayment() {
  const client = await pool.connect();
  
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           REGISTRAR PAGO DE FACTURA                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Get list of invoices
    const invoices = await client.query(`
      SELECT 
        i.id,
        i.invoice_number,
        c.first_name || ' ' || c.last_name as customer_name,
        i.total,
        i.status,
        COALESCE(SUM(ip.amount), 0) as paid,
        i.total - COALESCE(SUM(ip.amount), 0) as pending
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN invoice_payments ip ON i.invoice_id = ip.invoice_id
      WHERE i.status IN ('pending', 'sent', 'overdue', 'partially_paid')
      GROUP BY i.id, i.invoice_number, c.first_name, c.last_name, i.total, i.status
      ORDER BY i.invoice_date DESC
      LIMIT 20
    `);
    
    if (invoices.rows.length === 0) {
      console.log('⚠️  No hay facturas pendientes de pago.\n');
      rl.close();
      await pool.end();
      return;
    }
    
    console.log('📋 FACTURAS PENDIENTES:\n');
    invoices.rows.forEach((inv, i) => {
      console.log(`${i + 1}. ${inv.invoice_number} - ${inv.customer_name}`);
      console.log(`   Total: $${parseFloat(inv.total).toFixed(2)} | Pagado: $${parseFloat(inv.paid).toFixed(2)} | Pendiente: $${parseFloat(inv.pending).toFixed(2)}`);
      console.log();
    });
    
    const invoiceNum = await question('Número de factura (o ID): ');
    const amount = await question('Monto del pago: $');
    const paymentMethod = await question('Método de pago (transferencia/efectivo/tarjeta): ');
    const reference = await question('Referencia/No. de transacción (opcional): ');
    
    // Find invoice
    const invoice = await client.query(`
      SELECT i.*, c.id as customer_id
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.invoice_number = $1 OR i.id::text = $1
    `, [invoiceNum]);
    
    if (invoice.rows.length === 0) {
      console.log('❌ Factura no encontrada.');
      rl.close();
      await pool.end();
      return;
    }
    
    const inv = invoice.rows[0];
    const paymentAmount = parseFloat(amount);
    
    await client.query('BEGIN');
    
    // 1. Record payment in invoice_payments
    const paymentResult = await client.query(`
      INSERT INTO invoice_payments (
        invoice_id, amount, payment_method, payment_date, reference_number
      ) VALUES ($1, $2, $3, CURRENT_DATE, $4)
      RETURNING id
    `, [inv.id, paymentAmount, paymentMethod, reference || null]);
    
    const paymentId = paymentResult.rows[0].id;
    
    // 2. Create accounting entries
    const accountCode = paymentMethod === 'efectivo' ? '1101' : '1102'; // Cash or Bank
    const customerCode = `1103-${inv.customer_id.toString().padStart(4, '0')}`;
    
    // Debit: Bank/Cash (increases cash)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
      VALUES (CURRENT_DATE, $1, $2, $3, 0, 'invoice_payment', $4)
    `, [`Cobro Factura ${inv.invoice_number}`, accountCode, paymentAmount, paymentId]);
    
    // Credit: Customer Receivables (reduces what customer owes)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id)
      VALUES (CURRENT_DATE, $1, $2, 0, $3, 'invoice_payment', $4)
    `, [`Cobro Factura ${inv.invoice_number}`, customerCode, paymentAmount, paymentId]);
    
    // 3. Update invoice status
    const totalPaid = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoice_payments
      WHERE invoice_id = $1
    `, [inv.id]);
    
    const paidAmount = parseFloat(totalPaid.rows[0].total);
    const invoiceTotal = parseFloat(inv.total);
    
    let newStatus = 'sent';
    if (paidAmount >= invoiceTotal) {
      newStatus = 'paid';
    } else if (paidAmount > 0) {
      newStatus = 'partially_paid';
    }
    
    await client.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, inv.id]);
    
    await client.query('COMMIT');
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                 ✅ PAGO REGISTRADO EXITOSAMENTE                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n📄 Factura: ${inv.invoice_number}`);
    console.log(`💵 Monto pagado: $${paymentAmount.toFixed(2)}`);
    console.log(`🏦 Método: ${paymentMethod}`);
    console.log(`📊 Total pagado: $${paidAmount.toFixed(2)} / $${invoiceTotal.toFixed(2)}`);
    console.log(`📈 Estado: ${newStatus}`);
    console.log();
    console.log('📒 Asientos contables creados:');
    console.log(`   Debe: ${accountCode} (${paymentMethod === 'efectivo' ? 'Caja' : 'Banco'}) - $${paymentAmount.toFixed(2)}`);
    console.log(`   Haber: ${customerCode} (Cliente) - $${paymentAmount.toFixed(2)}`);
    console.log();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    rl.close();
  }
}

recordPayment();
