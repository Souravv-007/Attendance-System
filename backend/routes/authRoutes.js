const express = require('express');
const rateLimit = require('express-rate-limit');
const { registerUser, loginUser, forgotPassword, resetPassword, updateMyProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendSuccess } = require('../utils/response');

const router = express.Router();
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	message: {
		success: false,
		message: 'Too many authentication attempts, please try again later.',
	},
});
const createPasswordResetLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts, please try again later.' },
});
const forgotPasswordLimiter = createPasswordResetLimiter();
const resetPasswordLimiter = createPasswordResetLimiter();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
router.get('/me', requireAuth, (req, res) => sendSuccess(res, 200, 'Authenticated user retrieved successfully', { user: req.user }));
router.patch('/me', requireAuth, updateMyProfile);

module.exports = router;
