const { listGuardServices, findAssignedService, listGuardSchedules } = require('../db');

function listServices(userId) {
  return listGuardServices(userId);
}

function findServiceForGuard(userId, serviceName) {
  return findAssignedService(userId, serviceName);
}

function listSchedules(userId, serviceId) {
  return listGuardSchedules(userId, serviceId);
}

module.exports = { listServices, findServiceForGuard, listSchedules };
