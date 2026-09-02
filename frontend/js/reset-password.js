document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-reset-password-form]');
  if (!form) return;
  const message = document.querySelector('[data-message]');
  const submit = form.querySelector('button[type="submit"]');
  const token = new URLSearchParams(window.location.search).get('token');
  const showMessage = (text, type = 'error') => { message.textContent = text; message.className = `message show ${type}`; };

  if (!token) {
    showMessage('This password reset link is invalid or incomplete.');
    submit.disabled = true;
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (form.password.value !== form.confirmPassword.value) return showMessage('Passwords do not match.');
    submit.disabled = true;
    submit.textContent = 'Resetting...';
    message.className = 'message';
    try {
      const result = await AttendanceApp.apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: form.password.value }) });
      showMessage(`${result.message}. You can now log in with your new password.`, 'success');
      form.reset();
    } catch (error) {
      showMessage(error.message);
      submit.disabled = false;
      submit.textContent = 'Reset Password';
    }
  });
});
