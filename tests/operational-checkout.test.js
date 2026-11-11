const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/operationalCheckinRepository');
const service = require('../src/services/operationalCheckinService');
const controller = require('../src/controllers/operationalCheckinController');

function activeEntry(overrides = {}) {
  return {
    hora_ingreso: new Date(Date.now() - 3600000).toISOString(),
    servicio_latitud: 0,
    servicio_longitud: 0,
    ...overrides
  };
}

function assertApiError(error, status, code) {
  assert.equal(error.status, status);
  assert.equal(error.code, code);
  return true;
}

test('checkOut closes an active turn and records its geolocation and duration', (context) => {
  let closed;
  const boundaryLatitude = (100 / 6371000) * (180 / Math.PI);
  context.mock.method(repository, 'findOpenEntry', () => activeEntry());
  context.mock.method(repository, 'closeEntry', (data) => {
    closed = data;
    return { id: 8, estado: 'cerrado', ...data };
  });

  const record = service.checkOut(4, { latitud: boundaryLatitude, longitud: 0 });

  assert.equal(record.estado, 'cerrado');
  assert.equal(closed.userId, 4);
  assert.equal(closed.latitud, boundaryLatitude);
  assert.equal(closed.longitud, 0);
  assert.ok(Number.isFinite(Date.parse(closed.timestamp)));
  assert.ok(closed.durationSeconds >= 3599);
});

test('checkOut returns 404 when no turn is active', (context) => {
  context.mock.method(repository, 'findOpenEntry', () => null);
  context.mock.method(repository, 'closeEntry', assert.fail);

  assert.throws(
    () => service.checkOut(4, { latitud: 0, longitud: 0 }),
    (error) => assertApiError(error, 404, 'ACTIVE_ENTRY_NOT_FOUND')
  );
});

test('checkOut rejects an exit outside the service radius without closing the turn', (context) => {
  context.mock.method(repository, 'findOpenEntry', () => activeEntry());
  context.mock.method(repository, 'closeEntry', assert.fail);

  assert.throws(
    () => service.checkOut(4, { latitud: 0, longitud: 0.002 }),
    (error) => assertApiError(error, 403, 'OUTSIDE_SERVICE_RADIUS')
  );
});

test('checkOut reports a concurrent close as 409', (context) => {
  context.mock.method(repository, 'findOpenEntry', () => activeEntry());
  context.mock.method(repository, 'closeEntry', () => null);

  assert.throws(
    () => service.checkOut(4, { latitud: 0, longitud: 0 }),
    (error) => assertApiError(error, 409, 'ACTIVE_ENTRY_CHANGED')
  );
});

test('checkOut controller returns 200 and forwards service errors', (context) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const record = { id: 8, estado: 'cerrado' };
  context.mock.method(service, 'checkOut', () => record);
  controller.checkOut({ user: { id: 4 }, coordinates: {} }, response, assert.fail);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { data: { registro: record }, error: null });

  context.mock.restoreAll();
  const failure = new Error('repository unavailable');
  context.mock.method(service, 'checkOut', () => { throw failure; });
  let forwarded;
  controller.checkOut({ user: { id: 4 }, coordinates: {} }, response, (error) => { forwarded = error; });
  assert.equal(forwarded, failure);
});
