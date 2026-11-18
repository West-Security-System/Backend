const supportedStatuses = new Set([400, 401, 403, 404, 409, 422, 429, 500]);
const sensitiveText = /password(?:_hash)?|cookie|token|session[_ -]?secret|stack/i;

function safeMessage(error, status, isInvalidJson) {
  if (status === 500) return 'Error interno del servidor.';
  if (isInvalidJson) return 'El cuerpo JSON no es válido.';
  const message = error.message || 'Solicitud inválida.';
  return sensitiveText.test(message) ? 'Solicitud inválida.' : message;
}

function errorHandler(error, req, res, next) {
  const status = supportedStatuses.has(error.status) ? error.status : 500;
  const isInvalidJson = error.type === 'entity.parse.failed'
    || error.name === 'SyntaxError'
    || (error instanceof SyntaxError && error.status === 400)
    || (error.status === 400 && /JSON|property name/i.test(error.message || ''));
  const responseError = {
    code: isInvalidJson ? 'INVALID_JSON' : (error.code || (status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR')),
    message: safeMessage(error, status, isInvalidJson)
  };

  if (isInvalidJson) responseError.fields = ['body'];
  else if (error.fields) responseError.fields = error.fields;
  return res.status(status).json({ data: null, error: responseError });
}

module.exports = errorHandler;
