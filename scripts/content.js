// Content Script for Gmail - Mail Tracker

// Debug mode
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('%c[Mail Tracker]', 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
  }
}

function error(...args) {
  console.error('%c[Mail Tracker ERROR]', 'background: #f44336; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
}

log('✓ Content script loaded successfully');
log('Current URL:', window.location.href);
log('Document state:', document.readyState);

// API URL (will be fetched from storage or use default from config.js)
let API_URL = CONFIG.DEFAULT_API_URL;
let TRACKING_ENABLED = true; // Default to true

// Load API URL and tracking state from storage
chrome.storage.sync.get(['apiUrl', 'trackingEnabled'], (result) => {
  if (result.apiUrl) {
    API_URL = result.apiUrl;
    log('✓ API URL loaded from storage:', API_URL);
  } else {
    log('Using default API URL from config.js:', API_URL);
  }

  TRACKING_ENABLED = result.trackingEnabled !== false;
  log('✓ Tracking enabled:', TRACKING_ENABLED);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.apiUrl) {
    API_URL = changes.apiUrl.newValue;
    log('API URL updated:', API_URL);
  }

  if (changes.trackingEnabled) {
    TRACKING_ENABLED = changes.trackingEnabled.newValue !== false;
    log('Tracking state updated:', TRACKING_ENABLED);
  }
});

/**
 * Generate a unique ID for tracking
 */
function generateEmailId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Inject tracking pixel into email body
 */
