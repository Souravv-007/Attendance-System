document.addEventListener('DOMContentLoaded', async () => {
  const user = await AttendanceApp.requireSession(); if (!user) return;
  const form = document.querySelector('[data-filter-form]'); const body = document.querySelector('[data-attendance-body]'); const state = document.querySelector('[data-state]'); const pageLabel = document.querySelector('[data-page]');
  let page = 1;
  const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const load = async () => {
    state.textContent = 'Loading attendance...';
    try {
      const params = new URLSearchParams({ page, limit: 10 }); const status = form.status.value; if (status) params.set('status', status); if (form.from.value) params.set('from', form.from.value); if (form.to.value) params.set('to', form.to.value);
      const result = await AttendanceApp.apiRequest(`/attendance/me?${params}`); body.replaceChildren();
      result.data.attendance.forEach((item) => { const row = document.createElement('tr'); const hasServerDuration = Number.isFinite(Number(item.workingMinutes)); const duration = item.checkOut && hasServerDuration ? `${Math.floor(Number(item.workingMinutes) / 60)}h ${Number(item.workingMinutes) % 60}m` : '—'; [item.date.slice(0, 10), formatTime(item.checkIn), formatTime(item.checkOut), duration, item.lateMinutes, item.status].forEach((value, index) => { const cell = document.createElement('td'); cell.textContent = value; if (index === 5) { cell.className = `badge ${String(value).toLowerCase().replace('_', '-')}`; } row.append(cell); }); body.append(row); });
      state.textContent = result.data.attendance.length ? '' : 'No attendance records match these filters.'; pageLabel.textContent = `Page ${result.data.pagination.page} of ${Math.max(result.data.pagination.totalPages, 1)}`; document.querySelector('[data-prev]').disabled = page <= 1; document.querySelector('[data-next]').disabled = page >= result.data.pagination.totalPages;
    } catch (error) { state.textContent = error.message; }
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); page = 1; load(); }); document.querySelector('[data-prev]').addEventListener('click', () => { page -= 1; load(); }); document.querySelector('[data-next]').addEventListener('click', () => { page += 1; load(); }); await load();
});
