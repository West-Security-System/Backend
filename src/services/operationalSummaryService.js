const repository = require('../repositories/operationalRecordsRepository');
const apiError = require('../utils/apiError');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function normalizeDate(value, field, endOfDay = false) {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw apiError(422, 'INVALID_DATE', `${field} debe ser una fecha ISO válida.`, [field]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (date.toISOString().slice(0, 10) !== value) throw apiError(422, 'INVALID_DATE', `${field} debe ser una fecha ISO válida.`, [field]);
    return date.toISOString();
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) throw apiError(422, 'INVALID_DATE', `${field} debe usar formato ISO 8601.`, [field]);
  return parsed.toISOString();
}

function positiveInteger(value, field) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw apiError(422, 'INVALID_FILTER', `${field} debe ser un entero positivo.`, [field]);
  return number;
}

function normalizeFilters(query, activeOnly) {
  const limitValue = query.limit === undefined ? DEFAULT_LIMIT : positiveInteger(query.limit, 'limit');
  const from = normalizeDate(query.desde, 'desde');
  const to = normalizeDate(query.hasta, 'hasta', true);
  if (from && to && from > to) throw apiError(422, 'INVALID_DATE_RANGE', 'desde no puede ser posterior a hasta.', ['desde', 'hasta']);
  return {
    localId: positiveInteger(query.local_id, 'local_id'),
    userId: positiveInteger(query.usuario_id, 'usuario_id'),
    from,
    to,
    limit: Math.min(limitValue, MAX_LIMIT),
    activeOnly
  };
}

function isoTimestamp(value) {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serialize(record) {
  return { ...record, hora_ingreso: isoTimestamp(record.hora_ingreso), hora_egreso: isoTimestamp(record.hora_egreso) };
}

function getSummary(query, activeOnly = false) {
  const filters = normalizeFilters(query, activeOnly);
  const registros = repository.list(filters).map(serialize);
  return { registros, limite: filters.limit };
}

module.exports = { getSummary };
