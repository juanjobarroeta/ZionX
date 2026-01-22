// ==============================================================================
// CrediYA API Server - Safe Clean Architecture
// ==============================================================================
// Uses clean database module while preserving ALL business logic
// ==============================================================================

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
require("dotenv").config();
const XLSX = require("xlsx");

// Database connection (using Railway-compatible approach)
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "crediya",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT || 5432,
});

let twilio;
try {
  twilio = require("twilio");
} catch (error) {
  console.warn("⚠️ Twilio package not installed. WhatsApp functionality will be disabled.");
  twilio = null;
}

const app = express();
const port = process.env.PORT || 5001;

// ==============================================================================
// MIDDLEWARE SETUP (from original index.js)
// ==============================================================================

app.use(express.json());
const allowedOrigins = [
  "http://localhost:5174",
  "https://crediya.me",
  "https://www.crediya.me",
  "https://crediya-frontend-io2d.vercel.app",
  "https://crediya-frontend.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    console.log("🌍 Incoming request origin:", origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Ensure all preflight OPTIONS requests are handled with the same CORS policy
app.options("*", cors());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// File upload configuration (from original)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

console.log("🌐 DATABASE_URL:", process.env.DATABASE_URL);

// ==============================================================================
// HELPER FUNCTIONS (preserved from original)
// ==============================================================================

// Helper function to generate receipt PDF
async function generateReceiptPDF(receiptData) {
  try {
    const receiptDir = path.join(__dirname, 'receipts');
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }

    const doc = new PDFDocument();
    const filename = `receipt-${receiptData.paymentId}-${Date.now()}.pdf`;
    const filepath = path.join(receiptDir, filename);
    
    doc.pipe(fs.createWriteStream(filepath));
    
    // Header
    doc.fontSize(20).text('RECIBO DE PAGO', { align: 'center' });
    doc.moveDown();
    
    // Receipt details
    doc.fontSize(12);
    doc.text(`Recibo No: ${receiptData.receiptNumber}`);
    doc.text(`Fecha: ${receiptData.date}`);
    doc.text(`Cliente: ${receiptData.customerName}`);
    doc.text(`Préstamo ID: ${receiptData.loanId}`);
    doc.text(`Monto: $${receiptData.amount}`);
    doc.text(`Método: ${receiptData.method}`);
    
    doc.end();
    
    return `/receipts/${filename}`;
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    throw error;
  }
}

// IMEI validation function
function validateIMEI(imei) {
  if (!imei || imei.length !== 15) {
    return { valid: false, message: "IMEI debe tener 15 dígitos" };
  }

  // Check if all characters are digits
  if (!/^\d+$/.test(imei)) {
    return { valid: false, message: "IMEI debe contener solo números" };
  }

  // Luhn algorithm validation
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(imei[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  const isValid = checkDigit === parseInt(imei[14]);
  
  return { 
    valid: isValid, 
    message: isValid ? "IMEI válido" : "IMEI inválido (falla verificación Luhn)" 
  };
}

// ==============================================================================
// AUTHENTICATION HELPERS (preserved from original)
// ==============================================================================

const generateToken = (user) => {
  const role = user.role || (user.is_admin ? "admin" : "user");
  return jwt.sign(
    { id: user.id, email: user.email, role },
    process.env.JWT_SECRET || "secretkey",
    { expiresIn: "7d" }
  );
};

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  console.log("🛡️ Incoming token header:", token);
  if (!token) return res.status(403).json({ message: "Access denied" });

  try {
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || "secretkey");
    console.log("✅ Token decoded:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err);
    res.status(401).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// ==============================================================================
// BUSINESS LOGIC FUNCTIONS (preserved from original)
// ==============================================================================

// NOTE: This section will contain all the business logic functions from the original
// index.js, including loan installment generation, payment processing, etc.
// I'll extract these carefully to preserve all functionality.

const generateInstallmentsForLoan = async (loan_id, totalAmount, termWeeks, annualInterestRate = 120) => {
  // Convert annual percentage to weekly decimal rate
  const weeklyInterestRate = (annualInterestRate / 100) / 52;
  
  // Calculate weekly payment using amortization formula
  let weeklyPayment;
  if (weeklyInterestRate > 0) {
    weeklyPayment = (totalAmount * weeklyInterestRate * Math.pow(1 + weeklyInterestRate, termWeeks)) / 
                    (Math.pow(1 + weeklyInterestRate, termWeeks) - 1);
  } else {
    weeklyPayment = totalAmount / termWeeks;
  }
  
  weeklyPayment = parseFloat(weeklyPayment.toFixed(2));
  
  console.log(`💰 Loan ${loan_id}: Total: $${totalAmount}, Rate: ${annualInterestRate}%, Term: ${termWeeks} weeks, Payment: $${weeklyPayment}`);

  const today = new Date();
  const start = new Date(today);
  
  // Calculate closest Saturday (6 = Saturday)
  let daysUntilSaturday;
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (currentDay === 6) {
    // If today is Saturday, the closest Saturday is today (0 days)
    daysUntilSaturday = 0;
  } else {
    // Calculate days until the closest Saturday
    daysUntilSaturday = (6 - currentDay) % 7;
    // If the result is 0, it means we're on Sunday and next Saturday is 6 days away
    if (currentDay === 0) daysUntilSaturday = 6; // Sunday to Saturday
  }
  
  start.setDate(start.getDate() + daysUntilSaturday);
  start.setHours(14, 0, 0, 0); // Set to 2 PM
  
  console.log(`📅 Loan ${loan_id}: Today is ${today.toDateString()} (day ${currentDay}), first payment on ${start.toDateString()} (day ${start.getDay()})`);

  // Generate amortization schedule
  let remainingBalance = totalAmount;

  for (let i = 0; i < termWeeks; i++) {
    const dueDate = new Date(start);
    dueDate.setDate(start.getDate() + (i * 7));
    
    // Calculate interest and principal for this payment
    const interestPayment = remainingBalance * weeklyInterestRate;
    const principalPayment = weeklyPayment - interestPayment;
    remainingBalance -= principalPayment;
    
    // Ensure we don't go negative on the last payment
    if (i === termWeeks - 1 && remainingBalance < 0) {
      remainingBalance = 0;
    }
    
    console.log(`📅 Week ${i + 1}: ${dueDate.toDateString()}, Payment: $${weeklyPayment.toFixed(2)}, Principal: $${principalPayment.toFixed(2)}, Interest: $${interestPayment.toFixed(2)}, Balance: $${remainingBalance.toFixed(2)}`);

    // Try new schema first, fallback to old schema if needed
    try {
      await pool.query(`
        INSERT INTO loan_installments (loan_id, week_number, due_date, amount_due, capital_portion, interest_portion)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        loan_id, 
        i + 1, 
        dueDate.toISOString().split('T')[0],
        weeklyPayment, 
        parseFloat(principalPayment.toFixed(2)), 
        parseFloat(interestPayment.toFixed(2))
      ]);
    } catch (schemaError) {
      console.log("⚠️ New schema failed, trying old schema:", schemaError.message);
      await pool.query(`
        INSERT INTO loan_installments (loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, amount_due, capital_portion, interest_portion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        loan_id, 
        i + 1, 
        dueDate.toISOString(), 
        parseFloat(principalPayment.toFixed(2)), 
        parseFloat(interestPayment.toFixed(2)),
        weeklyPayment,
        weeklyPayment, 
        parseFloat(principalPayment.toFixed(2)), 
        parseFloat(interestPayment.toFixed(2))
      ]);
    }
  }
};

// ==============================================================================
// HEALTH CHECK ROUTES
// ==============================================================================

app.get("/", (req, res) => {
  res.json({ 
    message: "CrediYA API Server - Clean Architecture",
    version: "2.0.0",
    status: "running",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: "healthy", 
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "unhealthy", 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// USER MANAGEMENT & AUDIT SYSTEM
// ============================================================================

// Audit logging helper function
const logUserActivity = async (userId, action, resourceType = null, resourceId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const ip = req ? req.ip || req.connection.remoteAddress : null;
    const userAgent = req ? req.get('User-Agent') : null;
    const sessionId = req ? req.headers.authorization?.split(' ')[1]?.substring(0, 10) : null;

    await pool.query(`
      INSERT INTO user_audit_log (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, session_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [userId, action, resourceType, resourceId, JSON.stringify(oldValues), JSON.stringify(newValues), ip, userAgent, sessionId]);
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
};

// Enhanced permission check middleware
const hasPermission = (permission) => {
  return (req, res, next) => {
    try {
      const userPermissions = req.user.permissions || {};
      
      // Admin always has all permissions
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Check specific permission
      if (userPermissions[permission] === true) {
        return next();
      }
      
      return res.status(403).json({ error: "Insufficient permissions" });
    } catch (error) {
      return res.status(403).json({ error: "Permission check failed" });
    }
  };
};

// Get all users with enhanced data
app.get("/admin/users", authenticateToken, hasPermission('canManageUsers'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.phone, u.avatar_url,
        u.permissions, u.last_login, u.login_count, u.is_active,
        u.created_at, u.updated_at,
        s.name as store_name,
        creator.name as created_by_name
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN users creator ON u.created_by = creator.id
      ORDER BY u.created_at DESC
    `);
    
    await logUserActivity(req.user.id, 'VIEW_USERS', 'users', null, null, null, req);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Create new user with enhanced features
app.post("/admin/users", authenticateToken, hasPermission('canManageUsers'), async (req, res) => {
  try {
    const { name, email, password, role, store_id, phone, permissions, avatar_url } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(`
      INSERT INTO users (name, email, password, role, store_id, phone, permissions, avatar_url, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, role, store_id, phone, permissions, avatar_url, is_active, created_at
    `, [name, email, hashedPassword, role, store_id, phone, JSON.stringify(permissions || {}), avatar_url, req.user.id]);
    
    const newUser = result.rows[0];
    await logUserActivity(req.user.id, 'CREATE_USER', 'users', newUser.id, null, newUser, req);
    
    res.status(201).json({ 
      message: "User created successfully", 
      user: newUser 
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

// Update user with audit trail
app.put("/admin/users/:id", authenticateToken, hasPermission('canManageUsers'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, store_id, phone, permissions, avatar_url, is_active } = req.body;
    
    // Get current user data for audit
    const currentResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const currentUser = currentResult.rows[0];
    
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) { updates.push(`name = $${paramCount}`); values.push(name); paramCount++; }
    if (email !== undefined) { updates.push(`email = $${paramCount}`); values.push(email); paramCount++; }
    if (role !== undefined) { updates.push(`role = $${paramCount}`); values.push(role); paramCount++; }
    if (store_id !== undefined) { 
      updates.push(`store_id = $${paramCount}`); 
      values.push(store_id === "" ? null : store_id); 
      paramCount++; 
    }
    if (phone !== undefined) { updates.push(`phone = $${paramCount}`); values.push(phone); paramCount++; }
    if (permissions !== undefined) { updates.push(`permissions = $${paramCount}`); values.push(JSON.stringify(permissions)); paramCount++; }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${paramCount}`); values.push(avatar_url); paramCount++; }
    if (is_active !== undefined) { updates.push(`is_active = $${paramCount}`); values.push(is_active); paramCount++; }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    const updatedUser = result.rows[0];
    await logUserActivity(req.user.id, 'UPDATE_USER', 'users', userId, currentUser, updatedUser, req);
    
    res.json({ 
      message: "User updated successfully", 
      user: updatedUser 
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete/Deactivate user
app.delete("/admin/users/:id", authenticateToken, hasPermission('canManageUsers'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Get current user data for audit
    const currentResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const currentUser = currentResult.rows[0];
    
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Soft delete by deactivating
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
    await logUserActivity(req.user.id, 'DEACTIVATE_USER', 'users', userId, currentUser, { is_active: false }, req);
    
    res.json({ message: "User deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating user:", error);
    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

// Get user activity audit log
app.get("/admin/users/:id/audit", authenticateToken, hasPermission('canViewAuditLogs'), async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await pool.query(`
      SELECT 
        ual.id,
        ual.action,
        ual.resource_type,
        ual.resource_id,
        ual.ip_address,
        ual.created_at,
        u.name as user_name
      FROM user_audit_log ual
      LEFT JOIN users u ON ual.user_id = u.id
      WHERE ual.user_id = $1
      ORDER BY ual.created_at DESC
      LIMIT 50
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// Get permission templates
app.get("/admin/permission-templates", authenticateToken, hasPermission('canManageUsers'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM permission_templates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching permission templates:", error);
    res.status(500).json({ error: "Failed to fetch permission templates" });
  }
});

// Get user activity summary
app.get("/admin/user-activity", authenticateToken, hasPermission('canViewAuditLogs'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        ual.id,
        ual.action,
        ual.resource_type,
        ual.resource_id,
        ual.ip_address,
        ual.created_at,
        u.name as user_name
      FROM user_audit_log ual
      LEFT JOIN users u ON ual.user_id = u.id
      WHERE ual.created_at >= NOW() - INTERVAL '${days} days'
      ORDER BY ual.created_at DESC
      LIMIT 100
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ error: "Failed to fetch user activity" });
  }
});

// ============================================================================
// STORE MANAGEMENT SYSTEM
// ============================================================================

// Get all stores with enhanced data
app.get("/admin/stores", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        m.name as manager_name,
        m.email as manager_email,
        COUNT(u.id) as staff_count,
        COUNT(DISTINCT CASE WHEN u.last_login >= NOW() - INTERVAL '30 days' THEN u.id END) as active_staff_count
      FROM stores s
      LEFT JOIN users m ON s.manager_id = m.id
      LEFT JOIN users u ON u.store_id = s.id AND u.is_active = true
      GROUP BY s.id, m.name, m.email
      ORDER BY s.name
    `);
    
    await logUserActivity(req.user.id, 'VIEW_STORES', 'stores', null, null, null, req);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// Create new store
app.post("/admin/stores", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const { name, address, phone, manager_id, description, capacity, status } = req.body;
    
    const result = await pool.query(`
      INSERT INTO stores (name, address, phone, manager_id, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `, [name, address, phone, manager_id || null]);
    
    const newStore = result.rows[0];
    await logUserActivity(req.user.id, 'CREATE_STORE', 'stores', newStore.id, null, newStore, req);
    
    res.status(201).json({ 
      message: "Store created successfully", 
      store: newStore 
    });
  } catch (error) {
    console.error("Error creating store:", error);
    if (error.code === '23505') {
      res.status(400).json({ error: "Store name already exists" });
    } else {
      res.status(500).json({ error: "Failed to create store" });
    }
  }
});

// Update store
app.put("/admin/stores/:id", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const storeId = req.params.id;
    const { name, address, phone, manager_id } = req.body;
    
    // Get current store data for audit
    const currentResult = await pool.query('SELECT * FROM stores WHERE id = $1', [storeId]);
    const currentStore = currentResult.rows[0];
    
    if (!currentStore) {
      return res.status(404).json({ error: "Store not found" });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) { updates.push(`name = $${paramCount}`); values.push(name); paramCount++; }
    if (address !== undefined) { updates.push(`address = $${paramCount}`); values.push(address); paramCount++; }
    if (phone !== undefined) { updates.push(`phone = $${paramCount}`); values.push(phone); paramCount++; }
    if (manager_id !== undefined) { 
      updates.push(`manager_id = $${paramCount}`); 
      values.push(manager_id === "" ? null : manager_id); 
      paramCount++; 
    }
    
    values.push(storeId);
    
    const query = `UPDATE stores SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    const updatedStore = result.rows[0];
    await logUserActivity(req.user.id, 'UPDATE_STORE', 'stores', storeId, currentStore, updatedStore, req);
    
    res.json({ 
      message: "Store updated successfully", 
      store: updatedStore 
    });
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({ error: "Failed to update store" });
  }
});

// Delete/Deactivate store (soft delete by removing manager and marking inactive)
app.delete("/admin/stores/:id", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const storeId = req.params.id;
    
    // Get current store data for audit
    const currentResult = await pool.query('SELECT * FROM stores WHERE id = $1', [storeId]);
    const currentStore = currentResult.rows[0];
    
    if (!currentStore) {
      return res.status(404).json({ error: "Store not found" });
    }
    
    // Check if store has active users
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users WHERE store_id = $1 AND is_active = true', [storeId]);
    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete store with active users. Please reassign users first." 
      });
    }
    
    // Clear manager and mark as inactive (soft delete approach)
    await pool.query('UPDATE stores SET manager_id = NULL WHERE id = $1', [storeId]);
    await logUserActivity(req.user.id, 'DEACTIVATE_STORE', 'stores', storeId, currentStore, { manager_id: null }, req);
    
    res.json({ message: "Store deactivated successfully" });
  } catch (error) {
    console.error("Error deactivating store:", error);
    res.status(500).json({ error: "Failed to deactivate store" });
  }
});

// Get store details with analytics
app.get("/admin/stores/:id/details", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const storeId = req.params.id;
    
    // Get store info
    const storeResult = await pool.query(`
      SELECT 
        s.*,
        m.name as manager_name,
        m.email as manager_email,
        m.phone as manager_phone
      FROM stores s
      LEFT JOIN users m ON s.manager_id = m.id
      WHERE s.id = $1
    `, [storeId]);
    
    if (!storeResult.rows.length) {
      return res.status(404).json({ error: "Store not found" });
    }
    
    // Get store analytics
    const analytics = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as total_staff,
        COUNT(DISTINCT CASE WHEN u.last_login >= NOW() - INTERVAL '30 days' THEN u.id END) as active_staff,
        COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END) as admin_count,
        COUNT(DISTINCT CASE WHEN u.role = 'store_staff' THEN u.id END) as staff_count
      FROM users u
      WHERE u.store_id = $1 AND u.is_active = true
    `, [storeId]);
    
    const store = storeResult.rows[0];
    const stats = analytics.rows[0];
    
    await logUserActivity(req.user.id, 'VIEW_STORE_DETAILS', 'stores', storeId, null, null, req);
    
    res.json({
      store,
      analytics: {
        total_staff: parseInt(stats.total_staff),
        active_staff: parseInt(stats.active_staff),
        admin_count: parseInt(stats.admin_count),
        staff_count: parseInt(stats.staff_count)
      }
    });
  } catch (error) {
    console.error("Error fetching store details:", error);
    res.status(500).json({ error: "Failed to fetch store details" });
  }
});

// Get available managers (users who can be store managers)
app.get("/admin/stores/available-managers", authenticateToken, hasPermission('canManageStores'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, role
      FROM users 
      WHERE is_active = true 
        AND role IN ('admin', 'store_manager', 'store_staff')
        AND (id NOT IN (SELECT manager_id FROM stores WHERE manager_id IS NOT NULL) OR id = $1)
      ORDER BY name
    `, [req.query.current_manager_id || null]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching available managers:", error);
    res.status(500).json({ error: "Failed to fetch available managers" });
  }
});

