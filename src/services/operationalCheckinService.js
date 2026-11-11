const repository = require('../repositories/operationalCheckinRepository');
const apiError = require('../utils/apiError');
const { distanceMeters } = require('../utils/geo');
const { calculateDurationSeconds } = require('../utils/duration');

const MAX_DISTANCE_METERS = 100;

function parseLocalId(value) {
  const localId = Number(value);
  if (!Number.isInteger(localId) || localId <= 0 || !repository.localExists(localId)) {
    throw apiError(422, 'INVALID_LOCAL', 'local_id debe identificar un local válido.', ['local_id']);
  }
  return localId;
}

function checkIn(userId, body, coordinates) {
  const localId = parseLocalId(body?.local_id);
  return repository.createEntry({ userId, localId, ...coordinates });
}

function checkOut(userId, coordinates) {
  const activeEntry = repository.findOpenEntry(userId);
  if (!activeEntry) {
    throw apiError(404, 'ACTIVE_ENTRY_NOT_FOUND', 'No hay un ingreso activo para este guardia.');
  }
  const serviceCoordinates = {
    latitud: activeEntry.servicio_latitud,
    longitud: activeEntry.servicio_longitud
  };
  if (distanceMeters(serviceCoordinates, coordinates) > MAX_DISTANCE_METERS) {
    throw apiError(403, 'OUTSIDE_SERVICE_RADIUS', 'El egreso debe registrarse dentro de los 100 metros del servicio.');
  }

  const timestamp = new Date().toISOString();
  const durationSeconds = calculateDurationSeconds(activeEntry.hora_ingreso, timestamp);
  const record = repository.closeEntry({ userId, ...coordinates, timestamp, durationSeconds });
  if (!record) throw apiError(409, 'ACTIVE_ENTRY_CHANGED', 'El turno activo ya fue cerrado.');
  return record;
}

module.exports = { checkIn, checkOut };
