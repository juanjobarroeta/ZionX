const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "crediya",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT || 5432,
});

async function seedData() {
  try {
    console.log("🌱 Starting database seeding...");

    // Add sample customers
    const customer1 = await pool.query(`
      INSERT INTO customers (first_name, last_name, email, phone, address) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ["Juan", "Pérez", "juan@example.com", "1234567890", "Calle Principal 123"]);

    const customer2 = await pool.query(`
      INSERT INTO customers (first_name, last_name, email, phone, address) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ["María", "García", "maria@example.com", "0987654321", "Avenida Central 456"]);

    console.log("✅ Added sample customers");

    // Add sample loans
    const loan1 = await pool.query(`
      INSERT INTO loans (customer_id, total_amount, term_weeks, interest_rate, status) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [customer1.rows[0].id, 5000, 12, 0.05, "activo"]);

    const loan2 = await pool.query(`
      INSERT INTO loans (customer_id, total_amount, term_weeks, interest_rate, status) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [customer2.rows[0].id, 3000, 8, 0.05, "activo"]);

    console.log("✅ Added sample loans");

    // Add sample payments
    await pool.query(`
      INSERT INTO payments (loan_id, amount, payment_date) 
      VALUES ($1, $2, $3)
    `, [loan1.rows[0].id, 500, new Date()]);

    await pool.query(`
      INSERT INTO payments (loan_id, amount, payment_date) 
      VALUES ($1, $2, $3)
    `, [loan2.rows[0].id, 300, new Date()]);

    console.log("✅ Added sample payments");

    // Add sample stores
    await pool.query(`
      INSERT INTO stores (name, address, phone) 
      VALUES ($1, $2, $3)
    `, ["Atlixco", "Calle Principal 123", "1234567890"]);

    await pool.query(`
      INSERT INTO stores (name, address, phone) 
      VALUES ($1, $2, $3)
    `, ["Cholula", "Avenida Central 456", "0987654321"]);

    console.log("✅ Added sample stores");

    // Add sample financial products
    await pool.query(`
      INSERT INTO financial_products (name, interest_rate, term_weeks, min_amount, max_amount) 
      VALUES ($1, $2, $3, $4, $5)
    `, ["Préstamo Personal", 0.05, 12, 1000, 10000]);

    await pool.query(`
      INSERT INTO financial_products (name, interest_rate, term_weeks, min_amount, max_amount) 
      VALUES ($1, $2, $3, $4, $5)
    `, ["Préstamo Rápido", 0.08, 4, 500, 3000]);

    console.log("✅ Added sample financial products");

    console.log("🎉 Database seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
}

seedData(); 