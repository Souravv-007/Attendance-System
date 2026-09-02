const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { sendSuccess } = require('../utils/response');
const { validateLeaveInput, balanceFor } = require('../services/leaveService');
const { createNotification } = require('../services/notificationService');

const createLeave = async (req, res, next) => {
  try {
    const input = validateLeaveInput(req.body);
    const overlap = await Leave.findOne({ employee: req.user._id, status: { $in: ['PENDING', 'APPROVED'] }, startDate: { $lte: input.endDate }, endDate: { $gte: input.startDate } });
    if (overlap) return next(new AppError(409, 'Leave request overlaps an existing pending or approved leave'));
    if (balanceFor(req.user, req.body.leaveType) < input.leaveDays) return next(new AppError(400, 'Insufficient leave balance'));
    const leave = await Leave.create({ employee: req.user._id, leaveType: req.body.leaveType, reason: req.body.reason.trim(), ...input });
    await createAuditLog(req.user, 'LEAVE_REQUEST_CREATED', `Leave request ${leave._id} created`);
    sendSuccess(res, 201, 'Leave request submitted successfully', { leave });
  } catch (error) {
    next(error);
  }
};

const getMyLeaves = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = { employee: req.user._id };
    const [leaves, total] = await Promise.all([Leave.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Leave.countDocuments(filter)]);
    sendSuccess(res, 200, 'Leave history retrieved successfully', { leaves, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

const getAllLeaves = async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const leaves = await Leave.find(filter).populate('employee', '-password').populate('reviewer', '-password').sort({ createdAt: -1 });
    sendSuccess(res, 200, 'Leave requests retrieved successfully', { leaves });
  } catch (error) {
    next(error);
  }
};

const getPendingLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ status: 'PENDING' }).populate('employee', '-password').sort({ createdAt: 1 });
    sendSuccess(res, 200, 'Pending leave requests retrieved successfully', { leaves });
  } catch (error) {
    next(error);
  }
};

const approveLeave = async (req, res, next) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const approve = async (activeSession) => {
      const leaveQuery = Leave.findById(req.params.id);
      const leave = activeSession ? await leaveQuery.session(activeSession) : await leaveQuery;
      if (!leave) throw new AppError(404, 'Leave request not found');
      if (leave.status !== 'PENDING') throw new AppError(409, `Leave request is already ${leave.status.toLowerCase()}`);
      const employeeQuery = User.findById(leave.employee);
      const employee = activeSession ? await employeeQuery.session(activeSession) : await employeeQuery;
      if (!employee || balanceFor(employee, leave.leaveType) < leave.leaveDays) throw new AppError(400, 'Insufficient leave balance');
      employee.leaveBalances[leave.leaveType] -= leave.leaveDays;
      leave.status = 'APPROVED';
      leave.reviewer = req.user._id;
      leave.reviewedAt = new Date();
      leave.balanceDeducted = true;
      if (activeSession) {
        await employee.save({ session: activeSession });
        await leave.save({ session: activeSession });
      } else {
        await employee.save();
        await leave.save();
      }
      return leave;
    };

    let leave;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => { leave = await approve(session); });
    } catch (error) {
      if (!/transaction|replica set|mongos/i.test(error.message)) throw error;
      leave = await approve(null);
    } finally {
      if (session) await session.endSession();
    }

    await Promise.all([
      createNotification(leave.employee, `Your leave request ${leave._id} was approved.`),
      createAuditLog(req.user, 'LEAVE_APPROVED', `Leave request ${leave._id} approved`),
    ]);
    sendSuccess(res, 200, 'Leave approved successfully', { leave });
  } catch (error) {
    next(error);
  }
};

const rejectLeave = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    if (!req.body.reviewComment || req.body.reviewComment.trim().length < 3) return next(new AppError(400, 'A rejection comment is required'));
    const leave = await Leave.findById(req.params.id);
    if (!leave) return next(new AppError(404, 'Leave request not found'));
    if (leave.status !== 'PENDING') return next(new AppError(409, `Leave request is already ${leave.status.toLowerCase()}`));
    leave.status = 'REJECTED';
    leave.reviewer = req.user._id;
    leave.reviewedAt = new Date();
    leave.reviewComment = req.body.reviewComment.trim();
    await leave.save();
    await Promise.all([createNotification(leave.employee, `Your leave request ${leave._id} was rejected.`), createAuditLog(req.user, 'LEAVE_REJECTED', `Leave request ${leave._id} rejected`)]);
    sendSuccess(res, 200, 'Leave rejected successfully', { leave });
  } catch (error) {
    next(error);
  }
};

const cancelLeave = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const leave = await Leave.findOne({ _id: req.params.id, employee: req.user._id });
    if (!leave) return next(new AppError(404, 'Leave request not found'));
    if (leave.status !== 'PENDING') return next(new AppError(409, 'Only pending leave requests can be cancelled'));
    leave.status = 'CANCELLED';
    await leave.save();
    await createAuditLog(req.user, 'LEAVE_CANCELLED', `Leave request ${leave._id} cancelled`);
    sendSuccess(res, 200, 'Leave request cancelled successfully', { leave });
  } catch (error) {
    next(error);
  }
};

module.exports = { createLeave, getMyLeaves, getAllLeaves, getPendingLeaves, approveLeave, rejectLeave, cancelLeave };
