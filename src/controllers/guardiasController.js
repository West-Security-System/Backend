const service = require('../services/guardiasService');

function registerEntry(req, res, next) {
  try {
    const registro = service.registerEntry(req.user.id, req.body, req.coordinates);
    return res.status(201).json({ data: { registro }, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { registerEntry };
