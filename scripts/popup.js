// Popup script for Mail Tracker extension

// Load and display statistics when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get tracked emails and tracking state from storage
  const result = await chrome.storage.sync.get(['trackedEmails', 'trackingEnabled']);
  const trackedEmails = result.trackedEmails || {};
  const trackingEnabled = result.trackingEnabled !== false; // Default to true

  // Update tracked emails count
  const count = Object.keys(trackedEmails).length;
  document.getElementById('trackedCount').textContent = count;

  // Add animation to the count
  animateValue('trackedCount', 0, count, 800);

  // Update tracking toggle state
  updateTrackingUI(trackingEnabled);

  // Handle toggle click
  document.getElementById('trackingToggle').addEventListener('click', async () => {
    const currentState = await chrome.storage.sync.get(['trackingEnabled']);
    const newState = !(currentState.trackingEnabled !== false);

    // Save new state
    await chrome.storage.sync.set({ trackingEnabled: newState });

    // Update UI
    updateTrackingUI(newState);
  });
});

// Update tracking UI based on state
function updateTrackingUI(enabled) {
  const toggle = document.getElementById('trackingToggle');
  const statusText = document.getElementById('trackingStatus');
  const statusValue = document.getElementById('statusText');

  if (enabled) {
    toggle.classList.add('active');
    statusText.textContent = 'Tracking is enabled';
    statusText.className = 'status-text enabled';
    statusValue.textContent = 'Active';
  } else {
    toggle.classList.remove('active');
    statusText.textContent = 'Tracking is disabled';
    statusText.className = 'status-text disabled';
    statusValue.textContent = 'Inactive';
  }
}

// Animate number counting
function animateValue(elementId, start, end, duration) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      element.textContent = end;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
}
