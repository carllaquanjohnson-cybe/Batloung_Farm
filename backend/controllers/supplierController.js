const Supplier = require('../models/supplierModel');
const HttpError = require('../utils/httpError');
const { PROVINCES, str } = require('../middleware/validate');

// Validates a full supplier record (used for create and for merged updates)
const clean = (b) => {
    const d = { business_name: str(b.business_name), contact_person: str(b.contact_person),
                phone: str(b.phone), province: str(b.province), address: str(b.address) };
    const missing = Object.keys(d).filter((k) => !d[k]);
    if (missing.length) throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
    if (!PROVINCES.includes(d.province))
        throw new HttpError(400, `province must be one of: ${PROVINCES.join(', ')}`);
    if (!/^\+?[0-9 ()-]{7,20}$/.test(d.phone)) throw new HttpError(400, 'phone number format is invalid');
    return d;
};

exports.getAllSuppliers = async (req, res, next) => {
    try {
        const data = await Supplier.getAll();
        res.status(200).json({ success: true, count: data.length, data });
    } catch (err) { next(err); }
};

exports.getSupplierById = async (req, res, next) => {
    try {
        const data = await Supplier.getById(req.params.id);
        if (!data) throw new HttpError(404, 'Supplier not found');
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
};

exports.createSupplier = async (req, res, next) => {
    try {
        const id = await Supplier.create(clean(req.body));
        res.status(201).json({ success: true, message: 'Supplier registered', data: await Supplier.getById(id) });
    } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
    try {
        const existing = await Supplier.getById(req.params.id);
        if (!existing) throw new HttpError(404, 'Supplier not found');
        await Supplier.update(req.params.id, clean({ ...existing, ...req.body }));  // partial updates allowed
        res.status(200).json({ success: true, message: 'Supplier updated', data: await Supplier.getById(req.params.id) });
    } catch (err) { next(err); }
};

// Business rule: a supplier with purchase history cannot be deleted
exports.deleteSupplier = async (req, res, next) => {
    try {
        if (!(await Supplier.getById(req.params.id))) throw new HttpError(404, 'Supplier not found');
        const n = await Supplier.countPurchases(req.params.id);
        if (n > 0) throw new HttpError(400, `Cannot delete: supplier has ${n} recorded purchase(s). Records are kept for stock and audit history.`);
        await Supplier.delete(req.params.id);
        res.status(200).json({ success: true, message: 'Supplier deleted' });
    } catch (err) { next(err); }
};
