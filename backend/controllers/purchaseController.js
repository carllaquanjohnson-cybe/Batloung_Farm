const Purchase = require('../models/purchaseModel');
const HttpError = require('../utils/httpError');
const { isPosInt, isDate, today, validateItems } = require('../middleware/validate');

exports.createPurchase = async (req, res, next) => {
    try {
        const { supplier_id, items } = req.body;
        const purchase_date = req.body.purchase_date || today();
        const errors = [];
        if (!isPosInt(supplier_id)) errors.push('supplier_id must be a positive integer');
        if (!isDate(purchase_date)) errors.push('purchase_date must be YYYY-MM-DD');
        errors.push(...validateItems(items, true));
        if (errors.length) throw new HttpError(400, 'Invalid purchase', errors);

        const id = await Purchase.create({ supplier_id, purchase_date, items });
        res.status(201).json({ success: true, message: 'Purchase recorded and stock updated', data: await Purchase.getById(id) });
    } catch (err) { next(err); }
};

exports.getAllPurchases = async (req, res, next) => {
    try {
        const data = await Purchase.getAll();
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

exports.getPurchaseById = async (req, res, next) => {
    try {
        const data = await Purchase.getById(req.params.id);
        if (!data) throw new HttpError(404, 'Purchase not found');
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
};
