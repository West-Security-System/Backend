const repository = require('../repositories/notificationsRepository');
const apiError = require('../utils/apiError');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeLimit(value) {
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw apiError(422, 'INVALID_LIMIT', 'limit debe ser un entero positivo.', ['limit']);
  }
  return Math.min(limit, MAX_LIMIT);
}

function listForUser(userId, query = {}) {
  const limit = query.limit === undefined ? DEFAULT_LIMIT : normalizeLimit(query.limit);
  return {
    notificaciones: repository.listByUser(userId, limit),
    no_leidas: repository.countUnread(userId),
    limite: limit,
    limite_maximo: MAX_LIMIT
  };
}

function markAllRead(userId) {
  return { marcadas: repository.markRead(userId) };
}

module.exports = { listForUser, markAllRead };