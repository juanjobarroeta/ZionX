const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createProductionAdmin() {
  console.log("🚀 ZIONX Marketing - Production Admin Creator");
  console.log("==============================================\n");

  // Get DATABASE_URL from command line or prompt
  let DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.log("⚠️  DATABASE_URL not found in environment.");
    console.log("📝 Please get your Railway DATABASE_URL from:");
    console.log("   Railway Dashboard > Your Project > PostgreSQL > Connect > DATABASE_URL\n");
    DATABASE_URL = await question("Paste your DATABASE_URL here: ");
  }

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is required!");
    process.exit(1);
  }

  // Prompt for admin details
  console.log("\n👤 Enter admin user details:\n");
  
  const name = await question("Full Name (default: Admin): ") || "Admin";
  const email = await question("Email (default: admin@zionx.com): ") || "admin@zionx.com";
  const password = await question("Password (default: zionx2024): ") || "zionx2024";

  console.log("\n🔄 Creating admin user in production database...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if user already exists
    const existing = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log("⚠️  User with this email already exists!");
      console.log("📋 User Details:");
      console.log("   ID:", existing.rows[0].id);
      console.log("   Name:", existing.rows[0].name);
      console.log("   Email:", existing.rows[0].email);
      console.log("   Role:", existing.rows[0].role);
      console.log("\n");
      
      const update = await question("Do you want to update this user to admin? (yes/no): ");
      
      if (update.toLowerCase() === 'yes' || update.toLowerCase() === 'y') {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Get admin permissions
        const permissionsResult = await pool.query(
          "SELECT permissions FROM permission_templates WHERE name = 'admin'"
        );
        const adminPermissions = permissionsResult.rows.length > 0 
          ? permissionsResult.rows[0].permissions 
          : {};

        await pool.query(
          `UPDATE users 
           SET name = $1, password = $2, role = 'admin', 
               is_active = true, permissions = $3 
           WHERE email = $4`,
          [name, hashedPassword, adminPermissions, email]
        );

        console.log("\n✅ User updated to admin successfully!");
      } else {
        console.log("❌ Operation cancelled.");
      }
      
      await pool.end();
      rl.close();
      return;
    }

    // Get admin permissions from template
    const permissionsResult = await pool.query(
      "SELECT permissions FROM permission_templates WHERE name = 'admin'"
    );
    const adminPermissions = permissionsResult.rows.length > 0 
      ? permissionsResult.rows[0].permissions 
      : {};

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert admin user
    const result = await pool.query(`
      INSERT INTO users (name, email, password, role, is_active, permissions) 
      VALUES ($1, $2, $3, 'admin', true, $4)
      RETURNING id, name, email, role, created_at
    `, [name, email, hashedPassword, adminPermissions]);

    console.log("✅ Production admin user created successfully!");
    console.log("==============================================");
    console.log("👤 Name:", name);
    console.log("📧 Email:", email);
    console.log("🔑 Password:", password);
    console.log("🎭 Role: admin");
    console.log("🆔 User ID:", result.rows[0].id);
    console.log("📅 Created:", result.rows[0].created_at);
    console.log("==============================================");
    console.log("\n🌐 You can now login at: https://zionx-marketing.vercel.app/");
    console.log("🚀 Use these credentials to access the system!\n");

    await pool.end();
  } catch (error) {
    console.error("❌ Error creating admin user:", error.message);
    if (error.code) {
      console.error("Error Code:", error.code);
    }
    if (error.detail) {
      console.error("Details:", error.detail);
    }
    await pool.end();
    process.exit(1);
  }
  
  rl.close();
}

createProductionAdmin();
