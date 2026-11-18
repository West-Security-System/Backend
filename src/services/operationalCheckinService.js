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

function checkOutById(user, rawId, coordinates) {
  const entryId = Number(rawId);
  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    throw apiError(422, 'INVALID_RECORD_ID', 'El id del registro debe ser un entero positivo.', ['id']);
  }
  const entry = repository.findEntryById(entryId);
  if (!entry) throw apiError(404, 'RECORD_NOT_FOUND', 'El registro operativo no existe.');
  if (user.rol === 'guardia' && Number(entry.usuario_id) !== Number(user.id)) {
    throw apiError(403, 'FORBIDDEN', 'No puedes cerrar un registro de otro guardia.');
  }
  if (entry.hora_egreso || entry.estado === 'cerrado') {
    throw apiError(409, 'RECORD_ALREADY_CLOSED', 'El registro operativo ya está cerrado.');
  }

  const timestamp = new Date().toISOString();
  const durationSeconds = calculateDurationSeconds(entry.hora_ingreso, timestamp);
  const record = repository.closeEntryById({
    id: entryId, userId: entry.usuario_id, ...coordinates, timestamp, durationSeconds
  });
  if (!record) throw apiError(409, 'RECORD_ALREADY_CLOSED', 'El registro operativo ya está cerrado.');
  return record;
}

module.exports = { checkIn, checkOut, checkOutById };
