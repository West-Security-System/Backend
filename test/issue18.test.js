const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue18-${process.pid}.db`);
const suffix = randomBytes(12).toString('hex');
const credentials = {
  admin: { username: `admin-${suffix}`, password: randomBytes(18).toString('hex') },
  first: { username: `first-${suffix}`, password: randomBytes(18).toString('hex') },
  second: { username: `second-${suffix}`, password: randomBytes(18).toString('hex') },
  empty: { username: `empty-${suffix}`, password: randomBytes(18).toString('hex') }
};
let server;
let baseUrl;
let adminCookie;
let firstCookie;
let secondCookie;
let emptyCookie;
let firstUserId;
let secondUserId;
let serviceId;
let scheduleId;

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

async function closeEntry(cookie, id, coordinates = { latitud: 0, longitud: 0 }) {
  return request(`/api/guardias/${id}/egreso`, { method: 'POST', cookie, body: coordinates });
}

before(async () => {
  await startServer();
  adminCookie = await login(credentials.admin);
  firstUserId = await createGuard(credentials.first);
  secondUserId = await createGuard(credentials.second);
  await createGuard(credentials.empty);
  firstCookie = await login(credentials.first);
  secondCookie = await login(credentials.second);
  emptyCookie = await login(credentials.empty);
  await createServiceAndSchedule();
  await assignGuard(firstUserId);
  await assignGuard(secondUserId);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('egreso requires a session and valid coordinates', async () => {
  const unauthenticated = await closeEntry(undefined, 1);
  assert.equal(unauthenticated.response.status, 401);
  const missingCoordinates = await closeEntry(firstCookie, 1, {});
  assert.equal(missingCoordinates.response.status, 422);
  const invalidCoordinates = await closeEntry(firstCookie, 1, { latitud: 91, longitud: 0 });
  assert.equal(invalidCoordinates.response.status, 422);
});

test('the owner closes the same row once and a repeated exit is rejected', async () => {
  const entry = await createEntry(firstCookie);
  const closed = await closeEntry(firstCookie, entry.id);
  assert.equal(closed.response.status, 200);
  assert.equal(closed.json.data.registro.id, entry.id);
  assert.equal(closed.json.data.registro.estado, 'cerrado');
  assert.ok(closed.json.data.registro.hora_egreso);
  assert.equal(closed.json.data.registro.latitud_egreso, 0);
  assert.equal(closed.json.data.registro.longitud_egreso, 0);
  assert.ok(Number.isInteger(closed.json.data.registro.duracion_segundos));
  const repeated = await closeEntry(firstCookie, entry.id);
  assert.equal(repeated.response.status, 409);
  assert.equal(repeated.json.error.code, 'RECORD_ALREADY_CLOSED');
});

test('a guard cannot close another guard record and an admin can close it', async () => {
  const entry = await createEntry(secondCookie);
  const forbidden = await closeEntry(firstCookie, entry.id);
  assert.equal(forbidden.response.status, 403);
  const closed = await closeEntry(adminCookie, entry.id);
  assert.equal(closed.response.status, 200);
  assert.equal(closed.json.data.registro.id, entry.id);
});

test('egreso returns 404 for an absent record and 409 for a closed record', async () => {
  const absent = await closeEntry(firstCookie, 99999999);
  assert.equal(absent.response.status, 404);
  const entry = await createEntry(firstCookie);
  assert.equal((await closeEntry(firstCookie, entry.id)).response.status, 200);
  assert.equal((await closeEntry(firstCookie, entry.id)).response.status, 409);
});

test('history is private, includes open and closed rows, sorts newest first and paginates', async () => {
  const closedEntry = await createEntry(firstCookie);
  await closeEntry(firstCookie, closedEntry.id);
  const openEntry = await createEntry(firstCookie);
  const history = await request('/api/mis-registros', { cookie: firstCookie });
  const records = history.json.data.registros;
  assert.equal(history.response.status, 200);
  assert.ok(records.length >= 2);
  assert.equal(records[0].id, openEntry.id);
  assert.equal(records[0].estado, 'abierto');
  assert.equal(records[1].id, closedEntry.id);
  assert.equal(records[1].estado, 'cerrado');
  assert.ok(records.every((record) => record.usuario_id === firstUserId));
  assert.equal(records[0].local_nombre, `Service-${suffix}`);
  const page = await request('/api/mis-registros?limit=1&offset=1', { cookie: firstCookie });
  assert.equal(page.json.data.registros[0].id, closedEntry.id);
  const otherHistory = await request('/api/mis-registros', { cookie: secondCookie });
  assert.ok(otherHistory.json.data.registros.every((record) => record.usuario_id === secondUserId));
});

test('history requires a session and returns an empty collection for a guard without records', async () => {
  const unauthenticated = await request('/api/mis-registros');
  assert.equal(unauthenticated.response.status, 401);
  const emptyHistory = await request('/api/mis-registros', { cookie: emptyCookie });
  assert.equal(emptyHistory.response.status, 200);
  assert.deepEqual(emptyHistory.json.data.registros, []);
  const invalidPagination = await request('/api/mis-registros?limit=0', { cookie: emptyCookie });
  assert.equal(invalidPagination.response.status, 422);
});
