const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function setupDatabase() {
    console.log('🔄 Checking database initialization...');

    try {
        const sqlPath = path.join(__dirname, 'tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute the SQL script
        // Note: tables.sql uses ON CONFLICT DO NOTHING for inserts, so it's safe to run multiple times
        await pool.query(sql);

        console.log('✅ Database initialization completed');
    } catch (err) {
        console.error('❌ Database setup failed:', err);
        // Did not exit process here, allowing server strict to decide
        throw err;
    }
}

// Allow running directly: node backend/setup_db.js
if (require.main === module) {
    setupDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = setupDatabase;
