const repository = require('../repositories/guardServicesRepository');
const apiError = require('../utils/apiError');

function listServices(userId) {
  return repository.listServices(userId);
}

function listSchedules(userId, serviceName) {
  if (typeof serviceName !== 'string' || !serviceName.trim()) {
    throw apiError(422, 'INVALID_SERVICE_NAME', 'El nombre del servicio no es válido.', ['nombre']);
  }
  const service = repository.findServiceForGuard(userId, serviceName.trim());
  if (!service) throw apiError(403, 'SERVICE_NOT_ASSIGNED', 'El servicio no está asignado a este guardia.');
  return { servicio: service, horarios: repository.listSchedules(userId, service.id) };
}

module.exports = { listServices, listSchedules };
