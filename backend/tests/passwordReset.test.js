const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

let server;
let baseUrl;
let employee;
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  return { response, body: await response.json() };
};
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

test.before(async () => {
  process.env.NODE_ENV = 'development';
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_password_reset' });
  await Promise.all([User.deleteMany({}), AuditLog.deleteMany({})]);
  employee = await User.create({
    name: 'Reset Test Employee', employeeId: 'RESET-001', email: 'reset.employee@test.local',
    password: await bcrypt.hash('Password123', 10), role: 'EMPLOYEE',
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
});

test('forgot password gives a generic response and stores only a token hash', async () => {
  const known = await post('/api/auth/forgot-password', { email: employee.email.toUpperCase() });
  const unknown = await post('/api/auth/forgot-password', { email: 'unknown@test.local' });
  assert.equal(known.response.status, 200);
  assert.equal(unknown.response.status, 200);
  assert.equal(known.body.message, unknown.body.message);
  const resetUrl = known.body.data.developmentResetUrl;
  const token = new URL(resetUrl).searchParams.get('token');
  assert.equal(new URL(resetUrl).pathname, '/reset-password.html');
  assert.match(token, /^[a-f0-9]{64}$/);
  const stored = await User.findById(employee._id).select('+passwordResetTokenHash +passwordResetExpires');
  assert.notEqual(stored.passwordResetTokenHash, token);
  assert.ok(stored.passwordResetExpires > new Date());
  assert.equal(JSON.stringify(unknown.body).includes(token), false);
});

test('forgot password rejects invalid email addresses', async () => {
  const result = await post('/api/auth/forgot-password', { email: 'not-an-email' });
  assert.equal(result.response.status, 400);
});

test('reset password changes the password, preserves role, audits, and invalidates the token', async () => {
  const forgot = await post('/api/auth/forgot-password', { email: employee.email });
  const token = new URL(forgot.body.data.developmentResetUrl).searchParams.get('token');
  const reset = await post('/api/auth/reset-password', { token, password: 'NewPassword123' });
  assert.equal(reset.response.status, 200);
  assert.equal(JSON.stringify(reset.body).includes('NewPassword123'), false);
  const updated = await User.findById(employee._id).select('+passwordResetTokenHash +passwordResetExpires');
  assert.equal(await bcrypt.compare('Password123', updated.password), false);
  assert.equal(await bcrypt.compare('NewPassword123', updated.password), true);
  assert.equal(updated.role, 'EMPLOYEE');
  assert.equal(updated.passwordResetTokenHash, null);
  assert.equal(updated.passwordResetExpires, null);
  assert.ok(await AuditLog.findOne({ user: employee._id, action: 'PASSWORD_RESET' }));
  assert.equal((await post('/api/auth/reset-password', { token, password: 'AnotherPassword123' })).response.status, 400);
  assert.equal((await post('/api/auth/login', { email: employee.email, password: 'Password123' })).response.status, 401);
  assert.equal((await post('/api/auth/login', { email: employee.email, password: 'NewPassword123' })).response.status, 200);
});

test('reset password rejects expired and malformed tokens', async () => {
  const forgot = await post('/api/auth/forgot-password', { email: employee.email });
  const token = new URL(forgot.body.data.developmentResetUrl).searchParams.get('token');
  await User.findByIdAndUpdate(employee._id, { passwordResetExpires: new Date(Date.now() - 1000) });
  assert.equal((await post('/api/auth/reset-password', { token, password: 'AnotherPassword123' })).response.status, 400);
  assert.equal((await post('/api/auth/reset-password', { token: 'invalid', password: 'AnotherPassword123' })).response.status, 400);
});

test('password reset endpoints are rate limited', async () => {
  let last;
  for (let attempt = 0; attempt < 6; attempt += 1) last = await post('/api/auth/forgot-password', { email: 'rate-limit@test.local' });
  assert.equal(last.response.status, 429);
});
