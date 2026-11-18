const apiError = require('../utils/apiError');

const MAX_ATTEMPTS = 30;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function removeExpired(now) {
  for (const [client, window] of attempts) {
    if (window.resetAt <= now) attempts.delete(client);
  }
}

function loginRateLimit(req, res, next) {
  const now = Date.now();
  const client = req.ip || req.socket?.remoteAddress || 'unknown';
  removeExpired(now);
  const window = attempts.get(client);
  if (!window || window.resetAt <= now) {
    attempts.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (window.count >= MAX_ATTEMPTS) return next(apiError(429, 'LOGIN_RATE_LIMITED', 'Demasiados intentos de inicio de sesión.'));
  window.count += 1;
  return next();
}

function resetLoginRateLimit() {
  attempts.clear();
}

module.exports = { loginRateLimit, resetLoginRateLimit };