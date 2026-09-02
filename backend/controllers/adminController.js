const { getEmployees, updateEmployee, updateEmployeeStatus } = require('./employeeController');
const { sendSuccess } = require('../utils/response');
const { OFFICE_START_HOUR, OFFICE_START_MINUTE, HALF_DAY_THRESHOLD_MINUTES } = require('../services/attendanceStatusService');
const { EXPECTED_WORKING_MINUTES } = require('../services/attendanceService');

const getSystemSettings = (req, res) => sendSuccess(res, 200, 'System settings retrieved successfully', {
  settings: {
    officeStart: `${String(OFFICE_START_HOUR).padStart(2, '0')}:${String(OFFICE_START_MINUTE).padStart(2, '0')} UTC`,
    expectedWorkingMinutes: EXPECTED_WORKING_MINUTES,
    assumedBreakMinutes: 60,
    halfDayThresholdMinutes: HALF_DAY_THRESHOLD_MINUTES,
  },
});

module.exports = { getSystemSettings, getUsers: getEmployees, updateUser: updateEmployee, updateUserStatus: updateEmployeeStatus };
