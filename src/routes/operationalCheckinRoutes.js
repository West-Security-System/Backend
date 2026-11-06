const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const validateCoordinates = require('../middlewares/validateCoordinates');
const controller = require('../controllers/operationalCheckinController');

const router = express.Router();
router.post('/ingreso', requireGuard, validateCoordinates, controller.checkIn);
router.post('/egreso', requireGuard, validateCoordinates, controller.checkOut);

module.exports = router;
