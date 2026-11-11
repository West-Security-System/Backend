const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/guardiasRepository');
const service = require('../src/services/guardiasService');

const coordinates = { latitud: 0, longitud: 0 };
const validBody = { servicio_id: 7, horario_id: 11 };

function stubRepository(context, overrides = {}) {
  const defaults = {
    findService: () => ({ id: 7, latitud: 0, longitud: 0 }),
    findSchedule: () => ({ id: 11, servicio_id: 7 }),
    findScheduleForGuard: () => ({ id: 11, servicio_id: 7 }),
    guardHasOpenEntry: () => false,
    createEntry: (entry) => entry
  };
  for (const [name, defaultImplementation] of Object.entries(defaults)) {
    context.mock.method(repository, name, overrides[name] || defaultImplementation);
  }
}

function assertApiError(error, status, code) {
  assert.equal(error.status, status);
  assert.equal(error.code, code);
  return true;
}

test('registerEntry stores an assigned check-in with its schedule and server timestamp', (context) => {
  let insertedEntry;
  stubRepository(context, {
    createEntry: (entry) => {
      insertedEntry = entry;
      return { id: 14, ...entry, estado: 'abierto' };
    }
  });

  const result = service.registerEntry(3, validBody, coordinates);

  assert.equal(result.estado, 'abierto');
  assert.equal(insertedEntry.userId, 3);
  assert.equal(insertedEntry.localId, 7);
  assert.equal(insertedEntry.scheduleId, 11);
  assert.equal(insertedEntry.latitud, 0);
  assert.ok(Number.isFinite(Date.parse(insertedEntry.timestamp)));
});

test('registerEntry rejects missing or nonexistent service and schedule identifiers with 422', (context) => {
  stubRepository(context, {
    findService: (serviceId) => serviceId === 7 ? { id: 7, latitud: 0, longitud: 0 } : null,
    findSchedule: (scheduleId) => scheduleId === 11 ? { id: 11, servicio_id: 7 } : null
  });
  assert.throws(() => service.registerEntry(3, {}, coordinates), (error) => assertApiError(error, 422, 'INVALID_CHECKIN'));
  assert.throws(() => service.registerEntry(3, { ...validBody, servicio_id: 99 }, coordinates), (error) => assertApiError(error, 422, 'INVALID_SERVICE'));
  assert.throws(() => service.registerEntry(3, { ...validBody, horario_id: 99 }, coordinates), (error) => assertApiError(error, 422, 'INVALID_SCHEDULE'));
});

test('registerEntry rejects schedules not assigned to the guard with 403', (context) => {
  stubRepository(context, { findScheduleForGuard: () => null });

  assert.throws(
    () => service.registerEntry(3, validBody, coordinates),
    (error) => assertApiError(error, 403, 'SCHEDULE_NOT_ASSIGNED')
  );
});

test('registerEntry rejects distances over 100 meters before checking or inserting an open entry', (context) => {
  let checkedOpenEntry = false;
  let inserted = false;
  stubRepository(context, {
    findService: () => ({ id: 7, latitud: 0, longitud: 0 }),
    guardHasOpenEntry: () => { checkedOpenEntry = true; return false; },
    createEntry: () => { inserted = true; }
  });

  assert.throws(
    () => service.registerEntry(3, validBody, { latitud: 0, longitud: 0.001 }),
    (error) => assertApiError(error, 403, 'OUTSIDE_SERVICE_RADIUS')
  );
  assert.equal(checkedOpenEntry, false);
  assert.equal(inserted, false);
});

test('registerEntry rejects a second open check-in with 409 and propagates repository failures', (context) => {
  stubRepository(context, { guardHasOpenEntry: () => true });
  assert.throws(
    () => service.registerEntry(3, validBody, coordinates),
    (error) => assertApiError(error, 409, 'ACTIVE_ENTRY_EXISTS')
  );

  context.mock.restoreAll();
  stubRepository(context, { createEntry: () => { throw new Error('database unavailable'); } });
  assert.throws(
    () => service.registerEntry(3, validBody, coordinates),
    { message: 'database unavailable' }
  );
});
