const Sale = require('../models/saleModel');
const HttpError = require('../utils/httpError');
const { isPosInt, isMoney, isDate, today, validateItems, PAY_METHODS } = require('../middleware/validate');

exports.createSale = async (req, res, next) => {
    try {
        const { vendor_id, payment_method, amount_paid, items } = req.body;
        const sale_date = req.body.sale_date || today();
        const errors = [];
        if (!isPosInt(vendor_id)) errors.push('vendor_id must be a positive integer');
        if (!PAY_METHODS.includes(payment_method)) errors.push(`payment_method must be one of: ${PAY_METHODS.join(', ')}`);
        if (amount_paid !== undefined && !isMoney(amount_paid)) errors.push('amount_paid must be a number ≥ 0');
        if (!isDate(sale_date)) errors.push('sale_date must be YYYY-MM-DD');
        errors.push(...validateItems(items, false));
        if (errors.length) throw new HttpError(400, 'Invalid sale', errors);

        const id = await Sale.create({ vendor_id, sale_date, payment_method, amount_paid, items });
        res.status(201).json({ success: true, message: 'Sale recorded and stock reduced', data: await Sale.getById(id) });
    } catch (err) { next(err); }
};

exports.getAllSales = async (req, res, next) => {
    try {
        const vendorId = req.query.vendor_id ? Number(req.query.vendor_id) : null;
        if (req.query.vendor_id && !isPosInt(vendorId)) throw new HttpError(400, 'vendor_id filter must be a positive integer');
        const data = await Sale.getAll(vendorId);
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

exports.getSaleById = async (req, res, next) => {
    try {
        const data = await Sale.getById(req.params.id);
        if (!data) throw new HttpError(404, 'Sale not found');
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
};

// POST /api/sales/:id/payments  { amount, payment_method }
exports.addPayment = async (req, res, next) => {
    try {
        const { amount, payment_method } = req.body;
        const errors = [];
        if (typeof amount !== 'number' || !(amount > 0)) errors.push('amount must be a number greater than 0');
        if (!['CASH', 'MOBILE_MONEY'].includes(payment_method)) errors.push('payment_method must be CASH or MOBILE_MONEY');
        if (errors.length) throw new HttpError(400, 'Invalid payment', errors);
        await Sale.addPayment(req.params.id, amount, payment_method);
        res.status(200).json({ success: true, message: 'Payment recorded', data: await Sale.getById(req.params.id) });
    } catch (err) { next(err); }
};
