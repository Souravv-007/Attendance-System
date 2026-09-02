const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const forgotPage = fs.readFileSync(require.resolve('../forgot-password.html'), 'utf8');
const resetPage = fs.readFileSync(require.resolve('../reset-password.html'), 'utf8');
const forgotScript = fs.readFileSync(require.resolve('../js/forgot-password.js'), 'utf8');
const resetScript = fs.readFileSync(require.resolve('../js/reset-password.js'), 'utf8');

test('forgot-password page provides an email form, generic feedback, and a login link', () => {
  assert.match(forgotPage, /data-forgot-password-form/);
  assert.match(forgotPage, /type="email"/);
  assert.match(forgotPage, /Back to Login/);
  assert.match(forgotScript, /\/auth\/forgot-password/);
  assert.match(forgotScript, /submit\.disabled = true/);
});

test('reset-password page accepts a URL token and validates password confirmation before its API request', () => {
  assert.match(resetPage, /data-reset-password-form/);
  assert.match(resetPage, /confirmPassword/);
  assert.match(resetScript, /URLSearchParams\(window\.location\.search\)\.get\('token'\)/);
  assert.match(resetScript, /Passwords do not match/);
  assert.match(resetScript, /\/auth\/reset-password/);
});
