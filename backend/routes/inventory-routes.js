const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

// Multer setup for inventory file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// isAdmin middleware for routes that need it
const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    next();
  } else {
    res.status(403).json({ message: "Access denied. Admin only." });
  }
};

// =====================================================
// INVENTORY ITEMS
// =====================================================

router.get("/inventory-items", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM inventory_items
      WHERE status = 'in_stock'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching inventory items:", err);
    res.status(500).json({ message: "Error fetching inventory items" });
  }
});

router.post("/inventory-items", async (req, res) => {
  try {
    const pool = req.pool;
    const {
      category,
      brand,
      model,
      color,
      imei,
      serial,
      purchase_price,
      sale_price,
      status = 'in_stock',
      store = 'atlixco',
      ram,
      storage
    } = req.body;

    if (!category || !brand || !model || !color) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(`
      INSERT INTO inventory_items (
        category,
        brand,
        model,
        color,
        imei,
        serial_number,
        purchase_price,
        sale_price,
        status,
        store,
        ram,
        storage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [category, brand, model, color, imei, serial, purchase_price || 0, sale_price || 0, status, store, ram, storage]);

    console.log(`📦 Inventory item created: ${brand} ${model} ${color}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating inventory item:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk upload inventory items from Excel
router.post("/inventory-items/upload", upload.single("file"), async (req, res) => {
  const pool = req.pool;
  const filePath = req.file?.path;
  const { inventory_request_id } = req.body;
  const store = req.body.store || "atlixco";

  if (!filePath || !inventory_request_id) {
    return res.status(400).json({ message: "Missing file or request ID" });
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let items = [];
    for (const row of data) {
      const {
        category,
        brand,
        model,
        color,
        ram,
        storage,
        quantity,
        purchase_price,
        sale_price,
      } = row;

      const quantityInt = parseInt(quantity) || 1;

      for (let i = 0; i < quantityInt; i++) {
        const result = await pool.query(
          `INSERT INTO inventory_items
            (inventory_request_id, category, brand, model, color, ram, storage, purchase_price, sale_price, store, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            inventory_request_id,
            category || 'N/A',
            brand || 'N/A',
            model || 'N/A',
            color || 'N/A',
            ram || 'N/A',
            storage || 'N/A',
            purchase_price || 0,
            sale_price || 0,
            store,
            'pending_reception'
          ]
        );
        items.push(result.rows[0]);
      }
    }

    res.json({ message: "Inventory items created", items });
  } catch (err) {
    console.error("Error uploading inventory items:", err);
    res.status(500).json({ message: "Error uploading inventory items" });
  }
});

// Transfer inventory items between stores
router.post("/inventory-items/transfer", async (req, res) => {
  try {
    const pool = req.pool;
    const { product_ids, target_store } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: "No products selected for transfer" });
    }

    if (!target_store) {
      return res.status(400).json({ error: "Target store is required" });
    }

    const result = await pool.query(`
      UPDATE inventory_items
      SET store = $1
      WHERE id = ANY($2)
      RETURNING id, brand, model, color, store
    `, [target_store, product_ids]);

    console.log(`🔄 Transferred ${result.rows.length} items to ${target_store}`);
    res.json({
      message: `Successfully transferred ${result.rows.length} items to ${target_store}`,
      transferred_items: result.rows
    });
  } catch (err) {
    console.error("Error transferring inventory items:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================
// INVENTORY REQUESTS
// =====================================================

router.post("/inventory-requests", upload.single("quote"), async (req, res) => {
  try {
    const pool = req.pool;
    const { category, amount, notes, priority, supplier, expected_delivery, approval_required } = req.body;
    const requester_id = req.user.id;
    const quote_path = req.file ? req.file.path : null;

    const result = await pool.query(
      `INSERT INTO inventory_requests (requester_id, category, amount, notes, quote_path, priority, supplier, expected_delivery, approval_required, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING *`,
      [requester_id, category, amount, notes, quote_path, priority, supplier, expected_delivery, approval_required]
    );

    res.json({ message: "Inventory request created", request: result.rows[0] });
  } catch (err) {
    console.error("Error creating inventory request:", err);
    res.status(500).json({ message: "Error creating inventory request" });
  }
});

// Bulk inventory request
router.post("/inventory-requests/bulk", async (req, res) => {
  try {
    const pool = req.pool;
    const { category, supplier, expected_delivery, notes, priority, amount, items } = req.body;
    const requester_id = req.user.id;

    // Validate required fields
    if (!category || !amount || !items || items.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create the main inventory request
    const result = await pool.query(`
      INSERT INTO inventory_requests (requester_id, category, amount, notes, priority, supplier, expected_delivery, approval_required, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'pending')
      RETURNING *
    `, [requester_id, category, amount, notes, priority, supplier, expected_delivery]);

    const requestId = result.rows[0].id;

    // Create inventory items for each item in the bulk request
    for (const item of items) {
      await pool.query(`
        INSERT INTO inventory_items (request_id, category, brand, model, color, ram, storage, quantity, purchase_price, sale_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        requestId,
        item.category,
        item.brand,
        item.model,
        item.color,
        item.ram,
        item.storage,
        item.quantity,
        item.purchase_price,
        item.sale_price
      ]);
    }

    res.status(201).json({
      message: "Bulk inventory request created successfully",
      request: result.rows[0],
      items_count: items.length
    });

  } catch (err) {
    console.error("Error creating bulk inventory request:", err);
    res.status(500).json({ message: "Error creating bulk inventory request" });
  }
});

// Approve inventory request
router.put("/inventory-requests/:id/approve", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    // Get current inventory request details
    const requestCheck = await pool.query("SELECT * FROM inventory_requests WHERE id = $1", [id]);
    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ message: "Inventory request not found" });
    }

    const inventoryRequest = requestCheck.rows[0];

    // Update status
    const result = await pool.query(`
      UPDATE inventory_requests
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP, approved_by = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, req.user.id]);

    // Create journal entries for inventory request approval (recognize liability)
    const requestAmount = parseFloat(inventoryRequest.amount || 0);

    if (requestAmount > 0) {
      // Double-entry for inventory request approval:
      // Debit: Advance to Suppliers (1106) - We're committing to buy inventory
      // Credit: Accounts Payable (2101) - We owe the supplier
      await pool.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES
          (CURRENT_DATE, $1, '1106', $2, 0, 'inventory_approved', $3, $4),
          (CURRENT_DATE, $1, '2101', 0, $2, 'inventory_approved', $3, $4)
      `, [
        `Solicitud de inventario aprobada #${id}: ${inventoryRequest.category || 'Inventario'}`,
        requestAmount,
        id,
        req.user.id
      ]);

      console.log(`📒 Created journal entries for inventory approval #${id}: Debit 1106, Credit 2101 - $${requestAmount}`);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error approving inventory request:", err);
    res.status(500).json({ message: "Error approving inventory request" });
  }
});

// Reject inventory request
router.put("/inventory-requests/:id/reject", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(`
      UPDATE inventory_requests
      SET status = 'rejected', notes = CONCAT(COALESCE(notes, ''), ' - RECHAZADO: ', $2), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id, reason]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Inventory request not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error rejecting inventory request:", err);
    res.status(500).json({ message: "Error rejecting inventory request" });
  }
});

// Mark inventory request as received and register accounting movement
router.put("/inventory-requests/:id/receive", async (req, res) => {
  const pool = req.pool;
  const requestId = req.params.id;
  // Debug: log the ID being received
  console.log("📦 Receiving inventory with ID:", requestId);
  try {
    // 1. Mark inventory items as received (defensive: don't touch received_at)
    await pool.query(
      `UPDATE inventory_items
       SET status = 'in_stock'
       WHERE inventory_request_id = $1`,
      [requestId]
    );

    // 2. Update inventory request status
    await pool.query(
      `UPDATE inventory_requests
       SET status = 'received', updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    // 3. Get total inventory value (use pre-approved purchase amount)
    const totalValueRes = await pool.query(
      `SELECT amount FROM inventory_requests WHERE id = $1`,
      [requestId]
    );
    const totalValue = parseFloat(totalValueRes.rows[0]?.amount || 0);

    if (totalValue > 0) {
      await pool.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES
          (CURRENT_DATE, $1, '1104', $2, 0, 'inventory_reception', $3, $4),
          (CURRENT_DATE, $1, '1106', 0, $2, 'inventory_reception', $3, $4)
      `, [
        `Recepción de inventario para solicitud #${requestId}`,
        totalValue,
        requestId,
        req.user.id
      ]);
    }

    res.json({ message: "Inventory marked as received and ledger updated" });
  } catch (err) {
    // Show the actual backend error in the console for debugging
    console.error("❌ Error marking as received:", err.response?.data || err.message);
    res.status(500).json({ message: "Error marking inventory as received" });
  }
});

