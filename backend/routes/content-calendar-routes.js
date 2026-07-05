const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const publishSync = require('../services/publishSync');
const { seedStagesForPost } = require('../services/pipeline');

// Public base for building absolute media URLs Meta can fetch.
const publicBase = (req) =>
  process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;

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
// CONTENT CALENDAR ROUTES
// =====================================================

// Create or update content calendar entry
router.post("/content-calendar", async (req, res) => {
  try {
    const {
      customer_id, month_year, post_number, campaign, platform, pilar, content_type,
      scheduled_date, status, idea_tema, referencia, copy_in, copy_out,
      arte, fotos_video, elementos_utilizar, assigned_designer, assigned_community_manager
    } = req.body;
    const pool = req.pool;

    console.log('📝 Creating content calendar entry with platform:', platform);

    const result = await pool.query(`
      INSERT INTO content_calendar (
        customer_id, month_year, post_number, title, description, campaign, platform, pilar, content_type,
        scheduled_date, status, idea_tema, referencia, copy_in, copy_out,
        arte, fotos_video, elementos_utilizar, assigned_designer, assigned_community_manager
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      customer_id, month_year, post_number,
      campaign || `Post ${post_number}`, // title (required)
      pilar || '', // description
      campaign, platform, pilar, content_type,
      scheduled_date, status, idea_tema, referencia, copy_in, copy_out,
      arte, fotos_video, elementos_utilizar, assigned_designer, assigned_community_manager
    ]);

    // Auto-inherit the production pipeline: seed the 7 owned stages from the
    // client's roster. Best-effort — must never break post creation.
    try {
      await seedStagesForPost(pool, result.rows[0].id);
    } catch (seedErr) {
      console.error("⚠️ Pipeline seed after create failed:", seedErr.message);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error saving content calendar:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Get all content-calendar entries in a date range (across clients), for the
// calendar/week/month views. Optional customer_id filter.
router.get("/content-calendar-range", async (req, res) => {
  try {
    const { from, to, customer_id } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from and to dates are required" });
    }
    const pool = req.pool;
    const params = [from, to];
    let query = `
      SELECT
        cc.id, cc.customer_id, cc.campaign, cc.platform, cc.pilar, cc.content_type,
        cc.scheduled_date, cc.status, cc.idea_tema, cc.copy_in, cc.copy_out, cc.arte,
        cc.priority, cc.client_status, cc.scheduled_post_id,
        cc.assigned_designer, cc.assigned_community_manager,
        c.business_name AS customer_name,
        designer.name AS designer_name,
        cm.name AS cm_name,
        sp.status AS publish_status,
        sp.error_message AS publish_error,
        EXISTS (
          SELECT 1 FROM social_accounts sa
          WHERE sa.customer_id = cc.customer_id AND sa.is_active = true
            AND (LOWER(sa.platform) = LOWER(cc.platform)
                 OR (LOWER(cc.platform) = 'instagram' AND sa.instagram_account_id IS NOT NULL))
        ) AS has_account
      FROM content_calendar cc
      LEFT JOIN customers c ON cc.customer_id = c.id
      LEFT JOIN team_members designer ON cc.assigned_designer = designer.id
      LEFT JOIN team_members cm ON cc.assigned_community_manager = cm.id
      LEFT JOIN scheduled_posts sp ON sp.id = cc.scheduled_post_id
      WHERE cc.scheduled_date >= $1 AND cc.scheduled_date <= $2
    `;
    if (customer_id) {
      params.push(customer_id);
      query += ` AND cc.customer_id = $${params.length}`;
    }
    query += ` ORDER BY cc.scheduled_date ASC, cc.priority DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching content-calendar range:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Promote a plan entry into the publish queue. 422 with `missing` if not ready.
router.post("/content-calendar/:id/schedule", async (req, res) => {
  try {
    const result = await publishSync.promote(req.pool, req.params.id, publicBase(req));
    if (result.notFound) return res.status(404).json({ message: "Entrada no encontrada" });
    if (!result.ok) {
      return res.status(422).json({ message: "La publicación aún no está lista", missing: result.readiness.missing });
    }
    res.json({ success: true, scheduled_post: result.scheduled_post });
  } catch (error) {
    console.error("Error scheduling calendar entry:", error);
    res.status(500).json({ message: "No se pudo programar la publicación" });
  }
});

// Remove a plan entry from the publish queue.
router.delete("/content-calendar/:id/schedule", async (req, res) => {
  try {
    const result = await publishSync.unschedule(req.pool, req.params.id);
    if (result.notFound) return res.status(404).json({ message: "Entrada no encontrada" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error unscheduling calendar entry:", error);
    res.status(500).json({ message: "No se pudo quitar de la cola" });
  }
});

// Update content calendar entry
router.put("/content-calendar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const pool = req.pool;

    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await pool.query(`
      UPDATE content_calendar
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, values);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating content calendar:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// Update content calendar by customer, month, and post number
router.put("/customers/:customer_id/content-calendar/:month/:post_number", async (req, res) => {
  try {
    const { customer_id, month, post_number } = req.params;
    const updates = req.body;
    const pool = req.pool;

    console.log(`📝 Updating post: Customer ${customer_id}, Month ${month}, Post #${post_number}`);
    console.log('📝 Updates received:', JSON.stringify(updates, null, 2));

    // First check if the post exists
    const checkResult = await pool.query(`
      SELECT id FROM content_calendar
      WHERE customer_id = $1 AND month_year = $2 AND post_number = $3
    `, [customer_id, month, post_number]);

    let result;

    if (checkResult.rows.length === 0) {
      // Post doesn't exist, INSERT it with only the fields we received
      console.log('📝 Post not found, creating new entry');

      // Build INSERT with explicit fields to avoid SQL injection and column mismatches
      const fields = [];
      const values = [customer_id, month, post_number, 'en_diseño']; // Start with required fields
      let paramIndex = 5;

      // Base columns
      let columns = 'customer_id, month_year, post_number, status';
      let placeholders = '$1, $2, $3, $4';

      // Add dynamic fields
      if (updates.copy_out !== undefined) {
        columns += ', copy_out';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.copy_out);
      }
      if (updates.scheduled_date !== undefined) {
        columns += ', scheduled_date';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.scheduled_date);
      }
      if (updates.scheduled_time !== undefined) {
        columns += ', scheduled_time';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.scheduled_time);
      }
      if (updates.platform !== undefined) {
        columns += ', platform';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.platform);
      }
      if (updates.hashtags !== undefined) {
        columns += ', hashtags';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.hashtags);
      }
      if (updates.location !== undefined && updates.location !== null) {
        columns += ', location';
        placeholders += `, $${paramIndex++}`;
        values.push(updates.location || null);
      }
      if (updates.arte_files !== undefined) {
        columns += ', arte_files';
        placeholders += `, $${paramIndex++}`;
        values.push(JSON.stringify(updates.arte_files));
      }

      console.log('📝 INSERT columns:', columns);
      console.log('📝 INSERT values:', values);

      result = await pool.query(`
        INSERT INTO content_calendar (${columns})
        VALUES (${placeholders})
        RETURNING *
      `, values);
    } else {
      // Post exists, UPDATE it
      console.log('📝 Post found, updating existing entry');

      const setClauses = [];
      const values = [customer_id, month, post_number];
      let paramIndex = 4;

      if (updates.copy_out !== undefined) {
        setClauses.push(`copy_out = $${paramIndex++}`);
        values.push(updates.copy_out);
      }
      if (updates.scheduled_date !== undefined) {
        setClauses.push(`scheduled_date = $${paramIndex++}`);
        values.push(updates.scheduled_date);
      }
      if (updates.scheduled_time !== undefined) {
        setClauses.push(`scheduled_time = $${paramIndex++}`);
        values.push(updates.scheduled_time);
      }
      if (updates.platform !== undefined) {
        setClauses.push(`platform = $${paramIndex++}`);
        values.push(updates.platform);
      }
      if (updates.hashtags !== undefined) {
        setClauses.push(`hashtags = $${paramIndex++}`);
        values.push(updates.hashtags);
      }
      if (updates.location !== undefined && updates.location !== null) {
        setClauses.push(`location = $${paramIndex++}`);
        values.push(updates.location || null);
      }
      if (updates.arte_files !== undefined) {
        setClauses.push(`arte_files = $${paramIndex++}`);
        values.push(JSON.stringify(updates.arte_files));
      }

      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      console.log('📝 UPDATE clauses:', setClauses.join(', '));
      console.log('📝 UPDATE values:', values);

      result = await pool.query(`
        UPDATE content_calendar
        SET ${setClauses.join(', ')}
        WHERE customer_id = $1 AND month_year = $2 AND post_number = $3
        RETURNING *
      `, values);
    }

    console.log('✅ Post saved successfully:', result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("❌ Error updating content calendar post:", error.message);
    console.error("Error details:", error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message, sqlError: error.detail });
  }
});

