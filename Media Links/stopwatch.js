/**
 * Stopwatch Content Script
 * Displays a live stopwatch on websites tracking time since page load
 * with optional notification after a configurable time
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.mediaLinksStopwatchInitialized) {
    return;
  }
  window.mediaLinksStopwatchInitialized = true;

  // State
  let stopwatchElement = null;
  let startTime = null;
  let intervalId = null;
  let isMinimized = false;
  let notificationSent = false;
  let listenersAttached = false;
  let settings = {
    enabled: false,
    position: 'bottom-right',
    notificationEnabled: false,
    notificationMinutes: 30,
    minimizedByDefault: false,
    includedDomains: '',
    openBookmarksOnNotification: false,
    bookmarksByDomain: {}
  };

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
   * Check if current domain is included (allowed)
   * Returns true if domain is allowed, false if not
   */
  function isDomainIncluded() {
    // If no domains specified, allow all (empty = show everywhere)
    if (!settings.includedDomains || typeof settings.includedDomains !== 'string' || settings.includedDomains.trim() === '') {
      return true;
    }

    const currentHost = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();
    const includedList = settings.includedDomains
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    // If list is empty after filtering, allow all
    if (includedList.length === 0) {
      return true;
    }

    return includedList.some(included => {
      // Check if pattern contains path (/ or ://) - if so, match against full URL
      const isUrlPattern = included.includes('/') || included.includes('://');
      const matchTarget = isUrlPattern ? currentUrl : currentHost;

      // Handle wildcard patterns
      if (included.startsWith('*') && included.endsWith('*') && included.length > 2) {
        // *google.com* matches anything containing that pattern
        const pattern = included.slice(1, -1); // Remove both *
        return matchTarget.includes(pattern);
      } else if (included.startsWith('*')) {
        // *.example.com matches anything ending with that pattern
        const pattern = included.slice(1); // Remove the *
        return matchTarget.endsWith(pattern);
      } else if (included.endsWith('*')) {
        // example.* matches anything starting with that pattern
        const pattern = included.slice(0, -1); // Remove the *
        return matchTarget.startsWith(pattern);
      }
      // Handle both exact match and subdomain match
      return currentHost === included || currentHost.endsWith('.' + included);
    });
  }

  /**
   * Format time in HH:MM:SS
   */
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Get position styles based on setting
   */
  function getPositionStyles() {
    const positions = {
      'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' },
      'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
      'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
      'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
    };
    return positions[settings.position] || positions['bottom-right'];
  }

  // Theme color definitions (matching theme-manager.js)
  const themeColorPalettes = {
    light: {
      button: '#6366f1',
      buttonHover: '#4f46e5',
      buttonText: '#fff',
      bg: '#ffffff',
      text: '#1f2937'
    },
    dark: {
      button: '#8b5cf6',
      buttonHover: '#7c3aed',
      buttonText: '#fff',
      bg: '#1a1a1a',
      text: '#e5e5e5'
    },
    'catppuccin-mocha': {
      button: '#cba6f7',
      buttonHover: '#b4a1e8',
      buttonText: '#1e1e2e',
      bg: '#1e1e2e',
      text: '#cdd6f4'
    },
    cats: {
      button: '#ff9933',
      buttonHover: '#ff7700',
      buttonText: '#000',
      bg: '#2d1f1a',
      text: '#f5deb3'
    },
    'cat-night': {
      button: '#818cf8',
      buttonHover: '#6366f1',
      buttonText: '#fff',
      bg: '#0a0e27',
      text: '#e0e7ff'
    }
  };

  // Current theme cache
  let currentThemeCache = 'light';

  /**
   * Get theme colors with additional computed colors for the stopwatch
   */
  function getThemeColors() {
    // Try to get current theme from ThemeManager
    let themeName = 'light';

    if (typeof ThemeManager !== 'undefined') {
      try {
        themeName = ThemeManager.getTheme() || 'light';
      } catch (e) {
        // Use cached or default
        themeName = currentThemeCache;
      }
    } else {
      themeName = currentThemeCache;
    }

    // Get colors for this theme
    const colors = themeColorPalettes[themeName] || themeColorPalettes.light;

    // Determine if this is a dark theme based on background color
    const isDark = isColorDark(colors.bg);

    // Compute additional colors for the stopwatch
    return {
      ...colors,
      themeName,
      isDark,
      // Border color - lighter for dark themes, darker for light themes
      border: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      // Secondary background for gradient
      bgSecondary: isDark ? lightenColor(colors.bg, 10) : darkenColor(colors.bg, 5),
      // Muted text color
      textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
    };
  }

  /**
   * Load current theme from storage
   */
  async function loadCurrentTheme() {
    if (!isExtensionContextValid()) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(['theme'], (result) => {
          if (chrome.runtime.lastError) {
            resolve();
            return;
          }
          currentThemeCache = result.theme || 'light';
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Check if a color is dark
   */
  function isColorDark(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return true;
    const hex = hexColor.replace('#', '');
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return true; // Default to dark if invalid
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  /**
   * Lighten a hex color by a percentage
   */
  function lightenColor(hexColor, percent) {
    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
    const hex = hexColor.replace('#', '');
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return '#ffffff';
    const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + Math.round(255 * percent / 100));
    const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + Math.round(255 * percent / 100));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Darken a hex color by a percentage
   */
  function darkenColor(hexColor, percent) {
    if (!hexColor || typeof hexColor !== 'string') return '#000000';
    const hex = hexColor.replace('#', '');
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return '#000000';
    const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - Math.round(255 * percent / 100));
    const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - Math.round(255 * percent / 100));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Create the stopwatch UI
   */
  function createStopwatch() {
    if (stopwatchElement) return;

    // Create container
    stopwatchElement = document.createElement('div');
    stopwatchElement.id = 'media-links-stopwatch';
    stopwatchElement.setAttribute('data-media-links-stopwatch', 'true');

    updateStopwatchUI();
    document.body.appendChild(stopwatchElement);

    // Only attach listeners once to prevent duplicates
    if (!listenersAttached) {
      listenersAttached = true;

      // Listen for theme changes via ThemeManager
      if (typeof ThemeManager !== 'undefined') {
        try {
          ThemeManager.subscribe((theme) => {
            currentThemeCache = theme;
            if (stopwatchElement) {
              updateStopwatchUI();
            }
          });
        } catch (e) {
          // ThemeManager not available
        }
      }

      // Listen for theme change messages
      if (isExtensionContextValid()) {
        try {
          chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'themeChanged') {
              currentThemeCache = message.theme || 'light';
              if (stopwatchElement) {
                updateStopwatchUI();
              }
            }
          });
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  /**
   * Update stopwatch UI (expanded/minimized)
   */
  function updateStopwatchUI() {
    if (!stopwatchElement) return;

    const colors = getThemeColors();
    const elapsed = startTime ? Date.now() - startTime : 0;
    const timeStr = formatTime(elapsed);
    const posStyles = getPositionStyles();

    // Base styles that apply to both states
    const baseStyles = `
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px ${colors.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'};
    `;

    if (isMinimized) {
      stopwatchElement.style.cssText = baseStyles + `
        background: ${colors.button};
        border-radius: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0.9;
        border: 2px solid ${colors.border};
      `;

      // Apply position
      Object.keys(posStyles).forEach(key => {
        stopwatchElement.style[key] = posStyles[key];
      });

      stopwatchElement.innerHTML = '';

      const icon = document.createElement('span');
      icon.textContent = '⏱️';
      icon.style.cssText = `
        font-size: 18px;
        color: ${colors.buttonText};
      `;
      stopwatchElement.appendChild(icon);

      stopwatchElement.title = `Time on page: ${timeStr}\nClick to expand`;
    } else {
      stopwatchElement.style.cssText = baseStyles + `
        background: linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgSecondary} 100%);
        border: 1px solid ${colors.border};
        border-radius: 12px;
        padding: 12px 16px;
        min-width: 120px;
        cursor: default;
        opacity: 1;
      `;

      // Apply position
      Object.keys(posStyles).forEach(key => {
        stopwatchElement.style[key] = posStyles[key];
      });

      stopwatchElement.innerHTML = '';

      // Create content using DOM methods
      const container = document.createElement('div');
      container.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px;';

      const leftSection = document.createElement('div');
      leftSection.style.cssText = 'display: flex; align-items: center; gap: 8px;';

      const clockIcon = document.createElement('span');
      clockIcon.textContent = '⏱️';
      clockIcon.style.fontSize = '14px';

      const timeDisplay = document.createElement('span');
      timeDisplay.id = 'stopwatch-time';
      timeDisplay.textContent = timeStr;
      timeDisplay.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        color: ${colors.text};
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.5px;
      `;

      leftSection.appendChild(clockIcon);
      leftSection.appendChild(timeDisplay);

      const minimizeBtn = document.createElement('button');
      minimizeBtn.id = 'stopwatch-minimize';
      minimizeBtn.title = 'Minimize';
      minimizeBtn.textContent = '_';
      minimizeBtn.style.cssText = `
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px;
        font-size: 14px;
        opacity: 0.6;
        transition: opacity 0.2s;
        color: ${colors.text};
      `;

      minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMinimized = true;
        updateStopwatchUI();
      });
      minimizeBtn.addEventListener('mouseenter', () => {
        minimizeBtn.style.opacity = '1';
      });
      minimizeBtn.addEventListener('mouseleave', () => {
        minimizeBtn.style.opacity = '0.6';
      });

      container.appendChild(leftSection);
      container.appendChild(minimizeBtn);

      const label = document.createElement('div');
      label.textContent = 'Time on page';
      label.style.cssText = `
        font-size: 10px;
        color: ${colors.textMuted};
        margin-top: 4px;
        text-align: center;
      `;

      stopwatchElement.appendChild(container);
      stopwatchElement.appendChild(label);
    }

    // Click to toggle minimize state
    stopwatchElement.onclick = (e) => {
      if (isMinimized) {
        isMinimized = false;
        updateStopwatchUI();
      }
    };
  }

  /**
   * Update the time display
   */
  function updateTime() {
    if (!stopwatchElement || !startTime) return;

    const elapsed = Date.now() - startTime;
    const timeStr = formatTime(elapsed);

    if (isMinimized) {
      stopwatchElement.title = `Time on page: ${timeStr}\nClick to expand`;
    } else {
      const timeEl = stopwatchElement.querySelector('#stopwatch-time');
      if (timeEl) {
        timeEl.textContent = timeStr;
      }
    }

    // Check for notification
    if (settings.notificationEnabled && !notificationSent) {
      const elapsedMinutes = elapsed / (1000 * 60);
      if (elapsedMinutes >= settings.notificationMinutes) {
        showToastNotification(elapsed);
        notificationSent = true;
      }
    }
  }

  /**
   * Show browser alert notification and focus the tab
   * After user dismisses the alert, open selected bookmarks if enabled
   */
  function showToastNotification(elapsed) {
    const hostname = window.location.hostname;
    const timeStr = formatTime(elapsed);

    console.log('Stopwatch: showToastNotification called', {
      hostname,
      timeStr,
      openBookmarksOnNotification: settings.openBookmarksOnNotification,
      bookmarksByDomain: settings.bookmarksByDomain
    });

    const showAlert = () => {
      console.log('Stopwatch: Showing alert');
      alert(`Time Alert!\n\nYou've been on ${hostname} for ${timeStr}`);
      console.log('Stopwatch: Alert dismissed by user');

      // After alert is dismissed, open bookmarks if enabled and configured for this domain
      if (settings.openBookmarksOnNotification) {
        console.log('Stopwatch: openBookmarksOnNotification is enabled, checking for domain bookmarks');
        const domainBookmarks = getBookmarksForCurrentDomain();
        console.log('Stopwatch: Domain bookmarks found:', domainBookmarks);
        if (domainBookmarks.length > 0) {
          console.log('Stopwatch: Calling openSelectedBookmarks');
          openSelectedBookmarks();
        } else {
          console.log('Stopwatch: No bookmarks configured for this domain');
        }
      } else {
        console.log('Stopwatch: openBookmarksOnNotification is disabled');
      }
    };

    // First, request to focus this tab (brings user to this tab)
    if (isExtensionContextValid()) {
      try {
        console.log('Stopwatch: Sending focusCurrentTab message');
        chrome.runtime.sendMessage({ type: 'focusCurrentTab' }, (response) => {
          // Check for errors
          if (chrome.runtime.lastError) {
            console.warn('Stopwatch: Focus tab error:', chrome.runtime.lastError.message);
            showAlert();
            return;
          }

          console.log('Stopwatch: focusCurrentTab response:', response);

          // Wait a brief moment for the window/tab focus to visually complete
          setTimeout(() => {
            showAlert();
          }, 150);
        });
      } catch (e) {
        // Fallback: just show alert
        console.error('Stopwatch: Focus tab exception:', e);
        showAlert();
      }
    } else {
      console.warn('Stopwatch: Extension context invalid, showing alert directly');
      showAlert();
    }
  }

  /**
   * Get bookmarks for the current domain
   * Checks for exact match first, then partial matches, then wildcards
   */
  function getBookmarksForCurrentDomain() {
    const currentHostname = window.location.hostname.toLowerCase();

    if (!settings.bookmarksByDomain || Object.keys(settings.bookmarksByDomain).length === 0) {
      return [];
    }

    let result = [];

    // Check for exact match first
    if (settings.bookmarksByDomain[currentHostname]) {
      result = [...settings.bookmarksByDomain[currentHostname]];
    }

    // Check for partial matches (e.g., "youtube.com" matches "www.youtube.com")
    if (result.length === 0) {
      for (const domain of Object.keys(settings.bookmarksByDomain)) {
        if (domain === '*') continue; // Handle wildcard separately
        if (currentHostname === domain ||
            currentHostname.endsWith('.' + domain) ||
            domain.endsWith('.' + currentHostname)) {
          result = [...settings.bookmarksByDomain[domain]];
          break;
        }
      }
    }

    // Also add global wildcard bookmarks (*) - these run on ALL sites
    if (settings.bookmarksByDomain['*']) {
      result = [...result, ...settings.bookmarksByDomain['*']];
    }

    return result;
  }

  /**
   * Open bookmarks for current domain
   * - Bookmarklets: Handled by bookmarklets.js (MediaLinksBookmarklets)
   * - Regular URLs: Send to background script to open in new tabs
   */
  function openSelectedBookmarks() {
    console.log('Stopwatch: openSelectedBookmarks called');

    const bookmarks = getBookmarksForCurrentDomain();
    console.log('Stopwatch: Bookmarks for domain:', window.location.hostname, bookmarks);

    if (!bookmarks || bookmarks.length === 0) {
      console.log('Stopwatch: No bookmarks configured for this domain:', window.location.hostname);
      return;
    }

    // Separate bookmarklets from regular URLs
    const bookmarklets = [];
    const regularBookmarks = [];

    for (const bookmark of bookmarks) {
      if (!bookmark.url) continue;

      // Check if it's a bookmarklet (javascript: URL)
      const isBookmarklet = bookmark.url.startsWith('javascript:');

      if (isBookmarklet) {
        bookmarklets.push(bookmark);
      } else {
        regularBookmarks.push(bookmark);
      }
    }

    console.log(`Stopwatch: Found ${bookmarklets.length} bookmarklet(s) and ${regularBookmarks.length} regular bookmark(s)`);

    // Execute bookmarklets using the bookmarklets.js handler
    if (bookmarklets.length > 0) {
      if (window.MediaLinksBookmarklets) {
        const results = window.MediaLinksBookmarklets.executeMultiple(bookmarklets);
        console.log(`Stopwatch: Bookmarklet execution results:`, results);
      } else {
        console.error('Stopwatch: MediaLinksBookmarklets not available');
      }
    }

    // Send regular bookmarks to background script to open in new tabs
    if (regularBookmarks.length > 0) {
      if (!isExtensionContextValid()) {
        console.warn('Stopwatch: Extension context invalid, cannot open regular bookmarks');
        return;
      }

      console.log(`Stopwatch: Sending ${regularBookmarks.length} regular bookmark(s) to background`);

      try {
        chrome.runtime.sendMessage({
          type: 'openBookmarks',
          bookmarks: regularBookmarks
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Stopwatch: Error opening bookmarks:', chrome.runtime.lastError.message);
          } else if (response) {
            console.log('Stopwatch: openBookmarks response:', response);
            if (response.success) {
              console.log(`Stopwatch: Successfully opened ${response.openedCount} bookmark(s)`);
            } else {
              console.warn('Stopwatch: openBookmarks reported failure:', response.error || response.errors);
            }
          } else {
            console.warn('Stopwatch: No response received from openBookmarks');
          }
        });
      } catch (e) {
        console.error('Stopwatch: Exception sending openBookmarks message:', e);
      }
    }
  }

  /**
   * Start the stopwatch
   */
  function start() {
    if (intervalId) return;

    startTime = Date.now();
    notificationSent = false;
    isMinimized = settings.minimizedByDefault;

    createStopwatch();

    // Update every second
    intervalId = setInterval(updateTime, 1000);
    updateTime();
  }

  /**
   * Stop the stopwatch
   */
  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (stopwatchElement && stopwatchElement.parentNode) {
      stopwatchElement.parentNode.removeChild(stopwatchElement);
      stopwatchElement = null;
    }

    startTime = null;
  }

  /**
   * Load settings and initialize
   */
  async function loadSettings() {
    if (!isExtensionContextValid()) return;

    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get([
          'stopwatchEnabled',
          'stopwatchPosition',
          'stopwatchNotificationEnabled',
          'stopwatchNotificationMinutes',
          'stopwatchMinimizedByDefault',
          'stopwatchIncludedDomains',
          'stopwatchOpenBookmarksOnNotification',
          'stopwatchBookmarksByDomain'
        ], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error loading stopwatch settings:', chrome.runtime.lastError);
            resolve();
            return;
          }

          settings.enabled = result.stopwatchEnabled === true;
          settings.position = result.stopwatchPosition || 'bottom-right';
          settings.notificationEnabled = result.stopwatchNotificationEnabled === true;
          settings.notificationMinutes = result.stopwatchNotificationMinutes || 30;
          settings.minimizedByDefault = result.stopwatchMinimizedByDefault === true;
          settings.includedDomains = result.stopwatchIncludedDomains || '';
          settings.openBookmarksOnNotification = result.stopwatchOpenBookmarksOnNotification === true;
          settings.bookmarksByDomain = (result.stopwatchBookmarksByDomain && typeof result.stopwatchBookmarksByDomain === 'object') ? result.stopwatchBookmarksByDomain : {};

          resolve();
        });
      });
    } catch (e) {
      console.warn('Error loading stopwatch settings:', e);
    }
  }

  /**
   * Initialize stopwatch
   */
  async function init() {
    // Skip extension pages
    if (window.location.protocol === 'chrome-extension:') {
      return;
    }

    await loadSettings();
    await loadCurrentTheme();

    if (!settings.enabled) {
      return;
    }

    if (!isDomainIncluded()) {
      return;
    }

    // Wait for body to be available
    if (document.body) {
      start();
    } else {
      document.addEventListener('DOMContentLoaded', start);
    }
  }

  /**
   * Listen for settings changes
   */
  if (isExtensionContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'sync') return;

        let shouldRestart = false;

        if (changes.stopwatchEnabled !== undefined) {
          settings.enabled = changes.stopwatchEnabled.newValue === true;
          shouldRestart = true;
        }
        if (changes.stopwatchPosition !== undefined) {
          settings.position = changes.stopwatchPosition.newValue || 'bottom-right';
          if (stopwatchElement) {
            updateStopwatchUI();
          }
        }
        if (changes.stopwatchNotificationEnabled !== undefined) {
          settings.notificationEnabled = changes.stopwatchNotificationEnabled.newValue === true;
        }
        if (changes.stopwatchNotificationMinutes !== undefined) {
          settings.notificationMinutes = changes.stopwatchNotificationMinutes.newValue || 30;
          // Reset notification flag if time was extended beyond current elapsed
          // This allows a new notification if user increases the time limit
          if (notificationSent && startTime) {
            const elapsed = Date.now() - startTime;
            const elapsedMinutes = elapsed / (1000 * 60);
            if (elapsedMinutes < settings.notificationMinutes) {
              notificationSent = false;
            }
          }
        }
        if (changes.stopwatchMinimizedByDefault !== undefined) {
          settings.minimizedByDefault = changes.stopwatchMinimizedByDefault.newValue === true;
        }
        if (changes.stopwatchIncludedDomains !== undefined) {
          settings.includedDomains = changes.stopwatchIncludedDomains.newValue || '';
          shouldRestart = true;
        }
        if (changes.stopwatchOpenBookmarksOnNotification !== undefined) {
          settings.openBookmarksOnNotification = changes.stopwatchOpenBookmarksOnNotification.newValue === true;
        }
        if (changes.stopwatchBookmarksByDomain !== undefined) {
          const newValue = changes.stopwatchBookmarksByDomain.newValue;
          settings.bookmarksByDomain = (newValue && typeof newValue === 'object') ? newValue : {};
        }

        // Handle theme changes
        if (changes.theme !== undefined) {
          currentThemeCache = changes.theme.newValue || 'light';
          if (stopwatchElement) {
            updateStopwatchUI();
          }
        }

        // Handle enable/disable and domain inclusion changes
        if (shouldRestart) {
          stop();
          if (settings.enabled && isDomainIncluded()) {
            start();
          }
        }
      });
    } catch (e) {
      console.warn('Error setting up stopwatch settings listener:', e);
    }
  }

  // Initialize
  init();

})();
