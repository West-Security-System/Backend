const { findUserById } = require('../db');
const apiError = require('../utils/apiError');

function requireGuard(req, res, next) {
  if (!req.session?.userId) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  const user = findUserById(req.session.userId);
  if (!user || user.bloqueado) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  if (user.rol !== 'guardia') return next(apiError(403, 'FORBIDDEN', 'Esta ruta requiere una cuenta de guardia.'));
  req.user = user;
  return next();
}

module.exports = requireGuard;
