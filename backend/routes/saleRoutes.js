const router = require('express').Router();
const c = require('../controllers/saleController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllSales);
router.post('/', c.createSale);
router.get('/:id', validateId, c.getSaleById);
router.post('/:id/payments', validateId, c.addPayment);
module.exports = router;
