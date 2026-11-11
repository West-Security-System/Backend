const { test } = require('node:test');
const assert = require('node:assert/strict');
const database = require('../src/db');

test('user service validates input, hashes passwords, and reports duplicate names', async (context) => {
  const usersByName = new Map();
  context.mock.method(database, 'findUserByUsername', (username) => usersByName.get(username) || null);
  context.mock.method(database, 'insertUser', (user) => usersByName.set(user.username, user));
  delete require.cache[require.resolve('../src/users')];
  const { createUser } = require('../src/users');

  await assert.rejects(createUser({ username: '', password: '', rol: '' }), { status: 422, code: 'VALIDATION_ERROR' });
  await assert.rejects(createUser({ username: 'test', password: 'pass', rol: 'root' }), { status: 422, code: 'INVALID_ROLE' });
  assert.deepEqual(await createUser({ username: 'guard', password: 'password', rol: 'guardia' }), {
    username: 'guard',
    rol: 'guardia'
  });
  assert.notEqual(usersByName.get('guard').passwordHash, 'password');
  await assert.rejects(createUser({ username: 'guard', password: 'another', rol: 'guardia' }), {
    status: 409,
    code: 'USERNAME_TAKEN'
  });
});
