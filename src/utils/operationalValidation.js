const apiError = require('./apiError');

const MAX_DELETE_IDS = 500;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function positiveInteger(value, field) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw apiError(422, 'INVALID_FILTER', `${field} debe ser un entero positivo.`, [field]);
  }
  return number;
}

function parseIdList(ids) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_DELETE_IDS) {
    throw apiError(422, 'INVALID_IDS', `ids debe contener entre 1 y ${MAX_DELETE_IDS} valores.`, ['ids']);
  }
  return [...new Set(ids.map((id) => positiveInteger(id, 'ids')))];
}

function parseIsoTimestamp(value, field) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) {
    throw apiError(422, 'INVALID_TIMESTAMP', `${field} debe ser una fecha ISO 8601 válida.`, [field]);
  }
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  const timestamp = Date.parse(value);
  if (calendarDate.toISOString().slice(0, 10) !== datePart || !Number.isFinite(timestamp)) {
    throw apiError(422, 'INVALID_TIMESTAMP', `${field} debe ser una fecha ISO 8601 válida.`, [field]);
  }
  return new Date(timestamp).toISOString();
}

module.exports = { positiveInteger, parseIdList, parseIsoTimestamp };