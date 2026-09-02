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

let server;
let baseUrl;
let hrToken;
let employeeToken;
let employee;
let department;
const secret = process.env.JWT_SECRET;
const request = async (path, token) => { const response = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } }); return { response, body: await response.json() }; };

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_report_test' });
  await Promise.all([User.deleteMany({}), Department.deleteMany({}), Attendance.deleteMany({}), Leave.deleteMany({})]);
  department = await Department.create({ name: 'Report Engineering' });
  const password = await bcrypt.hash('Password123', 10);
  employee = await User.create({ name: 'Report Employee', employeeId: 'REPORT-001', email: 'report.employee@test.local', password, role: 'EMPLOYEE', department: department._id });
  const hr = await User.create({ name: 'Report HR', email: 'report.hr@test.local', password, role: 'HR' });
  await Attendance.create({ employee: employee._id, date: new Date('2026-09-01T00:00:00.000Z'), checkIn: new Date('2026-09-01T09:30:00.000Z'), checkOut: new Date('2026-09-01T18:30:00.000Z'), workingMinutes: 540, overtimeMinutes: 60, status: 'PRESENT' });
  await Leave.create({ employee: employee._id, leaveType: 'ANNUAL', startDate: new Date('2026-09-03'), endDate: new Date('2026-09-03'), leaveDays: 1, reason: 'Personal day' });
  employeeToken = jwt.sign({ id: employee._id, role: employee.role }, secret);
  hrToken = jwt.sign({ id: hr._id, role: hr.role }, secret);
  server = http.createServer(app); await new Promise((resolve) => server.listen(0, resolve)); baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); });

test('reports enforce HR authorization and return real attendance and leave data', async () => {
  assert.equal((await request('/api/reports/attendance', employeeToken)).response.status, 403);
  const result = await request('/api/reports/attendance', hrToken);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.attendance.length, 1);
  assert.equal(result.body.data.leaves.length, 1);
  assert.equal(result.body.data.attendance[0].workingMinutes, 540);
  assert.equal(JSON.stringify(result.body).includes('Password123'), false);
  assert.equal(JSON.stringify(result.body).includes('password'), false);
});

test('reports apply employee, department, date, status, and empty filters', async () => {
  const paths = [
    `/api/reports/attendance?employee=${employee._id}`,
    `/api/reports/attendance?department=${department._id}`,
    '/api/reports/attendance?from=2026-09-01&to=2026-09-01',
    '/api/reports/attendance?status=PRESENT',
    '/api/reports/attendance?from=2030-01-01&to=2030-01-02',
  ];
  const results = await Promise.all(paths.map((path) => request(path, hrToken)));
  assert.equal(results[0].body.data.attendance.length, 1);
  assert.equal(results[1].body.data.attendance.length, 1);
  assert.equal(results[2].body.data.attendance.length, 1);
  assert.equal(results[3].body.data.attendance.length, 1);
  assert.equal(results[4].body.data.attendance.length, 0);
  assert.equal(results[4].body.data.leaves.length, 0);
});
