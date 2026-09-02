const express = require('express');
const {
	getEmployees,
	getEmployeeById,
	createEmployee,
	updateEmployee,
	updateEmployeeStatus,
} = require('../controllers/employeeController');
const { requireAuth, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);
router.get('/', authorizeRoles('HR', 'ADMIN'), getEmployees);
router.get('/:id', authorizeRoles('HR', 'ADMIN'), getEmployeeById);
router.post('/', authorizeRoles('HR', 'ADMIN'), createEmployee);
router.put('/:id', authorizeRoles('HR', 'ADMIN'), updateEmployee);
router.patch('/:id/status', authorizeRoles('ADMIN'), updateEmployeeStatus);

module.exports = router;
