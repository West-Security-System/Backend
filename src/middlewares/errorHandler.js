const supportedStatuses = new Set([400, 401, 403, 404, 409, 422, 500]);

function errorHandler(error, req, res, next) {
  const status = supportedStatuses.has(error.status) ? error.status : 500;
  const isInvalidJson = error.type === 'entity.parse.failed'
    || error.name === 'SyntaxError'
    || (error instanceof SyntaxError && error.status === 400)
    || (error.status === 400 && /JSON|property name/i.test(error.message || ''));
  const isDevelopment = process.env.NODE_ENV === 'development';
  const responseError = {
    code: isInvalidJson ? 'INVALID_JSON' : (error.code || (status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR')),
    message: status === 500 && !isDevelopment
      ? 'Error interno del servidor.'
      : (isInvalidJson ? 'El cuerpo JSON no es válido.' : error.message)
  };

  if (isInvalidJson) responseError.fields = ['body'];
  else if (error.fields) responseError.fields = error.fields;
  if (isDevelopment) responseError.stack = error.stack;
  return res.status(status).json({ data: null, error: responseError });
}

module.exports = errorHandler;
