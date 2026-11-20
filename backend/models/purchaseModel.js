const db = require('../config/db');
const HttpError = require('../utils/httpError');
const { calculateTotal, mergeLines } = require('../utils/calculations');

const Purchase = {
    /**
     * Records a purchase atomically (BEGIN … COMMIT, ROLLBACK on any failure):
     *  1. header row   2. one detail row per item   3. stock increased per fruit+size   4. total calculated
     * If ANY item is invalid (e.g. unknown fruit), nothing is saved.
     */
    create: async ({ supplier_id, purchase_date, items }) => db.withTransaction(async (conn) => {
        const [sup] = await conn.query('SELECT supplier_id FROM Suppliers WHERE supplier_id = ?', [supplier_id]);
        if (!sup.length) throw new HttpError(404, `Supplier ${supplier_id} does not exist`);

        const lines = mergeLines(items, ['unit_cost']);
        const [head] = await conn.query('INSERT INTO Purchases (supplier_id, purchase_date, total_amount) VALUES (?, ?, 0)',
            [supplier_id, purchase_date]);

        for (const [i, l] of lines.entries()) {
            const [f] = await conn.query('SELECT fruit_name, status FROM Fruits WHERE fruit_id = ?', [l.fruit_id]);
            if (!f.length) throw new HttpError(400, `Item ${i + 1}: fruit ${l.fruit_id} does not exist — purchase rolled back`);
            if (f[0].status !== 'ACTIVE') throw new HttpError(400, `Item ${i + 1}: ${f[0].fruit_name} is INACTIVE — purchase rolled back`);

            await conn.query(
                `INSERT INTO Purchase_Details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES (?, ?, ?, ?, ?)`,
                [head.insertId, l.fruit_id, l.quantity, l.unit_cost, l.packaging_size]);
            // stock goes UP for this exact fruit + packaging size
            await conn.query(
                `INSERT INTO Stock (fruit_id, packaging_size, available_quantity) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE available_quantity = available_quantity + ?`,
                [l.fruit_id, l.packaging_size, l.quantity, l.quantity]);
        }
        const total = calculateTotal(lines, 'unit_cost');
        await conn.query('UPDATE Purchases SET total_amount = ? WHERE purchase_id = ?', [total, head.insertId]);
        return head.insertId;
    }),

    getAll: async () => (await db.query(
        `SELECT p.*, s.business_name AS supplier_name, s.province,
                (SELECT COALESCE(SUM(quantity),0) FROM Purchase_Details d WHERE d.purchase_id = p.purchase_id) AS boxes
         FROM Purchases p JOIN Suppliers s ON s.supplier_id = p.supplier_id
         ORDER BY p.purchase_date DESC, p.purchase_id DESC`))[0],

    getById: async (id) => {
        const [[head]] = await db.query(
            `SELECT p.*, s.business_name AS supplier_name FROM Purchases p
             JOIN Suppliers s ON s.supplier_id = p.supplier_id WHERE p.purchase_id = ?`, [id]);
        if (!head) return null;
        const [items] = await db.query(
            `SELECT d.*, f.fruit_name, (d.quantity * d.unit_cost) AS line_total
             FROM Purchase_Details d JOIN Fruits f ON f.fruit_id = d.fruit_id WHERE d.purchase_id = ?`, [id]);
        return { ...head, items };
    }
};
module.exports = Purchase;
