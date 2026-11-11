const { test } = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/db');

test('guardias repository delegates service, assignment, active-entry and insert operations', (context) => {
  const service = { id: 7 };
  const schedule = { id: 11 };
  const inserted = { id: 14 };
  const calls = [];
  context.mock.method(database, 'findLocalById', (id) => { calls.push(['service', id]); return service; });
  context.mock.method(database, 'findScheduleById', (id) => { calls.push(['schedule', id]); return schedule; });
  context.mock.method(database, 'findAssignedSchedule', (userId, id) => {
    calls.push(['assignment', userId, id]);
    return schedule;
  });
  context.mock.method(database, 'hasOpenOperationalEntry', (userId) => {
    calls.push(['open-entry', userId]);
    return false;
  });
  context.mock.method(database, 'insertOperationalEntry', (entry) => {
    calls.push(['insert', entry]);
    return inserted;
  });

  delete require.cache[require.resolve('../src/repositories/guardiasRepository')];
  const repository = require('../src/repositories/guardiasRepository');
  const entry = { userId: 3, localId: 7, scheduleId: 11 };

  assert.equal(repository.findService(7), service);
  assert.equal(repository.findSchedule(11), schedule);
  assert.equal(repository.findScheduleForGuard(3, 11), schedule);
  assert.equal(repository.guardHasOpenEntry(3), false);
  assert.equal(repository.createEntry(entry), inserted);
  assert.deepEqual(calls, [
    ['service', 7],
    ['schedule', 11],
    ['assignment', 3, 11],
    ['open-entry', 3],
    ['insert', entry]
  ]);
});
