require('dotenv').config();

const cors = require('cors');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);
const version = process.env.APP_VERSION || '0.1.0';
const isDevelopment = process.env.NODE_ENV === 'development';

const supportedStatuses = new Set([400, 401, 403, 404, 409, 422, 500]);

function sendSuccess(res, data, status = 200) {
  res.status(status).json({ data, error: null });
}

function createApiError(status, code, message, fields) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fields = fields;
  return error;
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5500'
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    version
  });
});

app.use((req, res, next) => {
  next(createApiError(404, 'NOT_FOUND', 'Ruta no encontrada.'));
});

app.use((error, req, res, next) => {
  const status = supportedStatuses.has(error.status) ? error.status : 500;
  const isInvalidJson = error.type === 'entity.parse.failed'
    || error.name === 'SyntaxError'
    || (error instanceof SyntaxError && error.status === 400)
    || (error.status === 400 && /JSON|property name/i.test(error.message || ''));
  const responseError = {
    code: isInvalidJson ? 'INVALID_JSON' : (error.code || (status === 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR')),
    message: status === 500 && !isDevelopment
      ? 'Error interno del servidor.'
      : (isInvalidJson ? 'El cuerpo JSON no es válido.' : error.message)
  };

  if (isInvalidJson) responseError.fields = ['body'];
  else if (error.fields) responseError.fields = error.fields;
  if (isDevelopment) responseError.stack = error.stack;
  if (status === 500) console.error(error);

  res.status(status).json({ data: null, error: responseError });
});

app.listen(port, () => {
  console.log(`West Security API listening on port ${port}`);
});
