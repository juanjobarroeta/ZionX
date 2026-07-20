const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer setup for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// =====================================================
// CUSTOMER CRUD ROUTES
// =====================================================

// Create a new customer
router.post("/customers", async (req, res) => {
  // Log the incoming request and authenticated user
  console.log("📥 Received POST /customers request:", req.body);
  console.log("🔐 Authenticated user:", req.user);
  try {
    const { first_name, last_name, phone, email, birthdate, curp, address, employment, income, ine_path, bureau_path } = req.body;
    const pool = req.pool;
    const result = await pool.query(
      "INSERT INTO customers (first_name, last_name, phone, email, birthdate, curp, address, employment, income, ine_path, bureau_path) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
      [first_name, last_name, phone, email, birthdate, curp, address, employment, income, ine_path, bureau_path]
    );
    const customer = result.rows[0];
    // Inserted check: Ensure customer and customer.id exist
    if (!customer || !customer.id) {
      console.error("❌ Customer insert succeeded but ID is missing:", customer);
      return res.status(500).json({ message: "Customer created, but failed to initialize accounts" });
    }
    const idPadded = customer.id.toString().padStart(4, "0");
    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

    // Use variables for account codes (add cogs)
    const accountCodes = {
      client: `1103-${idPadded}`,
      sale: `4000-${idPadded}`,
      interest: `4100-${idPadded}`,
      cogs: `5000-${idPadded}`,
    };

    // Debug log immediately before chart_of_accounts insert
    console.log("🧾 Creating chart_of_accounts for:", {
      client: accountCodes.client,
      sale: accountCodes.sale,
      interest: accountCodes.interest,
      cogs: accountCodes.cogs
    });
    try {
      await pool.query(`
        INSERT INTO chart_of_accounts (code, name, type, group_name, parent_code)
        VALUES
          ($1, $2, 'ACTIVO', 'ACTIVO CIRCULANTE', '1103'),
          ($3, $4, 'INGRESO', 'OPERATIVO', '4000'),
          ($5, $6, 'INGRESO', 'OPERATIVO', '4100'),
          ($7, $8, 'EGRESO', 'COSTOS', '5000')
      `, [
        accountCodes.client, `Cliente ${fullName}`,
        accountCodes.sale, `Venta Cliente ${fullName}`,
        accountCodes.interest, `Interés Cliente ${fullName}`,
        accountCodes.cogs, `COGS Cliente ${fullName}`
      ]);
      // Debug log after successful chart_of_accounts insertion
      console.log("✅ Subaccounts inserted");

      // Insert initial journal entries with zero values for customer ledger subaccounts
      await pool.query(`
        INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES
          (CURRENT_DATE, $1, $2, 0, 0, 'customer_setup', $3, $4),
          (CURRENT_DATE, $1, $5, 0, 0, 'customer_setup', $3, $4),
          (CURRENT_DATE, $1, $6, 0, 0, 'customer_setup', $3, $4),
          (CURRENT_DATE, $1, $7, 0, 0, 'customer_setup', $3, $4)
      `, [
        `Setup cuentas para cliente ${fullName}`,
        accountCodes.client,
        customer.id,
        req.user.id,
        accountCodes.sale,
        accountCodes.interest,
        accountCodes.cogs
      ]);
      // Log after journal_entries insertion
      console.log("✅ Journal entries inserted");
    } catch (err) {
      console.error("❌ Error inserting chart_of_accounts or journal_entries:", err);
    }

    res.json({ message: "Customer created", customer });
  } catch (err) {
    console.error("Error creating customer:", err);
    res.status(500).json({ message: "Error creating customer" });
  }
});

