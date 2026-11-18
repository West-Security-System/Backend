const apiError = require('./apiError');

function parseInteger(value, field, minimum, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw apiError(422, 'INVALID_CALENDAR_RANGE', `${field} no es válido.`, [field]);
  }
  return number;
}

function startOfUtcMonth(year, zeroBasedMonth) {
  const date = new Date(0);
  date.setUTCFullYear(year, zeroBasedMonth, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function monthRange(monthValue, yearValue) {
  const month = parseInteger(monthValue, 'mes', 1, 12);
  const year = parseInteger(yearValue, 'anio', 1000, 9998);
  return {
    month,
    year,
    from: startOfUtcMonth(year, month - 1).toISOString(),
    to: startOfUtcMonth(year, month).toISOString()
  };
}

function groupByUtcDay(records) {
  const days = new Map();
  for (const record of records) {
    const day = record.hora_ingreso.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(record);
  }
  return [...days].map(([fecha, registros]) => ({ fecha, registros }));
}

module.exports = { monthRange, groupByUtcDay };