const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const publishSync = require('../services/publishSync');
const { seedStagesForPost, recomputeDueDates } = require('../services/pipeline');

// Public base for building absolute media URLs Meta can fetch.
const publicBase = (req) =>
  process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;

// Multer setup for file uploads — destination and naming come from
// config/storage so uploads land on the persistent volume in production.
const { diskStorage } = require('../config/storage');

const storage = diskStorage(multer);

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

    // Allocate a post_number that won't collide with the
    // (customer_id, month_year, post_number) unique key. If none was provided,
    // or the requested one is already taken, append the next available number.
    let postNumber = post_number;
    const nextRes = await pool.query(
      `SELECT COALESCE(MAX(post_number), 0) + 1 AS next
         FROM content_calendar WHERE customer_id = $1 AND month_year = $2`,
      [customer_id, month_year]
    );
    const nextNumber = nextRes.rows[0].next;
    if (!postNumber) {
      postNumber = nextNumber;
    } else {
      const taken = await pool.query(
        `SELECT 1 FROM content_calendar
          WHERE customer_id = $1 AND month_year = $2 AND post_number = $3`,
        [customer_id, month_year, postNumber]
      );
      if (taken.rows.length) postNumber = nextNumber;
    }

    const result = await pool.query(`
      INSERT INTO content_calendar (
        customer_id, month_year, post_number, title, description, campaign, platform, pilar, content_type,
        scheduled_date, status, idea_tema, referencia, copy_in, copy_out,
        arte, fotos_video, elementos_utilizar, assigned_designer, assigned_community_manager
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      customer_id, month_year, postNumber,
      campaign || `Post ${postNumber}`, // title (required)
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
        cc.id, cc.customer_id, cc.title, cc.campaign, cc.platform, cc.pilar, cc.content_type,
        cc.scheduled_date, cc.status, cc.idea_tema, cc.copy_in, cc.copy_out, cc.arte,
        cc.priority, cc.client_status, cc.scheduled_post_id,
        (SELECT COUNT(*)::int FROM post_pipeline_stages pps
          WHERE pps.content_calendar_id = cc.id
            AND pps.optional = false AND pps.status <> 'listo') AS pending_stages,
        cc.assigned_designer, cc.assigned_community_manager,
        COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''), NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente') AS customer_name,
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
/**
 * POST /quick-post — publicación rápida
 *
 * The pipeline exists because most work is planned ahead. This is the other
 * case: something has to go out now, or this afternoon, and walking the whole
 * calendar → arte → aprobación → programar path is too many steps for it.
 *
 * One request does everything: the art comes up with the form, the calendar
 * entry is created already approved, and it either goes into the queue for a
 * time you pick or straight out. The entry is still created — skipping it would
 * cost the post its place in the calendar, its client history and its metrics.
 */
router.post("/quick-post", upload.single("file"), async (req, res) => {
  try {
    const {
      customer_id, platform = "instagram", content_type = "post",
      title, message, when = "schedule", scheduled_for,
    } = req.body;

    if (!customer_id) return res.status(400).json({ message: "Elige un cliente" });

    const isStory = String(content_type).toLowerCase() === "story";
    if (!req.file) return res.status(400).json({ message: "Sube el arte o el video" });
    if (!isStory && !String(message || "").trim()) {
      return res.status(400).json({ message: "Escribe el copy" });
    }

    // A story carries no caption, so it has nothing to name itself with.
    const name =
      String(title || "").trim() ||
      String(message || "").trim().split("\n")[0].slice(0, 60) ||
      `${content_type} · ${new Date().toISOString().slice(0, 10)}`;

    const at = when === "now" ? new Date() : new Date(scheduled_for);
    if (Number.isNaN(at.getTime())) return res.status(400).json({ message: "La fecha no es válida" });
    if (when !== "now" && at.getTime() < Date.now() - 60000) {
      return res.status(400).json({ message: "Esa fecha ya pasó" });
    }

    // The form sends an instant; the calendar stores the wall clock the team
    // reads. Splitting it in UTC would file a 3pm post under 9pm, and promote()
    // would then read that 9pm back as local. Let Postgres do the conversion.
    const local = await req.pool.query(
      `SELECT ($1::timestamptz AT TIME ZONE $2)::date AS d,
              ($1::timestamptz AT TIME ZONE $2)::time AS t`,
      [at.toISOString(), publishSync.SCHEDULE_TZ]
    );
    const { d: localDate, t: localTime } = local.rows[0];

    const arte = `/uploads/${req.file.filename}`;
    const inserted = await req.pool.query(
      `INSERT INTO content_calendar
         (customer_id, title, content_type, platform, scheduled_date, scheduled_time,
          status, copy_out, arte, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'aprobado',$7,$8,$9,NOW(),NOW())
       RETURNING id`,
      [customer_id, name, content_type, platform, localDate, localTime,
       message || null, arte, req.user?.id || null]
    );
    const entryId = inserted.rows[0].id;

    const promoted = await publishSync.promote(req.pool, entryId, publicBase(req));
    if (!promoted.ok) {
      // Keep the entry — the art is already uploaded and the work is not lost;
      // it shows up in the calendar with exactly what it still needs.
      return res.status(422).json({
        message: "Se guardó, pero aún no se puede publicar",
        id: entryId, missing: promoted.readiness.missing,
      });
    }

    if (when !== "now") {
      return res.json({ success: true, id: entryId, scheduled_for: promoted.scheduled_post.scheduled_for });
    }

    const PostScheduler = require("../services/postScheduler");
    const result = await new PostScheduler(req.pool).publishOne(promoted.scheduled_post.id);
    if (result.ok) return res.json({ success: true, id: entryId, published: true, url: result.url });

    return res.status(502).json({
      message: result.error || "Se guardó y quedó en la cola, pero no se pudo publicar ahora",
      id: entryId,
    });
  } catch (error) {
    console.error("Error in quick post:", error);
    res.status(500).json({ message: "No se pudo crear la publicación" });
  }
});

/**
 * POST /content-calendar/:id/publish-now
 *
 * Publish this minute, ahead of the schedule. The plan is to work ahead — but
 * a client asks for something to go out now, and the app should be able to.
 *
 * It still goes through the queue rather than around it: promote() applies the
 * same readiness rules as Programar, and the scheduler's own claim publishes
 * it. Nothing here is a second way to publish that could drift from the first.
 */
router.post("/content-calendar/:id/publish-now", async (req, res) => {
  try {
    const promoted = await publishSync.promote(req.pool, req.params.id, publicBase(req));
    if (promoted.notFound) return res.status(404).json({ message: "Entrada no encontrada" });
    if (!promoted.ok) {
      return res.status(422).json({ message: "La publicación aún no está lista", missing: promoted.readiness.missing });
    }

    const PostScheduler = require("../services/postScheduler");
    const result = await new PostScheduler(req.pool).publishOne(promoted.scheduled_post.id);

    if (result.ok) return res.json({ success: true, url: result.url });

    if (result.reason === "already-published") {
      return res.status(409).json({ message: "Esta publicación ya salió" });
    }
    if (result.reason === "busy") {
      return res.status(409).json({ message: "Ya se está publicando en este momento" });
    }
    return res.status(502).json({ message: result.error || "No se pudo publicar" });
  } catch (error) {
    console.error("Error publishing now:", error);
    res.status(500).json({ message: "No se pudo publicar" });
  }
});

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

    // Moving the publish date moves every pending deadline with it — the
    // production plan is derived backwards from the date it serves.
    if ('scheduled_date' in updates && result.rows[0]) {
      await recomputeDueDates(pool, id, result.rows[0].scheduled_date);
    }

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

/**
 * GET /content-calendar/:id
 *
 * Everything about one post, in one request: the idea and the artwork, the
 * production ladder with who owns each rung, where the client stands, the
 * queued publication, and — once it is out — how it did.
 *
 * This exists because a post had no home. Its pieces lived across the
 * calendar, the approvals queue, the publishing hub and Rendimiento, and
 * moving one post meant finding it again on each of them.
 */
router.get("/content-calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "id inválido" });

    const post = await req.pool.query(
      `SELECT cc.*,
              COALESCE(NULLIF(c.commercial_name,''), NULLIF(c.business_name,''),
                       NULLIF(TRIM(c.first_name || ' ' || c.last_name),''), 'Cliente') AS customer_name,
              designer.name AS designer_name,
              cm.name AS cm_name,
              approver.name AS approver_name
         FROM content_calendar cc
         LEFT JOIN customers c ON c.id = cc.customer_id
         LEFT JOIN team_members designer ON designer.id = cc.assigned_designer
         LEFT JOIN team_members cm ON cm.id = cc.assigned_community_manager
         LEFT JOIN team_members approver ON approver.id = cc.assigned_approver
        WHERE cc.id = $1`,
      [id]
    );
    if (!post.rows.length) return res.status(404).json({ error: "La publicación no existe" });
    const row = post.rows[0];

    // The ladder. `ready` means every required rung below it is done, so it is
    // genuinely this person's turn rather than merely assigned to them.
    const stages = await req.pool.query(
      `SELECT s.id, s.stage_key, s.status, s.optional, s.position, s.owner_id, s.due_date,
              tm.name AS owner_name, tm.user_id AS owner_user_id,
              NOT EXISTS (
                SELECT 1 FROM post_pipeline_stages p
                 WHERE p.content_calendar_id = s.content_calendar_id
                   AND p.optional = false AND p.position < s.position AND p.status <> 'listo'
              ) AS ready
         FROM post_pipeline_stages s
         LEFT JOIN team_members tm ON tm.id = s.owner_id
        WHERE s.content_calendar_id = $1
        ORDER BY s.position ASC`,
      [id]
    );

    let publication = null;
    if (row.scheduled_post_id) {
      const pub = await req.pool.query(
        `SELECT sp.id, sp.status, sp.scheduled_for, sp.published_at, sp.platform_post_url,
                sp.error_message, sp.retry_count, sp.content_type, sp.message,
                sa.account_username, sa.account_name, sa.platform
           FROM scheduled_posts sp
           LEFT JOIN social_accounts sa ON sa.id = sp.social_account_id
          WHERE sp.id = $1`,
        [row.scheduled_post_id]
      );
      publication = pub.rows[0] || null;
    }

    // Only meaningful once it is live; the newest snapshot is the current truth.
    let metrics = null;
    if (publication?.id) {
      const m = await req.pool.query(
        `SELECT views, reach, likes, comments, shares, saves, total_interactions,
                permalink, snapshot_date
           FROM post_analytics
          WHERE scheduled_post_id = $1
          ORDER BY snapshot_date DESC NULLS LAST, id DESC
          LIMIT 1`,
        [publication.id]
      );
      metrics = m.rows[0] || null;
    }

    const account = await publishSync.resolveAccount(req.pool, row.customer_id, row.platform);
    const readiness = publishSync.computeReadiness(row, !!account);

    res.json({
      post: row,
      stages: stages.rows,
      publication,
      metrics,
      readiness,
      account: account
        ? { id: account.id, username: account.account_username, name: account.account_name, platform: account.platform }
        : null,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "No se pudo cargar la publicación" });
  }
});

module.exports = router;
