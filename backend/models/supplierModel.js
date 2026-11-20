const db = require('../config/db');

const Supplier = {
    getAll: async () => (await db.query(
        `SELECT s.*, COUNT(p.purchase_id) AS purchase_count
         FROM Suppliers s LEFT JOIN Purchases p ON p.supplier_id = s.supplier_id
         GROUP BY s.supplier_id ORDER BY s.supplier_id DESC`))[0],
    getById: async (id) => (await db.query('SELECT * FROM Suppliers WHERE supplier_id = ?', [id]))[0][0],
    create: async (d) => (await db.query(
        `INSERT INTO Suppliers (business_name, contact_person, phone, province, address) VALUES (?, ?, ?, ?, ?)`,
        [d.business_name, d.contact_person, d.phone, d.province, d.address]))[0].insertId,
    update: async (id, d) => (await db.query(
        `UPDATE Suppliers SET business_name=?, contact_person=?, phone=?, province=?, address=? WHERE supplier_id=?`,
        [d.business_name, d.contact_person, d.phone, d.province, d.address, id]))[0].affectedRows,
    countPurchases: async (id) => (await db.query(
        'SELECT COUNT(*) AS n FROM Purchases WHERE supplier_id = ?', [id]))[0][0].n,
    delete: async (id) => (await db.query('DELETE FROM Suppliers WHERE supplier_id = ?', [id]))[0].affectedRows
};
module.exports = Supplier;
