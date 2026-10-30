const service = require('../services/guardServicesService');

function listServices(req, res, next) {
  try {
    return res.json({ data: { servicios: service.listServices(req.user.id) }, error: null });
  } catch (error) {
    return next(error);
  }
}

function listSchedules(req, res, next) {
  try {
    return res.json({ data: service.listSchedules(req.user.id, req.params.nombre), error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listServices, listSchedules };
