const Notification = require('../models/Notification');

const createNotification = async (user, message) => {
  return Notification.create({
    user: user && user._id ? user._id : user,
    message,
  });
};

const getUserNotifications = async (userId, { page = 1, limit = 10, unreadOnly = false } = {}) => {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getUnreadCount = (userId) => Notification.countDocuments({ user: userId, read: false });

module.exports = { createNotification, getUserNotifications, getUnreadCount };