// Create a new customer with file uploads
router.post("/customers/upload", async (req, res) => {
  console.log("📥 Received POST /customers/upload request");
  console.log("🔐 Authenticated user:", req.user);

  try {
    // Handle file uploads using multer
    const uploadWithFields = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const randomId = Math.floor(Math.random() * 1000000);
          cb(null, `${timestamp}-${randomId}-${file.originalname}`);
        }
      })
    }).fields([
      { name: 'ine', maxCount: 1 },
      { name: 'bureau', maxCount: 1 },
      { name: 'proof_income', maxCount: 1 },
      { name: 'proof_address', maxCount: 1 },
      // Business document fields
      { name: 'business_license', maxCount: 1 },
      { name: 'tax_certificate', maxCount: 1 },
      { name: 'fiscal_address_proof', maxCount: 1 },
      { name: 'legal_representative_id', maxCount: 1 }
    ]);

    uploadWithFields(req, res, async (err) => {
      if (err) {
        console.error("❌ File upload error:", err);
        return res.status(400).json({ message: "File upload error" });
      }

      try {
        const pool = req.pool;
        // Extract both personal and business customer fields
        const {
          // Personal customer fields (legacy)
          first_name, last_name, phone, email, birthdate, curp, address, employment, income,
          // Business customer fields
          business_name, commercial_name, rfc, tax_regime, business_type, industry, website,
          fiscal_address, fiscal_address2, fiscal_postal_code, fiscal_city, fiscal_state,
          contact_first_name, contact_last_name, contact_position, contact_email, contact_phone, contact_mobile,
          business_size, employees_count, annual_revenue, marketing_budget, target_market, current_marketing_channels,
          referral_source
        } = req.body;

        // Get file paths if files were uploaded (legacy files)
        const ine_path = req.files?.ine ? req.files.ine[0].path : null;
        const bureau_path = req.files?.bureau ? req.files.bureau[0].path : null;
        const proof_income_path = req.files?.proof_income ? req.files.proof_income[0].path : null;
        const proof_address_path = req.files?.proof_address ? req.files.proof_address[0].path : null;

        // Get business document paths
        const business_license_path = req.files?.business_license ? req.files.business_license[0].path : null;
        const tax_certificate_path = req.files?.tax_certificate ? req.files.tax_certificate[0].path : null;
        const fiscal_address_proof_path = req.files?.fiscal_address_proof ? req.files.fiscal_address_proof[0].path : null;
        const legal_representative_id_path = req.files?.legal_representative_id ? req.files.legal_representative_id[0].path : null;

        console.log("📄 All file paths:", {
          ine_path, bureau_path, proof_income_path, proof_address_path,
          business_license_path, tax_certificate_path, fiscal_address_proof_path, legal_representative_id_path
        });

        console.log("📊 Form data received:", {
          business_name, commercial_name, rfc, tax_regime, business_type, industry, website,
          fiscal_address, fiscal_postal_code, fiscal_city, fiscal_state,
          contact_first_name, contact_last_name, contact_email, contact_phone
        });

        // Use a simpler INSERT query with only essential fields to avoid column mismatch
        const result = await pool.query(`
          INSERT INTO customers (
            business_name, rfc, industry,
            fiscal_address, fiscal_postal_code, fiscal_city, fiscal_state,
            contact_first_name, contact_last_name, contact_email, contact_phone,
            business_type, business_size, target_market,
            commercial_name, website, contact_position, contact_mobile,
            tax_regime, employees_count, annual_revenue, marketing_budget,
            current_marketing_channels, referral_source,
            business_license_path, tax_certificate_path, fiscal_address_proof_path, legal_representative_id_path
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
          RETURNING *`,
          [
            business_name, rfc, industry,
            fiscal_address, fiscal_postal_code, fiscal_city, fiscal_state,
            contact_first_name, contact_last_name, contact_email, contact_phone,
            business_type, business_size, target_market,
            commercial_name, website, contact_position, contact_mobile,
            tax_regime, employees_count, annual_revenue, marketing_budget,
            current_marketing_channels, referral_source,
            business_license_path, tax_certificate_path, fiscal_address_proof_path, legal_representative_id_path
          ]
        );

        const customer = result.rows[0];

        if (!customer || !customer.id) {
          console.error("❌ Customer insert succeeded but ID is missing:", customer);
          return res.status(500).json({ message: "Customer created, but failed to initialize accounts" });
        }

        const idPadded = customer.id.toString().padStart(4, "0");
        // Use business name for business customers, or personal name for individuals
        const fullName = customer.business_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim();

        // Use variables for account codes
        const accountCodes = {
          client: `1103-${idPadded}`,
          sale: `4000-${idPadded}`,
          interest: `4100-${idPadded}`,
          cogs: `5000-${idPadded}`,
        };

        console.log("🧾 Creating chart_of_accounts for:", accountCodes);

        try {
          await pool.query(`
            INSERT INTO chart_of_accounts (code, name, type, group_name, parent_code)
            VALUES
              ($1, $2, 'ACTIVO', 'ACTIVO CIRCULANTE', '1103'),
              ($3, $4, 'INGRESO', 'OPERATIVO', '4000'),
              ($5, $6, 'INGRESO', 'OPERATIVO', '4100'),
              ($7, $8, 'EGRESO', 'COSTOS', '5000')
          `, [
            accountCodes.client, `Cliente ${fullName}`,
            accountCodes.sale, `Venta Cliente ${fullName}`,
            accountCodes.interest, `Interés Cliente ${fullName}`,
            accountCodes.cogs, `COGS Cliente ${fullName}`
          ]);

          console.log("✅ Subaccounts inserted");

          // Insert initial journal entries
          await pool.query(`
            INSERT INTO journal_entries (date, description, account_code, debit, credit, source_type, source_id, created_by)
            VALUES
              (CURRENT_DATE, $1, $2, 0, 0, 'customer_setup', $3, $4),
              (CURRENT_DATE, $1, $5, 0, 0, 'customer_setup', $3, $4),
              (CURRENT_DATE, $1, $6, 0, 0, 'customer_setup', $3, $4),
              (CURRENT_DATE, $1, $7, 0, 0, 'customer_setup', $3, $4)
          `, [
            `Setup cuentas para cliente ${fullName}`,
            accountCodes.client,
            customer.id,
            req.user.id,
            accountCodes.sale,
            accountCodes.interest,
            accountCodes.cogs
          ]);

          console.log("✅ Journal entries inserted");
        } catch (err) {
          console.error("❌ Error inserting chart_of_accounts or journal_entries:", err);
        }

        res.json({ message: "Customer created successfully", customer });
      } catch (err) {
        console.error("❌ Error creating customer:", err);
        res.status(500).json({ message: "Error creating customer" });
      }
    });
  } catch (err) {
    console.error("❌ Error in /customers/upload:", err);
    res.status(500).json({ message: "Error processing request" });
  }
});

