const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('../js/admin.js'), 'utf8');
const runGuard = async (role) => {
  let handler;
  const app = { requireSession: async () => ({ role }), dashboardFor: (value) => value === 'EMPLOYEE' ? 'employee-dashboard.html' : 'hr-dashboard.html' };
  const context = { window: { AttendanceApp: app, location: { href: '' } }, AttendanceApp: app, document: { addEventListener: (_, callback) => { handler = callback; } } };
  vm.runInNewContext(source, context); await handler(); return context.window.location.href;
};

test('admin pages redirect employee and HR users to their permitted dashboards', async () => {
  assert.equal(await runGuard('EMPLOYEE'), 'employee-dashboard.html');
  assert.equal(await runGuard('HR'), 'hr-dashboard.html');
});
