const router = require('express').Router();
const c = require('../controllers/vendorController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllVendors);
router.get('/search', c.searchVendors);
router.get('/outstanding', c.getOutstanding);
router.post('/', c.createVendor);
router.get('/:id', validateId, c.getVendorById);
router.put('/:id', validateId, c.updateVendor);
module.exports = router;
