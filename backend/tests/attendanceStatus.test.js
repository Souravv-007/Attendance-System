const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HALF_DAY_THRESHOLD_MINUTES,
  calculateAttendanceStatus,
} = require('../services/attendanceStatusService');
const { isCheckoutAfterCheckIn } = require('../services/attendanceService');

const beforeStart = new Date('2026-09-02T09:29:00.000Z');
const start = new Date('2026-09-02T09:30:00.000Z');
const afterStart = new Date('2026-09-02T09:31:00.000Z');

test('attendance status handles office start boundaries', () => {
  assert.equal(calculateAttendanceStatus({ checkIn: beforeStart }), 'PRESENT');
  assert.equal(calculateAttendanceStatus({ checkIn: start }), 'PRESENT');
  assert.equal(calculateAttendanceStatus({ checkIn: afterStart }), 'LATE');
});

test('attendance status handles half-day threshold boundaries', () => {
  assert.equal(calculateAttendanceStatus({ checkIn: start, workingMinutes: HALF_DAY_THRESHOLD_MINUTES - 1 }), 'HALF_DAY');
  assert.equal(calculateAttendanceStatus({ checkIn: start, workingMinutes: HALF_DAY_THRESHOLD_MINUTES }), 'PRESENT');
  assert.equal(calculateAttendanceStatus({ checkIn: start, workingMinutes: HALF_DAY_THRESHOLD_MINUTES + 1 }), 'PRESENT');
});

test('attendance status handles weekends and approved leave centrally', () => {
  assert.equal(calculateAttendanceStatus({ checkIn: start, isWeekend: true }), 'ABSENT');
  assert.equal(calculateAttendanceStatus({ checkIn: start, hasApprovedLeave: true }), 'ON_LEAVE');
  assert.equal(calculateAttendanceStatus({ checkIn: start }), 'PRESENT');
});

test('checkout boundary requires a strictly later timestamp', () => {
  const checkIn = new Date('2026-09-02T09:30:00.000Z');
  assert.equal(isCheckoutAfterCheckIn(checkIn, new Date('2026-09-02T09:29:00.000Z')), false);
  assert.equal(isCheckoutAfterCheckIn(checkIn, checkIn), false);
  assert.equal(isCheckoutAfterCheckIn(checkIn, new Date('2026-09-02T09:31:00.000Z')), true);
});
