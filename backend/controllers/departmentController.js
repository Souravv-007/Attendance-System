const mongoose = require('mongoose');
const Department = require('../models/Department');
const { createAuditLog } = require('../utils/audit');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    sendSuccess(res, 200, 'Departments retrieved successfully', { departments });
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return next(new AppError(400, 'Department name is required'));
    }

    const department = await Department.create({
      name: req.body.name.trim(),
      description: req.body.description || '',
    });
    await createAuditLog(req.user, 'DEPARTMENT_CREATED', `Department ${department._id} created`);
    sendSuccess(res, 201, 'Department created successfully', { department });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError(400, 'Invalid identifier'));
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name.trim() } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!department) {
      return next(new AppError(404, 'Department not found'));
    }

    await createAuditLog(req.user, 'DEPARTMENT_UPDATED', `Department ${department._id} updated`);
    sendSuccess(res, 200, 'Department updated successfully', { department });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDepartments, createDepartment, updateDepartment };
