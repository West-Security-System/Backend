const { findUserById } = require('../db');
const apiError = require('../utils/apiError');

function requireAdmin(req, res, next) {
  if (!req.session?.userId) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  const user = findUserById(req.session.userId);
  if (!user || user.bloqueado) return next(apiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  if (user.rol !== 'admin') return next(apiError(403, 'FORBIDDEN', 'No tienes permisos para acceder a esta ruta.'));
  req.user = user;
  return next();
}

module.exports = requireAdmin;
