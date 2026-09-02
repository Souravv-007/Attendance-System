const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('../js/hr-dashboard.js'), 'utf8');

const runGuard = async (user) => {
  let handler;
  const app = { requireSession: async () => user, dashboardFor: (role) => role === 'EMPLOYEE' ? 'employee-dashboard.html' : 'admin-dashboard.html' };
  const context = {
    window: { location: { href: '' }, AttendanceApp: app }, AttendanceApp: app,
    document: { addEventListener: (_, callback) => { handler = callback; } },
  };
  vm.runInNewContext(source, context);
  await handler();
  return context.window.location.href;
};

test('HR dashboard redirects an employee to the employee dashboard before initializing HR UI', async () => {
  assert.equal(await runGuard({ role: 'EMPLOYEE' }), 'employee-dashboard.html');
});

test('HR dashboard leaves unauthenticated redirect handling to requireSession', async () => {
  assert.equal(await runGuard(null), '');
});

test('Day 27 escapes dynamic values before rendering the HR employee edit dialog', () => {
  const hrSource = fs.readFileSync(require.resolve('../js/hr.js'), 'utf8');
  assert.match(hrSource, /const escapeHtml =/);
  assert.match(hrSource, /value="\$\{escapeHtml\(item\.name\)\}"/);
  assert.match(hrSource, /value="\$\{escapeHtml\(item\.email\)\}"/);
  assert.match(hrSource, />\$\{escapeHtml\(department\.name\)\}<\/option>/);
});
