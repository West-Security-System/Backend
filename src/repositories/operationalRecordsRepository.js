const { listOperationalRecords } = require('../db');

function list(filters) {
  return listOperationalRecords(filters);
}

module.exports = { list };
