const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(require.resolve('../js/dashboard.js'), 'utf8');
const context = {
  window: {},
  document: { addEventListener: () => {} },
};
vm.runInNewContext(source, context);
const { getAttendanceState, applyAttendanceButtonState } = context.window.AttendanceDashboard;

test('dashboard state treats checked-out attendance as complete', () => {
  const state = getAttendanceState({ checkIn: '2026-09-02T14:17:00.000Z', checkOut: '2026-09-02T14:18:00.000Z', workingMinutes: 1 });
  assert.equal(state.checkInDisabled, true);
  assert.equal(state.checkOutDisabled, true);
  assert.equal(state.message, 'Your day is complete.');
  assert.equal(state.duration, '0h 1m');
});

test('dashboard state keeps checkout in progress only before checkout', () => {
  const state = getAttendanceState({ checkIn: '2026-09-02T14:17:00.000Z', checkOut: null, workingMinutes: 0 });
  assert.equal(state.checkInDisabled, true);
  assert.equal(state.checkOutDisabled, false);
  assert.equal(state.message, 'In progress');
  assert.equal(state.duration, '—');
});

test('dashboard state enables check-in when no attendance exists', () => {
  const state = getAttendanceState(null);
  assert.equal(state.checkInDisabled, false);
  assert.equal(state.checkOutDisabled, true);
  assert.equal(state.message, 'Not checked in.');
  assert.equal(state.duration, '—');
});

test('completed state applies disabled properties and attributes to both buttons', () => {
  const checkInButton = { disabled: false, toggleAttribute(name, value) { this[name] = value; } };
  const checkOutButton = { disabled: false, toggleAttribute(name, value) { this[name] = value; } };
  applyAttendanceButtonState(checkInButton, checkOutButton, getAttendanceState({ checkIn: '2026-09-02T14:17:00.000Z', checkOut: '2026-09-02T14:18:00.000Z', workingMinutes: 0 }));
  assert.equal(checkInButton.disabled, true);
  assert.equal(checkOutButton.disabled, true);
  assert.equal(checkInButton.disabled, true);
  assert.equal(checkOutButton.disabled, true);
});