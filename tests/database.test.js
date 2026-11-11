const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const databasePath = path.join(__dirname, '..', 'data', `database-tests-${process.pid}.db`);
process.env.DATABASE_PATH = databasePath;
const database = require('../src/db');

let admin;
let guard;
let service;
let schedule;

before(async () => {
  await database.initDatabase();
  database.ensureAdminCredentials({ username: 'database-admin', passwordHash: 'admin-hash' });
  admin = database.findUserByUsername('database-admin');
  guard = database.insertUser({ username: 'database-guard', passwordHash: 'guard-hash', rol: 'guardia' });
  service = database.insertLocal({ nombre: 'Database service', latitud: 0, longitud: 0 });
  schedule = database.insertSchedule({
    servicioId: service.id,
    dias: [1, 2],
    horaInicio: '08:00',
    horaFin: '16:00',
    capacidad: 2
  });
});

after(async () => {
  await database.closeDatabase();
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('database user, credential, blocking, and assignment queries support their success and error paths', () => {
  assert.equal(database.findUserById(admin.id).username, 'database-admin');
  assert.equal(database.listUsers().length, 2);
  assert.throws(
    () => database.ensureAdminCredentials({ username: 'database-guard', passwordHash: 'hash' }),
    /ADMIN_USERNAME_CONFLICT/
  );
  assert.throws(
    () => database.insertUser({ username: 'database-guard', passwordHash: 'hash', rol: 'guardia' }),
    { status: 409, code: 'USERNAME_TAKEN' }
  );

  const extraUser = database.insertUser({ username: 'database-extra', passwordHash: 'hash', rol: 'guardia' });
  assert.equal(database.updateUserById(extraUser.id, { username: 'database-extra-updated', bloqueado: 1 }).bloqueado, 1);
  assert.throws(() => database.updateUserById(-1, {}), { status: 404, code: 'USER_NOT_FOUND' });
  assert.throws(
    () => database.updateUserById(extraUser.id, { username: 'database-guard' }),
    { status: 409, code: 'USERNAME_TAKEN' }
  );
  assert.equal(database.deleteUserById(extraUser.id).username, 'database-extra-updated');
  assert.throws(() => database.deleteUserById(-1), { status: 404, code: 'USER_NOT_FOUND' });

  const blocks = database.replaceGuardBlockDates(guard.id, [
    { tipo: 'fecha', fecha: '2026-11-12' },
    { tipo: 'rango', fecha_inicio: '2026-11-14', fecha_fin: '2026-11-16', motivo: 'personal' }
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(database.listGuardBlockDatesByUserId(guard.id).length, 2);
  database.insertAssignment({ userId: guard.id, fecha: '2026-11-12' });
  database.insertAssignment({ userId: guard.id, fecha: '2026-11-13', motivo: 'cobertura' });
  assert.deepEqual(database.findAssignmentsForUserInDates(guard.id, []), []);
  assert.equal(database.findAssignmentsForUserInDates(guard.id, ['2026-11-12']).length, 1);
  assert.equal(database.replaceGuardBlockDates(guard.id, []).length, 0);
});

test('database schedules, services, assignments, records, and relation checks are persisted', () => {
  assert.equal(database.findServiceById(service.id).id, service.id);
  assert.equal(database.findLocalByName(service.nombre).id, service.id);
  assert.equal(database.listLocales().length, 1);
  const extraService = database.insertLocal({ nombre: 'Disposable service', latitud: 1, longitud: 1 });
  assert.throws(
    () => database.insertLocal({ nombre: 'Disposable service', latitud: 2, longitud: 2 }),
    { status: 409, code: 'LOCAL_NAME_TAKEN' }
  );
  assert.equal(database.updateLocalById(extraService.id, { nombre: 'Updated disposable service' }).nombre, 'Updated disposable service');
  assert.throws(() => database.updateLocalById(-1, {}), { status: 404, code: 'LOCAL_NOT_FOUND' });
  assert.throws(
    () => database.updateLocalById(extraService.id, { nombre: service.nombre }),
    { status: 409, code: 'LOCAL_NAME_TAKEN' }
  );
  assert.equal(database.hasLocalRelations(extraService.id), false);
  assert.equal(database.deleteLocalById(extraService.id).nombre, 'Updated disposable service');
  assert.throws(() => database.deleteLocalById(extraService.id), { status: 404, code: 'LOCAL_NOT_FOUND' });

  assert.equal(database.listSchedules({ servicioId: service.id }).length, 1);
  assert.equal(database.findScheduleById(schedule.id).id, schedule.id);
  assert.equal(database.updateScheduleById(schedule.id, {
    servicioId: service.id,
    dias: [3],
    horaInicio: '09:00',
    horaFin: '17:00',
    capacidad: 3
  }).capacidad, 3);

  const assignment = database.insertScheduleAssignment({ usuarioId: guard.id, horarioId: schedule.id });
  assert.equal(database.findScheduleAssignment(guard.id, schedule.id).id, assignment.id);
  assert.equal(database.listScheduleAssignments(schedule.id).length, 1);
  assert.throws(
    () => database.insertScheduleAssignment({ usuarioId: guard.id, horarioId: schedule.id }),
    { status: 409, code: 'GUARD_ALREADY_ASSIGNED' }
  );
  assert.equal(database.findAssignedSchedule(guard.id, schedule.id).servicio_id, service.id);
  assert.equal(database.listGuardServices(guard.id)[0].id, service.id);
  assert.equal(database.findAssignedService(guard.id, 'DATABASE SERVICE').id, service.id);
  assert.equal(database.listGuardSchedules(guard.id, service.id).length, 1);

  const disposableSchedule = database.insertSchedule({
    servicioId: service.id,
    dias: [4],
    horaInicio: '10:00',
    horaFin: '18:00',
    capacidad: 1
  });
  assert.equal(database.deleteScheduleById(disposableSchedule.id).id, disposableSchedule.id);
  assert.equal(database.deleteScheduleById(disposableSchedule.id), null);
  assert.equal(database.deleteScheduleAssignment(guard.id, schedule.id).id, assignment.id);
  assert.equal(database.deleteScheduleAssignment(guard.id, schedule.id), null);

  assert.equal(database.hasLocalRelations(service.id), false);
  assert.equal(database.hasOpenOperationalEntry(guard.id), false);
  assert.equal(database.closeOperationalEntry({ userId: guard.id, latitud: 0, longitud: 0 }), null);
  const record = database.insertOperationalEntry({
    userId: guard.id,
    localId: service.id,
    scheduleId: schedule.id,
    latitud: 0,
    longitud: 0,
    timestamp: '2026-11-11T10:00:00.000Z'
  });
  assert.equal(record.estado, 'abierto');
  assert.equal(database.hasOpenOperationalEntry(guard.id), true);
  assert.equal(database.listOperationalRecords({ localId: service.id, userId: guard.id, activeOnly: true, limit: 10 }).length, 1);
  const closedRecord = database.closeOperationalEntry({ userId: guard.id, latitud: 0.1, longitud: 0.1 });
  assert.equal(closedRecord.estado, 'cerrado');
  assert.equal(database.hasOpenOperationalEntry(guard.id), false);
  assert.equal(database.listOperationalRecords({
    from: '2026-11-11T00:00:00Z',
    to: '2026-11-11T23:59:59Z',
    limit: 10
  }).length, 1);

});
