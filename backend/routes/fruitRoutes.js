const { requireAdmin } = require('../auth/session');
const router = require('express').Router();
const c = require('../controllers/fruitController');
const { validateId } = require('../middleware/validate');

router.get('/', c.getAllFruits);
router.get('/all', c.getAllIncludingInactive);
router.post('/', requireAdmin, c.createFruit);
router.get('/:id', validateId, c.getFruitById);
router.put('/:id', validateId, requireAdmin, c.updateFruit);
module.exports = router;
