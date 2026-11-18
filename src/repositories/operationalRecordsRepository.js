const { listOperationalRecords } = require('../db');
const database = require('../db');

function list(filters) {
  return listOperationalRecords(filters);
}

function listForUser(filters) {
  return database.listOperationalRecordsForUser(filters);
}

module.exports = { list, listForUser };
