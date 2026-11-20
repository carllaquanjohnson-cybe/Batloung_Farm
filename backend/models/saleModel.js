const db = require('../config/db');
const HttpError = require('../utils/httpError');
const { calculateTotal, paymentStatus, balance, mergeLines, round2 } = require('../utils/calculations');

const SIZE_ORDER = { SMALL: 1, MEDIUM: 2, LARGE: 3 };

const Sale = {
    /**
     * Records a sale atomically (BEGIN … COMMIT, ROLLBACK on any failure).
     * Prices come from the Stock table (per fruit + packaging size) — the client never sends a price.
     * Each stock row is locked (FOR UPDATE) and decreased only if enough boxes exist, so stock can never go negative.
     * If ANY item is short, the whole sale is rolled back — earlier items' stock is restored automatically.
     */
    create: async ({ vendor_id, sale_date, payment_method, amount_paid, items }) => db.withTransaction(async (conn) => {
        const [v] = await conn.query('SELECT vendor_id FROM Vendors WHERE vendor_id = ?', [vendor_id]);
        if (!v.length) throw new HttpError(404, `Vendor ${vendor_id} does not exist`);

        // merge repeated lines, lock rows in a fixed order (prevents deadlocks)
        const lines = mergeLines(items).sort((a, b) => a.fruit_id - b.fruit_id || SIZE_ORDER[a.packaging_size] - SIZE_ORDER[b.packaging_size]);

        for (const l of lines) {
            const [rows] = await conn.query(
                `SELECT st.stock_id, st.available_quantity, st.selling_price, f.fruit_name, f.status
                 FROM Stock st JOIN Fruits f ON f.fruit_id = st.fruit_id
                 WHERE st.fruit_id = ? AND st.packaging_size = ? FOR UPDATE`, [l.fruit_id, l.packaging_size]);
            if (!rows.length) throw new HttpError(400, `Fruit ${l.fruit_id} (${l.packaging_size}) has no stock record`);
            const s = rows[0];
            if (s.status !== 'ACTIVE') throw new HttpError(400, `${s.fruit_name} is INACTIVE and cannot be sold`);
            if (s.selling_price <= 0) throw new HttpError(400, `No selling price set for ${s.fruit_name} (${l.packaging_size})`);
            if (s.available_quantity < l.quantity)
                throw new HttpError(400,
                    `Insufficient stock: requested ${l.quantity} ${l.packaging_size.toLowerCase()} box(es) of ${s.fruit_name}, only ${s.available_quantity} available. Sale rejected, no stock was changed.`,
                    { fruit_id: l.fruit_id, fruit_name: s.fruit_name, packaging_size: l.packaging_size,
                      requested: l.quantity, available: s.available_quantity });

            // guarded decrement — double protection against negative stock
            const [u] = await conn.query(
                'UPDATE Stock SET available_quantity = available_quantity - ? WHERE stock_id = ? AND available_quantity >= ?',
                [l.quantity, s.stock_id, l.quantity]);
            if (u.affectedRows !== 1) throw new HttpError(400, `Stock changed while processing ${s.fruit_name} — please retry`);
            l.unit_price = s.selling_price;
            l.fruit_name = s.fruit_name;
        }

        const total = calculateTotal(lines, 'unit_price');
        const paid = amount_paid === undefined ? (payment_method === 'CREDIT' ? 0 : total) : amount_paid;
        if (paid > total) throw new HttpError(400, `amount_paid (${paid}) is more than the sale total (${total})`);

        const [head] = await conn.query(
            `INSERT INTO Sales (vendor_id, sale_date, payment_status, payment_method, amount_paid, total_amount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [vendor_id, sale_date, paymentStatus(total, paid), payment_method, paid, total]);
        for (const l of lines)
            await conn.query(
                'INSERT INTO Sales_Details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                [head.insertId, l.fruit_id, l.packaging_size, l.quantity, l.unit_price]);
        return head.insertId;
    }),

    /** Vendor pays off (part of) an existing balance */
    addPayment: async (saleId, amount, method) => db.withTransaction(async (conn) => {
        const [[sale]] = await conn.query('SELECT * FROM Sales WHERE sale_id = ? FOR UPDATE', [saleId]);
        if (!sale) throw new HttpError(404, 'Sale not found');
        const owed = balance(sale.total_amount, sale.amount_paid);
        if (owed <= 0) throw new HttpError(400, 'This sale is already fully paid');
        if (amount > owed) throw new HttpError(400, `Payment of ${amount} is more than the outstanding balance of ${owed}`);
        const paid = round2(sale.amount_paid + amount);
        await conn.query('UPDATE Sales SET amount_paid = ?, payment_status = ?, payment_method = ? WHERE sale_id = ?',
            [paid, paymentStatus(sale.total_amount, paid), method, saleId]);
    }),

    getAll: async (vendorId) => (await db.query(
        `SELECT s.*, v.vendor_name, (s.total_amount - s.amount_paid) AS balance,
                (SELECT COALESCE(SUM(quantity),0) FROM Sales_Details d WHERE d.sale_id = s.sale_id) AS boxes
         FROM Sales s JOIN Vendors v ON v.vendor_id = s.vendor_id
         ${vendorId ? 'WHERE s.vendor_id = ?' : ''}
         ORDER BY s.sale_date DESC, s.sale_id DESC`, vendorId ? [vendorId] : []))[0],

    getById: async (id) => {
        const [[head]] = await db.query(
            `SELECT s.*, v.vendor_name, v.phone_number, (s.total_amount - s.amount_paid) AS balance
             FROM Sales s JOIN Vendors v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?`, [id]);
        if (!head) return null;
        const [items] = await db.query(
            `SELECT d.*, f.fruit_name, (d.quantity * d.unit_price) AS line_total
             FROM Sales_Details d JOIN Fruits f ON f.fruit_id = d.fruit_id WHERE d.sale_id = ?`, [id]);
        return { ...head, items };
    }
};
module.exports = Sale;
