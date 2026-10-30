const express = require('express');
const requireGuard = require('../middlewares/guardAuth');
const controller = require('../controllers/guardServicesController');

const router = express.Router();
router.get('/mis-servicios', requireGuard, controller.listServices);
router.get('/servicio/:nombre/horarios', requireGuard, controller.listSchedules);

module.exports = router;
