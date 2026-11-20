const db = require('../config/db');

const WITH_BALANCE = `
  SELECT v.*, COALESCE(b.outstanding,0) AS outstanding_balance, COALESCE(b.total_billed,0) AS total_billed
  FROM Vendors v
  LEFT JOIN (SELECT vendor_id, SUM(total_amount - amount_paid) AS outstanding, SUM(total_amount) AS total_billed
             FROM Sales GROUP BY vendor_id) b ON b.vendor_id = v.vendor_id`;

const Vendor = {
    getAll: async () => (await db.query(`${WITH_BALANCE} ORDER BY v.vendor_id DESC`))[0],
    getById: async (id) => (await db.query(`${WITH_BALANCE} WHERE v.vendor_id = ?`, [id]))[0][0],
    search: async (q) => (await db.query(
        `${WITH_BALANCE} WHERE v.vendor_name LIKE ? OR v.phone_number LIKE ? ORDER BY v.vendor_name`,
        [`%${q}%`, `%${q}%`]))[0],
    create: async (d) => (await db.query(
        'INSERT INTO Vendors (vendor_name, phone_number, location, registration_date) VALUES (?, ?, ?, ?)',
        [d.vendor_name, d.phone_number, d.location, d.registration_date]))[0].insertId,
    update: async (id, d) => (await db.query(
        'UPDATE Vendors SET vendor_name=?, phone_number=?, location=?, registration_date=? WHERE vendor_id=?',
        [d.vendor_name, d.phone_number, d.location, d.registration_date, id]))[0].affectedRows,
    // vendors who still owe money, largest debt first
    getOutstanding: async () => (await db.query(
        `SELECT * FROM (${WITH_BALANCE}) x WHERE outstanding_balance > 0 ORDER BY outstanding_balance DESC`))[0],
    unpaidSales: async (id) => (await db.query(
        `SELECT sale_id, sale_date, payment_status, payment_method, total_amount, amount_paid,
                (total_amount - amount_paid) AS balance
         FROM Sales WHERE vendor_id = ? AND payment_status <> 'PAID' ORDER BY sale_date`, [id]))[0]
};
module.exports = Vendor;
