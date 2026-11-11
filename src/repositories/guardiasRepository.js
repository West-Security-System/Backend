const {
  findLocalById,
  findScheduleById,
  findAssignedSchedule,
  hasOpenOperationalEntry,
  insertOperationalEntry
} = require('../db');

function findService(serviceId) {
  return findLocalById(serviceId);
}

function findScheduleForGuard(userId, scheduleId) {
  return findAssignedSchedule(userId, scheduleId);
}

function findSchedule(scheduleId) {
  return findScheduleById(scheduleId);
}

function guardHasOpenEntry(userId) {
  return hasOpenOperationalEntry(userId);
}

function createEntry(data) {
  return insertOperationalEntry(data);
}

module.exports = { findService, findSchedule, findScheduleForGuard, guardHasOpenEntry, createEntry };
