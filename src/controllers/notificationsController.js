const service = require('../services/notificationsService');

function listMine(req, res, next) {
  try {
    return res.json({ data: service.listForUser(req.user.id, req.query), error: null });
  } catch (error) {
    return next(error);
  }
}

function markMineRead(req, res, next) {
  try {
    return res.json({ data: service.markAllRead(req.user.id), error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMine, markMineRead };