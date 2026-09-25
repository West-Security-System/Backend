require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { initDatabase, closeDatabase, findUserByUsername, findUserById } = require('./db');
const bcrypt = require('bcryptjs');

const app = express();
const port = Number(process.env.PORT || 3000);
const version = process.env.APP_VERSION || '0.1.0';
const isDevelopment = process.env.NODE_ENV === 'development';
const sessionMaxAge = Number(process.env.SESSION_MAX_AGE_MS || 86400000);
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const allowedClientOrigin = process.env.CORS_ORIGIN || 'http://localhost:5500';

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

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (!origin) return next();

  if (origin !== allowedClientOrigin) {
    return next(createApiError(403, 'CORS_FORBIDDEN', 'Origen no autorizado por la política de CORS.'));
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    maxAge: sessionMaxAge
  }
}));

app.get('/api/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    version
  });
});

app.post('/api/login', async (req, res, next) => {
  const { username, password } = req.body || {};
  const invalidCredentials = createApiError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');

  if (!username || !password) return next(invalidCredentials);

  try {
    const user = findUserByUsername(username);
    const passwordMatches = user && await bcrypt.compare(password, user.password_hash);

    if (!user || !passwordMatches || user.bloqueado) return next(invalidCredentials);

    req.session.userId = user.id;
    req.session.role = user.rol;
    sendSuccess(res, {
      user: { id: user.id, username: user.username, rol: user.rol }
    });
  } catch (error) {
    next(error);
  }
});

function requiereAuth(req, res, next) {
  if (!req.session.userId) {
    return next(createApiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  }

  const user = findUserById(req.session.userId);
  if (!user || user.bloqueado) {
    return next(createApiError(401, 'UNAUTHENTICATED', 'Sesión no autenticada.'));
  }

  req.user = user;
  next();
}

function requiereAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return next(createApiError(403, 'FORBIDDEN', 'No tienes permisos para acceder a esta ruta.'));
  }

  next();
}

app.get('/api/me', requiereAuth, (req, res) => {
  sendSuccess(res, {
    user: { id: req.user.id, username: req.user.username, rol: req.user.rol }
  });
});

app.get('/api/admin/dashboard', requiereAuth, requiereAdmin, (req, res) => {
  sendSuccess(res, {
    dashboard: {
      title: 'Panel administrativo',
      user: { id: req.user.id, username: req.user.username, rol: req.user.rol },
      access: 'granted'
    }
  });
});

app.post('/api/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure,
      path: '/'
    });
    sendSuccess(res, { loggedOut: true });
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

initDatabase().then(() => {
  const server = app.listen(port, () => {
    console.log(`West Security API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeDatabase();
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
