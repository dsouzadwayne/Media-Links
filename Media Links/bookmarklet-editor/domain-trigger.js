/**
 * Domain Trigger Content Script
 * Monitors page loads and URL changes to trigger domain-based bookmarklets
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.mediaLinksDomainTriggerInitialized) {
    return;
  }
  window.mediaLinksDomainTriggerInitialized = true;

  let lastUrl = window.location.href;

  /**
   * Check if extension context is valid
   */
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if current page matches a domain pattern
   * @param {string} pattern - Domain pattern (supports wildcards)
   * @returns {boolean}
   */
  function matchesPattern(pattern) {
    const currentHostname = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();
    const p = pattern.toLowerCase();

    // Check if pattern includes path - if so, match against full URL
    const isUrlPattern = p.includes('/') && !p.startsWith('*://');
    const matchTarget = isUrlPattern ? currentUrl : currentHostname;

    // Handle different wildcard patterns
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      // *keyword* - matches anywhere
      const keyword = p.slice(1, -1);
      return matchTarget.includes(keyword);
    } else if (p.startsWith('*')) {
      // *.example.com - matches suffix
      const suffix = p.slice(1);
      return matchTarget.endsWith(suffix);
    } else if (p.endsWith('*')) {
      // example.* - matches prefix
      const prefix = p.slice(0, -1);
      return matchTarget.startsWith(prefix);
    } else {
      // Exact match or subdomain
      return currentHostname === p || currentHostname.endsWith('.' + p);
    }
  }

  /**
   * Check for domain-triggered bookmarklets and execute if matches
   * @param {string} trigger - Trigger type ('pageload' or 'urlchange')
   */
  async function checkDomainTriggers(trigger) {
    if (!isExtensionContextValid()) {
      return;
    }

    try {
      const data = await chrome.storage.local.get(['customBookmarklets']);
      const bookmarklets = data.customBookmarklets || {};

      for (const [id, bookmarklet] of Object.entries(bookmarklets)) {
        // Skip disabled bookmarklets
        if (!bookmarklet.enabled) {
          continue;
        }

        // Only process domain-type schedules
        if (bookmarklet.schedule?.type !== 'domain') {
          continue;
        }

        const config = bookmarklet.schedule.config;

        // Check trigger type matches
        if (config.trigger !== trigger) {
          continue;
        }

        // Check if any domain pattern matches
        const domains = config.domains || [];
        const matches = domains.some(pattern => matchesPattern(pattern));

        if (!matches) {
          continue;
        }

        console.log(`Domain trigger matched for bookmarklet: ${bookmarklet.name}`);

        // Execute based on autoRun setting
        if (bookmarklet.autoRun) {
          await executeBookmarklet(bookmarklet);
        } else {
          await showConfirmationDialog(bookmarklet);
        }
      }
    } catch (error) {
      console.warn('Error checking domain triggers:', error);
    }
  }

  /**
   * Execute a bookmarklet
   * @param {Object} bookmarklet - Bookmarklet object
   */
  async function executeBookmarklet(bookmarklet) {
    console.log(`Executing domain-triggered bookmarklet: ${bookmarklet.name}`);

    // Try using MediaLinksBookmarklets if available
    if (window.MediaLinksBookmarklets) {
      try {
        const success = await window.MediaLinksBookmarklets.execute(bookmarklet.code, bookmarklet.name);
        if (success) {
          showNotification(bookmarklet.name, 'success');
          await updateStats(bookmarklet.id);
          return;
        }
      } catch (e) {
        console.warn('MediaLinksBookmarklets execution failed:', e);
      }
    }

    // Fallback: try direct execution
    try {
      const fn = new Function(bookmarklet.code);
      fn();
      showNotification(bookmarklet.name, 'success');
      await updateStats(bookmarklet.id);
    } catch (error) {
      console.error('Bookmarklet execution error:', error);
      showNotification(bookmarklet.name, 'error', error.message);
    }
  }

  /**
   * Show confirmation dialog before executing
   * @param {Object} bookmarklet - Bookmarklet object
   */
  async function showConfirmationDialog(bookmarklet) {
    // Remove existing dialog
    const existing = document.getElementById('ml-domain-trigger-dialog');
    if (existing) {
      existing.remove();
    }

    // Get theme colors if ThemeManager is available
    let bgColor = '#1f2937';
    let textColor = '#f9fafb';
    let accentColor = '#6366f1';
    let mutedColor = '#9ca3af';
    let borderColor = '#374151';

    if (typeof ThemeManager !== 'undefined') {
      try {
        const theme = ThemeManager.getTheme();
        const colors = ThemeManager.getThemeColors();
        if (colors) {
          bgColor = colors.bg || bgColor;
          textColor = colors.text || textColor;
          accentColor = colors.button || accentColor;
        }
      } catch (e) {
        // Use defaults
      }
    }

    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'ml-domain-trigger-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: ${bgColor};
      color: ${textColor};
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: mlSlideIn 0.3s ease;
    `;

    // Add animation keyframes
    if (!document.getElementById('ml-trigger-styles')) {
      const style = document.createElement('style');
      style.id = 'ml-trigger-styles';
      style.textContent = `
        @keyframes mlSlideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes mlSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    dialog.innerHTML = `
      <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">
        Run Bookmarklet?
      </div>
      <div style="font-size: 14px; margin-bottom: 4px;">
        ${escapeHtml(bookmarklet.name)}
      </div>
      <div style="font-size: 12px; color: ${mutedColor}; margin-bottom: 16px;">
        ${escapeHtml(bookmarklet.description || 'Triggered by domain match')}
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="ml-trigger-run" style="flex: 1; padding: 10px; background: ${accentColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
          Run
        </button>
        <button id="ml-trigger-cancel" style="flex: 1; padding: 10px; background: transparent; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 6px; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(dialog);

    // Handle run button
    document.getElementById('ml-trigger-run').addEventListener('click', async () => {
      dialog.style.animation = 'mlSlideOut 0.2s ease forwards';
      setTimeout(() => dialog.remove(), 200);
      await executeBookmarklet(bookmarklet);
    });

    // Handle cancel button
    document.getElementById('ml-trigger-cancel').addEventListener('click', () => {
      dialog.style.animation = 'mlSlideOut 0.2s ease forwards';
      setTimeout(() => dialog.remove(), 200);
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (document.getElementById('ml-domain-trigger-dialog')) {
        dialog.style.animation = 'mlSlideOut 0.2s ease forwards';
        setTimeout(() => dialog.remove(), 200);
      }
    }, 30000);
  }

  /**
   * Show a toast notification
   * @param {string} name - Bookmarklet name
   * @param {string} status - 'success' or 'error'
   * @param {string} errorMsg - Optional error message
   */
  function showNotification(name, status, errorMsg = '') {
    // Remove existing notification
    const existing = document.getElementById('ml-trigger-toast');
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'ml-trigger-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      padding: 12px 20px;
      background: ${status === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: mlSlideIn 0.3s ease;
    `;

    toast.textContent = status === 'success'
      ? `${name} executed`
      : `${name} failed: ${errorMsg}`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'mlSlideOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  /**
   * Update bookmarklet execution statistics
   * @param {string} bookmarkletId - Bookmarklet ID
   */
  async function updateStats(bookmarkletId) {
    if (!isExtensionContextValid()) return;

    try {
      const data = await chrome.storage.local.get(['customBookmarklets']);
      const bookmarklets = data.customBookmarklets || {};
      const bookmarklet = bookmarklets[bookmarkletId];

      if (bookmarklet) {
        bookmarklet.lastExecuted = Date.now();
        bookmarklet.executionCount = (bookmarklet.executionCount || 0) + 1;
        await chrome.storage.local.set({ customBookmarklets: bookmarklets });
      }
    } catch (e) {
      console.warn('Error updating bookmarklet stats:', e);
    }
  }

  /**
   * Monitor URL changes for SPA navigation
   */
  function setupUrlMonitor() {
    // Monitor pushState
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };

    // Monitor replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };

    // Monitor popstate (back/forward)
    window.addEventListener('popstate', handleUrlChange);

    // Also use MutationObserver as backup for sites that modify URL differently
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        handleUrlChange();
      }
    });

    // Start observing when body is available
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  /**
   * Handle URL change
   */
  function handleUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== lastUrl) {
      lastUrl = newUrl;
      // Small delay to let page update
      setTimeout(() => {
        checkDomainTriggers('urlchange');
      }, 100);
    }
  }

  /**
   * Initialize domain trigger monitoring
   */
  function init() {
    // Skip extension pages
    if (window.location.protocol === 'chrome-extension:') {
      return;
    }

    // Check pageload triggers
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        checkDomainTriggers('pageload');
      });
    } else {
      // DOM already loaded
      checkDomainTriggers('pageload');
    }

    // Setup URL change monitoring for SPA
    setupUrlMonitor();
  }

  // Initialize
  init();

})();
