const xss = require('xss');

const sanitizer = new xss.FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
});
const blockedKeys = new Set(['__proto__', 'prototype', 'constructor', 'password_hash', 'session_secret', 'token', 'cookie']);

function sanitizeValue(value, key = '') {
  if (typeof value === 'string') return key === 'password' ? value : sanitizer.process(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key));
  if (!value || typeof value !== 'object') return value;
  const sanitized = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!blockedKeys.has(name.toLowerCase())) sanitized[name] = sanitizeValue(entry, name.toLowerCase());
  }
  return sanitized;
}

function sanitizePayload(req, res, next) {
  req.body = sanitizeValue(req.body);
  Object.defineProperty(req, 'query', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: sanitizeValue(req.query)
  });
  return next();
}

module.exports = sanitizePayload;