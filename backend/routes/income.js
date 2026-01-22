const express = require('express');
const router = express.Router();

// Note: Import pool and authenticateToken from your main index.js
// This will be integrated into your existing structure

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate IVA (Mexican VAT - 16%)
 */
function calculateIVA(amount) {
  const IVA_RATE = 0.16; // 16% IVA in Mexico
  return Math.round(amount * IVA_RATE * 100) / 100;
}

/**
 * Calculate invoice totals
 */
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

/**
 * Generate next invoice number
 */
async function generateInvoiceNumber(pool) {
  const result = await pool.query(`
    SELECT 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
           LPAD((COUNT(*) + 1)::text, 4, '0') as invoice_number
    FROM invoices 
    WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `);
  return result.rows[0].invoice_number;
}

/**
 * Create accounting entries for invoice payment
 */
async function createPaymentAccountingEntries(pool, invoiceId, paymentAmount, customerId, userId) {
  try {
    // Get invoice details to calculate IVA breakdown
    const invoiceResult = await pool.query(
      'SELECT subtotal, tax_amount, total FROM invoices WHERE id = $1',
      [invoiceId]
    );
    
    if (!invoiceResult.rows.length) {
      throw new Error('Invoice not found');
    }
    
    const invoice = invoiceResult.rows[0];
    const paymentRatio = paymentAmount / parseFloat(invoice.total);
    const revenueAmount = Math.round(parseFloat(invoice.subtotal) * paymentRatio * 100) / 100;
    const ivaAmount = Math.round(parseFloat(invoice.tax_amount) * paymentRatio * 100) / 100;
    
    const customerCode = customerId.toString().padStart(4, '0');
    
    // Double-entry bookkeeping for payment:
    // Debit: Bank Account (1002)
    // Credit: Customer Account (1103-XXXX) - Reduce receivable
    // Credit: IVA if this is the revenue recognition
    
    await pool.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES
        (CURRENT_DATE, $1, '1002', $2, 0, 'invoice_payment', $3, $4),
        (CURRENT_DATE, $1, $5, 0, $2, 'invoice_payment', $3, $4)
    `, [
      `Pago Factura - Cliente ${customerId}`,
      paymentAmount,
      invoiceId,
      userId,
      `1103-${customerCode}` // Customer receivables account
    ]);
    
    console.log(`✅ Created accounting entries for invoice ${invoiceId} payment of $${paymentAmount}`);
  } catch (error) {
    console.error('Error creating payment accounting entries:', error);
    throw error;
  }
}

/**
 * Create accounting entries when invoice is generated
 */
async function createInvoiceAccountingEntries(pool, invoiceId, customerId, subtotal, taxAmount, total, userId) {
  try {
    const customerCode = customerId.toString().padStart(4, '0');
    
    // Double-entry for invoice generation (Revenue Recognition):
    // Debit: Accounts Receivable (Customer Account) - They owe us
    // Credit: Revenue (Income from services)
    // Credit: IVA por Cobrar (Tax to collect)
    
    await pool.query(`
      INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES
        (CURRENT_DATE, $1, $2, $3, 0, 'invoice_generated', $4, $5),
        (CURRENT_DATE, $1, '4002', 0, $6, 'invoice_generated', $4, $5),
        (CURRENT_DATE, $1, '2003', 0, $7, 'invoice_generated', $4, $5)
    `, [
      `Factura generada - Cliente ${customerId}`,
      `1103-${customerCode}`, // Customer receivables
      total,
      invoiceId,
      userId,
      subtotal, // Revenue
      taxAmount // IVA
    ]);
    
    console.log(`✅ Created accounting entries for invoice ${invoiceId}`);
  } catch (error) {
    console.error('Error creating invoice accounting entries:', error);
    // Don't throw - invoice should still be created even if accounting fails
  }
}

// =====================================================
// SERVICE PACKAGES ROUTES
// =====================================================

/**
 * GET /api/income/packages
 * Get all active service packages
 */
router.get('/packages', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT * FROM service_packages 
      WHERE is_active = true 
      ORDER BY display_order, base_price
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service packages:', error);
    res.status(500).json({ error: 'Failed to fetch service packages' });
  }
});

/**
 * GET /api/income/packages/:id
 * Get single service package
 */
router.get('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await req.pool.query(
      'SELECT * FROM service_packages WHERE id = $1',
      [id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ error: 'Failed to fetch package' });
  }
});

/**
 * POST /api/income/packages
 * Create new service package
 */
router.post('/packages', async (req, res) => {
  try {
    const {
      name,
      description,
      base_price,
      billing_cycle = 'monthly',
      posts_per_month = 0,
      platforms_included = [],
      stories_per_week = 0,
      reels_per_month = 0,
      features = {}
    } = req.body;
    
    if (!name || !base_price) {
      return res.status(400).json({ error: 'Name and base_price are required' });
    }
    
    const result = await req.pool.query(`
      INSERT INTO service_packages (
        name, description, base_price, billing_cycle,
        posts_per_month, platforms_included, stories_per_week, reels_per_month,
        features, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name, description, base_price, billing_cycle,
      posts_per_month, platforms_included, stories_per_week, reels_per_month,
      JSON.stringify(features), req.user.id
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

/**
 * PUT /api/income/packages/:id
 * Update service package
 */
router.put('/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      base_price,
      billing_cycle,
      posts_per_month,
      platforms_included,
      stories_per_week,
      reels_per_month,
      features,
      is_active
    } = req.body;
    
    const result = await req.pool.query(`
      UPDATE service_packages SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        base_price = COALESCE($3, base_price),
        billing_cycle = COALESCE($4, billing_cycle),
        posts_per_month = COALESCE($5, posts_per_month),
        platforms_included = COALESCE($6, platforms_included),
        stories_per_week = COALESCE($7, stories_per_week),
        reels_per_month = COALESCE($8, reels_per_month),
        features = COALESCE($9, features),
        is_active = COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      name, description, base_price, billing_cycle,
      posts_per_month, platforms_included, stories_per_week, reels_per_month,
      features ? JSON.stringify(features) : null, is_active, id
    ]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ error: 'Failed to update package' });
  }
});

// =====================================================
// SERVICE ADD-ONS ROUTES
// =====================================================

/**
 * GET /api/income/addons
 * Get all active add-ons (optionally filter by category)
 */
router.get('/addons', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = 'SELECT * FROM service_addons WHERE is_active = true';
    const params = [];
    
    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY category, name';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching addons:', error);
    res.status(500).json({ error: 'Failed to fetch addons' });
  }
});

/**
 * GET /api/income/addons/categories
 * Get unique addon categories
 */
router.get('/addons/categories', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT DISTINCT category 
      FROM service_addons 
      WHERE is_active = true AND category IS NOT NULL
      ORDER BY category
    `);
    res.json(result.rows.map(r => r.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/income/addons
 * Create new add-on
 */
router.post('/addons', async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      pricing_type = 'fixed',
      billing_frequency = 'one-time',
      requires_approval = false
    } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const result = await req.pool.query(`
      INSERT INTO service_addons (
        name, description, category, price, pricing_type, 
        billing_frequency, requires_approval
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, description, category, price, pricing_type, billing_frequency, requires_approval]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating addon:', error);
    res.status(500).json({ error: 'Failed to create addon' });
  }
});

/**
 * PUT /api/income/addons/:id
 * Update add-on
 */
router.put('/addons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, pricing_type, billing_frequency, is_active } = req.body;
    
    const result = await req.pool.query(`
      UPDATE service_addons SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        price = COALESCE($4, price),
        pricing_type = COALESCE($5, pricing_type),
        billing_frequency = COALESCE($6, billing_frequency),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, description, category, price, pricing_type, billing_frequency, is_active, id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Add-on not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating addon:', error);
    res.status(500).json({ error: 'Failed to update addon' });
  }
});

// =====================================================
// CUSTOMER SUBSCRIPTIONS ROUTES
// =====================================================

/**
 * GET /api/income/subscriptions
 * Get all subscriptions (optionally filter by customer or status)
 */
router.get('/subscriptions', async (req, res) => {
  try {
    const { customer_id, status } = req.query;
    
    let query = `
      SELECT 
        cs.*,
        sp.name as package_name,
        sp.base_price as package_base_price,
        COALESCE(c.business_name, c.first_name || ' ' || c.last_name) as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        COALESCE(cs.custom_monthly_price, sp.base_price) as effective_monthly_price
      FROM customer_subscriptions cs
      JOIN service_packages sp ON cs.service_package_id = sp.id
      JOIN customers c ON cs.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND cs.customer_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND cs.status = $${params.length}`;
    }
    
    query += ' ORDER BY cs.created_at DESC';
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * GET /api/income/subscriptions/active
 * Get active subscriptions with details (uses view)
 */
router.get('/subscriptions/active', async (req, res) => {
  try {
    const result = await req.pool.query('SELECT * FROM v_active_subscriptions ORDER BY customer_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching active subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch active subscriptions' });
  }
});

/**
 * GET /api/income/subscriptions/:id
 * Get single subscription with full details
 */
router.get('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      SELECT 
        cs.*,
        sp.name as package_name,
        sp.description as package_description,
        sp.base_price as package_base_price,
        sp.posts_per_month,
        sp.platforms_included,
        sp.features as package_features,
        c.first_name || ' ' || c.last_name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        COALESCE(cs.custom_monthly_price, sp.base_price) as effective_monthly_price
      FROM customer_subscriptions cs
      JOIN service_packages sp ON cs.service_package_id = sp.id
      JOIN customers c ON cs.customer_id = c.id
      WHERE cs.id = $1
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/income/subscriptions
 * Create new customer subscription with direct monthly amount
 */
router.post('/subscriptions', async (req, res) => {
  try {
    const {
      customer_id,
      service_package_id,
      monthly_amount,       // Direct monthly amount (primary way)
      start_date = new Date(),
      custom_monthly_price, // Legacy field - kept for compatibility
      billing_cycle = 'monthly',
      description,
      notes
    } = req.body;
    
    // Require customer_id and either monthly_amount or a package
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }
    
    // Use monthly_amount or custom_monthly_price
    const effectiveMonthlyPrice = monthly_amount || custom_monthly_price;
    
    if (!effectiveMonthlyPrice && !service_package_id) {
      return res.status(400).json({ error: 'monthly_amount or service_package_id is required' });
    }
    
    // Verify customer exists
    const customerCheck = await req.pool.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (!customerCheck.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // If package is provided, verify it exists
    let packageId = service_package_id;
    if (service_package_id) {
      const packageCheck = await req.pool.query('SELECT id FROM service_packages WHERE id = $1', [service_package_id]);
      if (!packageCheck.rows.length) {
        return res.status(404).json({ error: 'Service package not found' });
      }
    } else {
      // Use a default "Custom" package or create one
      const customPackage = await req.pool.query(`
        INSERT INTO service_packages (name, description, base_price, billing_cycle, is_active)
        VALUES ('Plan Personalizado', $1, $2, $3, true)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [description || 'Suscripción personalizada', effectiveMonthlyPrice, billing_cycle]);
      
      if (customPackage.rows.length) {
        packageId = customPackage.rows[0].id;
      } else {
        // Get existing custom package or first available
        const existingPackage = await req.pool.query(`SELECT id FROM service_packages LIMIT 1`);
        packageId = existingPackage.rows[0]?.id || 1;
      }
    }
    
    // Calculate next billing date
    const startDateObj = new Date(start_date);
    let nextBillingDate = new Date(startDateObj);
    
    if (billing_cycle === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (billing_cycle === 'quarterly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
    } else if (billing_cycle === 'annual') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }
    
    const result = await req.pool.query(`
      INSERT INTO customer_subscriptions (
        customer_id, service_package_id, start_date, next_billing_date,
        custom_monthly_price, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      customer_id, packageId, start_date, nextBillingDate,
      effectiveMonthlyPrice, notes || description, req.user.id
    ]);
    
    console.log(`✅ Created subscription ${result.rows[0].id} for customer ${customer_id} at ${effectiveMonthlyPrice}/month`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * DELETE /api/income/subscriptions/:id
 * Permanently delete a subscription
 */
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await req.pool.query(`
      DELETE FROM customer_subscriptions WHERE id = $1 RETURNING id
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    console.log(`🗑️ Deleted subscription ${id}`);
    res.json({ message: 'Subscription deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

/**
 * PUT /api/income/subscriptions/:id
 * Update subscription
 */
router.put('/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      custom_monthly_price,
      discount_percentage,
      custom_posts_per_month,
      custom_platforms,
      custom_features,
      notes,
      end_date,
      next_billing_date
    } = req.body;
    
    const result = await req.pool.query(`
      UPDATE customer_subscriptions SET
        status = COALESCE($1, status),
        custom_monthly_price = COALESCE($2, custom_monthly_price),
        discount_percentage = COALESCE($3, discount_percentage),
        custom_posts_per_month = COALESCE($4, custom_posts_per_month),
        custom_platforms = COALESCE($5, custom_platforms),
        custom_features = COALESCE($6, custom_features),
        notes = COALESCE($7, notes),
        end_date = COALESCE($8, end_date),
        next_billing_date = COALESCE($10, next_billing_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      status, custom_monthly_price, discount_percentage,
      custom_posts_per_month, custom_platforms,
      custom_features ? JSON.stringify(custom_features) : null,
      notes, end_date, id, next_billing_date
    ]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * POST /api/income/subscriptions/:id/cancel
 * Cancel a subscription
 */
router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await req.pool.query(`
      UPDATE customer_subscriptions SET
        status = 'cancelled',
        end_date = CURRENT_DATE,
        notes = CASE 
          WHEN notes IS NULL THEN $1
          ELSE notes || E'\n\nCancellation: ' || $1
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [reason || 'Subscription cancelled', id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    console.log(`✅ Cancelled subscription ${id}`);
    res.json({ message: 'Subscription cancelled successfully', subscription: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Continue in next file...
module.exports = router;

