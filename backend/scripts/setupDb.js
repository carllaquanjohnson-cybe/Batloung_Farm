// One-command database setup:  npm run db:setup
// Runs database/schema.sql (drops + recreates batloung_farm, 8 tables, sample data)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER,
            password: process.env.DB_PASSWORD, port: Number(process.env.DB_PORT) || 3306,
            multipleStatements: true
        });
        await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
        await conn.end();
        console.log('✅ Database "batloung_farm" created with 8 tables and sample data.');
        console.log('   Next: npm start   then open http://localhost:' + (process.env.PORT || 5000));
    } catch (err) {
        console.error('❌ Database setup failed:', err.code || '', err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('   Check DB_USER / DB_PASSWORD in backend/.env');
        if (err.code === 'ECONNREFUSED') console.error('   MySQL is not running. Start the MySQL80 service (Windows: Services → MySQL80 → Start).');
        process.exit(1);
    }
})();
