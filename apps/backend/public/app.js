(function() {
  'use strict';

  const API_BASE = '/api/v1/auth';
  let accessToken = localStorage.getItem('accessToken');
  let refreshToken = localStorage.getItem('refreshToken');
  let currentUser = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('Auth Test Interface Loaded');
    attachEventListeners();
    updateAuthStatus();
  }

  function attachEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        const target = this.dataset.tab;
        document.getElementById('publicTab').classList.toggle('hidden', target !== 'public');
        document.getElementById('protectedTab').classList.toggle('hidden', target !== 'protected');
      });
    });

    document.getElementById('checkAuthBtn').addEventListener('click', handleCheckAuth);
    document.getElementById('signupForm').addEventListener('submit', handleSignUp);
    document.getElementById('signinForm').addEventListener('submit', handleSignIn);
    document.getElementById('verifyForm').addEventListener('submit', handleVerifyEmail);
    document.getElementById('refreshForm').addEventListener('submit', handleRefresh);
    document.getElementById('forgotForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetForm').addEventListener('submit', handleResetPassword);
    document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);

    document.getElementById('meBtn').addEventListener('click', handleGetMe);
    document.getElementById('updateProfileForm').addEventListener('submit', handleUpdateProfile);
    document.getElementById('sessionsBtn').addEventListener('click', handleListSessions);
    document.getElementById('signoutBtn').addEventListener('click', handleSignOut);
    document.getElementById('signoutAllBtn').addEventListener('click', handleSignOutAll);
    document.getElementById('devicesBtn').addEventListener('click', handleLoadDevices);
    document.getElementById('copyTokenBtn').addEventListener('click', copyToken);
    document.getElementById('clearSessionBtn').addEventListener('click', clearSession);
    document.getElementById('googleSignInBtn').addEventListener('click', () => handleOAuthSignIn('google'));
    document.getElementById('githubSignInBtn').addEventListener('click', () => handleOAuthSignIn('github'));

    // Check for OAuth callback
    checkOAuthCallback();
  }

  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function setLoading(id, loading) {
    const btn = document.getElementById(id);
    if (loading) {
      btn.disabled = true;
      btn._originalHTML = btn.innerHTML;
      btn.innerHTML = '<div class="spinner"></div><span>Loading...</span>';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._originalHTML || '<span>Submit</span>';
    }
  }

  function updateAuthStatus() {
    const indicator = document.getElementById('authIndicator');
    const statusText = document.getElementById('statusText');
    const authStatus = document.getElementById('authStatus');
    const tokenInfo = document.getElementById('tokenInfo');

    if (accessToken) {
      indicator.classList.add('authenticated');
      statusText.textContent = currentUser ? 'Authenticated as ' + currentUser.email : 'Authenticated';
      authStatus.innerHTML = '<p style="color: #22c55e;"> Logged in' + (currentUser ? ' as <strong>' + currentUser.email + '</strong>' : '') + '</p>';
      tokenInfo.classList.remove('hidden');
      document.getElementById('accessTokenDisplay').textContent = accessToken;
    } else {
      indicator.classList.remove('authenticated');
      statusText.textContent = 'Not authenticated';
      authStatus.innerHTML = '<p style="color: #71717a;">Not authenticated</p>';
      tokenInfo.classList.add('hidden');
    }
  }

  function showResponse(id, data, isError) {
    const el = document.getElementById(id);
    el.classList.remove('hidden', 'response-success', 'response-error');
    el.classList.add(isError ? 'response-error' : 'response-success');
    el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }

  function hideResponse(id) {
    document.getElementById(id).classList.add('hidden');
  }

  async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      method: options.method || 'GET'
    };

    if (options.body) config.body = options.body;
    if (accessToken && !endpoint.startsWith('/verify-email')) {
      config.headers['Authorization'] = 'Bearer ' + accessToken;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return { success: false, error: { status: response.status, ...data } };
      }
      return { success: true, data: data };
    } catch (err) {
      return { success: false, error: { message: 'Network error. Is server running?' } };
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('signupResponse');
    setLoading('signupBtn', true);

    const result = await apiRequest('/sign-up', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('signupEmail').value,
        fullName: document.getElementById('signupName').value,
        password: document.getElementById('signupPassword').value
      })
    });

    setLoading('signupBtn', false);

    if (result.success) {
      showResponse('signupResponse', { status: 'success', message: 'Account created! Check server console for token', data: result.data.data }, false);
      showToast('Account created!', 'success');
      document.getElementById('signupForm').reset();
    } else {
      showResponse('signupResponse', result.error, true);
      showToast(result.error.message || 'Sign up failed', 'error');
    }
    return false;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('signinResponse');
    setLoading('signinBtn', true);

    const result = await apiRequest('/sign-in', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('signinEmail').value,
        password: document.getElementById('signinPassword').value
      })
    });

    setLoading('signinBtn', false);

    if (result.success) {
      accessToken = result.data.data.accessToken;
      refreshToken = result.data.data.refreshToken;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      showResponse('signinResponse', { message: 'Signed in successfully!', userId: result.data.data.userId }, false);
      showToast('Welcome back!', 'success');
      updateAuthStatus();
      handleGetMe();
    } else {
      showResponse('signinResponse', result.error, true);
      showToast(result.error.message || 'Sign in failed', 'error');
    }
    return false;
  }

  async function handleVerifyEmail(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('verifyResponse');
    setLoading('verifyBtn', true);

    const token = document.getElementById('verifyToken').value.trim();
    const result = await apiRequest('/verify-email?token=' + encodeURIComponent(token));

    setLoading('verifyBtn', false);

    if (result.success) {
      showResponse('verifyResponse', result.data, false);
      showToast('Email verified!', 'success');
    } else {
      showResponse('verifyResponse', result.error, true);
      showToast(result.error.message || 'Verification failed', 'error');
    }
    return false;
  }

  async function handleRefresh(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('refreshResponse');
    setLoading('refreshBtn', true);

    const token = document.getElementById('refreshTokenInput').value.trim() || refreshToken;
    const result = await apiRequest('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token })
    });

    setLoading('refreshBtn', false);

    if (result.success) {
      accessToken = result.data.data.accessToken;
      refreshToken = result.data.data.refreshToken;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      showResponse('refreshResponse', { message: 'Tokens refreshed!' }, false);
      showToast('Tokens refreshed', 'success');
      updateAuthStatus();
    } else {
      showResponse('refreshResponse', result.error, true);
      showToast('Refresh failed', 'error');
    }
    return false;
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('forgotResponse');
    setLoading('forgotBtn', true);

    await apiRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: document.getElementById('forgotEmail').value })
    });

    setLoading('forgotBtn', false);
    showResponse('forgotResponse', { message: 'If account exists, reset link sent. Check server console for token.' }, false);
    showToast('Reset link sent', 'success');
    document.getElementById('forgotForm').reset();
    return false;
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('resetResponse');
    setLoading('resetBtn', true);

    const result = await apiRequest('/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: document.getElementById('resetToken').value.trim(),
        password: document.getElementById('resetPassword').value
      })
    });

    setLoading('resetBtn', false);

    if (result.success) {
      showResponse('resetResponse', result.data, false);
      showToast('Password reset successful!', 'success');
      document.getElementById('resetForm').reset();
    } else {
      showResponse('resetResponse', result.error, true);
      showToast('Reset failed', 'error');
    }
    return false;
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('changePasswordResponse');
    setLoading('changePasswordBtn', true);

    const result = await apiRequest('/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value
      })
    });

    setLoading('changePasswordBtn', false);

    if (result.success) {
      showResponse('changePasswordResponse', result.data, false);
      showToast('Password changed!', 'success');
      document.getElementById('changePasswordForm').reset();
    } else {
      showResponse('changePasswordResponse', result.error, true);
      showToast('Change failed', 'error');
    }
    return false;
  }

  async function handleCheckAuth() {
    hideResponse('checkAuthResponse');
    setLoading('checkAuthBtn', true);

    const result = await apiRequest('/check');

    setLoading('checkAuthBtn', false);

    if (result.success) {
      const data = result.data.data;
      if (data.isAuthenticated) {
        currentUser = data.user;
        updateAuthStatus();
        showToast('You are signed in', 'success');
      } else {
        showToast(`Not signed in: ${data.reason}`, 'error');
      }
      showResponse('checkAuthResponse', result.data, false);
    } else {
      showResponse('checkAuthResponse', result.error, true);
    }
  }

  async function handleGetMe() {
    hideResponse('meResponse');
    setLoading('meBtn', true);

    const result = await apiRequest('/me');

    setLoading('meBtn', false);

    if (result.success) {
      currentUser = result.data.data;
      showResponse('meResponse', result.data, false);
      updateAuthStatus();
    } else {
      showResponse('meResponse', result.error, true);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('updateProfileResponse');
    setLoading('updateProfileBtn', true);

    const fullName = document.getElementById('updateFullName').value.trim();

    const result = await apiRequest('/profile', {
      method: 'PATCH',
      body: JSON.stringify({ fullName })
    });

    setLoading('updateProfileBtn', false);

    if (result.success) {
      showResponse('updateProfileResponse', result.data, false);
      showToast('Profile updated!', 'success');
      document.getElementById('updateProfileForm').reset();
      // Refresh current user data
      if (result.data.data.user) {
        currentUser = result.data.data.user;
        updateAuthStatus();
      }
    } else {
      showResponse('updateProfileResponse', result.error, true);
      showToast('Update failed', 'error');
    }
    return false;
  }

  async function handleListSessions() {
    hideResponse('sessionsResponse');
    setLoading('sessionsBtn', true);

    const result = await apiRequest('/sessions');

    setLoading('sessionsBtn', false);

    if (result.success) {
      showResponse('sessionsResponse', result.data, false);
    } else {
      showResponse('sessionsResponse', result.error, true);
    }
  }

  async function handleSignOut() {
    hideResponse('signoutResponse');
    setLoading('signoutBtn', true);

    const result = await apiRequest('/sign-out', { method: 'POST' });

    setLoading('signoutBtn', false);

    if (result.success) {
      accessToken = null;
      refreshToken = null;
      currentUser = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      showResponse('signoutResponse', result.data, false);
      showToast('Signed out', 'success');
      updateAuthStatus();
    } else {
      showResponse('signoutResponse', result.error, true);
    }
  }

  async function handleSignOutAll() {
    hideResponse('signoutAllResponse');
    setLoading('signoutAllBtn', true);

    const result = await apiRequest('/sign-out-all', { method: 'POST' });

    setLoading('signoutAllBtn', false);

    if (result.success) {
      accessToken = null;
      refreshToken = null;
      currentUser = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      showResponse('signoutAllResponse', result.data, false);
      showToast('Signed out from all sessions', 'success');
      updateAuthStatus();
    } else {
      showResponse('signoutAllResponse', result.error, true);
    }
  }

  function copyToken() {
    if (accessToken) {
      navigator.clipboard.writeText(accessToken);
      showToast('Token copied!', 'success');
    }
  }

  function clearSession() {
    accessToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    updateAuthStatus();
    showToast('Session cleared', 'success');
  }

  // Device Management
  let selectedDevices = new Set();
  let currentDevices = [];

  async function handleLoadDevices() {
    const container = document.getElementById('devicesContainer');
    const responseEl = document.getElementById('devicesResponse');
    const btn = document.getElementById('devicesBtn');

    hideResponse('devicesResponse');
    setLoading('devicesBtn', true);
    selectedDevices.clear();

    const result = await apiRequest('/devices');

    setLoading('devicesBtn', false);

    if (result.success) {
      currentDevices = result.data.data;
      renderDevices(currentDevices);
      showResponse('devicesResponse', { message: `Loaded ${currentDevices.length} device(s)` }, false);
    } else {
      container.innerHTML = '<div class="empty-state">Failed to load devices</div>';
      showResponse('devicesResponse', result.error, true);
    }
  }

  function renderDevices(devices) {
    const container = document.getElementById('devicesContainer');

    if (devices.length === 0) {
      container.innerHTML = '<div class="empty-state">No active devices found</div>';
      return;
    }

    let html = '<div class="device-list">';
    devices.forEach(device => {
      const isCurrent = device.isCurrent;
      const deviceId = device.id;
      const userAgent = device.deviceInfo || 'Unknown Device';
      const deviceName = parseDeviceName(userAgent);
      const lastUsed = new Date(device.lastUsedAt).toLocaleString();
      const created = new Date(device.createdAt).toLocaleDateString();
      const location = device.country || 'Unknown Location';
      const ip = device.ipAddress || 'Unknown IP';

      html += `
        <div class="device-item ${isCurrent ? 'current' : ''}" data-device-id="${deviceId}">
          <input type="checkbox" class="device-checkbox" value="${deviceId}" data-action="select-device"
            ${isCurrent ? 'disabled title="Cannot terminate current session"' : ''}>
          <div class="device-info">
            <h4>${escapeHtml(deviceName)}${isCurrent ? '<span class="badge-current">Current</span>' : ''}</h4>
            <p><strong>Location:</strong> ${escapeHtml(location)} | <strong>IP:</strong> ${escapeHtml(ip)}</p>
            <p><strong>Last Used:</strong> ${lastUsed} | <strong>Created:</strong> ${created}</p>
          </div>
        </div>
      `;
    });
    html += '</div>';

    html += `
      <div class="device-actions">
        <button type="button" class="btn-danger" data-action="terminate-selected" id="terminateBtn">
          Terminate Selected
        </button>
        <button type="button" class="btn-secondary" data-action="select-all">
          Select All (except current)
        </button>
        <button type="button" class="btn-secondary" data-action="deselect-all">
          Deselect All
        </button>
      </div>
    `;

    container.innerHTML = html;
    attachDeviceEventListeners();
  }

  function attachDeviceEventListeners() {
    const container = document.getElementById('devicesContainer');

    // Event delegation for all device-related actions
    container.addEventListener('change', function(e) {
      if (e.target.matches('[data-action="select-device"]')) {
        const deviceId = e.target.value;
        const deviceItem = e.target.closest('.device-item');

        if (e.target.checked) {
          selectedDevices.add(deviceId);
          deviceItem.classList.add('selected');
        } else {
          selectedDevices.delete(deviceId);
          deviceItem.classList.remove('selected');
        }
        updateTerminateButton();
      }
    });

    container.addEventListener('click', function(e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      if (action === 'terminate-selected') {
        handleTerminateSelected();
      } else if (action === 'select-all') {
        handleSelectAll();
      } else if (action === 'deselect-all') {
        handleDeselectAll();
      }
    });
  }

  function parseDeviceName(userAgent) {
    if (!userAgent || userAgent === 'unknown') return 'Unknown Device';

    // Try to extract browser and OS info
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'Mac';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleSelectAll() {
    const checkboxes = document.querySelectorAll('.device-checkbox:not(:disabled)');
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedDevices.add(cb.value);
      cb.closest('.device-item').classList.add('selected');
    });
    updateTerminateButton();
  }

  function handleDeselectAll() {
    const checkboxes = document.querySelectorAll('.device-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
      selectedDevices.delete(cb.value);
      cb.closest('.device-item').classList.remove('selected');
    });
    updateTerminateButton();
  }

  function updateTerminateButton() {
    const btn = document.getElementById('terminateBtn');
    if (btn) {
      btn.textContent = selectedDevices.size > 0
        ? `Terminate Selected (${selectedDevices.size})`
        : 'Terminate Selected';
      btn.disabled = selectedDevices.size === 0;
    }
  }

  async function handleTerminateSelected() {
    if (selectedDevices.size === 0) {
      showToast('No devices selected', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to terminate ${selectedDevices.size} device(s)?`)) {
      return;
    }

    const btn = document.getElementById('terminateBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>Terminating...</span>';

    const result = await apiRequest('/devices/terminate', {
      method: 'POST',
      body: JSON.stringify({
        deviceIds: Array.from(selectedDevices),
        reason: 'User terminated from web interface'
      })
    });

    if (result.success) {
      showToast(result.data.message, 'success');
      showResponse('devicesResponse', result.data, false);
      // Reload the device list
      handleLoadDevices();
    } else {
      showResponse('devicesResponse', result.error, true);
      showToast(result.error.message || 'Termination failed', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Terminate Selected';
    }
  }

  // ── OAuth ────────────────────────────────────────────────────────────────────

  async function handleOAuthSignIn(provider) {
    hideResponse('oauthResponse');
    setLoading(provider + 'SignInBtn', true);

    // Get the OAuth URL from backend
    const result = await apiRequest('/oauth/' + provider);

    setLoading(provider + 'SignInBtn', false);

    if (!result.success) {
      showResponse('oauthResponse', result.error, true);
      showToast(result.error.message || provider + ' sign in failed', 'error');
      return;
    }

    // Redirect to OAuth provider
    window.location.href = result.data.data.authUrl;
  }

  function checkOAuthCallback() {
    // Check if we have OAuth callback params in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const provider = urlParams.get('provider');
    const accessTokenParam = urlParams.get('access_token');
    const refreshTokenParam = urlParams.get('refresh_token');
    const userId = urlParams.get('user_id');

    if (oauthSuccess === 'true' && accessTokenParam && refreshTokenParam) {
      // Clear OAuth params from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Store tokens
      accessToken = accessTokenParam;
      refreshToken = refreshTokenParam;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      showResponse('oauthResponse', { message: 'Signed in with ' + provider + '!', userId: userId }, false);
      showToast('Welcome! Signed in with ' + provider, 'success');
      updateAuthStatus();
      handleGetMe();
      return;
    }

    if (oauthError) {
      // Clear OAuth params from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      showResponse('oauthResponse', { message: 'OAuth error: ' + oauthError }, true);
      showToast('Sign in failed: ' + oauthError, 'error');
    }
  }
})();
