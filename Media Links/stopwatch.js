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
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let settings = {
    enabled: false,
    position: 'bottom-right',
    customPosition: null, // { x, y } pixel coordinates, null means use default position
    notificationEnabled: false,
    notificationMinutes: 30,
    minimizedByDefault: false,
    includedDomains: '',
    openBookmarksOnNotification: false,
    bookmarksByDomain: {},
    notificationTimeByDomain: {}, // Per-domain notification times in seconds
    globalBookmarklets: [], // Global custom bookmarklet IDs (from editor)
    notificationSilent: false, // Global silent mode: skip alert, run bookmarklets in background
    silentModeByDomain: {}, // Per-domain silent mode override: { "example.com": true }
    bookmarkletDelay: 0, // Default delay in ms between bookmarklet executions
    delayByDomain: {}, // Per-domain delay override: { "example.com": 500 }
    useRandomTime: false, // Global random time toggle
    randomTimeMinMinutes: 10, // Global min minutes for random range
    randomTimeMaxMinutes: 30, // Global max minutes for random range
    randomTimeRangeByDomain: {} // Per-domain random ranges: { "domain": { minSeconds, maxSeconds, enabled } }
  };

  // Generated random notification time for this page load (in seconds)
  // This is NOT stored - regenerated each page refresh
  let generatedRandomTimeSeconds = null;

  // Edge snapping threshold in pixels
  const SNAP_THRESHOLD = 20;
  const EDGE_MARGIN = 15;

  // Use StorageUtils for extension context check
  const isExtensionContextValid = () => typeof StorageUtils !== 'undefined' && StorageUtils.isExtensionContextValid();

  /**
   * Match a string against a glob pattern using minimatch
   * Also handles subdomain matching for plain domain patterns
   * @param {string} str - String to test (hostname or URL)
   * @param {string} pattern - Glob pattern or domain name
   * @param {string} hostname - Current hostname (for subdomain matching)
   * @returns {boolean}
   */
  function matchesPattern(str, pattern, hostname) {
    if (!str || !pattern) return false;

    // Use minimatch for glob patterns (contains *, ?, [, {)
    if (/[*?[\]{}]/.test(pattern)) {
      if (typeof minimatch !== 'function') return false;

      // For URL patterns (contain :// or /), convert single * to ** so they match across path segments
      // e.g., "https://example.com/path*" should match "https://example.com/path/to/page"
      let adjustedPattern = pattern;
      if (pattern.includes('/') || pattern.includes('://')) {
        // Replace single * (not **) with ** for URL matching
        adjustedPattern = pattern.replace(/(?<!\*)\*(?!\*)/g, '**');
      }

      return minimatch(str, adjustedPattern, { nocase: true });
    }

    // For plain patterns without glob chars, check exact match and subdomain match
    const lowerStr = str.toLowerCase();
    const lowerPattern = pattern.toLowerCase();
    const lowerHost = (hostname || str).toLowerCase();

    return lowerStr === lowerPattern ||
           lowerHost === lowerPattern ||
           lowerHost.endsWith('.' + lowerPattern);
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

    return includedList.some(pattern => {
      // Check if pattern contains path - if so, match against full URL
      const isUrlPattern = pattern.includes('/') && !pattern.startsWith('*://');
      const matchTarget = isUrlPattern ? currentUrl : currentHost;
      return matchesPattern(matchTarget, pattern, currentHost);
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
   * Get position styles based on setting or custom position
   */
  function getPositionStyles() {
    // If we have a custom position from dragging, use that
    if (settings.customPosition && typeof settings.customPosition.x === 'number') {
      return {
        top: `${settings.customPosition.y}px`,
        left: `${settings.customPosition.x}px`,
        bottom: 'auto',
        right: 'auto'
      };
    }

    // Otherwise use the preset positions
    const positions = {
      'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' },
      'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
      'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
      'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' }
    };
    return positions[settings.position] || positions['bottom-right'];
  }

  /**
   * Snap position to nearest edge if within threshold
   */
  function snapToEdge(x, y, elementWidth, elementHeight) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let snappedX = x;
    let snappedY = y;

    // Snap to left edge
    if (x < SNAP_THRESHOLD) {
      snappedX = EDGE_MARGIN;
    }
    // Snap to right edge
    else if (x + elementWidth > viewportWidth - SNAP_THRESHOLD) {
      snappedX = viewportWidth - elementWidth - EDGE_MARGIN;
    }

    // Snap to top edge
    if (y < SNAP_THRESHOLD) {
      snappedY = EDGE_MARGIN;
    }
    // Snap to bottom edge
    else if (y + elementHeight > viewportHeight - SNAP_THRESHOLD) {
      snappedY = viewportHeight - elementHeight - EDGE_MARGIN;
    }

    return { x: snappedX, y: snappedY };
  }

  /**
   * Constrain position within viewport
   */
  function constrainToViewport(x, y, elementWidth, elementHeight) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    return {
      x: Math.max(EDGE_MARGIN, Math.min(x, viewportWidth - elementWidth - EDGE_MARGIN)),
      y: Math.max(EDGE_MARGIN, Math.min(y, viewportHeight - elementHeight - EDGE_MARGIN))
    };
  }

  /**
   * Save custom position to storage
   */
  function saveCustomPosition(position) {
    if (!StorageUtils.isExtensionContextValid()) return;

    settings.customPosition = position;

    try {
      chrome.storage.sync.set({ stopwatchCustomPosition: position }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error saving stopwatch position:', chrome.runtime.lastError);
        }
      });
    } catch (e) {
      console.warn('Error saving stopwatch position:', e);
    }
  }

  /**
   * Handle drag start
   */
  function handleDragStart(e) {
    if (!stopwatchElement) return;

    // Don't start drag if clicking on minimize button
    if (e.target.id === 'stopwatch-minimize') return;

    isDragging = true;
    stopwatchElement.style.transition = 'none'; // Disable transition during drag
    stopwatchElement.style.cursor = 'grabbing';

    const rect = stopwatchElement.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    // Add move and end listeners to document
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    e.preventDefault();
  }

  /**
   * Handle drag move
   */
  function handleDragMove(e) {
    if (!isDragging || !stopwatchElement) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Apply position directly during drag
    stopwatchElement.style.left = `${newX}px`;
    stopwatchElement.style.top = `${newY}px`;
    stopwatchElement.style.right = 'auto';
    stopwatchElement.style.bottom = 'auto';

    e.preventDefault();
  }

  /**
   * Handle drag end
   */
  function handleDragEnd(e) {
    if (!isDragging || !stopwatchElement) return;

    isDragging = false;
    stopwatchElement.style.transition = 'all 0.3s ease'; // Re-enable transition
    stopwatchElement.style.cursor = isMinimized ? 'pointer' : 'grab';

    // Get current position
    const rect = stopwatchElement.getBoundingClientRect();
    let finalX = rect.left;
    let finalY = rect.top;

    // Constrain to viewport
    const constrained = constrainToViewport(finalX, finalY, rect.width, rect.height);
    finalX = constrained.x;
    finalY = constrained.y;

    // Snap to edges
    const snapped = snapToEdge(finalX, finalY, rect.width, rect.height);

    // Apply snapped position with animation
    stopwatchElement.style.left = `${snapped.x}px`;
    stopwatchElement.style.top = `${snapped.y}px`;

    // Save position
    saveCustomPosition(snapped);

    // Remove listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);

    e.preventDefault();
  }

  /**
   * Setup drag handlers on the stopwatch element
   */
  function setupDragHandlers() {
    if (!stopwatchElement) return;

    stopwatchElement.addEventListener('mousedown', handleDragStart);
    stopwatchElement.style.cursor = isMinimized ? 'pointer' : 'grab';
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
  let currentThemeCache = 'dark';

  /**
   * Get theme colors with additional computed colors for the stopwatch
   */
  function getThemeColors() {
    // Try to get current theme from ThemeManager
    let themeName = 'light';

    if (typeof ThemeManager !== 'undefined') {
      try {
        themeName = ThemeManager.getTheme() || 'dark';
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
    if (!StorageUtils.isExtensionContextValid()) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(['theme'], (result) => {
          if (chrome.runtime.lastError) {
            resolve();
            return;
          }
          currentThemeCache = result.theme || 'dark';
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

    // Setup drag handlers for moving the stopwatch
    setupDragHandlers();

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
      if (StorageUtils.isExtensionContextValid()) {
        try {
          chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'themeChanged') {
              currentThemeCache = message.theme || 'dark';
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
        cursor: grab;
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
        cursor: grab;
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
      const notificationTimeSeconds = getNotificationTimeForCurrentDomain();
      const elapsedSeconds = elapsed / 1000;
      if (elapsedSeconds >= notificationTimeSeconds) {
        showToastNotification(elapsed);
        notificationSent = true;
      }
    }
  }

  /**
   * Show browser alert notification and focus the tab (unless silent mode is enabled)
   * After user dismisses the alert (or immediately in silent mode), execute bookmarks if enabled
   */
  function showToastNotification(elapsed) {
    const hostname = window.location.hostname;
    const timeStr = formatTime(elapsed);
    const isSilent = isSilentModeForCurrentDomain();

    console.log('Stopwatch: showToastNotification called', {
      hostname,
      timeStr,
      isSilent,
      openBookmarksOnNotification: settings.openBookmarksOnNotification,
      bookmarksByDomain: settings.bookmarksByDomain
    });

    // Execute bookmarks/bookmarklets (called after alert or immediately in silent mode)
    const executeBookmarks = async () => {
      if (settings.openBookmarksOnNotification) {
        console.log('Stopwatch: openBookmarksOnNotification is enabled, checking for domain bookmarks');
        const domainBookmarks = getBookmarksForCurrentDomain();
        console.log('Stopwatch: Domain bookmarks found:', domainBookmarks);
        if (domainBookmarks.length > 0) {
          console.log('Stopwatch: Calling openSelectedBookmarks');
          try {
            await openSelectedBookmarks();
          } catch (e) {
            console.error('Stopwatch: Error in openSelectedBookmarks:', e);
          }
        } else {
          console.log('Stopwatch: No bookmarks configured for this domain');
          // Still execute custom bookmarklets even if no browser bookmarks configured
          await executeCustomBookmarklets();
        }
      } else {
        console.log('Stopwatch: openBookmarksOnNotification is disabled');
        // Execute custom bookmarklets even when browser bookmarks feature is disabled
        await executeCustomBookmarklets();
      }
    };

    // Silent mode: skip alert and execute bookmarks directly in background
    if (isSilent) {
      console.log('Stopwatch: Silent mode enabled, executing bookmarks without alert');
      executeBookmarks();
      return;
    }

    // Normal mode: show alert first
    const showAlert = async () => {
      console.log('Stopwatch: Showing alert');
      alert(`Time Alert!\n\nYou've been on ${hostname} for ${timeStr}`);
      console.log('Stopwatch: Alert dismissed by user');
      await executeBookmarks();
    };

    // First, request to focus this tab (brings user to this tab)
    if (StorageUtils.isExtensionContextValid()) {
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
   * Generate a random notification time for the current page load
   * Called once during initialization and stored for the session
   * @returns {number|null} Time in seconds, or null if random time not enabled
   */
  function generateRandomNotificationTime() {
    const currentHostname = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    // Check for per-domain random range first
    let rangeConfig = null;

    if (settings.randomTimeRangeByDomain && Object.keys(settings.randomTimeRangeByDomain).length > 0) {
      // Check exact match
      if (settings.randomTimeRangeByDomain[currentHostname]?.enabled) {
        rangeConfig = settings.randomTimeRangeByDomain[currentHostname];
      }

      // Check wildcard patterns using minimatch
      if (!rangeConfig) {
        for (const pattern of Object.keys(settings.randomTimeRangeByDomain)) {
          if (pattern === '*') continue;

          const config = settings.randomTimeRangeByDomain[pattern];
          if (!config?.enabled) continue;

          const isUrlPattern = pattern.includes('/') && !pattern.startsWith('*://');
          const matchTarget = isUrlPattern ? currentUrl : currentHostname;

          if (matchesPattern(matchTarget, pattern, currentHostname)) {
            rangeConfig = config;
            break;
          }
        }
      }

      // Check global wildcard
      if (!rangeConfig && settings.randomTimeRangeByDomain['*']?.enabled) {
        rangeConfig = settings.randomTimeRangeByDomain['*'];
      }
    }

    // Determine min/max seconds
    let minSeconds, maxSeconds;

    if (rangeConfig) {
      // Use per-domain range
      minSeconds = rangeConfig.minSeconds || 0;
      maxSeconds = rangeConfig.maxSeconds || 0;

      // If per-domain has incomplete values (either is 0), use global defaults
      // This prevents unexpected behavior when user only sets one value
      if (minSeconds === 0 || maxSeconds === 0) {
        minSeconds = settings.randomTimeMinMinutes * 60;
        maxSeconds = settings.randomTimeMaxMinutes * 60;
      }
    } else if (settings.useRandomTime) {
      // Use global random range
      minSeconds = settings.randomTimeMinMinutes * 60;
      maxSeconds = settings.randomTimeMaxMinutes * 60;
    } else {
      // Random time not enabled - return null (use fixed time)
      return null;
    }

    // Ensure min <= max
    if (minSeconds > maxSeconds) {
      [minSeconds, maxSeconds] = [maxSeconds, minSeconds];
    }

    // Handle edge case where both are 0
    if (minSeconds === 0 && maxSeconds === 0) {
      return null;
    }

    // Generate random time within range
    const randomSeconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;

    console.log(`Stopwatch: Generated random notification time: ${randomSeconds}s (range: ${minSeconds}-${maxSeconds}s)`);

    return randomSeconds;
  }

  /**
   * Get notification time in seconds for the current domain
   * Checks for exact match first, then partial matches, then wildcards
   * Falls back to default (notificationMinutes * 60) if no per-domain time set
   * @returns {number} Time in seconds
   */
  function getNotificationTimeForCurrentDomain() {
    // If we have a generated random time for this session, use it
    if (generatedRandomTimeSeconds !== null) {
      return generatedRandomTimeSeconds;
    }

    const currentHostname = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    if (!settings.notificationTimeByDomain || Object.keys(settings.notificationTimeByDomain).length === 0) {
      // No per-domain times set, use default (convert minutes to seconds)
      return settings.notificationMinutes * 60;
    }

    // Check for exact match first
    if (settings.notificationTimeByDomain[currentHostname] !== undefined) {
      return settings.notificationTimeByDomain[currentHostname];
    }

    // Check for partial matches and wildcard patterns using minimatch
    for (const pattern of Object.keys(settings.notificationTimeByDomain)) {
      if (pattern === '*') continue; // Handle global wildcard separately

      // Check if pattern contains path - if so, match against full URL
      const isUrlPattern = pattern.includes('/') && !pattern.startsWith('*://');
      const matchTarget = isUrlPattern ? currentUrl : currentHostname;

      if (matchesPattern(matchTarget, pattern, currentHostname)) {
        return settings.notificationTimeByDomain[pattern];
      }
    }

    // Check for global wildcard (*)
    if (settings.notificationTimeByDomain['*'] !== undefined) {
      return settings.notificationTimeByDomain['*'];
    }

    // Fall back to default (convert minutes to seconds)
    return settings.notificationMinutes * 60;
  }

  /**
   * Check if silent mode is enabled for the current domain
   * Checks for exact match first, then partial matches, then wildcards
   * Falls back to global notificationSilent setting if no per-domain setting
   * @returns {boolean} True if silent mode is enabled
   */
  function isSilentModeForCurrentDomain() {
    const currentHostname = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    if (!settings.silentModeByDomain || Object.keys(settings.silentModeByDomain).length === 0) {
      // No per-domain settings, use global setting
      return settings.notificationSilent;
    }

    // Check for exact match first
    if (settings.silentModeByDomain[currentHostname] !== undefined) {
      return settings.silentModeByDomain[currentHostname];
    }

    // Check for partial matches and wildcard patterns using minimatch
    for (const pattern of Object.keys(settings.silentModeByDomain)) {
      if (pattern === '*') continue; // Handle global wildcard separately

      // Check if pattern contains path - if so, match against full URL
      const isUrlPattern = pattern.includes('/') && !pattern.startsWith('*://');
      const matchTarget = isUrlPattern ? currentUrl : currentHostname;

      if (matchesPattern(matchTarget, pattern, currentHostname)) {
        return settings.silentModeByDomain[pattern];
      }
    }

    // Check for global wildcard (*)
    if (settings.silentModeByDomain['*'] !== undefined) {
      return settings.silentModeByDomain['*'];
    }

    // Fall back to global setting
    return settings.notificationSilent;
  }

  /**
   * Get the default delay between bookmarklets for the current domain
   * Checks domain-specific delay first, falls back to global bookmarkletDelay setting
   * Supports same wildcard patterns as isDomainIncluded()
   * @returns {number} Delay in milliseconds
   */
  function getBookmarkletDelayForCurrentDomain() {
    const currentHostname = window.location.hostname.toLowerCase();

    // Check if we have any domain-specific delay settings
    if (!settings.delayByDomain || Object.keys(settings.delayByDomain).length === 0) {
      return settings.bookmarkletDelay || 0;
    }

    // First check for exact domain match
    if (settings.delayByDomain[currentHostname] !== undefined) {
      return settings.delayByDomain[currentHostname];
    }

    // Check for wildcard/pattern matches using minimatch
    for (const pattern of Object.keys(settings.delayByDomain)) {
      // Skip exact match (already checked) and global wildcard
      if (pattern === currentHostname || pattern === '*') continue;

      if (matchesPattern(currentHostname, pattern, currentHostname)) {
        return settings.delayByDomain[pattern];
      }
    }

    // Check for catch-all wildcard
    if (settings.delayByDomain['*'] !== undefined) {
      return settings.delayByDomain['*'];
    }

    // Fall back to global setting
    return settings.bookmarkletDelay || 0;
  }

  /**
   * Get bookmarks for the current domain
   * Checks for exact match first, then partial matches, then wildcards/URL patterns
   * Supports same wildcard patterns as isDomainIncluded(): *.domain.com, domain.*, *keyword*
   * Also supports URL patterns with paths: *example.com/path*
   */
  function getBookmarksForCurrentDomain() {
    const currentHostname = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    if (!settings.bookmarksByDomain || Object.keys(settings.bookmarksByDomain).length === 0) {
      return [];
    }

    let result = [];

    // Check for exact match first
    if (settings.bookmarksByDomain[currentHostname]) {
      result = [...settings.bookmarksByDomain[currentHostname]];
    }

    // Check for partial matches and wildcard patterns using minimatch
    if (result.length === 0) {
      for (const pattern of Object.keys(settings.bookmarksByDomain)) {
        if (pattern === '*') continue; // Handle global wildcard separately

        // Check if pattern contains path - if so, match against full URL
        const isUrlPattern = pattern.includes('/') && !pattern.startsWith('*://');
        const matchTarget = isUrlPattern ? currentUrl : currentHostname;

        if (matchesPattern(matchTarget, pattern, currentHostname)) {
          result = [...settings.bookmarksByDomain[pattern]];
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
   * Execute custom bookmarklets (from the bookmarklet editor)
   * Fetches bookmarklet code from chrome.storage.local and executes via MediaLinksBookmarklets
   */
  async function executeCustomBookmarklets() {
    const bookmarkletIds = settings.globalBookmarklets || [];

    if (bookmarkletIds.length === 0) {
      console.log('Stopwatch: No global custom bookmarklets configured');
      return;
    }

    if (!StorageUtils.isExtensionContextValid()) {
      console.warn('Stopwatch: Extension context invalid, cannot execute custom bookmarklets');
      return;
    }

    console.log(`Stopwatch: Executing ${bookmarkletIds.length} global custom bookmarklet(s)`);

    try {
      // Fetch bookmarklet code from chrome.storage.local
      const data = await new Promise((resolve) => {
        chrome.storage.local.get(['customBookmarklets'], resolve);
      });

      const allBookmarklets = data.customBookmarklets || {};

      // Get the bookmarklets that match our IDs
      const toExecute = bookmarkletIds
        .map(id => allBookmarklets[id])
        .filter(bm => bm && bm.enabled !== false && bm.code);

      if (toExecute.length === 0) {
        console.log('Stopwatch: No enabled custom bookmarklets found with code');
        return;
      }

      // Convert to bookmark format for MediaLinksBookmarklets
      // Use BookmarkletParser if available for validation and proper URL generation
      const bookmarkletsWithUrl = toExecute.map(bm => {
        if (typeof BookmarkletParser !== 'undefined') {
          try {
            const parsed = BookmarkletParser.parseAndGenerate(bm.code);
            if (parsed.errors && parsed.errors.length > 0) {
              console.warn(`Stopwatch: Bookmarklet "${bm.name}" has parsing errors:`, parsed.errors);
            }
            return {
              title: parsed.options.name || bm.name || 'Custom Bookmarklet',
              url: parsed.url
            };
          } catch (e) {
            console.error(`Stopwatch: Failed to parse bookmarklet "${bm.name}":`, e);
            // Fallback to basic encoding
            return {
              title: bm.name || 'Custom Bookmarklet',
              url: 'javascript:' + encodeURIComponent(bm.code)
            };
          }
        } else {
          return {
            title: bm.name || 'Custom Bookmarklet',
            url: 'javascript:' + encodeURIComponent(bm.code)
          };
        }
      });

      if (window.MediaLinksBookmarklets) {
        const results = await window.MediaLinksBookmarklets.executeMultiple(bookmarkletsWithUrl);
        console.log('Stopwatch: Custom bookmarklet execution results:', results);
      } else {
        console.error('Stopwatch: MediaLinksBookmarklets not available');
      }
    } catch (e) {
      console.error('Stopwatch: Error executing custom bookmarklets:', e);
    }
  }

  /**
   * Open bookmarks for current domain
   * - Bookmarklets: Handled by bookmarklets.js (MediaLinksBookmarklets)
   * - Regular URLs: Send to background script to open in new tabs
   */
  async function openSelectedBookmarks() {
    console.log('Stopwatch: openSelectedBookmarks called');

    const bookmarks = getBookmarksForCurrentDomain();
    console.log('Stopwatch: Bookmarks for domain:', window.location.hostname, bookmarks);

    if (!bookmarks || bookmarks.length === 0) {
      console.log('Stopwatch: No bookmarks configured for this domain:', window.location.hostname);
      return;
    }

    // Separate bookmarklets from regular URLs and editor bookmarklets
    const bookmarklets = [];
    const regularBookmarks = [];
    const editorBookmarkletEntries = []; // Store full bookmark entry to preserve delayAfter

    for (const bookmark of bookmarks) {
      // Check if it's an editor bookmarklet (from bookmarklet editor)
      if (bookmark.isEditorBookmarklet && bookmark.editorBookmarkletId) {
        editorBookmarkletEntries.push(bookmark); // Keep full entry with delayAfter
        continue;
      }

      if (!bookmark.url) continue;

      // Check if it's a bookmarklet (javascript: URL)
      const isBookmarklet = bookmark.url.startsWith('javascript:');

      if (isBookmarklet) {
        bookmarklets.push(bookmark);
      } else {
        regularBookmarks.push(bookmark);
      }
    }

    // Fetch and add editor bookmarklets to the bookmarklets array
    if (editorBookmarkletEntries.length > 0) {
      try {
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(['customBookmarklets'], resolve);
        });
        const allBookmarklets = data.customBookmarklets || {};

        for (const entry of editorBookmarkletEntries) {
          const bm = allBookmarklets[entry.editorBookmarkletId];
          if (bm && bm.enabled !== false && bm.code) {
            bookmarklets.push({
              title: bm.name || 'Editor Bookmarklet',
              url: 'javascript:' + encodeURIComponent(bm.code),
              delayAfter: typeof entry.delayAfter === 'number' ? entry.delayAfter : 0
            });
          }
        }
      } catch (e) {
        console.error('Stopwatch: Error fetching editor bookmarklets:', e);
      }
    }

    console.log(`Stopwatch: Found ${bookmarklets.length} bookmarklet(s) (including ${editorBookmarkletEntries.length} from editor) and ${regularBookmarks.length} regular bookmark(s)`);

    // Execute bookmarklets using the bookmarklets.js handler
    if (bookmarklets.length > 0) {
      if (window.MediaLinksBookmarklets) {
        try {
          // Get default delay for this domain
          const defaultDelay = getBookmarkletDelayForCurrentDomain();
          console.log(`Stopwatch: Executing bookmarklets with defaultDelay: ${defaultDelay}ms`);

          // executeMultiple is async - must await it
          const results = await window.MediaLinksBookmarklets.executeMultiple(bookmarklets, { defaultDelay });
          console.log(`Stopwatch: Bookmarklet execution results:`, results);
        } catch (e) {
          console.error('Stopwatch: Bookmarklet execution error:', e);
        }
      } else {
        console.error('Stopwatch: MediaLinksBookmarklets not available');
      }
    }

    // Send regular bookmarks to background script to open in new tabs
    if (regularBookmarks.length > 0) {
      if (!StorageUtils.isExtensionContextValid()) {
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

    // Execute global custom bookmarklets (from the bookmarklet editor)
    await executeCustomBookmarklets();
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
    if (!StorageUtils.isExtensionContextValid()) return;

    try {
      return new Promise((resolve) => {
        chrome.storage.sync.get([
          'stopwatchEnabled',
          'stopwatchPosition',
          'stopwatchCustomPosition',
          'stopwatchNotificationEnabled',
          'stopwatchNotificationMinutes',
          'stopwatchMinimizedByDefault',
          'stopwatchIncludedDomains',
          'stopwatchOpenBookmarksOnNotification',
          'stopwatchBookmarksByDomain',
          'stopwatchNotificationTimeByDomain',
          'stopwatchGlobalBookmarklets',
          'stopwatchNotificationSilent',
          'stopwatchSilentModeByDomain',
          'stopwatchBookmarkletDelay',
          'stopwatchDelayByDomain',
          'stopwatchUseRandomTime',
          'stopwatchRandomTimeMinMinutes',
          'stopwatchRandomTimeMaxMinutes',
          'stopwatchRandomTimeRangeByDomain'
        ], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error loading stopwatch settings:', chrome.runtime.lastError);
            resolve();
            return;
          }

          settings.enabled = result.stopwatchEnabled === true;
          settings.position = result.stopwatchPosition || 'bottom-right';
          settings.customPosition = (result.stopwatchCustomPosition && typeof result.stopwatchCustomPosition === 'object') ? result.stopwatchCustomPosition : null;
          settings.notificationEnabled = result.stopwatchNotificationEnabled === true;
          settings.notificationMinutes = result.stopwatchNotificationMinutes || 30;
          settings.minimizedByDefault = result.stopwatchMinimizedByDefault === true;
          settings.includedDomains = result.stopwatchIncludedDomains || '';
          settings.openBookmarksOnNotification = result.stopwatchOpenBookmarksOnNotification === true;
          settings.bookmarksByDomain = (result.stopwatchBookmarksByDomain && typeof result.stopwatchBookmarksByDomain === 'object') ? result.stopwatchBookmarksByDomain : {};
          settings.notificationTimeByDomain = (result.stopwatchNotificationTimeByDomain && typeof result.stopwatchNotificationTimeByDomain === 'object') ? result.stopwatchNotificationTimeByDomain : {};
          settings.globalBookmarklets = Array.isArray(result.stopwatchGlobalBookmarklets) ? result.stopwatchGlobalBookmarklets : [];
          settings.notificationSilent = result.stopwatchNotificationSilent === true;
          settings.silentModeByDomain = (result.stopwatchSilentModeByDomain && typeof result.stopwatchSilentModeByDomain === 'object') ? result.stopwatchSilentModeByDomain : {};
          settings.bookmarkletDelay = typeof result.stopwatchBookmarkletDelay === 'number' ? result.stopwatchBookmarkletDelay : 0;
          settings.delayByDomain = (result.stopwatchDelayByDomain && typeof result.stopwatchDelayByDomain === 'object') ? result.stopwatchDelayByDomain : {};
          settings.useRandomTime = result.stopwatchUseRandomTime === true;
          settings.randomTimeMinMinutes = typeof result.stopwatchRandomTimeMinMinutes === 'number' ? result.stopwatchRandomTimeMinMinutes : 10;
          settings.randomTimeMaxMinutes = typeof result.stopwatchRandomTimeMaxMinutes === 'number' ? result.stopwatchRandomTimeMaxMinutes : 30;
          settings.randomTimeRangeByDomain = (result.stopwatchRandomTimeRangeByDomain && typeof result.stopwatchRandomTimeRangeByDomain === 'object') ? result.stopwatchRandomTimeRangeByDomain : {};

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

    // Generate random notification time for this page load (if enabled)
    generatedRandomTimeSeconds = generateRandomNotificationTime();

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
  if (StorageUtils.isExtensionContextValid()) {
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
          // When position preset changes, clear custom position
          settings.customPosition = null;
          if (stopwatchElement) {
            updateStopwatchUI();
          }
        }
        if (changes.stopwatchCustomPosition !== undefined) {
          const newPos = changes.stopwatchCustomPosition.newValue;
          settings.customPosition = (newPos && typeof newPos === 'object') ? newPos : null;
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
            const notificationTimeSeconds = getNotificationTimeForCurrentDomain();
            const elapsedSeconds = elapsed / 1000;
            if (elapsedSeconds < notificationTimeSeconds) {
              notificationSent = false;
            }
          }
        }
        if (changes.stopwatchNotificationTimeByDomain !== undefined) {
          const newValue = changes.stopwatchNotificationTimeByDomain.newValue;
          settings.notificationTimeByDomain = (newValue && typeof newValue === 'object') ? newValue : {};
          // Reset notification flag if per-domain time was extended
          if (notificationSent && startTime) {
            const elapsed = Date.now() - startTime;
            const notificationTimeSeconds = getNotificationTimeForCurrentDomain();
            const elapsedSeconds = elapsed / 1000;
            if (elapsedSeconds < notificationTimeSeconds) {
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
        if (changes.stopwatchGlobalBookmarklets !== undefined) {
          settings.globalBookmarklets = Array.isArray(changes.stopwatchGlobalBookmarklets.newValue) ? changes.stopwatchGlobalBookmarklets.newValue : [];
        }
        if (changes.stopwatchNotificationSilent !== undefined) {
          settings.notificationSilent = changes.stopwatchNotificationSilent.newValue === true;
        }
        if (changes.stopwatchSilentModeByDomain !== undefined) {
          const newValue = changes.stopwatchSilentModeByDomain.newValue;
          settings.silentModeByDomain = (newValue && typeof newValue === 'object') ? newValue : {};
        }
        if (changes.stopwatchBookmarkletDelay !== undefined) {
          settings.bookmarkletDelay = typeof changes.stopwatchBookmarkletDelay.newValue === 'number' ? changes.stopwatchBookmarkletDelay.newValue : 0;
        }
        if (changes.stopwatchDelayByDomain !== undefined) {
          const newValue = changes.stopwatchDelayByDomain.newValue;
          settings.delayByDomain = (newValue && typeof newValue === 'object') ? newValue : {};
        }
        // Random time settings (note: don't regenerate random time on settings change - only on page load)
        if (changes.stopwatchUseRandomTime !== undefined) {
          settings.useRandomTime = changes.stopwatchUseRandomTime.newValue === true;
        }
        if (changes.stopwatchRandomTimeMinMinutes !== undefined) {
          settings.randomTimeMinMinutes = typeof changes.stopwatchRandomTimeMinMinutes.newValue === 'number' ? changes.stopwatchRandomTimeMinMinutes.newValue : 10;
        }
        if (changes.stopwatchRandomTimeMaxMinutes !== undefined) {
          settings.randomTimeMaxMinutes = typeof changes.stopwatchRandomTimeMaxMinutes.newValue === 'number' ? changes.stopwatchRandomTimeMaxMinutes.newValue : 30;
        }
        if (changes.stopwatchRandomTimeRangeByDomain !== undefined) {
          const newValue = changes.stopwatchRandomTimeRangeByDomain.newValue;
          settings.randomTimeRangeByDomain = (newValue && typeof newValue === 'object') ? newValue : {};
        }

        // Handle theme changes
        if (changes.theme !== undefined) {
          currentThemeCache = changes.theme.newValue || 'dark';
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
