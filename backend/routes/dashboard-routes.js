const express = require('express');
const router = express.Router();

// =====================================================
// DASHBOARD METRICS
// =====================================================

router.get("/dashboard-metrics", async (req, res) => {
  try {
    const pool = req.pool;
    console.log("🔍 Dashboard metrics requested by user:", req.user.id);

    // First, let's check if the tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('customers', 'loans', 'payments', 'accounting_entries', 'loan_installments')
    `);
    console.log("📊 Available tables:", tablesCheck.rows.map(r => r.table_name));

    const [customers, loans, capital, interest, overdue, overdueCustomers] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM customers"),
      pool.query("SELECT COUNT(*) FROM loans"),
      pool.query("SELECT COALESCE(SUM(amount), 0) FROM loans"),
      pool.query("SELECT COALESCE(SUM(amount), 0) FROM accounting_entries WHERE type = 'interestPaid'"),
      pool.query("SELECT COALESCE(SUM(amount_due + penalty_applied), 0) FROM loan_installments WHERE status = 'pending' AND due_date < CURRENT_DATE"),
      pool.query(`
        SELECT COUNT(DISTINCT loan_id)
        FROM loan_installments
        WHERE status = 'pending'
          AND due_date < CURRENT_DATE
      `)
    ]);

    // Debug logs for dashboard metrics
    console.log("📊 Dashboard metric: customers =", customers.rows);
    console.log("📊 Dashboard metric: loans =", loans.rows);

    const response = {
      customers: parseInt(customers.rows[0].count),
      loansIssued: parseInt(loans.rows[0].count),
      capitalLoaned: parseFloat(capital.rows[0].coalesce),
      interestToCollect: parseFloat(interest.rows[0].coalesce),
      overdueAmount: parseFloat(overdue.rows[0].coalesce),
      customersOverdue: parseInt(overdueCustomers.rows[0].count)
    };

    console.log("📊 Final dashboard response:", response);
    res.json(response);
  } catch (err) {
    console.error("❌ Error fetching dashboard metrics:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// =====================================================
// DASHBOARD RECENT ACTIVITY
// =====================================================

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const pool = req.pool;
    // Get recent payments
    const paymentsResult = await pool.query(`
      SELECT
        'payment' as type,
        '💰 Pago Registrado' as title,
        CONCAT('Pago de $', amount, ' para préstamo #', loan_id) as description,
        payment_date as timestamp,
        '💰' as icon
      FROM payments
      ORDER BY payment_date DESC
      LIMIT 5
    `);

    // Get recent loans
    const loansResult = await pool.query(`
      SELECT
        'loan' as type,
        '💳 Nuevo Préstamo' as title,
        CONCAT('Préstamo de $', amount, ' aprobado') as description,
        created_at as timestamp,
        '💳' as icon
      FROM loans
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent customers
    const customersResult = await pool.query(`
      SELECT
        'customer' as type,
        '👤 Nuevo Cliente' as title,
        CONCAT(first_name, ' ', last_name, ' registrado') as description,
        created_at as timestamp,
        '👤' as icon
      FROM customers
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Combine and sort by timestamp
    const allActivities = [
      ...paymentsResult.rows,
      ...loansResult.rows,
      ...customersResult.rows
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(allActivities.slice(0, 10));
  } catch (err) {
    console.error("Error fetching recent activity:", err);
    res.status(500).json({ message: "Error fetching recent activity" });
  }
});

// =====================================================
// STORE PROFITABILITY
// =====================================================

router.get("/dashboard/store-profitability", async (req, res) => {
  const pool = req.pool;
  const { from, to } = req.query;
  const dateFilter = (from && to)
    ? `AND DATE(l.created_at) BETWEEN '${from}' AND '${to}'`
    : `AND DATE(l.created_at) >= date_trunc('year', CURRENT_DATE)`;

  try {
    const result = await pool.query(`
      SELECT
        ii.store,
        COALESCE(SUM(l.amount), 0) AS revenue,
        COALESCE(SUM(ii.purchase_price), 0) AS cogs,
        COALESCE(SUM(ie.interest), 0) AS interest,
        COALESCE(SUM(pe.penalty), 0) AS penalties,
        COALESCE(SUM(e.amount), 0) AS expenses
      FROM loans l
      LEFT JOIN inventory_items ii ON l.inventory_item_id = ii.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) AS interest
        FROM accounting_entries
        WHERE type = 'interestPaid'
        GROUP BY loan_id
      ) ie ON ie.loan_id = l.id
      LEFT JOIN (
        SELECT loan_id, SUM(amount) AS penalty
        FROM accounting_entries
        WHERE type = 'penaltyFee'
        GROUP BY loan_id
      ) pe ON pe.loan_id = l.id
      LEFT JOIN payments p ON p.loan_id = l.id
      LEFT JOIN expenses e ON e.store_id = CASE
        WHEN ii.store = 'atlixco' THEN 1
        WHEN ii.store = 'cholula' THEN 2
        WHEN ii.store = 'chipilo' THEN 3
        ELSE NULL
      END
      WHERE ii.store IS NOT NULL ${dateFilter}
      GROUP BY ii.store
      ORDER BY ii.store;
    `);

    const data = result.rows.map(r => ({
      store: r.store,
      revenue: parseFloat(r.revenue),
      cogs: parseFloat(r.cogs),
      interest: parseFloat(r.interest),
      penalties: parseFloat(r.penalties),
      expenses: parseFloat(r.expenses),
      net_profit:
        parseFloat(r.revenue) +
        parseFloat(r.interest) +
        parseFloat(r.penalties) -
        parseFloat(r.cogs) -
        parseFloat(r.expenses)
    }));

    res.json(data);
  } catch (err) {
    console.error("Error generating store profitability report:", err);
    res.status(500).json({ message: "Error generating store profitability report" });
  }
});

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
