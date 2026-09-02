document.addEventListener('DOMContentLoaded', async () => {
  const user = await AttendanceApp.requireSession(); if (!user) return;
  const form = document.querySelector('[data-profile-form]'); const state = document.querySelector('[data-state]');
  const render = (profile) => { form.name.value = profile.name || ''; form.email.value = profile.email || ''; form.querySelector('[data-employee-id]').value = profile.employeeId || '—'; form.querySelector('[data-role]').value = profile.role || '—'; state.textContent = ''; };
  render(user);
  form.onsubmit = async (event) => { event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; try { const result = await AttendanceApp.apiRequest('/auth/me', { method: 'PATCH', body: JSON.stringify({ name: form.name.value, email: form.email.value }) }); localStorage.setItem('attendance_user', JSON.stringify(result.data.user)); render(result.data.user); AttendanceApp.toast('Profile updated.', 'success'); } catch (error) { state.textContent = error.message; AttendanceApp.toast(error.message, 'error'); } finally { button.disabled = false; } };
});
