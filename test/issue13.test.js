const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const databasePath = path.join(__dirname, '..', 'data', `issue13-${process.pid}.db`);
let server;
let baseUrl;
let adminCookie;
let guardCookie;

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

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath, SESSION_SECRET: 'issue13-test-secret', ADMIN_USERNAME: 'issue13-admin', ADMIN_PASSWORD: 'issue13-password' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Backend exited with code ${server.exitCode}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const login = await request('/api/login', { method: 'POST', body: { username: 'issue13-admin', password: 'issue13-password' } });
  assert.equal(login.response.status, 200);
  adminCookie = login.response.headers.get('set-cookie').split(';')[0];
  const guard = await request('/api/admin/usuarios', {
    method: 'POST', cookie: adminCookie,
    body: { username: 'issue13-guard', password: 'guard-password', rol: 'guardia' }
  });
  assert.equal(guard.response.status, 201);
  const guardLogin = await request('/api/login', { method: 'POST', body: { username: 'issue13-guard', password: 'guard-password' } });
  guardCookie = guardLogin.response.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

test('Issue 13 protects admin summaries and applies safe filters and limits', async () => {
  for (const route of ['/api/admin/activos', '/api/admin/registros']) {
    const anonymous = await request(route);
    assert.equal(anonymous.response.status, 401);
    const guard = await request(route, { cookie: guardCookie });
    assert.equal(guard.response.status, 403);
    const authorized = await request(route, { cookie: adminCookie });
    assert.equal(authorized.response.status, 200);
    assert.deepEqual(authorized.json.data.registros, []);
  }
  const capped = await request('/api/admin/registros?limit=999', { cookie: adminCookie });
  assert.equal(capped.response.status, 200);
  assert.equal(capped.json.data.limite, 100);
  const invalidDate = await request('/api/admin/registros?desde=no-es-fecha', { cookie: adminCookie });
  assert.equal(invalidDate.response.status, 422);
});
