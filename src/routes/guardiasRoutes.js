const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const requireGuardOrAdmin = require('../middlewares/guardAuth').requireGuardOrAdmin;
const validateCoordinates = require('../middlewares/validateCoordinates');
const controller = require('../controllers/guardiasController');
const checkinController = require('../controllers/operationalCheckinController');

const router = express.Router();
router.post('/guardias', requireGuard, validateCoordinates, controller.registerEntry);
router.post('/guardias/:id/egreso', requireGuardOrAdmin, validateCoordinates, checkinController.checkOutById);

module.exports = router;
