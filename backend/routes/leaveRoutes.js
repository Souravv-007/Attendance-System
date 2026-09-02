const express = require('express');
const {
  createLeave,
  getMyLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
} = require('../controllers/leaveController');

const router = express.Router();

router.post('/', createLeave);
router.get('/my-leaves', getMyLeaves);
router.get('/', getAllLeaves);
router.put('/:id/approve', approveLeave);
router.put('/:id/reject', rejectLeave);

module.exports = router;
