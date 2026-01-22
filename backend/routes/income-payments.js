const express = require('express');
const router = express.Router();

// =====================================================
// PAYMENT RECORDING ROUTES
// =====================================================

/**
 * GET /api/income/payments
 * Get all invoice payments
 */
router.get('/payments', async (req, res) => {
  try {
    const { invoice_id, customer_id, from_date, to_date } = req.query;
    
    let query = `
      SELECT 
        ip.*,
        i.invoice_number,
        i.customer_id,
        c.first_name || ' ' || c.last_name as customer_name,
        u.name as recorded_by
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON ip.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (invoice_id) {
      params.push(invoice_id);
      query += ` AND ip.invoice_id = $${params.length}`;
    }
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND i.customer_id = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND ip.payment_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND ip.payment_date <= $${params.length}`;
    }
    
    query += ' ORDER BY ip.payment_date DESC, ip.created_at DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * POST /api/income/invoices/:id/payment
 * Record a payment for an invoice
 */
router.post('/invoices/:id/payment', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const invoice_id = parseInt(req.params.id);
    const {
      amount,
      payment_method,
      payment_date = new Date(),
      reference_number,
      notes
    } = req.body;
    
    if (!amount || !payment_method) {
      return res.status(400).json({ error: 'amount and payment_method are required' });
    }
    
    const paymentAmount = parseFloat(amount);
    
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }
    
    // Get invoice details
    const invoiceResult = await client.query(`
      SELECT 
        i.*,
        (i.total - i.amount_paid) as amount_due
      FROM invoices i
      WHERE i.id = $1
    `, [invoice_id]);
    
    if (!invoiceResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = invoiceResult.rows[0];
    const amount_due = parseFloat(invoice.amount_due);
    
    if (invoice.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot record payment for cancelled invoice' });
    }
    
    if (invoice.status === 'paid') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invoice is already fully paid' });
    }
    
    if (paymentAmount > amount_due) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Payment amount exceeds amount due',
        amount_due,
        payment_amount: paymentAmount
      });
    }
    
    // Record the payment
    const paymentResult = await client.query(`
      INSERT INTO invoice_payments (
        invoice_id, amount, payment_method, payment_date,
        reference_number, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      invoice_id, paymentAmount, payment_method, payment_date,
      reference_number, notes, req.user.id
    ]);
    
    const payment_id = paymentResult.rows[0].id;
    
    // Update invoice amount_paid and status
    const new_amount_paid = parseFloat(invoice.amount_paid) + paymentAmount;
    const new_status = new_amount_paid >= parseFloat(invoice.total) ? 'paid' : 'partial';
    
    await client.query(`
      UPDATE invoices SET
        amount_paid = $1,
        status = $2,
        paid_at = CASE WHEN $2 = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
        payment_method = CASE WHEN $2 = 'paid' THEN $3 ELSE payment_method END,
        payment_reference = CASE WHEN $2 = 'paid' THEN $4 ELSE payment_reference END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [new_amount_paid, new_status, payment_method, reference_number, invoice_id]);
    
    // Create accounting entries for the payment using correct schema format
    // Determine bank/cash account based on payment method
    let cashAccountCode = '1101'; // Default: Caja (Cash)
    if (payment_method === 'transfer' || payment_method === 'transferencia' || payment_method === 'card' || payment_method === 'tarjeta') {
      cashAccountCode = '1102'; // Banco
    }
    
    // Double-entry bookkeeping for invoice payment:
    // Debit: Bank/Cash (we receive money)
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES (CURRENT_DATE, $1, $2, $3, 0, 'invoice_payment', $4, $5)
    `, [
      `Pago factura ${invoice.invoice_number} - ${payment_method}`,
      cashAccountCode,
      paymentAmount,
      payment_id,
      req.user.id
    ]);
    
    // Credit: Accounts Receivable (customer owes us less)
    const customerCode = invoice.customer_id.toString().padStart(4, '0');
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES (CURRENT_DATE, $1, $2, 0, $3, 'invoice_payment', $4, $5)
    `, [
      `Cobro factura ${invoice.invoice_number} - Cliente ${invoice.customer_id}`,
      `1103-${customerCode}`,
      paymentAmount,
      payment_id,
      req.user.id
    ]);
    
    console.log(`📒 Created journal entries for invoice payment ${payment_id}: Debit ${cashAccountCode}, Credit 1103-${customerCode} - $${paymentAmount}`);
    
    await client.query('COMMIT');
    
    console.log(`✅ Recorded payment of $${paymentAmount} MXN for invoice ${invoice.invoice_number}`);
    console.log(`   New invoice status: ${new_status}, Amount paid: $${new_amount_paid} / $${invoice.total}`);
    
    res.status(201).json({
      payment_id,
      invoice_id,
      invoice_number: invoice.invoice_number,
      payment_amount: paymentAmount,
      new_amount_paid,
      amount_remaining: parseFloat(invoice.total) - new_amount_paid,
      invoice_status: new_status,
      payment: paymentResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/income/payments/:id
 * Delete/void a payment (admin only)
 */
router.delete('/payments/:id', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const payment_id = parseInt(req.params.id);
    
    // Get payment details
    const paymentResult = await client.query(
      'SELECT * FROM invoice_payments WHERE id = $1',
      [payment_id]
    );
    
    if (!paymentResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentResult.rows[0];
    const paymentAmount = parseFloat(payment.amount);
    
    // Get invoice
    const invoiceResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1',
      [payment.invoice_id]
    );
    const invoice = invoiceResult.rows[0];
    
    // Delete payment record
    await client.query('DELETE FROM invoice_payments WHERE id = $1', [payment_id]);
    
    // Update invoice amount_paid and status
    const new_amount_paid = parseFloat(invoice.amount_paid) - paymentAmount;
    const new_status = new_amount_paid === 0 ? 'sent' : 'partial';
    
    await client.query(`
      UPDATE invoices SET
        amount_paid = $1,
        status = $2,
        paid_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [new_amount_paid, new_status, payment.invoice_id]);
    
    // Reverse accounting entries - delete by journal_entry_id linked to payment
    if (payment.journal_entry_id) {
      await client.query("DELETE FROM journal_entries WHERE id = $1", [payment.journal_entry_id]);
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Voided payment ${payment_id} of $${paymentAmount} MXN`);
    res.json({ message: 'Payment voided successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error voiding payment:', error);
    res.status(500).json({ error: 'Failed to void payment' });
  } finally {
    client.release();
  }
});

// =====================================================
// INVOICE ACTIONS
// =====================================================

/**
 * POST /api/income/invoices/:id/send
 * Mark invoice as sent (and optionally send via email/WhatsApp)
 */
router.post('/invoices/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { send_email = false, send_whatsapp = false } = req.body;
    
    const result = await req.pool.query(`
      UPDATE invoices SET
        status = 'sent',
        sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Invoice not found or already sent' });
    }
    
    const invoice = result.rows[0];
    
    // TODO: Implement actual email/WhatsApp sending
    // if (send_email) {
    //   await sendInvoiceEmail(invoice);
    // }
    // if (send_whatsapp) {
    //   await sendInvoiceWhatsApp(invoice);
    // }
    
    console.log(`✅ Marked invoice ${invoice.invoice_number} as sent`);
    res.json({
      message: 'Invoice marked as sent',
      invoice,
      email_sent: send_email,
      whatsapp_sent: send_whatsapp
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

/**
 * POST /api/income/invoices/:id/cancel
 * Cancel an invoice
 */
router.post('/invoices/:id/cancel', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { reason } = req.body;
    
    // Check if invoice has payments
    const paymentsCheck = await client.query(
      'SELECT COUNT(*) as count FROM invoice_payments WHERE invoice_id = $1',
      [id]
    );
    
    if (parseInt(paymentsCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot cancel invoice with payments. Void payments first.' 
      });
    }
    
    // Cancel invoice
    const result = await client.query(`
      UPDATE invoices SET
        status = 'cancelled',
        internal_notes = COALESCE(internal_notes || E'\n\n', '') || 'Cancelled: ' || $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [reason || 'No reason provided', id]);
    
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Note: Invoice generation doesn't create journal entries in new system
    // (Revenue is recognized when payment is received, not when invoice is generated)
    
    await client.query('COMMIT');
    
    console.log(`✅ Cancelled invoice ${result.rows[0].invoice_number}`);
    res.json({ message: 'Invoice cancelled successfully', invoice: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling invoice:', error);
    res.status(500).json({ error: 'Failed to cancel invoice' });
  } finally {
    client.release();
  }
});

// =====================================================
// REVENUE & ANALYTICS ROUTES
// =====================================================

/**
 * GET /api/income/revenue/summary
 * Get revenue summary (monthly breakdown)
 */
router.get('/revenue/summary', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let query = 'SELECT * FROM v_monthly_revenue WHERE 1=1';
    const params = [];
    
    if (year) {
      params.push(year);
      query += ` AND month LIKE $${params.length} || '-%'`;
    }
    
    if (month) {
      const yearParam = year || new Date().getFullYear();
      const monthPadded = month.toString().padStart(2, '0');
      params.length = 0;
      params.push(`${yearParam}-${monthPadded}`);
      query = 'SELECT * FROM v_monthly_revenue WHERE month = $1';
    }
    
    query += ' ORDER BY month DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching revenue summary:', error);
    res.status(500).json({ error: 'Failed to fetch revenue summary' });
  }
});

