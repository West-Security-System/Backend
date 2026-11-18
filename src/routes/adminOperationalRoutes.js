const express = require('express');
const requireAdmin = require('../middlewares/adminAuth');
const controller = require('../controllers/operationalSummaryController');
const adminController = require('../controllers/operationalAdminController');
const calendarController = require('../controllers/operationalCalendarController');

const router = express.Router();
router.use(requireAdmin);
router.get('/activos', controller.listActive);
router.get('/registros', controller.listRecords);
router.get('/registros/:id', controller.getRecord);
router.patch('/registros/:id/cerrar', adminController.closeRecord);
router.delete('/registros', adminController.deleteRecords);
router.get('/calendario/:servicioId', calendarController.getMonthly);

module.exports = router;
