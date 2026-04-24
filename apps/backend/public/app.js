(function() {
  'use strict';

  const API_BASE = '/api/v1/auth';
  const API_KEYS_API_BASE = '/api/v1/api-keys';
  const SESSIONS_API_BASE = '/api/sessions';
  const USAGE_API_BASE = '/api/usage';
  const BILLING_API_BASE = '/api/billing';
  let accessToken = localStorage.getItem('accessToken');
  let refreshToken = localStorage.getItem('refreshToken');
  let activeApiKey = localStorage.getItem('activeApiKey') || '';
  let currentUser = null;

  function generateClientMessageId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('Auth Test Interface Loaded');
    attachEventListeners();
    const activeApiKeyInput = document.getElementById('activeApiKeyInput');
    if (activeApiKeyInput && activeApiKey) {
      activeApiKeyInput.value = activeApiKey;
    }
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
        document.getElementById('sessionsTab').classList.toggle('hidden', target !== 'sessions');
        document.getElementById('usageTab').classList.toggle('hidden', target !== 'usage');
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
    document.getElementById('twoFactorStatusBtn').addEventListener('click', handleTwoFactorStatus);
    document.getElementById('twoFactorSetupBtn').addEventListener('click', handleTwoFactorSetup);
    document.getElementById('twoFactorVerifyForm').addEventListener('submit', handleTwoFactorVerifySetup);
    document.getElementById('twoFactorDisableForm').addEventListener('submit', handleTwoFactorDisable);
    document.getElementById('copyTokenBtn').addEventListener('click', copyToken);
    document.getElementById('clearSessionBtn').addEventListener('click', clearSession);
    document.getElementById('googleSignInBtn').addEventListener('click', () => handleOAuthSignIn('google'));
    document.getElementById('githubSignInBtn').addEventListener('click', () => handleOAuthSignIn('github'));

    // Chat Session Event Listeners
    document.getElementById('sessionStatsBtn').addEventListener('click', handleSessionStats);
    document.getElementById('createSessionForm').addEventListener('submit', handleCreateSession);
    document.getElementById('listSessionsForm').addEventListener('submit', handleListChatSessions);
    document.getElementById('getSessionForm').addEventListener('submit', handleGetSession);
    document.getElementById('updateSessionForm').addEventListener('submit', handleUpdateSession);
    document.getElementById('deleteSessionForm').addEventListener('submit', handleDeleteSession);
    document.getElementById('addMessageForm').addEventListener('submit', handleAddMessage);
    document.getElementById('createCheckpointForm').addEventListener('submit', handleCreateCheckpoint);
    document.getElementById('listCheckpointsForm').addEventListener('submit', handleListCheckpoints);
    document.getElementById('exportSessionForm').addEventListener('submit', handleExportSession);
    document.getElementById('importSessionForm').addEventListener('submit', handleImportSession);
    document.getElementById('deleteAllSessionsForm').addEventListener('submit', handleDeleteAllSessions);

    // New Chat Session Features
    document.getElementById('getArchivedMessagesForm').addEventListener('submit', handleGetArchivedMessages);
    document.getElementById('connectSseBtn').addEventListener('click', handleConnectSse);
    document.getElementById('disconnectSseBtn').addEventListener('click', handleDisconnectSse);

    // New Message Operations
    document.getElementById('searchMessagesForm').addEventListener('submit', handleSearchMessages);
    document.getElementById('editMessageForm').addEventListener('submit', handleEditMessage);
    document.getElementById('deleteMessageForm').addEventListener('submit', handleDeleteMessage);
    document.getElementById('acknowledgeMessagesForm').addEventListener('submit', handleAcknowledgeMessages);
    document.getElementById('usageOverviewForm').addEventListener('submit', handleUsageOverview);
    document.getElementById('usageExportForm').addEventListener('submit', handleUsageExport);
    document.getElementById('billingOverviewBtn').addEventListener('click', handleBillingOverview);
    document.getElementById('billingInvoicesForm').addEventListener('submit', handleBillingInvoices);
    document.getElementById('billingCheckoutForm').addEventListener('submit', handleBillingCheckout);
    document.getElementById('billingPortalForm').addEventListener('submit', handleBillingPortal);
    document.getElementById('billingCancelForm').addEventListener('submit', handleBillingCancelSubscription);
    document.getElementById('billingResumeBtn').addEventListener('click', handleBillingResumeSubscription);
    document.getElementById('billingWebhookProbeForm').addEventListener('submit', handleBillingWebhookProbe);
    document.getElementById('createApiKeyForm').addEventListener('submit', handleCreateApiKey);
    document.getElementById('listApiKeysBtn').addEventListener('click', handleListApiKeys);
    document.getElementById('rotateApiKeyForm').addEventListener('submit', handleRotateApiKey);
    document.getElementById('revokeApiKeyForm').addEventListener('submit', handleRevokeApiKey);
    document.getElementById('setActiveApiKeyBtn').addEventListener('click', handleSetActiveApiKey);
    document.getElementById('clearActiveApiKeyBtn').addEventListener('click', handleClearActiveApiKey);
    document.getElementById('apiKeySelfBtn').addEventListener('click', handleApiKeySelf);

    // Check for OAuth callback
    checkOAuthCallback();
  }

  // SSE Connection
  let sseSource = null;

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
      if (activeApiKey) {
        statusText.textContent += ' | API key active for sessions/usage';
      }
      authStatus.innerHTML = '<p style="color: #22c55e;"> Logged in' + (currentUser ? ' as <strong>' + currentUser.email + '</strong>' : '') + '</p>';
      tokenInfo.classList.remove('hidden');
      document.getElementById('accessTokenDisplay').textContent = accessToken;
    } else {
      indicator.classList.remove('authenticated');
      statusText.textContent = activeApiKey ? 'Not authenticated | API key active for sessions/usage' : 'Not authenticated';
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

    const twoFactorCode = document.getElementById('signinTwoFactorCode').value.trim();
    const body = {
      email: document.getElementById('signinEmail').value,
      password: document.getElementById('signinPassword').value
    };
    if (twoFactorCode) {
      body.twoFactorCode = twoFactorCode;
    }

    const result = await apiRequest('/sign-in', {
      method: 'POST',
      body: JSON.stringify(body)
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

  async function handleTwoFactorStatus() {
    hideResponse('twoFactorResponse');
    setLoading('twoFactorStatusBtn', true);

    const result = await apiRequest('/2fa/status');

    setLoading('twoFactorStatusBtn', false);

    if (result.success) {
      showResponse('twoFactorResponse', result.data, false);
      showToast('2FA status loaded', 'success');
    } else {
      showResponse('twoFactorResponse', result.error, true);
      showToast(result.error.message || 'Failed to load 2FA status', 'error');
    }
  }

  async function handleTwoFactorSetup() {
    hideResponse('twoFactorResponse');
    setLoading('twoFactorSetupBtn', true);

    const result = await apiRequest('/2fa/setup', { method: 'POST' });

    setLoading('twoFactorSetupBtn', false);

    if (result.success) {
      showResponse('twoFactorResponse', result.data, false);
      showToast('2FA setup started. Verify with authenticator code.', 'success');
    } else {
      showResponse('twoFactorResponse', result.error, true);
      showToast(result.error.message || 'Failed to start 2FA setup', 'error');
    }
  }

  async function handleTwoFactorVerifySetup(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('twoFactorResponse');
    setLoading('twoFactorVerifyBtn', true);

    const code = document.getElementById('twoFactorVerifyCode').value.trim();
    const result = await apiRequest('/2fa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ code: code })
    });

    setLoading('twoFactorVerifyBtn', false);

    if (result.success) {
      showResponse('twoFactorResponse', result.data, false);
      showToast('2FA enabled. Save backup codes.', 'success');
      document.getElementById('twoFactorVerifyForm').reset();
    } else {
      showResponse('twoFactorResponse', result.error, true);
      showToast(result.error.message || 'Failed to enable 2FA', 'error');
    }
    return false;
  }

  async function handleTwoFactorDisable(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('twoFactorResponse');
    setLoading('twoFactorDisableBtn', true);

    const code = document.getElementById('twoFactorDisableCode').value.trim();
    const result = await apiRequest('/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: code })
    });

    setLoading('twoFactorDisableBtn', false);

    if (result.success) {
      showResponse('twoFactorResponse', result.data, false);
      showToast('2FA disabled', 'success');
      document.getElementById('twoFactorDisableForm').reset();
    } else {
      showResponse('twoFactorResponse', result.error, true);
      showToast(result.error.message || 'Failed to disable 2FA', 'error');
    }
    return false;
  }

  async function handleCreateApiKey(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('apiKeysResponse');
    setLoading('createApiKeyBtn', true);

    const name = document.getElementById('apiKeyName').value.trim();
    const scopes = parseScopes(document.getElementById('apiKeyScopes').value);
    const expiresAt = document.getElementById('apiKeyExpiresAt').value.trim();
    const body = { name: name, scopes: scopes };
    if (expiresAt) {
      body.expiresAt = expiresAt;
    }

    const result = await apiKeysApiRequest('', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    setLoading('createApiKeyBtn', false);

    if (result.success) {
      const key = result.data && result.data.data && result.data.data.apiKey;
      if (key) {
        document.getElementById('activeApiKeyInput').value = key;
      }
      showResponse('apiKeysResponse', result.data, false);
      showToast('API key created. Save it now.', 'success');
      document.getElementById('createApiKeyForm').reset();
    } else {
      showResponse('apiKeysResponse', result.error, true);
      showToast(result.error.message || 'API key creation failed', 'error');
    }
    return false;
  }

  async function handleListApiKeys() {
    hideResponse('apiKeysResponse');
    setLoading('listApiKeysBtn', true);

    const result = await apiKeysApiRequest('');

    setLoading('listApiKeysBtn', false);

    if (result.success) {
      showResponse('apiKeysResponse', result.data, false);
      showToast('API keys loaded', 'success');
    } else {
      showResponse('apiKeysResponse', result.error, true);
      showToast(result.error.message || 'Failed to list API keys', 'error');
    }
  }

  async function handleRotateApiKey(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('apiKeysResponse');
    setLoading('rotateApiKeyBtn', true);

    const keyId = document.getElementById('rotateApiKeyId').value.trim();
    if (!keyId) {
      setLoading('rotateApiKeyBtn', false);
      showResponse('apiKeysResponse', { message: 'Rotate Key ID is required' }, true);
      showToast('Rotate Key ID is required', 'error');
      return false;
    }

    const result = await apiKeysApiRequest('/' + encodeURIComponent(keyId) + '/rotate', {
      method: 'POST',
      body: JSON.stringify({})
    });

    setLoading('rotateApiKeyBtn', false);

    if (result.success) {
      const key = result.data && result.data.data && result.data.data.apiKey;
      if (key) {
        document.getElementById('activeApiKeyInput').value = key;
      }
      showResponse('apiKeysResponse', result.data, false);
      showToast('API key rotated', 'success');
      document.getElementById('rotateApiKeyForm').reset();
    } else {
      showResponse('apiKeysResponse', result.error, true);
      showToast(result.error.message || 'Failed to rotate API key', 'error');
    }
    return false;
  }

  async function handleRevokeApiKey(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('apiKeysResponse');
    setLoading('revokeApiKeyBtn', true);

    const keyId = document.getElementById('revokeApiKeyId').value.trim();
    const reason = document.getElementById('revokeApiKeyReason').value.trim();
    if (!keyId) {
      setLoading('revokeApiKeyBtn', false);
      showResponse('apiKeysResponse', { message: 'Revoke Key ID is required' }, true);
      showToast('Revoke Key ID is required', 'error');
      return false;
    }

    const body = {};
    if (reason) {
      body.reason = reason;
    }

    const result = await apiKeysApiRequest('/' + encodeURIComponent(keyId), {
      method: 'DELETE',
      body: JSON.stringify(body)
    });

    setLoading('revokeApiKeyBtn', false);

    if (result.success) {
      showResponse('apiKeysResponse', result.data, false);
      showToast('API key revoked', 'success');
      document.getElementById('revokeApiKeyForm').reset();
    } else {
      showResponse('apiKeysResponse', result.error, true);
      showToast(result.error.message || 'Failed to revoke API key', 'error');
    }
    return false;
  }

  function handleSetActiveApiKey() {
    const value = document.getElementById('activeApiKeyInput').value.trim();
    activeApiKey = value;
    if (activeApiKey) {
      localStorage.setItem('activeApiKey', activeApiKey);
      showToast('Active API key set for sessions/usage', 'success');
    } else {
      localStorage.removeItem('activeApiKey');
      showToast('Active API key is empty', 'error');
    }
    updateAuthStatus();
  }

  function handleClearActiveApiKey() {
    activeApiKey = '';
    localStorage.removeItem('activeApiKey');
    document.getElementById('activeApiKeyInput').value = '';
    updateAuthStatus();
    showToast('Active API key cleared', 'success');
  }

  async function handleApiKeySelf() {
    hideResponse('apiKeysResponse');
    setLoading('apiKeySelfBtn', true);

    const value = document.getElementById('activeApiKeyInput').value.trim();
    if (value && value !== activeApiKey) {
      activeApiKey = value;
    }

    if (!activeApiKey) {
      setLoading('apiKeySelfBtn', false);
      showResponse('apiKeysResponse', { message: 'Set an API key first' }, true);
      showToast('Set an API key first', 'error');
      return;
    }

    const result = await apiKeysApiRequest('/self', { authMode: 'api-key' });

    setLoading('apiKeySelfBtn', false);

    if (result.success) {
      showResponse('apiKeysResponse', result.data, false);
      showToast('API key is valid', 'success');
    } else {
      showResponse('apiKeysResponse', result.error, true);
      showToast(result.error.message || 'API key self-check failed', 'error');
    }
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

  // ── Chat Sessions API ────────────────────────────────────────────────────────

  async function sessionsApiRequest(endpoint, options = {}) {
    const url = SESSIONS_API_BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      method: options.method || 'GET'
    };

    if (options.body) config.body = options.body;
    applyAuthHeaders(config, options.authMode || 'jwt-or-api-key');

    try {
      const response = await fetch(url, config);

      // Handle blob responses (for file downloads)
      if (options.responseType === 'blob') {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          return { success: false, error: { status: response.status, ...data } };
        }
        const blob = await response.blob();
        return { success: true, blob, filename: endpoint };
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return { success: false, error: { status: response.status, ...data } };
      }
      return { success: true, data: data };
    } catch (err) {
      return { success: false, error: { message: 'Network error. Is server running?' } };
    }
  }

  async function usageApiRequest(endpoint, options = {}) {
    const url = USAGE_API_BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      method: options.method || 'GET'
    };

    if (options.body) config.body = options.body;
    applyAuthHeaders(config, options.authMode || 'jwt-or-api-key');

    try {
      const response = await fetch(url, config);

      if (options.responseType === 'blob') {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          return { success: false, error: { status: response.status, ...data } };
        }

        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const filenameMatch = disposition.match(/filename="([^"]+)"/i);
        const filename = filenameMatch && filenameMatch[1] ? filenameMatch[1] : 'usage-report';

        return { success: true, blob, filename: filename };
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { success: false, error: { status: response.status, ...data } };
      }
      return { success: true, data: data };
    } catch (err) {
      return { success: false, error: { message: 'Network error. Is server running?' } };
    }
  }

  async function billingApiRequest(endpoint, options = {}) {
    const url = BILLING_API_BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      method: options.method || 'GET'
    };

    if (options.body) config.body = options.body;
    applyAuthHeaders(config, options.authMode || 'jwt');

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

  function applyAuthHeaders(config, mode) {
    if (mode === 'api-key') {
      if (activeApiKey) {
        config.headers['X-API-Key'] = activeApiKey;
      }
      return;
    }

    if (mode === 'jwt-or-api-key') {
      if (activeApiKey) {
        config.headers['X-API-Key'] = activeApiKey;
        return;
      }
      if (accessToken) {
        config.headers['Authorization'] = 'Bearer ' + accessToken;
      }
      return;
    }

    if (accessToken) {
      config.headers['Authorization'] = 'Bearer ' + accessToken;
    }
  }

  async function apiKeysApiRequest(endpoint, options = {}) {
    const url = API_KEYS_API_BASE + endpoint;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      method: options.method || 'GET'
    };

    if (options.body) config.body = options.body;
    applyAuthHeaders(config, options.authMode || 'jwt');

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return { success: false, error: { status: response.status, ...data } };
      }
      return { success: true, data: data };
    } catch (_err) {
      return { success: false, error: { message: 'Network error. Is server running?' } };
    }
  }

  function parseScopes(rawScopes) {
    return rawScopes
      .split(',')
      .map(scope => scope.trim())
      .filter(scope => scope.length > 0);
  }

  async function handleSessionStats() {
    hideResponse('sessionStatsResponse');
    setLoading('sessionStatsBtn', true);

    const result = await sessionsApiRequest('/stats');

    setLoading('sessionStatsBtn', false);

    if (result.success) {
      showResponse('sessionStatsResponse', result.data, false);
    } else {
      showResponse('sessionStatsResponse', result.error, true);
    }
  }

  async function handleCreateSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('createSessionResponse');
    setLoading('createSessionBtn', true);

    const result = await sessionsApiRequest('', {
      method: 'POST',
      body: JSON.stringify({
        working_directory: document.getElementById('sessionWorkingDir').value,
        model: document.getElementById('sessionModel').value
      })
    });

    setLoading('createSessionBtn', false);

    if (result.success) {
      showResponse('createSessionResponse', result.data, false);
      showToast('Session created!', 'success');
      document.getElementById('createSessionForm').reset();
    } else {
      showResponse('createSessionResponse', result.error, true);
      showToast(result.error.message || 'Failed to create session', 'error');
    }
    return false;
  }

  async function handleListChatSessions(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('listSessionsResponse');
    setLoading('listSessionsBtn', true);

    const page = document.getElementById('listSessionsPage').value;
    const limit = document.getElementById('listSessionsLimit').value;
    const includeArchived = document.getElementById('listSessionsIncludeArchived').checked;

    let endpoint = `?page=${page}&limit=${limit}`;
    if (includeArchived) endpoint += '&include_archived=true';

    const result = await sessionsApiRequest(endpoint);

    setLoading('listSessionsBtn', false);

    if (result.success) {
      showResponse('listSessionsResponse', result.data, false);
    } else {
      showResponse('listSessionsResponse', result.error, true);
    }
    return false;
  }

  async function handleGetSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('getSessionResponse');
    setLoading('getSessionBtn', true);

    const sessionId = document.getElementById('getSessionId').value.trim();
    const page = document.getElementById('getSessionPage').value;
    const limit = document.getElementById('getSessionLimit').value;

    let endpoint = '/' + sessionId;
    if (page || limit) {
      endpoint += '?page=' + (page || 1) + '&limit=' + (limit || 50);
    }

    const result = await sessionsApiRequest(endpoint);

    setLoading('getSessionBtn', false);

    if (result.success) {
      showResponse('getSessionResponse', result.data, false);
    } else {
      showResponse('getSessionResponse', result.error, true);
    }
    return false;
  }

  async function handleUpdateSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('updateSessionResponse');
    setLoading('updateSessionBtn', true);

    const sessionId = document.getElementById('updateSessionId').value.trim();
    const name = document.getElementById('updateSessionName').value.trim();
    const isArchived = document.getElementById('updateSessionArchive').checked;

    const body = {};
    if (name) body.name = name;
    body.is_archived = isArchived;

    const result = await sessionsApiRequest('/' + sessionId, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });

    setLoading('updateSessionBtn', false);

    if (result.success) {
      showResponse('updateSessionResponse', result.data, false);
      showToast('Session updated!', 'success');
    } else {
      showResponse('updateSessionResponse', result.error, true);
    }
    return false;
  }

  async function handleDeleteSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('deleteSessionResponse');

    const sessionId = document.getElementById('deleteSessionId').value.trim();
    if (!confirm('Are you sure you want to delete this session?')) {
      return false;
    }

    setLoading('deleteSessionBtn', true);

    const result = await sessionsApiRequest('/' + sessionId, {
      method: 'DELETE'
    });

    setLoading('deleteSessionBtn', false);

    if (result.success) {
      showResponse('deleteSessionResponse', result.data, false);
      showToast('Session deleted!', 'success');
      document.getElementById('deleteSessionForm').reset();
    } else {
      showResponse('deleteSessionResponse', result.error, true);
    }
    return false;
  }

  async function handleAddMessage(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('addMessageResponse');
    setLoading('addMessageBtn', true);

    const sessionId = document.getElementById('addMessageSessionId').value.trim();
    const clientMessageIdInput = document.getElementById('addMessageClientId');
    const clientMessageId = clientMessageIdInput.value.trim() || generateClientMessageId();
    const body = {
      role: document.getElementById('addMessageRole').value,
      content: document.getElementById('addMessageContent').value,
      client_message_id: clientMessageId
    };

    const inputTokens = document.getElementById('addMessageInputTokens').value;
    const outputTokens = document.getElementById('addMessageOutputTokens').value;

    if (inputTokens || outputTokens) {
      body.token_usage = {};
      if (inputTokens) body.token_usage.input_tokens = parseInt(inputTokens);
      if (outputTokens) body.token_usage.output_tokens = parseInt(outputTokens);
    }

    const result = await sessionsApiRequest('/' + sessionId + '/messages', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    setLoading('addMessageBtn', false);

    if (result.success) {
      showResponse('addMessageResponse', result.data, false);
      showToast('Message added!', 'success');
      document.getElementById('addMessageForm').reset();
      clientMessageIdInput.value = '';
    } else {
      showResponse('addMessageResponse', result.error, true);
    }
    return false;
  }

  async function handleCreateCheckpoint(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('createCheckpointResponse');
    setLoading('createCheckpointBtn', true);

    const sessionId = document.getElementById('checkpointSessionId').value.trim();
    const result = await sessionsApiRequest('/' + sessionId + '/checkpoints', {
      method: 'POST',
      body: JSON.stringify({
        snapshot: document.getElementById('checkpointSnapshot').value
      })
    });

    setLoading('createCheckpointBtn', false);

    if (result.success) {
      showResponse('createCheckpointResponse', result.data, false);
      showToast('Checkpoint created!', 'success');
      document.getElementById('createCheckpointForm').reset();
    } else {
      showResponse('createCheckpointResponse', result.error, true);
    }
    return false;
  }

  async function handleListCheckpoints(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('listCheckpointsResponse');
    setLoading('listCheckpointsBtn', true);

    const sessionId = document.getElementById('listCheckpointsSessionId').value.trim();
    const result = await sessionsApiRequest('/' + sessionId + '/checkpoints');

    setLoading('listCheckpointsBtn', false);

    if (result.success) {
      showResponse('listCheckpointsResponse', result.data, false);
    } else {
      showResponse('listCheckpointsResponse', result.error, true);
    }
    return false;
  }

  async function handleExportSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('exportSessionResponse');
    setLoading('exportSessionBtn', true);

    const sessionId = document.getElementById('exportSessionId').value.trim();
    const format = document.getElementById('exportSessionFormat').value;

    const result = await sessionsApiRequest('/' + sessionId + '/export?format=' + format, {
      responseType: 'blob'
    });

    setLoading('exportSessionBtn', false);

    if (result.success) {
      // Create download link
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'session-' + sessionId + '.' + (format === 'json' ? 'json' : 'md');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showResponse('exportSessionResponse', { message: 'Session exported and downloaded!' }, false);
      showToast('Export downloaded!', 'success');
    } else {
      showResponse('exportSessionResponse', result.error, true);
    }
    return false;
  }

  async function handleImportSession(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('importSessionResponse');
    setLoading('importSessionBtn', true);

    try {
      const sessionData = JSON.parse(document.getElementById('importSessionData').value);
      const result = await sessionsApiRequest('/import', {
        method: 'POST',
        body: JSON.stringify({ session_data: sessionData })
      });

      setLoading('importSessionBtn', false);

      if (result.success) {
        showResponse('importSessionResponse', result.data, false);
        showToast('Session imported!', 'success');
        document.getElementById('importSessionForm').reset();
      } else {
        showResponse('importSessionResponse', result.error, true);
      }
    } catch (err) {
      setLoading('importSessionBtn', false);
      showResponse('importSessionResponse', { message: 'Invalid JSON: ' + err.message }, true);
    }
    return false;
  }

  async function handleDeleteAllSessions(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('deleteAllSessionsResponse');

    if (!confirm('Are you sure you want to delete ALL sessions? This cannot be undone!')) {
      return false;
    }

    setLoading('deleteAllSessionsBtn', true);

    const result = await sessionsApiRequest('?confirm=true', {
      method: 'DELETE'
    });

    setLoading('deleteAllSessionsBtn', false);

    if (result.success) {
      showResponse('deleteAllSessionsResponse', result.data, false);
      showToast('All sessions deleted!', 'success');
      document.getElementById('deleteAllSessionsForm').reset();
    } else {
      showResponse('deleteAllSessionsResponse', result.error, true);
    }
    return false;
  }

  async function handleGetArchivedMessages(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('getArchivedMessagesResponse');
    setLoading('getArchivedMessagesBtn', true);

    const sessionId = document.getElementById('archivedMessagesSessionId').value.trim();
    const result = await sessionsApiRequest('/' + sessionId + '/archives');

    setLoading('getArchivedMessagesBtn', false);

    if (result.success) {
      showResponse('getArchivedMessagesResponse', result.data, false);
    } else {
      showResponse('getArchivedMessagesResponse', result.error, true);
    }
    return false;
  }

  function handleConnectSse() {
    if (sseSource) {
      showToast('Already connected to stream', 'error');
      return;
    }

    if (!accessToken) {
      showToast('Please sign in first', 'error');
      return;
    }

    const sessionId = document.getElementById('sseSessionId').value.trim();
    const eventsContainer = document.getElementById('sseEvents');
    const statusEl = document.getElementById('sseStatus');

    eventsContainer.classList.remove('hidden');

    // SSE doesn't support custom headers, so we pass the token as a query parameter
    let url = SESSIONS_API_BASE + '/stream?token=' + encodeURIComponent(accessToken);
    if (sessionId) {
      url += '&session_id=' + encodeURIComponent(sessionId);
    }

    try {
      sseSource = new EventSource(url, {
        withCredentials: true
      });

      sseSource.onopen = function() {
        statusEl.textContent = 'Status: Connected';
        statusEl.style.color = '#22c55e';
        document.getElementById('connectSseBtn').disabled = true;
        document.getElementById('disconnectSseBtn').disabled = false;
        showToast('Connected to SSE stream', 'success');
      };

      sseSource.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          const eventEl = document.createElement('div');
          eventEl.style.marginBottom = '8px';
          eventEl.style.borderLeft = '2px solid #22d3ee';
          eventEl.style.paddingLeft = '8px';
          eventEl.innerHTML = '<span style="color: #71717a;">' + new Date().toLocaleTimeString() + '</span> ' +
            '<span style="color: #22d3ee;">' + (data.type || 'message') + '</span>: ' +
            JSON.stringify(data);
          eventsContainer.appendChild(eventEl);
          eventsContainer.scrollTop = eventsContainer.scrollHeight;
        } catch (err) {
          // Handle non-JSON messages (like heartbeats)
          if (event.data !== ':heartbeat') {
            const eventEl = document.createElement('div');
            eventEl.style.marginBottom = '8px';
            eventEl.style.color = '#71717a';
            eventEl.textContent = new Date().toLocaleTimeString() + ' - ' + event.data;
            eventsContainer.appendChild(eventEl);
            eventsContainer.scrollTop = eventsContainer.scrollHeight;
          }
        }
      };

      sseSource.onerror = function() {
        statusEl.textContent = 'Status: Error - Check authentication';
        statusEl.style.color = '#ef4444';
        handleDisconnectSse();
        showToast('SSE connection error', 'error');
      };
    } catch (err) {
      statusEl.textContent = 'Status: Failed - ' + err.message;
      statusEl.style.color = '#ef4444';
      showToast('Failed to connect: ' + err.message, 'error');
    }
  }

  function handleDisconnectSse() {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }

    const statusEl = document.getElementById('sseStatus');
    statusEl.textContent = 'Status: Disconnected';
    statusEl.style.color = '#71717a';

    document.getElementById('connectSseBtn').disabled = false;
    document.getElementById('disconnectSseBtn').disabled = true;

    showToast('Disconnected from stream', 'success');
  }

  // ── New Message Operations ───────────────────────────────────────────────────

  async function handleSearchMessages(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('searchMessagesResponse');
    setLoading('searchMessagesBtn', true);

    const query = document.getElementById('searchQuery').value.trim();
    const sessionId = document.getElementById('searchSessionId').value.trim();
    const page = document.getElementById('searchPage').value;
    const limit = document.getElementById('searchLimit').value;

    let endpoint = '/search?q=' + encodeURIComponent(query) + '&page=' + page + '&limit=' + limit;
    if (sessionId) {
      endpoint += '&session_id=' + encodeURIComponent(sessionId);
    }

    const result = await sessionsApiRequest(endpoint);

    setLoading('searchMessagesBtn', false);

    if (result.success) {
      showResponse('searchMessagesResponse', result.data, false);
      showToast('Search completed!', 'success');
    } else {
      showResponse('searchMessagesResponse', result.error, true);
      showToast(result.error.message || 'Search failed', 'error');
    }
    return false;
  }

  async function handleEditMessage(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('editMessageResponse');
    setLoading('editMessageBtn', true);

    const sessionId = document.getElementById('editMessageSessionId').value.trim();
    const messageId = document.getElementById('editMessageId').value.trim();
    const content = document.getElementById('editMessageContent').value;

    if (!sessionId) {
      setLoading('editMessageBtn', false);
      showResponse('editMessageResponse', { message: 'Session ID is required' }, true);
      showToast('Session ID is required', 'error');
      return false;
    }

    if (!messageId) {
      setLoading('editMessageBtn', false);
      showResponse('editMessageResponse', { message: 'Message ID is required' }, true);
      showToast('Message ID is required', 'error');
      return false;
    }

    const result = await sessionsApiRequest('/' + sessionId + '/messages/' + messageId, {
      method: 'PATCH',
      body: JSON.stringify({ content })
    });

    setLoading('editMessageBtn', false);

    if (result.success) {
      showResponse('editMessageResponse', result.data, false);
      showToast('Message edited!', 'success');
      document.getElementById('editMessageForm').reset();
    } else {
      showResponse('editMessageResponse', result.error, true);
      showToast(result.error.message || 'Edit failed', 'error');
    }
    return false;
  }

  async function handleDeleteMessage(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('deleteMessageResponse');

    const sessionId = document.getElementById('deleteMessageSessionId').value.trim();
    const messageId = document.getElementById('deleteMessageId').value.trim();

    if (!sessionId) {
      showResponse('deleteMessageResponse', { message: 'Session ID is required' }, true);
      showToast('Session ID is required', 'error');
      return false;
    }

    if (!messageId) {
      showResponse('deleteMessageResponse', { message: 'Message ID is required' }, true);
      showToast('Message ID is required', 'error');
      return false;
    }

    if (!confirm('Are you sure you want to delete this message?')) {
      return false;
    }

    setLoading('deleteMessageBtn', true);

    const result = await sessionsApiRequest('/' + sessionId + '/messages/' + messageId, {
      method: 'DELETE'
    });

    setLoading('deleteMessageBtn', false);

    if (result.success) {
      showResponse('deleteMessageResponse', result.data, false);
      showToast('Message deleted!', 'success');
      document.getElementById('deleteMessageForm').reset();
    } else {
      showResponse('deleteMessageResponse', result.error, true);
      showToast(result.error.message || 'Delete failed', 'error');
    }
    return false;
  }

  async function handleAcknowledgeMessages(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('acknowledgeMessagesResponse');
    setLoading('acknowledgeMessagesBtn', true);

    const sessionId = document.getElementById('ackSessionId').value.trim();
    const messageIdsStr = document.getElementById('ackMessageIds').value.trim();
    const messageIds = messageIdsStr.split(',').map(id => id.trim()).filter(id => id);

    const result = await sessionsApiRequest('/' + sessionId + '/messages/acknowledge', {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds })
    });

    setLoading('acknowledgeMessagesBtn', false);

    if (result.success) {
      showResponse('acknowledgeMessagesResponse', result.data, false);
      showToast('Messages acknowledged!', 'success');
      document.getElementById('acknowledgeMessagesForm').reset();
    } else {
      showResponse('acknowledgeMessagesResponse', result.error, true);
      showToast(result.error.message || 'Acknowledgment failed', 'error');
    }
    return false;
  }

  async function handleUsageOverview(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('usageOverviewResponse');
    setLoading('usageOverviewBtn', true);

    const range = document.getElementById('usageOverviewRange').value;
    const result = await usageApiRequest('/overview?range=' + encodeURIComponent(range));

    setLoading('usageOverviewBtn', false);

    if (result.success) {
      showResponse('usageOverviewResponse', result.data, false);
      showToast('Usage overview loaded', 'success');
    } else {
      showResponse('usageOverviewResponse', result.error, true);
      showToast(result.error.message || 'Failed to load usage overview', 'error');
    }
    return false;
  }

  async function handleUsageExport(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('usageExportResponse');
    setLoading('usageExportBtn', true);

    const range = document.getElementById('usageExportRange').value;
    const format = document.getElementById('usageExportFormat').value;
    const result = await usageApiRequest(
      '/export?range=' + encodeURIComponent(range) + '&format=' + encodeURIComponent(format),
      { responseType: 'blob' }
    );

    setLoading('usageExportBtn', false);

    if (result.success) {
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || ('usage-report.' + format);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showResponse('usageExportResponse', { message: 'Usage report exported and downloaded.' }, false);
      showToast('Usage report downloaded', 'success');
    } else {
      showResponse('usageExportResponse', result.error, true);
      showToast(result.error.message || 'Failed to export usage report', 'error');
    }
    return false;
  }

  function getBillingErrorMessage(error, fallbackMessage) {
    const code = error && error.code;
    if (code === 'INVALID_BILLING_URL') {
      return 'URL origin is not allowlisted for billing redirects';
    }
    if (code === 'ACTIVE_SUBSCRIPTION_EXISTS') {
      return 'An active subscription already exists. Use the billing portal';
    }
    if (code === 'PLAN_NOT_CHECKOUT_ENABLED') {
      return 'Selected plan is not available for direct checkout';
    }
    if (code === 'BILLING_NOT_CONFIGURED') {
      return 'Billing is not configured in this environment';
    }
    if (code === 'INVALID_STRIPE_WEBHOOK_BODY') {
      return 'Webhook body must be raw application/json';
    }
    if (code === 'INVALID_STRIPE_SIGNATURE') {
      return 'Invalid Stripe signature for webhook payload';
    }
    return (error && error.message) || fallbackMessage;
  }

  async function handleBillingOverview() {
    hideResponse('billingOverviewResponse');
    setLoading('billingOverviewBtn', true);

    const result = await billingApiRequest('/overview');

    setLoading('billingOverviewBtn', false);

    if (result.success) {
      showResponse('billingOverviewResponse', result.data, false);
      showToast('Billing overview loaded', 'success');
    } else {
      showResponse('billingOverviewResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to load billing overview'), 'error');
    }
  }

  async function handleBillingInvoices(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('billingInvoicesResponse');
    setLoading('billingInvoicesBtn', true);

    const limit = document.getElementById('billingInvoicesLimit').value || '20';
    const result = await billingApiRequest('/invoices?limit=' + encodeURIComponent(limit));

    setLoading('billingInvoicesBtn', false);

    if (result.success) {
      showResponse('billingInvoicesResponse', result.data, false);
      showToast('Billing invoices loaded', 'success');
    } else {
      showResponse('billingInvoicesResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to load billing invoices'), 'error');
    }
    return false;
  }

  async function handleBillingCheckout(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('billingCheckoutResponse');
    setLoading('billingCheckoutBtn', true);

    const body = {
      planId: document.getElementById('billingCheckoutPlan').value,
      billingCycle: document.getElementById('billingCheckoutCycle').value
    };

    const successUrl = document.getElementById('billingCheckoutSuccessUrl').value.trim();
    const cancelUrl = document.getElementById('billingCheckoutCancelUrl').value.trim();
    if (successUrl) body.successUrl = successUrl;
    if (cancelUrl) body.cancelUrl = cancelUrl;

    const result = await billingApiRequest('/checkout-session', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    setLoading('billingCheckoutBtn', false);

    if (result.success) {
      const checkoutUrl = result.data && result.data.data && result.data.data.checkoutUrl;
      showResponse('billingCheckoutResponse', result.data, false);
      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
      showToast('Checkout session created', 'success');
    } else {
      showResponse('billingCheckoutResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to create checkout session'), 'error');
    }
    return false;
  }

  async function handleBillingPortal(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('billingPortalResponse');
    setLoading('billingPortalBtn', true);

    const returnUrl = document.getElementById('billingPortalReturnUrl').value.trim();
    const body = {};
    if (returnUrl) body.returnUrl = returnUrl;

    const result = await billingApiRequest('/portal-session', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    setLoading('billingPortalBtn', false);

    if (result.success) {
      const portalUrl = result.data && result.data.data && result.data.data.portalUrl;
      showResponse('billingPortalResponse', result.data, false);
      if (portalUrl) {
        window.open(portalUrl, '_blank', 'noopener,noreferrer');
      }
      showToast('Portal session created', 'success');
    } else {
      showResponse('billingPortalResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to create portal session'), 'error');
    }
    return false;
  }

  async function handleBillingCancelSubscription(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('billingCancelResponse');
    setLoading('billingCancelBtn', true);

    const atPeriodEnd = document.getElementById('billingCancelAtPeriodEnd').checked;
    const result = await billingApiRequest('/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ atPeriodEnd: atPeriodEnd })
    });

    setLoading('billingCancelBtn', false);

    if (result.success) {
      showResponse('billingCancelResponse', result.data, false);
      showToast('Subscription cancellation updated', 'success');
    } else {
      showResponse('billingCancelResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to cancel subscription'), 'error');
    }
    return false;
  }

  async function handleBillingResumeSubscription() {
    hideResponse('billingResumeResponse');
    setLoading('billingResumeBtn', true);

    const result = await billingApiRequest('/subscription/resume', {
      method: 'POST'
    });

    setLoading('billingResumeBtn', false);

    if (result.success) {
      showResponse('billingResumeResponse', result.data, false);
      showToast('Subscription resumed', 'success');
    } else {
      showResponse('billingResumeResponse', result.error, true);
      showToast(getBillingErrorMessage(result.error, 'Failed to resume subscription'), 'error');
    }
  }

  async function handleBillingWebhookProbe(e) {
    e.preventDefault();
    e.stopPropagation();
    hideResponse('billingWebhookProbeResponse');
    setLoading('billingWebhookProbeBtn', true);

    const signature = document.getElementById('billingWebhookSignature').value.trim();
    const contentType = document.getElementById('billingWebhookContentType').value;
    const payload = document.getElementById('billingWebhookPayload').value;
    const headers = {
      'Content-Type': contentType
    };
    if (signature) {
      headers['Stripe-Signature'] = signature;
    }

    try {
      const response = await fetch('/api/billing/webhooks/stripe', {
        method: 'POST',
        headers: headers,
        body: payload
      });
      const data = await response.json().catch(() => null);
      setLoading('billingWebhookProbeBtn', false);

      if (!response.ok) {
        const error = { status: response.status, ...(data || {}) };
        showResponse('billingWebhookProbeResponse', error, true);
        showToast(getBillingErrorMessage(error, 'Webhook probe failed'), 'error');
        return false;
      }

      showResponse('billingWebhookProbeResponse', data, false);
      showToast('Webhook probe accepted', 'success');
      return false;
    } catch (_error) {
      setLoading('billingWebhookProbeBtn', false);
      const networkError = { message: 'Network error. Is server running?' };
      showResponse('billingWebhookProbeResponse', networkError, true);
      showToast(networkError.message, 'error');
      return false;
    }
  }
})();

