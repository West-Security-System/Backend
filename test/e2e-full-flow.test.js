const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `e2e-${process.pid}.db`);
const suffix = randomBytes(12).toString('hex');
const credentials = {
  admin: { username: `admin-${suffix}`, password: randomBytes(18).toString('hex') },
  guard: { username: `guard-${suffix}`, password: randomBytes(18).toString('hex') },
  temporary: { username: `temporary-${suffix}`, password: randomBytes(18).toString('hex') },
  wrong: { username: `wrong-${suffix}`, password: randomBytes(18).toString('hex') }
};
let server;
let baseUrl;
let adminCookie;
let guardCookie;
let guardId;
let serviceId;
let scheduleId;
let operationalRecord;

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
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.headers || {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  return { response, json: await response.json() };
}

async function login(user) {
  const result = await request('/api/login', { method: 'POST', body: user });
  assert.equal(result.response.status, 200);
  return result.response.headers.get('set-cookie').split(';')[0];
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Backend exited with code ${server.exitCode}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not start');
}

async function startServer() {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      SESSION_SECRET: randomBytes(32).toString('hex'),
      ADMIN_USERNAME: credentials.admin.username,
      ADMIN_PASSWORD: credentials.admin.password,
      NODE_ENV: 'test'
    },
    stdio: 'ignore'
  });
  await waitForServer();
}

async function createUser(user) {
  const result = await request('/api/admin/usuarios', {
    method: 'POST', cookie: adminCookie,
    body: { ...user, rol: 'guardia' }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.usuario;
}

async function createSchedule(service, days = [1, 2, 3, 4, 5, 6, 7]) {
  const result = await request('/api/admin/horarios', {
    method: 'POST', cookie: adminCookie,
    body: { servicio_id: service, dias: days, hora_inicio: '08:00', hora_fin: '16:00', capacidad: 2 }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.horario;
}

async function prepareFixtures() {
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
  await startServer();
  adminCookie = await login(credentials.admin);
  const guard = await createUser(credentials.guard);
  guardId = guard.id;
  guardCookie = await login(credentials.guard);
}

before(prepareFixtures);

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('clean start, role login, security headers, and protected admin access work', async () => {
  const health = await request('/api/health');
  const admin = await request('/api/me', { cookie: adminCookie });
  const guard = await request('/api/me', { cookie: guardCookie });
  assert.equal(health.response.status, 200);
  assert.equal(health.response.headers.get('x-powered-by'), null);
  assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.response.headers.get('x-frame-options'), 'DENY');
  assert.equal(health.response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(health.response.headers.get('cross-origin-resource-policy'), 'same-site');
  assert.equal(admin.json.data.user.rol, 'admin');
  assert.equal(guard.json.data.user.rol, 'guardia');
  assert.equal((await request('/api/admin/dashboard', { cookie: guardCookie })).response.status, 403);
});

async function exerciseUsersAndBlocks() {
  const temporary = await createUser(credentials.temporary);
  const updatedName = `${temporary.username}-updated`;
  const updated = await request('/api/admin/usuarios', {
    method: 'PUT', cookie: adminCookie,
    body: { id: temporary.id, username: updatedName }
  });
  const users = await request('/api/admin/usuarios', { cookie: adminCookie });
  assert.equal(updated.json.data.usuario.username, updatedName);
  assert.equal(users.json.data.usuarios.some((user) => user.id === temporary.id), true);
  assert.equal(Object.hasOwn(users.json.data.usuarios[0], 'password_hash'), false);
  const blocks = await request(`/api/admin/usuarios/${guardId}/bloqueos`, {
    method: 'PUT', cookie: adminCookie,
    body: { bloqueos: [{ tipo: 'fecha', fecha: '2099-12-30', motivo: 'e2e' }] }
  });
  assert.equal(blocks.response.status, 200);
  assert.equal(blocks.json.data.bloqueos.length, 1);
  await request(`/api/admin/usuarios/${guardId}/bloqueos`, { method: 'PUT', cookie: adminCookie, body: [] });
  return temporary.id;
}

async function exerciseLocationsAndSchedules() {
  const local = await request('/api/admin/locales', {
    method: 'POST', cookie: adminCookie,
    body: { nombre: `E2E-Service-${suffix}`, latitud: 0, longitud: 0 }
  });
  serviceId = local.json.data.local.id;
  const updatedLocal = await request('/api/admin/locales', {
    method: 'PUT', cookie: adminCookie,
    body: { id: serviceId, nombre: `E2E-Service-Updated-${suffix}`, latitud: 0, longitud: 0 }
  });
  assert.equal(updatedLocal.response.status, 200);
  assert.ok((await request('/api/admin/locales', { cookie: adminCookie })).json.data.locales.some((item) => item.id === serviceId));
  const disposable = await request('/api/admin/locales', {
    method: 'POST', cookie: adminCookie,
    body: { nombre: `E2E-Disposable-${suffix}`, latitud: 1, longitud: 1 }
  });
  assert.equal((await request('/api/admin/locales', { method: 'DELETE', cookie: adminCookie, body: { id: disposable.json.data.local.id } })).response.status, 200);
  const schedule = await createSchedule(serviceId);
  scheduleId = schedule.id;
  const updatedSchedule = await request('/api/admin/horarios', {
    method: 'PUT', cookie: adminCookie,
    body: { id: scheduleId, servicio_id: serviceId, dias: [1, 2, 3, 4, 5, 6, 7], hora_inicio: '08:00', hora_fin: '16:00', capacidad: 2 }
  });
  assert.equal(updatedSchedule.response.status, 200);
  assert.ok((await request(`/api/admin/horarios?servicio_id=${serviceId}`, { cookie: adminCookie })).json.data.horarios.some((item) => item.id === scheduleId));
  const disposableSchedule = await createSchedule(serviceId, [1]);
  assert.equal((await request('/api/admin/horarios', { method: 'DELETE', cookie: adminCookie, body: { id: disposableSchedule.id } })).response.status, 200);
}

async function exerciseAssignments(temporaryUserId) {
  const assigned = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST', cookie: adminCookie, body: { usuario_id: guardId }
  });
  const temporaryAssignment = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST', cookie: adminCookie, body: { usuario_id: temporaryUserId }
  });
  const assignments = await request(`/api/admin/horarios/${scheduleId}/guardias`, { cookie: adminCookie });
  assert.equal(assigned.response.status, 201);
  assert.equal(temporaryAssignment.response.status, 201);
  assert.equal(assignments.json.data.asignaciones.length, 2);
  assert.equal((await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'DELETE', cookie: adminCookie, body: { usuario_id: temporaryUserId }
  })).response.status, 200);
  assert.equal((await request('/api/admin/usuarios', {
    method: 'DELETE', cookie: adminCookie, body: { id: temporaryUserId }
  })).response.status, 200);
}

