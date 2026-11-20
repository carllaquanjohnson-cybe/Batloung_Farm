'use strict';
const express = require('express');
const path = require('node:path');
require('dotenv').config({ quiet: true });
const db = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { ensureBody } = require('./middleware/validate');
const { attachSession, requireStaff, requireAdmin } = require('./auth/session');
const { sameOriginOnly } = require('./middleware/security');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});
// No wildcard CORS: the browser app and API share the same origin.
app.use(express.json({ limit: '64kb' }));
app.use('/api', sameOriginOnly, ensureBody, attachSession);
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ success: true, message: 'Batloung Farm API is running', database: 'connected' });
    } catch (err) {
        res.status(503).json({ success: false, message: 'API is running but the database is unreachable', database: err.code || 'error' });
    }
});
// Public catalogue returns product descriptions and availability, NOT exact stock,
// supplier contacts, vendor records, private sales or business revenue.
app.get('/api/catalog', async (req, res, next) => {
    try {
        const [data] = await db.query(`SELECT f.fruit_id, f.fruit_name, f.description,
            s.packaging_size, s.selling_price, (s.available_quantity > 0) AS available
            FROM Fruits f JOIN Stock s ON s.fruit_id = f.fruit_id
            WHERE f.status = 'ACTIVE'
            ORDER BY f.fruit_name, FIELD(s.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`);
        res.json({ success: true, data });
    } catch (err) { next(err); }
});
app.use('/api/auth', require('./auth/routes'));
app.use('/api/suppliers', requireStaff, require('./routes/supplierRoutes'));
app.use('/api/fruits', requireStaff, require('./routes/fruitRoutes'));
app.use('/api/stock', requireStaff, require('./routes/stockRoutes'));
app.use('/api/vendors', requireStaff, require('./routes/vendorRoutes'));
app.use('/api/purchases', requireStaff, require('./routes/purchaseRoutes'));
app.use('/api/sales', requireStaff, require('./routes/saleRoutes'));
app.use('/api/reports', requireAdmin, require('./routes/reportRoutes'));
app.use('/api', notFound);
app.use(express.static(path.join(__dirname, '..', 'frontend'), { maxAge: 0, etag: true }));
app.use(notFound);
app.use(errorHandler);
// Do not keep processing in an undefined state after unexpected fatal errors.
process.on('unhandledRejection', reason => console.error('[UNHANDLED REJECTION]', reason));
process.on('uncaughtException', err => { console.error('[UNCAUGHT EXCEPTION]', err); process.exit(1); });
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Batloung Farm running on http://localhost:${PORT}`);
    db.checkConnection();
});
server.on('error', err => console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : `Server error: ${err.message}`));
