const express = require('express');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { getUsers, updateUser, updateUserStatus, getSystemSettings } = require('../controllers/adminController');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', updateUserStatus);
router.get('/settings', getSystemSettings);
module.exports = router;
