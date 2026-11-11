const database = require('../db');

function localExists(localId) {
  return Boolean(database.findLocalById(localId));
}

function createEntry(data) {
  return database.insertOperationalEntry(data);
}

function closeEntry(data) {
  return database.closeOperationalEntry(data);
}

function findOpenEntry(userId) {
  return database.findOpenOperationalEntry(userId);
}

module.exports = { localExists, createEntry, closeEntry, findOpenEntry };
