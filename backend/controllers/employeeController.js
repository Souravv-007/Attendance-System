const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { sendSuccess } = require('../utils/response');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const safeEmployee = (employee) => {
  const data = employee.toObject ? employee.toObject() : { ...employee };
  delete data.password;
  return data;
};

const getEmployees = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
    const filter = {};

    if (req.query.search) {
      const search = req.query.search.trim();
      if (search.length > 100) return next(new AppError(400, 'Search query must not exceed 100 characters'));
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { employeeId: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (req.query.role) filter.role = req.query.role;
    if (req.query.department) {
      if (!mongoose.isValidObjectId(req.query.department)) {
        return next(new AppError(400, 'Invalid department identifier'));
      }
      filter.department = req.query.department;
    }
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [employees, total] = await Promise.all([
      User.find(filter).select('-password').populate('department').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);

    sendSuccess(res, 200, 'Employees retrieved successfully', {
      employees,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getEmployeeById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const employee = await User.findById(req.params.id).select('-password').populate('department');
    if (!employee) return next(new AppError(404, 'Employee not found'));
    sendSuccess(res, 200, 'Employee retrieved successfully', { employee });
  } catch (error) {
    next(error);
  }
};

const createEmployee = async (req, res, next) => {
  try {
    const { name, employeeId, email, password, department, role = 'EMPLOYEE' } = req.body;
    if (![name, employeeId, email, password].every((value) => typeof value === 'string' && value.trim())) return next(new AppError(400, 'Name, employee ID, email, and password are required'));
    if (password.length < 8) return next(new AppError(400, 'Password must be at least 8 characters long'));
    if (req.user.role !== 'ADMIN' && role === 'ADMIN') return next(new AppError(403, 'HR users cannot create admin accounts'));
    if (!['EMPLOYEE', 'HR', 'ADMIN'].includes(role)) return next(new AppError(400, 'Invalid role'));
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { employeeId: employeeId.trim() }] });
    if (existing) return next(new AppError(409, 'Email or employee ID already exists'));
    const employee = await User.create({ name: name.trim(), employeeId: employeeId.trim(), email: normalizedEmail, password: await bcrypt.hash(password, 10), department: department || null, role });
    await createAuditLog(req.user, 'EMPLOYEE_CREATED', `Employee ${employee._id} created`);
    sendSuccess(res, 201, 'Employee created successfully', { employee: safeEmployee(employee) });
  } catch (error) {
    next(error);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    const allowedFields = ['name', 'email', 'department', 'password', ...(req.user.role === 'ADMIN' ? ['role'] : [])];
    const invalidField = Object.keys(req.body).find((key) => !allowedFields.includes(key));
    if (invalidField) return next(new AppError(403, `Updates to ${invalidField} are not permitted`));
    if (req.body.role && req.user.role !== 'ADMIN') return next(new AppError(403, 'Only administrators can change roles'));
    if (req.body.role && !['EMPLOYEE', 'HR', 'ADMIN'].includes(req.body.role)) return next(new AppError(400, 'Invalid role'));
    if (req.body.password && req.body.password.length < 8) return next(new AppError(400, 'Password must be at least 8 characters long'));
    const employee = await User.findById(req.params.id);
    if (!employee) return next(new AppError(404, 'Employee not found'));
    const previousRole = employee.role;
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim()) return next(new AppError(400, 'Name must be a non-empty string'));
      employee.name = req.body.name.trim();
    }
    if (req.body.email !== undefined) {
      if (typeof req.body.email !== 'string') return next(new AppError(400, 'Email must be a string'));
      employee.email = req.body.email.toLowerCase().trim();
    }
    if (req.body.department !== undefined) employee.department = req.body.department || null;
    if (req.body.password) employee.password = await bcrypt.hash(req.body.password, 10);
    if (req.body.role) employee.role = req.body.role;
    await employee.save();
    await createAuditLog(req.user, 'EMPLOYEE_UPDATED', `Employee ${employee._id} updated`);
    if (previousRole !== employee.role) await createAuditLog(req.user, 'USER_ROLE_CHANGED', `User ${employee._id} role changed from ${previousRole} to ${employee.role}`);
    sendSuccess(res, 200, 'Employee updated successfully', { employee: safeEmployee(employee) });
  } catch (error) {
    next(error);
  }
};

const updateEmployeeStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return next(new AppError(400, 'Invalid identifier'));
    if (typeof req.body.isActive !== 'boolean') return next(new AppError(400, 'isActive must be a boolean'));
    const employee = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true }).select('-password');
    if (!employee) return next(new AppError(404, 'Employee not found'));
    await createAuditLog(req.user, req.body.isActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED', `User ${employee._id} account status changed to ${req.body.isActive ? 'active' : 'inactive'}`);
    sendSuccess(res, 200, 'Employee status updated successfully', { employee });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
};