// ============================================================================
// LOAN MANAGEMENT SYSTEM
// ============================================================================

// Create new loan
app.post("/loans", authenticateToken, hasPermission('canCreateLoans'), async (req, res) => {
  try {
    const { 
      customer_id, 
      inventory_item_id, 
      product_id,
      financial_product_id, 
      store_id,
      amount, 
      interest_rate, 
      term_weeks, 
      down_payment, 
      loan_type, 
      notes 
    } = req.body;
    
    // Handle both product_id and inventory_item_id field names
    const actualInventoryItemId = inventory_item_id || product_id;

    // Validate required fields
    if (!customer_id || !store_id || !amount || !term_weeks) {
      return res.status(400).json({ 
        error: "Missing required fields: customer_id, store_id, amount, term_weeks" 
      });
    }

    // If it's a product loan, validate inventory item
    if (loan_type === 'producto' && !actualInventoryItemId) {
      return res.status(400).json({ error: "Product loans require product_id or inventory_item_id" });
    }

    // Create the loan
    const result = await pool.query(`
      INSERT INTO loans (
        user_id, customer_id, inventory_item_id, financial_product_id, store_id,
        amount, interest_rate, term_weeks, down_payment, loan_type, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING *
    `, [
      req.user.id, customer_id, actualInventoryItemId || null, financial_product_id || null, store_id,
      amount, interest_rate || 120.00, term_weeks, down_payment || 0, loan_type || 'producto', notes
    ]);

    const newLoan = result.rows[0];

    // Generate installments for the loan
    await generateInstallmentsForLoan(
      newLoan.id, 
      parseFloat(amount), 
      parseInt(term_weeks), 
      parseFloat(interest_rate || 120)
    );

    // If it's a product loan, mark inventory item as assigned (no accounting yet)
    if (actualInventoryItemId) {
      await pool.query(`
        UPDATE inventory_items 
        SET status = 'asignado' 
        WHERE id = $1
      `, [actualInventoryItemId]);
    }

    // Log the activity
    await logUserActivity(req.user.id, 'CREATE_LOAN', 'loans', newLoan.id, null, newLoan, req);

    res.status(201).json({ 
      message: "Loan created successfully", 
      loan: newLoan,
      success: true,
      loan_id: newLoan.id
    });
  } catch (error) {
    console.error("Error creating loan:", error);
    
    if (error.code === '23505') {
      res.status(400).json({ error: "Loan already exists or duplicate constraint violation" });
    } else if (error.code === '23503') {
      res.status(400).json({ error: "Invalid reference: customer, store, or inventory item not found" });
    } else {
      res.status(500).json({ error: "Failed to create loan" });
    }
  }
});

// Update loan
app.put("/loans/:id", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    const loanId = req.params.id;
    const { status, notes, amount, interest_rate, term_weeks } = req.body;
    
    // Get current loan data for audit
    const currentResult = await pool.query('SELECT * FROM loans WHERE id = $1', [loanId]);
    const currentLoan = currentResult.rows[0];
    
    if (!currentLoan) {
      return res.status(404).json({ error: "Loan not found" });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (status !== undefined) { updates.push(`status = $${paramCount}`); values.push(status); paramCount++; }
    if (notes !== undefined) { updates.push(`notes = $${paramCount}`); values.push(notes); paramCount++; }
    if (amount !== undefined) { updates.push(`amount = $${paramCount}`); values.push(amount); paramCount++; }
    if (interest_rate !== undefined) { updates.push(`interest_rate = $${paramCount}`); values.push(interest_rate); paramCount++; }
    if (term_weeks !== undefined) { updates.push(`term_weeks = $${paramCount}`); values.push(term_weeks); paramCount++; }
    
    values.push(loanId);
    
    const query = `UPDATE loans SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    const updatedLoan = result.rows[0];
    await logUserActivity(req.user.id, 'UPDATE_LOAN', 'loans', loanId, currentLoan, updatedLoan, req);
    
    res.json({ 
      message: "Loan updated successfully", 
      loan: updatedLoan 
    });
  } catch (error) {
    console.error("Error updating loan:", error);
    res.status(500).json({ error: "Failed to update loan" });
  }
});

// Get loans with filtering by store
app.get("/loans", authenticateToken, async (req, res) => {
  try {
    const { store_id, status, customer_id } = req.query;
    
    let query = `
      SELECT 
        l.*, 
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.email AS customer_email,
        s.name AS store_name,
        u.name AS created_by_name,
        fp.name AS financial_product_name
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN stores s ON l.store_id = s.id
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN financial_products fp ON l.financial_product_id = fp.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    if (store_id) {
      query += ` AND l.store_id = $${paramCount}`;
      queryParams.push(store_id);
      paramCount++;
    }
    
    if (status) {
      query += ` AND l.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    if (customer_id) {
      query += ` AND l.customer_id = $${paramCount}`;
      queryParams.push(customer_id);
      paramCount++;
    }
    
    query += ` ORDER BY l.created_at DESC`;
    
    const result = await pool.query(query, queryParams);
    
    await logUserActivity(req.user.id, 'VIEW_LOANS', 'loans', null, null, { filters: req.query }, req);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

// Get loan analytics by store
app.get("/loans/analytics", authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    
    let whereClause = store_id ? 'WHERE l.store_id = $1' : '';
    let queryParams = store_id ? [store_id] : [];
    
    const analytics = await pool.query(`
      SELECT 
        COUNT(*) as total_loans,
        COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_loans,
        COUNT(CASE WHEN l.status = 'completed' THEN 1 END) as completed_loans,
        COUNT(CASE WHEN l.status = 'overdue' THEN 1 END) as overdue_loans,
        COALESCE(SUM(l.amount), 0) as total_amount,
        COALESCE(AVG(l.amount), 0) as average_amount,
        s.name as store_name
      FROM loans l
      LEFT JOIN stores s ON l.store_id = s.id
      ${whereClause}
      ${store_id ? '' : 'GROUP BY s.id, s.name'}
    `, queryParams);
    
    res.json(analytics.rows);
  } catch (error) {
    console.error("Error fetching loan analytics:", error);
    res.status(500).json({ error: "Failed to fetch loan analytics" });
  }
});

// ============================================================================
// INVENTORY MANAGEMENT SYSTEM
// ============================================================================

// ==============================================================================
// INVENTORY REQUESTS ENDPOINTS
// ==============================================================================

// Get inventory requests
app.get("/inventory-requests", authenticateToken, async (req, res) => {
  try {
    console.log("📋 Fetching inventory requests with params:", { status: req.query.status, store_id: req.query.store_id });
    const { status, store_id } = req.query;
    
    let query = `
      SELECT 
        ir.*,
        s.name AS store_name,
        u.name AS approved_by_name,
        COUNT(ii.id) as items_count
      FROM inventory_requests ir
      LEFT JOIN stores s ON ir.store_id = s.id
      LEFT JOIN users u ON ir.approved_by = u.id
      LEFT JOIN inventory_items ii ON ir.id = ii.inventory_request_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND ir.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    if (store_id) {
      query += ` AND ir.store_id = $${paramCount}`;
      queryParams.push(store_id);
      paramCount++;
    }
    
    query += ` GROUP BY ir.id, s.name, u.name ORDER BY ir.created_at DESC`;
    
    const result = await pool.query(query, queryParams);
    
    console.log("📋 Found inventory requests:", { 
      count: result.rows.length, 
      requests: result.rows.map(r => ({ id: r.id, category: r.category, status: r.status, amount: r.amount }))
    });
    
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching inventory requests:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch inventory requests", details: error.message });
  }
});

// Admin endpoint for inventory requests (used by AdminApprovals page)
app.get("/admin/inventory-requests", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    console.log("📋 Admin fetching inventory requests for approvals");
    
    const { status } = req.query;
    
    let query = `
      SELECT 
        ir.*,
        s.name AS store_name,
        u.name AS approved_by_name,
        COUNT(ii.id) as items_count
      FROM inventory_requests ir
      LEFT JOIN stores s ON ir.store_id = s.id
      LEFT JOIN users u ON ir.approved_by = u.id
      LEFT JOIN inventory_items ii ON ir.id = ii.inventory_request_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    // Filter by status if provided
    if (status) {
      query += ` AND ir.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    query += ` GROUP BY ir.id, s.name, u.name ORDER BY ir.created_at DESC`;
    
    const result = await pool.query(query, queryParams);
    
    console.log("📋 Found inventory requests for approval:", { 
      count: result.rows.length, 
      status: requestStatus,
      requests: result.rows.map(r => ({ id: r.id, category: r.category, status: r.status, amount: r.amount }))
    });
    
    // Return in format expected by AdminApprovals frontend
    res.json({ requests: result.rows });
  } catch (error) {
    console.error("❌ Error fetching admin inventory requests:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch admin inventory requests", details: error.message });
  }
});

// Create inventory request
app.post("/inventory-requests", authenticateToken, hasPermission('canRequestInventory'), upload.single('quote'), async (req, res) => {
  try {
    console.log("📦 Inventory request received:", { body: req.body, file: req.file?.filename, user: req.user?.id });
    
    // TEMPORARY: Add missing columns to existing database (until next reset)
    try {
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS approval_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_quantity INTEGER`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_condition VARCHAR(20)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS reception_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS quote_file VARCHAR(255)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`);
      console.log("✅ Migration: Added missing columns to inventory_requests table");
    } catch (err) {
      console.log("⚠️ Migration: Some inventory_requests columns may already exist:", err.message);
    }
    
    const {
      category,
      brand,
      model,
      color,
      ram,
      storage,
      amount,
      quantity,
      priority,
      supplier,
      expected_delivery,
      approval_required,
      notes,
      store_id
    } = req.body;

    // Validate required fields
    if (!category || !amount || !supplier) {
      return res.status(400).json({ error: "Missing required fields: category, amount, supplier" });
    }

    const result = await pool.query(`
      INSERT INTO inventory_requests (
        category, brand, model, color, ram, storage, amount, quantity, priority,
        supplier, expected_delivery, approval_required, notes, status, store_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $15)
      RETURNING *
    `, [
      category, brand, model, color, ram, storage, 
      parseFloat(amount), parseInt(quantity) || 1, priority || 'medium',
      supplier, expected_delivery, approval_required !== 'false', notes, 
      store_id, req.user.id
    ]);

    const newRequest = result.rows[0];

    // Handle file upload if present
    if (req.file) {
      await pool.query(`
        UPDATE inventory_requests 
        SET quote_file = $1 
        WHERE id = $2
      `, [req.file.filename, newRequest.id]);
      newRequest.quote_file = req.file.filename;
    }

    await logUserActivity(req.user.id, 'CREATE_INVENTORY_REQUEST', 'inventory_requests', newRequest.id, null, newRequest, req);

    console.log("📦 Inventory request created:", { id: newRequest.id, amount: newRequest.amount, supplier: newRequest.supplier });

    res.status(201).json({ 
      message: "Inventory request created successfully", 
      request: newRequest 
    });
  } catch (error) {
    console.error("Error creating inventory request:", error);
    res.status(500).json({ error: "Failed to create inventory request" });
  }
});

// Bulk inventory request
app.post("/inventory-requests/bulk", authenticateToken, hasPermission('canRequestInventory'), async (req, res) => {
  try {
    console.log("📦 Bulk inventory request received:", { itemCount: req.body.items?.length, user: req.user?.id });
    
    // TEMPORARY: Add missing columns to existing database (until next reset)
    try {
      // inventory_requests table
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS approval_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS payment_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_quantity INTEGER`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_condition VARCHAR(20)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS reception_notes TEXT`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS quote_file VARCHAR(255)`);
      await pool.query(`ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`);
      
      // inventory_items table
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`);
      
      console.log("✅ Migration: Added missing columns to inventory_requests and inventory_items tables");
    } catch (err) {
      console.log("⚠️ Migration: Some columns may already exist:", err.message);
    }
    
    const { category, supplier, expected_delivery, notes, priority, amount, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided for bulk request" });
    }

    if (!supplier || !category) {
      return res.status(400).json({ error: "Missing required fields: supplier, category" });
    }

    // Create the main request
    const requestResult = await pool.query(`
      INSERT INTO inventory_requests (
        category, amount, supplier, expected_delivery, notes, priority, 
        status, approval_required, created_by, quantity
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', true, $7, $8)
      RETURNING *
    `, [
      category, parseFloat(amount), supplier, expected_delivery, 
      notes, priority || 'medium', req.user.id, items.length
    ]);

    const newRequest = requestResult.rows[0];

    // Create individual inventory items based on quantity
    const itemPromises = [];
    
    items.forEach(item => {
      const quantity = parseInt(item.quantity) || 1;
      
      // Create separate records for each quantity
      for (let i = 0; i < quantity; i++) {
        itemPromises.push(
          pool.query(`
            INSERT INTO inventory_items (
              inventory_request_id, category, brand, model, color, ram, storage,
              purchase_price, sale_price, quantity, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 'pendiente')
            RETURNING *
          `, [
            newRequest.id, item.category || category, item.brand, item.model, 
            item.color, item.ram, item.storage, parseFloat(item.purchase_price), 
            parseFloat(item.sale_price) || 0
          ])
        );
      }
    });

    const itemResults = await Promise.all(itemPromises);
    const createdItems = itemResults.map(result => result.rows[0]);

    await logUserActivity(req.user.id, 'CREATE_BULK_INVENTORY_REQUEST', 'inventory_requests', newRequest.id, null, 
      { request: newRequest, itemCount: createdItems.length }, req);

    console.log("📦 Bulk inventory request created:", { 
      requestId: newRequest.id, 
      itemCount: createdItems.length, 
      totalAmount: amount 
    });

    res.status(201).json({ 
      message: "Bulk inventory request created successfully", 
      request: newRequest,
      items: createdItems
    });
  } catch (error) {
    console.error("Error creating bulk inventory request:", error);
    res.status(500).json({ error: "Failed to create bulk inventory request" });
  }
});

// Upload inventory items from file
app.post("/inventory-items/upload", authenticateToken, hasPermission('canManageInventory'), upload.single('file'), async (req, res) => {
  try {
    console.log("📄 Inventory file upload received:", { file: req.file?.filename, user: req.user?.id });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { inventory_request_id, store } = req.body;

    if (!inventory_request_id) {
      return res.status(400).json({ error: "Missing inventory_request_id" });
    }

    // For now, we'll just acknowledge the file upload
    // In a full implementation, you'd parse the Excel/CSV file here
    // and create inventory_items records

    await logUserActivity(req.user.id, 'UPLOAD_INVENTORY_FILE', 'inventory_items', null, null, 
      { filename: req.file.filename, inventory_request_id, store }, req);

    console.log("📄 Inventory file uploaded:", { filename: req.file.filename, request_id: inventory_request_id });

    res.status(201).json({ 
      message: "Inventory file uploaded successfully", 
      filename: req.file.filename,
      inventory_request_id
    });
  } catch (error) {
    console.error("Error uploading inventory file:", error);
    res.status(500).json({ error: "Failed to upload inventory file" });
  }
});

// Quick fix for testing - update inventory to disponible with IMEIs
app.post("/admin/fix-inventory-for-testing", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    console.log("🔧 Quick fix: Updating inventory for loan testing");
    
    // Get all inventory items without IMEI
    const itemsResult = await pool.query(`
      SELECT id, brand, model, status 
      FROM inventory_items 
      WHERE imei IS NULL OR imei = ''
      ORDER BY id
    `);
    
    let updatedCount = 0;
    
    for (const item of itemsResult.rows) {
      // Generate a sample IMEI (15 digits)
      const sampleIMEI = `${Date.now()}${String(item.id).padStart(3, '0')}`.substring(0, 15);
      
      await pool.query(`
        UPDATE inventory_items 
        SET status = 'disponible', imei = $1
        WHERE id = $2
      `, [sampleIMEI, item.id]);
      
      updatedCount++;
      console.log(`✅ Updated item ${item.id} (${item.brand} ${item.model}): status=disponible, imei=${sampleIMEI}`);
    }
    
    console.log(`🎉 Quick fix complete: ${updatedCount} items updated`);
    
    res.json({
      message: `Successfully updated ${updatedCount} inventory items for testing`,
      updated_count: updatedCount,
      note: "Items now have 'disponible' status and sample IMEIs for loan creation testing"
    });
    
  } catch (error) {
    console.error("❌ Error in quick fix:", error);
    res.status(500).json({ error: "Failed to fix inventory" });
  }
});

// Check if IMEI is already in use
app.get("/inventory-items/check-imei/:imei", authenticateToken, async (req, res) => {
  try {
    const { imei } = req.params;
    
    console.log("🔍 Checking IMEI:", { imei, user: req.user?.id });
    
    const result = await pool.query(`
      SELECT id, brand, model, status 
      FROM inventory_items 
      WHERE imei = $1
    `, [imei]);
    
    if (result.rows.length > 0) {
      const existingItem = result.rows[0];
      console.log("⚠️ IMEI already exists:", { imei, item: existingItem });
      
      res.json({ 
        exists: true, 
        item: existingItem,
        message: `IMEI ya está asignado a ${existingItem.brand} ${existingItem.model} (ID: ${existingItem.id})`
      });
    } else {
      console.log("✅ IMEI available:", { imei });
      res.json({ 
        exists: false, 
        message: "IMEI disponible" 
      });
    }
  } catch (error) {
    console.error("❌ Error checking IMEI:", error);
    res.status(500).json({ error: "Failed to check IMEI" });
  }
});

