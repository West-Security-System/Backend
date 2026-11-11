const repository = require('../repositories/guardiasRepository');
const { distanceMeters } = require('../utils/geo');
const apiError = require('../utils/apiError');

const MAX_DISTANCE_METERS = 100;

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw apiError(422, 'INVALID_CHECKIN', `${field} debe ser un entero positivo.`, [field]);
  }
  return number;
}

function registerEntry(userId, body, coordinates) {
  const serviceId = positiveInteger(body?.servicio_id ?? body?.local_id, 'servicio_id');
  const scheduleId = positiveInteger(body?.horario_id, 'horario_id');
  const service = repository.findService(serviceId);
  if (!service) {
    throw apiError(422, 'INVALID_SERVICE', 'El servicio indicado no existe.', ['servicio_id']);
  }

  const schedule = repository.findSchedule(scheduleId);
  if (!schedule) {
    throw apiError(422, 'INVALID_SCHEDULE', 'El horario indicado no existe.', ['horario_id']);
  }
  const assignedSchedule = repository.findScheduleForGuard(userId, scheduleId);
  if (!assignedSchedule || Number(schedule.servicio_id) !== serviceId) {
    throw apiError(403, 'SCHEDULE_NOT_ASSIGNED', 'El horario no está asignado a este guardia para el servicio indicado.');
  }

  const distance = distanceMeters(service, coordinates);
  if (distance > MAX_DISTANCE_METERS) {
    throw apiError(403, 'OUTSIDE_SERVICE_RADIUS', 'El ingreso debe registrarse dentro de los 100 metros del servicio.');
  }
  if (repository.guardHasOpenEntry(userId)) {
    throw apiError(409, 'ACTIVE_ENTRY_EXISTS', 'Ya existe un ingreso abierto para este guardia.');
  }

  return repository.createEntry({
    userId,
    localId: serviceId,
    scheduleId,
    ...coordinates,
    timestamp: new Date().toISOString()
  });
}

module.exports = { registerEntry };
