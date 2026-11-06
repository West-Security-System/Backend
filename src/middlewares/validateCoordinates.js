const { validateCoordinates: validateCoordinatePair } = require('../utils/coordinates');

function validateCoordinates(req, res, next) {
  try {
    req.coordinates = validateCoordinatePair(req.body);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = validateCoordinates;
