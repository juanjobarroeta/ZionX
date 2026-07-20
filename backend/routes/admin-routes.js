const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// =====================================================
// ADMIN MANAGEMENT (stores, users)
// =====================================================

// POST /admin/users/:id/team-member
// Create (or re-activate + link) a team_member for this user, so the user can
// be assigned production work and show up in the assignment dropdowns and in
// "Mi trabajo". Idempotent: matches an existing team_member by user_id or email.
router.post("/users/:id/team-member", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    const uRes = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1", [id]);
    if (!uRes.rows.length) return res.status(404).json({ message: "Usuario no encontrado" });
    const user = uRes.rows[0];

    // Already a team member (by explicit link or by email)? Re-activate + link.
    const existing = await pool.query(
      `SELECT id FROM team_members
        WHERE user_id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2))
        ORDER BY (user_id = $1) DESC LIMIT 1`,
      [user.id, user.email || ""]
    );
    if (existing.rows.length) {
      const { rows } = await pool.query(
        `UPDATE team_members
            SET user_id = $1, is_active = true, updated_at = NOW()
          WHERE id = $2
          RETURNING id, name, email, role, is_active`,
        [user.id, existing.rows[0].id]
      );
      return res.json({ success: true, linked: true, team_member: rows[0] });
    }

    const { rows } = await pool.query(
      `INSERT INTO team_members (user_id, name, email, role, department, is_active)
       VALUES ($1, $2, $3, $4, 'Marketing', true)
       RETURNING id, name, email, role, is_active`,
      [user.id, user.name, user.email, user.role || "community_manager"]
    );
    res.status(201).json({ success: true, created: true, team_member: rows[0] });
  } catch (err) {
    console.error("Error linking user to team:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

// POST /admin/customers/:id/client-user
// Create (or re-point) a client-portal login for a customer. The user gets
// role='client' scoped to that customer_id, so they only ever see their own
// funnel. Idempotent by email.
router.post("/customers/:id/client-user", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email y contraseña son requeridos" });

    const cust = await pool.query("SELECT id FROM customers WHERE id = $1", [id]);
    if (!cust.rows.length) return res.status(404).json({ message: "Cliente no encontrado" });

    const hashed = await bcrypt.hash(password, 10);
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existing.rows.length) {
      const { rows } = await pool.query(
        `UPDATE users SET password = $1, role = 'client', customer_id = $2, is_active = true,
                          name = COALESCE($3, name), updated_at = NOW()
         WHERE id = $4 RETURNING id, name, email, role, customer_id`,
        [hashed, id, name || null, existing.rows[0].id]
      );
      return res.json({ success: true, linked: true, user: rows[0] });
    }
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, customer_id, is_active)
       VALUES ($1, $2, $3, 'client', $4, true)
       RETURNING id, name, email, role, customer_id`,
      [name || email, email, hashed, id]
    );
    res.status(201).json({ success: true, created: true, user: rows[0] });
  } catch (err) {
    console.error("Error creating client-portal user:", err);
    res.status(500).json({ message: "Error al crear el acceso de cliente" });
  }
});

// Get all stores
router.get("/stores", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM stores ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching stores:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  try {
    const pool = req.pool;
    // Select only columns guaranteed to exist so a missing optional column
    // (e.g. last_login on older DBs) can't 500 this and blank the whole list.
    const result = await pool.query(`
      SELECT id, name, email, role, store_id, is_active, created_at
      FROM users
      WHERE is_active = true OR is_active IS NULL
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new user
router.post("/create-user", async (req, res) => {
  try {
    const pool = req.pool;
    const { name, email, password, role, store_id, permissions } = req.body;

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "El correo ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(`
      INSERT INTO users (name, email, password, role, store_id, permissions)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, is_active
    `, [name, email, hashedPassword, role, store_id || null, permissions || {}]);

    const user = result.rows[0];

    // One person = one account: seed the linked team_members row so the new
    // user is immediately assignable to content and shows up on "Mi trabajo".
    // team_members.user_id is the clean login link. Best-effort — a failure here
    // must not fail user creation. If a team_member already exists for this
    // email (imported earlier), link it instead of duplicating.
    try {
      const existing = await pool.query(
        'SELECT id FROM team_members WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );
      if (existing.rows.length) {
        await pool.query(
          'UPDATE team_members SET user_id = $1, role = COALESCE($2, role), is_active = true WHERE id = $3',
          [user.id, role || null, existing.rows[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO team_members (user_id, name, email, role, is_active) VALUES ($1, $2, $3, $4, true)',
          [user.id, name, email, role || null]
        );
      }
    } catch (seedErr) {
      console.error('Could not seed team_member for new user:', seedErr.message);
    }

    res.json({ user, message: "Usuario creado correctamente" });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Error al crear usuario", error: err.message });
  }
});

// Update user
router.patch("/users/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { name, email, password, is_active, role, store_id, permissions } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (email) {
      updateFields.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = $${paramCount}`);
      values.push(hashedPassword);
      paramCount++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (role) {
      updateFields.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (store_id !== undefined) {
      updateFields.push(`store_id = $${paramCount}`);
      values.push(store_id || null);
      paramCount++;
    }

    if (permissions) {
      updateFields.push(`permissions = $${paramCount}`);
      values.push(permissions);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);
    const result = await pool.query(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, is_active
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ user: result.rows[0], message: "Usuario actualizado correctamente" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Error al actualizar usuario", error: err.message });
  }
});

module.exports = router;
