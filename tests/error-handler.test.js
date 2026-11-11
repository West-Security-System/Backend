const { test } = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middlewares/errorHandler');

function responseDouble() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('error handler sanitizes unexpected failures as HTTP 500', () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const response = responseDouble();
  try {
    errorHandler(new Error('database details'), {}, response, () => {});
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' }
  });
});

test('error handler preserves client status and normalizes malformed JSON errors', () => {
  const forbiddenResponse = responseDouble();
  errorHandler(Object.assign(new Error('Not allowed'), { status: 403, code: 'FORBIDDEN' }), {}, forbiddenResponse, () => {});
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(forbiddenResponse.body.error.code, 'FORBIDDEN');

  const invalidJsonResponse = responseDouble();
  errorHandler(Object.assign(new SyntaxError('Unexpected token'), { status: 400 }), {}, invalidJsonResponse, () => {});
  assert.equal(invalidJsonResponse.statusCode, 400);
  assert.deepEqual(invalidJsonResponse.body.error, {
    code: 'INVALID_JSON',
    message: 'El cuerpo JSON no es válido.',
    fields: ['body']
  });
});
