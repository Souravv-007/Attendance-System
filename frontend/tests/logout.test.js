const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('../js/api.js'), 'utf8');

const bootApi = () => {
  const storage = new Map();
  const handlers = {};
  const logoutControl = {
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
  };
  const context = {
    window: { location: { href: '' } },
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      querySelectorAll: (selector) => selector === '[data-logout]' ? [logoutControl] : [],
      querySelector: () => null,
    },
    setTimeout: () => {},
  };
  vm.runInNewContext(source, context);
  handlers.DOMContentLoaded();
  return { context, logoutControl, storage };
};

test('Day 27 logout clears both session keys and redirects to login', () => {
  const { context, logoutControl, storage } = bootApi();
  context.window.AttendanceApp.saveSession('test-token', { role: 'EMPLOYEE' });
  let prevented = false;
  logoutControl.listeners.click({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(storage.has('attendance_token'), false);
  assert.equal(storage.has('attendance_user'), false);
  assert.equal(context.window.location.href, 'login.html');
});

test('Day 27 logged-out users are redirected from protected pages and can log in again', async () => {
  const { context, logoutControl, storage } = bootApi();
  context.window.AttendanceApp.saveSession('old-token', { role: 'EMPLOYEE' });
  logoutControl.listeners.click({ preventDefault: () => {} });
  assert.equal(await context.window.AttendanceApp.requireSession(), null);
  assert.equal(context.window.location.href, 'login.html');
  context.window.AttendanceApp.saveSession('new-token', { role: 'HR' });
  assert.equal(storage.get('attendance_token'), 'new-token');
  assert.deepEqual(JSON.parse(storage.get('attendance_user')), { role: 'HR' });
  assert.equal(context.window.AttendanceApp.dashboardFor('EMPLOYEE'), 'employee-dashboard.html');
  assert.equal(context.window.AttendanceApp.dashboardFor('HR'), 'hr-dashboard.html');
  assert.equal(context.window.AttendanceApp.dashboardFor('ADMIN'), 'admin-dashboard.html');
});

test('Day 27 HR and admin dashboards expose the shared logout control', () => {
  const hrPage = fs.readFileSync(require.resolve('../pages/hr-dashboard.html'), 'utf8');
  const adminPage = fs.readFileSync(require.resolve('../pages/admin-dashboard.html'), 'utf8');
  assert.match(hrPage, /data-logout/);
  assert.match(adminPage, /data-logout/);
});
