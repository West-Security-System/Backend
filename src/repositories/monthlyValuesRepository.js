const database = require('../db');

function findService(id) {
  return database.findLocalById(id);
}

function find(serviceId, year, month) {
  return database.findMonthlyValue(serviceId, year, month);
}

function upsert(data) {
  return database.upsertMonthlyValue(data);
}

module.exports = { findService, find, upsert };