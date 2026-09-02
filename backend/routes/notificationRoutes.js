const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(requireAuth);
router.get('/', getMyNotifications);
router.get('/unread-count', getMyUnreadCount);
router.patch('/:id/read', markNotificationRead);

module.exports = router;