// =====================================================
// WAREHOUSE
// =====================================================

router.get("/warehouse/pending-inventory", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM inventory_requests
      WHERE status = 'paid_by_treasury'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching pending inventory requests:", err);
    res.status(500).json({ message: "Error fetching pending inventory" });
  }
});

// Pending deliveries to customers
router.get("/warehouse/pending-customers", async (req, res) => {
  const pool = req.pool;
  console.log("🔍 Fetching pending deliveries...");
  try {
    // First, let's check what approved loans exist
    const approvedLoans = await pool.query(`
      SELECT id, customer_id, inventory_item_id, status
      FROM loans
      WHERE status = 'approved'
    `);
    console.log(`📊 Found ${approvedLoans.rows.length} approved loans:`, approvedLoans.rows);

    const result = await pool.query(`
      SELECT
        loans.id AS loan_id,
        customers.first_name,
        customers.last_name,
        inventory_items.model,
        inventory_items.imei
      FROM loans
      LEFT JOIN customers ON loans.customer_id = customers.id
      LEFT JOIN inventory_items ON loans.inventory_item_id = inventory_items.id
      WHERE loans.status = 'approved'
        AND inventory_items.id IS NOT NULL
      ORDER BY loans.created_at DESC
    `);
    console.log(`📦 Pending deliveries: ${result.rows.length} items`);
    console.log(`📦 Delivery details:`, result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching pending deliveries:", err);
    console.error("❌ Error details:", err.message);
    res.status(500).json({ message: "Error fetching pending deliveries", error: err.message });
  }
});

// Pending customer deliveries (detailed)
router.get("/warehouse/pending-customer-deliveries", async (req, res) => {
  const pool = req.pool;
  console.log("🔍 Fetching pending customer deliveries...");
  try {
    const result = await pool.query(`
      SELECT
        l.id as loan_id,
        l.amount,
        l.status,
        c.first_name,
        c.last_name,
        c.phone,
        c.curp,
        i.brand,
        i.model,
        i.imei,
        i.sale_price
      FROM loans l
      JOIN customers c ON l.customer_id = c.id
      JOIN inventory_items i ON l.inventory_item_id = i.id
      WHERE l.status = 'approved' AND i.status != 'delivered'
      ORDER BY l.created_at DESC
    `);
    console.log(`📦 Found ${result.rows.length} pending customer deliveries`);
    console.log(`📦 Delivery details:`, result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching pending deliveries:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================
// ADMIN INVENTORY REQUESTS
// =====================================================

router.get("/admin/inventory-requests", isAdmin, async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM inventory_requests ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching inventory requests:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
