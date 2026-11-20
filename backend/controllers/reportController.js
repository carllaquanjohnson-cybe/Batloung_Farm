const db = require('../config/db');
const HttpError = require('../utils/httpError');
const { isDate } = require('../middleware/validate');

const wrap = (fn) => async (req, res, next) => {
    try { res.status(200).json({ success: true, ...(await fn(req)) }); } catch (err) { next(err); }
};

// 1. Five most frequently sold fruits
exports.topFruits = wrap(async () => {
    const [data] = await db.query(
        `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS boxes_sold, COUNT(DISTINCT sd.sale_id) AS times_sold
         FROM Sales_Details sd JOIN Fruits f ON f.fruit_id = sd.fruit_id
         GROUP BY f.fruit_id, f.fruit_name ORDER BY boxes_sold DESC LIMIT 5`);
    return { data };
});

// 2. Revenue in a date range:  /revenue?from=2025-04-01&to=2025-04-30
exports.revenue = wrap(async (req) => {
    const { from, to } = req.query;
    if (!isDate(from) || !isDate(to)) throw new HttpError(400, 'Query parameters from and to are required in YYYY-MM-DD format');
    if (from > to) throw new HttpError(400, '"from" date must not be after "to" date');
    const [[row]] = await db.query(
        `SELECT COALESCE(SUM(total_amount),0) AS revenue, COALESCE(SUM(amount_paid),0) AS collected, COUNT(*) AS sales_count
         FROM Sales WHERE sale_date BETWEEN ? AND ?`, [from, to]);
    const [daily] = await db.query(
        `SELECT sale_date, SUM(total_amount) AS revenue FROM Sales WHERE sale_date BETWEEN ? AND ?
         GROUP BY sale_date ORDER BY sale_date`, [from, to]);
    return { from, to, data: { ...row, daily } };
});

// 3. Vendor who bought the most boxes
exports.topVendor = wrap(async () => {
    const [rows] = await db.query(
        `SELECT v.vendor_id, v.vendor_name, v.location, SUM(sd.quantity) AS total_boxes
         FROM Vendors v JOIN Sales s ON s.vendor_id = v.vendor_id JOIN Sales_Details sd ON sd.sale_id = s.sale_id
         GROUP BY v.vendor_id, v.vendor_name, v.location ORDER BY total_boxes DESC LIMIT 1`);
    return { data: rows[0] || null };
});

// 4. Current stock for each fruit and packaging size
exports.stockLevels = wrap(async () => {
    const [data] = await db.query(
        `SELECT f.fruit_name, st.packaging_size, st.available_quantity, st.selling_price
         FROM Stock st JOIN Fruits f ON f.fruit_id = st.fruit_id
         ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE')`);
    return { count: data.length, data };
});

// Dashboard summary
exports.summary = wrap(async () => {
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD) || 30;
    const [[s]] = await db.query(
        `SELECT COALESCE(SUM(total_amount),0) AS revenue, COALESCE(SUM(amount_paid),0) AS collected,
                COALESCE(SUM(total_amount - amount_paid),0) AS outstanding, COUNT(*) AS sales_count FROM Sales`);
    const [[st]] = await db.query(
        `SELECT COALESCE(SUM(st.available_quantity),0) AS boxes_in_stock,
                SUM(st.available_quantity <= ?) AS low_stock_lines
         FROM Stock st JOIN Fruits f ON f.fruit_id = st.fruit_id WHERE f.status = 'ACTIVE'`, [threshold]);
    const [[c]] = await db.query(
        `SELECT (SELECT COUNT(*) FROM Vendors) AS vendors, (SELECT COUNT(*) FROM Suppliers) AS suppliers,
                (SELECT COALESCE(SUM(total_amount),0) FROM Purchases) AS purchase_spend`);
    return { threshold, data: { ...s, ...st, low_stock_lines: Number(st.low_stock_lines || 0), ...c } };
});
