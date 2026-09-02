const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Department = require('../models/Department');

let server;
let baseUrl;
let employee;
let hr;
let admin;
const secret = process.env.JWT_SECRET;
const tokenFor = (user, options = {}) => jwt.sign({ id: user._id, role: options.role || user.role }, options.secret || secret, { expiresIn: options.expiresIn || '7d' });
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json() };
};
const auth = (token) => ({ authorization: `Bearer ${token}` });

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_day28' });
  await Promise.all([User.deleteMany({}), Attendance.deleteMany({}), Notification.deleteMany({}), AuditLog.deleteMany({}), Department.deleteMany({})]);
  const password = await bcrypt.hash('Password123', 10);
  [employee, hr, admin] = await User.create([
    { name: 'Day 28 Employee', employeeId: 'D28-001', email: 'd28.employee@test.local', password, role: 'EMPLOYEE' },
    { name: 'Day 28 HR', email: 'd28.hr@test.local', password, role: 'HR' },
    { name: 'Day 28 Admin', email: 'd28.admin@test.local', password, role: 'ADMIN' },
  ]);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); });

test('Day 28 rejects missing, malformed, tampered, expired, invalid-signature, and inactive-user JWTs', async () => {
  const endpoint = '/api/employees';
  assert.equal((await request(endpoint)).response.status, 401);
  assert.equal((await request(endpoint, { headers: auth('not-a-jwt') })).response.status, 401);
  assert.equal((await request(endpoint, { headers: auth(tokenFor(employee, { secret: 'untrusted-test-signing-key' })) })).response.status, 401);
  assert.equal((await request(endpoint, { headers: auth(tokenFor(employee, { expiresIn: '-1s' })) })).response.status, 401);
  const inactive = await User.create({ name: 'Day 28 Inactive', employeeId: 'D28-004', email: 'd28.inactive@test.local', password: await bcrypt.hash('Password123', 10), role: 'HR', isActive: false });
  assert.equal((await request(endpoint, { headers: auth(tokenFor(inactive)) })).response.status, 401);
});

test('Day 28 derives permissions from the database and blocks role bypass attempts', async () => {
  assert.equal((await request('/api/admin/settings', { headers: auth(tokenFor(employee)) })).response.status, 403);
  assert.equal((await request('/api/admin/settings', { headers: auth(tokenFor(hr)) })).response.status, 403);
  assert.equal((await request('/api/admin/settings', { headers: auth(tokenFor(employee, { role: 'ADMIN' })) })).response.status, 403);
  assert.equal((await request('/api/admin/settings', { headers: auth(tokenFor(admin)) })).response.status, 200);
  const escalation = await request('/api/auth/me', { method: 'PATCH', headers: auth(tokenFor(employee)), body: JSON.stringify({ role: 'ADMIN', isActive: false }) });
  assert.equal(escalation.response.status, 403);
  assert.equal((await User.findById(employee._id)).role, 'EMPLOYEE');
  assert.equal((await User.findById(employee._id)).isActive, true);
});

test('Day 28 safely validates malformed identifiers, payloads, and bounded search input', async () => {
  const hrToken = tokenFor(hr);
  const badEmployeeId = await request('/api/employees/not-an-object-id', { headers: auth(hrToken) });
  assert.equal(badEmployeeId.response.status, 400);
  assert.equal(JSON.stringify(badEmployeeId.body).includes('CastError'), false);
  const badRegistration = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: {}, employeeId: [], email: {}, password: {} }) });
  assert.equal(badRegistration.response.status, 400);
  assert.equal(JSON.stringify(badRegistration.body).match(/stack|\[object Object\]|untrusted-test-signing-key/i), null);
  const regexSearch = await request(`/api/employees?search=${encodeURIComponent('[a-z]+')}`, { headers: auth(hrToken) });
  assert.equal(regexSearch.response.status, 200);
  const longSearch = await request(`/api/employees?search=${'x'.repeat(101)}`, { headers: auth(hrToken) });
  assert.equal(longSearch.response.status, 400);
});

test('Day 28 enforces safe pagination and security headers/CORS policy', async () => {
  await Notification.create([{ user: employee._id, message: 'One' }, { user: employee._id, message: 'Two' }]);
  const pageOne = await request('/api/notifications?page=0&limit=9999', { headers: auth(tokenFor(employee)) });
  assert.equal(pageOne.response.status, 200);
  assert.equal(pageOne.body.data.pagination.page, 1);
  assert.equal(pageOne.body.data.pagination.limit, 100);
  const beyond = await request('/api/notifications?page=99&limit=1', { headers: auth(tokenFor(employee)) });
  assert.equal(beyond.response.status, 200);
  assert.deepEqual(beyond.body.data.notifications, []);
  const headers = await request('/health', { headers: { origin: 'http://localhost:3000' } });
  assert.equal(headers.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(headers.response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const denied = await request('/health', { headers: { origin: 'null' } });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.response.headers.get('access-control-allow-origin'), null);
});

test('Day 28 enforces the configured authentication rate limit', async () => {
  let last;
  for (let attempt = 0; attempt < 22; attempt += 1) {
    last = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'd28.employee@test.local', password: 'incorrect-password' }) });
  }
  assert.equal(last.response.status, 429);
  assert.match(last.body.message, /too many authentication attempts/i);
});