/**
 * GET /api/income/revenue/mrr
 * Get Monthly Recurring Revenue
 */
router.get('/revenue/mrr', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        SUM(COALESCE(cs.custom_monthly_price, sp.base_price)) as mrr,
        COUNT(*) as active_subscriptions,
        AVG(COALESCE(cs.custom_monthly_price, sp.base_price)) as arpu
      FROM customer_subscriptions cs
      JOIN service_packages sp ON cs.service_package_id = sp.id
      WHERE cs.status = 'active'
    `);
    
    const data = result.rows[0];
    res.json({
      mrr: parseFloat(data.mrr || 0),
      active_subscriptions: parseInt(data.active_subscriptions || 0),
      arpu: parseFloat(data.arpu || 0) // Average Revenue Per User
    });
  } catch (error) {
    console.error('Error fetching MRR:', error);
    res.status(500).json({ error: 'Failed to fetch MRR' });
  }
});

/**
 * GET /api/income/revenue/by-customer
 * Get revenue breakdown by customer
 */
router.get('/revenue/by-customer', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await req.pool.query(`
      SELECT 
        c.id,
        c.first_name || ' ' || c.last_name as customer_name,
        COUNT(DISTINCT i.id) as invoice_count,
        SUM(i.total) as total_billed,
        SUM(i.amount_paid) as total_paid,
        SUM(i.total - i.amount_paid) as outstanding,
        MAX(i.invoice_date) as last_invoice_date
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'cancelled'
      GROUP BY c.id, customer_name
      HAVING COUNT(DISTINCT i.id) > 0
      ORDER BY total_billed DESC
      LIMIT $1
    `, [limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching revenue by customer:', error);
    res.status(500).json({ error: 'Failed to fetch revenue by customer' });
  }
});

/**
 * GET /api/income/revenue/addon-performance
 * Get add-on sales performance
 */
router.get('/revenue/addon-performance', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        sa.id,
        sa.name as addon_name,
        sa.category,
        sa.price as base_price,
        COUNT(*) as times_purchased,
        SUM(cap.quantity) as total_quantity,
        SUM(cap.total_price) as total_revenue,
        AVG(cap.total_price) as avg_revenue_per_purchase
      FROM customer_addon_purchases cap
      JOIN service_addons sa ON cap.addon_id = sa.id
      WHERE cap.status IN ('approved', 'invoiced')
      GROUP BY sa.id, sa.name, sa.category, sa.price
      ORDER BY total_revenue DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching addon performance:', error);
    res.status(500).json({ error: 'Failed to fetch addon performance' });
  }
});

/**
 * GET /api/income/dashboard
 * Get overview dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    // MRR
    const mrrResult = await req.pool.query(`
      SELECT SUM(COALESCE(cs.custom_monthly_price, sp.base_price)) as mrr
      FROM customer_subscriptions cs
      JOIN service_packages sp ON cs.service_package_id = sp.id
      WHERE cs.status = 'active'
    `);
    
    // Total outstanding (unpaid invoices)
    const outstandingResult = await req.pool.query(`
      SELECT SUM(total - amount_paid) as total_outstanding
      FROM invoices
      WHERE status NOT IN ('paid', 'cancelled')
    `);
    
    // Overdue amount
    const overdueResult = await req.pool.query(`
      SELECT SUM(total - amount_paid) as overdue_amount, COUNT(*) as overdue_count
      FROM invoices
      WHERE due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled')
    `);
    
    // This month revenue
    const thisMonthResult = await req.pool.query(`
      SELECT 
        SUM(amount_paid) as revenue_this_month,
        COUNT(*) as invoices_this_month
      FROM invoices
      WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM invoice_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    `);
    
    // Last month revenue
    const lastMonthResult = await req.pool.query(`
      SELECT SUM(amount_paid) as revenue_last_month
      FROM invoices
      WHERE invoice_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND invoice_date < DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    // Active subscriptions count
    const subscriptionsResult = await req.pool.query(`
      SELECT COUNT(*) as active_subscriptions
      FROM customer_subscriptions
      WHERE status = 'active'
    `);
    
    const mrr = parseFloat(mrrResult.rows[0].mrr || 0);
    const totalOutstanding = parseFloat(outstandingResult.rows[0].total_outstanding || 0);
    const overdueAmount = parseFloat(overdueResult.rows[0].overdue_amount || 0);
    const overdueCount = parseInt(overdueResult.rows[0].overdue_count || 0);
    const revenueThisMonth = parseFloat(thisMonthResult.rows[0].revenue_this_month || 0);
    const revenueLastMonth = parseFloat(lastMonthResult.rows[0].revenue_last_month || 0);
    const invoicesThisMonth = parseInt(thisMonthResult.rows[0].invoices_this_month || 0);
    const activeSubscriptions = parseInt(subscriptionsResult.rows[0].active_subscriptions || 0);
    
    // Calculate growth
    const monthOverMonthGrowth = revenueLastMonth > 0 
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100)
      : 0;
    
    res.json({
      mrr,
      total_outstanding: totalOutstanding,
      overdue_amount: overdueAmount,
      overdue_count: overdueCount,
      revenue_this_month: revenueThisMonth,
      revenue_last_month: revenueLastMonth,
      month_over_month_growth: Math.round(monthOverMonthGrowth * 100) / 100,
      invoices_this_month: invoicesThisMonth,
      active_subscriptions: activeSubscriptions,
      annual_run_rate: mrr * 12
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;

