const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
require('dotenv').config();

// Create admin user script
async function createAdminUser() {
  const pool = process.env.DATABASE_URL 
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      })
    : new Pool({
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "crediya",
        password: process.env.DB_PASSWORD || "",
        port: process.env.DB_PORT || 5432,
      });

  const adminUser = {
    name: "Admin",
    email: "admin@zionx.com",
    password: "zionx2024",
    role: "admin"
  };

  try {
    // Check if user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [adminUser.email]);
    if (existing.rows.length > 0) {
      console.log("⚠️ Admin user already exists!");
      console.log("📧 Email:", adminUser.email);
      console.log("🔑 Password:", adminUser.password);
      await pool.end();
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);

    // Insert user
    const result = await pool.query(`
      INSERT INTO users (name, email, password, role, is_active) 
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, name, email, role
    `, [adminUser.name, adminUser.email, hashedPassword, adminUser.role]);

    console.log("✅ Admin user created successfully!");
    console.log("========================");
    console.log("📧 Email:", adminUser.email);
    console.log("🔑 Password:", adminUser.password);
    console.log("👤 Role:", adminUser.role);
    console.log("🆔 User ID:", result.rows[0].id);
    console.log("========================");
    console.log("\n🚀 You can now login with these credentials!");

    await pool.end();
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
    await pool.end();
    process.exit(1);
  }
}

createAdminUser();
