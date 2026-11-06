const apiError = require('./apiError');

function isCoordinate(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateCoordinates(coordinates = {}) {
  const { latitud, longitud } = coordinates || {};
  if (!isCoordinate(latitud, -90, 90)) {
    throw apiError(422, 'INVALID_LATITUDE', 'latitud debe ser un número entre -90 y 90.', ['latitud']);
  }
  if (!isCoordinate(longitud, -180, 180)) {
    throw apiError(422, 'INVALID_LONGITUDE', 'longitud debe ser un número entre -180 y 180.', ['longitud']);
  }
  return { latitud, longitud };
}

module.exports = { validateCoordinates };