const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const validateCoordinates = require('../middlewares/validateCoordinates');
const controller = require('../controllers/guardiasController');

const router = express.Router();
router.post('/guardias', requireGuard, validateCoordinates, controller.registerEntry);

module.exports = router;
