/**
 * ZIONX Marketing Platform — Backend Entry Point
 * Slim server setup that imports modular route files.
 */

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Core imports
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Auth & DB modules
const { authenticateToken, isAdmin } = require('./middleware/auth');
const { createTables } = require('./database/schema');

// Express setup
const app = express();
const port = process.env.PORT || 5001;

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

// Static uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Database connection
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'zionx_dev',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 5432,
    });

console.log('🌐 Database:', process.env.DATABASE_URL ? 'Connected via DATABASE_URL' : 'Using local connection');

// Health check (no auth)
app.get('/ping', (req, res) => res.json({ status: 'ok' }));
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ status: 'healthy', database: 'connected', current_time: result.rows[0].current_time });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// Auth routes (login/register — no auth middleware)
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role || 'user']
    );
    const { generateToken } = require('./middleware/auth');
    const token = generateToken(result.rows[0]);
    res.status(201).json({ user: result.rows[0], token });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ message: 'Email already exists' });
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const { generateToken } = require('./middleware/auth');
    const token = generateToken(user);

    // Get employee info if exists
    let employee = null;
    try {
      const empResult = await pool.query('SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]);
      if (empResult.rows.length > 0) employee = empResult.rows[0];
    } catch (e) { /* employees table may not exist yet */ }

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, store_id: user.store_id },
      employee,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Middleware helper: inject pool into req
const withPool = (req, res, next) => { req.pool = pool; next(); };

// =====================================================
// ROUTE MOUNTING
// =====================================================

async function start() {
  try {
    console.log('🚀 Starting server...');
    await createTables(pool);
    console.log('✅ Database tables created/verified');

    // Create default admin user if no users exist
    try {
      const usersCheck = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(usersCheck.rows[0].count) === 0) {
        const hashedPassword = await bcrypt.hash('zionx2024', 10);
        await pool.query(
          "INSERT INTO users (name, email, password, role, is_active) VALUES ('Admin', 'admin@zionx.com', $1, 'admin', true)",
          [hashedPassword]
        );
        console.log('✅ Default admin user created: admin@zionx.com / zionx2024');
      }
    } catch (e) {
      console.log('⚠️ Could not check/create default user:', e.message);
    }

    // --- Existing external route files ---
    const whatsappRoutes = require('./routes/whatsapp');
    const leadsRoutes = require('./routes/leads');
    const incomeRoutes = require('./routes/income');
    const incomeInvoicesRoutes = require('./routes/income-invoices');
    const incomePaymentsRoutes = require('./routes/income-payments');
    const customerImportRoutes = require('./routes/customer-import');
    const hrPayrollRoutes = require('./routes/hr-payroll');
    const notificationsRoutes = require('./routes/notifications');
    const messagesRoutes = require('./routes/messages');
    const socialMediaRoutes = require('./routes/social-media');
    const approvalsRoutes = require('./routes/approvals');
    const expensesRoutes = require('./routes/expenses');
    const creativeBriefsRoutes = require('./routes/creative-briefs');

    // --- New extracted route files ---
    const customersRoutes = require('./routes/customers-routes');
    const contentCalendarRoutes = require('./routes/content-calendar-routes');
    const teamRoutes = require('./routes/team-routes');
    const dashboardRoutes = require('./routes/dashboard-routes');
    const inventoryRoutes = require('./routes/inventory-routes');
    const budgetsRoutes = require('./routes/budgets-routes');
    const adminRoutes = require('./routes/admin-routes');

    // WhatsApp & Leads (mounted at root, have their own auth)
    app.use(whatsappRoutes);
    app.use(leadsRoutes);

    // Income management
    app.use('/api/income', withPool, authenticateToken, incomeRoutes);
    app.use('/api/income', withPool, authenticateToken, incomeInvoicesRoutes);
    app.use('/api/income', withPool, authenticateToken, incomePaymentsRoutes);

    // Customer import
    app.use('/api', withPool, authenticateToken, customerImportRoutes);

    // HR & Payroll
    app.use('/api/hr', withPool, authenticateToken, hrPayrollRoutes);

    // Notifications
    app.use('/api/notifications', withPool, authenticateToken, notificationsRoutes);

    // Messages
    app.use('/api/messages', withPool, authenticateToken, messagesRoutes);

    // Social Media (public /config endpoint, auth for rest)
    app.use('/api/social', (req, res, next) => {
      req.pool = pool;
      if (req.path === '/config' && req.method === 'GET') return next();
      return authenticateToken(req, res, next);
    }, socialMediaRoutes);

    // Approvals (public /client/* endpoints, auth for rest)
    app.use('/api/approvals', (req, res, next) => {
      req.pool = pool;
      if (req.path.startsWith('/client/')) return next();
      return authenticateToken(req, res, next);
    }, approvalsRoutes);

    // Expenses
    app.use('/api/expenses', withPool, authenticateToken, expensesRoutes);

    // Creative Briefs (has its own public/auth split)
    app.use('/api/briefs', withPool, creativeBriefsRoutes);

    // --- New modular routes ---
    // Customers (mounted at root since routes include /customers prefix)
    app.use('/', withPool, authenticateToken, customersRoutes);

    // Content Calendar
    app.use('/', withPool, authenticateToken, contentCalendarRoutes);

    // Team, tasks, projects
    app.use('/', withPool, authenticateToken, teamRoutes);

    // Dashboard & promotions
    app.use('/', withPool, authenticateToken, dashboardRoutes);

    // Inventory & warehouse
    app.use('/', withPool, authenticateToken, inventoryRoutes);

    // Budgets
    app.use('/budgets', withPool, authenticateToken, budgetsRoutes);

    // Admin (stores, users)
    app.use('/admin', withPool, authenticateToken, isAdmin, adminRoutes);

    // Start the post scheduler
    const PostScheduler = require('./services/postScheduler');
    const postScheduler = new PostScheduler(pool);
    postScheduler.start();

    // Start server
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Backend live at http://0.0.0.0:${port}`);
      console.log('📡 Server is listening and ready to accept connections');
    });
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
}

start();
