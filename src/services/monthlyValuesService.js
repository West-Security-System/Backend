const repository = require('../repositories/monthlyValuesRepository');
const apiError = require('../utils/apiError');
const { positiveInteger } = require('../utils/operationalValidation');
const { monthRange } = require('../utils/monthRange');

function parseService(rawServiceId) {
  const serviceId = positiveInteger(rawServiceId, 'servicioId');
  if (!serviceId) throw apiError(422, 'INVALID_SERVICE_ID', 'servicioId debe ser un entero positivo.', ['servicioId']);
  const service = repository.findService(serviceId);
  if (!service) throw apiError(404, 'SERVICE_NOT_FOUND', 'El servicio no existe.');
  return { serviceId, service };
}

function getValue(rawServiceId, query = {}) {
  const { serviceId, service } = parseService(rawServiceId);
  const { month, year } = monthRange(query.mes, query.anio);
  const record = repository.find(serviceId, year, month);
  return {
    servicio: { id: service.id, nombre: service.nombre },
    anio: year,
    mes: month,
    valor: record?.valor ?? null,
    updated_at: record?.updated_at ?? null
  };
}

function setValue(rawServiceId, body = {}) {
  const { serviceId, service } = parseService(rawServiceId);
  const { month, year } = monthRange(body.mes, body.anio);
  if (typeof body.valor !== 'number' || !Number.isFinite(body.valor) || body.valor < 0) {
    throw apiError(422, 'INVALID_VALUE', 'valor debe ser un número no negativo.', ['valor']);
  }
  return repository.upsert({ serviceId, year, month, value: body.valor });
}

module.exports = { getValue, setValue };