const repository = require('../repositories/operationalRecordsRepository');
const apiError = require('../utils/apiError');
const { calculateDurationSeconds } = require('../utils/duration');
const { positiveInteger, parseIdList, parseIsoTimestamp } = require('../utils/operationalValidation');

function closeRecord(rawId, body = {}) {
  const id = positiveInteger(rawId, 'id');
  if (!id) throw apiError(422, 'INVALID_FILTER', 'id debe ser un entero positivo.', ['id']);
  const horaEgreso = parseIsoTimestamp(body.hora_egreso, 'hora_egreso');
  const record = repository.findById(id);
  if (!record) throw apiError(404, 'RECORD_NOT_FOUND', 'El registro operativo no existe.');
  if (record.hora_egreso || record.estado === 'cerrado') {
    throw apiError(409, 'RECORD_ALREADY_CLOSED', 'El registro operativo ya está cerrado.');
  }
  if (Date.parse(horaEgreso) <= Date.parse(record.hora_ingreso)) {
    throw apiError(422, 'INVALID_EGRESS_TIME', 'hora_egreso debe ser posterior a hora_ingreso.', ['hora_egreso']);
  }
  const durationSeconds = calculateDurationSeconds(record.hora_ingreso, horaEgreso);
  const closed = repository.closeByAdmin({ id, horaEgreso, durationSeconds });
  if (!closed) throw apiError(409, 'RECORD_ALREADY_CLOSED', 'El registro operativo ya está cerrado.');
  return closed;
}

function deleteRecords(rawIds) {
  const ids = parseIdList(rawIds);
  const result = repository.deleteMany(ids);
  return {
    cantidad_eliminada: result.deletedIds.length,
    ids_eliminados: result.deletedIds,
    ids_no_encontrados: result.notFoundIds
  };
}

module.exports = { closeRecord, deleteRecords };