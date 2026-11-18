const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const notificationsRepository = require('../src/repositories/notificationsRepository');
const notificationsService = require('../src/services/notificationsService');

const databasePath = path.join(__dirname, '..', 'data', `issue19-${process.pid}.db`);
const suffix = randomBytes(12).toString('hex');
const credentials = {
  admin: { username: `admin-${suffix}`, password: randomBytes(18).toString('hex') },
  first: { username: `first-${suffix}`, password: randomBytes(18).toString('hex') },
  second: { username: `second-${suffix}`, password: randomBytes(18).toString('hex') }
};
let server;
let baseUrl;
let adminCookie;
let firstCookie;
let secondCookie;
let firstUserId;
let secondUserId;
let serviceId;
let scheduleId;
let firstRecord;
let secondRecord;

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
      ...(options.cookie ? { cookie: options.cookie } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
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

async function createGuard(user) {
  const result = await request('/api/admin/usuarios', {
    method: 'POST', cookie: adminCookie,
    body: { ...user, rol: 'guardia' }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.usuario.id;
}

async function createServiceAndSchedule() {
  const service = await request('/api/admin/locales', {
    method: 'POST', cookie: adminCookie,
    body: { nombre: `Service-${suffix}`, latitud: 0, longitud: 0 }
  });
  assert.equal(service.response.status, 201);
  serviceId = service.json.data.local.id;
  const schedule = await request('/api/admin/horarios', {
    method: 'POST', cookie: adminCookie,
    body: { servicio_id: serviceId, dias: [1], hora_inicio: '08:00', hora_fin: '16:00', capacidad: 2 }
  });
  assert.equal(schedule.response.status, 201);
  scheduleId = schedule.json.data.horario.id;
}

async function assignGuard(userId) {
  const result = await request(`/api/admin/horarios/${scheduleId}/guardias`, {
    method: 'POST', cookie: adminCookie, body: { usuario_id: userId }
  });
  assert.equal(result.response.status, 201);
}

async function createEntry(cookie) {
  const result = await request('/api/guardias', {
    method: 'POST', cookie,
    body: { servicio_id: serviceId, horario_id: scheduleId, latitud: 0, longitud: 0 }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.registro;
}

async function createFixtures() {
  await startServer();
  adminCookie = await login(credentials.admin);
  firstUserId = await createGuard(credentials.first);
  secondUserId = await createGuard(credentials.second);
  firstCookie = await login(credentials.first);
  secondCookie = await login(credentials.second);
  await createServiceAndSchedule();
  await assignGuard(firstUserId);
  await assignGuard(secondUserId);
  firstRecord = await createEntry(firstCookie);
  secondRecord = await createEntry(secondCookie);
  await request(`/api/guardias/${secondRecord.id}/egreso`, {
    method: 'POST', cookie: secondCookie, body: { latitud: 0, longitud: 0 }
  });
}

before(createFixtures);

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('notifications are private and report pending counts and the documented limit', async () => {
  const first = await request('/api/notificaciones?limit=1000', { cookie: firstCookie });
  const second = await request('/api/notificaciones', { cookie: secondCookie });
  assert.equal(first.response.status, 200);
  assert.equal(first.json.data.no_leidas, 1);
  assert.equal(first.json.data.limite, 100);
  assert.equal(first.json.data.limite_maximo, 100);
  assert.equal(first.json.data.notificaciones[0].titulo, 'Nueva asignación');
  assert.ok(first.json.data.notificaciones.every((item) => item.usuario_id === firstUserId));
  assert.equal(second.json.data.no_leidas, 1);
  assert.ok(second.json.data.notificaciones.every((item) => item.usuario_id === secondUserId));
  assert.notEqual(first.json.data.notificaciones[0].id, second.json.data.notificaciones[0].id);
  assert.equal((await request('/api/notificaciones?limit=0', { cookie: firstCookie })).response.status, 422);
});

test('notification maximum truncates repository results to one hundred', (context) => {
  context.mock.method(notificationsRepository, 'listByUser', (userId, limit) => (
    Array.from({ length: limit }, (_, index) => ({ id: index + 1, usuario_id: userId }))
  ));
  context.mock.method(notificationsRepository, 'countUnread', () => 150);
  const result = notificationsService.listForUser(72, { limit: '1000' });
  assert.equal(result.notificaciones.length, 100);
  assert.equal(result.no_leidas, 150);
});

test('marking notifications read is idempotent and user-scoped', async () => {
  const firstMark = await request('/api/notificaciones/leidas', { method: 'POST', cookie: firstCookie });
  const repeatedMark = await request('/api/notificaciones/leidas', { method: 'POST', cookie: firstCookie });
  const first = await request('/api/notificaciones', { cookie: firstCookie });
  const second = await request('/api/notificaciones', { cookie: secondCookie });
  assert.equal(firstMark.response.status, 200);
  assert.equal(firstMark.json.data.marcadas, 1);
  assert.equal(repeatedMark.response.status, 200);
  assert.equal(repeatedMark.json.data.marcadas, 0);
  assert.equal(first.json.data.no_leidas, 0);
  assert.equal(first.json.data.notificaciones[0].leida, 1);
  assert.ok(first.json.data.notificaciones[0].leida_at);
  assert.equal(second.json.data.no_leidas, 1);
});

test('admin active and record lists combine guard, service, state, date, and limit filters', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const active = await request(
    `/api/admin/activos?guardia_id=${firstUserId}&servicio_id=${serviceId}&estado=abierto&desde=${today}&hasta=${today}&limit=1`,
    { cookie: adminCookie }
  );
  const closed = await request(
    `/api/admin/registros?usuario_id=${secondUserId}&local_id=${serviceId}&estado=cerrado&desde=${today}&hasta=${today}&limit=1`,
    { cookie: adminCookie }
  );
  assert.equal(active.response.status, 200);
  assert.equal(active.json.data.registros.length, 1);
  assert.equal(active.json.data.registros[0].id, firstRecord.id);
  assert.equal(active.json.data.limite_maximo, 100);
  assert.equal(closed.response.status, 200);
  assert.equal(closed.json.data.registros.length, 1);
  assert.equal(closed.json.data.registros[0].id, secondRecord.id);
  assert.equal((await request('/api/admin/activos?estado=invalid', { cookie: adminCookie })).response.status, 422);
  assert.equal((await request('/api/admin/registros?guardia_id=0', { cookie: adminCookie })).response.status, 422);
});

test('admin record detail includes guard, local, and schedule; invalid and absent IDs are rejected', async () => {
  const detail = await request(`/api/admin/registros/${firstRecord.id}`, { cookie: adminCookie });
  const missing = await request('/api/admin/registros/99999999', { cookie: adminCookie });
  const invalid = await request('/api/admin/registros/not-an-id', { cookie: adminCookie });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.json.data.registro.id, firstRecord.id);
  assert.equal(detail.json.data.registro.guardia_username, credentials.first.username);
  assert.equal(detail.json.data.registro.local_nombre, `Service-${suffix}`);
  assert.equal(detail.json.data.registro.horario_hora_inicio, '08:00');
  assert.equal(missing.response.status, 404);
  assert.equal(invalid.response.status, 422);
});

test('admin operational routes reject anonymous and guard sessions', async () => {
  assert.equal((await request('/api/admin/activos')).response.status, 401);
  assert.equal((await request('/api/admin/registros', { cookie: firstCookie })).response.status, 403);
  assert.equal((await request(`/api/admin/registros/${firstRecord.id}`, { cookie: firstCookie })).response.status, 403);
});
