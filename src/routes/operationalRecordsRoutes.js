const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const controller = require('../controllers/operationalRecordsController');

const router = express.Router();
router.get('/mis-registros', requireGuard, controller.listMine);

module.exports = router;