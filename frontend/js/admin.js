document.addEventListener('DOMContentLoaded', async () => {
  const user = await AttendanceApp.requireSession(); if (!user) return;
  if (user.role !== 'ADMIN') { window.location.href = AttendanceApp.dashboardFor(user.role); return; }
  const state = document.querySelector('[data-state]');
  if (!document.body.dataset.page) {
    const form = document.querySelector('[data-settings-form]');
    const submit = form.querySelector('button[type="submit"]');
    const renderSettings = (settings) => {
      form.officeStart.value = settings.officeStart;
      form.officeEnd.value = settings.officeEnd;
      document.querySelector('[data-expected-working-minutes]').textContent = settings.expectedWorkingMinutes;
      document.querySelector('[data-assumed-break-minutes]').textContent = settings.assumedBreakMinutes;
      document.querySelector('[data-half-day-threshold-minutes]').textContent = settings.halfDayThresholdMinutes;
    };
    try {
      const result = await AttendanceApp.apiRequest('/admin/settings');
      renderSettings(result.data.settings);
    } catch (error) {
      state.textContent = error.message;
      return;
    }
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submit.disabled = true;
      try {
        const result = await AttendanceApp.apiRequest('/admin/settings', { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        renderSettings(result.data.settings);
        AttendanceApp.toast('Office timings updated.', 'success');
      } catch (error) {
        AttendanceApp.toast(error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    };
    return;
  }
  const body = document.querySelector('[data-body]'); const form = document.querySelector('[data-filters]');
  const load = async () => { state.textContent = 'Loading users...'; try { const query = new URLSearchParams([...new FormData(form)].filter(([, value]) => value)); const result = await AttendanceApp.apiRequest(`/admin/users?${query}`); body.replaceChildren(); result.data.employees.forEach((item) => { const row = document.createElement('tr'); [item.name, item.email, item.employeeId || '—', item.role, item.isActive ? 'Active' : 'Inactive'].forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); const actions = document.createElement('td'); actions.className = 'table-actions'; const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Edit'; edit.onclick = async () => { const name = window.prompt('Name', item.name); const email = name === null ? null : window.prompt('Email', item.email); if (email === null) return; try { await AttendanceApp.apiRequest(`/admin/users/${item._id}`, { method: 'PUT', body: JSON.stringify({ name, email }) }); AttendanceApp.toast('User details updated.', 'success'); load(); } catch (error) { AttendanceApp.toast(error.message, 'error'); } }; const role = document.createElement('select'); ['EMPLOYEE', 'HR', 'ADMIN'].forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value; option.selected = value === item.role; role.append(option); }); const save = document.createElement('button'); save.className = 'secondary'; save.textContent = 'Save role'; save.onclick = async () => { try { await AttendanceApp.apiRequest(`/admin/users/${item._id}`, { method: 'PUT', body: JSON.stringify({ role: role.value }) }); AttendanceApp.toast('Role updated.', 'success'); load(); } catch (error) { AttendanceApp.toast(error.message, 'error'); } }; const status = document.createElement('button'); status.className = item.isActive ? 'danger' : 'primary'; status.textContent = item.isActive ? 'Deactivate' : 'Activate'; status.onclick = async () => { if (!window.confirm(`${status.textContent} ${item.name}?`)) return; try { await AttendanceApp.apiRequest(`/admin/users/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }); AttendanceApp.toast('Account status updated.', 'success'); load(); } catch (error) { AttendanceApp.toast(error.message, 'error'); } }; actions.append(edit, role, save, status); row.append(actions); body.append(row); }); state.textContent = result.data.employees.length ? '' : 'No users found.'; } catch (error) { state.textContent = error.message; } };
  form.onsubmit = (event) => { event.preventDefault(); load(); }; document.querySelector('[data-refresh]').onclick = load; await load();
});
