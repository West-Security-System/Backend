const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/operationalRecordsRepository');
const service = require('../src/services/operationalSummaryService');
const controller = require('../src/controllers/operationalSummaryController');

test('operational summary normalizes filters, serializes timestamps, and caps limits', (context) => {
  const records = [{
    id: 1,
    hora_ingreso: '2026-11-11 10:00:00',
    hora_egreso: 'invalid'
  }];
  let filters;
  context.mock.method(repository, 'list', (receivedFilters) => {
    filters = receivedFilters;
    return records;
  });

  const result = service.getSummary({
    limit: '1000',
    desde: '2026-11-11',
    hasta: '2026-11-11',
    local_id: '3',
    usuario_id: '4'
  }, true);

  assert.equal(filters.limit, 100);
  assert.equal(filters.localId, 3);
  assert.equal(filters.userId, 4);
  assert.equal(filters.activeOnly, true);
  assert.equal(result.registros[0].hora_ingreso, '2026-11-11T10:00:00.000Z');
  assert.equal(result.registros[0].hora_egreso, null);
  assert.equal(result.limite, 100);
});

test('operational summary rejects invalid filters and preserves an absent end time', (context) => {
  context.mock.method(repository, 'list', () => [{ hora_ingreso: '2026-11-11T10:00:00Z', hora_egreso: null }]);

  for (const query of [
    { desde: '2026-02-30' },
    { desde: '2026-11-12', hasta: '2026-11-11' },
    { limit: '0' },
    { usuario_id: '-1' },
    { local_id: '1.2' }
  ]) {
    assert.throws(() => service.getSummary(query), { status: 422 });
  }
  assert.equal(service.getSummary({}).registros[0].hora_egreso, null);
});

test('summary controllers return both summaries and forward repository failures', (context) => {
  context.mock.method(service, 'getSummary', (query, active) => ({ query, active }));
  const response = { json(body) { this.body = body; return this; } };
  controller.listActive({ query: { local_id: '2' } }, response, assert.fail);
  assert.deepEqual(response.body, { data: { query: { local_id: '2' }, active: true }, error: null });
  controller.listRecords({ query: {} }, response, assert.fail);
  assert.deepEqual(response.body, { data: { query: {}, active: false }, error: null });

  const failure = new Error('records unavailable');
  context.mock.method(service, 'getSummary', () => { throw failure; });
  let forwarded;
  controller.listRecords({ query: {} }, response, (error) => { forwarded = error; });
  assert.equal(forwarded, failure);
});
