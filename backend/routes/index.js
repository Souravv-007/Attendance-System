const express = require('express');
const authRoutes = require('./authRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const correctionRoutes = require('./correctionRoutes');
const employeeRoutes = require('./employeeRoutes');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/corrections', correctionRoutes);
router.use('/employees', employeeRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
