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
const Leave = require('../models/Leave');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

let server;
let baseUrl;
let hr;
let employee;
let secondEmployee;
let employeeToken;
let hrToken;
const secret = process.env.JWT_SECRET;
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { response, body: await response.json() };
};
const auth = (token) => ({ authorization: `Bearer ${token}` });
const post = (path, body, token) => request(path, { method: 'POST', body: JSON.stringify(body), headers: token ? auth(token) : {} });
const put = (path, body, token) => request(path, { method: 'PUT', body: JSON.stringify(body), headers: auth(token) });

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_day27' });
  await Promise.all([User.deleteMany({}), Department.deleteMany({}), Attendance.deleteMany({}), Leave.deleteMany({}), AttendanceCorrection.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({})]);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('Day 27 registration, login, role authorization, and inactive-account rules are enforced', async () => {
  const registration = { name: 'Day 27 Employee', employeeId: 'D27-001', email: 'd27.employee@test.local', password: 'Password123' };
  const created = await post('/api/auth/register', registration);
  assert.equal(created.response.status, 201);
  assert.equal(created.body.user.password, undefined);
  assert.ok(created.body.token);
  employee = await User.findOne({ email: registration.email });
  assert.notEqual(employee.password, registration.password);
  assert.equal(await bcrypt.compare(registration.password, employee.password), true);
  assert.equal((await post('/api/auth/register', registration)).response.status, 409);
  assert.equal((await post('/api/auth/register', { ...registration, email: 'd27.duplicate-id@test.local' })).response.status, 409);
  const loggedIn = await post('/api/auth/login', { email: registration.email, password: registration.password });
  assert.equal(loggedIn.response.status, 200);
  assert.equal(loggedIn.body.user.role, 'EMPLOYEE');
  assert.equal((await post('/api/auth/login', { email: registration.email, password: 'NotThePassword123' })).response.status, 401);
  employeeToken = loggedIn.body.token;
  assert.equal((await request('/api/auth/me', { headers: auth(employeeToken) })).response.status, 200);
  employee.isActive = false;
  await employee.save();
  assert.equal((await post('/api/auth/login', { email: registration.email, password: registration.password })).response.status, 403);
  employee.isActive = true;
  await employee.save();
});

test('Day 27 attendance management intersects employee and department filters', async () => {
  const password = await bcrypt.hash('Password123', 10);
  const [engineering, people] = await Department.create([{ name: 'Day 27 Engineering' }, { name: 'Day 27 People' }]);
  [secondEmployee, hr] = await User.create([
    { name: 'Day 27 Second', employeeId: 'D27-002', email: 'd27.second@test.local', password, role: 'EMPLOYEE', department: engineering._id },
    { name: 'Day 27 HR', email: 'd27.hr@test.local', password, role: 'HR' },
  ]);
  await User.findByIdAndUpdate(employee._id, { department: engineering._id });
  const peopleEmployee = await User.create({ name: 'Day 27 People Employee', employeeId: 'D27-003', email: 'd27.people@test.local', password, role: 'EMPLOYEE', department: people._id });
  await Attendance.create([
    { employee: employee._id, date: new Date('2026-08-10T00:00:00.000Z'), checkIn: new Date('2026-08-10T09:00:00.000Z'), status: 'PRESENT' },
    { employee: secondEmployee._id, date: new Date('2026-08-10T00:00:00.000Z'), checkIn: new Date('2026-08-10T09:00:00.000Z'), status: 'PRESENT' },
    { employee: peopleEmployee._id, date: new Date('2026-08-10T00:00:00.000Z'), checkIn: new Date('2026-08-10T09:00:00.000Z'), status: 'PRESENT' },
  ]);
  hrToken = tokenFor(hr);
  const result = await request(`/api/attendance/management?employee=${employee._id}&department=${engineering._id}&status=PRESENT&page=1&limit=20`, { headers: auth(hrToken) });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.pagination.total, 1);
  assert.deepEqual(result.body.data.attendance.map((item) => item.employee._id), [employee._id.toString()]);
});

test('Day 27 leave and correction approval update records and create private notifications and audits', async () => {
  employeeToken = tokenFor(employee);
  const balanceBefore = (await User.findById(employee._id)).leaveBalances.ANNUAL;
  const leave = await post('/api/leaves', { leaveType: 'ANNUAL', startDate: '2026-10-05', endDate: '2026-10-06', reason: 'Day 27 planned leave' }, employeeToken);
  assert.equal(leave.response.status, 201);
  assert.equal((await put(`/api/leaves/${leave.body.data.leave._id}/approve`, {}, hrToken)).response.status, 200);
  assert.equal((await User.findById(employee._id)).leaveBalances.ANNUAL, balanceBefore - 2);
  assert.equal((await put(`/api/leaves/${leave.body.data.leave._id}/approve`, {}, hrToken)).response.status, 409);
  const attendance = await Attendance.create({ employee: employee._id, date: new Date('2026-08-11T00:00:00.000Z'), checkIn: new Date('2026-08-11T09:30:00.000Z'), checkOut: new Date('2026-08-11T17:30:00.000Z'), status: 'PRESENT' });
  const correction = await post('/api/corrections', { attendance: attendance._id, requestedCheckIn: '2026-08-11T09:00:00.000Z', requestedCheckOut: '2026-08-11T18:00:00.000Z', reason: 'Day 27 clock reader issue' }, employeeToken);
  assert.equal(correction.response.status, 201);
  assert.equal((await put(`/api/corrections/${correction.body.data.correction._id}/approve`, {}, hrToken)).response.status, 200);
  const updatedAttendance = await Attendance.findById(attendance._id);
  assert.equal(updatedAttendance.workingMinutes, 540);
  assert.equal(updatedAttendance.overtimeMinutes, 60);
  assert.equal(await Notification.countDocuments({ user: employee._id, read: false }), 2);
  assert.equal(await AuditLog.countDocuments({ user: hr._id, action: { $in: ['LEAVE_APPROVED', 'ATTENDANCE_CORRECTION_APPROVED'] } }), 2);
  assert.equal((await request('/api/notifications', { headers: auth(hrToken) })).body.data.notifications.some((item) => item.user === employee._id.toString()), false);
});
