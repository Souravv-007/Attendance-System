const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { getHrDashboard } = require('../controllers/dashboardController');

const router = express.Router();
router.get('/hr', requireAuth, requireRole('HR', 'ADMIN'), getHrDashboard);
module.exports = router;