test('users, blocks, locales, schedules, and assignments complete CRUD flows', async () => {
  const temporaryUserId = await exerciseUsersAndBlocks();
  await exerciseLocationsAndSchedules();
  await exerciseAssignments(temporaryUserId);
});

test('check-in radius, duplicate active check-in, egress, and own history work', async () => {
  const outside = await request('/api/guardias', {
    method: 'POST', cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0.002 }
  });
  assert.equal(outside.response.status, 403);
  const checkedIn = await request('/api/guardias', {
    method: 'POST', cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0.0005 }
  });
  operationalRecord = checkedIn.json.data.registro;
  assert.equal(checkedIn.response.status, 201);
  assert.equal((await request('/api/guardias', {
    method: 'POST', cookie: guardCookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0 }
  })).response.status, 409);
  const egress = await request(`/api/guardias/${operationalRecord.id}/egreso`, {
    method: 'POST', cookie: guardCookie, body: { latitud: 0, longitud: 0 }
  });
  assert.equal(egress.response.status, 200);
  assert.equal(egress.json.data.registro.estado, 'cerrado');
  const history = await request('/api/mis-registros', { cookie: guardCookie });
  assert.equal(history.response.status, 200);
  assert.equal(history.json.data.registros[0].id, operationalRecord.id);
});

test('notifications, calendar, and monthly service values complete the flow', async () => {
  const notifications = await request('/api/notificaciones', { cookie: guardCookie });
  assert.equal(notifications.response.status, 200);
  assert.ok(notifications.json.data.notificaciones.length > 0);
  assert.equal((await request('/api/notificaciones/leidas', { method: 'POST', cookie: guardCookie })).response.status, 200);
  const current = new Date();
  const month = current.getUTCMonth() + 1;
  const year = current.getUTCFullYear();
  const calendar = await request(`/api/admin/calendario/${serviceId}?mes=${month}&anio=${year}`, { cookie: adminCookie });
  assert.equal(calendar.response.status, 200);
  assert.ok(calendar.json.data.dias.some((day) => day.registros.some((record) => record.id === operationalRecord.id)));
  const put = await request(`/api/admin/valores-mensuales/${serviceId}`, {
    method: 'PUT', cookie: adminCookie, body: { mes: month, anio: year, valor: 1250.5 }
  });
  const get = await request(`/api/admin/valores-mensuales/${serviceId}?mes=${month}&anio=${year}`, { cookie: adminCookie });
  assert.equal(put.response.status, 200);
  assert.equal(get.json.data.valor, 1250.5);
  assert.equal((await request(`/api/admin/valores-mensuales/${serviceId}`, {
    method: 'PUT', cookie: adminCookie, body: { mes: month, anio: year, valor: -1 }
  })).response.status, 422);
});

test('login rate limit blocks attempt 31 within the same IP window', async () => {
  for (let attempt = 0; attempt < 28; attempt += 1) {
    assert.equal((await request('/api/login', { method: 'POST', body: credentials.wrong })).response.status, 401);
  }
  const blocked = await request('/api/login', { method: 'POST', body: credentials.wrong });
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.json.error.code, 'LOGIN_RATE_LIMITED');
  assert.equal(Object.hasOwn(blocked.json.error, 'stack'), false);
});
