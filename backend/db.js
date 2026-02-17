const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Fallback for local development if DATABASE_URL is not set
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "lab_material_db"
});

// Handle connection errors
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle client:", err);
});

pool.on("connect", () => {
  console.log("✅ Client connected to database");
});

// Test the connection
pool.query("SELECT NOW()", (err, result) => {
  if (err) {
    console.error("❌ Database connection failed:");
    console.error(`   - Host: ${process.env.DB_HOST || "localhost"}`);
    console.error(`   - Port: ${process.env.DB_PORT || 5432}`);
    console.error(`   - User: ${process.env.DB_USER || "postgres"}`);
    console.error(`   - Database: ${process.env.DB_NAME || "lab_material_db"}`);
    console.error(`   - Error Code: ${err.code}`);
    console.error(`   - Error Message: ${err.message}`);

    if (err.message.includes("password authentication failed")) {
      console.error("👉 CAUSE: Incorrect password for user '" + (process.env.DB_USER || "postgres") + "'");
      console.error("👉 ACTION: Update DB_PASSWORD in backend/.env file");
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      console.error("👉 CAUSE: Database server is not running or unreachable");
      console.error("👉 ACTION: Start your PostgreSQL server (e.g., pg_ctl start or check services)");
    }
  } else {
    console.log("✅ Database connection successful");
    console.log("✅ Database connection pool initialized");
  }
});

module.exports = pool;