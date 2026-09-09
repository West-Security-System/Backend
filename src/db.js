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
    `);
    database.run('COMMIT');
    saveDatabase();
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

async function closeDatabase() {
  if (!database) return;
  saveDatabase();
  database.close();
  database = undefined;
}

module.exports = { initDatabase, closeDatabase };