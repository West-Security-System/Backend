const service = require('../services/operationalCalendarService');

function getMonthly(req, res, next) {
  try {
    const data = service.getMonthlyCalendar(req.params.servicioId, req.query);
    return res.json({ data, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMonthly };