const { requireAdmin } = require('../auth/session');
const router = require('express').Router();
const c = require('../controllers/supplierController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllSuppliers);
router.post('/', c.createSupplier);
router.get('/:id', validateId, c.getSupplierById);
router.put('/:id', validateId, c.updateSupplier);
router.delete('/:id', validateId, requireAdmin, c.deleteSupplier);
module.exports = router;
