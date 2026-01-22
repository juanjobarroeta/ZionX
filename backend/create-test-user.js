const bcrypt = require("bcryptjs");

// Simple test user creation script
// This will show you the hashed password to manually insert into a database later

async function createTestUser() {
  const testUser = {
    name: "Test Admin",
    email: "admin@test.com",
    password: "admin123",
    role: "admin"
  };

  // Hash the password
  const hashedPassword = await bcrypt.hash(testUser.password, 10);

  console.log("🔐 Test User Credentials:");
  console.log("========================");
  console.log("Email:", testUser.email);
  console.log("Password:", testUser.password);
  console.log("Role:", testUser.role);
  console.log("\n📝 Database Insert SQL:");
  console.log("========================");
  console.log(`INSERT INTO users (name, email, password, role, is_active) VALUES ('${testUser.name}', '${testUser.email}', '${hashedPassword}', '${testUser.role}', true);`);
  
  console.log("\n🎯 For quick testing without database:");
  console.log("=====================================");
  console.log("You can modify the backend to accept these hardcoded credentials temporarily.");
}

createTestUser().catch(console.error);
