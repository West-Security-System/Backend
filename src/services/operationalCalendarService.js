const repository = require('../repositories/operationalRecordsRepository');
const apiError = require('../utils/apiError');
const { positiveInteger } = require('../utils/operationalValidation');
const { serializeRecord } = require('./operationalSummaryService');
const { monthRange, groupByUtcDay } = require('../utils/monthRange');

function getMonthlyCalendar(rawServiceId, query = {}) {
  const serviceId = positiveInteger(rawServiceId, 'servicioId');
  if (!serviceId) throw apiError(422, 'INVALID_SERVICE_ID', 'servicioId debe ser un entero positivo.', ['servicioId']);
  const service = repository.findService(serviceId);
  if (!service) throw apiError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe.');
  const range = monthRange(query.mes, query.anio);
  const records = repository.listCalendar({ localId: serviceId, from: range.from, to: range.to });
  const serialized = records.map(serializeRecord);
  return {
    servicio: { id: service.id, nombre: service.nombre },
    mes: range.month,
    anio: range.year,
    dias: groupByUtcDay(serialized)
  };
}

module.exports = { getMonthlyCalendar };