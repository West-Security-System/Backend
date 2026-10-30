const express = require('express');
const requireAdmin = require('../middlewares/adminAuth');
const controller = require('../controllers/operationalSummaryController');

const router = express.Router();
router.use(requireAdmin);
router.get('/activos', controller.listActive);
router.get('/registros', controller.listRecords);

module.exports = router;
