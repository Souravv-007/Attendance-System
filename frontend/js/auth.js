document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;
  AttendanceApp.redirectAuthenticated();
  const message = document.querySelector('[data-message]');
  const submit = form.querySelector('button[type="submit"]');
  const setMessage = (text, type = 'error') => { message.textContent = text; message.className = `message show ${type}`; };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const password = form.password.value;
    if (form.confirmPassword && password !== form.confirmPassword.value) return setMessage('Passwords do not match.');
    submit.disabled = true; submit.textContent = 'Working...'; message.className = 'message';
    const payload = Object.fromEntries(new FormData(form)); delete payload.confirmPassword;
    try {
      const result = await AttendanceApp.apiRequest(form.dataset.authForm === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      AttendanceApp.saveSession(result.token, result.user);
      setMessage('Success. Redirecting...', 'success');
      setTimeout(() => { window.location.href = AttendanceApp.dashboardFor(result.user.role); }, 250);
    } catch (error) {
      setMessage(error.message); submit.disabled = false; submit.textContent = form.dataset.authForm === 'login' ? 'Sign in' : 'Create account';
    }
  });
});
