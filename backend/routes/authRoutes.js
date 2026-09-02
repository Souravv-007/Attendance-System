const express = require('express');
const rateLimit = require('express-rate-limit');
const { registerUser, loginUser } = require('../controllers/authController');
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

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/me', requireAuth, (req, res) => sendSuccess(res, 200, 'Authenticated user retrieved successfully', { user: req.user }));

module.exports = router;
