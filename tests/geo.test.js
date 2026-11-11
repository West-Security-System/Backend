const { test } = require('node:test');
const assert = require('node:assert/strict');
const { distanceMeters } = require('../src/utils/geo');

test('Haversine returns zero for identical points and symmetric distance', () => {
  const point = { latitud: -32.9, longitud: -68.8 };
  const otherPoint = { latitud: -32.91, longitud: -68.81 };

  assert.equal(distanceMeters(point, point), 0);
  assert.equal(distanceMeters(point, otherPoint), distanceMeters(otherPoint, point));
});

test('Haversine handles equatorial, antimeridian and polar coordinates', () => {
  const equatorDistance = distanceMeters(
    { latitud: 0, longitud: 0 },
    { latitud: 0, longitud: 1 }
  );
  const antimeridianDistance = distanceMeters(
    { latitud: 0, longitud: 179.9 },
    { latitud: 0, longitud: -179.9 }
  );
  const polarDistance = distanceMeters(
    { latitud: 89.9, longitud: 0 },
    { latitud: 89.9, longitud: 90 }
  );

  assert.ok(equatorDistance > 111000 && equatorDistance < 112000);
  assert.ok(antimeridianDistance > 22000 && antimeridianDistance < 23000);
  assert.ok(polarDistance > 15000 && polarDistance < 16000);
});

test('Haversine remains finite for antipodal points', () => {
  const distance = distanceMeters(
    { latitud: 0, longitud: 0 },
    { latitud: 0, longitud: 180 }
  );

  assert.ok(Number.isFinite(distance));
  assert.ok(distance > 20000000 && distance < 20100000);
});
