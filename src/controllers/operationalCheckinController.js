const service = require('../services/operationalCheckinService');

function checkIn(req, res, next) {
  try {
    const registro = service.checkIn(req.user.id, req.body, req.coordinates);
    return res.status(201).json({ data: { registro }, error: null });
  } catch (error) {
    return next(error);
  }
}

function checkOut(req, res, next) {
  try {
    const registro = service.checkOut(req.user.id, req.coordinates);
    return res.json({ data: { registro }, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { checkIn, checkOut };