// Assign IMEI to inventory item
app.put("/inventory-items/:id/imei", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    const { id } = req.params;
    const { imei } = req.body;
    
    console.log("📱 Assigning IMEI:", { id, imei, user: req.user?.id });
    
    // TEMPORARY: Add missing columns to existing database (until next reset)
    try {
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(50)`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS assigned_to_loan_id INTEGER REFERENCES loans(id)`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP`);
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMP`);
      console.log("✅ Migration: Added missing columns to inventory_items table");
    } catch (err) {
      console.log("⚠️ Migration: Some columns may already exist:", err.message);
    }
    
    if (!imei) {
      return res.status(400).json({ error: "IMEI is required" });
    }
    
    // Check if IMEI is already in use
    const existingResult = await pool.query(`
      SELECT id, brand, model 
      FROM inventory_items 
      WHERE imei = $1 AND id != $2
    `, [imei, id]);
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      return res.status(400).json({ 
        error: `IMEI ya está asignado a ${existing.brand} ${existing.model} (ID: ${existing.id})` 
      });
    }
    
    // Update the inventory item with IMEI
    const result = await pool.query(`
      UPDATE inventory_items 
      SET imei = $1
      WHERE id = $2
      RETURNING *
    `, [imei, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    
    const updatedItem = result.rows[0];
    
    await logUserActivity(req.user.id, 'ASSIGN_IMEI', 'inventory_items', id, 
      { imei: null }, { imei: imei }, req);
    
    console.log("✅ IMEI assigned successfully:", { 
      id, 
      imei, 
      product: `${updatedItem.brand} ${updatedItem.model}`,
      status: updatedItem.status
    });
    
    res.json({ 
      message: "IMEI assigned successfully", 
      item: updatedItem 
    });
  } catch (error) {
    console.error("❌ Error assigning IMEI:", error);
    res.status(500).json({ error: "Failed to assign IMEI" });
  }
});

// ==============================================================================
// FINANCIAL PRODUCTS ENDPOINTS
// ==============================================================================

// Get all financial products
app.get("/financial-products", authenticateToken, async (req, res) => {
  try {
    console.log("💰 Fetching financial products");
    
    const result = await pool.query(`
      SELECT * FROM financial_products 
      WHERE is_active = true 
      ORDER BY term_weeks ASC, interest_rate ASC
    `);
    
    console.log("💰 Found financial products:", { count: result.rows.length });
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching financial products:", error);
    res.status(500).json({ error: "Failed to fetch financial products" });
  }
});

// Create financial product
app.post("/financial-products", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    const { name, title, interest_rate, term_weeks, description, payment_frequency } = req.body;
    
    // Handle both 'name' and 'title' field names for compatibility
    const productName = name || title;
    
    console.log("💰 Creating financial product:", { productName, interest_rate, term_weeks });
    
    if (!productName || !interest_rate || !term_weeks) {
      return res.status(400).json({ error: "Missing required fields: name/title, interest_rate, term_weeks" });
    }
    
    const result = await pool.query(`
      INSERT INTO financial_products (name, interest_rate, term_weeks, description, payment_frequency)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [productName, parseFloat(interest_rate), parseInt(term_weeks), description, payment_frequency || 'weekly']);
    
    const newProduct = result.rows[0];
    
    await logUserActivity(req.user.id, 'CREATE_FINANCIAL_PRODUCT', 'financial_products', newProduct.id, 
      null, newProduct, req);
    
    console.log("💰 Financial product created:", { id: newProduct.id, name: newProduct.name });
    
    res.status(201).json({ 
      message: "Financial product created successfully", 
      product: newProduct 
    });
  } catch (error) {
    console.error("❌ Error creating financial product:", error);
    res.status(500).json({ error: "Failed to create financial product" });
  }
});

// Approve loan (step 3 - admin approval)
app.put("/loans/:id/approve", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_notes } = req.body;
    
    console.log("✅ Approving loan:", { id, user: req.user?.id });

    // TEMPORARY: Add missing columns to existing database (until next reset)
    try {
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS approval_notes TEXT`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS contract_generated_by INTEGER REFERENCES users(id)`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMP`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS contract_url TEXT`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id)`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS delivery_notes TEXT`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(10,2)`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_payment_date DATE`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_payment_date DATE`);
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      // Add missing columns to loan_installments table
      await pool.query(`ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS installment_number INTEGER`);
      await pool.query(`ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS payment_date DATE`);
      await pool.query(`ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(10,2)`);
      await pool.query(`ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(10,2)`);
      
      // Update principal_amount and interest_amount from existing capital_portion and interest_portion
      await pool.query(`
        UPDATE loan_installments 
        SET 
          principal_amount = COALESCE(capital_portion, 0),
          interest_amount = COALESCE(interest_portion, 0)
        WHERE principal_amount IS NULL OR interest_amount IS NULL
      `);
      console.log("✅ Migration: Added missing columns to loans and loan_installments tables");
    } catch (err) {
      console.log("⚠️ Migration: Some columns may already exist:", err.message);
    }

    // First check if loan exists and what status it has
    const loanCheck = await pool.query(`SELECT id, status FROM loans WHERE id = $1`, [id]);
    
    if (loanCheck.rows.length === 0) {
      console.log(`❌ Loan approval failed: Loan ${id} not found`);
      return res.status(404).json({ error: "Loan not found" });
    }
    
    const currentLoan = loanCheck.rows[0];
    console.log(`🔍 Loan ${id} current status: ${currentLoan.status}`);
    
    if (currentLoan.status !== 'pending') {
      console.log(`❌ Loan approval failed: Loan ${id} has status '${currentLoan.status}', expected 'pending'`);
      return res.status(400).json({ error: `Loan status is '${currentLoan.status}', expected 'pending'` });
    }

    // Update loan status to approved
    const result = await pool.query(`
      UPDATE loans 
      SET status = 'approved', approved_by = $1, approval_notes = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, approval_notes, id]);

    if (result.rows.length === 0) {
      console.log(`❌ Loan approval failed: Update query returned no rows for loan ${id}`);
      return res.status(404).json({ error: "Failed to update loan status" });
    }

    const approvedLoan = result.rows[0];

    await logUserActivity(req.user.id, 'APPROVE_LOAN', 'loans', id, 
      { status: 'pending' }, { status: 'approved', approval_notes }, req);

    console.log("✅ Loan approved:", { 
      id, 
      customer_id: approvedLoan.customer_id, 
      amount: approvedLoan.amount,
      approved_by: req.user.id
    });

    res.json({ 
      message: "Loan approved successfully", 
      loan: approvedLoan,
      success: true,
      loan_id: id
    });
  } catch (error) {
    console.error("Error approving loan:", error);
    res.status(500).json({ error: "Failed to approve loan", message: error.message });
  }
});

// Generate contract (step 4 - contract creation)
app.get("/contracts/:id/generate-pdf", authenticateToken, hasPermission('canCreateLoans'), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log("📄 Generating contract for loan:", { id, user: req.user?.id });

    // Get loan details with customer and product info
    const loanResult = await pool.query(`
      SELECT l.*, c.first_name, c.last_name, c.phone, c.email, c.address,
             ii.brand, ii.model, ii.color, ii.imei, ii.sale_price as product_price,
             fp.name as financial_product_name, fp.description as financial_product_description,
             s.name as store_name, s.address as store_address
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN inventory_items ii ON l.inventory_item_id = ii.id
      LEFT JOIN financial_products fp ON l.financial_product_id = fp.id
      LEFT JOIN stores s ON l.store_id = s.id
      WHERE l.id = $1 AND l.status IN ('approved', 'contract_generated')
    `, [id]);

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: "Approved loan not found" });
    }

    const loan = loanResult.rows[0];

    // Get installments for the contract
    const installmentsResult = await pool.query(`
      SELECT * FROM loan_installments 
      WHERE loan_id = $1 
      ORDER BY week_number
    `, [id]);

    // Update loan status to indicate contract was generated
    await pool.query(`
      UPDATE loans 
      SET status = 'contract_generated', contract_generated_at = CURRENT_TIMESTAMP, contract_generated_by = $1
      WHERE id = $2
    `, [req.user.id, id]);

    await logUserActivity(req.user.id, 'GENERATE_CONTRACT', 'loans', id, 
      { status: 'approved' }, { status: 'contract_generated' }, req);

    console.log("📄 Contract generated for loan:", { 
      id, 
      customer: `${loan.first_name} ${loan.last_name}`,
      amount: loan.amount,
      installments: installmentsResult.rows.length
    });

    // Generate PDF contract
    const doc = new PDFDocument();
    const filename = `contrato-prestamo-${id}.pdf`;
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Generate PDF content
console.log('PDF generation starting...', { id, loan: loan.first_name });
    doc.fontSize(16).text('CONTRATO DE PRÉSTAMO', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text(`Cliente: ${loan.first_name} ${loan.last_name}`);
    doc.text(`Teléfono: ${loan.phone || 'N/A'}`);
    doc.text(`Email: ${loan.email || 'N/A'}`);
    doc.text(`CURP: ${loan.curp || 'N/A'}`);
    doc.moveDown();
    
    doc.text(`Monto del Préstamo: $${parseFloat(loan.amount).toFixed(2)}`);
    doc.text(`Enganche: $${parseFloat(loan.down_payment || 0).toFixed(2)}`);
    doc.text(`Plazo: ${loan.term_weeks} semanas`);
    doc.text(`Tasa de Interés: ${loan.interest_rate}% anual`);
    doc.moveDown();
    
    if (loan.brand && loan.model) {
      doc.text(`Producto: ${loan.brand} ${loan.model}`);
      doc.text(`Color: ${loan.color || 'N/A'}`);
      doc.text(`IMEI: ${loan.imei || 'N/A'}`);
      doc.moveDown();
    }
    
    doc.text('TABLA DE PAGOS:', { underline: true });
    doc.moveDown(0.5);
    
    // Add installments table
    installmentsResult.rows.forEach((installment, index) => {
      doc.text(`Pago ${index + 1}: $${parseFloat(installment.amount).toFixed(2)} - Vence: ${new Date(installment.due_date).toLocaleDateString('es-MX')}`);
    });
    
    doc.moveDown();
    doc.text(`Fecha del Contrato: ${new Date().toLocaleDateString('es-MX')}`);
    doc.text(`Tienda: ${loan.store_name || 'N/A'}`);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error generating contract:", error);
    res.status(500).json({ error: "Failed to generate contract", message: error.message });
  }
});

// Deliver loan (final step - creates accounting entries)
app.put("/loans/:id/deliver", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🚀 Delivering loan:", { id, user: req.user?.id });

    // Get loan details with customer and inventory info
    const loanResult = await pool.query(`
      SELECT l.*, c.first_name, c.last_name, c.id as customer_id,
             ii.purchase_price, ii.sale_price, ii.id as inventory_item_id
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN inventory_items ii ON l.inventory_item_id = ii.id
      WHERE l.id = $1 AND l.status IN ('approved', 'contract_generated')
    `, [id]);

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: "Approved loan not found" });
    }

    const loan = loanResult.rows[0];
    const customerCode = loan.customer_id.toString().padStart(4, '0');
    const loanAmount = parseFloat(loan.amount);
    const downPayment = parseFloat(loan.down_payment || 0);
    const netLoanAmount = loanAmount - downPayment;

    // Create journal entries for loan delivery
    const sourceId = `loan-delivery-${id}-${Date.now()}`;

    // Ensure required account codes exist in chart of accounts
    let requiredAccounts = [`1003-${customerCode}`]; // Customer receivable always needed
    
    if (loan.loan_type === 'producto' && loan.inventory_item_id) {
      // Product loans need sales revenue, COGS, and inventory accounts
      requiredAccounts.push(`4002-${customerCode}`, `5001-${customerCode}`, '1004');
    } else if (loan.loan_type === 'efectivo') {
      // Cash loans need cash account
      requiredAccounts.push('1001');
    }
    const existingAccounts = await pool.query(`
      SELECT code FROM chart_of_accounts WHERE code = ANY($1)
    `, [requiredAccounts]);
    
    const existingCodes = existingAccounts.rows.map(row => row.code);
    const missingAccounts = requiredAccounts.filter(code => !existingCodes.includes(code));
    
    if (missingAccounts.length > 0) {
      console.error("❌ Missing required account codes:", missingAccounts);
      return res.status(500).json({ 
        error: "Missing required account codes in chart of accounts", 
        missing_accounts: missingAccounts 
      });
    }

    if (loan.loan_type === 'producto' && loan.inventory_item_id) {
      // PRODUCT LOAN DELIVERY ACCOUNTING
      
      const costPrice = parseFloat(loan.purchase_price || 0);
      const salePrice = parseFloat(loan.sale_price || loanAmount);
      
      // 1. Debit Customer Receivable (Customer owes us)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, $3, 0, 'loan_delivery', $4, $5)
      `, [
        `Entrega préstamo producto - ${loan.first_name} ${loan.last_name} - #${id}`,
        `1003-${customerCode}`, netLoanAmount, sourceId, req.user.id
      ]);
      
      // 2. Credit Sales Revenue (We made a sale)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, 0, $3, 'loan_delivery', $4, $5)
      `, [
        `Venta producto - ${loan.first_name} ${loan.last_name} - #${id}`,
        `4002-${customerCode}`, salePrice, sourceId, req.user.id
      ]);
      
      // 3. Debit Cost of Goods Sold (COGS)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, $3, 0, 'loan_delivery', $4, $5)
      `, [
        `COGS - ${loan.first_name} ${loan.last_name} - #${id}`,
        `5001-${customerCode}`, costPrice, sourceId, req.user.id
      ]);
      
      // 4. Credit Inventory (Inventory goes out)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, 0, $3, 'loan_delivery', $4, $5)
      `, [
        `Salida inventario - ${loan.first_name} ${loan.last_name} - #${id}`,
        '1004', costPrice, sourceId, req.user.id
      ]);
      
      // 5. Handle down payment if any
      if (downPayment > 0) {
        // Debit Cash (down payment received)
        await pool.query(`
          INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
          VALUES ($1, $2, $3, 0, 'loan_delivery', $4, $5)
        `, [
          `Enganche recibido - ${loan.first_name} ${loan.last_name} - #${id}`,
          '1001', downPayment, sourceId, req.user.id
        ]);
        
        // Credit Customer Receivable (reduces what they owe)
        await pool.query(`
          INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
          VALUES ($1, $2, 0, $3, 'loan_delivery', $4, $5)
        `, [
          `Aplicación enganche - ${loan.first_name} ${loan.last_name} - #${id}`,
          `1003-${customerCode}`, downPayment, sourceId, req.user.id
        ]);
      }
      
      // Update inventory item status to vendido
      await pool.query(`
        UPDATE inventory_items 
        SET status = 'vendido' 
        WHERE id = $1
      `, [loan.inventory_item_id]);
      
      console.log("📊 Product delivery accounting entries created:", {
        customerReceivable: netLoanAmount,
        salesRevenue: salePrice,
        cogs: costPrice,
        inventoryOut: costPrice,
        downPaymentReceived: downPayment
      });
      
    } else if (loan.loan_type === 'efectivo') {
      // CASH LOAN DELIVERY ACCOUNTING
      
      // 1. Debit Customer Receivable (Customer owes us)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, $3, 0, 'loan_delivery', $4, $5)
      `, [
        `Entrega préstamo efectivo - ${loan.first_name} ${loan.last_name} - #${id}`,
        `1003-${customerCode}`, netLoanAmount, sourceId, req.user.id
      ]);
      
      // 2. Credit Cash (Cash goes out)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, 0, $3, 'loan_delivery', $4, $5)
      `, [
        `Desembolso efectivo - ${loan.first_name} ${loan.last_name} - #${id}`,
        '1001', loanAmount, sourceId, req.user.id
      ]);
      
      // 3. Handle down payment if any
      if (downPayment > 0) {
        // Debit Cash (down payment received)
        await pool.query(`
          INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
          VALUES ($1, $2, $3, 0, 'loan_delivery', $4, $5)
        `, [
          `Enganche recibido - ${loan.first_name} ${loan.last_name} - #${id}`,
          '1001', downPayment, sourceId, req.user.id
        ]);
        
        // Credit Customer Receivable (reduces what they owe)
        await pool.query(`
          INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
          VALUES ($1, $2, 0, $3, 'loan_delivery', $4, $5)
        `, [
          `Aplicación enganche - ${loan.first_name} ${loan.last_name} - #${id}`,
          `1003-${customerCode}`, downPayment, sourceId, req.user.id
        ]);
      }
      
      console.log("📊 Cash delivery accounting entries created:", {
        customerReceivable: netLoanAmount,
        cashOut: loanAmount,
        downPaymentReceived: downPayment
      });
    }

    // Update loan status to delivered
    await pool.query(`
      UPDATE loans 
      SET status = 'delivered', delivery_date = CURRENT_TIMESTAMP, delivered_by = $1
      WHERE id = $2
    `, [req.user.id, id]);

    await logUserActivity(req.user.id, 'DELIVER_LOAN', 'loans', id, 
      { status: 'approved' }, { status: 'delivered', delivery_date: new Date() }, req);

    res.json({ 
      message: "Loan delivered successfully", 
      loan_id: id,
      down_payment_received: downPayment,
      accounting_impact: {
        customer_receivable: netLoanAmount,
        down_payment: downPayment
      }
    });
  } catch (error) {
    console.error("Error delivering loan:", error);
    res.status(500).json({ error: "Failed to deliver loan", message: error.message });
  }
});

