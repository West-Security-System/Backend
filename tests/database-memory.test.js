const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');

process.env.DATABASE_PATH = ':memory:';
const database = require('../src/db');

test('sql.js remains usable without filesystem writes in memory mode', async () => {
  await database.initDatabase();
  try {
    const user = database.insertUser({
      username: `memory-${process.pid}`,
      passwordHash: randomBytes(32).toString('hex'),
      rol: 'guardia'
    });
    assert.ok(user.id > 0);
    assert.equal(database.findUserById(user.id).username, user.username);
  } finally {
    await database.closeDatabase();
  }
});
