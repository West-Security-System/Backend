const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue14-${process.pid}.db`);
let server;
let baseUrl;
let adminCookie;
let guardCookie;
let unassignedGuardCookie;
let service;

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

async function createGuard(username) {
  const result = await request('/api/admin/usuarios', {
    method: 'POST', cookie: adminCookie,
    body: { username, password: 'guard-password', rol: 'guardia' }
  });
  assert.equal(result.response.status, 201);
  return result.json.data.usuario.id;
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, SESSION_SECRET: 'issue14-test-secret', ADMIN_USERNAME: 'issue14-admin', ADMIN_PASSWORD: 'issue14-password' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Backend exited with code ${server.exitCode}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  adminCookie = await login('issue14-admin', 'issue14-password');
  const guardId = await createGuard('issue14-guard');
  const otherGuardId = await createGuard('issue14-other');
  guardCookie = await login('issue14-guard', 'guard-password');
  unassignedGuardCookie = await login('issue14-other', 'guard-password');
  const local = await request('/api/admin/locales', { method: 'POST', cookie: adminCookie, body: { nombre: 'Issue14 local', latitud: -32.9, longitud: -68.8 } });
  assert.equal(local.response.status, 201);
  service = local.json.data.local;
  const schedule = await request('/api/admin/horarios', {
    method: 'POST', cookie: adminCookie,
    body: { servicio_id: service.id, dias: [1], hora_inicio: '09:00', hora_fin: '17:00', capacidad: 2 }
  });
  assert.equal(schedule.response.status, 201);
  const assignment = await request(`/api/admin/horarios/${schedule.json.data.horario.id}/guardias`, {
    method: 'POST', cookie: adminCookie, body: { usuario_id: guardId }
  });
  assert.equal(assignment.response.status, 201);
  assert.ok(otherGuardId);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('Issue 14 isolates services and schedules to the authenticated guard', async () => {
  const mine = await request('/api/mis-servicios', { cookie: guardCookie });
  assert.equal(mine.response.status, 200);
  assert.deepEqual(mine.json.data.servicios.map(({ id }) => id), [service.id]);
  const schedules = await request(`/api/servicio/${encodeURIComponent(service.nombre)}/horarios`, { cookie: guardCookie });
  assert.equal(schedules.response.status, 200);
  assert.equal(schedules.json.data.horarios.length, 1);
  assert.equal(schedules.json.data.horarios[0].servicio_id, service.id);
  const empty = await request('/api/mis-servicios', { cookie: unassignedGuardCookie });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.json.data.servicios, []);
  const denied = await request(`/api/servicio/${encodeURIComponent(service.nombre)}/horarios`, { cookie: unassignedGuardCookie });
  assert.equal(denied.response.status, 403);
});
