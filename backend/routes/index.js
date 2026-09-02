const express = require('express');
const authRoutes = require('./authRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const correctionRoutes = require('./correctionRoutes');
const employeeRoutes = require('./employeeRoutes');
const reportRoutes = require('./reportRoutes');
const departmentRoutes = require('./departmentRoutes');
const notificationRoutes = require('./notificationRoutes');
const auditRoutes = require('./auditRoutes');
const dashboardRoutes = require('./dashboardRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/corrections', correctionRoutes);
router.use('/employees', employeeRoutes);
router.use('/reports', reportRoutes);
router.use('/departments', departmentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/dashboards', dashboardRoutes);

module.exports = router;