function injectTrackingPixel(emailId) {
  const pixelUrl = `${API_URL}/track/open?id=${emailId}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
}

/**
 * Monitor Gmail compose area for send button clicks
 */
function monitorGmailCompose() {
  log('📧 Starting to monitor Gmail compose area...');

  let composeCount = 0;

  // Use MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    // Look for compose windows
    const composeWindows = document.querySelectorAll('[role="dialog"]');

    if (composeWindows.length > 0 && composeCount !== composeWindows.length) {
      composeCount = composeWindows.length;
      log(`Found ${composeWindows.length} compose window(s)`);
    }

    composeWindows.forEach((composeWindow, index) => {
      // Check if we already processed this window
      if (composeWindow.dataset.mailTrackerProcessed) return;

      // Mark as processed
      composeWindow.dataset.mailTrackerProcessed = 'true';
      log(`Processing compose window #${index + 1}`);

      // Generate email ID early (before send)
      const emailId = generateEmailId();
      composeWindow.dataset.emailId = emailId;
      log(`Pre-generated email ID for compose window #${index + 1}:`, emailId);

      // Find body field to inject pixel early
      let bodyField = composeWindow.querySelector('[role="textbox"][g_editable="true"]');
      if (!bodyField) bodyField = composeWindow.querySelector('[aria-label*="Message Body"]');
      if (!bodyField) bodyField = composeWindow.querySelector('[aria-label*="Corps du message"]');
      if (!bodyField) bodyField = composeWindow.querySelector('div[contenteditable="true"]');

      // Inject pixel into body field IMMEDIATELY (only if tracking is enabled)
      if (bodyField && TRACKING_ENABLED) {
        const pixel = injectTrackingPixel(emailId);

        // Wait a bit for Gmail to initialize
        setTimeout(() => {
          // Add pixel at the end of body
          bodyField.innerHTML += pixel;
          log(`✓ Pixel pre-injected into compose window #${index + 1}`);

          // Make pixel persistent - re-inject if Gmail removes it
          const keepPixelAlive = setInterval(() => {
            if (!bodyField.innerHTML.includes(emailId)) {
              bodyField.innerHTML += pixel;
              log(`↻ Re-injected pixel (Gmail tried to remove it)`);
            }
          }, 1000);

          // Stop re-injection after window closes
          composeWindow.dataset.pixelInterval = keepPixelAlive;
        }, 500);
      } else if (!TRACKING_ENABLED) {
        log(`⚠️ Tracking is disabled, skipping pixel injection`);
      }

      // Find send button - support French and English
      let sendButton = composeWindow.querySelector('div[role="button"][aria-label*="Envoyer"]');
      if (!sendButton) sendButton = composeWindow.querySelector('div[role="button"][data-tooltip*="Envoyer"]');
      if (!sendButton) sendButton = composeWindow.querySelector('div[role="button"][aria-label*="Send"]');
      if (!sendButton) sendButton = composeWindow.querySelector('div[role="button"][data-tooltip*="Send"]');
      if (!sendButton) sendButton = composeWindow.querySelector('.T-I.J-J5-Ji.aoO');
      if (!sendButton) sendButton = composeWindow.querySelector('button[jsname]');

      if (sendButton) {
        log(`✓ Found send button in compose window #${index + 1}`, sendButton);

        // Add click listener
        sendButton.addEventListener('click', async () => {
          // Stop pixel re-injection
          if (composeWindow.dataset.pixelInterval) {
            clearInterval(parseInt(composeWindow.dataset.pixelInterval));
          }
          log('🚀 SEND BUTTON CLICKED!');

          // Check if tracking is enabled before processing
          if (!TRACKING_ENABLED) {
            log('⚠️ Tracking is disabled, skipping email registration');
            return;
          }

          try {
            // Use pre-generated email ID
            const emailId = composeWindow.dataset.emailId;
            log('Using pre-generated email ID:', emailId);

            // Get recipient, subject, and body (support French and English)
            let recipientField = composeWindow.querySelector('input[type="email"]');
            if (!recipientField) recipientField = composeWindow.querySelector('[aria-label*="To"]');
            if (!recipientField) recipientField = composeWindow.querySelector('[aria-label*="À"]'); // French
            if (!recipientField) recipientField = composeWindow.querySelector('textarea[name="to"]');

            const subjectField = composeWindow.querySelector('input[name="subjectbox"]');

            let bodyField = composeWindow.querySelector('[role="textbox"][g_editable="true"]');
            if (!bodyField) bodyField = composeWindow.querySelector('[aria-label*="Message Body"]');
            if (!bodyField) bodyField = composeWindow.querySelector('[aria-label*="Corps du message"]'); // French
            if (!bodyField) bodyField = composeWindow.querySelector('div[contenteditable="true"]');

            // Extract recipient email - Gmail uses special div structure for chips
            let recipient = 'unknown';
            if (recipientField?.value) {
              recipient = recipientField.value;
            } else {
              // Try to get from email chip (Gmail's recipient display)
              const emailChip = composeWindow.querySelector('[email]');
              if (emailChip) {
                recipient = emailChip.getAttribute('email') || emailChip.getAttribute('data-hovercard-id') || 'unknown';
              }
              // Or from span with email
              if (recipient === 'unknown') {
                const emailSpan = composeWindow.querySelector('span[email]');
                if (emailSpan) recipient = emailSpan.getAttribute('email') || 'unknown';
              }
              // Or from people-list
              if (recipient === 'unknown') {
                const peopleEmail = composeWindow.querySelector('[name="to"] [email]');
                if (peopleEmail) recipient = peopleEmail.getAttribute('email') || 'unknown';
              }
            }

            const subject = subjectField?.value || '(No subject)';
            const body = bodyField?.innerHTML || '';

            log('Found fields:', {
              recipientField: !!recipientField,
              subjectField: !!subjectField,
              bodyField: !!bodyField
            });

            log('Email data:', { recipient, subject, bodyLength: body.length });

            // Pixel was already injected early (before send clicked)
            log('✓ Pixel was pre-injected (using ID:', emailId, ')');

            // Register email with backend
            log('Sending registration to background script...');
            chrome.runtime.sendMessage({
              type: 'REGISTER_EMAIL',
              data: {
                id: emailId,
                recipient,
                subject,
                body: body.substring(0, 500) // Store first 500 chars
              }
            }, (response) => {
              if (chrome.runtime.lastError) {
                error('❌ Runtime error:', chrome.runtime.lastError);
                return;
              }

              if (response && response.success) {
                log('✓ Email registered successfully with backend');
                // Show notification
                showTrackingNotification(composeWindow);
              } else {
                error('❌ Failed to register email:', response);
              }
            });

          } catch (err) {
            error('❌ Error processing send:', err);
          }
        });
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Show tracking notification in compose window
 */
function showTrackingNotification(composeWindow) {
  const existing = composeWindow.querySelector('.mail-tracker-compose-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.className = 'mail-tracker-compose-indicator';
  indicator.innerHTML = '✓ Email will be tracked';

  const footer = composeWindow.querySelector('[role="dialog"] > div:last-child');
  if (footer) {
    footer.appendChild(indicator);

    // Auto-remove after 3 seconds
    setTimeout(() => indicator.remove(), 3000);
  }
}

/**
 * Add tracking indicators to sent emails in Gmail UI
 */
async function addTrackingIndicators() {
  log('📊 Checking for tracked emails to display...');

  // Get tracked emails from storage
  chrome.runtime.sendMessage({ type: 'GET_TRACKED_EMAILS' }, (response) => {
    if (chrome.runtime.lastError) {
      error('❌ Runtime error getting tracked emails:', chrome.runtime.lastError);
      return;
    }

    if (!response || !response.success) {
      log('No tracked emails or failed to get them');
      return;
    }

    const trackedEmails = response.data;
    const trackedCount = Object.keys(trackedEmails).length;
    log(`Found ${trackedCount} tracked email(s) in storage`);

    if (trackedCount === 0) {
      log('No tracked emails to display yet');
      return;
    }

    // Find sent email rows
    const emailRows = document.querySelectorAll('[role="row"]');
    log(`Found ${emailRows.length} email rows in Gmail UI`);

    let indicatorsAdded = 0;

    emailRows.forEach((row, rowIndex) => {
      // Check if already has indicator for this specific email
      const existingIndicator = row.querySelector('.mail-tracker-tick');
      if (existingIndicator) return;

      // Look for subject/sender text
      const subjectElement = row.querySelector('[role="link"]');
      if (!subjectElement) return;

      const subject = subjectElement.textContent.trim();

      // Try to extract recipient from row (Gmail shows recipient in sent folder)
      let recipientInRow = '';
      const recipientSpan = row.querySelector('[email]');
      if (recipientSpan) {
        recipientInRow = recipientSpan.getAttribute('email') || '';
      }

      // Find matching tracked email using improved matching
      const matchedEmail = Object.entries(trackedEmails).find(([id, data]) => {
        // 1. Subject must match (exact or partial)
        const subjectMatch = data.subject && subject.includes(data.subject.substring(0, 50));
        if (!subjectMatch) return false;

        // 2. If we have recipient info in both places, they should match
        if (recipientInRow && data.recipient && data.recipient !== 'unknown') {
          if (recipientInRow !== data.recipient) return false;
        }

        // 3. Email must be recent (within last 7 days)
        const age = Date.now() - data.timestamp;
        if (age > 7 * 24 * 60 * 60 * 1000) return false;

        return true;
      });

      if (matchedEmail) {
        const [emailId, emailData] = matchedEmail;

        // Mark row with email ID for debugging
        row.dataset.mailTrackerEmailId = emailId;

        // Create tick container
        const tickContainer = document.createElement('div');
        tickContainer.className = 'mail-tracker-tick-container';
        tickContainer.dataset.emailId = emailId;

        // Create tick indicator
        const tickSpan = document.createElement('span');
        tickSpan.className = emailData.opened
          ? 'mail-tracker-tick mail-tracker-tick-double'
          : 'mail-tracker-tick mail-tracker-tick-single';
        tickSpan.textContent = emailData.opened ? '✓✓' : '✓';

        // Enhanced tooltip with more info
        const tooltipText = emailData.opened
          ? `Ouvert par ${emailData.recipient}\n${formatTimestamp(emailData.openedAt)}`
          : `Envoyé à ${emailData.recipient}\nPas encore ouvert`;
        tickSpan.setAttribute('title', tooltipText);

        tickContainer.appendChild(tickSpan);

        // Insert tick container next to subject (not inside the link)
        const subjectParent = subjectElement.parentElement;
        if (subjectParent) {
          subjectParent.style.position = 'relative';
          subjectParent.insertBefore(tickContainer, subjectElement.nextSibling);
        } else {
          // Fallback: append to subject element
          subjectElement.appendChild(tickContainer);
        }

        indicatorsAdded++;
        log(`✓ Added ${emailData.opened ? 'double' : 'single'} tick for: "${subject}" (ID: ${emailId.substring(0, 8)}...)`);
      }
    });

    if (indicatorsAdded > 0) {
      log(`✓ Added ${indicatorsAdded} tick indicator(s) to Gmail UI`);
    }
  });
}

/**
 * Format timestamp for tooltip display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) return 'À l\'instant';

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  }

  // Show date and time
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Initialize tracking
 */
function init() {
  log('🔧 Initializing Mail Tracker...');
  log('Waiting for Gmail to fully load...');

  let attempts = 0;
  const maxAttempts = 40; // 20 seconds max

  // Wait for Gmail to fully load
  const checkGmailLoaded = setInterval(() => {
    attempts++;
    const gmailLoaded = document.querySelector('[role="navigation"]');

    if (gmailLoaded) {
      clearInterval(checkGmailLoaded);
      log(`✓ Gmail loaded after ${attempts} attempts (${attempts * 0.5}s)`);
      log('🎯 Starting Mail Tracker features...');

      // Monitor compose area
      monitorGmailCompose();

      // Add tracking indicators
      addTrackingIndicators();

      // Refresh indicators periodically
      setInterval(addTrackingIndicators, 5000);

      log('✓ Mail Tracker fully initialized and running');
    } else if (attempts >= maxAttempts) {
      clearInterval(checkGmailLoaded);
      error(`❌ Gmail did not load after ${maxAttempts * 0.5}s. Is this Gmail?`);
      error('Current URL:', window.location.href);
    }
  }, 500);
}

// Start when DOM is ready
log('DOM ready state:', document.readyState);
if (document.readyState === 'loading') {
  log('Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  log('DOM already loaded, initializing immediately');
  init();
}
