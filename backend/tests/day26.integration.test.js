const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

let server; let baseUrl; let employee; let hr; let admin; let employeeToken; let hrToken; let adminToken;
const secret = process.env.JWT_SECRET || 'dev_secret_key_change_me';
const tokenFor = (user) => jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '7d' });
const request = async (path, token, options = {}) => { const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } }); return { response, body: await response.json() }; };

test.before(async () => { await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017', { dbName: 'attendance_system_test_day26' }); await Promise.all([User.deleteMany({}), AuditLog.deleteMany({})]); const password = await bcrypt.hash('Password123', 10); [employee, hr, admin] = await User.create([{ name: 'Day 26 Employee', employeeId: 'D26-001', email: 'd26.employee@test.local', password, role: 'EMPLOYEE' }, { name: 'Day 26 HR', email: 'd26.hr@test.local', password, role: 'HR' }, { name: 'Day 26 Admin', email: 'd26.admin@test.local', password, role: 'ADMIN' }]); employeeToken = tokenFor(employee); hrToken = tokenFor(hr); adminToken = tokenFor(admin); server = http.createServer(app); await new Promise((resolve) => server.listen(0, resolve)); baseUrl = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => { await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); });

test('Day 26 protects admin user management and settings from employee and HR access', async () => {
  assert.equal((await request('/api/admin/users', employeeToken)).response.status, 403);
  assert.equal((await request('/api/admin/users', hrToken)).response.status, 403);
  assert.equal((await request('/api/admin/settings', employeeToken)).response.status, 403);
  const allowed = await request('/api/admin/users', adminToken); assert.equal(allowed.response.status, 200); assert.equal(JSON.stringify(allowed.body).includes('password'), false);
  const settings = await request('/api/admin/settings', adminToken); assert.equal(settings.response.status, 200); assert.equal(typeof settings.body.data.settings.expectedWorkingMinutes, 'number');
});

test('Day 26 restricts role and status changes to admin and records privileged audit events', async () => {
  const employeeRoleChange = await request(`/api/employees/${employee._id}`, employeeToken, { method: 'PUT', body: JSON.stringify({ role: 'ADMIN' }) }); assert.equal(employeeRoleChange.response.status, 403);
  const hrRoleChange = await request(`/api/employees/${employee._id}`, hrToken, { method: 'PUT', body: JSON.stringify({ role: 'HR' }) }); assert.equal(hrRoleChange.response.status, 403);
  const hrStatusChange = await request(`/api/employees/${employee._id}/status`, hrToken, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }); assert.equal(hrStatusChange.response.status, 403);
  const roleChange = await request(`/api/admin/users/${employee._id}`, adminToken, { method: 'PUT', body: JSON.stringify({ role: 'HR' }) }); assert.equal(roleChange.response.status, 200); assert.equal(roleChange.body.data.employee.role, 'HR'); assert.equal(roleChange.body.data.employee.password, undefined);
  const statusChange = await request(`/api/admin/users/${employee._id}/status`, adminToken, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }); assert.equal(statusChange.response.status, 200); assert.ok(await AuditLog.findOne({ action: 'USER_ROLE_CHANGED', user: admin._id })); assert.ok(await AuditLog.findOne({ action: 'EMPLOYEE_DEACTIVATED', user: admin._id }));
});

test('Day 26 permits validated self-profile updates only and keeps sensitive fields private', async () => {
  const forbidden = await request('/api/auth/me', hrToken, { method: 'PATCH', body: JSON.stringify({ role: 'ADMIN', isActive: false, passwordHash: 'x' }) }); assert.equal(forbidden.response.status, 403);
  const invalid = await request('/api/auth/me', hrToken, { method: 'PATCH', body: JSON.stringify({ name: 'A' }) }); assert.equal(invalid.response.status, 400);
  const updated = await request('/api/auth/me', hrToken, { method: 'PATCH', body: JSON.stringify({ name: 'Updated HR', email: 'updated.hr@test.local' }) }); assert.equal(updated.response.status, 200); assert.equal(updated.body.data.user.name, 'Updated HR'); assert.equal(updated.body.data.user.password, undefined); assert.equal(JSON.stringify(updated.body).includes('passwordHash'), false); assert.equal((await User.findById(hr._id)).role, 'HR'); assert.ok(await AuditLog.findOne({ action: 'PROFILE_UPDATED', user: hr._id }));
});
