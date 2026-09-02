const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { getWorkingDate } = require('../utils/date');

let server;
let baseUrl;
let employee;
let secondEmployee;
let hr;
let employeeToken;
let secondEmployeeToken;
let hrToken;
const secret = process.env.JWT_SECRET;

const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json() };
};
const post = (path, body, token) => request(path, { method: 'POST', body: JSON.stringify(body), headers: token ? { authorization: `Bearer ${token}` } : {} });
const put = (path, body, token) => request(path, { method: 'PUT', body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } });
const del = (path, token) => request(path, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });

const dateAt = (daysFromNow, hour, minute) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_days11_15' });
  await Promise.all([User.deleteMany({}), Leave.deleteMany({}), Attendance.deleteMany({}), AttendanceCorrection.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({})]);
  const password = await bcrypt.hash('Password123', 10);
  [employee, secondEmployee, hr] = await User.create([
    { name: 'Checkout Employee', employeeId: 'D11-001', email: 'd11.employee@test.local', password, role: 'EMPLOYEE' },
    { name: 'Leave Employee', employeeId: 'D11-002', email: 'd11.second@test.local', password, role: 'EMPLOYEE' },
    { name: 'Leave HR', email: 'd11.hr@test.local', password, role: 'HR' },
  ]);
  employeeToken = tokenFor(employee);
  secondEmployeeToken = tokenFor(secondEmployee);
  hrToken = tokenFor(hr);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('Day 11 checkout calculates duration and overtime from server time', async () => {
  const date = getWorkingDate();
  const checkIn = new Date(Date.now() - 510 * 60000);
  const attendance = await Attendance.create({ employee: employee._id, date, checkIn, status: 'PRESENT' });
  const result = await post('/api/attendance/check-out', { employee: secondEmployee._id, checkOut: '2000-01-01T00:00:00.000Z', workingMinutes: 1 }, employeeToken);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.attendance.id.toString(), attendance._id.toString());
  assert.ok(result.body.data.attendance.workingMinutes >= 509);
  assert.equal(result.body.data.attendance.overtimeMinutes, result.body.data.attendance.workingMinutes - 480);
  assert.match(result.body.data.attendance.formattedWorkingDuration, /^\d+h \d+m$/);
  assert.notEqual(result.body.data.attendance.checkOut, '2000-01-01T00:00:00.000Z');
  const history = await request('/api/attendance/me?limit=10', { headers: { authorization: `Bearer ${employeeToken}` } });
  const historyRecord = history.body.data.attendance.find((item) => item._id === attendance._id.toString());
  assert.equal(history.response.status, 200);
  assert.equal(historyRecord.workingMinutes, result.body.data.attendance.workingMinutes);
  assert.ok(historyRecord.checkOut);
  const duplicate = await post('/api/attendance/check-out', {}, employeeToken);
  assert.equal(duplicate.response.status, 409);
  assert.equal(await AuditLog.countDocuments({ action: 'ATTENDANCE_CHECK_OUT', user: employee._id }), 1);
});

test('Day 11 rejects checkout without check-in and before or at check-in', async () => {
  const date = getWorkingDate();
  const noCheckIn = await Attendance.create({ employee: secondEmployee._id, date, checkIn: null });
  const noCheckInResult = await post('/api/attendance/check-out', {}, secondEmployeeToken);
  assert.equal(noCheckInResult.response.status, 400);
  await Attendance.deleteOne({ _id: noCheckIn._id });

  const futureEmployee = await User.create({ name: 'Future Checkout', employeeId: 'D11-003', email: 'd11.future@test.local', password: await bcrypt.hash('Password123', 10), role: 'EMPLOYEE' });
  const futureToken = tokenFor(futureEmployee);
  await Attendance.create({ employee: futureEmployee._id, date, checkIn: new Date(Date.now() + 60000), status: 'PRESENT' });
  const beforeResult = await post('/api/attendance/check-out', {}, futureToken);
  assert.equal(beforeResult.response.status, 400);
  await Attendance.deleteMany({ employee: futureEmployee._id });
  await User.deleteOne({ _id: futureEmployee._id });
});

