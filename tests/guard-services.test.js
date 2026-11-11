const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/guardServicesRepository');
const service = require('../src/services/guardServicesService');
const controller = require('../src/controllers/guardServicesController');

test('guard services service returns assigned services and schedules', (context) => {
  const serviceRows = [{ id: 1, nombre: 'Central' }];
  const schedule = { id: 2, servicio_id: 1 };
  context.mock.method(repository, 'listServices', () => serviceRows);
  context.mock.method(repository, 'findServiceForGuard', () => ({ id: 1, nombre: 'Central' }));
  context.mock.method(repository, 'listSchedules', () => [schedule]);

  assert.deepEqual(service.listServices(9), serviceRows);
  assert.deepEqual(service.listSchedules(9, ' Central '), {
    servicio: { id: 1, nombre: 'Central' },
    horarios: [schedule]
  });
});

test('guard services service rejects empty or unassigned service names', (context) => {
  context.mock.method(repository, 'findServiceForGuard', () => null);
  context.mock.method(repository, 'listSchedules', () => []);

  assert.throws(() => service.listSchedules(9, ' '), { status: 422, code: 'INVALID_SERVICE_NAME' });
  assert.throws(() => service.listSchedules(9, 'Unknown'), { status: 403, code: 'SERVICE_NOT_ASSIGNED' });
});

test('guard services repository and controllers delegate successful responses and errors', (context) => {
  let listServicesArguments;
  let findServiceArguments;
  let listSchedulesArguments;
  context.mock.method(repository, 'listServices', (userId) => { listServicesArguments = [userId]; return []; });
  context.mock.method(repository, 'findServiceForGuard', (userId, name) => {
    findServiceArguments = [userId, name];
    return { id: 1, nombre: name };
  });
  context.mock.method(repository, 'listSchedules', (userId, id) => {
    listSchedulesArguments = [userId, id];
    return [];
  });

  const response = { json(body) { this.body = body; return this; } };
  controller.listServices({ user: { id: 4 } }, response, assert.fail);
  assert.deepEqual(response.body, { data: { servicios: [] }, error: null });
  controller.listSchedules({ user: { id: 4 }, params: { nombre: 'Central' } }, response, assert.fail);
  assert.deepEqual(listServicesArguments, [4]);
  assert.deepEqual(findServiceArguments, [4, 'Central']);
  assert.deepEqual(listSchedulesArguments, [4, 1]);
  assert.deepEqual(response.body, {
    data: { servicio: { id: 1, nombre: 'Central' }, horarios: [] },
    error: null
  });

  const failure = new Error('repository failure');
  context.mock.method(service, 'listServices', () => { throw failure; });
  let forwarded;
  controller.listServices({ user: { id: 4 } }, response, (error) => { forwarded = error; });
  assert.equal(forwarded, failure);
});
