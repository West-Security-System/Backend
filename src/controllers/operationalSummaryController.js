const service = require('../services/operationalSummaryService');

function listActive(req, res, next) {
  try {
    return res.json({ data: service.getSummary(req.query, true), error: null });
  } catch (error) {
    return next(error);
  }
}

function listRecords(req, res, next) {
  try {
    return res.json({ data: service.getSummary(req.query, false), error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listActive, listRecords };