// Get all customers (archived customers are hidden by default).
router.get("/customers", async (req, res) => {
  try {
    // Client-portal users must never see the roster of other clients.
    if (req.user?.role === "client") return res.status(403).json({ message: "No autorizado" });
    const pool = req.pool;
    const includeArchived = req.query.include_archived === "true";
    const result = await pool.query(
      includeArchived
        ? `SELECT * FROM customers ORDER BY created_at DESC`
        : `SELECT * FROM customers WHERE is_active IS NOT FALSE ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ message: "Error fetching customers" });
  }
});

// Retrieve a full customer profile
router.get("/customers/:id/profile", async (req, res) => {
  const customerId = req.params.id;

  try {
    const pool = req.pool;
    const customerResult = await pool.query(
      "SELECT id, first_name, last_name, phone, email, birthdate, curp, address, employment, income, ine_path, bureau_path FROM customers WHERE id = $1",
      [customerId]
    );

    if (!customerResult.rows.length) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customerResult.rows[0]);
  } catch (err) {
    console.error("Error fetching customer profile:", err);
    res.status(500).json({ message: "Error fetching customer profile" });
  }
});

// Get a single customer's base info (for profile page rendering)
router.get("/customers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = req.pool;
    const result = await pool.query(
      "SELECT * FROM customers WHERE id = $1",
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({ message: "Error fetching customer" });
  }
});

// =====================================================
// CUSTOMER NOTES ROUTES
// =====================================================

router.get("/customers/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM customer_notes WHERE customer_id = $1 ORDER BY created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching customer notes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const pool = req.pool;
    const result = await pool.query(`
      INSERT INTO customer_notes (customer_id, note, created_by) VALUES ($1, $2, $3) RETURNING *
    `, [id, note, req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating customer note:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================
// MARKETING FILES MANAGEMENT ROUTES
// =====================================================

// Upload marketing files for a customer
router.post("/customers/:id/files/upload", upload.array('files', 10), async (req, res) => {
  try {
    const { id: customer_id } = req.params;
    const { category } = req.body;
    const files = req.files;
    const pool = req.pool;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    if (!category) {
      return res.status(400).json({ success: false, message: "Category is required" });
    }

    const insertPromises = files.map(file => {
      return pool.query(`
        INSERT INTO customer_files (
          customer_id, category, file_name, original_name, file_path,
          file_size, file_type, mime_type, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
      `, [
        customer_id,
        category,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.originalname.split('.').pop(),
        file.mimetype,
        req.user?.id || 1
      ]);
    });

    const results = await Promise.all(insertPromises);

    res.json({
      success: true,
      message: `${files.length} archivo(s) subido(s) exitosamente`,
      files: results.map(r => r.rows[0])
    });
  } catch (error) {
    console.error("Error uploading marketing files:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// Get marketing files by category for a customer
router.get("/customers/:id/files/:category", async (req, res) => {
  try {
    const { id: customer_id, category } = req.params;
    const pool = req.pool;

    const result = await pool.query(`
      SELECT
        id, file_name, original_name, file_size, file_type,
        description, created_at, updated_at
      FROM customer_files
      WHERE customer_id = $1 AND category = $2 AND is_active = true
      ORDER BY created_at DESC
    `, [customer_id, category]);

    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching ${category} files:`, error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Download marketing file
router.get("/customers/:id/files/:file_id/download", async (req, res) => {
  try {
    const { file_id } = req.params;
    const pool = req.pool;

    const result = await pool.query(`
      SELECT file_path, original_name, mime_type
      FROM customer_files
      WHERE id = $1 AND is_active = true
    `, [file_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Archivo no encontrado" });
    }

    const file = result.rows[0];
    res.download(file.file_path, file.original_name);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Delete marketing file
router.delete("/customers/:id/files/:file_id", async (req, res) => {
  try {
    const { file_id } = req.params;
    const pool = req.pool;

    await pool.query(`
      UPDATE customer_files
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [file_id]);

    res.json({ success: true, message: "Archivo eliminado exitosamente" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// =====================================================
// CUSTOMER TEAM ASSIGNMENT
// =====================================================

// Update customer team assignment
router.put("/customers/:id/team-assignment", async (req, res) => {
  try {
    const { id } = req.params;
    const { default_designer, default_community_manager } = req.body;
    const pool = req.pool;

    const result = await pool.query(`
      UPDATE customers
      SET default_designer = $1, default_community_manager = $2
      WHERE id = $3
      RETURNING *
    `, [default_designer, default_community_manager, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating customer team assignment:', error);
    res.status(500).json({ error: 'Failed to update team assignment' });
  }
});

// =====================================================
// CONTENT CALENDAR (customer-scoped)
// =====================================================

// Get content calendar for a specific month
router.get("/customers/:id/content-calendar/:month", async (req, res) => {
  try {
    const { id: customer_id, month } = req.params;
    const pool = req.pool;

    const result = await pool.query(`
      SELECT * FROM content_calendar
      WHERE customer_id = $1 AND month_year = $2
      ORDER BY scheduled_date ASC, id ASC
    `, [customer_id, month]);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching content calendar:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// PUT /customers/:id/pinterest — set the client's Pinterest mood board URL.
// Empty/null clears it. Used as the visual direction for the month's escaleta.
router.put("/customers/:id/pinterest", async (req, res) => {
  try {
    const { id } = req.params;
    const url = (req.body?.pinterest_board_url || "").trim() || null;
    const result = await req.pool.query(
      `UPDATE customers SET pinterest_board_url = $1, updated_at = NOW()
        WHERE id = $2 RETURNING id, pinterest_board_url`,
      [url, id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Cliente no encontrado" });
    res.json({ success: true, pinterest_board_url: result.rows[0].pinterest_board_url });
  } catch (error) {
    console.error("Error updating Pinterest board:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// =====================================================
// EDIT / DELETE CUSTOMER
// =====================================================

// Update editable customer fields (whitelist). Backs the profile edit form.
router.patch("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.pool;
    const ALLOWED = [
      "business_name", "commercial_name", "rfc", "tax_regime", "business_type",
      "industry", "website", "fiscal_address", "fiscal_postal_code", "fiscal_city",
      "fiscal_state", "contact_first_name", "contact_last_name", "contact_position",
      "contact_email", "contact_phone", "contact_mobile",
      "first_name", "last_name", "phone", "email",
    ];
    const sets = [];
    const values = [];
    let n = 1;
    for (const key of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        sets.push(`${key} = $${n++}`);
        const v = req.body[key];
        values.push(typeof v === "string" && v.trim() === "" ? null : v);
      }
    }
    if (!sets.length) return res.status(400).json({ message: "No hay campos para actualizar" });
    sets.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE customers SET ${sets.join(", ")} WHERE id = $${n} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ message: "Cliente no encontrado" });
    res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ message: "Error al actualizar cliente" });
  }
});

// Archive (soft-delete) — hides the customer from the directory but keeps ALL
// data (ledger, files, content). Reversible via /restore. The safe default.
router.delete("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await req.pool.query(
      `UPDATE customers SET is_active = false, archived_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Cliente no encontrado" });
    res.json({ success: true, archived: true, message: "Cliente archivado" });
  } catch (err) {
    console.error("Error archiving customer:", err);
    res.status(500).json({ message: "Error al archivar cliente" });
  }
});

// Restore an archived customer.
router.post("/customers/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await req.pool.query(
      `UPDATE customers SET is_active = true, archived_at = NULL WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Cliente no encontrado" });
    res.json({ success: true, message: "Cliente restaurado" });
  } catch (err) {
    console.error("Error restoring customer:", err);
    res.status(500).json({ message: "Error al restaurar cliente" });
  }
});

// Permanent delete — admin only, and only when the customer has no real ledger
// activity (protects accounting history). Removes the customer and its owned
// marketing/CRM rows plus the zero-value setup accounting entries, atomically.
router.delete("/customers/:id/permanent", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Solo un administrador puede eliminar permanentemente." });
  }
  const { id } = req.params;
  const pool = req.pool;
  const client = await pool.connect();
  try {
    const exists = await client.query("SELECT id FROM customers WHERE id = $1", [id]);
    if (!exists.rows.length) {
      client.release();
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const idPadded = Number(id).toString().padStart(4, "0");
    const codeLike = `%-${idPadded}`;

    // Guard: block if this customer has any non-zero ledger posting (real
    // financial history). Only the zero-value setup entries are safe to remove.
    const activity = await client.query(
      `SELECT COUNT(*)::int AS n FROM journal_entries
        WHERE account_code LIKE $1 AND (COALESCE(debit,0) <> 0 OR COALESCE(credit,0) <> 0)`,
      [codeLike]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if (activity.rows[0].n > 0) {
      client.release();
      return res.status(409).json({
        message: "Este cliente tiene movimientos contables. Archívalo para conservar el historial en lugar de eliminarlo.",
      });
    }

    const tableExists = async (t) => {
      const r = await client.query("SELECT to_regclass($1) AS reg", [`public.${t}`]);
      return !!r.rows[0].reg;
    };

    await client.query("BEGIN");
    // Owned children first (guard each so a missing table can't abort the tx).
    if (await tableExists("post_pipeline_stages")) {
      await client.query(
        `DELETE FROM post_pipeline_stages WHERE post_id IN (SELECT id FROM content_calendar WHERE customer_id = $1)`,
        [id]
      );
    }
    for (const t of ["content_calendar", "creative_briefs", "customer_notes", "customer_files"]) {
      if (await tableExists(t)) {
        await client.query(`DELETE FROM ${t} WHERE customer_id = $1`, [id]);
      }
    }
    // Zero-value setup accounting rows for this customer only.
    if (await tableExists("journal_entries")) {
      await client.query(`DELETE FROM journal_entries WHERE account_code LIKE $1`, [codeLike]);
      await client.query(`DELETE FROM journal_entries WHERE source_type = 'customer_setup' AND source_id = $1`, [id]);
    }
    if (await tableExists("chart_of_accounts")) {
      await client.query(`DELETE FROM chart_of_accounts WHERE code LIKE $1`, [codeLike]);
    }
    await client.query(`DELETE FROM customers WHERE id = $1`, [id]);
    await client.query("COMMIT");
    res.json({ success: true, deleted: true, message: "Cliente eliminado permanentemente" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error permanently deleting customer:", err);
    // A leftover foreign-key reference we don't clean up lands here — tell the
    // admin to archive instead rather than leaving a half state.
    res.status(500).json({
      message: "No se pudo eliminar permanentemente (el cliente tiene datos relacionados). Archívalo en su lugar.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
