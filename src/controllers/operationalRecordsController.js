const service = require('../services/operationalRecordsService');

function listMine(req, res, next) {
  try {
    const data = service.listOwnRecords(req.user.id, req.query);
    return res.json({ data, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMine };