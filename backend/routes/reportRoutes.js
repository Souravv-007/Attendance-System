const express = require('express');
const { getAttendanceReport } = require('../controllers/reportController');

const router = express.Router();

router.get('/attendance', getAttendanceReport);

module.exports = router;
