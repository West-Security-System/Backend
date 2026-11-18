const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const databasePath = path.join(__dirname, '..', 'data', `transactions-${process.pid}.db`);
process.env.DATABASE_PATH = databasePath;
const database = require('../src/db');
let guard;
let schedule;

before(async () => {
  await database.initDatabase();
  guard = database.insertUser({ username: `transaction-${process.pid}`, passwordHash: randomBytes(32).toString('hex'), rol: 'guardia' });
  const service = database.insertLocal({ nombre: `transaction-service-${process.pid}`, latitud: 0, longitud: 0 });
  schedule = database.insertSchedule({ servicioId: service.id, dias: [1], horaInicio: '08:00', horaFin: '16:00', capacidad: 2 });
});

after(async () => {
  await database.closeDatabase();
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('block replacement rolls back the delete and earlier inserts on failure', () => {
  const original = database.replaceGuardBlockDates(guard.id, [
    { tipo: 'fecha', fecha: '2099-12-30', motivo: 'persisted' }
  ]);
  assert.throws(() => database.replaceGuardBlockDates(guard.id, [
    { tipo: 'fecha', fecha: '2099-12-31' },
    { tipo: 'invalid' }
  ]));
  assert.deepEqual(database.listGuardBlockDatesByUserId(guard.id), original);
});

test('schedule assignment and notification roll back together on duplicate assignment', () => {
  database.insertScheduleAssignment({ usuarioId: guard.id, horarioId: schedule.id });
  const initialNotifications = database.listNotificationsByUser(guard.id, 100);
  assert.equal(initialNotifications.length, 1);
  assert.throws(
    () => database.insertScheduleAssignment({ usuarioId: guard.id, horarioId: schedule.id }),
    { code: 'GUARD_ALREADY_ASSIGNED', status: 409 }
  );
  assert.equal(database.listNotificationsByUser(guard.id, 100).length, 1);
});
