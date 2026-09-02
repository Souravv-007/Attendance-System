document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-forgot-password-form]');
  if (!form) return;
  const message = document.querySelector('[data-message]');
  const submit = form.querySelector('button[type="submit"]');
  const showMessage = (text, type = 'error') => { message.textContent = text; message.className = `message show ${type}`; };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = 'Sending...';
    message.className = 'message';
    try {
      const result = await AttendanceApp.apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.email.value }) });
      showMessage(result.message, 'success');
      if (result.data?.developmentResetUrl) {
        const link = document.createElement('a');
        link.href = result.data.developmentResetUrl;
        link.textContent = 'Open development reset page';
        link.className = 'button secondary';
        message.append(document.createElement('br'), link);
      }
      form.reset();
    } catch (error) {
      showMessage(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Send Reset Link';
    }
  });
});
