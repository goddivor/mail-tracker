// Configuration for Mail Tracker Extension
//
// L'URL de l'API est hard-codée et pointe vers Railway.
// Pour modifier l'URL, éditez DEFAULT_API_URL ci-dessous avant de packager l'extension.

const CONFIG = {
  // Production API endpoint (Railway)
  DEFAULT_API_URL: 'https://mail-tracker-api-production.up.railway.app',

  // Polling interval for checking email status (in milliseconds)
  POLL_INTERVAL: 30000, // 30 seconds (sync with background.js)

  // Storage keys
  STORAGE_KEYS: {
    TRACKED_EMAILS: 'trackedEmails',
    API_URL: 'apiUrl'
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