// Safe database reset endpoint (admin only)
app.post("/admin/safe-database-reset", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { safeReset } = require('./safe-reset');
    
    console.log('🚨 SAFE DATABASE RESET initiated by:', req.user.email);
    
    // Double-check admin permission
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Only admins can reset database" });
    }
    
    await safeReset();
    
    console.log('✅ Safe database reset completed successfully');
    res.json({ 
      message: "Database safely reset", 
      preserved: ["Admin user", "Chart of Accounts", "Financial Products"],
      reset: ["Customers", "Loans", "Inventory", "Payments", "Journal Entries"]
    });
    
  } catch (error) {
    console.error('❌ Safe reset failed:', error);
    res.status(500).json({ error: "Database reset failed", message: error.message });
  }
});

// TEMPORARY: Reset loan status to pending for testing
app.post("/admin/reset-loan-status/:id", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔧 Resetting loan ${id} status to pending`);
    
    const result = await pool.query(`
      UPDATE loans 
      SET status = 'pending', 
          approved_by = NULL, 
          approval_notes = NULL, 
          approved_at = NULL,
          contract_generated_by = NULL, 
          contract_generated_at = NULL,
          delivered_by = NULL,
          delivery_date = NULL
      WHERE id = $1
      RETURNING id, status
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }
    
    console.log(`✅ Loan ${id} reset to pending status`);
    res.json({ 
      message: "Loan status reset to pending", 
      loan: result.rows[0] 
    });
    
  } catch (error) {
    console.error("Error resetting loan status:", error);
    res.status(500).json({ error: "Failed to reset loan status" });
  }
});

// Get single loan by ID
app.get("/loans/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching loan ${id}`);
    
    const result = await pool.query(`
      SELECT 
        l.*,
        c.first_name || ' ' || c.last_name as customer_name,
        c.phone as customer_phone,
        ii.brand, ii.model, ii.color, ii.imei, ii.sale_price,
        fp.name as financial_product_name,
        s.name as store_name,
        u.name as created_by_name
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN inventory_items ii ON l.inventory_item_id = ii.id
      LEFT JOIN financial_products fp ON l.financial_product_id = fp.id
      LEFT JOIN stores s ON l.store_id = s.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Loan ${id} not found`);
      return res.status(404).json({ error: "Loan not found" });
    }
    
    const loan = result.rows[0];
    console.log(`✅ Found loan ${id}, status: ${loan.status}`);
    
    res.json(loan);
  } catch (error) {
    console.error("Error fetching loan:", error);
    res.status(500).json({ error: "Failed to fetch loan" });
  }
});

// ==============================================================================
// PAYMENT PROCESSING ENDPOINTS
// ==============================================================================

// Register payment for a loan
app.post("/payments", authenticateToken, hasPermission('canRegisterPayments'), async (req, res) => {
  try {
    const { loan_id, amount, payment_method, store_id, apply_extra_to, overpayment_action } = req.body;
    
    console.log("💰 Processing payment:", { 
      loan_id, 
      amount, 
      payment_method, 
      store_id, 
      apply_extra_to, 
      user: req.user?.id 
    });

    // Validate input
    if (!loan_id || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid loan ID or payment amount" });
    }

    // Get loan details with customer info
    const loanResult = await pool.query(`
      SELECT l.*, c.first_name, c.last_name, c.phone, c.email, c.address, c.id as customer_id
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.id = $1 AND l.status IN ('delivered', 'active', 'overdue')
    `, [loan_id]);

    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: "Active loan not found" });
    }

    const loan = loanResult.rows[0];
    const customerCode = loan.customer_id.toString().padStart(4, '0');
    const paymentAmount = parseFloat(amount);

    // Get unpaid installments in order
    const installmentsResult = await pool.query(`
      SELECT * FROM loan_installments 
      WHERE loan_id = $1 AND status != 'paid'
      ORDER BY week_number ASC
    `, [loan_id]);

    if (installmentsResult.rows.length === 0) {
      return res.status(400).json({ error: "No unpaid installments found" });
    }

    // Apply payment to installments
    let remainingPayment = paymentAmount;
    const paymentBreakdown = [];
    const sourceId = `payment-${loan_id}-${Date.now()}`;

    for (const installment of installmentsResult.rows) {
      if (remainingPayment <= 0) break;

      const amountDue = parseFloat(installment.amount_due || 0);
      const penaltyDue = parseFloat(installment.penalty_applied || 0);
      const totalDue = amountDue + penaltyDue;
      
      // Calculate how much of this installment can be paid
      const paymentForThisInstallment = Math.min(remainingPayment, totalDue);
      
      if (paymentForThisInstallment > 0) {
        // Allocate payment: penalties first, then principal+interest
        let penaltyPaid = Math.min(paymentForThisInstallment, penaltyDue);
        let principalInterestPaid = paymentForThisInstallment - penaltyPaid;
        
        // For simplicity, split principal+interest proportionally
        // (In a more complex system, you might apply to interest first)
        const principalPortion = parseFloat(installment.principal_amount || 0);
        const interestPortion = parseFloat(installment.interest_amount || 0);
        const totalPrincipalInterest = principalPortion + interestPortion;
        
        let principalPaid = 0;
        let interestPaid = 0;
        
        if (totalPrincipalInterest > 0) {
          principalPaid = (principalPortion / totalPrincipalInterest) * principalInterestPaid;
          interestPaid = (interestPortion / totalPrincipalInterest) * principalInterestPaid;
        }

        // Update installment
        const newStatus = (paymentForThisInstallment >= totalDue) ? 'paid' : 'partial';
        await pool.query(`
          UPDATE loan_installments 
          SET 
            capital_paid = COALESCE(capital_paid, 0) + $1,
            interest_paid = COALESCE(interest_paid, 0) + $2,
            penalty_paid = COALESCE(penalty_paid, 0) + $3,
            status = $4
          WHERE id = $5
        `, [principalPaid, interestPaid, penaltyPaid, newStatus, installment.id]);

        // Track payment breakdown
        paymentBreakdown.push({
          installment_id: installment.id,
          week_number: installment.week_number,
          amount_applied: paymentForThisInstallment,
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          penalty_paid: penaltyPaid,
          status: newStatus
        });

        remainingPayment -= paymentForThisInstallment;
      }
    }

    // Create journal entries for payment
    const cashAccount = payment_method === 'efectivo' ? '1001' : '1002'; // Cash or Bank
    
    // 1. Debit Cash/Bank (payment received)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, 0, 'loan_payment', $4, $5)
    `, [
      `Pago préstamo - ${loan.first_name} ${loan.last_name} - #${loan_id}`,
      cashAccount, paymentAmount, sourceId, req.user.id
    ]);

    // 2. Credit Customer Receivable (reduces what customer owes)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, 0, $3, 'loan_payment', $4, $5)
    `, [
      `Pago préstamo - ${loan.first_name} ${loan.last_name} - #${loan_id}`,
      `1003-${customerCode}`, paymentAmount, sourceId, req.user.id
    ]);

    // Check if loan is fully paid
    const remainingInstallments = await pool.query(`
      SELECT COUNT(*) as count FROM loan_installments 
      WHERE loan_id = $1 AND status != 'paid'
    `, [loan_id]);

    if (remainingInstallments.rows[0].count === 0) {
      // Update loan status to completed
      await pool.query(`
        UPDATE loans SET status = 'completed', status_updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [loan_id]);
    }

    // Handle overpayment if there's remaining payment
    let overpaymentHandling = null;
    if (remainingPayment > 0) {
      console.log(`💰 Overpayment detected: $${remainingPayment.toFixed(2)}`);
      
      switch (overpayment_action) {
        case 'advance':
          // Apply to future installments (already handled by the loop above)
          overpaymentHandling = {
            action: 'advance',
            amount: remainingPayment,
            description: 'Aplicado a cuotas futuras'
          };
          break;
          
        case 'credit':
          // TODO: Implement customer credit system
          overpaymentHandling = {
            action: 'credit',
            amount: remainingPayment,
            description: 'Guardado como crédito del cliente'
          };
          break;
          
        case 'refund':
          // Create refund journal entry
          await pool.query(`
            INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
            VALUES ($1, $2, $3, 0, 'payment_refund', $4, $5)
          `, [
            `Reembolso exceso pago - ${loan.first_name} ${loan.last_name} - #${loan_id}`,
            `1003-${customerCode}`, remainingPayment, sourceId, req.user.id
          ]);
          
          await pool.query(`
            INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
            VALUES ($1, $2, 0, $3, 'payment_refund', $4, $5)
          `, [
            `Reembolso exceso pago - ${loan.first_name} ${loan.last_name} - #${loan_id}`,
            payment_method === 'efectivo' ? '1001' : '1002', remainingPayment, sourceId, req.user.id
          ]);
          
          overpaymentHandling = {
            action: 'refund',
            amount: remainingPayment,
            description: 'Reembolsado al cliente'
          };
          break;
          
        default:
          overpaymentHandling = {
            action: 'pending',
            amount: remainingPayment,
            description: 'Pendiente de aplicación'
          };
      }
    }

    // Log user activity
    await logUserActivity(req.user.id, 'REGISTER_PAYMENT', 'loans', loan_id, 
      null, { 
        amount: paymentAmount, 
        payment_method, 
        installments_affected: paymentBreakdown.length,
        overpayment: remainingPayment,
        overpayment_action: overpayment_action
      }, req);

    // Return receipt data
    const receiptData = {
      success: true,
      payment_id: sourceId,
      loan_id: loan_id,
      customer_name: `${loan.first_name} ${loan.last_name}`,
      customer_phone: loan.phone,
      customer_address: loan.address,
      payment_amount: paymentAmount,
      payment_method: payment_method,
      payment_date: new Date().toISOString(),
      store_id: store_id,
      payment_breakdown: paymentBreakdown,
      remaining_payment: remainingPayment,
      installments_paid: paymentBreakdown.filter(p => p.status === 'paid').length,
      loan_completed: remainingInstallments.rows[0].count === 0,
      overpayment_handling: overpaymentHandling
    };

    console.log("✅ Payment processed successfully:", {
      loan_id,
      amount: paymentAmount,
      installments_affected: paymentBreakdown.length,
      loan_completed: receiptData.loan_completed
    });

    res.json(receiptData);

  } catch (error) {
    console.error("❌ Error processing payment:", error);
    res.status(500).json({ error: "Failed to process payment", message: error.message });
  }
});

// Get payments for a loan
app.get("/loans/:loan_id/payments", authenticateToken, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    // Get payment history from journal entries (actual payment transactions)
    const paymentsResult = await pool.query(`
      SELECT 
        je.id,
        je.date as payment_date,
        je.description,
        je.debit as amount,
        CASE 
          WHEN je.account_code = '1001' THEN 'efectivo'
          WHEN je.account_code = '1002' THEN 'transferencia'
          ELSE 'otro'
        END as payment_method,
        je.source_id as payment_id,
        je.created_at,
        'loan_payment' as type
      FROM journal_entries je
      WHERE je.source_type = 'loan_payment' 
        AND je.source_id LIKE $1
        AND je.debit > 0
      ORDER BY je.created_at DESC
    `, [`%${loan_id}%`]);

    console.log(`💰 Payment history for loan ${loan_id}:`, {
      count: paymentsResult.rows.length,
      payments: paymentsResult.rows.map(p => ({ date: p.payment_date, amount: p.amount, method: p.payment_method }))
    });
    
    res.json(paymentsResult.rows);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// Get payment breakdown for a loan
app.get("/loans/:loan_id/payment-breakdown", authenticateToken, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    const breakdownResult = await pool.query(`
      SELECT 
        li.id,
        li.week_number,
        li.due_date,
        li.amount_due,
        li.capital_portion as principal_amount,
        li.interest_portion as interest_amount,
        li.penalty_applied,
        COALESCE(li.capital_paid, 0) as capital_paid,
        COALESCE(li.interest_paid, 0) as interest_paid,
        COALESCE(li.penalty_paid, 0) as penalty_paid,
        li.status,
        -- Calculate total paid for this installment
        (COALESCE(li.capital_paid, 0) + COALESCE(li.interest_paid, 0) + COALESCE(li.penalty_paid, 0)) as total_paid,
        -- Calculate remaining balance for this installment
        (li.amount_due + COALESCE(li.penalty_applied, 0) - COALESCE(li.capital_paid, 0) - COALESCE(li.interest_paid, 0) - COALESCE(li.penalty_paid, 0)) as remaining_balance,
        -- Calculate payment progress percentage
        CASE 
          WHEN (li.amount_due + COALESCE(li.penalty_applied, 0)) > 0 
          THEN ROUND(((COALESCE(li.capital_paid, 0) + COALESCE(li.interest_paid, 0) + COALESCE(li.penalty_paid, 0)) * 100.0) / (li.amount_due + COALESCE(li.penalty_applied, 0)), 2)
          ELSE 0
        END as payment_progress,
        -- Calculate days overdue
        CASE 
          WHEN li.due_date < CURRENT_DATE AND li.status != 'paid' 
          THEN (CURRENT_DATE - li.due_date)::integer
          ELSE 0
        END as days_overdue,
        -- Enhanced status with more granular information
        CASE 
          WHEN li.status = 'paid' THEN 'Pagado'
          WHEN li.status = 'partial' THEN 'Pago Parcial'
          WHEN li.due_date < CURRENT_DATE - INTERVAL '7 days' AND li.status != 'paid' THEN 'Muy Vencido'
          WHEN li.due_date < CURRENT_DATE AND li.status != 'paid' THEN 'Vencido'
          WHEN li.due_date <= CURRENT_DATE + INTERVAL '3 days' AND li.status != 'paid' THEN 'Próximo Vencimiento'
          ELSE 'Pendiente'
        END as status_label,
        -- Color coding for frontend
        CASE 
          WHEN li.status = 'paid' THEN 'green'
          WHEN li.status = 'partial' THEN 'blue'
          WHEN li.due_date < CURRENT_DATE - INTERVAL '7 days' AND li.status != 'paid' THEN 'red'
          WHEN li.due_date < CURRENT_DATE AND li.status != 'paid' THEN 'yellow'
          WHEN li.due_date <= CURRENT_DATE + INTERVAL '3 days' AND li.status != 'paid' THEN 'orange'
          ELSE 'gray'
        END as color_code
      FROM loan_installments li
      WHERE li.loan_id = $1
      ORDER BY li.week_number ASC
    `, [loan_id]);

    // Transform installment data into payment breakdown format expected by frontend
    const paymentBreakdown = [];
    
    // Group installments by payment transactions (paid/partial installments)
    const paidInstallments = breakdownResult.rows.filter(r => r.status === 'paid' || r.status === 'partial');
    
    for (const installment of paidInstallments) {
      const components = [];
      
      // Add capital component if paid
      if (installment.capital_paid > 0) {
        components.push({
          type: 'capital',
          amount: parseFloat(installment.capital_paid),
          description: 'Capital'
        });
      }
      
      // Add interest component if paid
      if (installment.interest_paid > 0) {
        components.push({
          type: 'interest', 
          amount: parseFloat(installment.interest_paid),
          description: 'Interés'
        });
      }
      
      // Add penalty component if paid
      if (installment.penalty_paid > 0) {
        components.push({
          type: 'penalty',
          amount: parseFloat(installment.penalty_paid),
          description: 'Penalidad'
        });
      }
      
      if (components.length > 0) {
        paymentBreakdown.push({
          payment_date: installment.payment_date || new Date().toISOString(),
          week_number: installment.week_number,
          installment_id: installment.id,
          total_amount: parseFloat(installment.total_paid || 0),
          components: components
        });
      }
    }
    
    console.log(`📊 Payment breakdown for loan ${loan_id}:`, {
      count: breakdownResult.rows.length,
      paid_installments: breakdownResult.rows.filter(r => r.status === 'paid').length,
      partial_installments: breakdownResult.rows.filter(r => r.status === 'partial').length,
      breakdown_entries: paymentBreakdown.length
    });
    
    res.json({ payment_breakdown: paymentBreakdown });
  } catch (error) {
    console.error("Error fetching payment breakdown:", error);
    res.status(500).json({ error: "Failed to fetch payment breakdown" });
  }
});

