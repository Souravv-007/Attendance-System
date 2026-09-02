const express = require('express');
const { getAttendanceReport } = require('../controllers/reportController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/attendance', authorizeRoles('HR', 'ADMIN'), getAttendanceReport);

module.exports = router;
