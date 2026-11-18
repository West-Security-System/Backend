const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loginRateLimit, resetLoginRateLimit } = require('../src/middlewares/loginRateLimit');
const sanitizePayload = require('../src/middlewares/sanitizePayload');
const securityHeaders = require('../src/middlewares/securityHeaders');
const errorHandler = require('../src/middlewares/errorHandler');

test('login rate limit allows 30 requests, blocks the 31st, and exposes a reset function', () => {
  resetLoginRateLimit();
  const request = { ip: 'test-client' };
  let accepted = 0;
  let rejected;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    loginRateLimit(request, {}, (error) => { if (error) rejected = error; else accepted += 1; });
  }
  loginRateLimit(request, {}, (error) => { rejected = error; });
  assert.equal(accepted, 30);
  assert.equal(rejected.status, 429);
  resetLoginRateLimit();
  loginRateLimit(request, {}, (error) => { rejected = error; });
  assert.equal(rejected, undefined);
});

test('payload sanitizer strips markup, removes secret fields, and preserves passwords', () => {
  const request = {
    body: {
      comment: '<script>bad()</script><b>safe</b>',
      password: '<script>valid-password</script>',
      password_hash: 'must-not-be-accepted',
      nested: { value: '<img src=x onerror=bad()>' }
    },
    query: { search: '<script>bad()</script>' }
  };
  sanitizePayload(request, {}, () => {});
  assert.equal(request.body.comment.includes('<script>'), false);
  assert.equal(request.body.nested.value.includes('<img'), false);
  assert.equal(request.body.password, '<script>valid-password</script>');
  assert.equal(Object.hasOwn(request.body, 'password_hash'), false);
  assert.equal(request.query.search.includes('<script>'), false);
});

test('security headers are set and internal errors never return secrets or stacks', () => {
  const headers = new Map();
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { headers.set(name, value); }
  };
  securityHeaders({}, response, () => {});
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(headers.get('Cross-Origin-Resource-Policy'), 'same-site');

  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const failure = Object.assign(new Error('private password_hash secret'), { status: 500, stack: 'private stack trace' });
  errorHandler(failure, {}, response);
  process.env.NODE_ENV = previousEnvironment;
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.message, 'Error interno del servidor.');
  assert.equal(Object.hasOwn(response.body.error, 'stack'), false);
  assert.equal(JSON.stringify(response.body).includes('private'), false);
  errorHandler(Object.assign(new Error('password_hash cookie token SESSION_SECRET stack'), { status: 422 }), {}, response);
  assert.equal(response.body.error.message, 'Solicitud inválida.');
  assert.equal(JSON.stringify(response.body).includes('SESSION_SECRET'), false);
});
