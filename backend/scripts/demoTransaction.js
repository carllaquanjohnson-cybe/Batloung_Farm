// Transaction demo:  npm run demo
// A sale with TWO items where the second fails validation → whole sale rolls back.
const db = require('../config/db');
const Sale = require('../models/saleModel');

const show = async (label) => {
    const [rows] = await db.query(
        `SELECT f.fruit_name, st.packaging_size, st.available_quantity FROM Stock st
         JOIN Fruits f ON f.fruit_id = st.fruit_id
         WHERE (st.fruit_id, st.packaging_size) IN ((1,'LARGE'),(2,'MEDIUM'))`);
    console.log('\n' + label); console.table(rows);
    const [[c]] = await db.query('SELECT COUNT(*) AS n FROM Sales'); console.log('Sales on file:', c.n);
};

(async () => {
    try {
        await db.query("UPDATE Stock SET available_quantity = 6 WHERE fruit_id = 1 AND packaging_size = 'LARGE'");
        await show('BEFORE — only 6 large apples exist');
        console.log('\nBEGIN … item 1: 3 medium bananas (valid) … item 2: 10 large apples (only 6!)');
        await Sale.create({ vendor_id: 1, sale_date: '2026-11-21', payment_method: 'CASH',
            items: [{ fruit_id: 2, packaging_size: 'MEDIUM', quantity: 3 }, { fruit_id: 1, packaging_size: 'LARGE', quantity: 10 }] });
        console.log('❌ This should not happen');
    } catch (err) {
        console.log('\n⛔ REJECTED →', err.message);
        console.log('ROLLBACK executed: the 3 bananas were put back automatically.');
    } finally {
        await show('AFTER — stock and sales are unchanged');
        console.log('\nTip: run  npm run db:setup  to restore the original sample data.');
        process.exit(0);
    }
})();
