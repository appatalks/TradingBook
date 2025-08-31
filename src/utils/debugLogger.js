/**
 * Debug utility for TradingBook
 * Provides centralized logging that can be toggled on/off
 */

class DebugLogger {
  constructor() {
    this.isEnabled = true; // Default to enabled, will be updated from settings
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  log(...args) {
    if (this.isEnabled) {
      console.log(...args);
    }
  }

  error(...args) {
    if (this.isEnabled) {
      console.error(...args);
    }
  }

  warn(...args) {
    if (this.isEnabled) {
      console.warn(...args);
    }
  }

  info(...args) {
    if (this.isEnabled) {
      console.info(...args);
    }
  }
}

// Export a singleton instance
const debugLogger = new DebugLogger();

// For Node.js/CommonJS environments (electron main process)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = debugLogger;
}

// For browser/renderer environments
if (typeof window !== 'undefined') {
  window.debugLogger = debugLogger;
}

// For ES6 modules
export default debugLogger;
