const { requireAdmin } = require('../auth/session');
const router = require('express').Router();
const c = require('../controllers/stockController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllStock);
router.get('/low', c.getLowStock);
router.get('/fruit/:id', validateId, c.getStockForFruit);
router.put('/:id/price', validateId, requireAdmin, c.updatePrice);
module.exports = router;
