const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue16-${process.pid}.db`);
let server;
let baseUrl;
let adminCookie;
let guardCookie;
let guardId;
let serviceId;
let scheduleId;
let unassignedScheduleId;

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { response, json: await response.json() };
}

async function login(username, password) {
  const result = await request('/api/login', { method: 'POST', body: { username, password } });
  assert.equal(result.response.status, 200);
  return result.response.headers.get('set-cookie').split(';')[0];
}

async function createSchedule(adminSession, id) {
  const result = await request('/api/admin/horarios', {
    method: 'POST',
    cookie: adminSession,
    body: { servicio_id: serviceId, dias: [1], hora_inicio: '08:00', hora_fin: '16:00', capacidad: 2 }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.horario.id;
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      SESSION_SECRET: 'issue16-test-secret',
      ADMIN_USERNAME: 'issue16-admin',
      ADMIN_PASSWORD: 'issue16-password',
      NODE_ENV: 'test'
    },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Backend exited with code ${server.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  adminCookie = await login('issue16-admin', 'issue16-password');
  const guard = await request('/api/admin/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { username: 'issue16-guard', password: 'guard-password', rol: 'guardia' }
  });
  assert.equal(guard.response.status, 201);
  guardId = guard.json.data.usuario.id;
  guardCookie = await login('issue16-guard', 'guard-password');

  const service = await request('/api/admin/locales', {
    method: 'POST',
    cookie: adminCookie,
    body: { nombre: 'Issue16 service', latitud: 0, longitud: 0 }
  });
  assert.equal(service.response.status, 201);
  serviceId = service.json.data.local.id;

  scheduleId = await createSchedule(adminCookie);
  unassignedScheduleId = await createSchedule(adminCookie);
  const assignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST',
    cookie: adminCookie,
    body: { usuario_id: guard.json.data.usuario.id }
  });
  assert.equal(assignment.response.status, 201);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('POST /api/guardias requires authentication and valid coordinates', async () => {
  const unauthenticated = await request('/api/guardias', {
    method: 'POST',
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0 }
  });
  assert.equal(unauthenticated.response.status, 401);

  const invalid = await request('/api/guardias', {
    method: 'POST',
    cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 91, longitud: 0 }
  });
  assert.equal(invalid.response.status, 422);
});

test('POST /api/guardias rejects unassigned schedules and locations outside 100 meters without insertion', async () => {
  const unassigned = await request('/api/guardias', {
    method: 'POST',
    cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: unassignedScheduleId, latitud: 0, longitud: 0 }
  });
  assert.equal(unassigned.response.status, 403);
  assert.equal(unassigned.json.error.code, 'SCHEDULE_NOT_ASSIGNED');

  const outsideRadius = await request('/api/guardias', {
    method: 'POST',
    cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0.001 }
  });
  assert.equal(outsideRadius.response.status, 403);
  assert.equal(outsideRadius.json.error.code, 'OUTSIDE_SERVICE_RADIUS');

  const records = await request('/api/admin/registros', { cookie: adminCookie });
  assert.deepEqual(records.json.data.registros, []);
});

test('POST /api/guardias accepts exactly 100 meters and stores an open timestamped entry; duplicate entry returns 409', async () => {
  const entry = await request('/api/guardias', {
    method: 'POST',
    cookie: guardCookie,
    body: {
      servicio_id: serviceId,
      horario_id: scheduleId,
      latitud: 0,
      longitud: 100 / 6371000 * (180 / Math.PI)
    }
  });

  assert.equal(entry.response.status, 201);
  assert.equal(entry.json.data.registro.estado, 'abierto');
  assert.equal(entry.json.data.registro.horario_id, scheduleId);
  assert.match(entry.json.data.registro.hora_ingreso, /^\d{4}-\d{2}-\d{2}T.*Z$/);

  const duplicate = await request('/api/guardias', {
    method: 'POST',
    cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0 }
  });
  assert.equal(duplicate.response.status, 409);

  const records = await request('/api/admin/activos', { cookie: adminCookie });
  assert.equal(records.json.data.registros.length, 1);
  assert.equal(records.json.data.registros[0].id, entry.json.data.registro.id);
});

test('admin, guard services, schedule, block-date, locale, CORS and logout endpoints validate their outcomes', async () => {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal((await request('/api/me', { cookie: guardCookie })).response.status, 200);
  assert.equal((await request('/api/admin/dashboard', { cookie: guardCookie })).response.status, 403);
  assert.equal((await request('/api/admin/dashboard', { cookie: adminCookie })).response.status, 200);

  assert.equal((await request('/api/mis-servicios', { cookie: guardCookie })).response.status, 200);
  assert.equal((await request('/api/servicio/Issue16%20service/horarios', { cookie: guardCookie })).response.status, 200);
  assert.equal((await request('/api/servicio/Unknown/horarios', { cookie: guardCookie })).response.status, 403);
  assert.equal((await request('/api/servicio/%20/horarios', { cookie: guardCookie })).response.status, 422);

  assert.equal((await request('/api/login', { method: 'POST', body: {} })).response.status, 401);
  assert.equal((await request('/api/login', {
    method: 'POST',
    body: { username: 'issue16-admin', password: 'wrong-password' }
  })).response.status, 401);
  const users = await request('/api/admin/usuarios', { cookie: adminCookie });
  assert.equal(users.response.status, 200);
  assert.equal(Object.hasOwn(users.json.data.usuarios[0], 'password_hash'), false);

  const requiredUser = await request('/api/admin/usuarios', { method: 'POST', cookie: adminCookie, body: {} });
  assert.equal(requiredUser.response.status, 422);
  const invalidRole = await request('/api/admin/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { username: 'invalid-role', password: 'password', rol: 'root' }
  });
  assert.equal(invalidRole.response.status, 422);
  const duplicateUser = await request('/api/admin/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { username: 'issue16-guard', password: 'password', rol: 'guardia' }
  });
  assert.equal(duplicateUser.response.status, 409);

  const temporaryGuard = await request('/api/admin/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { username: 'issue16-temporary', password: 'temporary-password', rol: 'guardia' }
  });
  assert.equal(temporaryGuard.response.status, 201);
  const temporaryGuardId = temporaryGuard.json.data.usuario.id;

  const invalidBlockDates = await request(`/api/admin/usuarios/${temporaryGuardId}/bloqueos`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { bloqueos: [{ tipo: 'unknown' }] }
  });
  assert.equal(invalidBlockDates.response.status, 422);
  const invalidRange = await request(`/api/admin/usuarios/${temporaryGuardId}/bloqueos`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { bloqueos: [{ tipo: 'rango', fecha_inicio: '2026-11-12', fecha_fin: '2026-11-11' }] }
  });
  assert.equal(invalidRange.response.status, 422);
  const blockedMonday = await request(`/api/admin/usuarios/${temporaryGuardId}/bloqueos`, {
    method: 'PUT',
    cookie: adminCookie,
    body: { bloqueos: [{ tipo: 'fecha', fecha: '2026-11-09' }] }
  });
  assert.equal(blockedMonday.response.status, 200);
  const blockedAssignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST',
    cookie: adminCookie,
    body: { usuario_id: temporaryGuardId }
  });
  assert.equal(blockedAssignment.response.status, 409);

  const clearBlocks = await request(`/api/admin/usuarios/${temporaryGuardId}/bloqueos`, {
    method: 'PUT',
    cookie: adminCookie,
    body: []
  });
  assert.equal(clearBlocks.response.status, 200);
  const secondAssignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST',
    cookie: adminCookie,
    body: { usuario_id: temporaryGuardId }
  });
  assert.equal(secondAssignment.response.status, 201);
  const listedAssignments = await request(`/api/admin/horarios/${scheduleId}/guardias`, { cookie: adminCookie });
  assert.equal(listedAssignments.json.data.asignaciones.length, 2);
  const capacityGuard = await request('/api/admin/usuarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { username: 'issue16-capacity', password: 'capacity-password', rol: 'guardia' }
  });
  const capacityAssignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST',
    cookie: adminCookie,
    body: { usuario_id: capacityGuard.json.data.usuario.id }
  });
  assert.equal(capacityAssignment.response.status, 409);

  assert.equal((await request('/api/admin/horarios', { cookie: adminCookie })).response.status, 200);
  assert.equal((await request(`/api/admin/horarios?servicio_id=${serviceId}`, { cookie: adminCookie })).response.status, 200);
  assert.equal((await request('/api/admin/horarios?servicio_id=0', { cookie: adminCookie })).response.status, 422);
  const updatedSchedule = await request('/api/admin/horarios', {
    method: 'PUT',
    cookie: adminCookie,
    body: {
      id: scheduleId,
      servicio_id: serviceId,
      dias: [1, 2],
      hora_inicio: '08:00',
      hora_fin: '16:00',
      capacidad: 2
    }
  });
  assert.equal(updatedSchedule.response.status, 200);
  const invalidSchedule = await request('/api/admin/horarios', {
    method: 'POST',
    cookie: adminCookie,
    body: { servicio_id: serviceId, dias: [], hora_inicio: '18:00', hora_fin: '08:00', capacidad: 0 }
  });
  assert.equal(invalidSchedule.response.status, 422);
  assert.equal((await request('/api/admin/horarios', {
    method: 'PUT',
    cookie: adminCookie,
    body: { id: 9999 }
  })).response.status, 404);
  assert.equal((await request('/api/admin/horarios', {
    method: 'DELETE',
    cookie: adminCookie,
    body: { id: unassignedScheduleId }
  })).response.status, 200);
  assert.equal((await request(`/api/admin/horarios/${unassignedScheduleId}/guardias`, { cookie: adminCookie })).response.status, 404);
  const removedAssignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'DELETE',
    cookie: adminCookie,
    body: { usuario_id: temporaryGuardId }
  });
  assert.equal(removedAssignment.response.status, 200);
  assert.equal((await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'DELETE',
    cookie: adminCookie,
    body: { usuario_id: temporaryGuardId }
  })).response.status, 404);

  assert.equal((await request('/api/admin/locales', { cookie: adminCookie })).response.status, 200);
  assert.equal((await request('/api/admin/locales', {
    method: 'POST',
    cookie: adminCookie,
    body: { nombre: '', latitud: 0, longitud: 0 }
  })).response.status, 422);
  assert.equal((await request('/api/admin/locales', {
    method: 'POST',
    cookie: adminCookie,
    body: { nombre: 'Issue16 service', latitud: 0, longitud: 0 }
  })).response.status, 409);
  const disposableLocal = await request('/api/admin/locales', {
    method: 'POST',
    cookie: adminCookie,
    body: { nombre: 'Disposable issue16 local', latitud: 1, longitud: 1 }
  });
  assert.equal(disposableLocal.response.status, 201);
  assert.equal((await request('/api/admin/locales', {
    method: 'PUT',
    cookie: adminCookie,
    body: { id: 9999, nombre: 'Missing local', latitud: 1, longitud: 1 }
  })).response.status, 404);
  const updatedLocal = await request('/api/admin/locales', {
    method: 'PUT',
    cookie: adminCookie,
    body: { id: disposableLocal.json.data.local.id, nombre: 'Updated disposable local', latitud: 1, longitud: 1 }
  });
  assert.equal(updatedLocal.response.status, 200);
  assert.equal((await request('/api/admin/locales', {
    method: 'DELETE',
    cookie: adminCookie,
    body: { id: updatedLocal.json.data.local.id }
  })).response.status, 200);

  const deniedOrigin = await request('/api/health', { headers: { origin: 'https://not-allowed.example' } });
  assert.equal(deniedOrigin.response.status, 403);
  const badRoute = await request('/api/not-a-route');
  assert.equal(badRoute.response.status, 404);
  assert.equal((await request('/api/logout', { method: 'POST', cookie: adminCookie })).response.status, 200);
  assert.equal((await request('/api/me', { cookie: adminCookie })).response.status, 401);

  assert.equal((await request('/api/admin/usuarios', {
    method: 'DELETE',
    cookie: adminCookie,
    body: { id: 0 }
  })).response.status, 401);
  assert.equal((await request('/api/login', {
    method: 'POST',
    body: { username: 'issue16-guard', password: 'guard-password' }
  })).response.status, 200);
});
