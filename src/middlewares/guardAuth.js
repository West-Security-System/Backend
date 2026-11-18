const { findUserById } = require('../db');
const apiError = require('../utils/apiError');

function authenticate(req, next, allowedRoles) {
  if (!req.session?.userId) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  const user = findUserById(req.session.userId);
  if (!user || user.bloqueado) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  if (!allowedRoles.includes(user.rol)) return next(apiError(403, 'FORBIDDEN', 'Esta ruta requiere una cuenta autorizada.'));
  req.user = user;
  return next();
}

function requireGuard(req, res, next) {
  return authenticate(req, next, ['guardia']);
}

function requireGuardOrAdmin(req, res, next) {
  return authenticate(req, next, ['guardia', 'admin']);
}

function requireAuthenticated(req, res, next) {
  return authenticate(req, next, ['guardia', 'admin']);
}

module.exports = requireGuard;
module.exports.requireGuardOrAdmin = requireGuardOrAdmin;
module.exports.requireAuthenticated = requireAuthenticated;
