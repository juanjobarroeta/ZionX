const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// =====================================================
// ADMIN MANAGEMENT (stores, users)
// =====================================================

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
    const result = await pool.query(`
      SELECT id, name, email, role, store_id, is_active, created_at, last_login
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

    res.json({ user: result.rows[0], message: "Usuario creado correctamente" });
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
