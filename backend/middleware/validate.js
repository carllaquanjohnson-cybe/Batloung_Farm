const HttpError = require('../utils/httpError');

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape',
                   'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
const PAY_METHODS = ['CASH', 'MOBILE_MONEY', 'CREDIT'];

// Express 5 leaves req.body undefined when nothing was sent
const ensureBody = (req, res, next) => { req.body = req.body || {}; next(); };

// Rejects /:id values that are not positive integers
const validateId = (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        return next(new HttpError(400, `Invalid id "${req.params.id}" — must be a positive whole number`));
    req.params.id = id;
    next();
};

const isPosInt = (v) => Number.isInteger(v) && v > 0;
const isMoney = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const today = () => new Date().toISOString().slice(0, 10);

// Validates the line items of a purchase or sale. needsCost → purchases.
const validateItems = (items, needsCost) => {
    const errors = [];
    if (!Array.isArray(items) || items.length === 0) return ['items must be a non-empty array'];
    items.forEach((it, i) => {
        const n = `items[${i}]`;
        if (!isPosInt(it?.fruit_id)) errors.push(`${n}.fruit_id must be a positive integer`);
        if (!SIZES.includes(it?.packaging_size)) errors.push(`${n}.packaging_size must be SMALL, MEDIUM or LARGE`);
        if (!isPosInt(it?.quantity)) errors.push(`${n}.quantity must be a positive whole number`);
        if (needsCost && !isMoney(it?.unit_cost)) errors.push(`${n}.unit_cost must be a number ≥ 0`);
    });
    return errors;
};

module.exports = { SIZES, PROVINCES, PAY_METHODS, ensureBody, validateId,
                   isPosInt, isMoney, str, isDate, today, validateItems };
