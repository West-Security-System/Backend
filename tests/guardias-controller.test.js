const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/guardiasService');
const controller = require('../src/controllers/guardiasController');

function responseDouble() {
  const response = {
    statusCode: 200,
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
  return response;
}

test('registerEntry returns the created record with HTTP 201', (context) => {
  const registro = { id: 5, estado: 'abierto' };
  context.mock.method(service, 'registerEntry', () => registro);
  const response = responseDouble();
  let receivedError;

  controller.registerEntry({ user: { id: 2 }, body: {}, coordinates: {} }, response, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError, undefined);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, { data: { registro }, error: null });
});

test('registerEntry forwards service errors for the shared HTTP error handler', (context) => {
  const error = new Error('unexpected failure');
  context.mock.method(service, 'registerEntry', () => { throw error; });
  const response = responseDouble();
  let forwardedError;

  controller.registerEntry({ user: { id: 2 }, body: {}, coordinates: {} }, response, (received) => {
    forwardedError = received;
  });

  assert.equal(forwardedError, error);
  assert.equal(response.body, undefined);
});
