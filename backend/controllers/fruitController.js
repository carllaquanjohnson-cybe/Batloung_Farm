const Fruit = require('../models/fruitModel');
const Stock = require('../models/stockModel');
const HttpError = require('../utils/httpError');
const { str, isMoney, SIZES } = require('../middleware/validate');

const STATUSES = ['ACTIVE', 'INACTIVE'];
// Default selling price per box when a new fruit is registered (small < medium < large)
const DEFAULT_PRICES = { SMALL: 8, MEDIUM: 12, LARGE: 18 };

const clean = (b) => {
    const d = { fruit_name: str(b.fruit_name), description: str(b.description) || null, status: str(b.status) || 'ACTIVE' };
    if (!d.fruit_name) throw new HttpError(400, 'fruit_name is required');
    if (!STATUSES.includes(d.status)) throw new HttpError(400, 'status must be ACTIVE or INACTIVE');
    return d;
};

exports.getAllFruits = async (req, res, next) => {
    try {
        const status = req.query.status ? String(req.query.status).toUpperCase() : null;
        if (status && !STATUSES.includes(status)) throw new HttpError(400, 'status filter must be ACTIVE or INACTIVE');
        const data = await Fruit.getAll(status || 'ACTIVE');   // "all available fruits" = ACTIVE by default
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

exports.getAllIncludingInactive = async (req, res, next) => {
    try {
        const data = await Fruit.getAll(null);
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

exports.getFruitById = async (req, res, next) => {
    try {
        const data = await Fruit.getById(req.params.id);
        if (!data) throw new HttpError(404, 'Fruit not found');
        res.status(200).json({ success: true, data: { ...data, stock: await Stock.getByFruit(req.params.id) } });
    } catch (err) { next(err); }
};

exports.createFruit = async (req, res, next) => {
    try {
        const d = clean(req.body);
        const prices = { ...DEFAULT_PRICES };
        for (const s of SIZES) {
            const p = req.body.prices?.[s] ?? req.body.prices?.[s.toLowerCase()];
            if (p !== undefined) {
                if (!isMoney(Number(p))) throw new HttpError(400, `price for ${s} must be a number ≥ 0`);
                prices[s] = Number(p);
            }
        }
        const id = await Fruit.create(d, prices);
        res.status(201).json({ success: true, message: 'Fruit registered with stock rows for all 3 sizes',
            data: { ...(await Fruit.getById(id)), stock: await Stock.getByFruit(id) } });
    } catch (err) { next(err); }
};

exports.updateFruit = async (req, res, next) => {
    try {
        const existing = await Fruit.getById(req.params.id);
        if (!existing) throw new HttpError(404, 'Fruit not found');
        await Fruit.update(req.params.id, clean({ ...existing, ...req.body }));
        res.status(200).json({ success: true, message: 'Fruit updated', data: await Fruit.getById(req.params.id) });
    } catch (err) { next(err); }
};
