const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/operationalRecordsRepository');
const service = require('../src/services/operationalCalendarService');
const { monthRange } = require('../src/utils/monthRange');

const records = [
  { id: 1, hora_ingreso: '2025-12-31T23:59:59.000Z', hora_egreso: null },
  { id: 2, hora_ingreso: '2026-01-01T00:00:00.000Z', hora_egreso: null }
];

test('calendar separates December and January across the year boundary in UTC', (context) => {
  context.mock.method(repository, 'findService', (id) => ({ id, nombre: 'Servicio' }));
  context.mock.method(repository, 'listCalendar', ({ from, to }) => records.filter((record) => (
    Date.parse(record.hora_ingreso) >= Date.parse(from) && Date.parse(record.hora_ingreso) < Date.parse(to)
  )));
  const december = service.getMonthlyCalendar(7, { mes: '12', anio: '2025' });
  const january = service.getMonthlyCalendar(7, { mes: '1', anio: '2026' });
  assert.deepEqual(december.dias.flatMap((day) => day.registros.map((record) => record.id)), [1]);
  assert.deepEqual(january.dias.flatMap((day) => day.registros.map((record) => record.id)), [2]);
  assert.equal(monthRange('2', '2024').to, '2024-03-01T00:00:00.000Z');
});
