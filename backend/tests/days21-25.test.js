const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const app = require('../app');
const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');

let server;
let baseUrl;
let employee;
let hr;
let admin;
let employeeToken;
let hrToken;
let adminToken;
const secret = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
const request = async (url, token, options = {}) => {
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  return { response, body: await response.json() };
};

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_days21_25' });
  server = http.createServer(app); await new Promise((resolve) => server.listen(0, resolve)); baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); });
const reset = async () => { await Promise.all([User.deleteMany({}), Department.deleteMany({}), Attendance.deleteMany({}), Leave.deleteMany({})]); };

test('Day 22 dashboard applies date and department filters with date-based trend aggregation', async () => {
  await reset(); const password = await bcrypt.hash('Password123', 10);
  const [engineering, people] = await Department.create([{ name: 'Dashboard Engineering' }, { name: 'Dashboard People' }]);
  [employee, hr, admin] = await User.create([
    { name: 'Dashboard A', employeeId: 'D22-001', email: 'd22.a@test.local', password, role: 'EMPLOYEE', department: engineering._id },
    { name: 'Dashboard HR', employeeId: 'D22-002', email: 'd22.hr-employee@test.local', password, role: 'EMPLOYEE', department: engineering._id },
    { name: 'Dashboard Admin Employee', employeeId: 'D22-003', email: 'd22.admin-employee@test.local', password, role: 'EMPLOYEE', department: people._id },
  ]);
  const manager = await User.create({ name: 'Dashboard Manager', email: 'd22.manager@test.local', password, role: 'HR' });
  const administrator = await User.create({ name: 'Dashboard Administrator', email: 'd22.admin@test.local', password, role: 'ADMIN' });
  hr = manager; admin = administrator; employeeToken = tokenFor(employee); hrToken = tokenFor(hr); adminToken = tokenFor(admin);
  await Attendance.create([
    { employee: employee._id, date: new Date('2026-09-01'), status: 'PRESENT' },
    { employee: employee._id, date: new Date('2026-09-02'), status: 'LATE' },
    { employee: (await User.findOne({ employeeId: 'D22-002' }))._id, date: new Date('2026-09-01'), status: 'ABSENT' },
    { employee: (await User.findOne({ employeeId: 'D22-003' }))._id, date: new Date('2026-09-01'), status: 'ON_LEAVE' },
  ]);
  assert.equal((await request('/api/dashboards/hr', employeeToken)).response.status, 403);
  assert.equal((await request('/api/dashboards/hr', adminToken)).response.status, 200);
  const all = await request('/api/dashboards/hr', hrToken); assert.equal(all.response.status, 200); assert.equal(all.body.data.metrics.totalEmployees, 3); assert.equal(all.body.data.trend.length, 2);
  const department = await request(`/api/dashboards/hr?department=${engineering._id}`, hrToken); assert.equal(department.body.data.metrics.totalEmployees, 2); assert.equal(department.body.data.metrics.total, 3); assert.equal(department.body.data.departmentComparison['Dashboard Engineering'], 3);
  const dateOnly = await request('/api/dashboards/hr?from=2026-09-01&to=2026-09-01', hrToken); assert.equal(dateOnly.body.data.metrics.total, 3); assert.equal(dateOnly.body.data.trend.length, 1); assert.equal(dateOnly.body.data.trend[0].date, '2026-09-01');
  const combined = await request(`/api/dashboards/hr?department=${engineering._id}&from=2026-09-01&to=2026-09-01`, hrToken); assert.equal(combined.body.data.metrics.totalEmployees, 2); assert.equal(combined.body.data.metrics.total, 2); assert.equal(combined.body.data.trend.length, 1);
  const empty = await request('/api/dashboards/hr?from=2030-01-01&to=2030-01-02', hrToken); assert.equal(empty.body.data.metrics.total, 0); assert.deepEqual(empty.body.data.trend, []);
});

