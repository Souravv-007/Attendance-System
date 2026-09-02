const express = require('express');
const {
  getDepartments,
  createDepartment,
  updateDepartment,
} = require('../controllers/departmentController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, authorizeRoles('HR', 'ADMIN'));
router.get('/', getDepartments);
router.post('/', createDepartment);
router.put('/:id', updateDepartment);

module.exports = router;
