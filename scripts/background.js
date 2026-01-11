// Background Service Worker for Mail Tracker

// Import configuration
importScripts('config.js');

// Debug mode
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('%c[Mail Tracker BG]', 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
  }
}

function error(...args) {
  console.error('%c[Mail Tracker BG ERROR]', 'background: #f44336; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
}

log('🚀 Background service worker starting...');

// Default API URL (from config.js)
const DEFAULT_API_URL = CONFIG.DEFAULT_API_URL;

// Get API URL from storage
async function getApiUrl() {
  const result = await chrome.storage.sync.get(['apiUrl']);
  const url = result.apiUrl || DEFAULT_API_URL;
  log('API URL:', url);
  return url;
}

// Check if tracking is enabled
async function isTrackingEnabled() {
  const result = await chrome.storage.sync.get(['trackingEnabled']);
  const enabled = result.trackingEnabled !== false; // Default to true
  log('Tracking enabled:', enabled);
  return enabled;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('📨 Received message:', message.type);

  if (message.type === 'REGISTER_EMAIL') {
    log('Registering email:', message.data);
    handleRegisterEmail(message.data)
      .then(response => {
        log('✓ Email registration successful');
        sendResponse({ success: true, data: response });
      })
      .catch(err => {
        error('❌ Email registration failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.type === 'CHECK_STATUS') {
    log('Checking status for email:', message.emailId);
    handleCheckStatus(message.emailId)
      .then(response => {
        log('✓ Status check successful');
        sendResponse({ success: true, data: response });
      })
      .catch(err => {
        error('❌ Status check failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === 'GET_TRACKED_EMAILS') {
    log('Getting all tracked emails');
    handleGetTrackedEmails()
      .then(response => {
        log(`✓ Found ${Object.keys(response).length} tracked email(s)`);
        sendResponse({ success: true, data: response });
      })
      .catch(err => {
        error('❌ Failed to get tracked emails:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  error('Unknown message type:', message.type);
  return false;
});

/**
 * Register a new tracked email
 */
async function handleRegisterEmail(emailData) {
  // Check if tracking is enabled
  const trackingEnabled = await isTrackingEnabled();
  if (!trackingEnabled) {
    log('⚠️ Tracking is disabled, skipping email registration');
    return { success: false, message: 'Tracking is disabled' };
  }

  const apiUrl = await getApiUrl();
  const { id, recipient, subject, body } = emailData;

  log(`📤 Sending registration to API: ${apiUrl}/email/register`);
  log('Email details:', { id, recipient, subject, bodyLength: body?.length || 0 });

  try {
    const response = await fetch(`${apiUrl}/email/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ id, recipient, subject, body })
    });

    log(`API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    log('API response data:', data);

    // Store in local storage for quick access
    await saveTrackedEmail(id, {
      recipient,
      subject,
      opened: false,
      timestamp: Date.now()
    });

    log(`✓ Email ${id} registered and saved to storage`);
    return data;
  } catch (err) {
    error('❌ Error registering email:', err);
    error('API URL:', apiUrl);
    error('Is the server running?');
    throw err;
  }
}

/**
 * Check status of a tracked email
 */
async function handleCheckStatus(emailId) {
  const apiUrl = await getApiUrl();

  try {
    const response = await fetch(`${apiUrl}/email/status?id=${emailId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Update local storage
    if (data.opened) {
      await updateTrackedEmailStatus(emailId, true);
    }

    return data;
  } catch (error) {
    console.error('Error checking status:', error);
    throw error;
  }
}

/**
 * Get all tracked emails from storage
 */
async function handleGetTrackedEmails() {
  const result = await chrome.storage.sync.get(['trackedEmails']);
  return result.trackedEmails || {};
}

/**
 * Save tracked email to storage
 */
async function saveTrackedEmail(emailId, emailData) {
  const result = await chrome.storage.sync.get(['trackedEmails']);
  const trackedEmails = result.trackedEmails || {};

  trackedEmails[emailId] = emailData;

  await chrome.storage.sync.set({ trackedEmails });
}

/**
 * Update email opened status
 */
async function updateTrackedEmailStatus(emailId, opened) {
  const result = await chrome.storage.sync.get(['trackedEmails']);
  const trackedEmails = result.trackedEmails || {};

  if (trackedEmails[emailId]) {
    trackedEmails[emailId].opened = opened;
    trackedEmails[emailId].openedAt = Date.now();
    await chrome.storage.sync.set({ trackedEmails });
  }
}

// Periodic status check for all tracked emails
async function checkAllEmailStatuses() {
  // Check if tracking is enabled
  const trackingEnabled = await isTrackingEnabled();
  if (!trackingEnabled) {
    log('⚠️ Tracking is disabled, skipping status check');
    return;
  }

  const trackedEmails = await handleGetTrackedEmails();
  const emailCount = Object.keys(trackedEmails).length;

  if (emailCount === 0) {
    log('No tracked emails to check');
    return;
  }

  log(`🔄 Checking status for ${emailCount} tracked email(s)...`);

  let checked = 0;
  let updated = 0;

  for (const [emailId, emailData] of Object.entries(trackedEmails)) {
    // Skip already opened emails
    if (emailData.opened) continue;

    // Skip very old emails (older than 7 days)
    const age = Date.now() - emailData.timestamp;
    if (age > 7 * 24 * 60 * 60 * 1000) continue;

    try {
      const status = await handleCheckStatus(emailId);
      checked++;
      if (status.opened) {
        log(`✓✓ Email opened: "${emailData.subject}"`);
        updated++;
      }
    } catch (err) {
      error(`Error checking status for ${emailId}:`, err);
    }
  }

  if (checked > 0) {
    log(`✓ Checked ${checked} email(s), ${updated} newly opened`);
  }
}

// Check statuses every 30 seconds
log('⏰ Setting up periodic status check (every 30s)');
setInterval(checkAllEmailStatuses, 30000);

// Initial check on startup
log('Running initial status check...');
checkAllEmailStatuses();

log('✓ Mail Tracker background service worker initialized and ready');
