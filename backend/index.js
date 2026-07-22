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
const { requireSection } = require('./middleware/authorize');
const { createTables } = require('./database/schema');

// Express setup
const app = express();
const port = process.env.PORT || 5001;

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// CORS — allow configured origins, any *.vercel.app deployment, and localhost.
// Set CORS_ORIGINS (comma-separated) to add custom domains.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Non-browser requests (curl, server-to-server) have no Origin header.
    if (!origin) return callback(null, true);
    let hostname = '';
    try { hostname = new URL(origin).hostname; } catch { /* malformed origin */ }
    const ok =
      allowedOrigins.includes(origin) ||
      /^(localhost|127\.0\.0\.1)$/.test(hostname) ||
      /\.vercel\.app$/.test(hostname);
    return callback(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Static uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Database connection
// Resilience options shared by both connection modes. On Railway the internal
// network (postgres.railway.internal) drops idle connections routinely — idle
// timeout, a Postgres restart, or a transient blip. Without keepAlive + an
// error handler, a dropped idle client surfaces as "Connection terminated
// unexpectedly" and the pool emits an unhandled 'error', which becomes an
// uncaught exception and takes the whole backend down (frontend can't reach it).
const poolResilience = {
  max: 10,                          // cap connections (Railway PG has a low limit)
  idleTimeoutMillis: 30000,         // recycle idle clients before the server drops them
  connectionTimeoutMillis: 10000,   // fail fast instead of hanging a request
  keepAlive: true,                  // TCP keepalive keeps idle sockets from being reaped
  keepAliveInitialDelayMillis: 10000,
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
      ...poolResilience,
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'zionx_dev',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 5432,
      ...poolResilience,
    });

