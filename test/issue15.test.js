const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue15-${process.pid}.db`);
let server;
let baseUrl;
let adminCookie;
let guardCookie;
let localId;

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
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.cookie ? { cookie: options.cookie } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return { response, json: await response.json() };
}

async function login(username, password) {
  const result = await request('/api/login', { method: 'POST', body: { username, password } });
  assert.equal(result.response.status, 200);
  return result.response.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, SESSION_SECRET: 'issue15-test-secret', ADMIN_USERNAME: 'issue15-admin', ADMIN_PASSWORD: 'issue15-password' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Backend exited with code ${server.exitCode}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  adminCookie = await login('issue15-admin', 'issue15-password');
  const guard = await request('/api/admin/usuarios', {
    method: 'POST', cookie: adminCookie,
    body: { username: 'issue15-guard', password: 'guard-password', rol: 'guardia' }
  });
  assert.equal(guard.response.status, 201);
  guardCookie = await login('issue15-guard', 'guard-password');
  const local = await request('/api/admin/locales', {
    method: 'POST', cookie: adminCookie,
    body: { nombre: 'Issue15 local', latitud: -32.9, longitud: -68.8 }
  });
  assert.equal(local.response.status, 201);
  localId = local.json.data.local.id;
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('Issue 15 rejects invalid coordinates before marking and stores valid check-in/out', async () => {
  for (const coordinates of [
    { latitud: null, longitud: 0 },
    { latitud: '10', longitud: 0 },
    { latitud: 0, longitud: '10' }
  ]) {
    const invalidLocal = await request('/api/admin/locales', {
      method: 'POST', cookie: adminCookie,
      body: { nombre: `Invalid local ${String(coordinates.latitud)}`, ...coordinates }
    });
    assert.equal(invalidLocal.response.status, 422);
  }

  const invalidCoordinates = [
    {},
    { latitud: null, longitud: 0 },
    { latitud: '10', longitud: 0 },
    { latitud: 91, longitud: 0 },
    { latitud: 0, longitud: -181 }
  ];
  for (const coordinates of invalidCoordinates) {
    const invalid = await request('/api/ingreso', {
      method: 'POST', cookie: guardCookie, body: { local_id: localId, ...coordinates }
    });
    assert.equal(invalid.response.status, 422);
  }
  const empty = await request('/api/admin/activos', { cookie: adminCookie });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.json.data.registros, []);

  const unauthenticatedExit = await request('/api/guardias/egreso', {
    method: 'POST',
    body: { latitud: -32.9, longitud: -68.8 }
  });
  assert.equal(unauthenticatedExit.response.status, 401);
  const missingActiveExit = await request('/api/guardias/egreso', {
    method: 'POST',
    cookie: guardCookie,
    body: { latitud: -32.9, longitud: -68.8 }
  });
  assert.equal(missingActiveExit.response.status, 404);

  const entered = await request('/api/ingreso', {
    method: 'POST', cookie: guardCookie,
    body: { local_id: localId, latitud: -32.9, longitud: -68.8 }
  });
  assert.equal(entered.response.status, 201);
  assert.equal(entered.json.data.registro.latitud_ingreso, -32.9);
  const outsideRadiusExit = await request('/api/guardias/egreso', {
    method: 'POST',
    cookie: guardCookie,
    body: { latitud: 0, longitud: 0 }
  });
  assert.equal(outsideRadiusExit.response.status, 403);
  const active = await request('/api/admin/activos', { cookie: adminCookie });
  assert.equal(active.response.status, 200);
  assert.equal(active.json.data.registros.length, 1);
  assert.equal(active.json.data.registros[0].id, entered.json.data.registro.id);
  const missingExitCoordinates = await request('/api/egreso', { method: 'POST', cookie: guardCookie, body: {} });
  assert.equal(missingExitCoordinates.response.status, 422);
  const exited = await request('/api/guardias/egreso', {
    method: 'POST', cookie: guardCookie, body: { latitud: -32.9001, longitud: -68.8 }
  });
  assert.equal(exited.response.status, 200);
  assert.equal(exited.json.data.registro.latitud_egreso, -32.9001);
  assert.equal(exited.json.data.registro.estado, 'cerrado');
  assert.ok(Number.isInteger(exited.json.data.registro.duracion_segundos));
  assert.ok(exited.json.data.registro.duracion_segundos >= 0);
  const noLongerActive = await request('/api/admin/activos', { cookie: adminCookie });
  assert.deepEqual(noLongerActive.json.data.registros, []);
  const records = await request('/api/admin/registros', { cookie: adminCookie });
  assert.equal(records.json.data.registros.length, 1);
  assert.match(records.json.data.registros[0].hora_ingreso, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  const repeatedExit = await request('/api/egreso', {
    method: 'POST', cookie: guardCookie, body: { latitud: -32.9, longitud: -68.8 }
  });
  assert.equal(repeatedExit.response.status, 404);
});
