const repository = require('../repositories/operationalCheckinRepository');
const apiError = require('../utils/apiError');

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
  const record = repository.closeEntry({ userId, ...coordinates });
  if (!record) throw apiError(404, 'ACTIVE_ENTRY_NOT_FOUND', 'No hay un ingreso activo para este guardia.');
  return record;
}

module.exports = { checkIn, checkOut };
