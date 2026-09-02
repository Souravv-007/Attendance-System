const express = require('express');
const { getEmployees, getEmployeeById } = require('../controllers/employeeController');

const router = express.Router();

router.get('/', getEmployees);
router.get('/:id', getEmployeeById);

module.exports = router;
