/**
 * Integration Script for Income Management Routes
 * 
 * This file contains all income management routes ready to be added to index.js
 * 
 * INSTRUCTIONS:
 * 1. Copy the helper functions to the top of index.js (after imports)
 * 2. Copy all routes to index.js (after existing routes)
 * 3. Or: require this file in index.js with: require('./integrate-income-routes')(app, pool, authenticateToken);
 */

module.exports = function(app, pool, authenticateToken) {
  
  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================
  
  const IVA_RATE = 0.16; // Mexican VAT 16%
  
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
  
  async function generateInvoiceNumber(poolClient) {
    const result = await poolClient.query(`
      SELECT 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
             LPAD((COUNT(*) + 1)::text, 4, '0') as invoice_number
      FROM invoices 
      WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
    return result.rows[0].invoice_number;
  }
  
  // =====================================================
  // SERVICE PACKAGES ROUTES
  // =====================================================
  
  app.get('/api/income/packages', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM service_packages 
        WHERE is_active = true 
        ORDER BY display_order, base_price
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching packages:', error);
      res.status(500).json({ error: 'Failed to fetch packages' });
    }
  });
  
  app.post('/api/income/packages', authenticateToken, async (req, res) => {
    try {
      const {
        name, description, base_price, billing_cycle = 'monthly',
        posts_per_month = 0, platforms_included = [],
        stories_per_week = 0, reels_per_month = 0, features = {}
      } = req.body;
      
      if (!name || !base_price) {
        return res.status(400).json({ error: 'Name and base_price are required' });
      }
      
      const result = await pool.query(`
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
  
  // =====================================================
  // ADD-ONS ROUTES
  // =====================================================
  
  app.get('/api/income/addons', authenticateToken, async (req, res) => {
    try {
      const { category } = req.query;
      
      let query = 'SELECT * FROM service_addons WHERE is_active = true';
      const params = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY category, name';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching addons:', error);
      res.status(500).json({ error: 'Failed to fetch addons' });
    }
  });
  
  app.post('/api/income/addons', authenticateToken, async (req, res) => {
    try {
      const {
        name, description, category, price,
        pricing_type = 'fixed',
        billing_frequency = 'one-time',
        requires_approval = false
      } = req.body;
      
      if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
      }
      
      const result = await pool.query(`
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
  
  // =====================================================
  // SUBSCRIPTIONS ROUTES
  // =====================================================
  
  app.get('/api/income/subscriptions', authenticateToken, async (req, res) => {
    try {
      const { customer_id, status } = req.query;
      
      let query = `
        SELECT 
          cs.*,
          sp.name as package_name,
          c.first_name || ' ' || c.last_name as customer_name,
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
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });
  
  app.post('/api/income/subscriptions', authenticateToken, async (req, res) => {
    try {
      const {
        customer_id, service_package_id,
        start_date = new Date(),
        custom_monthly_price, notes
      } = req.body;
      
      if (!customer_id || !service_package_id) {
        return res.status(400).json({ error: 'customer_id and service_package_id are required' });
      }
      
      // Calculate next billing date
      const nextBillingDate = new Date(start_date);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      
      const result = await pool.query(`
        INSERT INTO customer_subscriptions (
          customer_id, service_package_id, start_date, next_billing_date,
          custom_monthly_price, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [customer_id, service_package_id, start_date, nextBillingDate, custom_monthly_price, notes, req.user.id]);
      
      console.log(`✅ Created subscription for customer ${customer_id}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating subscription:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });
  
  // =====================================================
  // ADD-ON PURCHASES
  // =====================================================
  
  app.get('/api/income/addon-purchases/unbilled', authenticateToken, async (req, res) => {
    try {
      const { customer_id } = req.query;
      
      let query = `
        SELECT 
          cap.*,
          sa.name as addon_name,
          c.first_name || ' ' || c.last_name as customer_name
        FROM customer_addon_purchases cap
        JOIN service_addons sa ON cap.addon_id = sa.id
        JOIN customers c ON cap.customer_id = c.id
        WHERE cap.status = 'approved'
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
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching unbilled addons:', error);
      res.status(500).json({ error: 'Failed to fetch unbilled addons' });
    }
  });
  
  app.post('/api/income/addon-purchases', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const {
        customer_id, subscription_id, addon_id,
        quantity = 1, description, project_id
      } = req.body;
      
      if (!customer_id || !addon_id) {
        return res.status(400).json({ error: 'customer_id and addon_id are required' });
      }
      
      const addonResult = await client.query(
        'SELECT * FROM service_addons WHERE id = $1',
        [addon_id]
      );
      
      if (!addonResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Add-on not found' });
      }
      
      const addon = addonResult.rows[0];
      const unit_price = parseFloat(addon.price);
      const total_price = unit_price * quantity;
      
      const result = await client.query(`
        INSERT INTO customer_addon_purchases (
          customer_id, subscription_id, addon_id,
          quantity, unit_price, total_price,
          description, project_id, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', $9)
        RETURNING *
      `, [
        customer_id, subscription_id, addon_id,
        quantity, unit_price, total_price,
        description, project_id, req.user.id
      ]);
      
      await client.query('COMMIT');
      
      console.log(`✅ Created addon purchase for customer ${customer_id}: ${addon.name} x${quantity}`);
      res.status(201).json({
        ...result.rows[0],
        addon_name: addon.name
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating addon purchase:', error);
      res.status(500).json({ error: 'Failed to create addon purchase' });
    } finally {
      client.release();
    }
  });
  
  // =====================================================
  // INVOICES
  // =====================================================
  
  app.get('/api/income/invoices', authenticateToken, async (req, res) => {
    try {
      const { customer_id, status } = req.query;
      
      let query = `
        SELECT 
          i.*,
          c.first_name || ' ' || c.last_name as customer_name,
          (i.total - i.amount_paid) as amount_due
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
      
      query += ' ORDER BY i.invoice_date DESC';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });
  
  app.get('/api/income/invoices/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      const invoiceResult = await pool.query(`
        SELECT 
          i.*,
          c.first_name || ' ' || c.last_name as customer_name,
          c.email, c.phone, c.address,
          (i.total - i.amount_paid) as amount_due
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        WHERE i.id = $1
      `, [id]);
      
      if (!invoiceResult.rows.length) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      const itemsResult = await pool.query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY display_order',
        [id]
      );
      
      const paymentsResult = await pool.query(
        'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC',
        [id]
      );
      
      res.json({
        ...invoiceResult.rows[0],
        items: itemsResult.rows,
        payments: paymentsResult.rows
      });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({ error: 'Failed to fetch invoice' });
    }
  });
  
  app.post('/api/income/invoices/generate', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const {
        customer_id,
        subscription_id,
        billing_period_start,
        billing_period_end,
        include_unbilled_addons = true,
        custom_items = []
      } = req.body;
      
      if (!customer_id) {
        return res.status(400).json({ error: 'customer_id is required' });
      }
      
      const invoice_number = await generateInvoiceNumber(client);
      const due_date = new Date();
      due_date.setDate(due_date.getDate() + 15);
      
      const invoiceResult = await client.query(`
        INSERT INTO invoices (
          invoice_number, customer_id, subscription_id,
          invoice_date, due_date,
          billing_period_start, billing_period_end,
          status, created_by
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, 'draft', $7)
        RETURNING *
      `, [invoice_number, customer_id, subscription_id, due_date, billing_period_start, billing_period_end, req.user.id]);
      
      const invoice_id = invoiceResult.rows[0].id;
      let display_order = 0;
      
      // Add subscription
      if (subscription_id) {
        const subResult = await client.query(`
          SELECT 
            cs.*,
            sp.name as package_name,
            COALESCE(cs.custom_monthly_price, sp.base_price) as effective_price
          FROM customer_subscriptions cs
          JOIN service_packages sp ON cs.service_package_id = sp.id
          WHERE cs.id = $1
        `, [subscription_id]);
        
        if (subResult.rows.length > 0) {
          const price = parseFloat(subResult.rows[0].effective_price);
          await client.query(`
            INSERT INTO invoice_items (
              invoice_id, item_type, description,
              quantity, unit_price, subtotal, total, display_order
            ) VALUES ($1, 'subscription', $2, 1, $3, $3, $3, $4)
          `, [invoice_id, `${subResult.rows[0].package_name} - ${billing_period_start || 'Mensualidad'}`, price, display_order++]);
        }
      }
      
      // Add unbilled add-ons
      if (include_unbilled_addons) {
        const addonsResult = await client.query(`
          SELECT cap.*, sa.name as addon_name
          FROM customer_addon_purchases cap
          JOIN service_addons sa ON cap.addon_id = sa.id
          WHERE cap.customer_id = $1
            AND cap.status = 'approved'
            AND NOT EXISTS (
              SELECT 1 FROM invoice_items ii 
              WHERE ii.reference_id = cap.id AND ii.reference_type = 'addon'
            )
        `, [customer_id]);
        
        for (const addon of addonsResult.rows) {
          await client.query(`
            INSERT INTO invoice_items (
              invoice_id, item_type, description,
              quantity, unit_price, subtotal, total,
              reference_id, reference_type, display_order
            ) VALUES ($1, 'addon', $2, $3, $4, $5, $5, $6, 'addon', $7)
          `, [
            invoice_id, addon.description || addon.addon_name,
            addon.quantity, addon.unit_price, addon.total_price,
            addon.id, display_order++
          ]);
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
        `, [invoice_id, item.description, item.quantity || 1, item.unit_price, itemTotal, display_order++]);
      }
      
      // Calculate totals with IVA
      const itemsTotalResult = await client.query(
        'SELECT SUM(total) as subtotal FROM invoice_items WHERE invoice_id = $1',
        [invoice_id]
      );
      
      const subtotal = parseFloat(itemsTotalResult.rows[0].subtotal || 0);
      const totals = calculateInvoiceTotals(subtotal);
      
      await client.query(`
        UPDATE invoices SET
          subtotal = $1,
          tax_percentage = 16,
          tax_amount = $2,
          total = $3
        WHERE id = $4
      `, [totals.subtotal, totals.taxAmount, totals.total, invoice_id]);
      
      // Create accounting entries
      const customerCode = customer_id.toString().padStart(4, '0');
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES
          (CURRENT_DATE, $1, $2, $3, 0, 'invoice_generated', $4, $5),
          (CURRENT_DATE, $1, '4002', 0, $6, 'invoice_generated', $4, $5),
          (CURRENT_DATE, $1, '2003', 0, $7, 'invoice_generated', $4, $5)
      `, [
        `Factura ${invoice_number}`,
        `1103-${customerCode}`,
        totals.total,
        invoice_id,
        req.user.id,
        totals.subtotal,
        totals.taxAmount
      ]);
      
      await client.query('COMMIT');
      
      console.log(`✅ Generated invoice ${invoice_number}: Subtotal $${totals.subtotal} + IVA $${totals.taxAmount} = Total $${totals.total} MXN`);
      
      res.status(201).json({
        invoice_id,
        invoice_number,
        subtotal: totals.subtotal,
        iva: totals.taxAmount,
        total: totals.total
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error generating invoice:', error);
      res.status(500).json({ error: 'Failed to generate invoice', details: error.message });
    } finally {
      client.release();
    }
  });
  
  // =====================================================
  // PAYMENTS
  // =====================================================
  
  app.post('/api/income/invoices/:id/payment', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const invoice_id = parseInt(req.params.id);
      const {
        amount,
        payment_method,
        payment_date = new Date(),
        reference_number
      } = req.body;
      
      if (!amount || !payment_method) {
        return res.status(400).json({ error: 'amount and payment_method are required' });
      }
      
      const paymentAmount = parseFloat(amount);
      
      const invoiceResult = await client.query(
        'SELECT *, (total - amount_paid) as amount_due FROM invoices WHERE id = $1',
        [invoice_id]
      );
      
      if (!invoiceResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }
      
      const invoice = invoiceResult.rows[0];
      const amount_due = parseFloat(invoice.amount_due);
      
      if (paymentAmount > amount_due) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Payment exceeds amount due' });
      }
      
      const paymentResult = await client.query(`
        INSERT INTO invoice_payments (
          invoice_id, amount, payment_method, payment_date,
          reference_number, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [invoice_id, paymentAmount, payment_method, payment_date, reference_number, req.user.id]);
      
      const new_amount_paid = parseFloat(invoice.amount_paid) + paymentAmount;
      const new_status = new_amount_paid >= parseFloat(invoice.total) ? 'paid' : 'partial';
      
      await client.query(`
        UPDATE invoices SET
          amount_paid = $1,
          status = $2,
          paid_at = CASE WHEN $2 = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END
        WHERE id = $3
      `, [new_amount_paid, new_status, invoice_id]);
      
      // Accounting entries
      const customerCode = invoice.customer_id.toString().padStart(4, '0');
      const cashAccount = payment_method === 'transferencia' ? '1002' : '1001';
      
      await client.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES
          (CURRENT_DATE, $1, $2, $3, 0, 'invoice_payment', $4, $5),
          (CURRENT_DATE, $1, $6, 0, $3, 'invoice_payment', $4, $5)
      `, [
        `Pago factura ${invoice.invoice_number}`,
        cashAccount,
        paymentAmount,
        paymentResult.rows[0].id,
        req.user.id,
        `1103-${customerCode}`
      ]);
      
      await client.query('COMMIT');
      
      console.log(`✅ Recorded payment of $${paymentAmount} MXN for invoice ${invoice.invoice_number}. Status: ${new_status}`);
      
      res.status(201).json({
        payment_id: paymentResult.rows[0].id,
        invoice_number: invoice.invoice_number,
        payment_amount: paymentAmount,
        new_amount_paid,
        amount_remaining: parseFloat(invoice.total) - new_amount_paid,
        invoice_status: new_status
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error recording payment:', error);
      res.status(500).json({ error: 'Failed to record payment' });
    } finally {
      client.release();
    }
  });
  
  // =====================================================
  // REVENUE & DASHBOARD
  // =====================================================
  
  app.get('/api/income/dashboard', authenticateToken, async (req, res) => {
    try {
      const mrrResult = await pool.query(`
        SELECT SUM(COALESCE(cs.custom_monthly_price, sp.base_price)) as mrr
        FROM customer_subscriptions cs
        JOIN service_packages sp ON cs.service_package_id = sp.id
        WHERE cs.status = 'active'
      `);
      
      const outstandingResult = await pool.query(`
        SELECT SUM(total - amount_paid) as total_outstanding
        FROM invoices WHERE status NOT IN ('paid', 'cancelled')
      `);
      
      const thisMonthResult = await pool.query(`
        SELECT SUM(amount_paid) as revenue_this_month
        FROM invoices
        WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM invoice_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      `);
      
      res.json({
        mrr: parseFloat(mrrResult.rows[0].mrr || 0),
        total_outstanding: parseFloat(outstandingResult.rows[0].total_outstanding || 0),
        revenue_this_month: parseFloat(thisMonthResult.rows[0].revenue_this_month || 0)
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });
  
  console.log('✅ Income management routes registered');
};

