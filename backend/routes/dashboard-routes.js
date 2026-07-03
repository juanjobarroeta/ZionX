const express = require('express');
const router = express.Router();

// =====================================================
// PROMOTIONS
// =====================================================

router.get("/promotions", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM promotions ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching promotions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/promotions/active", async (req, res) => {
  try {
    const pool = req.pool;
    const result = await pool.query(`
      SELECT * FROM promotions WHERE status = 'active' ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching active promotions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================
// PUBLIC APPLICATION
// =====================================================

router.post("/public/apply", async (req, res) => {
  try {
    const pool = req.pool;
    const { name, email, phone, promotion_id } = req.body;
    const result = await pool.query(`
      INSERT INTO public_applications (name, email, phone, promotion_id)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, email, phone, promotion_id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error creating public application:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
