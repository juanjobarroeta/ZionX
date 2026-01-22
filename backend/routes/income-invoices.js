const express = require('express');
const router = express.Router();

// Import helper functions from income.js
// These will be shared utilities

const IVA_RATE = 0.16; // Mexican VAT 16%

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function calculateIVA(amount) {
  return Math.round(amount * IVA_RATE * 100) / 100;
}

function calculateInvoiceTotals(subtotal, discountAmount = 0) {
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = calculateIVA(subtotalAfterDiscount);
  const total = subtotalAfterDiscount + taxAmount;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

async function generateInvoiceNumber(pool) {
  const result = await pool.query(`
    SELECT 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
           LPAD((COUNT(*) + 1)::text, 4, '0') as invoice_number
    FROM invoices 
    WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `);
  return result.rows[0].invoice_number;
}

// =====================================================
// ADD-ON PURCHASES ROUTES
// =====================================================

/**
 * GET /api/income/addon-purchases
 * Get addon purchases (optionally filter by customer or status)
 */
router.get('/addon-purchases', async (req, res) => {
  try {
    const { customer_id, status, billing_period } = req.query;
    
    let query = `
      SELECT 
        cap.*,
        sa.name as addon_name,
        sa.category as addon_category,
        c.first_name || ' ' || c.last_name as customer_name
      FROM customer_addon_purchases cap
      JOIN service_addons sa ON cap.addon_id = sa.id
      JOIN customers c ON cap.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND cap.customer_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND cap.status = $${params.length}`;
    }
    
    if (billing_period) {
      params.push(billing_period);
      query += ` AND cap.billing_period = $${params.length}`;
    }
    
    query += ' ORDER BY cap.created_at DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching addon purchases:', error);
    res.status(500).json({ error: 'Failed to fetch addon purchases' });
  }
});

/**
 * GET /api/income/addon-purchases/unbilled
 * Get addon purchases that haven't been invoiced yet
 */
