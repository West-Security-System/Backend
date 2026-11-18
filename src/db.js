const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'west_control.db');
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
      CREATE TABLE IF NOT EXISTS registros_operativos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        local_id INTEGER NOT NULL,
        horario_id INTEGER,
        hora_ingreso TEXT NOT NULL,
        hora_egreso TEXT,
        latitud_ingreso REAL,
        longitud_ingreso REAL,
        latitud_egreso REAL,
        longitud_egreso REAL,
        duracion_segundos INTEGER,
        estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
        observaciones TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
        FOREIGN KEY (local_id) REFERENCES locales(id) ON DELETE RESTRICT,
        FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_registros_operativos_ingreso
        ON registros_operativos (hora_ingreso DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_registros_operativos_activos
        ON registros_operativos (hora_egreso, hora_ingreso DESC);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (6);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (7);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (8);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (9);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (10);
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        leida INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        leida_at TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_created
        ON notificaciones (usuario_id, created_at DESC, id DESC);
      INSERT OR IGNORE INTO schema_migrations (version)
      VALUES (11);
    `);
    ensureOperationalCoordinateColumns();
    ensureOperationalCheckinColumns();
    ensureOperationalDurationColumn();
    database.run('COMMIT');
    saveDatabase();
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

function ensureOperationalCoordinateColumns() {
  const columns = database.exec('PRAGMA table_info(registros_operativos)')[0].values.map((row) => row[1]);
  if (!columns.includes('latitud_ingreso')) database.run('ALTER TABLE registros_operativos ADD COLUMN latitud_ingreso REAL');
  if (!columns.includes('longitud_ingreso')) database.run('ALTER TABLE registros_operativos ADD COLUMN longitud_ingreso REAL');
  if (!columns.includes('latitud_egreso')) database.run('ALTER TABLE registros_operativos ADD COLUMN latitud_egreso REAL');
  if (!columns.includes('longitud_egreso')) database.run('ALTER TABLE registros_operativos ADD COLUMN longitud_egreso REAL');
}

function ensureOperationalCheckinColumns() {
  const columns = database.exec('PRAGMA table_info(registros_operativos)')[0].values.map((row) => row[1]);
  if (!columns.includes('horario_id')) database.run('ALTER TABLE registros_operativos ADD COLUMN horario_id INTEGER');
  if (!columns.includes('estado')) {
    database.run("ALTER TABLE registros_operativos ADD COLUMN estado TEXT NOT NULL DEFAULT 'abierto'");
    database.run("UPDATE registros_operativos SET estado = 'cerrado' WHERE hora_egreso IS NOT NULL");
  }
}

function ensureOperationalDurationColumn() {
  const columns = database.exec('PRAGMA table_info(registros_operativos)')[0].values.map((row) => row[1]);
  if (!columns.includes('duracion_segundos')) {
    database.run('ALTER TABLE registros_operativos ADD COLUMN duracion_segundos INTEGER');
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
  const rows = [];
  for (const date of new Set(dates)) {
    const statement = database.prepare(`
    SELECT id, usuario_id, fecha, motivo, created_at
    FROM guardia_asignaciones
    WHERE usuario_id = ? AND fecha = ?
    ORDER BY fecha ASC
  `);
    statement.bind([userId, date]);
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
  }
  return rows.sort((left, right) => left.fecha.localeCompare(right.fecha) || left.id - right.id);
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

function insertNotification({ userId, titulo, mensaje }) {
  const statement = database.prepare(`
    INSERT INTO notificaciones (usuario_id, titulo, mensaje, leida)
    VALUES (?, ?, ?, ?)
  `);
  statement.bind([userId, titulo, mensaje, 0]);
  statement.step();
  statement.free();
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
    insertNotification({
      userId: usuarioId,
      titulo: 'Nueva asignación',
      mensaje: `Se te asignó el horario ${horarioId}.`
    });
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

function listNotificationsByUser(userId, limit) {
  const statement = database.prepare(`
    SELECT id, usuario_id, titulo, mensaje, leida, created_at, leida_at
    FROM notificaciones
    WHERE usuario_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ?
  `);
  statement.bind([userId, limit]);
  const notifications = [];
  while (statement.step()) notifications.push(statement.getAsObject());
  statement.free();
  return notifications;
}

function countUnreadNotifications(userId) {
  const statement = database.prepare(`
    SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = ?
  `);
  statement.bind([userId, 0]);
  const total = statement.step() ? Number(statement.getAsObject().total) : 0;
  statement.free();
  return total;
}

function markNotificationsRead(userId) {
  database.run(`
    UPDATE notificaciones
    SET leida = ?, leida_at = CURRENT_TIMESTAMP
    WHERE usuario_id = ? AND leida = ?
  `, [1, userId, 0]);
  const updated = database.getRowsModified();
  if (updated > 0) saveDatabase();
  return updated;
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

function listOperationalRecords(filters = {}) {
  const statement = database.prepare(`
    SELECT r.id, r.usuario_id, u.username, r.local_id, l.nombre AS local_nombre,
      r.horario_id, r.hora_ingreso, r.hora_egreso, r.duracion_segundos, r.estado, r.observaciones
    FROM registros_operativos r
    INNER JOIN usuarios u ON u.id = r.usuario_id
    INNER JOIN locales l ON l.id = r.local_id
    WHERE (? IS NULL OR r.local_id = ?)
      AND (? IS NULL OR r.usuario_id = ?)
      AND (? IS NULL OR datetime(r.hora_ingreso) >= datetime(?))
      AND (? IS NULL OR datetime(r.hora_ingreso) <= datetime(?))
      AND (? = 0 OR r.hora_egreso IS NULL)
      AND (? IS NULL OR r.estado = ?)
    ORDER BY r.hora_ingreso DESC, r.id DESC LIMIT ?
  `);
  const localId = filters.localId ?? null;
  const userId = filters.userId ?? null;
  const from = filters.from ?? null;
  const to = filters.to ?? null;
  const activeOnly = Number(Boolean(filters.activeOnly));
  const state = filters.state ?? null;
  statement.bind([localId, localId, userId, userId, from, from, to, to, activeOnly, state, state, filters.limit]);
  const records = [];
  while (statement.step()) records.push(statement.getAsObject());
  statement.free();
  return records;
}

function findOperationalRecordById(id) {
  const statement = database.prepare(`
    SELECT r.*, u.id AS guardia_id, u.username AS guardia_username, u.rol AS guardia_rol,
      l.nombre AS local_nombre, l.latitud AS local_latitud, l.longitud AS local_longitud,
      h.dias AS horario_dias, h.hora_inicio AS horario_hora_inicio,
      h.hora_fin AS horario_hora_fin, h.capacidad AS horario_capacidad
    FROM registros_operativos r
    INNER JOIN usuarios u ON u.id = r.usuario_id
    INNER JOIN locales l ON l.id = r.local_id
    LEFT JOIN horarios h ON h.id = r.horario_id
    WHERE r.id = ?
  `);
  statement.bind([id]);
  const record = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return record;
}

function listOperationalCalendarRecords({ localId, from, to }) {
  const statement = database.prepare(`
    SELECT r.*, u.id AS guardia_id, u.username AS guardia_username, u.rol AS guardia_rol,
      l.nombre AS local_nombre, l.latitud AS local_latitud, l.longitud AS local_longitud,
      h.dias AS horario_dias, h.hora_inicio AS horario_hora_inicio,
      h.hora_fin AS horario_hora_fin, h.capacidad AS horario_capacidad
    FROM registros_operativos r
    INNER JOIN usuarios u ON u.id = r.usuario_id
    INNER JOIN locales l ON l.id = r.local_id
    LEFT JOIN horarios h ON h.id = r.horario_id
    WHERE r.local_id = ? AND datetime(r.hora_ingreso) >= datetime(?)
      AND datetime(r.hora_ingreso) < datetime(?)
    ORDER BY datetime(r.hora_ingreso) ASC, r.id ASC
  `);
  statement.bind([localId, from, to]);
  const records = [];
  while (statement.step()) records.push(statement.getAsObject());
  statement.free();
  return records;
}

function closeOperationalRecord({ id, horaEgreso, durationSeconds }) {
  database.run(`
    UPDATE registros_operativos
    SET hora_egreso = ?, duracion_segundos = ?, estado = ?
    WHERE id = ? AND hora_egreso IS NULL AND estado = ?
  `, [horaEgreso, durationSeconds, 'cerrado', id, 'abierto']);
  if (database.getRowsModified() === 0) return null;
  saveDatabase();
  return findOperationalRecordById(id);
}

function deleteOperationalRecordsTransaction(ids) {
  database.run('BEGIN');
  const deletedIds = [];
  try {
    for (const id of ids) {
      database.run('DELETE FROM registros_operativos WHERE id = ?', [id]);
      if (database.getRowsModified() > 0) deletedIds.push(id);
    }
    database.run('COMMIT');
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
  if (deletedIds.length) saveDatabase();
  const deleted = new Set(deletedIds);
  return { deletedIds, notFoundIds: ids.filter((id) => !deleted.has(id)) };
}

function insertOperationalEntry({ userId, localId, scheduleId = null, latitud, longitud, timestamp = new Date().toISOString() }) {
  database.run(`
    INSERT INTO registros_operativos
      (usuario_id, local_id, horario_id, hora_ingreso, latitud_ingreso, longitud_ingreso, estado)
    VALUES (?, ?, ?, ?, ?, ?, 'abierto')
  `, [userId, localId, scheduleId, timestamp, latitud, longitud]);
  const statement = database.prepare('SELECT * FROM registros_operativos WHERE id = last_insert_rowid()');
  const record = statement.step() ? statement.getAsObject() : null;
  statement.free();
  saveDatabase();
  return record;
}

function findOpenOperationalEntry(userId) {
  const search = database.prepare(`
    SELECT r.*, l.latitud AS servicio_latitud, l.longitud AS servicio_longitud
    FROM registros_operativos r
    INNER JOIN locales l ON l.id = r.local_id
    WHERE r.usuario_id = ? AND r.hora_egreso IS NULL
    ORDER BY r.hora_ingreso DESC, r.id DESC LIMIT 1
  `);
  search.bind([userId]);
  const match = search.step() ? search.getAsObject() : null;
  search.free();
  return match;
}

function findOperationalEntryById(id) {
  const statement = database.prepare('SELECT * FROM registros_operativos WHERE id = ?');
  statement.bind([id]);
  const record = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return record;
}

function closeOperationalEntryById({ id, userId, latitud, longitud, timestamp, durationSeconds }) {
  database.run(`
    UPDATE registros_operativos
    SET hora_egreso = ?, latitud_egreso = ?, longitud_egreso = ?, duracion_segundos = ?, estado = ?
    WHERE id = ? AND usuario_id = ? AND hora_egreso IS NULL AND estado = ?
  `, [timestamp, latitud, longitud, durationSeconds, 'cerrado', id, userId, 'abierto']);
  if (database.getRowsModified() === 0) return null;
  const statement = database.prepare('SELECT * FROM registros_operativos WHERE id = ? AND usuario_id = ?');
  statement.bind([id, userId]);
  const record = statement.step() ? statement.getAsObject() : null;
  statement.free();
  saveDatabase();
  return record;
}

function listOperationalRecordsForUser({ userId, limit, offset }) {
  const statement = database.prepare(`
    SELECT r.id, r.usuario_id, u.username, r.local_id, l.nombre AS local_nombre,
      r.horario_id, r.hora_ingreso, r.hora_egreso, r.latitud_ingreso, r.longitud_ingreso,
      r.latitud_egreso, r.longitud_egreso, r.duracion_segundos, r.estado, r.observaciones
    FROM registros_operativos r
    INNER JOIN usuarios u ON u.id = r.usuario_id
    INNER JOIN locales l ON l.id = r.local_id
    WHERE r.usuario_id = ?
    ORDER BY datetime(r.hora_ingreso) DESC, r.id DESC
    LIMIT ? OFFSET ?
  `);
  statement.bind([userId, limit, offset]);
  const records = [];
  while (statement.step()) records.push(statement.getAsObject());
  statement.free();
  return records;
}

function closeOperationalEntry({
  userId,
  latitud,
  longitud,
  timestamp = new Date().toISOString(),
  durationSeconds = null
}) {
  const match = findOpenOperationalEntry(userId);
  if (!match) return null;
  database.run(`
    UPDATE registros_operativos
    SET hora_egreso = ?, latitud_egreso = ?, longitud_egreso = ?, duracion_segundos = ?, estado = 'cerrado'
    WHERE id = ? AND usuario_id = ? AND hora_egreso IS NULL
  `, [timestamp, latitud, longitud, durationSeconds, match.id, userId]);
  const statement = database.prepare('SELECT * FROM registros_operativos WHERE id = ? AND usuario_id = ?');
  statement.bind([match.id, userId]);
  const record = statement.step() ? statement.getAsObject() : null;
  statement.free();
  saveDatabase();
  return record;
}

function hasOpenOperationalEntry(userId) {
  const statement = database.prepare(`
    SELECT id FROM registros_operativos
    WHERE usuario_id = ? AND hora_egreso IS NULL
    LIMIT 1
  `);
  statement.bind([userId]);
  const exists = statement.step();
  statement.free();
  return exists;
}

function findAssignedSchedule(userId, scheduleId) {
  const statement = database.prepare(`
    SELECT h.id, h.servicio_id, h.dias, h.hora_inicio, h.hora_fin, h.capacidad
    FROM guardia_horarios gh
    INNER JOIN horarios h ON h.id = gh.horario_id
    WHERE gh.usuario_id = ? AND gh.horario_id = ?
  `);
  statement.bind([userId, scheduleId]);
  const schedule = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return schedule;
}

function listGuardServices(userId) {
  const statement = database.prepare(`
    SELECT DISTINCT l.id, l.nombre
    FROM guardia_horarios gh
    INNER JOIN horarios h ON h.id = gh.horario_id
    INNER JOIN locales l ON l.id = h.servicio_id
    WHERE gh.usuario_id = ?
    ORDER BY l.nombre COLLATE NOCASE, l.id
  `);
  statement.bind([userId]);
  const services = [];
  while (statement.step()) services.push(statement.getAsObject());
  statement.free();
  return services;
}

function findAssignedService(userId, serviceName) {
  const statement = database.prepare(`
    SELECT DISTINCT l.id, l.nombre
    FROM guardia_horarios gh
    INNER JOIN horarios h ON h.id = gh.horario_id
    INNER JOIN locales l ON l.id = h.servicio_id
    WHERE gh.usuario_id = ? AND l.nombre = ? COLLATE NOCASE
    LIMIT 1
  `);
  statement.bind([userId, serviceName]);
  const service = statement.step() ? statement.getAsObject() : null;
  statement.free();
  return service;
}

function listGuardSchedules(userId, serviceId) {
  const statement = database.prepare(`
    SELECT h.id, h.servicio_id, l.nombre AS servicio_nombre, h.dias,
      h.hora_inicio, h.hora_fin, h.capacidad
    FROM guardia_horarios gh
    INNER JOIN horarios h ON h.id = gh.horario_id
    INNER JOIN locales l ON l.id = h.servicio_id
    WHERE gh.usuario_id = ? AND h.servicio_id = ?
    ORDER BY h.hora_inicio, h.id
  `);
  statement.bind([userId, serviceId]);
  const schedules = [];
  while (statement.step()) schedules.push(statement.getAsObject());
  statement.free();
  return schedules;
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
  listNotificationsByUser,
  countUnreadNotifications,
  markNotificationsRead,
  listLocales,
  findLocalById,
  findLocalByName,
  insertLocal,
  updateLocalById,
  deleteLocalById,
  hasLocalRelations,
  listOperationalRecords,
  findOperationalRecordById,
  listOperationalCalendarRecords,
  closeOperationalRecord,
  deleteOperationalRecordsTransaction,
  listGuardServices,
  findAssignedService,
  listGuardSchedules,
  insertOperationalEntry,
  findOpenOperationalEntry,
  findOperationalEntryById,
  closeOperationalEntryById,
  listOperationalRecordsForUser,
  closeOperationalEntry,
  hasOpenOperationalEntry,
  findAssignedSchedule,
  findScheduleById
};
