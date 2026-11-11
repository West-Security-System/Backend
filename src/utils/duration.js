const apiError = require('./apiError');

function calculateDurationSeconds(startTimestamp, endTimestamp) {
  const start = Date.parse(startTimestamp);
  const end = Date.parse(endTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw apiError(409, 'INVALID_TURN_TIME', 'No se pudo calcular la duración del turno.');
  }
  return Math.floor((end - start) / 1000);
}

module.exports = { calculateDurationSeconds };
