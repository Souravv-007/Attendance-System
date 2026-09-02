const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { sendPasswordResetEmail } = require('../services/emailService');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jwtSecret = process.env.JWT_SECRET;
const PASSWORD_RESET_MESSAGE = 'If an account exists for this email, a password reset link has been sent.';
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const isValidEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const sendError = (res, next, error) => {
  if (typeof next === 'function') {
    return next(error);
  }

  if (res && typeof res.status === 'function') {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Something went wrong',
    });
  }

  throw error;
};

const recordFailedLogin = () => {
  createAuditLog(null, 'AUTH_LOGIN_FAILED', 'Login attempt failed').catch(() => {});
};

const generateToken = (user) => {
  if (!jwtSecret) {
    throw new AppError(500, 'Authentication is not configured');
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: '7d',
    }
  );
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  employeeId: user.employeeId,
  role: user.role,
  department: user.department || null,
  isActive: user.isActive,
  leaveBalances: user.leaveBalances,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const registerUser = async (req, res, next) => {
  try {
    const { name, employeeId, email, password, department } = req.body;

    if (![name, employeeId, email, password].every((value) => typeof value === 'string' && value.trim())) {
      return sendError(res, next, new AppError(400, 'Name, employee ID, email, and password are required'));
    }

    if (password.length < 8) {
      return sendError(res, next, new AppError(400, 'Password must be at least 8 characters long'));
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return sendError(res, next, new AppError(400, 'Please provide a valid email address'));
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return sendError(res, next, new AppError(409, 'A user with this email already exists'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      employeeId: employeeId.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'EMPLOYEE',
      department: department || null,
    });

    const token = generateToken(user);
    await createAuditLog(user, 'AUTH_REGISTERED', 'User registration completed');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    sendError(res, next, error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (![email, password].every((value) => typeof value === 'string' && value.trim())) {
      return sendError(res, next, new AppError(400, 'Email and password are required'));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      recordFailedLogin();
      return sendError(res, next, new AppError(401, 'Invalid email or password'));
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      recordFailedLogin();
      return sendError(res, next, new AppError(401, 'Invalid email or password'));
    }

    if (user.isActive === false) {
      return sendError(res, next, new AppError(403, 'Your account is inactive'));
    }

    const token = generateToken(user);
    await createAuditLog(user, 'AUTH_LOGIN_SUCCESS', 'Successful login');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    sendError(res, next, error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    if (!isValidEmail(req.body.email)) return sendError(res, next, new AppError(400, 'Please provide a valid email address'));
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires');
    if (!user) return res.status(200).json({ success: true, message: PASSWORD_RESET_MESSAGE, data: {} });

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashResetToken(token);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
    try {
      const delivery = await sendPasswordResetEmail({ to: user.email, resetUrl });
      const data = process.env.NODE_ENV === 'development' && delivery.developmentResetUrl
        ? { developmentResetUrl: delivery.developmentResetUrl }
        : {};
      return res.status(200).json({ success: true, message: PASSWORD_RESET_MESSAGE, data });
    } catch (error) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;
      await user.save();
      return res.status(200).json({ success: true, message: PASSWORD_RESET_MESSAGE, data: {} });
    }
  } catch (error) { return sendError(res, next, error); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return sendError(res, next, new AppError(400, 'Invalid or expired password reset link'));
    if (typeof password !== 'string' || password.length < 8) return sendError(res, next, new AppError(400, 'Password must be at least 8 characters long'));
    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpires');
    if (!user) return sendError(res, next, new AppError(400, 'Invalid or expired password reset link'));

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();
    await createAuditLog(user, 'PASSWORD_RESET', 'Password reset completed');
    return res.status(200).json({ success: true, message: 'Password reset successful', data: {} });
  } catch (error) { return sendError(res, next, error); }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'email'];
    const invalidField = Object.keys(req.body).find((key) => !allowedFields.includes(key));
    if (invalidField) return sendError(res, next, new AppError(403, `Updates to ${invalidField} are not permitted`));
    if (!req.body.name && !req.body.email) return sendError(res, next, new AppError(400, 'Name or email is required'));
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, next, new AppError(404, 'User not found'));
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string') return sendError(res, next, new AppError(400, 'Name must be a string'));
      if (req.body.name.trim().length < 2) return sendError(res, next, new AppError(400, 'Name must be at least 2 characters long'));
      user.name = req.body.name.trim();
    }
    if (req.body.email !== undefined) {
      if (typeof req.body.email !== 'string') return sendError(res, next, new AppError(400, 'Email must be a string'));
      const email = req.body.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, next, new AppError(400, 'Please provide a valid email address'));
      user.email = email;
    }
    await user.save();
    await createAuditLog(req.user, 'PROFILE_UPDATED', `User ${user._id} updated own profile fields: ${Object.keys(req.body).join(', ')}`);
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: sanitizeUser(user) } });
  } catch (error) { sendError(res, next, error); }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  updateMyProfile,
};
