const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const { sendSuccess } = require('../utils/response');
const { getWorkingDate } = require('../utils/date');

const getHrDashboard = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = getWorkingDate(new Date(req.query.from));
      if (req.query.to) filter.date.$lte = getWorkingDate(new Date(req.query.to));
    }
    if (req.query.department) {
      const users = await User.find({ department: req.query.department }).select('_id');
      filter.employee = { $in: users.map((user) => user._id) };
    }
    const [totalEmployees, attendance, pendingLeaves] = await Promise.all([
      User.countDocuments({ role: 'EMPLOYEE' }),
      Attendance.find(filter).populate({ path: 'employee', select: 'department', populate: { path: 'department', select: 'name' } }),
      Leave.countDocuments({ status: 'PENDING' }),
    ]);
    const metrics = attendance.reduce((result, item) => { result[item.status.toLowerCase()] = (result[item.status.toLowerCase()] || 0) + 1; result.total += 1; return result; }, { total: 0, present: 0, late: 0, absent: 0, half_day: 0, on_leave: 0 });
    const departmentComparison = {};
    const trend = {};
    attendance.forEach((item) => { const department = item.employee && item.employee.department ? item.employee.department.name : 'Unassigned'; departmentComparison[department] = (departmentComparison[department] || 0) + 1; const date = item.date.toISOString().slice(0, 10); if (!trend[date]) trend[date] = { date, present: 0, late: 0, absent: 0, on_leave: 0, total: 0 }; trend[date][item.status.toLowerCase()] = (trend[date][item.status.toLowerCase()] || 0) + 1; trend[date].total += 1; });
    const workingDays = metrics.total;
    sendSuccess(res, 200, 'HR dashboard retrieved successfully', { metrics: { totalEmployees, ...metrics, pendingLeaves, attendancePercentage: workingDays ? Math.round(((metrics.present + metrics.late) / workingDays) * 100) : 0 }, departmentComparison, trend: Object.values(trend).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (error) { next(error); }
};

module.exports = { getHrDashboard };