// =====================================================
// FILE UPLOAD FOR CONTENT
// =====================================================

// Upload files for content calendar (ARTE, Elementos, etc.)
router.post("/content/:postId/upload", upload.array('files', 10), async (req, res) => {
  try {
    const { postId } = req.params;
    const { fileType } = req.body; // 'arte', 'elementos', 'referencia'
    const pool = req.pool;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      original_name: file.originalname,
      file_path: `/uploads/${file.filename}`,
      file_size: file.size,
      mime_type: file.mimetype,
      file_type: fileType
    }));

    // Store file paths in content_calendar based on type
    let updateQuery = '';
    let fileData = uploadedFiles[0].file_path; // Single file for ARTE

    if (fileType === 'arte') {
      updateQuery = 'UPDATE content_calendar SET arte = $1 WHERE id = $2 RETURNING *';
    } else if (fileType === 'elementos') {
      // Multiple files for elementos
      const filePaths = uploadedFiles.map(f => f.file_path);
      updateQuery = 'UPDATE content_calendar SET elementos_utilizar = $1 WHERE id = $2 RETURNING *';
      fileData = JSON.stringify(filePaths);
    }

    if (updateQuery) {
      const result = await pool.query(updateQuery, [fileData, postId]);
      res.json({
        success: true,
        files: uploadedFiles,
        post: result.rows[0]
      });
    } else {
      res.json({ success: true, files: uploadedFiles });
    }
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

module.exports = router;
