const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const databasePath = path.join(__dirname, '..', 'data', `legacy-database-${process.pid}.db`);
process.env.DATABASE_PATH = databasePath;
const database = require('../src/db');

before(async () => {
  const SQL = await initSqlJs();
  const legacyDatabase = new SQL.Database();
  legacyDatabase.run(`
    CREATE TABLE registros_operativos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      local_id INTEGER NOT NULL,
      hora_ingreso TEXT NOT NULL,
      hora_egreso TEXT,
      observaciones TEXT
    );
    INSERT INTO registros_operativos (usuario_id, local_id, hora_ingreso, hora_egreso)
    VALUES (1, 1, '2026-11-10T08:00:00.000Z', '2026-11-10T16:00:00.000Z');
    INSERT INTO registros_operativos (usuario_id, local_id, hora_ingreso)
    VALUES (1, 1, '2026-11-11T08:00:00.000Z');
  `);
  fs.writeFileSync(databasePath, Buffer.from(legacyDatabase.export()));
  legacyDatabase.close();
  await database.initDatabase();
  database.ensureAdminCredentials({ username: 'migration-admin', passwordHash: 'hash' });
  database.insertLocal({ nombre: 'Migration service', latitud: 0, longitud: 0 });
});

after(async () => {
  await database.closeDatabase();
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('database migration adds check-in columns and preserves legacy open and closed records', () => {
  const records = database.listOperationalRecords({ limit: 10 });
  assert.equal(records.length, 2);
  assert.equal(records.find((record) => record.hora_egreso)?.estado, 'cerrado');
  assert.equal(records.find((record) => !record.hora_egreso)?.estado, 'abierto');

  const closed = database.closeOperationalEntry({ userId: 1, latitud: 0, longitud: 0 });
  assert.equal(closed.estado, 'cerrado');
  assert.equal(closed.horario_id, null);
});
