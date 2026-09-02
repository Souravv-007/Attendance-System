const express = require('express');
const {
  createCorrection,
  getCorrections,
  approveCorrection,
  rejectCorrection,
} = require('../controllers/correctionController');

const router = express.Router();

router.post('/', createCorrection);
router.get('/', getCorrections);
router.put('/:id/approve', approveCorrection);
router.put('/:id/reject', rejectCorrection);

module.exports = router;
