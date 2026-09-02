const { getEmployees, updateEmployee, updateEmployeeStatus } = require('./employeeController');
const { sendSuccess } = require('../utils/response');
const { getSystemSettings, updateSystemSettings } = require('../services/systemSettingsService');
const { createAuditLog } = require('../utils/audit');

const getSettings = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    sendSuccess(res, 200, 'System settings retrieved successfully', { settings });
  } catch (error) { next(error); }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await updateSystemSettings(req.body);
    await createAuditLog(req.user, 'SYSTEM_SETTINGS_UPDATED', `Office hours updated to ${settings.officeStart}-${settings.officeEnd} UTC`);
    sendSuccess(res, 200, 'System settings updated successfully', { settings });
  } catch (error) { next(error); }
};

module.exports = { getSettings, updateSettings, getUsers: getEmployees, updateUser: updateEmployee, updateUserStatus: updateEmployeeStatus };
