const AppError = require('../utils/AppError');

const VALID_LEAVE_TYPES = ['SICK', 'CASUAL', 'ANNUAL', 'OTHER'];

const parseDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const calculateLeaveDays = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return null;
  return Math.floor((end - start) / 86400000) + 1;
};

const validateLeaveInput = ({ leaveType, startDate, endDate, reason }) => {
  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);
  if (!parsedStart || !parsedEnd) throw new AppError(400, 'Valid start and end dates are required');
  if (parsedStart > parsedEnd) throw new AppError(400, 'Start date cannot be after end date');
  if (!VALID_LEAVE_TYPES.includes(leaveType)) throw new AppError(400, 'Invalid leave type');
  if (!reason || reason.trim().length < 3) throw new AppError(400, 'A meaningful reason is required');
  return { startDate: parsedStart, endDate: parsedEnd, leaveDays: calculateLeaveDays(parsedStart, parsedEnd) };
};

const balanceFor = (user, leaveType) => Number(user.leaveBalances && user.leaveBalances[leaveType]) || 0;

module.exports = { VALID_LEAVE_TYPES, parseDate, calculateLeaveDays, validateLeaveInput, balanceFor };
