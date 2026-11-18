const service = require('../services/operationalAdminService');

function closeRecord(req, res, next) {
  try {
    const registro = service.closeRecord(req.params.id, req.body);
    return res.json({ data: { registro }, error: null });
  } catch (error) {
    return next(error);
  }
}

function deleteRecords(req, res, next) {
  try {
    const resultado = service.deleteRecords(req.body?.ids);
    return res.json({ data: { resultado }, error: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { closeRecord, deleteRecords };