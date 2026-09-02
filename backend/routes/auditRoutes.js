const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { getAuditLogs } = require('../controllers/auditController');

const router = express.Router();
router.use(requireAuth, requireRole('HR', 'ADMIN'));
router.get('/', getAuditLogs);

module.exports = router;
