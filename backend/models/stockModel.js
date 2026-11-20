const db = require('../config/db');

const ORDER = `ORDER BY f.fruit_name, FIELD(st.packaging_size,'SMALL','MEDIUM','LARGE')`;
const SELECT = `SELECT st.stock_id, st.fruit_id, f.fruit_name, f.status, st.packaging_size,
                       st.available_quantity, st.selling_price
                FROM Stock st JOIN Fruits f ON f.fruit_id = st.fruit_id`;

const Stock = {
    getAll: async () => (await db.query(`${SELECT} ${ORDER}`))[0],
    getByFruit: async (fruitId) => (await db.query(`${SELECT} WHERE st.fruit_id = ? ${ORDER}`, [fruitId]))[0],
    getLow: async (threshold) => (await db.query(
        `${SELECT} WHERE st.available_quantity <= ? AND f.status = 'ACTIVE'
         ORDER BY st.available_quantity ASC, f.fruit_name`, [threshold]))[0],
    getById: async (id) => (await db.query('SELECT * FROM Stock WHERE stock_id = ?', [id]))[0][0],
    setPrice: async (id, price) => (await db.query(
        'UPDATE Stock SET selling_price = ? WHERE stock_id = ?', [price, id]))[0].affectedRows
};
module.exports = Stock;
