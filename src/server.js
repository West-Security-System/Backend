require('dotenv').config();

const express = require('express');
const session = require('express-session');
const {
  initDatabase,
  closeDatabase,
  ensureAdminCredentials,
  findUserByUsername,
  findUserById,
  listUsers,
  insertUser,
  updateUserById,
  deleteUserById,
  replaceGuardBlockDates,
  listGuardBlockDatesByUserId,
  findAssignmentsForUserInDates,
  insertAssignment
} = require('./db');
const bcrypt = require('bcryptjs');

const app = express();
const port = Number(process.env.PORT || 3000);
const version = process.env.APP_VERSION || '0.1.0';
const isDevelopment = process.env.NODE_ENV === 'development';
const sessionMaxAge = Number(process.env.SESSION_MAX_AGE_MS || 86400000);
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const allowedClientOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedRoles = new Set(['admin', 'guardia']);

const supportedStatuses = new Set([400, 401, 403, 404, 409, 422, 500]);

function sendSuccess(res, data, status = 200) {
  res.status(status).json({ data, error: null });
}

function sanitizeUser(user) {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.password_hash;
  return safeUser;
}

function sanitizeUsers(users) {
  return users.map(sanitizeUser);
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

function parseISODate(dateString) {
  if (typeof dateString !== 'string' || !dateString.trim()) return null;
  const parsed = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeBlockDates(payload) {
  if (!Array.isArray(payload)) {
    throw createApiError(422, 'INVALID_BLOCK_DATES', 'El bloque de indisponibilidad debe ser un array.', ['bloqueos']);
  }

  return payload.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw createApiError(422, 'INVALID_BLOCK_DATE', `Bloqueo inválido en posición ${index}.`, ['bloqueos']);
    }

    const tipo = item.tipo;
    if (tipo === 'fecha') {
      const fecha = parseISODate(item.fecha);
      if (!fecha) {
        throw createApiError(422, 'INVALID_BLOCK_DATE', 'La fecha del bloqueo no es válida.', ['bloqueos']);
      }
      return { tipo: 'fecha', fecha, motivo: item.motivo || 'indisponibilidad' };
    }

    if (tipo === 'rango') {
      const fechaInicio = parseISODate(item.fecha_inicio);
      const fechaFin = parseISODate(item.fecha_fin);
      if (!fechaInicio || !fechaFin) {
        throw createApiError(422, 'INVALID_BLOCK_RANGE', 'El rango de bloqueo no es válido.', ['bloqueos']);
      }
      if (new Date(`${fechaFin}T00:00:00Z`) < new Date(`${fechaInicio}T00:00:00Z`)) {
        throw createApiError(422, 'INVALID_BLOCK_RANGE', 'La fecha fin no puede ser anterior a la fecha inicio.', ['bloqueos']);
      }
      return {
        tipo: 'rango',
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        motivo: item.motivo || 'indisponibilidad'
      };
    }

    throw createApiError(422, 'INVALID_BLOCK_TYPE', 'El tipo de bloqueo debe ser fecha o rango.', ['bloqueos']);
  });
}

function collectDatesFromBlockEntries(entries) {
  const dates = [];

  for (const entry of entries) {
    if (entry.tipo === 'fecha') {
      dates.push(entry.fecha);
      continue;
    }
    const start = new Date(`${entry.fecha_inicio}T00:00:00Z`);
    const end = new Date(`${entry.fecha_fin}T00:00:00Z`);
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(parseISODate(cursor.toISOString().slice(0, 10)));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return dates;
}

app.get('/api/admin/usuarios', requiereAuth, requiereAdmin, (req, res, next) => {
  try {
    const usuarios = sanitizeUsers(listUsers());
    sendSuccess(res, { usuarios });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/usuarios', requiereAuth, requiereAdmin, async (req, res, next) => {
  const { username, password, rol, bloqueado } = req.body || {};

  try {
    if (!username || !password || !rol) {
      return next(createApiError(422, 'VALIDATION_ERROR', 'username, password y rol son obligatorios.', ['username', 'password', 'rol']));
    }

    if (!allowedRoles.has(rol)) {
      return next(createApiError(422, 'INVALID_ROLE', 'El rol debe ser admin o guardia.', ['rol']));
    }

    const normalizedUsername = String(username).trim();
    if (!normalizedUsername) {
      return next(createApiError(422, 'VALIDATION_ERROR', 'El username no puede estar vacío.', ['username']));
    }

    if (findUserByUsername(normalizedUsername)) {
      return next(createApiError(409, 'USERNAME_TAKEN', 'El username ya está registrado.', ['username']));
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const createdUser = insertUser({
      username: normalizedUsername,
      passwordHash,
      rol,
      bloqueado: bloqueado === true || bloqueado === 1 || bloqueado === '1' ? 1 : 0
    });

    sendSuccess(res, { usuario: sanitizeUser(createdUser) }, 201);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/usuarios', requiereAuth, requiereAdmin, async (req, res, next) => {
  const { id, username, password, rol, bloqueado } = req.body || {};

  try {
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return next(createApiError(422, 'VALIDATION_ERROR', 'El id del usuario es obligatorio y debe ser válido.', ['id']));
    }

    const currentUser = findUserById(userId);
    if (!currentUser) {
      return next(createApiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.'));
    }

    const nextUsername = username !== undefined && String(username).trim() ? String(username).trim() : currentUser.username;
    if (!nextUsername) {
      return next(createApiError(422, 'VALIDATION_ERROR', 'El username no puede estar vacío.', ['username']));
    }

    const nextRol = rol !== undefined ? rol : currentUser.rol;
    if (!allowedRoles.has(nextRol)) {
      return next(createApiError(422, 'INVALID_ROLE', 'El rol debe ser admin o guardia.', ['rol']));
    }

    const duplicateUser = findUserByUsername(nextUsername);
    if (duplicateUser && duplicateUser.id !== userId) {
      return next(createApiError(409, 'USERNAME_TAKEN', 'El username ya está registrado.', ['username']));
    }

    const passwordHash = password !== undefined && String(password).length > 0
      ? await bcrypt.hash(String(password), 12)
      : currentUser.password_hash;
    const nextBlocked = bloqueado !== undefined ? Number(Boolean(bloqueado)) : Number(Boolean(currentUser.bloqueado));

    const updatedUser = updateUserById(userId, {
      username: nextUsername,
      passwordHash,
      rol: nextRol,
      bloqueado: nextBlocked
    });

    sendSuccess(res, { usuario: sanitizeUser(updatedUser) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/usuarios', requiereAuth, requiereAdmin, (req, res, next) => {
  const userId = Number(req.body?.id ?? req.query?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(createApiError(422, 'VALIDATION_ERROR', 'El id del usuario es obligatorio y debe ser válido.', ['id']));
  }

  if (userId === Number(req.session.userId)) {
    return next(createApiError(403, 'SELF_DELETE_FORBIDDEN', 'No puedes eliminarte a ti mismo como administrador.'));
  }

  try {
    const user = deleteUserById(userId);
    sendSuccess(res, { eliminado: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/usuarios/:id/bloqueos', requiereAuth, requiereAdmin, (req, res, next) => {
  const userId = Number(req.params.id);
  const payload = req.body && req.body.bloqueos !== undefined ? req.body.bloqueos : req.body;

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(createApiError(422, 'VALIDATION_ERROR', 'El id del usuario es obligatorio y debe ser válido.', ['id']));
  }

  const guardUser = findUserById(userId);
  if (!guardUser) {
    return next(createApiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.'));
  }

  if (guardUser.rol !== 'guardia') {
    return next(createApiError(422, 'INVALID_GUARD_USER', 'Solo se pueden gestionar bloqueos de usuarios con rol guardia.', ['id']));
  }

  try {
    const normalizedEntries = normalizeBlockDates(payload);
    const datesToCheck = collectDatesFromBlockEntries(normalizedEntries);
    const assignedDates = findAssignmentsForUserInDates(userId, datesToCheck);

    if (assignedDates.length > 0) {
      const conflictDates = [...new Set(assignedDates.map((item) => item.fecha))];
      return next(createApiError(422, 'GUARD_ALREADY_ASSIGNED', 'El guardia tiene asignaciones en los días solicitados.', { dates: conflictDates }));
    }

    const bloqueos = replaceGuardBlockDates(userId, normalizedEntries);
    sendSuccess(res, {
      usuario_id: userId,
      bloqueos: bloqueos.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        fecha: item.fecha,
        fecha_inicio: item.fecha_inicio,
        fecha_fin: item.fecha_fin,
        motivo: item.motivo
      }))
    });
  } catch (error) {
    next(error);
  }
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

initDatabase().then(async () => {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminUsername || adminPassword) {
    if (!adminUsername || !adminPassword) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must both be set.');
    ensureAdminCredentials({ username: adminUsername, passwordHash: await bcrypt.hash(adminPassword, 12) });
  }

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
