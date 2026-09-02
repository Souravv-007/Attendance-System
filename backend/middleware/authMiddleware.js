const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const AppError = require('../utils/AppError');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jwtSecret = process.env.JWT_SECRET;

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, 'Authentication required'));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!jwtSecret) {
      return next(new AppError(500, 'Authentication is not configured'));
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new AppError(401, 'User not found'));
    }

    if (user.isActive === false) {
      return next(new AppError(401, 'Account is inactive'));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Token expired'));
    }

    if (error.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'Invalid token'));
    }

    next(error);
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to access this resource'));
    }

    next();
  };
};

const authorizeRoles = requireRole;

module.exports = { requireAuth, requireRole, authorizeRoles };
