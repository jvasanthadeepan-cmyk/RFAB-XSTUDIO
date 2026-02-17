const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Create connection pool
// Create connection pool
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
};

// If DATABASE_URL is not set, use individual env vars
if (!process.env.DATABASE_URL) {
  dbConfig.user = process.env.DB_USER || "postgres";
  dbConfig.password = process.env.DB_PASSWORD || "password";
  dbConfig.host = process.env.DB_HOST || "localhost";
  dbConfig.port = process.env.DB_PORT || 5432;
  dbConfig.database = process.env.DB_NAME || "lab_material_db";
}

const pool = new Pool(dbConfig);

// Log connection details (masking password) for debugging
const maskedConnectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')
  : 'Not set';

console.log("🔌 Database Configuration:");
console.log(`   - Connection String: ${maskedConnectionString}`);
if (!process.env.DATABASE_URL) {
  console.log(`   - Host: ${dbConfig.host}`);
  console.log(`   - Database: ${dbConfig.database}`);
  console.log(`   - User: ${dbConfig.user}`);
}

// Check for placeholder values
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("hostname")) {
  console.error("\n❌ CRITICAL ERROR: DATABASE_URL appears to contain a placeholder value ('hostname')!");
  console.error("👉 You likely copied the example string. Please go to Render Dashboard -> Environment and update DATABASE_URL with the ACTUAL connection string from your database.\n");
}

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
    console.error("❌ Database connection failed:", err.message);
    console.error("Make sure:");
    console.error("  1. PostgreSQL is running");
    console.error("  2. Database 'lab_material_db' exists");
    console.error("  3. .env file has correct credentials");
  } else {
    console.log("✅ Database connection successful");
    console.log("✅ Database connection pool initialized");
  }
});

module.exports = pool;