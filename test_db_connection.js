const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const { Pool } = require('pg');

console.log('--- Testing Database Connection ---');
console.log('Loading .env from:', path.join(__dirname, 'backend', '.env'));
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '****' : '(not set)');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_HOST:', process.env.DB_HOST);

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Connection failed:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('👉 Cause: Wrong password for user ' + process.env.DB_USER);
            console.error('👉 Action: Update backend/.env with the correct password.');
        }
        process.exit(1);
    } else {
        console.log('✅ Connection successful!');
        console.log('Time:', res.rows[0].now);
        process.exit(0);
    }
});
