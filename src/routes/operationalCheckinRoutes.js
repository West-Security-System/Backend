const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const validateCoordinates = require('../middlewares/validateCoordinates');
const controller = require('../controllers/operationalCheckinController');

const router = express.Router();
router.post('/ingreso', requireGuard, validateCoordinates, controller.checkIn);
const checkOut = [requireGuard, validateCoordinates, controller.checkOut];
router.post('/egreso', ...checkOut);
router.post('/guardias/egreso', ...checkOut);

module.exports = router;
