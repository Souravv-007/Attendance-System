const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { getWorkingDate } = require('../utils/date');
const { sendSuccess } = require('../utils/response');
const { createNotification } = require('../services/notificationService');
const { calculateWorkingMinutes, calculateOvertimeMinutes, isCheckoutAfterCheckIn } = require('../services/attendanceService');
const {
  calculateAttendanceStatus,
  calculateLateMinutes,
  isWeekendDate,
  formatDuration,
} = require('../services/attendanceStatusService');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');

const checkInEmployee = async (req, res, next) => {
  try {
    const checkIn = new Date();
    const date = getWorkingDate(checkIn);
    const existingAttendance = await Attendance.findOne({ employee: req.user._id, date });

    if (existingAttendance) {
      return next(new AppError(409, 'Attendance has already been recorded for today'));
    }

    const [approvedLeave, holiday] = await Promise.all([
      Leave.findOne({ employee: req.user._id, status: 'APPROVED', startDate: { $lte: date }, endDate: { $gte: date } }),
      Holiday.findOne({ date }),
    ]);
    const lateMinutes = calculateLateMinutes(checkIn, date);
    const status = calculateAttendanceStatus({
      checkIn,
      workingMinutes: 0,
      isWeekend: isWeekendDate(date),
      isHoliday: Boolean(holiday),
      hasApprovedLeave: Boolean(approvedLeave),
    });
    const attendance = await Attendance.create({
      employee: req.user._id,
      date,
      checkIn,
      status,
      lateMinutes,
    });

    await createAuditLog(req.user, 'ATTENDANCE_CHECK_IN', `Check-in recorded for ${date.toISOString().slice(0, 10)}`);
    await createNotification(req.user, lateMinutes > 0
        ? `You checked in late by ${lateMinutes} minutes.`
        : 'Check-in recorded successfully.');

    sendSuccess(res, 201, 'Check-in recorded successfully', {
      attendance: {
        id: attendance._id,
        date: attendance.date,
        checkIn: attendance.checkIn,
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
      },
    });
  } catch (error) {
    if (error.code === 11000) return next(new AppError(409, 'Attendance has already been recorded for today'));
    next(error);
  }
};

const checkOutEmployee = async (req, res, next) => {
  try {
    const date = getWorkingDate();
    const attendance = await Attendance.findOne({ employee: req.user._id, date });
    if (!attendance || !attendance.checkIn) return next(new AppError(400, 'A check-in is required before checkout'));
    if (attendance.checkOut) return next(new AppError(409, 'Attendance has already been checked out'));

    const checkOut = new Date();
    if (!isCheckoutAfterCheckIn(attendance.checkIn, checkOut)) return next(new AppError(400, 'Checkout must be after check-in'));

    const workingMinutes = calculateWorkingMinutes(attendance.checkIn, checkOut);
    const overtimeMinutes = calculateOvertimeMinutes(workingMinutes);
    attendance.checkOut = checkOut;
    attendance.workingMinutes = workingMinutes;
    attendance.overtimeMinutes = overtimeMinutes;
    attendance.workingHours = workingMinutes / 60;
    attendance.status = calculateAttendanceStatus({ checkIn: attendance.checkIn, workingMinutes });
    await attendance.save();
    await createAuditLog(req.user, 'ATTENDANCE_CHECK_OUT', `Checkout recorded for ${attendance._id}`);

    sendSuccess(res, 200, 'Check-out recorded successfully', {
      attendance: {
        id: attendance._id,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        workingMinutes,
        overtimeMinutes,
        formattedWorkingDuration: formatDuration(workingMinutes),
        status: attendance.status,
        lateMinutes: attendance.lateMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyAttendance = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { employee: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) {
        const fromDate = new Date(req.query.from);
        if (Number.isNaN(fromDate.getTime())) return next(new AppError(400, 'Invalid start date'));
        filter.date.$gte = getWorkingDate(fromDate);
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        if (Number.isNaN(toDate.getTime())) return next(new AppError(400, 'Invalid end date'));
        filter.date.$lte = getWorkingDate(toDate);
      }
    }
    const [attendance, total] = await Promise.all([
      Attendance.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Attendance.countDocuments(filter),
    ]);
    sendSuccess(res, 200, 'Attendance history retrieved successfully', { attendance, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getAllAttendance = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.department) {
      const users = await User.find({ department: req.query.department }).select('_id');
      const departmentEmployeeIds = users.map((user) => user._id);
      filter.employee = req.query.employee
        ? { $in: departmentEmployeeIds.filter((id) => id.toString() === req.query.employee) }
        : { $in: departmentEmployeeIds };
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = getWorkingDate(new Date(req.query.from));
      if (req.query.to) filter.date.$lte = getWorkingDate(new Date(req.query.to));
    }
    const [attendance, total] = await Promise.all([
      Attendance.find(filter).populate({ path: 'employee', select: '-password', populate: { path: 'department' } }).sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Attendance.countDocuments(filter),
    ]);
    sendSuccess(res, 200, 'Attendance records retrieved successfully', { attendance, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

module.exports = {
  checkInEmployee,
  checkOutEmployee,
  getMyAttendance,
  getAllAttendance,
};
