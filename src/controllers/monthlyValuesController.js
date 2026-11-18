const service = require('../services/monthlyValuesService');

function getValue(req, res, next) {
  try {
    const data = service.getValue(req.params.servicioId, req.query);
    return res.json({ data, error: null });
  } catch (error) {
    return next(error);
  }
}

function setValue(req, res, next) {
  try {
    const valorMensual = service.setValue(req.params.servicioId, req.body);
    return res.json({ data: { valor_mensual: valorMensual }, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getValue, setValue };