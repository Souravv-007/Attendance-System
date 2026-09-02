const express = require('express');
const {
  createCorrection,
  getCorrections,
  approveCorrection,
  rejectCorrection,
} = require('../controllers/correctionController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.post('/', createCorrection);
router.get('/pending', authorizeRoles('HR', 'ADMIN'), getCorrections);
router.get('/', authorizeRoles('HR', 'ADMIN'), getCorrections);
router.put('/:id/approve', authorizeRoles('HR', 'ADMIN'), approveCorrection);
router.put('/:id/reject', authorizeRoles('HR', 'ADMIN'), rejectCorrection);

module.exports = router;
