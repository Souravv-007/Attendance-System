const express = require('express');
const {
  checkInEmployee,
  checkOutEmployee,
  getMyAttendance,
} = require('../controllers/attendanceController');

const router = express.Router();

router.post('/check-in', checkInEmployee);
router.post('/check-out', checkOutEmployee);
router.get('/my-attendance', getMyAttendance);

module.exports = router;
