const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateDurationSeconds } = require('../src/utils/duration');

test('duration is calculated in whole seconds', () => {
  assert.equal(
    calculateDurationSeconds('2026-11-11T08:00:00.000Z', '2026-11-11T16:30:45.000Z'),
    30645
  );
});

test('duration accepts a zero-length turn', () => {
  const timestamp = '2026-11-11T08:00:00.000Z';
  assert.equal(calculateDurationSeconds(timestamp, timestamp), 0);
});

test('duration rejects malformed or reversed timestamps as a conflict', () => {
  for (const [start, end] of [
    ['invalid', '2026-11-11T08:00:00.000Z'],
    ['2026-11-11T08:00:00.000Z', 'invalid'],
    ['2026-11-11T09:00:00.000Z', '2026-11-11T08:00:00.000Z']
  ]) {
    assert.throws(
      () => calculateDurationSeconds(start, end),
      { status: 409, code: 'INVALID_TURN_TIME' }
    );
  }
});
