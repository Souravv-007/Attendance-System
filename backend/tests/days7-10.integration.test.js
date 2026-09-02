const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

let server;
let baseUrl;
let employee;
let hr;
let admin;
let employeeToken;
let hrToken;
let adminToken;

const secret = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const tokenFor = (user) => jwt.sign({ id: user._id, email: user.email, role: 'FORGED_ROLE' }, secret, { expiresIn: '7d' });
const tokenForRole = (user) => jwt.sign({ id: user._id, email: user.email, role: user.role }, secret, { expiresIn: '7d' });

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { response, body: await response.json() };
};

const post = (path, body, token) => request(path, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

const put = (path, body, token) => request(path, {
  method: 'PUT',
  body: JSON.stringify(body),
  headers: { authorization: `Bearer ${token}` },
});

const patch = (path, body, token) => request(path, {
  method: 'PATCH',
  body: JSON.stringify(body),
  headers: { authorization: `Bearer ${token}` },
});

test.before(async () => {
  const applicationMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  await mongoose.connect(applicationMongoUri, {
    dbName: process.env.TEST_DB_NAME || 'attendance_system_test',
  });
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Attendance.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const password = await bcrypt.hash('Password123', 10);
  [employee, hr, admin] = await User.create([
    { name: 'Test Employee', employeeId: 'EMP-001', email: 'employee@test.local', password, role: 'EMPLOYEE' },
    { name: 'Test HR', email: 'hr@test.local', password, role: 'HR' },
    { name: 'Test Admin', email: 'admin@test.local', password, role: 'ADMIN' },
  ]);
  employeeToken = tokenForRole(employee);
  hrToken = tokenForRole(hr);
  adminToken = tokenForRole(admin);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('Day 7 protects routes and uses database role', async () => {
  assert.equal((await request('/api/employees')).response.status, 401);
  assert.equal((await request('/api/employees', { headers: { authorization: 'Bearer invalid' } })).response.status, 401);
  const expiredToken = jwt.sign({ id: employee._id, email: employee.email, role: employee.role }, secret, { expiresIn: -1 });
  assert.equal((await request('/api/employees', { headers: { authorization: `Bearer ${expiredToken}` } })).response.status, 401);
  assert.equal((await request('/api/employees', { headers: { authorization: `Bearer ${employeeToken}` } })).response.status, 403);
  assert.equal((await request('/api/employees', { headers: { authorization: `Bearer ${hrToken}` } })).response.status, 200);
  assert.equal((await request('/api/employees', { headers: { authorization: `Bearer ${adminToken}` } })).response.status, 200);
  assert.equal((await request('/api/employees', { headers: { authorization: `Bearer ${tokenFor(employee)}` } })).response.status, 403);
});

test('Day 8 returns safe errors and security headers', async () => {
  const invalid = await post('/api/auth/register', { email: 'bad' });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(Object.keys(invalid.body).sort(), ['message', 'success']);

  const invalidObjectId = await request('/api/employees/not-an-id', { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(invalidObjectId.response.status, 400);
  assert.equal(invalidObjectId.body.message, 'Invalid identifier');

  const corsAndHelmet = await request('/health', { headers: { origin: 'http://localhost:5500' } });
  assert.equal(corsAndHelmet.response.headers.get('access-control-allow-origin'), 'http://localhost:5500');
  assert.ok(corsAndHelmet.response.headers.get('x-content-type-options'));
});

test('Day 9 supports employee management, filters, pagination, and audit logs', async () => {
  const department = await post('/api/departments', { name: 'Engineering' }, adminToken);
  assert.equal(department.response.status, 201);

  const created = await post('/api/employees', {
    name: 'John Searchable', employeeId: 'EMP-002', email: 'john@test.local', password: 'Password123', department: department.body.data.department._id, role: 'EMPLOYEE',
  }, hrToken);
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.employee.password, undefined);

  const duplicateId = await post('/api/employees', {
    name: 'Duplicate ID', employeeId: 'EMP-002', email: 'other@test.local', password: 'Password123', role: 'EMPLOYEE',
  }, hrToken);
  assert.equal(duplicateId.response.status, 409);

  const duplicateEmail = await post('/api/employees', {
    name: 'Duplicate Email', employeeId: 'EMP-003', email: 'john@test.local', password: 'Password123', role: 'EMPLOYEE',
  }, hrToken);
  assert.equal(duplicateEmail.response.status, 409);

  const list = await request('/api/employees?page=1&limit=1&search=John&role=EMPLOYEE&isActive=true', { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(list.response.status, 200);
  assert.equal(list.body.data.pagination.limit, 1);
  assert.equal(list.body.data.employees.length, 1);

  const found = await request(`/api/employees/${created.body.data.employee._id}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(found.response.status, 200);
  assert.equal(found.body.data.employee.email, 'john@test.local');

  const updated = await put(`/api/employees/${created.body.data.employee._id}`, { name: 'John Updated', password: 'NewPassword123' }, adminToken);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.employee.password, undefined);

  const deactivated = await patch(`/api/employees/${created.body.data.employee._id}/status`, { isActive: false }, adminToken);
  assert.equal(deactivated.response.status, 200);
  const stored = await User.findById(created.body.data.employee._id);
  assert.equal(stored.isActive, false);
  assert.notEqual(stored.password, 'NewPassword123');

  const auditActions = await AuditLog.find({ action: { $in: ['EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'EMPLOYEE_DEACTIVATED', 'DEPARTMENT_CREATED'] } });
  assert.ok(auditActions.length >= 4);

  const inactiveLogin = await post('/api/auth/login', { email: 'john@test.local', password: 'NewPassword123' });
  assert.equal(inactiveLogin.response.status, 403);
});

test('Day 10 records one server-timed check-in with audit and notification', async () => {
  const body = await post('/api/attendance/check-in', { employee: admin._id, checkIn: '2000-01-01T09:30:00.000Z' }, employeeToken);
  assert.equal(body.response.status, 201);
  assert.equal(body.body.data.attendance.id !== undefined, true);
  assert.ok(['PRESENT', 'LATE'].includes(body.body.data.attendance.status));
  assert.equal(typeof body.body.data.attendance.lateMinutes, 'number');
  assert.notEqual(body.body.data.attendance.checkIn, '2000-01-01T09:30:00.000Z');

  const duplicate = await post('/api/attendance/check-in', { employee: admin._id }, employeeToken);
  assert.equal(duplicate.response.status, 409);

  const stored = await Attendance.findOne({ employee: employee._id });
  assert.equal(stored.employee.toString(), employee._id.toString());
  assert.equal(stored.checkOut, null);
  assert.ok(await AuditLog.findOne({ action: 'ATTENDANCE_CHECK_IN', user: employee._id }));
  assert.ok(await Notification.findOne({ user: employee._id }));
});

test('authentication rate limiting is applied to login', async () => {
  let limited = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const result = await post('/api/auth/login', { email: 'missing@test.local', password: 'wrong' });
    if (result.response.status === 429) limited = true;
  }
  assert.equal(limited, true);
});