test('Day 23 employee management combines filters and pagination while preserving secure API behavior', async () => {
  await reset(); const password = await bcrypt.hash('Password123', 10); const department = await Department.create({ name: 'Employee Test Department' });
  [employee, hr, admin] = await User.create([
    { name: 'Employee Viewer', employeeId: 'D23-001', email: 'd23.viewer@test.local', password, role: 'EMPLOYEE' },
    { name: 'Employee HR', email: 'd23.hr@test.local', password, role: 'HR' }, { name: 'Employee Admin', email: 'd23.admin@test.local', password, role: 'ADMIN' },
  ]); employeeToken = tokenFor(employee); hrToken = tokenFor(hr); adminToken = tokenFor(admin);
  const created = await request('/api/employees', hrToken, { method: 'POST', body: JSON.stringify({ name: 'Filter Person One', employeeId: 'D23-002', email: 'd23.one@test.local', password: 'Password123', role: 'EMPLOYEE', department: department._id }) });
  assert.equal(created.response.status, 201); assert.equal(created.body.data.employee.password, undefined);
  await request('/api/employees', hrToken, { method: 'POST', body: JSON.stringify({ name: 'Filter Person Two', employeeId: 'D23-003', email: 'd23.two@test.local', password: 'Password123', role: 'EMPLOYEE', department: department._id }) });
  const duplicate = await request('/api/employees', hrToken, { method: 'POST', body: JSON.stringify({ name: 'Duplicate', employeeId: 'D23-003', email: 'd23.one@test.local', password: 'Password123', role: 'EMPLOYEE' }) }); assert.equal(duplicate.response.status, 409);
  const query = `?department=${department._id}&role=EMPLOYEE&isActive=true&search=Filter&page=1&limit=1`; const first = await request(`/api/employees${query}`, hrToken); assert.equal(first.response.status, 200); assert.equal(first.body.data.pagination.total, 2); assert.equal(first.body.data.employees.length, 1); const second = await request(`/api/employees${query.replace('page=1', 'page=2')}`, hrToken); assert.equal(second.body.data.employees.length, 1); assert.notEqual(first.body.data.employees[0]._id, second.body.data.employees[0]._id);
  const edited = await request(`/api/employees/${created.body.data.employee._id}`, adminToken, { method: 'PUT', body: JSON.stringify({ name: 'Edited Filter Person' }) }); assert.equal(edited.response.status, 200); assert.equal(edited.body.data.employee.password, undefined);
  assert.equal((await request(`/api/employees/${created.body.data.employee._id}/status`, adminToken, { method: 'PATCH', body: JSON.stringify({ isActive: false }) })).response.status, 200); assert.equal((await request(`/api/employees/${created.body.data.employee._id}/status`, adminToken, { method: 'PATCH', body: JSON.stringify({ isActive: true }) })).response.status, 200);
  assert.equal((await request('/api/employees', employeeToken)).response.status, 403); assert.equal((await request('/api/employees', hrToken)).response.status, 200); assert.equal((await request('/api/employees', adminToken)).response.status, 200); assert.notEqual((await User.findById(created.body.data.employee._id)).password, 'Password123');
});

test('Day 25 CSV generators use selected report fields, escape values, and keep empty exports header-only', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/reports.js'), 'utf8'); const context = { window: {}, document: { addEventListener: () => {} } }; vm.runInNewContext(source, context); const { attendanceCsv: attendanceExport, leaveCsv: leaveExport, createCsv } = context.window.AttendanceReports;
  const attendance = attendanceExport([{ date: '2026-09-01T00:00:00.000Z', employee: { name: 'Ada, "Lovelace"', employeeId: 'CSV-001', department: { name: 'Engineering' }, password: 'never-export' }, checkIn: '2026-09-01T09:00:00.000Z', checkOut: '2026-09-01T18:00:00.000Z', workingMinutes: 540, lateMinutes: 3, overtimeMinutes: 60, status: 'PRESENT', token: 'never-export' }]);
  assert.match(attendance, /^Date,Employee,Employee ID,Department,Check-in,Check-out,Working duration,Late minutes,Overtime,Status/); assert.match(attendance, /"Ada, ""Lovelace"""/); assert.match(attendance, /CSV-001,Engineering/); assert.equal(/never-export|password|token|secret/i.test(attendance), false);
  const leave = leaveExport([{ employee: { name: 'Ada\nLovelace', employeeId: 'CSV-001', department: { name: 'Engineering' } }, leaveType: 'ANNUAL', startDate: '2026-09-03', endDate: '2026-09-04', leaveDays: 2, status: 'APPROVED', secret: 'never-export' }]);
  assert.match(leave, /^Employee,Employee ID,Department,Leave type,Start date,End date,Days,Status/); assert.match(leave, /"Ada\nLovelace"/); assert.match(leave, /CSV-001,Engineering,ANNUAL,2026-09-03,2026-09-04,2,APPROVED/); assert.equal(/never-export|secret/i.test(leave), false);
  assert.equal(attendanceExport([]), 'Date,Employee,Employee ID,Department,Check-in,Check-out,Working duration,Late minutes,Overtime,Status'); assert.equal(leaveExport([]), 'Employee,Employee ID,Department,Leave type,Start date,End date,Days,Status'); assert.equal(createCsv([['a"b', 'line\nbreak']]), '"a""b","line\nbreak"');
});

test('Day 24 HR review UI renders leave review fields and correction review data', () => {
  const hrSource = fs.readFileSync(path.resolve(__dirname, '../../frontend/js/hr.js'), 'utf8');
  const leavePage = fs.readFileSync(path.resolve(__dirname, '../../frontend/pages/leave-management.html'), 'utf8');
  assert.match(leavePage, /<th>Reason<\/th>.*<th>Reviewer<\/th>.*<th>Reviewed<\/th>/);
  assert.match(hrSource, /leave\.reason/); assert.match(hrSource, /leave\.reviewer\?\.name/); assert.match(hrSource, /leave\.reviewedAt/);
  assert.match(hrSource, /employee\.name/); assert.match(hrSource, /item\.attendance\?\.date/); assert.match(hrSource, /item\.requestedCheckIn/); assert.match(hrSource, /item\.requestedCheckOut/); assert.match(hrSource, /item\.reason/); assert.match(hrSource, /item\.status/);
});
