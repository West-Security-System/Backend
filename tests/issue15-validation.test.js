const { test } = require('node:test');
const assert = require('node:assert/strict');
const validateCoordinates = require('../src/middlewares/validateCoordinates');

function runMiddleware(body) {
  const req = { body };
  let receivedError;
  let nextCalls = 0;
  validateCoordinates(req, {}, (error) => {
    receivedError = error;
    nextCalls += 1;
  });
  return { req, receivedError, nextCalls };
}

test('Issue 15 accepts geographic boundary values and exposes validated coordinates', () => {
  const { req, receivedError, nextCalls } = runMiddleware({ latitud: -90, longitud: 180 });

  assert.equal(receivedError, undefined);
  assert.equal(nextCalls, 1);
  assert.deepEqual(req.coordinates, { latitud: -90, longitud: 180 });
});

test('Issue 15 rejects missing, null, non-numeric and out-of-range coordinates with 422', () => {
  const invalidBodies = [
    undefined,
    null,
    {},
    { latitud: null, longitud: 0 },
    { latitud: 0, longitud: null },
    { latitud: '10', longitud: 0 },
    { latitud: 0, longitud: '10' },
    { latitud: -90.01, longitud: 0 },
    { latitud: 90.01, longitud: 0 },
    { latitud: 0, longitud: -180.01 },
    { latitud: 0, longitud: 180.01 }
  ];

  for (const body of invalidBodies) {
    const { receivedError, nextCalls } = runMiddleware(body);
    assert.equal(receivedError.status, 422);
    assert.equal(nextCalls, 1);
  }
});