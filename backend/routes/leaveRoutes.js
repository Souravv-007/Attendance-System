const express = require('express');
const {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require('../controllers/leaveController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', createLeave);
router.get('/my-leaves', getMyLeaves);
router.get('/pending', authorizeRoles('HR', 'ADMIN'), getPendingLeaves);
router.get('/', authorizeRoles('HR', 'ADMIN'), getAllLeaves);
router.put('/:id/approve', authorizeRoles('HR', 'ADMIN'), approveLeave);
router.put('/:id/reject', authorizeRoles('HR', 'ADMIN'), rejectLeave);
router.delete('/:id/cancel', cancelLeave);

module.exports = router;