router.get('/addon-purchases/unbilled', async (req, res) => {
  try {
    const { customer_id } = req.query;
    
    let query = `
      SELECT 
        cap.*,
        sa.name as addon_name,
        sa.category as addon_category,
        c.first_name || ' ' || c.last_name as customer_name
      FROM customer_addon_purchases cap
      JOIN service_addons sa ON cap.addon_id = sa.id
      JOIN customers c ON cap.customer_id = c.id
      WHERE cap.status IN ('approved', 'pending')
      AND NOT EXISTS (
        SELECT 1 FROM invoice_items ii 
        WHERE ii.reference_id = cap.id AND ii.reference_type = 'addon'
      )
    `;
    const params = [];
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND cap.customer_id = $${params.length}`;
    }
    
    query += ' ORDER BY cap.created_at';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching unbilled addons:', error);
    res.status(500).json({ error: 'Failed to fetch unbilled addons' });
  }
});

/**
 * POST /api/income/addon-purchases
 * Purchase an addon for a customer
 */
router.post('/addon-purchases', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      customer_id,
      subscription_id,
      addon_id,
      quantity = 1,
      custom_price, // Optional: override addon price
      description,
      project_id,
      task_id,
      billing_period, // 'YYYY-MM' for monthly addons
      is_recurring = false
    } = req.body;
    
    if (!customer_id || !addon_id) {
      return res.status(400).json({ error: 'customer_id and addon_id are required' });
    }
    
    // Get addon details
    const addonResult = await client.query(
      'SELECT * FROM service_addons WHERE id = $1 AND is_active = true',
      [addon_id]
    );
    
    if (!addonResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Add-on not found or inactive' });
    }
    
    const addon = addonResult.rows[0];
    const unit_price = custom_price || parseFloat(addon.price);
    const total_price = unit_price * quantity;
    
    // Determine initial status (pending if requires approval, approved otherwise)
    const initialStatus = addon.requires_approval ? 'pending' : 'approved';
    
    // Create the purchase record
    const result = await client.query(`
      INSERT INTO customer_addon_purchases (
        customer_id, subscription_id, addon_id,
        quantity, unit_price, total_price,
        description, project_id, task_id,
        billing_period, is_recurring, status,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      customer_id, subscription_id, addon_id,
      quantity, unit_price, total_price,
      description, project_id, task_id,
      billing_period, is_recurring, initialStatus,
      req.user.id
    ]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Created addon purchase ${result.rows[0].id} for customer ${customer_id}`);
    res.status(201).json({
      ...result.rows[0],
      addon_name: addon.name,
      needs_approval: addon.requires_approval
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating addon purchase:', error);
    res.status(500).json({ error: 'Failed to create addon purchase' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/income/addon-purchases/:id/approve
 * Approve a pending addon purchase
 */
router.post('/addon-purchases/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const result = await req.pool.query(`
      UPDATE customer_addon_purchases SET
        status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        description = CASE 
          WHEN $2 IS NOT NULL THEN COALESCE(description || E'\n', '') || 'Approval notes: ' || $2
          ELSE description
        END
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, notes, id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Addon purchase not found or already approved' });
    }
    
    console.log(`✅ Approved addon purchase ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving addon purchase:', error);
    res.status(500).json({ error: 'Failed to approve addon purchase' });
  }
});

/**
 * DELETE /api/income/addon-purchases/:id
 * Cancel/delete an addon purchase (only if not yet invoiced)
 */
router.delete('/addon-purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if already invoiced
    const checkResult = await req.pool.query(`
      SELECT 1 FROM invoice_items 
      WHERE reference_id = $1 AND reference_type = 'addon'
    `, [id]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete: addon already invoiced' });
    }
    
    const result = await req.pool.query(
      'UPDATE customer_addon_purchases SET status = $1 WHERE id = $2 RETURNING *',
      ['cancelled', id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Addon purchase not found' });
    }
    
    console.log(`✅ Cancelled addon purchase ${id}`);
    res.json({ message: 'Addon purchase cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling addon purchase:', error);
    res.status(500).json({ error: 'Failed to cancel addon purchase' });
  }
});

// =====================================================
// INVOICES ROUTES
// =====================================================

/**
 * GET /api/income/invoices
 * Get all invoices (with filters)
 */
router.get('/invoices', async (req, res) => {
  try {
    const { customer_id, status, from_date, to_date } = req.query;
    
    let query = `
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        (i.total - i.amount_paid) as amount_due,
        CASE 
          WHEN i.status = 'paid' THEN 'paid'
          WHEN i.due_date < CURRENT_DATE AND i.status != 'paid' AND i.status != 'cancelled' THEN 'overdue'
          ELSE i.status
        END as current_status
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND i.customer_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND i.status = $${params.length}`;
    }
    
    if (from_date) {
      params.push(from_date);
      query += ` AND i.invoice_date >= $${params.length}`;
    }
    
    if (to_date) {
      params.push(to_date);
      query += ` AND i.invoice_date <= $${params.length}`;
    }
    
    query += ' ORDER BY i.invoice_date DESC, i.id DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/income/invoices/pending
 * Get pending/unpaid invoices (uses view)
 */
router.get('/invoices/pending', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT * FROM v_pending_invoices 
      ORDER BY due_date, invoice_date
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    res.status(500).json({ error: 'Failed to fetch pending invoices' });
  }
});

/**
 * GET /api/income/invoices/overdue
 * Get overdue invoices
 */
router.get('/invoices/overdue', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        (i.total - i.amount_paid) as amount_due,
        (CURRENT_DATE - i.due_date) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.due_date < CURRENT_DATE 
        AND i.status NOT IN ('paid', 'cancelled')
        AND (i.total - i.amount_paid) > 0
      ORDER BY i.due_date
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

/**
 * GET /api/income/invoices/:id
 * Get single invoice with line items
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice
    const invoiceResult = await req.pool.query(`
      SELECT 
        i.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.address as customer_address,
        (i.total - i.amount_paid) as amount_due
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [id]);
    
    if (!invoiceResult.rows.length) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Get line items
    const itemsResult = await req.pool.query(`
      SELECT * FROM invoice_items 
      WHERE invoice_id = $1 
      ORDER BY display_order, id
    `, [id]);
    
    // Get payments
    const paymentsResult = await req.pool.query(`
      SELECT 
        ip.*,
        u.name as recorded_by_name
      FROM invoice_payments ip
      LEFT JOIN users u ON ip.created_by = u.id
      WHERE ip.invoice_id = $1
      ORDER BY ip.payment_date DESC, ip.created_at DESC
    `, [id]);
    
    const invoice = {
      ...invoiceResult.rows[0],
      items: itemsResult.rows,
      payments: paymentsResult.rows
    };
    
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * POST /api/income/invoices/generate
 * Generate invoice for a customer (manual or automated)
 */
router.post('/invoices/generate', async (req, res) => {
  const client = await req.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      customer_id,
      subscription_id,
      billing_period_start,
      billing_period_end,
      due_days = 15, // Days until due
      include_unbilled_addons = true,
      include_unbilled_hours = true,
      include_unbilled_expenses = true,
      custom_items = [], // Array of custom line items
      notes,
      auto_send = false
    } = req.body;
    
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    
    // Generate invoice number
    const invoice_number = await generateInvoiceNumber(client);
    const invoice_date = new Date();
    const due_date = new Date();
    due_date.setDate(due_date.getDate() + due_days);
    
    // Create invoice
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        invoice_number, customer_id, subscription_id,
        invoice_date, due_date,
        billing_period_start, billing_period_end,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)
      RETURNING *
    `, [
      invoice_number, customer_id, subscription_id,
      invoice_date, due_date,
      billing_period_start, billing_period_end,
      notes, req.user.id
    ]);
    
    const invoice_id = invoiceResult.rows[0].id;
    let line_items = [];
    let display_order = 0;
    
    // Add subscription if provided
    if (subscription_id) {
      const subResult = await client.query(`
        SELECT 
          cs.*,
          sp.name as package_name,
          sp.base_price,
          COALESCE(cs.custom_monthly_price, sp.base_price) as effective_price
        FROM customer_subscriptions cs
        JOIN service_packages sp ON cs.service_package_id = sp.id
        WHERE cs.id = $1
      `, [subscription_id]);
      
      if (subResult.rows.length > 0) {
        const sub = subResult.rows[0];
        const price = parseFloat(sub.effective_price);
        
        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, description,
            quantity, unit_price, subtotal, total,
            reference_id, reference_type, display_order
          ) VALUES ($1, 'subscription', $2, 1, $3, $3, $3, $4, 'subscription', $5)
        `, [
          invoice_id,
          `${sub.package_name} - ${billing_period_start || 'Mensualidad'}`,
          price,
          subscription_id,
          display_order++
        ]);
        
        line_items.push({
          type: 'subscription',
          description: sub.package_name,
          amount: price
        });
      }
    }
    
    // Add unbilled add-ons
    if (include_unbilled_addons) {
      const addonsResult = await client.query(`
        SELECT 
          cap.*,
          sa.name as addon_name
        FROM customer_addon_purchases cap
        JOIN service_addons sa ON cap.addon_id = sa.id
        WHERE cap.customer_id = $1
          AND cap.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM invoice_items ii 
            WHERE ii.reference_id = cap.id AND ii.reference_type = 'addon'
          )
        ORDER BY cap.created_at
      `, [customer_id]);
      
      for (const addon of addonsResult.rows) {
        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, description,
            quantity, unit_price, subtotal, total,
            reference_id, reference_type, display_order
          ) VALUES ($1, 'addon', $2, $3, $4, $5, $5, $6, 'addon', $7)
        `, [
          invoice_id,
          addon.description || addon.addon_name,
          addon.quantity,
          addon.unit_price,
          addon.total_price,
          addon.id,
          display_order++
        ]);
        
        line_items.push({
          type: 'addon',
          description: addon.addon_name,
          amount: parseFloat(addon.total_price)
        });
      }
    }
    
    // Add unbilled hours
    if (include_unbilled_hours) {
      const hoursResult = await client.query(`
        SELECT * FROM billable_time_entries
        WHERE customer_id = $1
          AND is_billable = true
          AND is_invoiced = false
        ORDER BY work_date
      `, [customer_id]);
      
      if (hoursResult.rows.length > 0) {
        const totalHours = hoursResult.rows.reduce((sum, h) => sum + parseFloat(h.hours), 0);
        const totalAmount = hoursResult.rows.reduce((sum, h) => sum + parseFloat(h.total_amount), 0);
        const avgRate = totalAmount / totalHours;
        
        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, description,
            quantity, unit_price, subtotal, total,
            reference_type, display_order
          ) VALUES ($1, 'hours', $2, $3, $4, $5, $5, 'time_entry', $6)
        `, [
          invoice_id,
          `Horas de consultoría (${hoursResult.rows.length} entradas)`,
          totalHours,
          avgRate,
          totalAmount,
          display_order++
        ]);
        
        // Mark hours as invoiced
        await client.query(`
          UPDATE billable_time_entries 
          SET is_invoiced = true, invoice_id = $1
          WHERE customer_id = $2 AND is_billable = true AND is_invoiced = false
        `, [invoice_id, customer_id]);
        
        line_items.push({
          type: 'hours',
          description: 'Horas billables',
          amount: totalAmount
        });
      }
    }
    
    // Add unbilled expenses
    if (include_unbilled_expenses) {
      const expensesResult = await client.query(`
        SELECT * FROM client_expenses
        WHERE customer_id = $1
          AND is_invoiced = false
        ORDER BY expense_date
      `, [customer_id]);
      
      for (const expense of expensesResult.rows) {
        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_type, description,
            quantity, unit_price, subtotal, total,
            reference_id, reference_type, display_order
          ) VALUES ($1, 'expense', $2, 1, $3, $3, $3, $4, 'client_expense', $5)
        `, [
          invoice_id,
          expense.description,
          expense.client_price,
          expense.id,
          display_order++
        ]);
        
        // Mark expense as invoiced
        await client.query(
          'UPDATE client_expenses SET is_invoiced = true, invoice_id = $1 WHERE id = $2',
          [invoice_id, expense.id]
        );
        
        line_items.push({
          type: 'expense',
          description: expense.description,
          amount: parseFloat(expense.client_price)
        });
      }
    }
    
    // Add custom items
    for (const item of custom_items) {
      const itemTotal = item.quantity * item.unit_price;
      await client.query(`
        INSERT INTO invoice_items (
          invoice_id, item_type, description,
          quantity, unit_price, subtotal, total, display_order
        ) VALUES ($1, 'custom', $2, $3, $4, $5, $5, $6)
      `, [
        invoice_id,
        item.description,
        item.quantity || 1,
        item.unit_price,
        itemTotal,
        display_order++
      ]);
      
      line_items.push({
        type: 'custom',
        description: item.description,
        amount: itemTotal
      });
    }
    
    // Calculate totals
    const itemsTotalResult = await client.query(
      'SELECT SUM(total) as subtotal FROM invoice_items WHERE invoice_id = $1',
      [invoice_id]
    );
    
    const subtotal = parseFloat(itemsTotalResult.rows[0].subtotal || 0);
    const totals = calculateInvoiceTotals(subtotal, 0);
    
    // Update invoice with totals
    await client.query(`
      UPDATE invoices SET
        subtotal = $1,
        tax_percentage = $2,
        tax_amount = $3,
        total = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [totals.subtotal, IVA_RATE * 100, totals.taxAmount, totals.total, invoice_id]);
    
    // Create accounting entries (revenue recognition)
    const customerCode = customer_id.toString().padStart(4, '0');
    await client.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES
        (CURRENT_DATE, $1, $2, $3, 0, 'invoice_generated', $4, $5),
        (CURRENT_DATE, $1, '4002', 0, $6, 'invoice_generated', $4, $5),
        (CURRENT_DATE, $1, '2003', 0, $7, 'invoice_generated', $4, $5)
    `, [
      `Factura ${invoice_number} - Cliente ${customer_id}`,
      `1103-${customerCode}`, // Debit: Accounts Receivable
      totals.total,
      invoice_id,
      req.user.id,
      totals.subtotal, // Credit: Revenue
      totals.taxAmount // Credit: IVA
    ]);
    
    await client.query('COMMIT');
    
    console.log(`✅ Generated invoice ${invoice_number} for customer ${customer_id}. Total: $${totals.total} MXN (including IVA)`);
    
    // If auto_send, mark as sent (in real implementation, send email/WhatsApp here)
    if (auto_send) {
      await req.pool.query(
        "UPDATE invoices SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = $1",
        [invoice_id]
      );
    }
    
    res.status(201).json({
      invoice_id,
      invoice_number,
      customer_id,
      subtotal: totals.subtotal,
      iva: totals.taxAmount,
      total: totals.total,
      line_items,
      status: auto_send ? 'sent' : 'draft'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice', details: error.message });
  } finally {
    client.release();
  }
});

// Continue in next message...
module.exports = router;

