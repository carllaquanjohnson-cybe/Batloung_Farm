const db = require('../config/db');
const { SIZES } = require('../middleware/validate');

const Fruit = {
    getAll: async (status) => (await db.query(
        `SELECT * FROM Fruits ${status ? 'WHERE status = ?' : ''} ORDER BY fruit_name`, status ? [status] : []))[0],
    getById: async (id) => (await db.query('SELECT * FROM Fruits WHERE fruit_id = ?', [id]))[0][0],

    // Creates the fruit AND its 3 stock rows (one per packaging size) atomically
    create: async ({ fruit_name, description, status }, prices) =>
        db.withTransaction(async (conn) => {
            const [r] = await conn.query('INSERT INTO Fruits (fruit_name, description, status) VALUES (?, ?, ?)',
                [fruit_name, description, status]);
            for (const size of SIZES)
                await conn.query('INSERT INTO Stock (fruit_id, packaging_size, available_quantity, selling_price) VALUES (?, ?, 0, ?)',
                    [r.insertId, size, prices[size]]);
            return r.insertId;
        }),
    update: async (id, d) => (await db.query(
        'UPDATE Fruits SET fruit_name=?, description=?, status=? WHERE fruit_id=?',
        [d.fruit_name, d.description, d.status, id]))[0].affectedRows
};
module.exports = Fruit;
