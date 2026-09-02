const express = require('express');
const {
  checkInEmployee,
  checkOutEmployee,
  getMyAttendance,
  getAllAttendance,
} = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/check-in', checkInEmployee);
router.post('/check-out', checkOutEmployee);
router.get('/my-attendance', getMyAttendance);
router.get('/me', getMyAttendance);
router.get('/management', requireRole('HR', 'ADMIN'), getAllAttendance);

module.exports = router;
