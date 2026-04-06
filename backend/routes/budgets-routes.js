const express = require('express');
const router = express.Router();

// =====================================================
// BUDGET MANAGEMENT
// =====================================================

// Get all budgets
router.get("/", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM budgets
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching budgets:", err);
    res.status(500).json({ message: "Error fetching budgets" });
  }
});

// Create new budget
router.post("/", async (req, res) => {
  try {
    const pool = req.pool;
    const { category, amount, period, start_date, end_date, description, store_id, is_active } = req.body;
    const userId = req.user.id;

    const result = await pool.query(`
      INSERT INTO budgets (category, amount, period, start_date, end_date, description, store_id, is_active, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `, [category, amount, period, start_date, end_date, description, store_id, is_active, userId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating budget:", err);
    res.status(500).json({ message: "Error creating budget" });
  }
});

// Update budget
router.put("/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;
    const { category, amount, period, start_date, end_date, description, store_id, is_active } = req.body;

    const result = await pool.query(`
      UPDATE budgets
      SET category = $1, amount = $2, period = $3, start_date = $4, end_date = $5,
          description = $6, store_id = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [category, amount, period, start_date, end_date, description, store_id, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Budget not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating budget:", err);
    res.status(500).json({ message: "Error updating budget" });
  }
});

// Delete budget
router.delete("/:id", async (req, res) => {
  try {
    const pool = req.pool;
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM budgets WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Budget not found" });
    }

    res.json({ message: "Budget deleted successfully" });
  } catch (err) {
    console.error("Error deleting budget:", err);
    res.status(500).json({ message: "Error deleting budget" });
  }
});

module.exports = router;
