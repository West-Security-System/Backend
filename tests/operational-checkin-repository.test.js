const { test } = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/db');
const repository = require('../src/repositories/operationalCheckinRepository');

test('check-in repository delegates active turn lookup and close persistence', (context) => {
  const activeEntry = { id: 2, local_id: 3 };
  const closedEntry = { id: 2, estado: 'cerrado' };
  const closeData = { userId: 5, latitud: 1, longitud: 2, durationSeconds: 60 };
  context.mock.method(database, 'findOpenOperationalEntry', (userId) => {
    assert.equal(userId, 5);
    return activeEntry;
  });
  context.mock.method(database, 'closeOperationalEntry', (data) => {
    assert.deepEqual(data, closeData);
    return closedEntry;
  });

  assert.equal(repository.findOpenEntry(5), activeEntry);
  assert.equal(repository.closeEntry(closeData), closedEntry);
});
