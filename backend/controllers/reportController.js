const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const User = require('../models/User');
const { getWorkingDate } = require('../utils/date');
const { sendSuccess } = require('../utils/response');

const buildFilter = async (query) => {
  const filter = {};
  if (query.employee) filter.employee = query.employee;
  if (query.department) {
    const users = await User.find({ department: query.department }).select('_id');
    filter.employee = { $in: users.map((user) => user._id) };
  }
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = getWorkingDate(new Date(query.from));
    if (query.to) filter.date.$lte = getWorkingDate(new Date(query.to));
  }
  return filter;
};

const getAttendanceReport = async (req, res, next) => {
  try {
    const filter = await buildFilter(req.query);
    const [attendance, leaves] = await Promise.all([
      Attendance.find(filter).populate({ path: 'employee', select: '-password', populate: { path: 'department' } }).sort({ date: -1 }).limit(1000),
      Leave.find({
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(filter.employee ? { employee: filter.employee } : {}),
        ...(req.query.from || req.query.to ? {
          startDate: { ...(req.query.from ? { $gte: getWorkingDate(new Date(req.query.from)) } : {}), ...(req.query.to ? { $lte: getWorkingDate(new Date(req.query.to)) } : {}) },
        } : {}),
      }).populate('employee', '-password').sort({ startDate: -1 }).limit(1000),
    ]);
    const summary = attendance.reduce((result, item) => { result.total += 1; result[item.status.toLowerCase()] = (result[item.status.toLowerCase()] || 0) + 1; return result; }, { total: 0, present: 0, late: 0, absent: 0, half_day: 0, on_leave: 0 });
    sendSuccess(res, 200, 'Attendance report retrieved successfully', { attendance, leaves, summary });
  } catch (error) { next(error); }
};

module.exports = {
  getAttendanceReport,
};
