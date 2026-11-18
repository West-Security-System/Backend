const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue20-${process.pid}.db`);
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
  const secondUserId = await createGuard(credentials.second);
  firstCookie = await login(credentials.first);
  secondCookie = await login(credentials.second);
  await createServiceAndSchedule();
  await assignGuard(firstUserId);
  await assignGuard(secondUserId);
  firstRecord = await createEntry(firstCookie);
  secondRecord = await createEntry(secondCookie);
}

before(createFixtures);

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('admin closes a record with a later ISO timestamp and rejects inconsistent times', async () => {
  const start = Date.parse(firstRecord.hora_ingreso);
  const earlier = new Date(start - 1000).toISOString();
  const later = new Date(start + 3600000).toISOString();
  const invalid = await request(`/api/admin/registros/${firstRecord.id}/cerrar`, {
    method: 'PATCH', cookie: adminCookie, body: { hora_egreso: earlier }
  });
  const missingTime = await request(`/api/admin/registros/${firstRecord.id}/cerrar`, {
    method: 'PATCH', cookie: adminCookie, body: {}
  });
  assert.equal(invalid.response.status, 422);
  assert.equal(missingTime.response.status, 422);
  const closed = await request(`/api/admin/registros/${firstRecord.id}/cerrar`, {
    method: 'PATCH', cookie: adminCookie, body: { hora_egreso: later }
  });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.json.data.registro.estado, 'cerrado');
  assert.equal(closed.json.data.registro.duracion_segundos, 3600);
  assert.equal(closed.json.data.registro.hora_egreso, later);
});

test('admin record writes reject anonymous and guard sessions', async () => {
  const route = `/api/admin/registros/${secondRecord.id}/cerrar`;
  const calendarRoute = `/api/admin/calendario/${serviceId}?mes=11&anio=2026`;
  assert.equal((await request(route, { method: 'PATCH', body: { hora_egreso: new Date().toISOString() } })).response.status, 401);
  assert.equal((await request(route, { method: 'PATCH', cookie: firstCookie, body: { hora_egreso: new Date().toISOString() } })).response.status, 403);
  assert.equal((await request('/api/admin/registros', { method: 'DELETE', body: { ids: [secondRecord.id] } })).response.status, 401);
  assert.equal((await request(calendarRoute)).response.status, 401);
  assert.equal((await request(calendarRoute, { cookie: firstCookie })).response.status, 403);
});

test('monthly calendar orders current activity, returns empty periods, and validates scope', async () => {
  const current = new Date();
  const month = current.getUTCMonth() + 1;
  const year = current.getUTCFullYear();
  const calendar = await request(`/api/admin/calendario/${serviceId}?mes=${month}&anio=${year}`, { cookie: adminCookie });
  const empty = await request(`/api/admin/calendario/${serviceId}?mes=1&anio=2000`, { cookie: adminCookie });
  const invalidMonth = await request(`/api/admin/calendario/${serviceId}?mes=13&anio=${year}`, { cookie: adminCookie });
  const invalidYear = await request(`/api/admin/calendario/${serviceId}?mes=1&anio=nope`, { cookie: adminCookie });
  const invalidServiceId = await request('/api/admin/calendario/not-an-id?mes=1&anio=2026', { cookie: adminCookie });
  const missingService = await request('/api/admin/calendario/99999999?mes=1&anio=2026', { cookie: adminCookie });
  assert.equal(calendar.response.status, 200);
  assert.deepEqual(calendar.json.data.dias.flatMap((day) => day.registros.map((record) => record.id)), [firstRecord.id, secondRecord.id]);
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.json.data.dias, []);
  assert.equal(invalidMonth.response.status, 422);
  assert.equal(invalidYear.response.status, 422);
  assert.equal(invalidServiceId.response.status, 422);
  assert.equal(missingService.response.status, 404);
});

test('mixed bulk deletion reports removed and missing IDs without touching unselected rows', async () => {
  const preserved = await createEntry(firstCookie);
  const absentId = 99999999;
  const result = await request('/api/admin/registros', {
    method: 'DELETE', cookie: adminCookie,
    body: { ids: [firstRecord.id, secondRecord.id, absentId] }
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json.data.resultado, {
    cantidad_eliminada: 2,
    ids_eliminados: [firstRecord.id, secondRecord.id],
    ids_no_encontrados: [absentId]
  });
  assert.equal((await request(`/api/admin/registros/${firstRecord.id}`, { cookie: adminCookie })).response.status, 404);
  assert.equal((await request(`/api/admin/registros/${preserved.id}`, { cookie: adminCookie })).response.status, 200);
  const empty = await request('/api/admin/registros', { method: 'DELETE', cookie: adminCookie, body: { ids: [] } });
  const invalid = await request('/api/admin/registros', { method: 'DELETE', cookie: adminCookie, body: { ids: [preserved.id, 0] } });
  assert.equal(empty.response.status, 422);
  assert.equal(invalid.response.status, 422);
  assert.equal((await request(`/api/admin/registros/${preserved.id}`, { cookie: adminCookie })).response.status, 200);
});