test('Day 15 requires correction reasons and blocks direct attendance edits', async () => {
  const correctionDate = getWorkingDate(dateAt(2, 0, 0));
  const attendance = await Attendance.create({ employee: employee._id, date: correctionDate, checkIn: dateAt(2, 9, 30), status: 'PRESENT' });
  const missingReason = await post('/api/corrections', { attendance: attendance._id, requestedCheckOut: new Date().toISOString() }, employeeToken);
  assert.equal(missingReason.response.status, 400);
  const nonexistent = await post('/api/corrections', { attendance: new mongoose.Types.ObjectId(), requestedCheckIn: new Date().toISOString(), reason: 'Missing attendance' }, employeeToken);
  assert.equal(nonexistent.response.status, 404);
  const directEdit = await request(`/api/attendance/${attendance._id}`, { method: 'PUT', body: JSON.stringify({ status: 'PRESENT' }), headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(directEdit.response.status, 404);
  await Attendance.deleteOne({ _id: attendance._id });
});

test('Day 13 applies, validates, tracks, and cancels employee leave', async () => {
  const valid = await post('/api/leaves', { leaveType: 'ANNUAL', startDate: dateAt(5, 0, 0), endDate: dateAt(7, 0, 0), reason: 'Family travel' }, secondEmployeeToken);
  assert.equal(valid.response.status, 201);
  assert.equal(valid.body.data.leave.leaveDays, 3);
  const leaveId = valid.body.data.leave._id;
  const invalid = await post('/api/leaves', { leaveType: 'INVALID', startDate: dateAt(10, 0, 0), endDate: dateAt(9, 0, 0), reason: 'Bad' }, secondEmployeeToken);
  assert.equal(invalid.response.status, 400);
  const overlap = await post('/api/leaves', { leaveType: 'SICK', startDate: dateAt(6, 0, 0), endDate: dateAt(6, 0, 0), reason: 'Overlap' }, secondEmployeeToken);
  assert.equal(overlap.response.status, 409);
  const history = await request('/api/leaves/my-leaves', { headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(history.response.status, 200);
  assert.equal(history.body.data.leaves.length, 0);
  assert.equal((await del(`/api/leaves/${leaveId}/cancel`, secondEmployeeToken)).response.status, 200);
  assert.equal((await del(`/api/leaves/${leaveId}/cancel`, secondEmployeeToken)).response.status, 409);
});

test('Day 14 protects approval, deducts balance once, and records review data', async () => {
  const balanceBefore = (await User.findById(secondEmployee._id)).leaveBalances.ANNUAL;
  const leaveResult = await post('/api/leaves', { leaveType: 'ANNUAL', startDate: dateAt(15, 0, 0), endDate: dateAt(16, 0, 0), reason: 'Planned leave' }, secondEmployeeToken);
  const leaveId = leaveResult.body.data.leave._id;
  assert.equal((await request('/api/leaves/pending', { headers: { authorization: `Bearer ${employeeToken}` } })).response.status, 403);
  assert.equal((await request('/api/leaves/pending', { headers: { authorization: `Bearer ${hrToken}` } })).response.status, 200);
  const approved = await put(`/api/leaves/${leaveId}/approve`, {}, hrToken);
  assert.equal(approved.response.status, 200);
  const stored = await Leave.findById(leaveId);
  assert.equal(stored.reviewer.toString(), hr._id.toString());
  assert.ok(stored.reviewedAt);
  assert.equal(stored.balanceDeducted, true);
  assert.equal((await User.findById(secondEmployee._id)).leaveBalances.ANNUAL, balanceBefore - 2);
  assert.equal((await put(`/api/leaves/${leaveId}/approve`, {}, hrToken)).response.status, 409);
  assert.ok(await Notification.findOne({ user: secondEmployee._id, message: /approved/ }));
  assert.ok(await AuditLog.findOne({ action: 'LEAVE_APPROVED' }));

  const rejectedResult = await post('/api/leaves', { leaveType: 'SICK', startDate: dateAt(20, 0, 0), endDate: dateAt(20, 0, 0), reason: 'Medical appointment' }, secondEmployeeToken);
  const rejected = await put(`/api/leaves/${rejectedResult.body.data.leave._id}/reject`, { reviewComment: 'Please provide supporting details' }, hrToken);
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.data.leave.reviewComment, 'Please provide supporting details');
});

test('Day 15 correction stays pending, then recalculates attendance on approval', async () => {
  const date = getWorkingDate();
  const attendance = await Attendance.create({ employee: secondEmployee._id, date, checkIn: dateAt(0, 9, 30), checkOut: dateAt(0, 17, 30), status: 'PRESENT' });
  const correction = await post('/api/corrections', { attendance: attendance._id, requestedCheckIn: dateAt(0, 9, 0), requestedCheckOut: dateAt(0, 18, 0), reason: 'Badge reader issue' }, secondEmployeeToken);
  assert.equal(correction.response.status, 201);
  const pending = await request('/api/corrections/pending', { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(pending.response.status, 200);
  assert.equal((await request('/api/corrections/pending', { headers: { authorization: `Bearer ${employeeToken}` } })).response.status, 403);
  const before = await Attendance.findById(attendance._id);
  assert.equal(before.checkIn.getUTCHours(), 9);
  const approved = await put(`/api/corrections/${correction.body.data.correction._id}/approve`, {}, hrToken);
  assert.equal(approved.response.status, 200);
  const after = await Attendance.findById(attendance._id);
  assert.equal(after.checkIn.getUTCHours(), 9);
  assert.equal(after.workingMinutes, 540);
  assert.equal(after.overtimeMinutes, 60);
  const storedCorrection = await AttendanceCorrection.findById(correction.body.data.correction._id);
  assert.equal(storedCorrection.reviewer.toString(), hr._id.toString());
  assert.ok(storedCorrection.reviewedAt);
  assert.ok(await AuditLog.findOne({ action: 'ATTENDANCE_CORRECTION_APPROVED' }));
  assert.ok(await Notification.findOne({ user: secondEmployee._id, message: /correction.*approved/i }));
});

test('Day 15 rejection requires and stores a review comment', async () => {
  const correctionDate = getWorkingDate(dateAt(3, 0, 0));
  const attendance = await Attendance.create({ employee: secondEmployee._id, date: correctionDate, checkIn: dateAt(3, 9, 30), status: 'PRESENT' });
  const correction = await post('/api/corrections', { attendance: attendance._id, requestedCheckIn: dateAt(3, 9, 0).toISOString(), reason: 'Clock issue' }, secondEmployeeToken);
  assert.equal((await put(`/api/corrections/${correction.body.data.correction._id}/reject`, {}, hrToken)).response.status, 400);
  const rejected = await put(`/api/corrections/${correction.body.data.correction._id}/reject`, { reviewComment: 'The requested time could not be verified' }, hrToken);
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.data.correction.reviewComment, 'The requested time could not be verified');
  assert.ok(await AuditLog.findOne({ action: 'ATTENDANCE_CORRECTION_REJECTED' }));
});

test('Day 16 protects private notifications and audit logs', async () => {
  const ownNotification = await Notification.create({ user: employee._id, message: 'Private update' });
  const otherNotification = await Notification.create({ user: secondEmployee._id, message: 'Other private update' });
  const own = await request('/api/notifications?limit=20', { headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(own.response.status, 200);
  assert.ok(own.body.data.notifications.some((item) => item._id === ownNotification._id.toString()));
  assert.equal(own.body.data.notifications.some((item) => item._id === otherNotification._id.toString()), false);
  const count = await request('/api/notifications/unread-count', { headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(count.response.status, 200);
  assert.ok(count.body.data.unreadCount >= 1);
  const marked = await request(`/api/notifications/${ownNotification._id}/read`, { method: 'PATCH', headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(marked.response.status, 200);
  assert.equal(marked.body.data.notification.read, true);
  const forbiddenMark = await request(`/api/notifications/${otherNotification._id}/read`, { method: 'PATCH', headers: { authorization: `Bearer ${employeeToken}` } });
  assert.equal(forbiddenMark.response.status, 404);
  assert.equal((await request('/api/audit-logs', { headers: { authorization: `Bearer ${employeeToken}` } })).response.status, 403);
  const audit = await request('/api/audit-logs?limit=5', { headers: { authorization: `Bearer ${hrToken}` } });
  assert.equal(audit.response.status, 200);
  assert.ok(audit.body.data.logs.length > 0);
  assert.equal(JSON.stringify(audit.body).includes('Password123'), false);
});
