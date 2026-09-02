const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const Notification = require('../models/Notification');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { getWorkingDate } = require('../utils/date');
const { sendSuccess } = require('../utils/response');
const { calculateWorkingMinutes, calculateOvertimeMinutes } = require('../services/attendanceService');
const { calculateAttendanceStatus, calculateLateMinutes, isWeekendDate } = require('../services/attendanceStatusService');
const { createNotification } = require('../services/notificationService');
const { getSystemSettings } = require('../services/systemSettingsService');

const parseOptionalDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateCorrectionTimes = (requestedCheckIn, requestedCheckOut) => {
  if (!requestedCheckIn && !requestedCheckOut) throw new AppError(400, 'A corrected check-in or check-out time is required');
  if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) throw new AppError(400, 'Corrected checkout must be after corrected check-in');
};

const createCorrection = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.attendance)) return next(new AppError(400, 'Invalid attendance identifier'));
    if (!req.body.reason || req.body.reason.trim().length < 3) return next(new AppError(400, 'A meaningful correction reason is required'));
    const attendance = await Attendance.findOne({ _id: req.body.attendance, employee: req.user._id });
    if (!attendance) return next(new AppError(404, 'Attendance record not found'));
    const requestedCheckIn = parseOptionalDate(req.body.requestedCheckIn);
    const requestedCheckOut = parseOptionalDate(req.body.requestedCheckOut);
    if ((req.body.requestedCheckIn && !requestedCheckIn) || (req.body.requestedCheckOut && !requestedCheckOut)) return next(new AppError(400, 'Correction times must be valid dates'));
    validateCorrectionTimes(requestedCheckIn, requestedCheckOut);
    const pending = await AttendanceCorrection.findOne({ attendance: attendance._id, status: 'PENDING' });
    if (pending) return next(new AppError(409, 'A correction request is already pending for this attendance'));
    const correction = await AttendanceCorrection.create({ employee: req.user._id, attendance: attendance._id, requestedCheckIn, requestedCheckOut, reason: req.body.reason.trim() });
    await createAuditLog(req.user, 'ATTENDANCE_CORRECTION_REQUESTED', `Correction ${correction._id} requested`);
    sendSuccess(res, 201, 'Attendance correction requested successfully', { correction });
  } catch (error) {
    next(error);
  }
};

const getCorrections = async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : { status: 'PENDING' };
    const corrections = await AttendanceCorrection.find(filter).populate('employee', '-password').populate('attendance').sort({ createdAt: 1 });
    sendSuccess(res, 200, 'Attendance corrections retrieved successfully', { corrections });
  } catch (error) {
    next(error);
  }
};

const approveCorrection = async (req, res, next) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const approve = async (activeSession) => {
      const correctionQuery = AttendanceCorrection.findById(req.params.id);
      const correction = activeSession ? await correctionQuery.session(activeSession) : await correctionQuery;
      if (!correction) throw new AppError(404, 'Correction request not found');
      if (correction.status !== 'PENDING') throw new AppError(409, `Correction request is already ${correction.status.toLowerCase()}`);
      const attendanceQuery = Attendance.findById(correction.attendance);
      const attendance = activeSession ? await attendanceQuery.session(activeSession) : await attendanceQuery;
      if (!attendance) throw new AppError(404, 'Attendance record not found');
      const checkIn = correction.requestedCheckIn || attendance.checkIn;
      const checkOut = correction.requestedCheckOut || attendance.checkOut;
      if (!checkIn || (checkOut && checkOut <= checkIn)) throw new AppError(400, 'Corrected attendance times are invalid');
      attendance.checkIn = checkIn;
      if (correction.requestedCheckOut) attendance.checkOut = checkOut;
      const settings = await getSystemSettings();
      if (attendance.checkOut) {
        attendance.workingMinutes = calculateWorkingMinutes(attendance.checkIn, attendance.checkOut);
        attendance.overtimeMinutes = calculateOvertimeMinutes(attendance.workingMinutes, settings.expectedWorkingMinutes);
        attendance.workingHours = attendance.workingMinutes / 60;
      }
      const workingDate = getWorkingDate(attendance.date);
      const [approvedLeave, holiday] = await Promise.all([
        Leave.findOne({ employee: attendance.employee, status: 'APPROVED', startDate: { $lte: workingDate }, endDate: { $gte: workingDate } }),
        Holiday.findOne({ date: workingDate }),
      ]);
      attendance.lateMinutes = calculateLateMinutes(attendance.checkIn, workingDate, settings.officeStart);
      attendance.status = calculateAttendanceStatus({ checkIn: attendance.checkIn, workingMinutes: attendance.workingMinutes, isWeekend: isWeekendDate(workingDate), isHoliday: Boolean(holiday), hasApprovedLeave: Boolean(approvedLeave), officeStart: settings.officeStart, halfDayThresholdMinutes: settings.halfDayThresholdMinutes });
      correction.status = 'APPROVED';
      correction.reviewer = req.user._id;
      correction.reviewedAt = new Date();
      if (activeSession) {
        await attendance.save({ session: activeSession });
        await correction.save({ session: activeSession });
      } else {
        await attendance.save();
        await correction.save();
      }
      return { correction, attendance };
    };

    let result;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => { result = await approve(session); });
    } catch (error) {
      if (!/transaction|replica set|mongos/i.test(error.message)) throw error;
      result = await approve(null);
    } finally {
      if (session) await session.endSession();
    }
    await Promise.all([
      createNotification(result.correction.employee, `Your attendance correction ${result.correction._id} was approved.`),
      createAuditLog(req.user, 'ATTENDANCE_CORRECTION_APPROVED', `Correction ${result.correction._id} approved and attendance updated`),
    ]);
    sendSuccess(res, 200, 'Attendance correction approved successfully', result);
  } catch (error) {
    next(error);
  }
};

const rejectCorrection = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    if (!req.body.reviewComment || req.body.reviewComment.trim().length < 3) return next(new AppError(400, 'A rejection comment is required'));
    const correction = await AttendanceCorrection.findById(req.params.id);
    if (!correction) return next(new AppError(404, 'Correction request not found'));
    if (correction.status !== 'PENDING') return next(new AppError(409, `Correction request is already ${correction.status.toLowerCase()}`));
    correction.status = 'REJECTED';
    correction.reviewer = req.user._id;
    correction.reviewedAt = new Date();
    correction.reviewComment = req.body.reviewComment.trim();
    await correction.save();
    await Promise.all([
      createNotification(correction.employee, `Your attendance correction ${correction._id} was rejected.`),
      createAuditLog(req.user, 'ATTENDANCE_CORRECTION_REJECTED', `Correction ${correction._id} rejected`),
    ]);
    sendSuccess(res, 200, 'Attendance correction rejected successfully', { correction });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCorrection,
  getCorrections,
  approveCorrection,
  rejectCorrection,
};