// CRITICAL: handle errors on idle pool clients. node-postgres emits 'error' on
// the pool when a backend/network error hits an idle client. With no listener,
// Node throws it as an uncaught exception. We log and let the pool discard the
// dead client — the next query transparently opens a fresh connection.
pool.on('error', (err) => {
  console.error('⚠️ Idle Postgres client error (pool will recover):', err.message);
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
    // Match email case-insensitively (emails aren't case-sensitive) and treat a
    // NULL is_active as active — only an explicit is_active = false blocks login.
    // Some legacy rows have is_active = NULL, which the old `= true` filter
    // rejected, locking valid users out with a misleading "Invalid credentials".
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active IS NOT FALSE ORDER BY id LIMIT 1',
      [email]
    );
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
      user: { id: user.id, name: user.name, email: user.email, role: user.role, store_id: user.store_id, customer_id: user.customer_id },
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

// Run createTables with retry/backoff. A transient DB blip during boot must not
// permanently crash-loop the backend — retry a few times before giving up.
async function initSchemaWithRetry(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await createTables(pool);
      return;
    } catch (err) {
      const wait = Math.min(2000 * 2 ** (i - 1), 30000);
      console.error(`❌ createTables failed (attempt ${i}/${attempts}): ${err.message}`);
      if (i === attempts) throw err;
      console.log(`⏳ Retrying schema init in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function start() {
  try {
    console.log('🚀 Starting server...');
    await initSchemaWithRetry();
    console.log('✅ Database tables created/verified');

    // Warn (do NOT auto-create) when there are no users. Seeding a known
    // admin@zionx.com / zionx2024 account was a standing backdoor — instead
    // create the first admin explicitly with create-production-admin.js.
    try {
      const usersCheck = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(usersCheck.rows[0].count) === 0) {
        console.log('⚠️ No users found. Create the first admin with: node create-production-admin.js');
      }
    } catch (e) {
      console.log('⚠️ Could not check users table:', e.message);
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
    const bancosRoutes = require('./routes/bancos-routes');
    const creativeBriefsRoutes = require('./routes/creative-briefs');

    // --- New extracted route files ---
    const customersRoutes = require('./routes/customers-routes');
    const contentCalendarRoutes = require('./routes/content-calendar-routes');
    const pipelineRoutes = require('./routes/pipeline-routes');
    const teamRoutes = require('./routes/team-routes');
    const dashboardRoutes = require('./routes/dashboard-routes');
    const inventoryRoutes = require('./routes/inventory-routes');
    const budgetsRoutes = require('./routes/budgets-routes');
    const adminRoutes = require('./routes/admin-routes');
    const portalRoutes = require('./routes/portal-routes');
    const adsRoutes = require('./routes/ads');

    // WhatsApp & Leads (mounted at root, have their own auth)
    app.use(whatsappRoutes);
    app.use(leadsRoutes);

    // Income management (finance — ingresos section)
    app.use('/api/income', withPool, authenticateToken, requireSection('ingresos'), incomeRoutes);
    app.use('/api/income', withPool, authenticateToken, requireSection('ingresos'), incomeInvoicesRoutes);
    app.use('/api/income', withPool, authenticateToken, requireSection('ingresos'), incomePaymentsRoutes);

    // Customer import
    app.use('/api', withPool, authenticateToken, customerImportRoutes);

    // HR & Payroll
    app.use('/api/hr', withPool, authenticateToken, hrPayrollRoutes);

    // Notifications
    app.use('/api/notifications', withPool, authenticateToken, notificationsRoutes);

    // Messages
    app.use('/api/messages', withPool, authenticateToken, messagesRoutes);

    // Social Media (public /config endpoint; auth + social_media section for rest)
    app.use('/api/social', (req, res, next) => {
      req.pool = pool;
      if (req.path === '/config' && req.method === 'GET') return next();
      return authenticateToken(req, res, () => requireSection('social_media')(req, res, next));
    }, socialMediaRoutes);

    // Approvals (public /client/* endpoints; auth + social_media section for rest)
    app.use('/api/approvals', (req, res, next) => {
      req.pool = pool;
      if (req.path.startsWith('/client/')) return next();
      return authenticateToken(req, res, () => requireSection('social_media')(req, res, next));
    }, approvalsRoutes);

    // Expenses (finance — finanzas section)
    app.use('/api/expenses', withPool, authenticateToken, requireSection('finanzas'), expensesRoutes);

    // Bancos — bank statement reconciliation (finance — finanzas section)
    app.use('/api/bancos', withPool, authenticateToken, requireSection('finanzas'), bancosRoutes);

    // Fiscal mirror from contabilidad-os (read-only)
    const { nominaRouter, estadosRouter } = require('./routes/hub-mirror-routes');
    app.use('/api', withPool, authenticateToken, requireSection('hr'), nominaRouter);
    app.use('/api', withPool, authenticateToken, requireSection('finanzas'), estadosRouter);

    // Creative Briefs (has its own public/auth split)
    app.use('/api/briefs', withPool, creativeBriefsRoutes);

    // --- New modular routes ---
    // Customers (mounted at root since routes include /customers prefix)
    app.use('/', withPool, authenticateToken, customersRoutes);

    // Content Calendar
    app.use('/', withPool, authenticateToken, contentCalendarRoutes);

    // Post production pipeline (owned, stateful stages)
    app.use('/', withPool, authenticateToken, pipelineRoutes);

    // Team, tasks, projects
    app.use('/', withPool, authenticateToken, teamRoutes);

    // Dashboard & promotions
    app.use('/', withPool, authenticateToken, dashboardRoutes);

    // Inventory & warehouse
    app.use('/', withPool, authenticateToken, inventoryRoutes);

    // Budgets (finance — finanzas section)
    app.use('/budgets', withPool, authenticateToken, requireSection('finanzas'), budgetsRoutes);

    // Admin (stores, users)
    app.use('/admin', withPool, authenticateToken, isAdmin, adminRoutes);

    // Advertising accounts + spend sync (agency-side; social_media section)
    app.use('/api/ads', withPool, authenticateToken, requireSection('social_media'), adsRoutes);

    // Client portal summary (client-scoped; staff may pass ?customer_id=)
    app.use('/', withPool, authenticateToken, portalRoutes);

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
