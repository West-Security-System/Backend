const repository = require('../repositories/operationalRecordsRepository');
const apiError = require('../utils/apiError');
const { serializeRecord } = require('./operationalSummaryService');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1000000;

function parseInteger(value, field, minimum, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw apiError(422, 'INVALID_PAGINATION', `${field} debe ser un entero válido.`, [field]);
  }
  return number;
}

function normalizePagination(query) {
  const requestedLimit = query.limit === undefined
    ? DEFAULT_LIMIT
    : parseInteger(query.limit, 'limit', 1, Number.MAX_SAFE_INTEGER);
  const offset = query.offset === undefined ? 0 : parseInteger(query.offset, 'offset', 0, MAX_OFFSET);
  return { limit: Math.min(requestedLimit, MAX_LIMIT), offset };
}

function listOwnRecords(userId, query = {}) {
  const pagination = normalizePagination(query);
  const records = repository.listForUser({ userId, ...pagination }).map(serializeRecord);
  return { registros: records, limite: pagination.limit, desplazamiento: pagination.offset };
}

module.exports = { listOwnRecords };