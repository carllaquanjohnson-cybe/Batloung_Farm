const Stock = require('../models/stockModel');
const Fruit = require('../models/fruitModel');
const HttpError = require('../utils/httpError');
const { isMoney } = require('../middleware/validate');

const DEFAULT_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 30;

// GET /api/stock — every fruit × packaging size
exports.getAllStock = async (req, res, next) => {
    try {
        const data = await Stock.getAll();
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

// GET /api/stock/fruit/:id
exports.getStockForFruit = async (req, res, next) => {
    try {
        if (!(await Fruit.getById(req.params.id))) throw new HttpError(404, 'Fruit not found');
        const data = await Stock.getByFruit(req.params.id);
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

// GET /api/stock/low?threshold=30
exports.getLowStock = async (req, res, next) => {
    try {
        const threshold = req.query.threshold === undefined ? DEFAULT_THRESHOLD : Number(req.query.threshold);
        if (!Number.isInteger(threshold) || threshold < 0) throw new HttpError(400, 'threshold must be a whole number ≥ 0');
        const data = await Stock.getLow(threshold);
        res.status(200).json({ success: true, threshold, count: data.length, data });
    } catch (err) { next(err); }
};

// PUT /api/stock/:id/price  { selling_price }
exports.updatePrice = async (req, res, next) => {
    try {
        const price = req.body.selling_price;
        if (!isMoney(price)) throw new HttpError(400, 'selling_price must be a number ≥ 0');
        if (!(await Stock.getById(req.params.id))) throw new HttpError(404, 'Stock row not found');
        await Stock.setPrice(req.params.id, price);
        res.status(200).json({ success: true, message: 'Selling price updated', data: await Stock.getById(req.params.id) });
    } catch (err) { next(err); }
};
