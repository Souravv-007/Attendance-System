const getAttendanceState = (item) => {
  const hasCheckedIn = Boolean(item && item.checkIn);
  const hasCheckedOut = Boolean(item && item.checkOut);
  const hasServerDuration = item && Number.isFinite(Number(item.workingMinutes));

  return {
    hasCheckedIn,
    hasCheckedOut,
    checkInDisabled: hasCheckedIn,
    checkOutDisabled: !hasCheckedIn || hasCheckedOut,
    message: hasCheckedOut ? 'Your day is complete.' : hasCheckedIn ? 'In progress' : 'Not checked in.',
    duration: hasCheckedOut && hasServerDuration
      ? `${Math.floor(Number(item.workingMinutes) / 60)}h ${Number(item.workingMinutes) % 60}m`
      : '—',
  };
};

if (typeof window !== 'undefined') window.AttendanceDashboard = { getAttendanceState };

const applyAttendanceButtonState = (checkInButton, checkOutButton, attendanceState) => {
  checkInButton.disabled = Boolean(attendanceState.checkInDisabled);
  checkOutButton.disabled = Boolean(attendanceState.checkOutDisabled);
  checkInButton.toggleAttribute('disabled', checkInButton.disabled);
  checkOutButton.toggleAttribute('disabled', checkOutButton.disabled);
};

if (typeof window !== 'undefined') window.AttendanceDashboard.applyAttendanceButtonState = applyAttendanceButtonState;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await AttendanceApp.requireSession(); if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = user.name; });
  document.querySelector('[data-user-role]').textContent = user.role;
  const clock = document.querySelector('[data-clock]');
  const tick = () => { const now = new Date(); document.querySelector('[data-today]').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 1000);
  const state = document.querySelector('[data-dashboard-state]');
  const checkInButton = document.querySelector('[data-check-in]'); const checkOutButton = document.querySelector('[data-check-out]');
  const renderAttendance = (item) => {
    const attendanceState = getAttendanceState(item);
    if (!item) { state.textContent = attendanceState.message; checkInButton.disabled = false; checkOutButton.disabled = true; document.querySelector('[data-duration]').textContent = '—'; return; }
    document.querySelector('[data-check-in-time]').textContent = item.checkIn ? new Date(item.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
    document.querySelector('[data-check-out-time]').textContent = item.checkOut ? new Date(item.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
    document.querySelector('[data-status]').textContent = item.status; document.querySelector('[data-status]').className = `badge ${item.status.toLowerCase().replace('_', '-')}`;
    document.querySelector('[data-duration]').textContent = attendanceState.duration;
    applyAttendanceButtonState(checkInButton, checkOutButton, attendanceState);
    state.textContent = attendanceState.message;
  };
  const load = async () => {
    try {
      const [attendance, leaves] = await Promise.all([AttendanceApp.apiRequest('/attendance/me?limit=31'), AttendanceApp.apiRequest('/leaves/my-leaves?limit=10')]);
      const today = new Date().toISOString().slice(0, 10); renderAttendance(attendance.data.attendance.find((item) => item.date.slice(0, 10) === today));
      const pending = leaves.data.leaves.filter((item) => item.status === 'PENDING'); document.querySelector('[data-pending]').textContent = pending.length ? `${pending.length} pending request${pending.length === 1 ? '' : 's'}` : 'No pending requests';
      document.querySelector('[data-balance]').textContent = Object.values(user.leaveBalances || {}).reduce((sum, value) => sum + value, 0);
      document.querySelector('[data-attendance-count]').textContent = attendance.data.pagination.total;
    } catch (error) { state.textContent = error.message; state.className = 'state'; }
  };
  const action = async (path, button) => { button.disabled = true; button.textContent = 'Saving...'; try { await AttendanceApp.apiRequest(path, { method: 'POST', body: '{}' }); AttendanceApp.toast('Attendance updated successfully.', 'success'); await load(); } catch (error) { AttendanceApp.toast(error.message, 'error'); button.disabled = false; button.textContent = path.includes('check-in') ? 'Check in' : 'Check out'; } };
  checkInButton.addEventListener('click', () => action('/attendance/check-in', checkInButton)); checkOutButton.addEventListener('click', () => action('/attendance/check-out', checkOutButton));
  document.querySelector('[data-logout]').addEventListener('click', () => { AttendanceApp.clearSession(); window.location.href = 'login.html'; });
  await load();
});
