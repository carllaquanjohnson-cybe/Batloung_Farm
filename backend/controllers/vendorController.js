const Vendor = require('../models/vendorModel');
const HttpError = require('../utils/httpError');
const { str, isDate, today } = require('../middleware/validate');

const clean = (b) => {
    const d = { vendor_name: str(b.vendor_name), phone_number: str(b.phone_number),
                location: str(b.location), registration_date: str(b.registration_date) || today() };
    const missing = ['vendor_name', 'phone_number', 'location'].filter((k) => !d[k]);
    if (missing.length) throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
    if (!/^\+?[0-9 ()-]{7,20}$/.test(d.phone_number)) throw new HttpError(400, 'phone_number format is invalid');
    if (!isDate(d.registration_date)) throw new HttpError(400, 'registration_date must be YYYY-MM-DD');
    return d;
};

exports.getAllVendors = async (req, res, next) => {
    try {
        const data = await Vendor.getAll();
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

// GET /api/vendors/search?q=maseru  — matches name or phone number
exports.searchVendors = async (req, res, next) => {
    try {
        const q = str(req.query.q);
        if (!q) throw new HttpError(400, 'Query parameter q is required (vendor name or phone number)');
        const data = await Vendor.search(q);
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

// GET /api/vendors/outstanding — outstanding balance for every vendor that owes money
exports.getOutstanding = async (req, res, next) => {
    try {
        const data = await Vendor.getOutstanding();
        const total = data.reduce((s, v) => s + v.outstanding_balance, 0);
        res.status(200).json({ success: true, count: data.length, total_outstanding: Math.round(total * 100) / 100, data });
    } catch (err) { next(err); }
};

exports.getVendorById = async (req, res, next) => {
    try {
        const data = await Vendor.getById(req.params.id);
        if (!data) throw new HttpError(404, 'Vendor not found');
        res.status(200).json({ success: true, data: { ...data, unpaid_sales: await Vendor.unpaidSales(req.params.id) } });
    } catch (err) { next(err); }
};

exports.createVendor = async (req, res, next) => {
    try {
        const id = await Vendor.create(clean(req.body));
        res.status(201).json({ success: true, message: 'Vendor registered', data: await Vendor.getById(id) });
    } catch (err) { next(err); }
};

exports.updateVendor = async (req, res, next) => {
    try {
        const existing = await Vendor.getById(req.params.id);
        if (!existing) throw new HttpError(404, 'Vendor not found');
        await Vendor.update(req.params.id, clean({ ...existing, ...req.body }));
        res.status(200).json({ success: true, message: 'Vendor updated', data: await Vendor.getById(req.params.id) });
    } catch (err) { next(err); }
};
