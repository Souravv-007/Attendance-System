const AuditLog = require('../models/AuditLog');

const createAuditLog = async (user, action, details = '') => {
  return AuditLog.create({
    user: user ? user._id : null,
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details),
  });
};

module.exports = { createAuditLog };