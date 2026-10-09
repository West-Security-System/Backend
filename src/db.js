const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const databasePath = path.join(__dirname, '..', 'data', 'west_control.db');
let database;

function saveDatabase() {
  fs.writeFileSync(databasePath, Buffer.from(database.export()));
}

async function initDatabase() {
  const SQL = await initSqlJs();
  const dataDirectory = path.dirname(databasePath);

  fs.mkdirSync(dataDirectory, { recursive: true });
  database = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();

  database.run('PRAGMA foreign_keys = ON');
  database.run('BEGIN');

  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO app_settings (key, value)
      VALUES ('database_name', 'west_control');
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (1);
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('admin', 'guardia')),
        bloqueado INTEGER NOT NULL DEFAULT 0 CHECK (bloqueado IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (2);
      CREATE TABLE IF NOT EXISTS guardia_bloqueos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('fecha', 'rango')),
        fecha TEXT,
        fecha_inicio TEXT,
        fecha_fin TEXT,
        motivo TEXT NOT NULL DEFAULT 'indisponibilidad',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS guardia_asignaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        motivo TEXT NOT NULL DEFAULT 'asignado',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS locales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        latitud REAL NOT NULL,
        longitud REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS guardia_locales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        local_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (local_id) REFERENCES locales(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS horarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        servicio_id INTEGER NOT NULL,
        dias TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        capacidad INTEGER NOT NULL CHECK (capacidad > 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (servicio_id) REFERENCES locales(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS guardia_horarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        horario_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (usuario_id, horario_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (6);
    `);
    database.run('COMMIT');
    saveDatabase();
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

function ensureAdminCredentials({ username, passwordHash }) {
  const adminStatement = database.prepare("SELECT id FROM usuarios WHERE rol = 'admin' ORDER BY id ASC LIMIT 1");
  const admin = adminStatement.step() ? adminStatement.getAsObject() : null;
  adminStatement.free();
  const existingUsername = findUserByUsername(username);

  if (existingUsername && (!admin || Number(existingUsername.id) !== Number(admin.id))) {
    throw new Error(`ADMIN_USERNAME_CONFLICT: ${username}`);
  }

  if (admin) {
    database.run(`UPDATE usuarios SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [username, passwordHash, admin.id]);
  } else {
    database.run(`INSERT INTO usuarios (username, password_hash, rol) VALUES (?, ?, 'admin')`, [username, passwordHash]);
  }
  saveDatabase();
}

function insertUser({ username, passwordHash, rol, bloqueado = 0 }) {
  try {
    const statement = database.prepare(`
      INSERT INTO usuarios (username, password_hash, rol, bloqueado)
      VALUES (?, ?, ?, ?)
    `);
    statement.bind([username, passwordHash, rol, Number(bloqueado)]);
    statement.step();
    statement.free();
    saveDatabase();

    const user = findUserByUsername(username);
    return user;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: usuarios.username')) {
      const duplicateError = new Error('El username ya está registrado.');
      duplicateError.code = 'USERNAME_TAKEN';
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }
}

function listUsers() {
  const statement = database.prepare(`
    SELECT id, username, password_hash, rol, bloqueado, created_at, updated_at
    FROM usuarios
    ORDER BY id ASC
  `);
  const users = [];

  while (statement.step()) {
    users.push(statement.getAsObject());
  }

  statement.free();
  return users;
}

function findUserByUsername(username) {
  const statement = database.prepare(`
    SELECT id, username, password_hash, rol, bloqueado, created_at, updated_at
    FROM usuarios WHERE username = ?
  `);
  statement.bind([username]);
  const user = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return user;
}

function findUserById(id) {
  const statement = database.prepare(`
    SELECT id, username, password_hash, rol, bloqueado, created_at, updated_at
    FROM usuarios WHERE id = ?
  `);
  statement.bind([id]);
  const user = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return user;
}

function updateUserById(id, { username, passwordHash, rol, bloqueado }) {
  const currentUser = findUserById(id);
  if (!currentUser) {
    const error = new Error('Usuario no encontrado.');
    error.code = 'USER_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const nextUsername = username ?? currentUser.username;
  const nextRol = rol ?? currentUser.rol;
  const nextBlocked = bloqueado ?? currentUser.bloqueado;
  const nextPasswordHash = passwordHash ?? currentUser.password_hash;

  try {
    const statement = database.prepare(`
      UPDATE usuarios
      SET username = ?, password_hash = ?, rol = ?, bloqueado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    statement.bind([nextUsername, nextPasswordHash, nextRol, Number(nextBlocked), id]);
    statement.step();
    statement.free();
    saveDatabase();
    return findUserById(id);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: usuarios.username')) {
      const duplicateError = new Error('El username ya está registrado.');
      duplicateError.code = 'USERNAME_TAKEN';
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }
}

function deleteUserById(id) {
  const currentUser = findUserById(id);
  if (!currentUser) {
    const error = new Error('Usuario no encontrado.');
    error.code = 'USER_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const statement = database.prepare(`DELETE FROM usuarios WHERE id = ?`);
  statement.bind([id]);
  statement.step();
  statement.free();
  saveDatabase();
  return currentUser;
}

function listGuardBlockDatesByUserId(userId) {
  const statement = database.prepare(`
    SELECT id, usuario_id, tipo, fecha, fecha_inicio, fecha_fin, motivo, created_at, updated_at
    FROM guardia_bloqueos
    WHERE usuario_id = ?
    ORDER BY fecha_inicio, fecha, id ASC
  `);
  statement.bind([userId]);
  const items = [];

  while (statement.step()) {
    items.push(statement.getAsObject());
  }

  statement.free();
  return items;
}

function replaceGuardBlockDates(userId, blockDates) {
  const deleteStatement = database.prepare(`DELETE FROM guardia_bloqueos WHERE usuario_id = ?`);
  deleteStatement.bind([userId]);
  deleteStatement.step();
  deleteStatement.free();

  for (const item of blockDates) {
    const insertStatement = database.prepare(`
      INSERT INTO guardia_bloqueos (usuario_id, tipo, fecha, fecha_inicio, fecha_fin, motivo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStatement.bind([
      userId,
      item.tipo,
      item.fecha || null,
      item.fecha_inicio || null,
      item.fecha_fin || null,
      item.motivo || 'indisponibilidad'
    ]);
    insertStatement.step();
    insertStatement.free();
  }

  saveDatabase();
  return listGuardBlockDatesByUserId(userId);
}

function findAssignmentsForUserInDates(userId, dates) {
  if (!Array.isArray(dates) || dates.length === 0) return [];
  const placeholders = dates.map(() => '?').join(', ');
  const statement = database.prepare(`
    SELECT id, usuario_id, fecha, motivo, created_at
    FROM guardia_asignaciones
    WHERE usuario_id = ? AND fecha IN (${placeholders})
    ORDER BY fecha ASC
  `);
  const bindings = [userId, ...dates];
  statement.bind(bindings);
  const rows = [];

  while (statement.step()) {
    rows.push(statement.getAsObject());
  }

  statement.free();
  return rows;
}

function insertAssignment({ userId, fecha, motivo = 'asignado' }) {
  const statement = database.prepare(`
    INSERT INTO guardia_asignaciones (usuario_id, fecha, motivo)
    VALUES (?, ?, ?)
  `);
  statement.bind([userId, fecha, motivo]);
  statement.step();
  statement.free();
  saveDatabase();
}

function findServiceById(id) {
  return findLocalById(id);
}

function listSchedules({ servicioId } = {}) {
  const query = servicioId === undefined
    ? `SELECT id, servicio_id, dias, hora_inicio, hora_fin, capacidad, created_at, updated_at FROM horarios ORDER BY id ASC`
    : `SELECT id, servicio_id, dias, hora_inicio, hora_fin, capacidad, created_at, updated_at FROM horarios WHERE servicio_id = ? ORDER BY id ASC`;
  const statement = database.prepare(query);
  if (servicioId !== undefined) statement.bind([servicioId]);
  const schedules = [];
  while (statement.step()) schedules.push(statement.getAsObject());
  statement.free();
  return schedules;
}

function findScheduleById(id) {
  return listSchedules().find((schedule) => Number(schedule.id) === Number(id)) || null;
}

function insertSchedule({ servicioId, dias, horaInicio, horaFin, capacidad }) {
  const statement = database.prepare(`
    INSERT INTO horarios (servicio_id, dias, hora_inicio, hora_fin, capacidad)
    VALUES (?, ?, ?, ?, ?)
  `);
  statement.bind([servicioId, JSON.stringify(dias), horaInicio, horaFin, Number(capacidad)]);
  statement.step();
  statement.free();
  saveDatabase();
  const scheduleStatement = database.prepare(`
    SELECT id, servicio_id, dias, hora_inicio, hora_fin, capacidad, created_at, updated_at
    FROM horarios
    WHERE servicio_id = ? AND dias = ? AND hora_inicio = ? AND hora_fin = ? AND capacidad = ?
    ORDER BY id DESC
    LIMIT 1
  `);
  scheduleStatement.bind([servicioId, JSON.stringify(dias), horaInicio, horaFin, Number(capacidad)]);
  const schedule = scheduleStatement.step() ? scheduleStatement.getAsObject() : null;
  scheduleStatement.free();
  return schedule;
}

function updateScheduleById(id, { servicioId, dias, horaInicio, horaFin, capacidad }) {
  const statement = database.prepare(`
    UPDATE horarios
    SET servicio_id = ?, dias = ?, hora_inicio = ?, hora_fin = ?, capacidad = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  statement.bind([servicioId, JSON.stringify(dias), horaInicio, horaFin, Number(capacidad), id]);
  statement.step();
  statement.free();
  saveDatabase();
  return findScheduleById(id);
}

function deleteScheduleById(id) {
  const currentSchedule = findScheduleById(id);
  if (!currentSchedule) return null;
  const statement = database.prepare(`DELETE FROM horarios WHERE id = ?`);
  statement.bind([id]);
  statement.step();
  statement.free();
  saveDatabase();
  return currentSchedule;
}

function listScheduleAssignments(horarioId) {
  const statement = database.prepare(`
    SELECT gh.id, gh.usuario_id, gh.horario_id, gh.created_at,
           u.username, u.rol
    FROM guardia_horarios gh
    INNER JOIN usuarios u ON u.id = gh.usuario_id
    WHERE gh.horario_id = ?
    ORDER BY gh.id ASC
  `);
  statement.bind([horarioId]);
  const assignments = [];
  while (statement.step()) assignments.push(statement.getAsObject());
  statement.free();
  return assignments;
}

function findScheduleAssignment(usuarioId, horarioId) {
  const statement = database.prepare(`
    SELECT id, usuario_id, horario_id, created_at
    FROM guardia_horarios
    WHERE usuario_id = ? AND horario_id = ?
  `);
  statement.bind([usuarioId, horarioId]);
  const assignment = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return assignment;
}

function insertScheduleAssignment({ usuarioId, horarioId }) {
  try {
    const statement = database.prepare(`
      INSERT INTO guardia_horarios (usuario_id, horario_id)
      VALUES (?, ?)
    `);
    statement.bind([usuarioId, horarioId]);
    statement.step();
    statement.free();
    saveDatabase();
    return findScheduleAssignment(usuarioId, horarioId);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: guardia_horarios.usuario_id, guardia_horarios.horario_id')) {
      const duplicateError = new Error('El guardia ya está asignado a este horario.');
      duplicateError.code = 'GUARD_ALREADY_ASSIGNED';
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }
}

function deleteScheduleAssignment(usuarioId, horarioId) {
  const assignment = findScheduleAssignment(usuarioId, horarioId);
  if (!assignment) return null;
  const statement = database.prepare(`DELETE FROM guardia_horarios WHERE id = ?`);
  statement.bind([assignment.id]);
  statement.step();
  statement.free();
  saveDatabase();
  return assignment;
}

function listLocales() {
  const statement = database.prepare(`
    SELECT id, nombre, latitud, longitud, created_at, updated_at
    FROM locales
    ORDER BY id ASC
  `);
  const locales = [];

  while (statement.step()) {
    locales.push(statement.getAsObject());
  }

  statement.free();
  return locales;
}

function findLocalById(id) {
  const statement = database.prepare(`
    SELECT id, nombre, latitud, longitud, created_at, updated_at
    FROM locales WHERE id = ?
  `);
  statement.bind([id]);
  const local = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return local;
}

function findLocalByName(nombre) {
  const statement = database.prepare(`
    SELECT id, nombre, latitud, longitud, created_at, updated_at
    FROM locales WHERE nombre = ?
  `);
  statement.bind([nombre]);
  const local = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return local;
}

function insertLocal({ nombre, latitud, longitud }) {
  try {
    const statement = database.prepare(`
      INSERT INTO locales (nombre, latitud, longitud)
      VALUES (?, ?, ?)
    `);
    statement.bind([nombre, Number(latitud), Number(longitud)]);
    statement.step();
    statement.free();
    saveDatabase();
    return findLocalByName(nombre);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: locales.nombre')) {
      const duplicateError = new Error('El nombre del local ya está registrado.');
      duplicateError.code = 'LOCAL_NAME_TAKEN';
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }
}

function updateLocalById(id, { nombre, latitud, longitud }) {
  const currentLocal = findLocalById(id);
  if (!currentLocal) {
    const error = new Error('Local no encontrado.');
    error.code = 'LOCAL_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const nextNombre = nombre ?? currentLocal.nombre;
  const nextLatitud = latitud ?? currentLocal.latitud;
  const nextLongitud = longitud ?? currentLocal.longitud;

  try {
    const statement = database.prepare(`
      UPDATE locales
      SET nombre = ?, latitud = ?, longitud = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    statement.bind([nextNombre, Number(nextLatitud), Number(nextLongitud), id]);
    statement.step();
    statement.free();
    saveDatabase();
    return findLocalById(id);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: locales.nombre')) {
      const duplicateError = new Error('El nombre del local ya está registrado.');
      duplicateError.code = 'LOCAL_NAME_TAKEN';
      duplicateError.status = 409;
      throw duplicateError;
    }
    throw error;
  }
}

function hasLocalRelations(localId) {
  const statement = database.prepare(`
    SELECT COUNT(*) AS total FROM guardia_locales WHERE local_id = ?
  `);
  statement.bind([localId]);
  const row = statement.step() ? statement.getAsObject() : { total: 0 };
  statement.free();
  return Number(row.total) > 0;
}

function deleteLocalById(id) {
  const currentLocal = findLocalById(id);
  if (!currentLocal) {
    const error = new Error('Local no encontrado.');
    error.code = 'LOCAL_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  if (hasLocalRelations(id)) {
    const error = new Error('No se puede eliminar un local que tiene relaciones activas.');
    error.code = 'LOCAL_HAS_RELATIONS';
    error.status = 409;
    throw error;
  }

  const statement = database.prepare(`DELETE FROM locales WHERE id = ?`);
  statement.bind([id]);
  statement.step();
  statement.free();
  saveDatabase();
  return currentLocal;
}

async function closeDatabase() {
  if (!database) return;
  saveDatabase();
  database.close();
  database = undefined;
}

module.exports = {
  initDatabase,
  closeDatabase,
  ensureAdminCredentials,
  insertUser,
  listUsers,
  findUserByUsername,
  findUserById,
  updateUserById,
  deleteUserById,
  replaceGuardBlockDates,
  listGuardBlockDatesByUserId,
  findAssignmentsForUserInDates,
  insertAssignment,
  findServiceById,
  listSchedules,
  findScheduleById,
  insertSchedule,
  updateScheduleById,
  deleteScheduleById,
  listScheduleAssignments,
  findScheduleAssignment,
  insertScheduleAssignment,
  deleteScheduleAssignment,
  listLocales,
  findLocalById,
  findLocalByName,
  insertLocal,
  updateLocalById,
  deleteLocalById,
  hasLocalRelations
};