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

function findService(id) {
  return database.findLocalById(id);
}

function listCalendar(filters) {
  return database.listOperationalCalendarRecords(filters);
}

function closeByAdmin(data) {
  return database.closeOperationalRecord(data);
}

function deleteMany(ids) {
  return database.deleteOperationalRecordsTransaction(ids);
}

module.exports = { list, listForUser, findById, findService, listCalendar, closeByAdmin, deleteMany };
