const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { getUserNotifications, getUnreadCount } = require('../services/notificationService');

const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const data = await getUserNotifications(req.user._id, { page, limit, unreadOnly: req.query.unreadOnly === 'true' });
    sendSuccess(res, 200, 'Notifications retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

const getMyUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await getUnreadCount(req.user._id);
    sendSuccess(res, 200, 'Unread notification count retrieved successfully', { unreadCount });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) return next(new AppError(404, 'Notification not found'));
    sendSuccess(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyNotifications, getMyUnreadCount, markNotificationRead };
