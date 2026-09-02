const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:';
const API_BASE = window.ATTENDANCE_API_BASE || (isLocalFrontend ? 'http://localhost:5000/api' : '/api');

if (!document.title.startsWith('Employee Attendance Management System')) {
  document.title = `Employee Attendance Management System - ${document.title}`;
}
if (!document.querySelector('link[rel="icon"]')) {
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = window.location.pathname.includes('/pages/') ? '../favicon.svg' : 'favicon.svg';
  document.head.append(favicon);
}

const getToken = () => localStorage.getItem('attendance_token');
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('attendance_user') || 'null'); } catch { return null; }
};
const saveSession = (token, user) => {
  localStorage.setItem('attendance_token', token);
  localStorage.setItem('attendance_user', JSON.stringify(user));
};
const clearSession = () => {
  localStorage.removeItem('attendance_token');
  localStorage.removeItem('attendance_user');
};
const logout = () => {
  clearSession();
  window.location.href = 'login.html';
};
const dashboardFor = (role) => role === 'EMPLOYEE' ? 'employee-dashboard.html' : role === 'HR' ? 'hr-dashboard.html' : 'admin-dashboard.html';

const apiRequest = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (error) {
    const connectionError = new Error('Unable to reach the attendance server. Start the backend on http://localhost:5000 and try again.');
    connectionError.cause = error;
    throw connectionError;
  }
  const body = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
  if (!response.ok) {
    const error = new Error(body.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return body;
};

const toast = (message, type = 'info') => {
  const region = document.querySelector('.toast-region') || (() => {
    const node = document.createElement('div'); node.className = 'toast-region'; document.body.append(node); return node;
  })();
  const item = document.createElement('div'); item.className = 'toast'; item.setAttribute('role', 'status'); item.textContent = message;
  item.style.borderLeftColor = type === 'error' ? 'var(--coral)' : type === 'success' ? 'var(--success)' : 'var(--teal)';
  region.append(item); setTimeout(() => item.remove(), 4000);
};

const redirectAuthenticated = () => {
  const user = getStoredUser();
  if (getToken() && user) window.location.href = dashboardFor(user.role);
};

const requireSession = async () => {
  if (!getToken()) { window.location.href = 'login.html'; return null; }
  try {
    const result = await apiRequest('/auth/me');
    localStorage.setItem('attendance_user', JSON.stringify(result.data.user));
    return result.data.user;
  } catch {
    clearSession(); window.location.href = 'login.html'; return null;
  }
};

window.AttendanceApp = { apiRequest, clearSession, dashboardFor, getStoredUser, getToken, logout, redirectAuthenticated, requireSession, saveSession, toast };

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  });
});
