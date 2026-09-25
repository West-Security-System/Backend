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
    `);
    database.run('COMMIT');
    saveDatabase();
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
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

async function closeDatabase() {
  if (!database) return;
  saveDatabase();
  database.close();
  database = undefined;
}

module.exports = {
  initDatabase,
  closeDatabase,
  insertUser,
  listUsers,
  findUserByUsername,
  findUserById,
  updateUserById,
  deleteUserById
};