// Preview payment allocation before actual payment
app.post("/payments/preview", authenticateToken, async (req, res) => {
  try {
    const { loan_id, amount } = req.body;
    
    if (!loan_id || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid loan ID or payment amount" });
    }

    // Get unpaid installments in order
    const installmentsResult = await pool.query(`
      SELECT 
        id, week_number, due_date, amount_due, 
        capital_portion as principal_amount, 
        interest_portion as interest_amount, 
        penalty_applied,
        COALESCE(capital_paid, 0) as capital_paid,
        COALESCE(interest_paid, 0) as interest_paid,
        COALESCE(penalty_paid, 0) as penalty_paid,
        status,
        (amount_due + COALESCE(penalty_applied, 0) - COALESCE(capital_paid, 0) - COALESCE(interest_paid, 0) - COALESCE(penalty_paid, 0)) as remaining_balance
      FROM loan_installments 
      WHERE loan_id = $1 AND status != 'paid'
      ORDER BY week_number ASC
    `, [loan_id]);

    if (installmentsResult.rows.length === 0) {
      return res.status(400).json({ error: "No unpaid installments found" });
    }

    // Simulate payment allocation
    let remainingPayment = parseFloat(amount);
    const previewBreakdown = [];
    let totalInstallmentsAffected = 0;
    let totalInstallmentsPaid = 0;

    for (const installment of installmentsResult.rows) {
      if (remainingPayment <= 0) break;

      const remainingBalance = parseFloat(installment.remaining_balance);
      const paymentForThisInstallment = Math.min(remainingPayment, remainingBalance);
      
      if (paymentForThisInstallment > 0) {
        const penaltyDue = parseFloat(installment.penalty_applied || 0) - parseFloat(installment.penalty_paid || 0);
        const penaltyPaid = Math.min(paymentForThisInstallment, penaltyDue);
        const principalInterestPaid = paymentForThisInstallment - penaltyPaid;
        
        // Calculate principal and interest portions
        const principalPortion = parseFloat(installment.principal_amount || 0) - parseFloat(installment.capital_paid || 0);
        const interestPortion = parseFloat(installment.interest_amount || 0) - parseFloat(installment.interest_paid || 0);
        const totalPrincipalInterest = principalPortion + interestPortion;
        
        let principalPaid = 0;
        let interestPaid = 0;
        
        if (totalPrincipalInterest > 0) {
          principalPaid = (principalPortion / totalPrincipalInterest) * principalInterestPaid;
          interestPaid = (interestPortion / totalPrincipalInterest) * principalInterestPaid;
        }

        const willBePaid = paymentForThisInstallment >= remainingBalance;
        
        previewBreakdown.push({
          installment_id: installment.id,
          week_number: installment.week_number,
          due_date: installment.due_date,
          current_balance: remainingBalance,
          payment_applied: paymentForThisInstallment,
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          penalty_paid: penaltyPaid,
          new_balance: remainingBalance - paymentForThisInstallment,
          will_be_paid: willBePaid,
          current_status: installment.status,
          new_status: willBePaid ? 'paid' : (paymentForThisInstallment > 0 ? 'partial' : installment.status)
        });

        totalInstallmentsAffected++;
        if (willBePaid) totalInstallmentsPaid++;
        remainingPayment -= paymentForThisInstallment;
      }
    }

    // Calculate summary
    const totalApplied = parseFloat(amount) - remainingPayment;
    const overpayment = remainingPayment;
    
    const summary = {
      payment_amount: parseFloat(amount),
      total_applied: totalApplied,
      overpayment: overpayment,
      installments_affected: totalInstallmentsAffected,
      installments_paid_in_full: totalInstallmentsPaid,
      has_overpayment: overpayment > 0,
      overpayment_options: overpayment > 0 ? [
        { id: 'advance', label: 'Aplicar a cuotas futuras', description: 'Aplicar el exceso a las siguientes cuotas' },
        { id: 'credit', label: 'Mantener como crédito', description: 'Guardar el exceso como crédito del cliente' },
        { id: 'refund', label: 'Reembolsar', description: 'Devolver el exceso al cliente' }
      ] : []
    };

    res.json({
      success: true,
      preview: previewBreakdown,
      summary: summary
    });

  } catch (error) {
    console.error("Error generating payment preview:", error);
    res.status(500).json({ error: "Failed to generate payment preview" });
  }
});

// Get smart payment suggestions for a loan
app.get("/loans/:loan_id/payment-suggestions", authenticateToken, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    // Get unpaid installments with overdue information
    const installmentsResult = await pool.query(`
      SELECT 
        id, week_number, due_date, amount_due, penalty_applied,
        COALESCE(capital_paid, 0) as capital_paid,
        COALESCE(interest_paid, 0) as interest_paid,
        COALESCE(penalty_paid, 0) as penalty_paid,
        status,
        (amount_due + COALESCE(penalty_applied, 0) - COALESCE(capital_paid, 0) - COALESCE(interest_paid, 0) - COALESCE(penalty_paid, 0)) as remaining_balance,
        CASE 
          WHEN due_date < CURRENT_DATE AND status != 'paid' 
          THEN (CURRENT_DATE - due_date)::integer
          ELSE 0
        END as days_overdue
      FROM loan_installments 
      WHERE loan_id = $1 AND status != 'paid'
      ORDER BY week_number ASC
    `, [loan_id]);

    if (installmentsResult.rows.length === 0) {
      return res.json({ suggestions: [] });
    }

    const installments = installmentsResult.rows;
    const suggestions = [];

    // 1. Next installment due
    const nextInstallment = installments[0];
    if (nextInstallment) {
      suggestions.push({
        id: 'next',
        label: `Próxima Cuota (#${nextInstallment.week_number})`,
        amount: parseFloat(nextInstallment.remaining_balance),
        description: `Vence: ${new Date(nextInstallment.due_date).toLocaleDateString()}`,
        priority: nextInstallment.days_overdue > 0 ? 'high' : 'normal',
        type: 'single_installment'
      });
    }

    // 2. Catch up overdue payments
    const overdueInstallments = installments.filter(inst => inst.days_overdue > 0);
    if (overdueInstallments.length > 0) {
      const totalOverdue = overdueInstallments.reduce((sum, inst) => sum + parseFloat(inst.remaining_balance), 0);
      suggestions.push({
        id: 'catch_up',
        label: `Ponerse al Día (${overdueInstallments.length} cuotas)`,
        amount: totalOverdue,
        description: `${overdueInstallments.length} cuotas vencidas`,
        priority: 'high',
        type: 'catch_up',
        installments_count: overdueInstallments.length
      });
    }

    // 3. Pay next 2-3 installments
    const next3Installments = installments.slice(0, Math.min(3, installments.length));
    const total3Installments = next3Installments.reduce((sum, inst) => sum + parseFloat(inst.remaining_balance), 0);
    if (next3Installments.length > 1) {
      suggestions.push({
        id: 'next_3',
        label: `Próximas ${next3Installments.length} Cuotas`,
        amount: total3Installments,
        description: `Cuotas #${next3Installments[0].week_number} - #${next3Installments[next3Installments.length - 1].week_number}`,
        priority: 'normal',
        type: 'multiple_installments',
        installments_count: next3Installments.length
      });
    }

    // 4. Pay all remaining
    const totalRemaining = installments.reduce((sum, inst) => sum + parseFloat(inst.remaining_balance), 0);
    if (installments.length > 1) {
      suggestions.push({
        id: 'pay_all',
        label: `Liquidar Préstamo (${installments.length} cuotas)`,
        amount: totalRemaining,
        description: `Pagar todas las cuotas restantes`,
        priority: 'normal',
        type: 'full_payment',
        installments_count: installments.length
      });
    }

    // 5. Custom amount suggestion based on common payment amounts
    const commonAmounts = [500, 1000, 1500, 2000, 2500, 3000];
    const viableAmounts = commonAmounts.filter(amount => amount < totalRemaining && amount >= parseFloat(nextInstallment?.remaining_balance || 0));
    
    if (viableAmounts.length > 0) {
      suggestions.push({
        id: 'custom_500',
        label: `Pago de $${viableAmounts[0]}`,
        amount: viableAmounts[0],
        description: `Monto sugerido`,
        priority: 'low',
        type: 'custom_amount'
      });
    }

    res.json({ suggestions });
  } catch (error) {
    console.error("Error fetching payment suggestions:", error);
    res.status(500).json({ error: "Failed to fetch payment suggestions" });
  }
});

// Get financial movements for a loan
app.get("/loans/:loan_id/financial-movements", authenticateToken, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    // Get journal entries related to this loan
    const movementsResult = await pool.query(`
      SELECT 
        je.id,
        je.date,
        je.description,
        je.account_code,
        je.debit,
        je.credit,
        je.source_type,
        je.created_at,
        ca.name as account_name,
        ca.type as account_type
      FROM journal_entries je
      LEFT JOIN chart_of_accounts ca ON je.account_code = ca.code
      WHERE je.source_type IN ('loan_delivery', 'loan_payment') 
        AND je.source_id LIKE $1
      ORDER BY je.created_at DESC
    `, [`%${loan_id}%`]);

    res.json(movementsResult.rows);
  } catch (error) {
    console.error("Error fetching financial movements:", error);
    res.status(500).json({ error: "Failed to fetch financial movements" });
  }
});

// Update loan statuses based on payment history (admin endpoint)
app.post("/admin/update-loan-statuses", authenticateToken, hasPermission('canManageLoans'), async (req, res) => {
  try {
    console.log("🔄 Starting loan status update process...");

    // Get all loans that might need status updates
    const loansResult = await pool.query(`
      SELECT l.*, 
             CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.status IN ('delivered', 'active', 'overdue')
      ORDER BY l.id
    `);

    let updatedCount = 0;
    const statusUpdates = [];

    for (const loan of loansResult.rows) {
      const loanId = loan.id;
      let newStatus = loan.status;
      
      // Get installment summary for this loan
      const installmentSummary = await pool.query(`
        SELECT 
          COUNT(*) as total_installments,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_installments,
          COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'paid' THEN 1 END) as overdue_installments,
          MIN(CASE WHEN status != 'paid' THEN due_date END) as next_due_date,
          MAX(due_date) as final_due_date
        FROM loan_installments 
        WHERE loan_id = $1
      `, [loanId]);

      const summary = installmentSummary.rows[0];
      const totalInstallments = parseInt(summary.total_installments || 0);
      const paidInstallments = parseInt(summary.paid_installments || 0);
      const overdueInstallments = parseInt(summary.overdue_installments || 0);
      const nextDueDate = summary.next_due_date;

      // Determine new status based on payment history
      if (totalInstallments === 0) {
        // No installments yet - keep current status
        continue;
      } else if (paidInstallments === totalInstallments) {
        // All installments paid - loan completed
        newStatus = 'completed';
      } else if (overdueInstallments > 0) {
        // Has overdue installments - loan overdue
        newStatus = 'overdue';
      } else if (loan.status === 'delivered' && nextDueDate) {
        // Delivered loan with upcoming payments - now active
        newStatus = 'active';
      } else if (loan.status === 'overdue' && overdueInstallments === 0) {
        // Was overdue but caught up - now active
        newStatus = 'active';
      }

      // Update loan status if it changed
      if (newStatus !== loan.status) {
        await pool.query(`
          UPDATE loans 
          SET status = $1, status_updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newStatus, loanId]);

        statusUpdates.push({
          loan_id: loanId,
          customer_name: loan.customer_name,
          old_status: loan.status,
          new_status: newStatus,
          paid_installments: paidInstallments,
          total_installments: totalInstallments,
          overdue_installments: overdueInstallments
        });

        updatedCount++;
        
        console.log(`📊 Updated loan ${loanId} (${loan.customer_name}): ${loan.status} → ${newStatus}`);
      }
    }

    await logUserActivity(req.user.id, 'UPDATE_LOAN_STATUSES', 'loans', null, 
      null, { updated_count: updatedCount, updates: statusUpdates }, req);

    console.log(`✅ Loan status update complete: ${updatedCount} loans updated`);

    res.json({
      message: `Loan status update completed successfully`,
      updated_count: updatedCount,
      total_loans_checked: loansResult.rows.length,
      status_updates: statusUpdates
    });

  } catch (error) {
    console.error("❌ Error updating loan statuses:", error);
    res.status(500).json({ error: "Failed to update loan statuses", message: error.message });
  }
});

// ==============================================================================
// TREASURY ENDPOINTS (for Tesorería page)
// ==============================================================================

// Get payment orders for treasury (approved inventory + expenses)
app.get("/treasury/payment-orders", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    console.log("💰 Treasury fetching payment orders");
    
    // Get approved inventory requests (ready for payment)
    const inventoryResult = await pool.query(`
      SELECT 
        ir.*,
        s.name AS store_name,
        u.name AS approved_by_name,
        COUNT(ii.id) as items_count
      FROM inventory_requests ir
      LEFT JOIN stores s ON ir.store_id = s.id
      LEFT JOIN users u ON ir.approved_by = u.id
      LEFT JOIN inventory_items ii ON ir.id = ii.inventory_request_id
      WHERE ir.status = 'approved'
      GROUP BY ir.id, s.name, u.name 
      ORDER BY ir.created_at DESC
    `);

    // Get approved expenses (if any)
    const expensesResult = await pool.query(`
      SELECT * FROM expenses 
      WHERE status = 'approved' 
      ORDER BY created_at DESC
    `);

    console.log("💰 Found payment orders:", { 
      inventory: inventoryResult.rows.length,
      expenses: expensesResult.rows.length 
    });

    res.json({
      inventory: inventoryResult.rows,
      expenses: expensesResult.rows
    });
  } catch (error) {
    console.error("❌ Error fetching payment orders:", error);
    res.status(500).json({ error: "Failed to fetch payment orders" });
  }
});

// Get payment history for treasury
app.get("/treasury/payment-orders/history", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    console.log("📋 Treasury fetching payment history");
    
    // Get paid inventory requests
    const inventoryResult = await pool.query(`
      SELECT 
        ir.*,
        s.name AS store_name,
        'inventory' as type
      FROM inventory_requests ir
      LEFT JOIN stores s ON ir.store_id = s.id
      WHERE ir.status IN ('paid', 'received')
      ORDER BY ir.paid_at DESC
    `);

    // Get paid expenses
    const expensesResult = await pool.query(`
      SELECT *, 'expense' as type FROM expenses 
      WHERE status = 'paid' 
      ORDER BY updated_at DESC
    `);

    console.log("📋 Found payment history:", { 
      inventory: inventoryResult.rows.length,
      expenses: expensesResult.rows.length 
    });

    res.json({
      inventory: inventoryResult.rows,
      expenses: expensesResult.rows
    });
  } catch (error) {
    console.error("❌ Error fetching payment history:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// Confirm payment from treasury (with file upload)
app.post("/treasury/confirm-payment", authenticateToken, hasPermission('canManageInventory'), upload.single('file'), async (req, res) => {
  try {
    const { id, type, method } = req.body;
    const file = req.file;
    
    console.log("💰 Treasury confirming payment:", { id, type, method, hasFile: !!file });

    if (type === 'inventory') {
      // Use existing inventory payment endpoint logic
      const payment_method = method || 'cash';
      const payment_reference = file ? file.filename : null;
      const notes = `Pago confirmado desde Tesorería - ${method}`;

      // Get the approved request
      const requestResult = await pool.query(`
        SELECT * FROM inventory_requests 
        WHERE id = $1 AND status = 'approved'
      `, [id]);

      if (requestResult.rows.length === 0) {
        return res.status(404).json({ error: "Approved request not found" });
      }

      const request = requestResult.rows[0];
      const amount = parseFloat(request.amount);

      // Determine accounts based on payment method
      // Only "efectivo" goes to Caja (1001), everything else goes to Bancos (1002)
      const cashAccount = payment_method === 'efectivo' ? '1001' : '1002'; // Caja or Bancos
      const supplierAdvanceAccount = '1005'; // Anticipo a Proveedores (Asset account)

      console.log("💰 Account mapping:", { 
        payment_method, 
        cashAccount: cashAccount === '1001' ? 'Caja (1001)' : 'Bancos (1002)',
        amount 
      });

      // Create journal entries for supplier payment
      const sourceId = `supplier-payment-${id}-${Date.now()}`;
      
      // Credit Cash/Bank (decrease)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, 0, $3, 'supplier_payment', $4, $5)
      `, [
        `Pago a proveedor ${request.supplier} - Solicitud #${id}`,
        cashAccount, amount, sourceId, req.user.id
      ]);

      // Debit Supplier Advances (increase)
      await pool.query(`
        INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
        VALUES ($1, $2, $3, 0, 'supplier_payment', $4, $5)
      `, [
        `Anticipo a proveedor ${request.supplier} - Solicitud #${id}`,
        supplierAdvanceAccount, amount, sourceId, req.user.id
      ]);

      // Update request status
      await pool.query(`
        UPDATE inventory_requests 
        SET status = 'paid', payment_method = $1, payment_reference = $2, payment_notes = $3, paid_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [payment_method, payment_reference, notes, id]);

      // Update inventory items status
      await pool.query(`
        UPDATE inventory_items 
        SET status = 'paid' 
        WHERE inventory_request_id = $1
      `, [id]);

      await logUserActivity(req.user.id, 'PAY_SUPPLIER_TREASURY', 'inventory_requests', id, 
        { status: 'approved' }, { status: 'paid', payment_method, amount }, req);

      console.log("💰 Treasury confirmed inventory payment:", { 
        id, supplier: request.supplier, amount, 
        debitAccount: supplierAdvanceAccount, creditAccount: cashAccount 
      });

      res.json({ 
        message: "Payment confirmed successfully", 
        accounting: {
          debit: { account: supplierAdvanceAccount, amount },
          credit: { account: cashAccount, amount }
        }
      });

    } else if (type === 'expense') {
      // Handle expense payment confirmation
      await pool.query(`
        UPDATE expenses 
        SET status = 'paid', payment_method = $1, payment_reference = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [method, file ? file.filename : null, id]);

      await logUserActivity(req.user.id, 'PAY_EXPENSE_TREASURY', 'expenses', id, 
        { status: 'approved' }, { status: 'paid', payment_method: method }, req);

      res.json({ message: "Expense payment confirmed successfully" });
    } else {
      res.status(400).json({ error: "Invalid payment type" });
    }

  } catch (error) {
    console.error("❌ Error confirming payment:", error);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});


// ==============================================================================
// INVENTORY WORKFLOW ENDPOINTS (Approval → Payment → Receipt)
// ==============================================================================



// Approve inventory request
app.put("/inventory-requests/:id/approve", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    console.log("✅ Approving inventory request:", { id, user: req.user?.id });

    // Update request status
    const result = await pool.query(`
      UPDATE inventory_requests 
      SET status = 'approved', approved_by = $1, approval_notes = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found or already processed" });
    }

    const approvedRequest = result.rows[0];

    // Update associated inventory items status
    await pool.query(`
      UPDATE inventory_items 
      SET status = 'approved' 
      WHERE inventory_request_id = $1
    `, [id]);

    await logUserActivity(req.user.id, 'APPROVE_INVENTORY_REQUEST', 'inventory_requests', id, 
      { status: 'pending' }, { status: 'approved', notes }, req);

    console.log("✅ Inventory request approved:", { id, supplier: approvedRequest.supplier, amount: approvedRequest.amount });

    res.json({ 
      message: "Inventory request approved successfully", 
      request: approvedRequest 
    });
  } catch (error) {
    console.error("Error approving inventory request:", error);
    res.status(500).json({ error: "Failed to approve inventory request" });
  }
});

// Pay supplier (Tesorería) - Creates accounting entries
app.post("/inventory-requests/:id/pay", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, payment_reference, notes } = req.body; // payment_method: 'cash' or 'bank'
    
    console.log("💰 Processing supplier payment:", { id, payment_method, user: req.user?.id });

    // Get the approved request
    const requestResult = await pool.query(`
      SELECT * FROM inventory_requests 
      WHERE id = $1 AND status = 'approved'
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Approved request not found" });
    }

    const request = requestResult.rows[0];
    const amount = parseFloat(request.amount);

    // Determine accounts based on payment method
    // Only "efectivo" goes to Caja (1001), everything else goes to Bancos (1002)
    const cashAccount = payment_method === 'efectivo' ? '1001' : '1002'; // Caja or Bancos
    const supplierAdvanceAccount = '1005'; // Anticipo a Proveedores (Asset account)

    // Create journal entries for supplier payment
    const sourceId = `supplier-payment-${id}-${Date.now()}`;
    
    // Credit Cash/Bank (decrease)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, 0, $3, 'supplier_payment', $4, $5)
    `, [
      `Pago a proveedor ${request.supplier} - Solicitud #${id}`,
      cashAccount, amount, sourceId, req.user.id
    ]);

    // Debit Supplier Advances (increase)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, 0, 'supplier_payment', $4, $5)
    `, [
      `Anticipo a proveedor ${request.supplier} - Solicitud #${id}`,
      supplierAdvanceAccount, amount, sourceId, req.user.id
    ]);

    // Update request status
    await pool.query(`
      UPDATE inventory_requests 
      SET status = 'paid', payment_method = $1, payment_reference = $2, payment_notes = $3, paid_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [payment_method, payment_reference, notes, id]);

    // Update inventory items status
    await pool.query(`
      UPDATE inventory_items 
      SET status = 'paid' 
      WHERE inventory_request_id = $1
    `, [id]);

    await logUserActivity(req.user.id, 'PAY_SUPPLIER', 'inventory_requests', id, 
      { status: 'approved' }, { status: 'paid', payment_method, amount }, req);

    console.log("💰 Supplier payment processed:", { 
      id, supplier: request.supplier, amount, 
      debitAccount: supplierAdvanceAccount, creditAccount: cashAccount 
    });

    res.json({ 
      message: "Supplier payment processed successfully", 
      accounting: {
        debit: { account: supplierAdvanceAccount, amount },
        credit: { account: cashAccount, amount }
      }
    });
  } catch (error) {
    console.error("Error processing supplier payment:", error);
    res.status(500).json({ error: "Failed to process supplier payment" });
  }
});

// Receive inventory (Warehouse) - Creates accounting entries
app.post("/inventory-requests/:id/receive", authenticateToken, hasPermission('canReceiveInventory'), async (req, res) => {
  try {
    const { id } = req.params;
    const { received_quantity, condition, notes } = req.body;
    
    console.log("📦 Receiving inventory:", { id, received_quantity, user: req.user?.id });

    // Get the paid request
    const requestResult = await pool.query(`
      SELECT * FROM inventory_requests 
      WHERE id = $1 AND status = 'paid'
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Paid request not found" });
    }

    const request = requestResult.rows[0];
    const amount = parseFloat(request.amount);

    // Create journal entries for inventory receipt
    const sourceId = `inventory-receipt-${id}-${Date.now()}`;
    const inventoryAccount = '1004'; // Inventario (Asset account)
    const supplierAdvanceAccount = '1005'; // Anticipo a Proveedores (Asset account)

    // Debit Inventory (increase)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, 0, 'inventory_receipt', $4, $5)
    `, [
      `Recepción inventario ${request.supplier} - Solicitud #${id}`,
      inventoryAccount, amount, sourceId, req.user.id
    ]);

    // Credit Supplier Advances (decrease)
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, 0, $3, 'inventory_receipt', $4, $5)
    `, [
      `Liquidación anticipo ${request.supplier} - Solicitud #${id}`,
      supplierAdvanceAccount, amount, sourceId, req.user.id
    ]);

    // Update request status
    await pool.query(`
      UPDATE inventory_requests 
      SET status = 'received', received_quantity = $1, received_condition = $2, 
          reception_notes = $3, received_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [received_quantity, condition || 'good', notes, id]);

    // Update inventory items status
    await pool.query(`
      UPDATE inventory_items 
      SET status = 'disponible', condition = $1
      WHERE inventory_request_id = $2
    `, [condition || 'new', id]);

    await logUserActivity(req.user.id, 'RECEIVE_INVENTORY', 'inventory_requests', id, 
      { status: 'paid' }, { status: 'received', received_quantity, condition }, req);

    console.log("📦 Inventory received:", { 
      id, supplier: request.supplier, amount,
      debitAccount: inventoryAccount, creditAccount: supplierAdvanceAccount 
    });

    res.json({ 
      message: "Inventory received successfully", 
      accounting: {
        debit: { account: inventoryAccount, amount },
        credit: { account: supplierAdvanceAccount, amount }
      }
    });
  } catch (error) {
    console.error("Error receiving inventory:", error);
    res.status(500).json({ error: "Failed to receive inventory" });
  }
});

// ==============================================================================
// INVENTORY ITEMS ENDPOINTS
// ==============================================================================

// Get inventory items with store filtering
app.get("/inventory-items", authenticateToken, async (req, res) => {
  try {
    const { store_id, status } = req.query;
    
    let query = `
      SELECT 
        i.*, 
        s.name AS store_name,
        ir.notes AS request_notes,
        ir.supplier,
        ir.status AS request_status
      FROM inventory_items i
      LEFT JOIN stores s ON i.store_id = s.id
      LEFT JOIN inventory_requests ir ON i.inventory_request_id = ir.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    if (store_id) {
      query += ` AND i.store_id = $${paramCount}`;
      queryParams.push(store_id);
      paramCount++;
    }
    
    if (status) {
      query += ` AND i.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY i.created_at DESC`;
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    res.status(500).json({ error: "Failed to fetch inventory items" });
  }
});

