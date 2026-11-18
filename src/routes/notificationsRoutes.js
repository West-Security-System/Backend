const express = require('express');
const { requireAuthenticated } = require('../middlewares/guardAuth');
const controller = require('../controllers/notificationsController');

const router = express.Router();
router.get('/notificaciones', requireAuthenticated, controller.listMine);
router.post('/notificaciones/leidas', requireAuthenticated, controller.markMineRead);

module.exports = router;