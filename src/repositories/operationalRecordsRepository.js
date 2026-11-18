const database = require('../db');

function list(filters) {
  return database.listOperationalRecords(filters);
}

function listForUser(filters) {
  return database.listOperationalRecordsForUser(filters);
}

function findById(id) {
  return database.findOperationalRecordById(id);
}

module.exports = { list, listForUser, findById };
