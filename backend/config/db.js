
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    dateStrings: true,
    decimalNumbers: true,
    connectTimeout: 10000,

    // Secure connection for TiDB Cloud
    ssl: process.env.DB_SSL === 'true'
        ? {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
        : undefined
});

// Pool-level errors must never crash the process
pool.on('error', (err) => {
    console.error('[DB POOL ERROR]', err.code || err.message);
});

// Non-fatal startup check
const checkConnection = async () => {
    try {
        const conn = await pool.getConnection();
        conn.release();

        console.log(
            'MySQL connected to database:',
            process.env.DB_NAME
        );

        return true;
    } catch (err) {
        console.error(
            `MySQL connection failed (${err.code || 'ERR'}): ${err.message}`
        );
        console.error(
            'The server is still running — API calls will return 503 until MySQL is reachable.'
        );

        return false;
    }
};

// Database transaction management
const withTransaction = async (fn) => {
    const conn = await pool.getConnection();

    try {
        await conn.query('BEGIN');

        const result = await fn(conn);

        await conn.query('COMMIT');

        return result;
    } catch (err) {
        try {
            await conn.query('ROLLBACK');
        } catch (_) {
            // Connection may already be closed
        }

        throw err;
    } finally {
        conn.release();
    }
};

pool.checkConnection = checkConnection;
pool.withTransaction = withTransaction;

module.exports = pool;
