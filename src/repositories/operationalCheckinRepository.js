const { findLocalById, insertOperationalEntry, closeOperationalEntry } = require('../db');

function localExists(localId) {
  return Boolean(findLocalById(localId));
}

function createEntry(data) {
  return insertOperationalEntry(data);
}

function closeEntry(data) {
  return closeOperationalEntry(data);
}

module.exports = { localExists, createEntry, closeEntry };
