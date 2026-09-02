const AuditLog = require('../models/AuditLog');
const { sendSuccess } = require('../utils/response');

const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('user', 'name email role employeeId').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    sendSuccess(res, 200, 'Audit logs retrieved successfully', { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAuditLogs };
