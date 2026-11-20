const router = require('express').Router();
const c = require('../controllers/purchaseController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllPurchases);
router.post('/', c.createPurchase);
router.get('/:id', validateId, c.getPurchaseById);
module.exports = router;