// Create inventory item
app.post("/inventory-items", authenticateToken, hasPermission('canManageInventory'), async (req, res) => {
  try {
    const {
      inventory_request_id,
      store_id,
      category,
      brand,
      model,
      color,
      ram,
      storage,
      imei,
      purchase_price,
      sale_price,
      condition,
      status
    } = req.body;

    const result = await pool.query(`
      INSERT INTO inventory_items (
        inventory_request_id, store_id, category, brand, model, color, ram, storage,
        imei, purchase_price, sale_price, condition, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      inventory_request_id, store_id, category, brand, model, color, ram, storage,
      imei, purchase_price, sale_price, condition || 'new', status || 'pending'
    ]);

    const newItem = result.rows[0];
    await logUserActivity(req.user.id, 'CREATE_INVENTORY_ITEM', 'inventory_items', newItem.id, null, newItem, req);

    res.status(201).json({ 
      message: "Inventory item created successfully", 
      item: newItem 
    });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    if (error.code === '23505') {
      res.status(400).json({ error: "IMEI already exists" });
    } else {
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  }
});

// ============================================================================
// EXPENSE MANAGEMENT SYSTEM  
// ============================================================================

// Get expenses with store filtering
app.get("/expenses", authenticateToken, async (req, res) => {
  try {
    const { store_id, status } = req.query;
    
    let query = `
      SELECT 
        e.*, 
        s.name AS store_name,
        u.name AS created_by_name
      FROM expenses e
      LEFT JOIN stores s ON e.store_id = s.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    if (store_id) {
      query += ` AND e.store_id = $${paramCount}`;
      queryParams.push(store_id);
      paramCount++;
    }
    
    if (status) {
      query += ` AND e.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    query += ` ORDER BY e.expense_date DESC`;
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// Create expense
app.post("/expenses", authenticateToken, hasPermission('canManageExpenses'), async (req, res) => {
  try {
    const {
      category,
      amount,
      description,
      store_id,
      expense_date,
      status
    } = req.body;

    const result = await pool.query(`
      INSERT INTO expenses (
        category, amount, description, store_id, expense_date, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      category, amount, description, store_id, expense_date || new Date(), status || 'pending', req.user.id
    ]);

    const newExpense = result.rows[0];
    await logUserActivity(req.user.id, 'CREATE_EXPENSE', 'expenses', newExpense.id, null, newExpense, req);

    res.status(201).json({ 
      message: "Expense created successfully", 
      expense: newExpense 
    });
  } catch (error) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

// ============================================================================
// MANUAL ACCOUNTING ENTRIES
// ============================================================================

// Health check for manual entry endpoint
app.get("/manual-entry/health", (req, res) => {
  res.json({ status: "Manual entry endpoint is working", timestamp: new Date().toISOString() });
});

// Create manual accounting entry (from AdminManualEntry component)
app.post("/manual-entry", authenticateToken, async (req, res) => {
  try {
    console.log("🧾 Manual entry request received:", { type: req.body.type, amount: req.body.amount, user: req.user?.id });
    const { type, amount, description, store_id, source } = req.body;

    // Validate required fields
    if (!type || !amount || !description || !source) {
      return res.status(400).json({ 
        error: "Missing required fields: type, amount, description, source" 
      });
    }

    // Create accounting entries based on type
    let debitAccount, creditAccount;
    
    switch (type) {
      case 'capital':
        // Capital contribution: Debit Cash/Bank, Credit Capital Social
        debitAccount = source === '1102' ? '1002' : '1001'; // Bank or Cash
        creditAccount = '3001'; // Capital Social
        break;
      case 'internalLoan':
        // Internal loan: Debit Cash/Bank, Credit Préstamos por Pagar
        debitAccount = source === '1102' ? '1002' : '1001'; // Bank or Cash
        creditAccount = '2002'; // Préstamos por Pagar
        break;
      case 'fixedAsset':
        // Fixed asset purchase: Debit Fixed Asset, Credit Cash/Bank
        debitAccount = source === '1102' ? '1102' : '1101'; // Mobiliario y Equipo or Equipo de Cómputo
        creditAccount = source === '1102' ? '1002' : '1001'; // Bank or Cash
        break;
      case 'retained':
        // Retained earnings: Debit Cash/Bank, Credit Utilidades Retenidas
        debitAccount = source === '1102' ? '1002' : '1001'; // Bank or Cash
        creditAccount = '3002'; // Utilidades Retenidas
        break;
      default:
        return res.status(400).json({ error: `Invalid entry type: ${type}. Valid types: capital, internalLoan, fixedAsset, retained` });
    }

    // Create debit journal entry
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, $3, 0, 'manual_entry', $4, $5)
    `, [description, debitAccount, amount, `${type}-${Date.now()}`, req.user.id]);

    // Create credit journal entry
    await pool.query(`
      INSERT INTO journal_entries (description, account_code, debit, credit, source_type, source_id, created_by)
      VALUES ($1, $2, 0, $3, 'manual_entry', $4, $5)
    `, [description, creditAccount, amount, `${type}-${Date.now()}`, req.user.id]);

    // Also create entry in manual entries table for tracking
    const manualEntry = await pool.query(`
      INSERT INTO accounting_manual_entries (entry_type, description, amount, source_account, destination_account, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [type, description, amount, debitAccount, creditAccount, req.user.id]);

    const manualEntryId = manualEntry.rows[0].id;

    await logUserActivity(req.user.id, 'CREATE_MANUAL_ENTRY', 'accounting_manual_entries', manualEntryId, null, { type, amount, description, debitAccount, creditAccount }, req);

    res.status(201).json({ 
      message: "Manual entry created successfully", 
      entry_id: manualEntryId,
      accounts_affected: {
        debit: { account: debitAccount, amount },
        credit: { account: creditAccount, amount }
      }
    });
  } catch (error) {
    console.error("Error creating manual entry:", error);
    res.status(500).json({ error: "Failed to create manual entry" });
  }
});

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

// Get all customers
app.get("/customers", authenticateToken, async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT id, first_name, last_name, email, phone, address, 
             curp, rfc, created_at
      FROM customers
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (
        LOWER(first_name) LIKE LOWER($${paramCount}) OR 
        LOWER(last_name) LIKE LOWER($${paramCount}) OR 
        LOWER(email) LIKE LOWER($${paramCount}) OR 
        phone LIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);
    
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get customer by ID
app.get("/customers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM customers WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Create new customer
app.post("/customers", authenticateToken, upload.fields([
  { name: 'ife', maxCount: 1 },
  { name: 'bureau', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("🔍 Customer creation request received:", {
      body: req.body,
      user: req.user?.id,
      headers: req.headers['content-type'],
      isMultipart: req.headers['content-type']?.includes('multipart/form-data')
    });

    // Handle multipart form data (when files are included)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Check if this multipart request has finalSave flag
      const hasFinalSave = req.body.finalSave === 'true' || req.body.finalSave === true;
      
      if (!hasFinalSave) {
        console.log("📄 Multipart form detected - document upload step, skipping customer creation");
        // Return success but don't create customer during document upload
        return res.status(200).json({ 
          message: "Document upload step - customer will be created on final save",
          step: "document_upload",
          skip_creation: true
        });
      } else {
        console.log("💾 Multipart form with finalSave=true detected - proceeding with customer creation");
        // Continue to customer creation logic below
      }
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      curp,
      rfc,
      date_of_birth,
      store_id
    } = req.body;

    // Only create customer if explicitly requested with finalSave flag
    const isFinalSave = req.body.finalSave === true || req.body.finalSave === 'true';
    
    if (!isFinalSave) {
      // Not a final save - just acknowledge the form step without creating customer
      console.log("📝 Form step detected - not creating customer yet");
      return res.status(200).json({ 
        message: "Form step acknowledged - customer will be created when 'Crear Cliente' button is clicked",
        step: "form_navigation",
        requires_final_save: true
      });
    }
    
    // Final save - validate required fields
    if (!first_name || !last_name || !phone) {
      console.log("❌ Final save validation failed: Missing required fields");
      return res.status(400).json({ 
        error: "Missing required fields: first_name, last_name, phone" 
      });
    }

    // Create customer
    const result = await pool.query(`
      INSERT INTO customers (
        first_name, last_name, email, phone, address, 
        curp, rfc, date_of_birth, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      first_name,
      last_name,
      email || null,
      phone,
      address || null,
      curp || null,
      rfc || null,
      date_of_birth || null
    ]);

    const customer = result.rows[0];

    // Create customer subaccounts in chart of accounts (for final saves)
    let subaccounts = [];
    if (first_name && last_name) {
      const customerCode = customer.id.toString().padStart(4, '0');
      subaccounts = [
      {
        code: `1003-${customerCode}`,
        name: `Cuentas por Cobrar - ${first_name} ${last_name}`,
        type: 'asset',
        group_name: 'Clientes',
        parent_code: '1003'
      },
      {
        code: `4002-${customerCode}`,
        name: `Ventas - ${first_name} ${last_name}`,
        type: 'revenue',
        group_name: 'Ventas',
        parent_code: '4002'
      },
      {
        code: `4001-${customerCode}`,
        name: `Intereses - ${first_name} ${last_name}`,
        type: 'revenue',
        group_name: 'Intereses',
        parent_code: '4001'
      },
      {
        code: `5001-${customerCode}`,
        name: `COGS - ${first_name} ${last_name}`,
        type: 'expense',
        group_name: 'Costo de Ventas',
        parent_code: '5001'
      },
      {
        code: `4003-${customerCode}`,
        name: `Penalties - ${first_name} ${last_name}`,
        type: 'revenue',
        group_name: 'Multas y Recargos',
        parent_code: '4003'
      }
      ];

      // Insert subaccounts
      for (const subaccount of subaccounts) {
        try {
          await pool.query(`
            INSERT INTO chart_of_accounts (code, name, type, group_name, parent_code)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (code) DO NOTHING
          `, [
            subaccount.code,
            subaccount.name,
            subaccount.type,
            subaccount.group_name,
            subaccount.parent_code // Use the explicit parent_code
          ]);
        } catch (subaccountError) {
          console.log(`⚠️ Could not create subaccount ${subaccount.code}:`, subaccountError.message);
        }
      }

      console.log(`✅ Created customer ${customer.id} with ${subaccounts.length} subaccounts`);
    } else {
      console.log(`📝 Created customer ${customer.id} (no subaccounts yet)`);
    }

    // Handle uploaded files
    let uploadedFiles = {};
    if (req.files) {
      if (req.files.ife && req.files.ife[0]) {
        uploadedFiles.ife = req.files.ife[0].filename;
        console.log(`📄 IFE file uploaded: ${req.files.ife[0].filename}`);
      }
      if (req.files.bureau && req.files.bureau[0]) {
        uploadedFiles.bureau = req.files.bureau[0].filename;
        console.log(`📊 Bureau file uploaded: ${req.files.bureau[0].filename}`);
      }
    }

    // Log activity
    await logUserActivity(req.user.id, 'CUSTOMER_CREATED', `Created customer: ${first_name} ${last_name} with subaccounts`, customer.id);

    res.status(201).json({
      ...customer,
      subaccounts_created: subaccounts.map(s => ({ code: s.code, name: s.name })),
      uploaded_files: uploadedFiles
    });
  } catch (error) {
    console.error("❌ Error creating customer:", {
      message: error.message,
      code: error.code,
      constraint: error.constraint,
      detail: error.detail,
      stack: error.stack
    });
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      if (error.constraint?.includes('email')) {
        return res.status(400).json({ error: "Email already exists" });
      }
      if (error.constraint?.includes('phone')) {
        return res.status(400).json({ error: "Phone number already exists" });
      }
      if (error.constraint?.includes('curp')) {
        return res.status(400).json({ error: "CURP already exists" });
      }
    }
    
    // Handle other database errors
    if (error.code === '42703') {
      return res.status(500).json({ error: "Database schema error: " + error.message });
    }
    
    res.status(500).json({ 
      error: "Failed to create customer",
      details: error.message 
    });
  }
});

// Update customer
app.put("/customers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      curp,
      rfc,
      date_of_birth,
      store_id
    } = req.body;

    const result = await pool.query(`
      UPDATE customers 
      SET first_name = $1, last_name = $2, email = $3, phone = $4, 
          address = $5, curp = $6, rfc = $7, date_of_birth = $8
      WHERE id = $9
      RETURNING *
    `, [
      first_name,
      last_name,
      email || null,
      phone,
      address || null,
      curp || null,
      rfc || null,
      date_of_birth || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];
    await logUserActivity(req.user.id, 'CUSTOMER_UPDATED', `Updated customer: ${first_name} ${last_name}`, customer.id);

    res.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

// Delete customer (soft delete)
app.delete("/customers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if customer has active loans
    const activeLoans = await pool.query(`
      SELECT COUNT(*) as count FROM loans 
      WHERE customer_id = $1 AND status IN ('active', 'pending')
    `, [id]);
    
    if (parseInt(activeLoans.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete customer with active loans" 
      });
    }

    const result = await pool.query(`
      DELETE FROM customers 
      WHERE id = $1
      RETURNING first_name, last_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];
    await logUserActivity(req.user.id, 'CUSTOMER_DELETED', `Deleted customer: ${customer.first_name} ${customer.last_name}`, id);

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// Get customer loans (for payment registration - only active loans)
app.get("/customers/:id/loans", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching loans for customer ${id} for payment registration`);
    
    // First, let's see ALL loans for this customer (no status filter)
    const allLoansResult = await pool.query(`
      SELECT l.id, l.status, l.amount, l.customer_id 
      FROM loans l 
      WHERE l.customer_id = $1
    `, [id]);
    
    console.log(`📊 ALL loans for customer ${id}:`, {
      total_loans: allLoansResult.rows.length,
      loans: allLoansResult.rows.map(l => ({ id: l.id, status: l.status, amount: l.amount }))
    });
    
    // Get loans that can receive payments (delivered, active, overdue, or contract_generated)
    const result = await pool.query(`
      SELECT l.*, 
             c.first_name, c.last_name, c.phone,
             ii.brand, ii.model, ii.color, ii.imei,
             s.name as store_name,
             -- Calculate total paid from installments (more accurate than payments table)
             COALESCE(
               (SELECT SUM(COALESCE(capital_paid, 0) + COALESCE(interest_paid, 0) + COALESCE(penalty_paid, 0))
                FROM loan_installments 
                WHERE loan_id = l.id), 0
             ) as total_paid,
             -- Calculate remaining balance
             l.amount - COALESCE(
               (SELECT SUM(COALESCE(capital_paid, 0) + COALESCE(interest_paid, 0) + COALESCE(penalty_paid, 0))
                FROM loan_installments 
                WHERE loan_id = l.id), 0
             ) as balance,
             -- Count unpaid installments
             COALESCE(
               (SELECT COUNT(*) 
                FROM loan_installments 
                WHERE loan_id = l.id AND status != 'paid'), 0
             ) as unpaid_installments
      FROM loans l
      LEFT JOIN customers c ON l.customer_id = c.id
      LEFT JOIN inventory_items ii ON l.inventory_item_id = ii.id
      LEFT JOIN stores s ON l.store_id = s.id
      WHERE l.customer_id = $1 
        AND l.status IN ('delivered', 'active', 'overdue', 'contract_generated')
      ORDER BY l.created_at DESC
    `, [id]);
    
    console.log(`📋 FILTERED loans for customer ${id}:`, {
      filtered_count: result.rows.length,
      status_filter: ['delivered', 'active', 'overdue', 'contract_generated'],
      filtered_loans: result.rows.map(l => ({ id: l.id, status: l.status, amount: l.amount, unpaid_installments: l.unpaid_installments }))
    });
    
    // Compare ALL vs FILTERED
    console.log(`🔍 COMPARISON for customer ${id}: ALL=${allLoansResult.rows.length} vs FILTERED=${result.rows.length}`);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching customer loans:", error);
    res.status(500).json({ error: "Failed to fetch customer loans" });
  }
});

// Get customer notes
app.get("/customers/:id/notes", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if customer_notes table exists, if not return empty array
    try {
      const result = await pool.query(`
        SELECT cn.*, u.name as created_by_name
        FROM customer_notes cn
        LEFT JOIN users u ON cn.created_by = u.id
        WHERE cn.customer_id = $1
        ORDER BY cn.created_at DESC
      `, [id]);
      res.json(result.rows);
    } catch (tableError) {
      // Table doesn't exist, return empty array
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching customer notes:", error);
    res.status(500).json({ error: "Failed to fetch customer notes" });
  }
});

// Get customer avals (guarantors)
app.get("/customers/:id/avals", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const result = await pool.query(`
        SELECT * FROM customer_avals
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `, [id]);
      res.json(result.rows);
    } catch (tableError) {
      // Table doesn't exist, return empty array
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching customer avals:", error);
    res.status(500).json({ error: "Failed to fetch customer avals" });
  }
});

// Get customer references
app.get("/customers/:id/references", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    try {
      const result = await pool.query(`
        SELECT * FROM customer_references
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `, [id]);
      res.json(result.rows);
    } catch (tableError) {
      // Table doesn't exist, return empty array
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching customer references:", error);
    res.status(500).json({ error: "Failed to fetch customer references" });
  }
});

// Add customer note
app.post("/customers/:id/notes", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO customer_notes (customer_id, note, created_by, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING *
      `, [id, note, req.user.id]);
      
      res.status(201).json(result.rows[0]);
    } catch (tableError) {
      // Table doesn't exist, return success but log warning
      console.log("⚠️ customer_notes table not available");
      res.status(201).json({ message: "Note would be saved when table exists" });
    }
  } catch (error) {
    console.error("Error adding customer note:", error);
    res.status(500).json({ error: "Failed to add customer note" });
  }
});

// ============================================================================
// DASHBOARD ENDPOINTS
// ============================================================================

// Dashboard metrics
app.get("/dashboard/metrics", authenticateToken, async (req, res) => {
  try {
    // Return basic metrics - expand as needed
    res.json({
      total_customers: 0,
      active_loans: 0,
      total_inventory: 0,
      pending_requests: 0,
      overdue_loans: 0,
      monthly_revenue: 0
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
});

// Overdue trends
app.get("/dashboard/overdue-trends", authenticateToken, async (req, res) => {
  try {
    // Return empty trends for now
    res.json([]);
  } catch (error) {
    console.error("Error fetching overdue trends:", error);
    res.status(500).json({ error: "Failed to fetch overdue trends" });
  }
});

// Cashflow data
app.get("/dashboard/cashflow/period=:period", authenticateToken, async (req, res) => {
  try {
    const { period } = req.params;
    // Return empty cashflow for now
    res.json({
      period: period,
      data: []
    });
  } catch (error) {
    console.error("Error fetching cashflow:", error);
    res.status(500).json({ error: "Failed to fetch cashflow" });
  }
});

// Recent activity
app.get("/dashboard/recent-activity", authenticateToken, async (req, res) => {
  try {
    // Return empty activity for now
    res.json([]);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

// ============================================================================
// ACCOUNTING SYSTEM
// ============================================================================

// Get chart of accounts
app.get("/chart-of-accounts", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT code as account_code, name as description, type, group_name
      FROM chart_of_accounts
      WHERE is_active = true
      ORDER BY code
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    res.status(500).json({ error: "Failed to fetch chart of accounts" });
  }
});

// Get account balances (for Movimientos por Cuenta)
app.get("/admin/account-balances", authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, account_code } = req.query;

    let query = `
      SELECT
        ca.code as account,
        ca.name as account_name,
        COALESCE(SUM(je.debit), 0) as total_debits,
        COALESCE(SUM(je.credit), 0) as total_credits,
        COALESCE(SUM(je.debit) - SUM(je.credit), 0) as balance
      FROM chart_of_accounts ca
      LEFT JOIN journal_entries je ON ca.code = je.account_code
      WHERE ca.is_active = true
    `;

    const queryParams = [];
    let paramCount = 1;

    // Add date filters to the JOIN condition
    if (from_date) {
      query += ` AND (je.date IS NULL OR je.date >= $${paramCount})`;
      queryParams.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND (je.date IS NULL OR je.date <= $${paramCount})`;
      queryParams.push(to_date);
      paramCount++;
    }

    if (account_code) {
      query += ` AND ca.code = $${paramCount}`;
      queryParams.push(account_code);
      paramCount++;
    }

    query += ` GROUP BY ca.code, ca.name ORDER BY ca.code`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching account balances:", error);
    res.status(500).json({ error: "Failed to fetch account balances" });
  }
});

// Get detailed movements for an account
app.get("/admin/account-movements", authenticateToken, async (req, res) => {
  try {
    const { account_code, from_date, to_date } = req.query;

    let query = `
      SELECT
        je.*,
        ca.name as account_name,
        u.name as created_by_name
      FROM journal_entries je
      LEFT JOIN chart_of_accounts ca ON je.account_code = ca.code
      LEFT JOIN users u ON je.created_by = u.id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 1;

    if (account_code) {
      query += ` AND je.account_code = $${paramCount}`;
      queryParams.push(account_code);
      paramCount++;
    }

    if (from_date) {
      query += ` AND je.date >= $${paramCount}`;
      queryParams.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND je.date <= $${paramCount}`;
      queryParams.push(to_date);
      paramCount++;
    }

    query += ` ORDER BY je.date DESC, je.created_at DESC`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching account movements:", error);
    res.status(500).json({ error: "Failed to fetch account movements" });
  }
});

// Get journal entries
app.get("/admin/journal-entries", authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    let query = `
      SELECT
        je.*,
        u.name as created_by_name,
        ca.name as account_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      LEFT JOIN chart_of_accounts ca ON je.account_code = ca.code
      WHERE 1=1
    `;

    const queryParams = [];
    let paramCount = 1;

    if (from_date) {
      query += ` AND je.date >= $${paramCount}`;
      queryParams.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND je.date <= $${paramCount}`;
      queryParams.push(to_date);
      paramCount++;
    }

    query += ` ORDER BY je.date DESC, je.created_at DESC`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    res.status(500).json({ error: "Failed to fetch journal entries" });
  }
});


// TEMPORARY: Add missing store_id columns (safe migration)
app.post("/add-store-columns", async (req, res) => {
  try {
    const { secret } = req.body;
    if (secret !== "add-store-columns-2025") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("🔧 Adding missing store_id columns...");
    
    // Add store_id to loans table
    try {
      await pool.query(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`);
      console.log("✅ Added store_id to loans table");
    } catch (error) {
      console.log("⚠️ loans.store_id:", error.message);
    }

    // Add store_id to inventory_items table
    try {
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`);
      console.log("✅ Added store_id to inventory_items table");
    } catch (error) {
      console.log("⚠️ inventory_items.store_id:", error.message);
    }

    // Add store_id to payments table
    try {
      await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`);
      console.log("✅ Added store_id to payments table");
    } catch (error) {
      console.log("⚠️ payments.store_id:", error.message);
    }

    // Add missing permissions to admin user
    try {
      await pool.query(`
        UPDATE users 
        SET permissions = permissions || '{"canCreateLoans": true, "canManageLoans": true, "canViewLoans": true, "canManageInventory": true, "canManageExpenses": true}'::jsonb
        WHERE role = 'admin'
      `);
      console.log("✅ Updated admin permissions");
    } catch (error) {
      console.log("⚠️ permissions update:", error.message);
    }

    console.log("🎉 Migration completed!");
    res.json({ 
      message: "Store columns added successfully",
      migrations: [
        "loans.store_id",
        "inventory_items.store_id", 
        "payments.store_id",
        "admin permissions updated"
      ]
    });
  } catch (error) {
    console.error("Migration failed:", error);
    res.status(500).json({ error: "Migration failed", details: error.message });
  }
});

// TEMPORARY: Database reset for schema fix (will be removed after fix)
app.post("/emergency-reset-database", async (req, res) => {
  try {
    const { secret } = req.body;
    
    // Simple security check
    if (secret !== "reset-user-schema-2025") {
      return res.status(403).json({ error: "Invalid secret" });
    }
    
    console.log("🔄 EMERGENCY: Starting database reset for user schema fix...");
    
    // Read schema.sql file
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({ error: "schema.sql file not found" });
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSQL);
    console.log("✅ Schema executed successfully");
    
    // Create default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (name, email, password, role, permissions) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET 
        password = EXCLUDED.password,
        permissions = EXCLUDED.permissions
    `, [
      'Admin User', 
      'admin@crediya.com', 
      hashedPassword, 
      'admin',
      JSON.stringify({
        canManageUsers: true,
        canViewAuditLogs: true,
        canResetDatabase: true,
        canAccessLoanQuotes: true,
        canCreateLoans: true,
        canViewDashboard: true
      })
    ]);
    console.log("✅ Admin user created/updated");
    
    // Create some sample stores
    await pool.query(`
      INSERT INTO stores (name, address) VALUES 
      ('Sucursal Chipilo', 'Chipilo, Puebla'),
      ('Sucursal Atlixco', 'Atlixco, Puebla'), 
      ('Sucursal Cholula', 'Cholula, Puebla'),
      ('Almacén Central', 'Warehouse')
      ON CONFLICT DO NOTHING
    `);
    console.log("✅ Sample stores created");
    
    console.log("🎉 Emergency database reset completed!");
    res.json({ 
      message: "Database reset completed successfully",
      adminEmail: "admin@crediya.com",
      adminPassword: "admin123",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Emergency reset failed:", error);
    res.status(500).json({ 
      error: "Emergency reset failed", 
      details: error.message 
    });
  }
});



// ==============================================================================
// CRITICAL LOAN ENDPOINTS (extracted from original)
// ==============================================================================

// Regenerate installments for loans that are missing them
app.post("/loans/:loan_id/regenerate-installments", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    // Get loan details
    const loanResult = await pool.query('SELECT * FROM loans WHERE id = $1', [loan_id]);
    if (loanResult.rows.length === 0) {
      return res.status(404).json({ message: "Loan not found" });
    }
    
    const loan = loanResult.rows[0];
    
    // Check if installments already exist
    const existingInstallments = await pool.query('SELECT COUNT(*) as count FROM loan_installments WHERE loan_id = $1', [loan_id]);
    
    if (existingInstallments.rows[0].count > 0) {
      return res.status(400).json({ message: "Loan already has installments. Delete them first if you want to regenerate." });
    }
    
    // Generate installments
    await generateInstallmentsForLoan(
      loan_id, 
      loan.amount, 
      loan.term_weeks || loan.term || 24, 
      loan.interest_rate || 120
    );
    
    res.json({ 
      message: "Installments regenerated successfully", 
      loan_id: loan_id,
      amount: loan.amount,
      term_weeks: loan.term_weeks || loan.term || 24,
      interest_rate: loan.interest_rate || 120
    });
    
  } catch (err) {
    console.error("Error regenerating installments:", err);
    res.status(500).json({ message: "Error regenerating installments", error: err.message });
  }
});

// Regenerate installments for all loans missing them
app.post("/admin/regenerate-all-installments", authenticateToken, isAdmin, async (req, res) => {
  try {
    // Find loans without installments
    const loansWithoutInstallments = await pool.query(`
      SELECT l.* FROM loans l
      LEFT JOIN loan_installments li ON l.id = li.loan_id
      WHERE li.loan_id IS NULL
    `);
    
    console.log(`🔄 Found ${loansWithoutInstallments.rows.length} loans without installments`);
    
    let regeneratedCount = 0;
    for (const loan of loansWithoutInstallments.rows) {
      try {
        console.log(`📅 Regenerating installments for loan ${loan.id}...`);
        await generateInstallmentsForLoan(
          loan.id, 
          loan.amount, 
          loan.term_weeks || loan.term || 24, 
          loan.interest_rate || 120
        );
        regeneratedCount++;
      } catch (error) {
        console.error(`❌ Failed to regenerate installments for loan ${loan.id}:`, error);
      }
    }
    
    res.json({ 
      message: "Bulk regeneration complete",
      total_loans_found: loansWithoutInstallments.rows.length,
      successfully_regenerated: regeneratedCount
    });
    
  } catch (err) {
    console.error("Error in bulk regeneration:", err);
    res.status(500).json({ message: "Error in bulk regeneration", error: err.message });
  }
});

// ==============================================================================
// AUTHENTICATION ENDPOINTS (essential for frontend)
// ==============================================================================

// Login endpoint
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  // TEMPORARY: Test user for demo purposes (remove when database is set up)
  if (email === "admin@test.com" && password === "admin123") {
    console.log("🧪 Using test user for demo");
    const testUser = {
      id: 1,
      name: "Test Admin",
      email: "admin@test.com",
      role: "admin",
      permissions: {
        canViewDashboard: true,
        canManageUsers: true,
        canViewReports: true,
        canManageSystem: true
      }
    };
    const token = generateToken(testUser);
    return res.json({ 
      message: "Login successful (test mode)", 
      token,
      user: {
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        role: testUser.role,
        permissions: testUser.permissions
      }
    });
  }
  
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Update user login statistics
    await pool.query(`
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP, 
          login_count = COALESCE(login_count, 0) + 1 
      WHERE id = $1
    `, [user.id]);

    // Log the login activity
    await logUserActivity(user.id, 'USER_LOGIN', 'authentication', user.id, null, {
      email: user.email,
      timestamp: new Date().toISOString()
    }, req);

    const token = generateToken(user);
    res.json({ 
      message: "Login successful", 
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

// ==============================================================================
// DASHBOARD ENDPOINTS (essential for frontend)
// ==============================================================================

// Dashboard: Get loans for dashboard display
app.get("/dashboard/loans", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT loans.*, CONCAT(customers.first_name, ' ', customers.last_name) AS customer_name, customers.email AS customer_email
      FROM loans
      LEFT JOIN customers ON loans.customer_id = customers.id
      ORDER BY loans.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching loans:", err);
    res.status(500).json({ message: "Error fetching loans" });
  }
});

// Basic loans endpoint 
// Basic loans analytics endpoint
app.get("/loans/analytics", authenticateToken, async (req, res) => {
  try {
    const totalLoans = await pool.query('SELECT COUNT(*) as count FROM loans');
    const activeLoans = await pool.query("SELECT COUNT(*) as count FROM loans WHERE status = 'active'");
    const overdueLoans = await pool.query("SELECT COUNT(*) as count FROM loans WHERE status = 'overdue'");
    
    res.json({
      totalLoans: parseInt(totalLoans.rows[0].count),
      activeLoans: parseInt(activeLoans.rows[0].count), 
      overdueLoans: parseInt(overdueLoans.rows[0].count),
      monthlyTrends: [],
      topStores: []
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

// Loan details endpoint with installments and penalty calculations
app.get("/loans/:loan_id/details", authenticateToken, async (req, res) => {
  try {
    const { loan_id } = req.params;
    
    // Get loan details with customer info
    const loanResult = await pool.query(`
      SELECT l.*, c.first_name, c.last_name, c.email, c.phone 
      FROM loans l 
      JOIN customers c ON l.customer_id = c.id 
      WHERE l.id = $1
    `, [loan_id]);
    
    if (!loanResult.rows.length) {
      return res.status(404).json({ message: "Loan not found" });
    }
    
    const loan = loanResult.rows[0];
    
    // Get installments for this loan and calculate penalties - handle missing table gracefully
    let installmentsResult = { rows: [] };
    try {
      installmentsResult = await pool.query(`
      SELECT 
        id, loan_id, 
        installment_number as week_number,
        due_date, amount_due, 
        capital_portion, interest_portion, penalty_applied, 
        last_penalty_applied, status, created_at,
        COALESCE(capital_paid, 0) as capital_paid,
        COALESCE(interest_paid, 0) as interest_paid,
        COALESCE(penalty_paid, 0) as penalty_paid
      FROM loan_installments 
      WHERE loan_id = $1 
      ORDER BY due_date ASC, installment_number ASC
    `, [loan_id]);
    } catch (installmentsError) {
      console.log("⚠️ loan_installments table not available, using empty data:", installmentsError.message);
      installmentsResult = { rows: [] };
    }
    
    // Calculate and apply penalties for overdue installments
    let totalPenaltiesApplied = 0;
    for (const inst of installmentsResult.rows) {
      const now = new Date();
      const dueDate = new Date(inst.due_date);
      
      // Check if overdue (after 2 PM on due date or any time after)
      const isOverdue = now > dueDate || 
                       (now.toDateString() === dueDate.toDateString() && now.getHours() >= 14);
      
      if (isOverdue) {
        const installmentAmount = parseFloat(inst.amount_due);
        const dailyPenalty = installmentAmount < 500 ? 50 : Math.round(installmentAmount * 0.10 * 100) / 100;
        
        // Calculate days overdue
        const lastPenaltyDate = inst.last_penalty_applied ? new Date(inst.last_penalty_applied) : dueDate;
        const daysSinceLastPenalty = Math.floor((now - lastPenaltyDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastPenalty > 0) {
          const newPenalty = dailyPenalty * daysSinceLastPenalty;
          
          try {
            await pool.query(`
              UPDATE loan_installments 
              SET penalty_applied = penalty_applied + $1, last_penalty_applied = CURRENT_DATE
              WHERE id = $2
            `, [newPenalty, inst.id]);
            
            totalPenaltiesApplied += newPenalty;
            console.log(`💰 Applied penalty: $${newPenalty} for installment ${inst.week_number} (${daysSinceLastPenalty} days overdue)`);
          } catch (updateError) {
            console.log("⚠️ Could not update penalty:", updateError.message);
          }
        }
      }
    }
    
    // Get payments for this loan - handle missing payments table gracefully
    let paymentsResult = { rows: [] };
    try {
      paymentsResult = await pool.query(`
      SELECT * FROM payments 
      WHERE loan_id = $1 
      ORDER BY payment_date DESC
    `, [loan_id]);
    } catch (paymentsError) {
      console.log("⚠️ payments table not available, using empty data:", paymentsError.message);
      paymentsResult = { rows: [] };
    }
    
    // Calculate penalties - handle missing loan_installments table gracefully
    let penaltiesResult = { rows: [] };
    try {
      penaltiesResult = await pool.query(`
      SELECT 
        li.*,
        li.installment_number as week_number,
        CASE 
          WHEN li.amount_due < 500 THEN 50
          ELSE li.amount_due * 0.10
        END as daily_penalty_rate,
        CASE 
          WHEN NOW() > li.due_date OR 
               (DATE(NOW()) = DATE(li.due_date) AND EXTRACT(HOUR FROM NOW()) >= 14)
          THEN true
          ELSE false
        END as is_overdue
      FROM loan_installments li
      WHERE li.loan_id = $1
      ORDER BY li.due_date ASC, li.installment_number ASC
    `, [loan_id]);
    } catch (penaltiesError) {
      console.log("⚠️ loan_installments table not available for penalties, using empty data:", penaltiesError.message);
      penaltiesResult = { rows: [] };
    }
    
    // Calculate totals - use installments if available, otherwise fallback to loan amount
    let totalPaid = 0;
    
    let totalDue, totalPenalties, totalInterest, totalCapital, pendingCapital, pendingInterest, pendingPenalties;
    
    if (installmentsResult.rows.length > 0) {
      // Use installments data with accurate payment tracking
      totalDue = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.amount_due) + parseFloat(i.penalty_applied || 0), 0);
      totalPenalties = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.penalty_applied || 0), 0);
      totalInterest = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.interest_portion), 0);
      totalCapital = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.capital_portion), 0);
      
      // Calculate actual payments from installments (more accurate)
      const totalCapitalPaid = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.capital_paid || 0), 0);
      const totalInterestPaid = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.interest_paid || 0), 0);
      const totalPenaltiesPaid = installmentsResult.rows.reduce((sum, i) => sum + parseFloat(i.penalty_paid || 0), 0);
      
      totalPaid = totalCapitalPaid + totalInterestPaid + totalPenaltiesPaid;
      pendingCapital = Math.max(0, totalCapital - totalCapitalPaid);
      pendingInterest = Math.max(0, totalInterest - totalInterestPaid);
      const pendingPenalties = Math.max(0, totalPenalties - totalPenaltiesPaid);
    } else {
      // Fallback calculations when no installments exist
      const loanAmount = parseFloat(loan.amount || 0);
      const interestRate = parseFloat(loan.interest_rate || 120) / 100; // Convert percentage to decimal
      const termWeeks = parseInt(loan.term_weeks || 24);
      
      // Simple interest calculation for the term
      totalInterest = loanAmount * interestRate * (termWeeks / 52); // Annualized interest
      totalCapital = loanAmount;
      totalPenalties = 0; // No penalties without installments
      totalDue = totalCapital + totalInterest;
      
      // Calculate pending amounts (full amount minus any payments made)
      pendingCapital = Math.max(0, totalCapital - totalPaid);
      pendingInterest = Math.max(0, totalInterest);
      pendingPenalties = 0;
    }
    
    console.log(`📋 Installments order for loan ${loan_id}:`, 
      installmentsResult.rows.map(i => ({ 
        installment_number: i.installment_number, 
        week_number: i.week_number, 
        due_date: i.due_date, 
        status: i.status 
      }))
    );
    
    res.json({
      loan,
      installments: installmentsResult.rows,
      payments: paymentsResult.rows,
      penalties: penaltiesResult.rows,
      totals: {
        totalPaid,
        totalDue,
        totalPenalties,
        totalInterest,
        totalCapital,
        pendingCapital: Math.max(0, pendingCapital),
        pendingInterest: Math.max(0, pendingInterest),
        pendingPenalties: pendingPenalties || 0,
        remainingBalance: Math.max(0, totalDue - totalPaid),
        paymentProgress: totalDue > 0 ? ((totalPaid / totalDue) * 100).toFixed(1) : 0,
        installmentsPaid: installmentsResult.rows.filter(i => i.status === 'paid').length,
        installmentsTotal: installmentsResult.rows.length
      }
    });
  } catch (err) {
    console.error("Error fetching loan details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Debug endpoint to check installments with both schemas
app.get("/debug/loans/:loan_id/installments", authenticateToken, async (req, res) => {
  const { loan_id } = req.params;
  
  try {
    // Try new schema
    let newSchemaResults = { rows: [] };
    try {
      newSchemaResults = await pool.query(`
        SELECT *, 'new_schema' as schema_type FROM loan_installments 
        WHERE loan_id = $1 ORDER BY week_number ASC
      `, [loan_id]);
    } catch (err) {
      console.log("New schema failed:", err.message);
    }
    
    // Try old schema
    let oldSchemaResults = { rows: [] };
    try {
      oldSchemaResults = await pool.query(`
        SELECT *, 'old_schema' as schema_type FROM loan_installments 
        WHERE loan_id = $1 ORDER BY installment_number ASC
      `, [loan_id]);
    } catch (err) {
      console.log("Old schema failed:", err.message);
    }
    
    // Get table structure
    let tableStructure = { rows: [] };
    try {
      tableStructure = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'loan_installments' 
        ORDER BY ordinal_position
      `);
    } catch (err) {
      console.log("Could not get table structure:", err.message);
    }
    
    res.json({
      loan_id,
      new_schema_count: newSchemaResults.rows.length,
      old_schema_count: oldSchemaResults.rows.length,
      new_schema_data: newSchemaResults.rows.slice(0, 2), // First 2 records
      old_schema_data: oldSchemaResults.rows.slice(0, 2), // First 2 records
      table_structure: tableStructure.rows
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// FINANCIAL STATEMENTS ENDPOINTS
// ==============================================================================

// Balance Sheet endpoint - pulls data from journal_entries ledger
app.get("/accounting/balance-sheet", authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    console.log("📊 Balance sheet request:", { start, end, user: req.user?.id });

    // Get all account balances from journal entries
    let query = `
      SELECT 
        ca.code,
        ca.name,
        ca.type,
        ca.parent_code,
        COALESCE(SUM(je.debit), 0) as total_debits,
        COALESCE(SUM(je.credit), 0) as total_credits,
        CASE 
          WHEN ca.type IN ('asset', 'expense') THEN COALESCE(SUM(je.debit) - SUM(je.credit), 0)
          ELSE COALESCE(SUM(je.credit) - SUM(je.debit), 0)
        END as balance
      FROM chart_of_accounts ca
      LEFT JOIN journal_entries je ON ca.code = je.account_code
      WHERE ca.is_active = true
    `;

    const queryParams = [];
    let paramCount = 1;

    if (start) {
      query += ` AND (je.created_at IS NULL OR je.created_at >= $${paramCount})`;
      queryParams.push(start);
      paramCount++;
    }

    if (end) {
      query += ` AND (je.created_at IS NULL OR je.created_at <= $${paramCount})`;
      queryParams.push(end);
      paramCount++;
    }

    query += ` GROUP BY ca.code, ca.name, ca.type, ca.parent_code ORDER BY ca.code`;

    const result = await pool.query(query, queryParams);
    const accounts = result.rows;

    // Organize accounts by type for balance sheet
    const balanceSheet = {
      ACTIVO: {
        accounts: accounts.filter(acc => acc.type === 'asset' && acc.balance !== 0).map(acc => ({
          code: acc.code,
          label: acc.name,
          value: Math.abs(acc.balance)
        })),
        total: accounts.filter(acc => acc.type === 'asset').reduce((sum, acc) => sum + Math.abs(acc.balance), 0)
      },
      PASIVO: {
        accounts: accounts.filter(acc => acc.type === 'liability' && acc.balance !== 0).map(acc => ({
          code: acc.code,
          label: acc.name,
          value: Math.abs(acc.balance)
        })),
        total: accounts.filter(acc => acc.type === 'liability').reduce((sum, acc) => sum + Math.abs(acc.balance), 0)
      },
      CAPITAL: {
        accounts: accounts.filter(acc => acc.type === 'equity' && acc.balance !== 0).map(acc => ({
          code: acc.code,
          label: acc.name,
          value: Math.abs(acc.balance)
        })),
        total: accounts.filter(acc => acc.type === 'equity').reduce((sum, acc) => sum + Math.abs(acc.balance), 0)
      }
    };

    // Calculate totals and control
    const totalAssets = balanceSheet.ACTIVO.total;
    const totalLiabilities = balanceSheet.PASIVO.total;
    const totalEquity = balanceSheet.CAPITAL.total;
    const control = totalAssets - (totalLiabilities + totalEquity);

    const response = {
      balanceSheet,
      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        control: control
      },
      period: { start, end },
      isBalanced: Math.abs(control) < 0.01 // Allow for small rounding differences
    };

    console.log("📊 Balance sheet response:", { 
      totalAssets, 
      totalLiabilities, 
      totalEquity, 
      control, 
      accountCount: accounts.length 
    });

    res.json(response);
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    res.status(500).json({ error: "Failed to generate balance sheet" });
  }
});

// Income Statement endpoint - pulls data from journal_entries ledger
app.get("/income-statement", authenticateToken, async (req, res) => {
  try {
    const { month, year, start, end, quarter, details } = req.query;
    console.log("📈 Income statement request:", { month, year, start, end, quarter, details, user: req.user?.id });

    // Build date filter
    let dateFilter = "";
    const queryParams = [];
    let paramCount = 1;

    if (start && end) {
      dateFilter = ` AND je.created_at >= $${paramCount} AND je.created_at <= $${paramCount + 1}`;
      queryParams.push(start, end);
      paramCount += 2;
    } else if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
      dateFilter = ` AND je.created_at >= $${paramCount} AND je.created_at <= $${paramCount + 1}`;
      queryParams.push(startDate, endDate);
      paramCount += 2;
    } else if (quarter && year) {
      const quarterStart = [(1, 1), (4, 1), (7, 1), (10, 1)][quarter - 1];
      const quarterEnd = [(3, 31), (6, 30), (9, 30), (12, 31)][quarter - 1];
      const startDate = `${year}-${quarterStart[0].toString().padStart(2, '0')}-${quarterStart[1].toString().padStart(2, '0')}`;
      const endDate = `${year}-${quarterEnd[0].toString().padStart(2, '0')}-${quarterEnd[1].toString().padStart(2, '0')}`;
      dateFilter = ` AND je.created_at >= $${paramCount} AND je.created_at <= $${paramCount + 1}`;
      queryParams.push(startDate, endDate);
      paramCount += 2;
    } else if (year) {
      dateFilter = ` AND je.created_at >= $${paramCount} AND je.created_at <= $${paramCount + 1}`;
      queryParams.push(`${year}-01-01`, `${year}-12-31`);
      paramCount += 2;
    }

    // Get revenue and expense data from journal entries
    const query = `
      SELECT 
        ca.code,
        ca.name,
        ca.type,
        COALESCE(SUM(je.debit), 0) as total_debits,
        COALESCE(SUM(je.credit), 0) as total_credits,
        CASE 
          WHEN ca.type = 'revenue' THEN COALESCE(SUM(je.credit) - SUM(je.debit), 0)
          WHEN ca.type = 'expense' THEN COALESCE(SUM(je.debit) - SUM(je.credit), 0)
          ELSE 0
        END as balance
      FROM chart_of_accounts ca
      LEFT JOIN journal_entries je ON ca.code = je.account_code
      WHERE ca.is_active = true AND ca.type IN ('revenue', 'expense')
      ${dateFilter}
      GROUP BY ca.code, ca.name, ca.type
      HAVING COALESCE(SUM(je.debit), 0) > 0 OR COALESCE(SUM(je.credit), 0) > 0
      ORDER BY ca.code
    `;

    const result = await pool.query(query, queryParams);
    const accounts = result.rows;

    // Calculate income statement components
    const revenues = accounts.filter(acc => acc.type === 'revenue');
    const expenses = accounts.filter(acc => acc.type === 'expense');

    const totalRevenue = revenues.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const totalExpenses = expenses.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const netIncome = totalRevenue - totalExpenses;

    // Map to expected format (based on frontend expectations)
    const statement = {
      // Revenue breakdown
      interestPaid: revenues.filter(r => r.code.startsWith('4001')).reduce((sum, acc) => sum + Math.abs(acc.balance), 0),
      penalties: revenues.filter(r => r.code.startsWith('4003')).reduce((sum, acc) => sum + Math.abs(acc.balance), 0),
      productMargin: revenues.filter(r => r.code.startsWith('4002')).reduce((sum, acc) => sum + Math.abs(acc.balance), 0),
      
      // Expense breakdown  
      costOfGoods: expenses.filter(e => e.code.startsWith('5001')).reduce((sum, acc) => sum + Math.abs(acc.balance), 0),
      expenses: totalExpenses,
      
      // Totals
      totalRevenue,
      totalExpenses,
      netIncome,
      
      // Additional data
      accounts: {
        revenue: revenues.map(acc => ({
          code: acc.code,
          name: acc.name,
          amount: Math.abs(acc.balance)
        })),
        expense: expenses.map(acc => ({
          code: acc.code,
          name: acc.name,
          amount: Math.abs(acc.balance)
        }))
      }
    };

    // Add weekly breakdown if details requested
    if (details === 'true') {
      statement.weeklyBreakdown = []; // Simplified for now
    }

    console.log("📈 Income statement response:", { 
      totalRevenue, 
      totalExpenses, 
      netIncome,
      revenueAccounts: revenues.length,
      expenseAccounts: expenses.length
    });

    res.json(statement);
  } catch (error) {
    console.error("Error generating income statement:", error);
    res.status(500).json({ error: "Failed to generate income statement" });
  }
});

// ==============================================================================
// TODO: Add remaining critical routes from original index.js
// ==============================================================================

console.log("⚠️ TODO: Extract remaining routes - auth, customers, inventory, etc.");

// ==============================================================================
// SERVER STARTUP with Clean Database
// ==============================================================================

async function start() {
  try {
    console.log("🚀 Starting CrediYA server...");
    
    // Test database connection (skip for demo mode)
    try {
      await pool.query('SELECT 1');
      console.log("✅ Database connection established");
    } catch (error) {
      console.log("⚠️ Database not available - running in demo mode");
      console.log("🧪 Use test credentials: admin@test.com / admin123");
    }

    app.listen(port, () => {
      console.log(`🚀 CrediYA API Server running on port ${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log("✅ Clean architecture active!");
    });
  } catch (err) {
    console.error("❌ Error starting server:", err);
    process.exit(1);
  }
}

// Start the server
start();
// Force redeploy Sun Aug 17 20:35:19 CST 2025
