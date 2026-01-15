// Settings management
// Use centralized DEFAULT_SETTINGS from SettingsUtils to avoid duplication
const getDefaultSettings = () => {
  if (typeof window.SettingsUtils !== 'undefined') {
    return window.SettingsUtils.getDefaultSettings();
  }
  // Fallback defaults if SettingsUtils not loaded yet (shouldn't happen in normal flow)
  console.warn('SettingsUtils not available, using minimal fallback defaults');
  return {
    theme: 'dark',
    defaultSearchEngine: 'google',
    autoOpenResults: false,
    tabDelay: 150
  };
};

let currentSettings = getDefaultSettings();
let hasUnsavedChanges = false;

// Search profile patterns configuration
const patternDescriptions = {
  1: {
    'plain': { template: '{0}', display: 'Plain: element1' },
    'quoted': { template: '"{0}"', display: 'Quoted: "element1"' },
    'intitle': { template: 'intitle:"{0}"', display: 'In Title: intitle:"element1"' },
    'allintitle': { template: 'allintitle:{0}', display: 'All In Title: allintitle:element1' },
    'intext': { template: 'intext:"{0}"', display: 'In Text: intext:"element1"' }
  },
  2: {
    'plain': { template: '{0} {1}', display: 'Plain: element1 element2' },
    'first-quoted': { template: '"{0}" {1}', display: 'First Quoted: "element1" element2' },
    'second-quoted': { template: '{0} "{1}"', display: 'Second Quoted: element1 "element2"' },
    'both-quoted': { template: '"{0}" "{1}"', display: 'Both Quoted: "element1" "element2"' },
    'phrase': { template: '"{0} {1}"', display: 'Phrase: "element1 element2"' },
    'intitle': { template: 'intitle:"{0}" {1}', display: 'In Title: intitle:"element1" element2' },
    'and': { template: '"{0}" AND "{1}"', display: 'AND: "element1" AND "element2"' },
    'or': { template: '"{0}" OR "{1}"', display: 'OR: "element1" OR "element2"' }
  },
  3: {
    'plain': { template: '{0} {1} {2}', display: 'Plain: element1 element2 element3' },
    'all-quoted': { template: '"{0}" "{1}" "{2}"', display: 'All Quoted: "element1" "element2" "element3"' },
    'first-phrase': { template: '"{0} {1}" {2}', display: 'First Phrase: "element1 element2" element3' },
    'second-phrase': { template: '{0} "{1} {2}"', display: 'Second Phrase: element1 "element2 element3"' },
    'full-phrase': { template: '"{0} {1} {2}"', display: 'Full Phrase: "element1 element2 element3"' },
    'and': { template: '"{0}" AND "{1}" AND "{2}"', display: 'AND: "element1" AND "element2" AND "element3"' },
    'or': { template: '"{0}" OR "{1}" OR "{2}"', display: 'OR: "element1" OR "element2" OR "element3"' },
    'first-quoted': { template: '"{0}" {1} {2}', display: 'First Quoted: "element1" element2 element3' },
    'second-quoted': { template: '{0} "{1}" {2}', display: 'Second Quoted: element1 "element2" element3' },
    'third-quoted': { template: '{0} {1} "{2}"', display: 'Third Quoted: element1 element2 "element3"' },
    'first-two-quoted': { template: '"{0}" "{1}" {2}', display: 'First Two Quoted: "element1" "element2" element3' },
    'last-two-quoted': { template: '{0} "{1}" "{2}"', display: 'Last Two Quoted: element1 "element2" "element3"' }
  },
  4: {
    'plain': { template: '{0} {1} {2} {3}', display: 'Plain: element1 element2 element3 element4' },
    'all-quoted': { template: '"{0}" "{1}" "{2}" "{3}"', display: 'All Quoted: "element1" "element2" "element3" "element4"' },
    'paired': { template: '"{0} {1}" "{2} {3}"', display: 'Paired: "element1 element2" "element3 element4"' },
    'full-phrase': { template: '"{0} {1} {2} {3}"', display: 'Full Phrase: "element1 element2 element3 element4"' },
    'and': { template: '"{0}" AND "{1}" AND "{2}" AND "{3}"', display: 'AND: "element1" AND "element2" AND "element3" AND "element4"' },
    'or': { template: '"{0}" OR "{1}" OR "{2}" OR "{3}"', display: 'OR: "element1" OR "element2" OR "element3" OR "element4"' },
    'first-three-phrase': { template: '"{0} {1} {2}" {3}', display: 'First Three Phrase: "element1 element2 element3" element4' },
    'last-three-phrase': { template: '{0} "{1} {2} {3}"', display: 'Last Three Phrase: element1 "element2 element3 element4"' },
    'first-quoted': { template: '"{0}" {1} {2} {3}', display: 'First Quoted: "element1" element2 element3 element4' },
    'second-quoted': { template: '{0} "{1}" {2} {3}', display: 'Second Quoted: element1 "element2" element3 element4' },
    'third-quoted': { template: '{0} {1} "{2}" {3}', display: 'Third Quoted: element1 element2 "element3" element4' },
    'fourth-quoted': { template: '{0} {1} {2} "{3}"', display: 'Fourth Quoted: element1 element2 element3 "element4"' },
    'first-two-quoted': { template: '"{0}" "{1}" {2} {3}', display: 'First Two Quoted: "element1" "element2" element3 element4' },
    'last-two-quoted': { template: '{0} {1} "{2}" "{3}"', display: 'Last Two Quoted: element1 element2 "element3" "element4"' },
    'middle-pair': { template: '{0} "{1} {2}" {3}', display: 'Middle Pair: element1 "element2 element3" element4' }
  }
};

const defaultPatterns = {
  1: { 'plain': true, 'quoted': true, 'intitle': true, 'allintitle': true, 'intext': true },
  2: { 'plain': true, 'first-quoted': true, 'second-quoted': true, 'both-quoted': true, 'phrase': true, 'intitle': true, 'and': true, 'or': true },
  3: { 'plain': true, 'all-quoted': true, 'first-phrase': true, 'second-phrase': true, 'full-phrase': true, 'and': true, 'or': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true },
  4: { 'plain': true, 'all-quoted': true, 'paired': true, 'full-phrase': true, 'and': true, 'or': true, 'first-three-phrase': true, 'last-three-phrase': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'fourth-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true, 'middle-pair': true }
};

let profileSettings = {};
let currentProfile = 1;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings asynchronously
  await loadSettings();
  attachEventListeners();
  loadProfiles();
  loadProfileSettings();
  initializeSidebarNavigation();

  // Listen for theme changes from other pages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'themeChanged') {
      applyTheme(message.theme);
      // Update theme dropdown if it's not the source
      const themeSelect = document.getElementById('theme-select');
      if (themeSelect && themeSelect.value !== message.theme) {
        themeSelect.value = message.theme;
      }
    }
  });
});

// Load settings from storage
async function loadSettings() {
  try {
    if (typeof window.SettingsUtils !== 'undefined') {
      currentSettings = await window.SettingsUtils.loadSettings();
      console.log('Settings loaded via SettingsUtils');
    } else {
      // Fallback to direct chrome.storage if SettingsUtils not available
      const defaults = getDefaultSettings();
      await new Promise((resolve) => {
        chrome.storage.sync.get(defaults, (result) => {
          currentSettings = { ...defaults, ...result };
          resolve();
        });
      });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    currentSettings = getDefaultSettings();
  }

  applySettingsToUI();
  applyTheme(currentSettings.theme);
}

// Apply settings to UI elements
function applySettingsToUI() {
  // Helper function to safely set element values
  const safeSetValue = (elementId, value, isCheckbox = false) => {
    const element = document.getElementById(elementId);
    if (element) {
      if (isCheckbox) {
        element.checked = value;
      } else {
        element.value = value;
      }
    } else {
      console.warn(`Element with id '${elementId}' not found`);
    }
  };

  const safeSetChecked = (elementId, value) => {
    safeSetValue(elementId, value, true);
  };

  // Basic settings
  safeSetValue('theme-select', currentSettings.theme);
  safeSetChecked('show-sidebar-bookmarklet-runner', currentSettings.showSidebarBookmarkletRunner === true);
  safeSetValue('default-search-engine', currentSettings.defaultSearchEngine);
  safeSetValue('default-profile', currentSettings.defaultProfile || '');
  safeSetChecked('auto-open-results', currentSettings.autoOpenResults);
  safeSetValue('tab-delay', currentSettings.tabDelay);
  safeSetChecked('show-preview', currentSettings.showPreview);
  safeSetValue('default-cast-count', currentSettings.defaultCastCount);
  safeSetValue('default-content-format', currentSettings.defaultContentFormat);
  safeSetValue('default-output-format', currentSettings.defaultOutputFormat);
  safeSetChecked('debug-mode', currentSettings.debugMode);
  safeSetChecked('show-copy-webpage-btn', currentSettings.showCopyWebpageBtn !== undefined ? currentSettings.showCopyWebpageBtn : false);
  safeSetChecked('hotstar-auto-viewmore-paused', currentSettings.hotstarAutoViewMorePaused !== undefined ? currentSettings.hotstarAutoViewMorePaused : false);
  safeSetValue('hotstar-date-format', currentSettings.hotstarDateFormat || 'DD MMM YYYY');
  safeSetValue('customized-view-limit', currentSettings.customizedViewLimit || 8);

  // Copy webpage format settings
  const copyFormats = currentSettings.copyFormats;
  if (copyFormats && typeof copyFormats === 'object') {
    safeSetChecked('copy-include-title', copyFormats.includeTitle !== false);
    safeSetChecked('copy-include-url', copyFormats.includeURL !== false);
    // Convert stored separator string to option value
    safeSetValue('copy-separator', getSeparatorOption(copyFormats.separator || '\n\n---\n\n'));
  } else {
    // Use defaults if copyFormats is missing
    safeSetChecked('copy-include-title', true);
    safeSetChecked('copy-include-url', true);
    safeSetValue('copy-separator', 'horizontal-line');
  }

  // Copy button visibility settings
  safeSetChecked('show-imdb-cast', currentSettings.showImdbCast);
  safeSetChecked('show-imdb-company', currentSettings.showImdbCompany);
  safeSetChecked('show-imdb-awards', currentSettings.showImdbAwards);
  safeSetChecked('show-imdb-main', currentSettings.showImdbMain);
  safeSetChecked('show-wiki-cast', currentSettings.showWikiCast);
  safeSetChecked('show-wiki-tables', currentSettings.showWikiTables);
  safeSetValue('wiki-output-format', currentSettings.wikiOutputFormat);
  safeSetChecked('show-letterboxd-cast', currentSettings.showLetterboxdCast);
  safeSetValue('letterboxd-cast-count', currentSettings.letterboxdCastCount);
  safeSetValue('letterboxd-output-format', currentSettings.letterboxdOutputFormat);
  safeSetChecked('letterboxd-include-roles', currentSettings.letterboxdIncludeRoles);
  safeSetChecked('show-appletv-cast', currentSettings.showAppleTVCast);

  // Apple TV+ specific settings
  safeSetValue('appletv-cast-count', currentSettings.appleTVCastCount);
  safeSetValue('appletv-output-format', currentSettings.appleTVOutputFormat);
  safeSetChecked('appletv-include-roles', currentSettings.appleTVIncludeRoles);

  // BookMyShow specific settings
  safeSetChecked('show-bookmyshow-copy', currentSettings.showBookMyShowCopy !== false);
  safeSetValue('bookmyshow-cast-count', currentSettings.bookMyShowCastCount);
  safeSetValue('bookmyshow-output-format', currentSettings.bookMyShowOutputFormat);
  safeSetChecked('bookmyshow-include-roles', currentSettings.bookMyShowIncludeRoles);

  // YouTube settings
  safeSetChecked('show-youtube-transcript', currentSettings.showYouTubeTranscript !== false);

  // Customized view settings
  safeSetChecked('show-customized-view-btn', currentSettings.showCustomizedViewBtn !== false);
  safeSetChecked('auto-open-individual-view', currentSettings.autoOpenIndividualView !== false);
  safeSetChecked('show-consolidated-view-btn', currentSettings.showConsolidatedViewBtn !== false);
  safeSetChecked('auto-open-consolidated-view', currentSettings.autoOpenConsolidatedView !== false);

  // Wikipedia customized view settings
  safeSetChecked('show-wiki-customized-view-btn', currentSettings.showWikiCustomizedViewBtn !== false);
  safeSetChecked('auto-open-wiki-view', currentSettings.autoOpenWikiView !== false);

  // Comparison feature settings
  safeSetChecked('enable-comparison-feature', currentSettings.enableComparisonFeature === true);
  safeSetChecked('show-comparison-btn-wiki', currentSettings.showComparisonBtnWiki !== false);
  safeSetChecked('show-comparison-btn-imdb', currentSettings.showComparisonBtnImdb !== false);
  safeSetChecked('auto-open-comparison', currentSettings.autoOpenComparison !== false);

  // Toggle comparison settings subsection based on enable state
  toggleComparisonSettings(currentSettings.enableComparisonFeature === true);

  // Stopwatch settings
  safeSetChecked('stopwatch-enabled', currentSettings.stopwatchEnabled === true);
  safeSetValue('stopwatch-position', currentSettings.stopwatchPosition || 'bottom-right');
  safeSetChecked('stopwatch-minimized-default', currentSettings.stopwatchMinimizedByDefault === true);
  safeSetChecked('stopwatch-notification-enabled', currentSettings.stopwatchNotificationEnabled === true);
  safeSetValue('stopwatch-notification-minutes', currentSettings.stopwatchNotificationMinutes || 30);
  safeSetValue('stopwatch-included-domains', currentSettings.stopwatchIncludedDomains || '');

  // Load bookmarks by domain BEFORE rendering domain list
  // This ensures renderDomainTags() can access bookmark data
  const bookmarksByDomain = currentSettings.stopwatchBookmarksByDomain || {};
  const bookmarksHiddenInput = document.getElementById('stopwatch-bookmarks-by-domain');
  if (bookmarksHiddenInput) {
    bookmarksHiddenInput.value = JSON.stringify(bookmarksByDomain);
  }

  // Load notification times by domain
  const notificationTimeByDomain = currentSettings.stopwatchNotificationTimeByDomain || {};
  const notificationTimeHiddenInput = document.getElementById('stopwatch-notification-time-by-domain');
  if (notificationTimeHiddenInput) {
    notificationTimeHiddenInput.value = JSON.stringify(notificationTimeByDomain);
  }

  // Load silent mode by domain
  const silentModeByDomain = currentSettings.stopwatchSilentModeByDomain || {};
  const silentModeHiddenInput = document.getElementById('stopwatch-silent-mode-by-domain');
  if (silentModeHiddenInput) {
    silentModeHiddenInput.value = JSON.stringify(silentModeByDomain);
  }

  // Load delay by domain
  const delayByDomainSettings = currentSettings.stopwatchDelayByDomain || {};
  const delayByDomainHiddenInput = document.getElementById('stopwatch-delay-by-domain');
  if (delayByDomainHiddenInput) {
    delayByDomainHiddenInput.value = JSON.stringify(delayByDomainSettings);
  }

  // Load global silent mode and bookmarklet delay settings
  safeSetChecked('stopwatch-notification-silent', currentSettings.stopwatchNotificationSilent === true);
  safeSetValue('stopwatch-bookmarklet-delay', currentSettings.stopwatchBookmarkletDelay || 0);

  // Load random time settings
  safeSetChecked('stopwatch-use-random-time', currentSettings.stopwatchUseRandomTime === true);
  safeSetValue('stopwatch-random-min-minutes', currentSettings.stopwatchRandomTimeMinMinutes || 10);
  safeSetValue('stopwatch-random-max-minutes', currentSettings.stopwatchRandomTimeMaxMinutes || 30);

  // Load random time range by domain
  const randomTimeRangeByDomain = currentSettings.stopwatchRandomTimeRangeByDomain || {};
  const randomTimeRangeHiddenInput = document.getElementById('stopwatch-random-time-range-by-domain');
  if (randomTimeRangeHiddenInput) {
    randomTimeRangeHiddenInput.value = JSON.stringify(randomTimeRangeByDomain);
  }

  // Render domain tags from the hidden input value (now has bookmark data)
  renderDomainTags();

  // Toggle stopwatch options subsection based on enable state
  toggleStopwatchSettings(currentSettings.stopwatchEnabled === true);
  toggleNotificationMinutes(currentSettings.stopwatchNotificationEnabled === true);
  toggleRandomTimeRange(currentSettings.stopwatchUseRandomTime === true);

  // Bookmark settings
  safeSetChecked('stopwatch-open-bookmarks', currentSettings.stopwatchOpenBookmarksOnNotification === true);
  toggleBookmarkSettings(currentSettings.stopwatchNotificationEnabled === true);
  toggleBookmarkSelector(currentSettings.stopwatchOpenBookmarksOnNotification === true);

  // Load global bookmarklets list for stopwatch
  loadGlobalBookmarkletsList();

  // Note: bookmarksByDomain hidden input is now populated earlier (before renderDomainTags)

  // Set default view columns
  const defaultColumns = currentSettings.defaultViewColumns || ['name', 'role', 'roleType'];
  const columnCheckboxes = document.querySelectorAll('.view-column-checkbox');
  columnCheckboxes.forEach(checkbox => {
    checkbox.checked = defaultColumns.includes(checkbox.value);
  });

  hasUnsavedChanges = false;
}

// Load available profiles
function loadProfiles() {
  chrome.storage.sync.get(['profiles'], (result) => {
    const profiles = result.profiles || {};
    const select = document.getElementById('default-profile');

    // Safety check - element must exist
    if (!select) {
      console.warn('default-profile element not found');
      return;
    }

    // Clear existing options except the first one
    select.innerHTML = '<option value="">No default (load last used)</option>';

    // Add profile options
    Object.keys(profiles).forEach(profileName => {
      const option = document.createElement('option');
      option.value = profileName;
      option.textContent = profileName;
      select.appendChild(option);
    });

    // Set current value
    select.value = currentSettings.defaultProfile || '';
  });
}

// Apply theme
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// Attach event listeners
function attachEventListeners() {
  // Helper function to safely get element and attach listener
  const safeAddListener = (elementId, eventType, handler) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener(eventType, handler);
    } else {
      console.warn(`Element with id '${elementId}' not found`);
    }
  };

  // Theme change
  safeAddListener('theme-select', 'change', (e) => {
    applyTheme(e.target.value);
    markUnsaved();
  });

  // Comparison feature toggle
  safeAddListener('enable-comparison-feature', 'change', (e) => {
    toggleComparisonSettings(e.target.checked);
    markUnsaved();
  });

  // Stopwatch feature toggle
  safeAddListener('stopwatch-enabled', 'change', (e) => {
    toggleStopwatchSettings(e.target.checked);
    markUnsaved();
  });

  // Stopwatch notification toggle
  safeAddListener('stopwatch-notification-enabled', 'change', (e) => {
    toggleNotificationMinutes(e.target.checked);
    toggleBookmarkSettings(e.target.checked);
    toggleCustomBookmarkletsContainer();
    // Also update random time range visibility based on current toggle state
    const useRandomTime = document.getElementById('stopwatch-use-random-time');
    toggleRandomTimeRange(useRandomTime && useRandomTime.checked);
    markUnsaved();
  });

  // Stopwatch open bookmarks toggle
  safeAddListener('stopwatch-open-bookmarks', 'change', (e) => {
    toggleBookmarkSelector(e.target.checked);
    markUnsaved();
  });

  // Stopwatch random time toggle
  safeAddListener('stopwatch-use-random-time', 'change', (e) => {
    toggleRandomTimeRange(e.target.checked);
    markUnsaved();
  });

  // Stopwatch reset position button
  safeAddListener('stopwatch-reset-position', 'click', () => {
    // Clear the custom position from storage
    chrome.storage.sync.set({ stopwatchCustomPosition: null }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Error resetting stopwatch position:', chrome.runtime.lastError);
      } else {
        showStatus('Stopwatch position reset to default (bottom-right)', 'success');
      }
    });
  });

  // Bookmarklet Editor button
  safeAddListener('open-bookmarklet-editor', 'click', () => {
    const editorUrl = chrome.runtime.getURL('bookmarklet-editor/bookmarkleteditor.html');
    chrome.tabs.create({ url: editorUrl });
  });

  // Use event delegation for all input changes (single listener instead of many)
  // This prevents duplicate listeners from stacking when the page is reopened
  document.addEventListener('change', (e) => {
    if (e.target.matches('input, select')) {
      markUnsaved();
    }
  }, { once: false });

  // Save button
  safeAddListener('save-btn', 'click', saveSettings);

  // Cancel button
  safeAddListener('cancel-btn', 'click', async () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        await loadSettings();
        window.close();
      }
    } else {
      window.close();
    }
  });

  // Close button
  safeAddListener('close-btn', 'click', async () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        await loadSettings();
        window.close();
      }
    } else {
      window.close();
    }
  });

  // Reset button
  safeAddListener('reset-btn', 'click', resetSettings);

  // Profile buttons
  const saveProfileBtn = document.getElementById('save-profile-btn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', saveProfileSettings);
  }

  const resetProfileBtn = document.getElementById('reset-profile-btn');
  if (resetProfileBtn) {
    resetProfileBtn.addEventListener('click', resetProfileSettings);
  }

  const selectAllProfileBtn = document.getElementById('select-all-profile-btn');
  if (selectAllProfileBtn) {
    selectAllProfileBtn.addEventListener('click', selectAllProfile);
  }

  const deselectAllProfileBtn = document.getElementById('deselect-all-profile-btn');
  if (deselectAllProfileBtn) {
    deselectAllProfileBtn.addEventListener('click', deselectAllProfile);
  }

  // Warn before closing with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Initialize domain tag interface for stopwatch
  initializeDomainTagListeners();
}

// Mark settings as unsaved
function markUnsaved() {
  hasUnsavedChanges = true;
  showStatus('Unsaved changes', 'warning');
}

// Toggle comparison settings subsection visibility
function toggleComparisonSettings(enabled) {
  const subsection = document.getElementById('comparison-settings');
  if (subsection) {
    if (enabled) {
      subsection.style.opacity = '1';
      subsection.style.pointerEvents = 'auto';
      subsection.setAttribute('aria-disabled', 'false');
      // Enable all inputs
      const inputs = subsection.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.disabled = false;
      });
    } else {
      subsection.style.opacity = '0.5';
      subsection.style.pointerEvents = 'none';
      subsection.setAttribute('aria-disabled', 'true');
      // Disable all inputs to prevent keyboard focus
      const inputs = subsection.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.disabled = true;
      });
    }
  }
}

// Toggle stopwatch settings subsection visibility
function toggleStopwatchSettings(enabled) {
  const subsection = document.getElementById('stopwatch-options');
  if (subsection) {
    if (enabled) {
      subsection.style.opacity = '1';
      subsection.style.pointerEvents = 'auto';
      subsection.setAttribute('aria-disabled', 'false');
      const inputs = subsection.querySelectorAll('input, select');
      inputs.forEach(input => {
        // Don't enable notification minutes if notifications are disabled
        if (input.id === 'stopwatch-notification-minutes') {
          const notifEnabled = document.getElementById('stopwatch-notification-enabled');
          input.disabled = !(notifEnabled && notifEnabled.checked);
        } else {
          input.disabled = false;
        }
      });
    } else {
      subsection.style.opacity = '0.5';
      subsection.style.pointerEvents = 'none';
      subsection.setAttribute('aria-disabled', 'true');
      const inputs = subsection.querySelectorAll('input, select');
      inputs.forEach(input => {
        input.disabled = true;
      });
    }
  }
}

// Toggle notification minutes input visibility
function toggleNotificationMinutes(enabled) {
  // Toggle notification minutes container
  const container = document.getElementById('notification-minutes-container');
  if (container) {
    if (enabled) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      const input = container.querySelector('input');
      if (input) input.disabled = false;
    } else {
      container.style.opacity = '0.5';
      container.style.pointerEvents = 'none';
      const input = container.querySelector('input');
      if (input) input.disabled = true;
    }
  }

  // Toggle silent mode container
  const silentContainer = document.getElementById('silent-mode-container');
  if (silentContainer) {
    if (enabled) {
      silentContainer.style.opacity = '1';
      silentContainer.style.pointerEvents = 'auto';
      const input = silentContainer.querySelector('input');
      if (input) input.disabled = false;
    } else {
      silentContainer.style.opacity = '0.5';
      silentContainer.style.pointerEvents = 'none';
      const input = silentContainer.querySelector('input');
      if (input) input.disabled = true;
    }
  }

  // Toggle bookmarklet delay container
  const delayContainer = document.getElementById('bookmarklet-delay-container');
  if (delayContainer) {
    if (enabled) {
      delayContainer.style.opacity = '1';
      delayContainer.style.pointerEvents = 'auto';
      const input = delayContainer.querySelector('input');
      if (input) input.disabled = false;
    } else {
      delayContainer.style.opacity = '0.5';
      delayContainer.style.pointerEvents = 'none';
      const input = delayContainer.querySelector('input');
      if (input) input.disabled = true;
    }
  }

  // Toggle random time toggle container
  const randomToggleContainer = document.getElementById('random-time-toggle-container');
  if (randomToggleContainer) {
    if (enabled) {
      randomToggleContainer.style.opacity = '1';
      randomToggleContainer.style.pointerEvents = 'auto';
      const input = randomToggleContainer.querySelector('input');
      if (input) input.disabled = false;
    } else {
      randomToggleContainer.style.opacity = '0.5';
      randomToggleContainer.style.pointerEvents = 'none';
      const input = randomToggleContainer.querySelector('input');
      if (input) input.disabled = true;
    }
  }
  // Note: random-time-range-container is handled by toggleRandomTimeRange()
}

// Toggle random time range inputs visibility (depends on random time toggle)
function toggleRandomTimeRange(enabled) {
  const notifEnabled = document.getElementById('stopwatch-notification-enabled');
  const notificationsOn = notifEnabled && notifEnabled.checked;

  // Show/hide the fixed notification time input
  const fixedContainer = document.getElementById('notification-minutes-container');
  if (fixedContainer) {
    if (enabled && notificationsOn) {
      // Hide fixed time when random is enabled
      fixedContainer.style.display = 'none';
    } else {
      // Show fixed time when random is disabled
      fixedContainer.style.display = 'block';
    }
  }

  // Show/hide the random time range inputs
  const randomRangeContainer = document.getElementById('random-time-range-container');
  if (randomRangeContainer) {
    if (enabled && notificationsOn) {
      randomRangeContainer.style.display = 'block';
      randomRangeContainer.style.opacity = '1';
      randomRangeContainer.style.pointerEvents = 'auto';
      const inputs = randomRangeContainer.querySelectorAll('input');
      inputs.forEach(input => input.disabled = false);
    } else {
      randomRangeContainer.style.display = 'none';
      randomRangeContainer.style.opacity = '0.5';
      randomRangeContainer.style.pointerEvents = 'none';
      const inputs = randomRangeContainer.querySelectorAll('input');
      inputs.forEach(input => input.disabled = true);
    }
  }
}

// Toggle bookmark settings visibility (depends on notification being enabled)
function toggleBookmarkSettings(enabled) {
  const container = document.getElementById('open-bookmarks-container');
  if (container) {
    if (enabled) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      const input = container.querySelector('input');
      if (input) input.disabled = false;
    } else {
      container.style.opacity = '0.5';
      container.style.pointerEvents = 'none';
      const input = container.querySelector('input');
      if (input) input.disabled = true;
      // Also disable bookmark selector when notification is disabled
      toggleBookmarkSelector(false);
    }
  }
}

// Toggle bookmark selector visibility (depends on open bookmarks being enabled)
function toggleBookmarkSelector(enabled) {
  const container = document.getElementById('bookmark-selector-container');
  if (container) {
    // Only enable if parent setting (notification) is also enabled
    const notifEnabled = document.getElementById('stopwatch-notification-enabled');
    const actuallyEnabled = enabled && notifEnabled && notifEnabled.checked;

    if (actuallyEnabled) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
      const btn = container.querySelector('button');
      if (btn) btn.disabled = false;
    } else {
      container.style.opacity = '0.5';
      container.style.pointerEvents = 'none';
      const btn = container.querySelector('button');
      if (btn) btn.disabled = true;
    }
  }

  // Also toggle custom bookmarklets container
  toggleCustomBookmarkletsContainer();
}

// Toggle custom bookmarklets container visibility (only depends on notification being enabled)
function toggleCustomBookmarkletsContainer() {
  const container = document.getElementById('custom-bookmarklets-container');
  if (container) {
    const notifEnabled = document.getElementById('stopwatch-notification-enabled');
    const isEnabled = notifEnabled && notifEnabled.checked;

    if (isEnabled) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
    } else {
      container.style.opacity = '0.5';
      container.style.pointerEvents = 'none';
    }
  }
}

/**
 * Load and render global bookmarklets checklist
 */
async function loadGlobalBookmarkletsList() {
  const container = document.getElementById('global-bookmarklets-list');
  if (!container) return;

  try {
    // Get custom bookmarklets from chrome.storage.local
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['customBookmarklets'], resolve);
    });

    const bookmarklets = data.customBookmarklets || {};
    const sortedBookmarklets = Object.values(bookmarklets)
      .filter(bm => bm.enabled !== false)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Get currently selected global bookmarklets
    const selectedGlobal = currentSettings.stopwatchGlobalBookmarklets || [];
    const selectedIds = new Set(selectedGlobal);

    // Clear container
    container.innerHTML = '';

    if (sortedBookmarklets.length === 0) {
      container.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--text-muted); font-style: italic;">No bookmarklets saved. Create some in the Editor.</p>';
      return;
    }

    // Create checkboxes for each bookmarklet
    sortedBookmarklets.forEach(bm => {
      const label = document.createElement('label');
      label.style.cssText = 'display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px; margin: 2px 0;';
      label.addEventListener('mouseenter', () => label.style.background = 'var(--hover-color)');
      label.addEventListener('mouseleave', () => label.style.background = 'transparent');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIds.has(bm.id);
      checkbox.dataset.bookmarkletId = bm.id;
      checkbox.className = 'global-bookmarklet-checkbox';
      checkbox.style.cssText = 'margin-right: 8px; cursor: pointer; accent-color: var(--accent);';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = bm.name || 'Untitled';
      nameSpan.style.cssText = 'font-size: 13px; color: var(--text-primary);';

      label.appendChild(checkbox);
      label.appendChild(nameSpan);
      container.appendChild(label);
    });
  } catch (error) {
    console.error('Error loading bookmarklets:', error);
    container.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--danger);">Error loading bookmarklets</p>';
  }
}

/**
 * Get selected global bookmarklet IDs from checkboxes
 */
function getSelectedGlobalBookmarklets() {
  const checkboxes = document.querySelectorAll('.global-bookmarklet-checkbox:checked');
  return Array.from(checkboxes).map(cb => cb.dataset.bookmarkletId).filter(Boolean);
}

// Save settings
function saveSettings() {
  // Helper function to safely get element values with fallbacks
  const getSafeValue = (elementId, type = 'value') => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element '${elementId}' not found - using fallback`);
      return type === 'checked' ? false : '';
    }
    return type === 'checked' ? element.checked : element.value;
  };

  // Collect all settings with safe DOM access
  const newSettings = {
    theme: getSafeValue('theme-select'),
    showSidebarBookmarkletRunner: getSafeValue('show-sidebar-bookmarklet-runner', 'checked'),
    defaultSearchEngine: getSafeValue('default-search-engine'),
    defaultProfile: getSafeValue('default-profile'),
    autoOpenResults: getSafeValue('auto-open-results', 'checked'),
    tabDelay: validateNumericInput(getSafeValue('tab-delay'), 0, 5000, 150),
    showPreview: getSafeValue('show-preview', 'checked'),
    defaultCastCount: validateNumericInput(getSafeValue('default-cast-count'), 1, 1000, 5),
    defaultContentFormat: getSafeValue('default-content-format'),
    defaultOutputFormat: getSafeValue('default-output-format'),
    debugMode: getSafeValue('debug-mode', 'checked'),
    showCopyWebpageBtn: getSafeValue('show-copy-webpage-btn', 'checked'),
    hotstarAutoViewMorePaused: getSafeValue('hotstar-auto-viewmore-paused', 'checked'),
    hotstarDateFormat: getSafeValue('hotstar-date-format'),
    customizedViewLimit: validateNumericInput(getSafeValue('customized-view-limit'), 1, 1000, 8),
    // Copy webpage format settings
    copyFormats: {
      includeTitle: getSafeValue('copy-include-title', 'checked'),
      includeURL: getSafeValue('copy-include-url', 'checked'),
      separator: getSeparatorValue(getSafeValue('copy-separator'))
    },
    // Copy button visibility settings
    showImdbCast: getSafeValue('show-imdb-cast', 'checked'),
    showImdbCompany: getSafeValue('show-imdb-company', 'checked'),
    showImdbAwards: getSafeValue('show-imdb-awards', 'checked'),
    showImdbMain: getSafeValue('show-imdb-main', 'checked'),
    showWikiCast: getSafeValue('show-wiki-cast', 'checked'),
    showWikiTables: getSafeValue('show-wiki-tables', 'checked'),
    wikiOutputFormat: getSafeValue('wiki-output-format'),
    showLetterboxdCast: getSafeValue('show-letterboxd-cast', 'checked'),
    letterboxdCastCount: validateNumericInput(getSafeValue('letterboxd-cast-count'), 1, 1000, 10),
    letterboxdOutputFormat: getSafeValue('letterboxd-output-format'),
    letterboxdIncludeRoles: getSafeValue('letterboxd-include-roles', 'checked'),
    showAppleTVCast: getSafeValue('show-appletv-cast', 'checked'),
    // Apple TV+ specific settings
    appleTVCastCount: validateNumericInput(getSafeValue('appletv-cast-count'), 1, 1000, 10),
    appleTVOutputFormat: getSafeValue('appletv-output-format'),
    appleTVIncludeRoles: getSafeValue('appletv-include-roles', 'checked'),
    // BookMyShow specific settings
    showBookMyShowCopy: getSafeValue('show-bookmyshow-copy', 'checked'),
    bookMyShowCastCount: validateNumericInput(getSafeValue('bookmyshow-cast-count'), 1, 1000, 10),
    bookMyShowOutputFormat: getSafeValue('bookmyshow-output-format'),
    bookMyShowIncludeRoles: getSafeValue('bookmyshow-include-roles', 'checked'),
    // YouTube settings
    showYouTubeTranscript: getSafeValue('show-youtube-transcript', 'checked'),
    // Customized view settings
    showCustomizedViewBtn: getSafeValue('show-customized-view-btn', 'checked'),
    autoOpenIndividualView: getSafeValue('auto-open-individual-view', 'checked'),
    showConsolidatedViewBtn: getSafeValue('show-consolidated-view-btn', 'checked'),
    autoOpenConsolidatedView: getSafeValue('auto-open-consolidated-view', 'checked'),
    defaultViewColumns: Array.from(document.querySelectorAll('.view-column-checkbox:checked')).map(cb => cb.value),
    // Wikipedia customized view settings
    showWikiCustomizedViewBtn: getSafeValue('show-wiki-customized-view-btn', 'checked'),
    autoOpenWikiView: getSafeValue('auto-open-wiki-view', 'checked'),
    // Comparison feature settings
    enableComparisonFeature: getSafeValue('enable-comparison-feature', 'checked'),
    showComparisonBtnWiki: getSafeValue('show-comparison-btn-wiki', 'checked'),
    showComparisonBtnImdb: getSafeValue('show-comparison-btn-imdb', 'checked'),
    autoOpenComparison: getSafeValue('auto-open-comparison', 'checked'),
    // Stopwatch settings
    stopwatchEnabled: getSafeValue('stopwatch-enabled', 'checked'),
    stopwatchPosition: getSafeValue('stopwatch-position'),
    stopwatchMinimizedByDefault: getSafeValue('stopwatch-minimized-default', 'checked'),
    stopwatchNotificationEnabled: getSafeValue('stopwatch-notification-enabled', 'checked'),
    stopwatchNotificationMinutes: validateNumericInput(getSafeValue('stopwatch-notification-minutes'), 1, 1440, 30),
    stopwatchIncludedDomains: getSafeValue('stopwatch-included-domains'),
    stopwatchOpenBookmarksOnNotification: getSafeValue('stopwatch-open-bookmarks', 'checked'),
    stopwatchBookmarksByDomain: parseBookmarksByDomain(getSafeValue('stopwatch-bookmarks-by-domain')),
    stopwatchNotificationTimeByDomain: parseNotificationTimeByDomain(getSafeValue('stopwatch-notification-time-by-domain')),
    stopwatchGlobalBookmarklets: getSelectedGlobalBookmarklets(),
    stopwatchNotificationSilent: getSafeValue('stopwatch-notification-silent', 'checked'),
    stopwatchSilentModeByDomain: parseSilentModeByDomain(getSafeValue('stopwatch-silent-mode-by-domain')),
    stopwatchDelayByDomain: parseDelayByDomain(getSafeValue('stopwatch-delay-by-domain')),
    stopwatchBookmarkletDelay: validateNumericInput(getSafeValue('stopwatch-bookmarklet-delay'), 0, 60000, 0),
    stopwatchUseRandomTime: getSafeValue('stopwatch-use-random-time', 'checked'),
    stopwatchRandomTimeMinMinutes: validateNumericInput(getSafeValue('stopwatch-random-min-minutes'), 1, 1440, 10),
    stopwatchRandomTimeMaxMinutes: validateNumericInput(getSafeValue('stopwatch-random-max-minutes'), 1, 1440, 30),
    stopwatchRandomTimeRangeByDomain: parseRandomTimeRangeByDomain(getSafeValue('stopwatch-random-time-range-by-domain'))
  };

  // Save to storage using SettingsUtils with validation
  if (typeof window.SettingsUtils !== 'undefined') {
    window.SettingsUtils.saveSettings(newSettings)
      .then((validated) => {
        currentSettings = { ...validated };
        hasUnsavedChanges = false;
        showStatus('✓ Settings saved successfully!', 'success');

        // Notify other pages about theme change
        try {
          chrome.runtime.sendMessage({
            type: 'themeChanged',
            theme: validated.theme
          });
        } catch (error) {
          // Ignore error if no listeners are registered
          console.log('No listeners for theme change message (this is normal)');
        }
      })
      .catch((error) => {
        showStatus('Error saving settings: ' + error.message, 'error');
      });
  } else {
    // Fallback to direct chrome.storage if SettingsUtils not available
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        currentSettings = { ...newSettings };
        hasUnsavedChanges = false;
        showStatus('✓ Settings saved successfully!', 'success');

        try {
          chrome.runtime.sendMessage({
            type: 'themeChanged',
            theme: newSettings.theme
          });
        } catch (error) {
          // Ignore error if no listeners are registered
          console.log('No listeners for theme change message (this is normal)');
        }
      }
    });
  }
}

// Reset settings
async function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
    try {
      const defaults = getDefaultSettings();
      if (typeof window.SettingsUtils !== 'undefined') {
        await window.SettingsUtils.resetSettings();
        currentSettings = { ...window.SettingsUtils.getDefaultSettings() };
      } else {
        // Fallback to direct chrome.storage
        chrome.storage.sync.clear(() => {
          currentSettings = { ...defaults };
        });
      }

      applySettingsToUI();
      applyTheme(defaults.theme);
      showStatus('✓ Settings reset to defaults', 'success');

      // Notify other pages about theme change
      try {
        chrome.runtime.sendMessage({
          type: 'themeChanged',
          theme: defaults.theme
        });
      } catch (error) {
        // Ignore error if no listeners are registered
        console.log('No listeners for theme change message (this is normal)');
      }
    } catch (error) {
      showStatus('Error resetting settings: ' + error.message, 'error');
    }
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'save-status ' + type;

    // Clear success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'save-status';
      }, 3000);
    }
  }
}

// Validate numeric inputs
function validateNumericInput(value, min, max, defaultVal) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// Convert separator option values to actual strings with newlines
function getSeparatorValue(optionValue) {
  const separators = {
    'horizontal-line': '\n\n---\n\n',
    'double-line': '\n\n===\n\n',
    'double-newline': '\n\n',
    'asterisks': '\n\n***\n\n',
    'long-line': '\n\n========================================\n\n'
  };
  return separators[optionValue] || '\n\n---\n\n';
}

// Convert separator string back to option value
function getSeparatorOption(separatorString) {
  const mapping = {
    '\n\n---\n\n': 'horizontal-line',
    '\n\n===\n\n': 'double-line',
    '\n\n': 'double-newline',
    '\n\n***\n\n': 'asterisks',
    '\n\n========================================\n\n': 'long-line'
  };
  return mapping[separatorString] || 'horizontal-line';
}

// Domain List Management Functions
function renderDomainList() {
  const listContainer = document.getElementById('stopwatch-domain-list');
  const hiddenInput = document.getElementById('stopwatch-included-domains');
  const bookmarksInput = document.getElementById('stopwatch-bookmarks-by-domain');
  const notificationTimeInput = document.getElementById('stopwatch-notification-time-by-domain');
  const silentModeInput = document.getElementById('stopwatch-silent-mode-by-domain');
  const delayInput = document.getElementById('stopwatch-delay-by-domain');

  if (!listContainer || !hiddenInput) return;

  // Clear existing list items
  listContainer.innerHTML = '';

  // Get domains from hidden input
  const domainsStr = hiddenInput.value || '';
  const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

  // Get bookmarks by domain
  const bookmarksByDomain = parseBookmarksByDomain(bookmarksInput ? bookmarksInput.value : '');

  // Get notification times by domain
  const notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeInput ? notificationTimeInput.value : '');

  // Get silent mode by domain
  const silentModeByDomain = parseSilentModeByDomain(silentModeInput ? silentModeInput.value : '');

  // Get delay by domain
  const delayByDomain = parseDelayByDomain(delayInput ? delayInput.value : '');

  // Get random time range by domain
  const randomRangeInput = document.getElementById('stopwatch-random-time-range-by-domain');
  const randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeInput ? randomRangeInput.value : '');

  if (domains.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'color: var(--text-secondary); font-size: 12px; padding: 8px 0;';
    emptyMsg.textContent = 'No domains added. Stopwatch will appear on all sites.';
    listContainer.appendChild(emptyMsg);
    return;
  }

  // Create list items for each domain
  domains.forEach(domain => {
    const bookmarks = bookmarksByDomain[domain] || [];
    const notificationTime = notificationTimeByDomain[domain]; // in seconds, may be undefined
    const silentMode = silentModeByDomain[domain]; // boolean, may be undefined
    const domainDelay = delayByDomain[domain]; // in ms, may be undefined
    const randomRange = randomRangeByDomain[domain]; // { enabled, minSeconds, maxSeconds }, may be undefined
    const item = createDomainListItem(domain, bookmarks, notificationTime, silentMode, domainDelay, randomRange);
    listContainer.appendChild(item);
  });
}

function createDomainListItem(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange) {
  const item = document.createElement('div');
  item.className = 'domain-list-item';
  item.style.cssText = 'display: flex; flex-direction: column; padding: 12px; margin: 6px 0; background: var(--surface-bg); border-radius: 8px; gap: 8px;';

  // Top row: domain name and actions
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'domain-name';
  nameSpan.textContent = domain;
  nameSpan.style.cssText = 'font-weight: 600; color: var(--text-primary); flex: 1;';

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  const configBtn = document.createElement('button');
  configBtn.type = 'button';
  configBtn.className = 'secondary-button';
  configBtn.style.cssText = 'padding: 4px 10px; font-size: 12px;';
  configBtn.textContent = 'Configure';
  configBtn.addEventListener('click', () => openEditSiteModal(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-domain';
  removeBtn.innerHTML = '×';
  removeBtn.title = 'Remove ' + domain;
  removeBtn.style.cssText = 'background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 0 4px;';
  removeBtn.addEventListener('click', () => removeDomain(domain));
  removeBtn.addEventListener('mouseenter', () => removeBtn.style.color = 'var(--danger)');
  removeBtn.addEventListener('mouseleave', () => removeBtn.style.color = 'var(--text-secondary)');

  actions.appendChild(configBtn);
  actions.appendChild(removeBtn);

  topRow.appendChild(nameSpan);
  topRow.appendChild(actions);

  item.appendChild(topRow);

  // Info row: notification time, silent mode, and bookmarks
  const infoRow = document.createElement('div');
  infoRow.style.cssText = 'font-size: 12px; color: var(--text-secondary); padding-left: 4px; display: flex; flex-wrap: wrap; gap: 12px;';

  // Notification time info
  if (notificationTimeSeconds && notificationTimeSeconds > 0) {
    const timeInfo = document.createElement('span');
    timeInfo.textContent = `⏰ ${formatSecondsToMMSS(notificationTimeSeconds)}`;
    timeInfo.title = 'Notification time (MM:SS)';
    infoRow.appendChild(timeInfo);
  }

  // Silent mode info
  if (silentMode === true) {
    const silentInfo = document.createElement('span');
    silentInfo.textContent = '🔇 Silent';
    silentInfo.title = 'Silent mode enabled - no popup notification';
    infoRow.appendChild(silentInfo);
  }

  // Random time range info
  if (randomTimeRange && randomTimeRange.enabled) {
    const randomInfo = document.createElement('span');
    const minStr = randomTimeRange.minSeconds > 0 ? formatSecondsToMMSS(randomTimeRange.minSeconds) : '0:00';
    const maxStr = randomTimeRange.maxSeconds > 0 ? formatSecondsToMMSS(randomTimeRange.maxSeconds) : '0:00';
    randomInfo.textContent = `🎲 ${minStr}-${maxStr}`;
    randomInfo.title = 'Random notification time range (hidden until triggered)';
    infoRow.appendChild(randomInfo);
  }

  // Bookmark info
  if (bookmarks.length > 0) {
    const bookmarkInfo = document.createElement('span');
    const bookmarkNames = bookmarks.map(b => b.title || 'Untitled').join(', ');
    bookmarkInfo.textContent = `📚 ${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}`;
    bookmarkInfo.title = bookmarkNames;
    bookmarkInfo.style.cssText = 'cursor: help;';
    infoRow.appendChild(bookmarkInfo);
  }

  if (infoRow.children.length > 0) {
    item.appendChild(infoRow);
  }

  return item;
}

// Keep old function name as alias for backwards compatibility
const renderDomainTags = renderDomainList;

/**
 * Validate domain format
 * Allows: domain.com, *.domain.com, domain.*, *domain*, subdomain.domain.com
 */
function isValidDomainPattern(domain) {
  if (!domain || typeof domain !== 'string') return false;

  // Remove wildcard characters for base validation
  const basePattern = domain.replace(/^\*+|\*+$/g, '');

  // If only wildcards, invalid
  if (!basePattern) return false;

  // Check for invalid characters (allow letters, numbers, dots, hyphens, wildcards, and URL characters)
  // Domain/URL pattern: alphanumeric, dots, hyphens, wildcards, colons, and slashes
  const validPattern = /^[\w\-.*/:]+$/;
  if (!validPattern.test(domain)) return false;

  // Reject patterns with consecutive dots
  if (domain.includes('..')) return false;

  // Reject patterns that are just dots
  if (/^[.*]+$/.test(domain)) return false;

  return true;
}

function addDomain(domain) {
  const hiddenInput = document.getElementById('stopwatch-included-domains');
  if (!hiddenInput) return;

  // Clean and validate domain
  domain = domain.trim().toLowerCase();
  if (!domain) return;

  // Validate domain format
  if (!isValidDomainPattern(domain)) {
    showStatus('Invalid domain format', 'error');
    return;
  }

  // Get current domains
  const domainsStr = hiddenInput.value || '';
  const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

  // Check for duplicates
  if (domains.includes(domain)) {
    showStatus('Domain already exists', 'warning');
    return;
  }

  // Add new domain
  domains.push(domain);
  hiddenInput.value = domains.join(', ');

  // Re-render tags
  renderDomainTags();
  markUnsaved();
}

function removeDomain(domain) {
  const hiddenInput = document.getElementById('stopwatch-included-domains');
  const bookmarksInput = document.getElementById('stopwatch-bookmarks-by-domain');
  const notificationTimeInput = document.getElementById('stopwatch-notification-time-by-domain');
  if (!hiddenInput) return;

  // Get current domains
  const domainsStr = hiddenInput.value || '';
  const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

  // Remove the domain
  const index = domains.indexOf(domain);
  if (index > -1) {
    domains.splice(index, 1);
  }

  hiddenInput.value = domains.join(', ');

  // Also remove bookmarks for this domain
  if (bookmarksInput) {
    let bookmarksByDomain = parseBookmarksByDomain(bookmarksInput.value);
    delete bookmarksByDomain[domain];
    bookmarksInput.value = JSON.stringify(bookmarksByDomain);
  }

  // Also remove notification time for this domain
  if (notificationTimeInput) {
    let notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeInput.value);
    delete notificationTimeByDomain[domain];
    notificationTimeInput.value = JSON.stringify(notificationTimeByDomain);
  }

  // Also remove silent mode for this domain
  const silentModeInput = document.getElementById('stopwatch-silent-mode-by-domain');
  if (silentModeInput) {
    let silentModeByDomain = parseSilentModeByDomain(silentModeInput.value);
    delete silentModeByDomain[domain];
    silentModeInput.value = JSON.stringify(silentModeByDomain);
  }

  // Also remove delay for this domain
  const delayInput = document.getElementById('stopwatch-delay-by-domain');
  if (delayInput) {
    let delayByDomain = parseDelayByDomain(delayInput.value);
    delete delayByDomain[domain];
    delayInput.value = JSON.stringify(delayByDomain);
  }

  // Also remove random time range for this domain
  const randomRangeInput = document.getElementById('stopwatch-random-time-range-by-domain');
  if (randomRangeInput) {
    let randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeInput.value);
    delete randomRangeByDomain[domain];
    randomRangeInput.value = JSON.stringify(randomRangeByDomain);
  }

  // Re-render tags
  renderDomainTags();
  markUnsaved();
}

function initializeDomainTagListeners() {
  const addBtn = document.getElementById('stopwatch-add-domain-btn');
  const domainInput = document.getElementById('stopwatch-domain-input');

  if (addBtn && domainInput) {
    // Add on button click
    addBtn.addEventListener('click', () => {
      addDomain(domainInput.value);
      domainInput.value = '';
      domainInput.focus();
    });

    // Add on Enter key
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDomain(domainInput.value);
        domainInput.value = '';
      }
    });
  }
}

// Profile Settings Functions
function loadProfileSettings() {
  // Show loading indicator
  const profileContainer = document.getElementById('profile-container');
  if (profileContainer) {
    const profileSettingsEls = profileContainer.querySelectorAll('.profile-settings');
    profileSettingsEls.forEach(el => {
      el.style.opacity = '0.6';
      el.style.pointerEvents = 'none';
    });
  }

  chrome.storage.sync.get(['profileSettings'], (result) => {
    profileSettings = result.profileSettings || {};

    // Initialize all profiles
    for (let i = 1; i <= 4; i++) {
      initializeProfileUI(i);
    }

    // Hide loading indicator
    if (profileContainer) {
      const profileSettingsEls = profileContainer.querySelectorAll('.profile-settings');
      profileSettingsEls.forEach(el => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });
    }

    // Set up profile selector
    const profileSelect = document.getElementById('profile-select');
    if (profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        const parsedProfile = parseInt(e.target.value, 10);
        // Validate profile ID is a valid number between 1-4
        if (isNaN(parsedProfile) || parsedProfile < 1 || parsedProfile > 4) {
          console.warn('Invalid profile ID:', e.target.value);
          return;
        }
        currentProfile = parsedProfile;
        document.querySelectorAll('.profile-content').forEach(p => p.classList.remove('active'));
        const activeProfile = document.getElementById(`profile${currentProfile}`);
        if (activeProfile) {
          activeProfile.classList.add('active');
        }
        // Mark changes when switching profiles
        markUnsaved();
      });
    }
  });
}

function initializeProfileUI(profileNum) {
  const container = document.querySelector(`.profile-settings[data-profile="${profileNum}"]`);
  if (!container) return;

  container.innerHTML = '';
  const patterns = patternDescriptions[profileNum];
  const profileKey = `profile${profileNum}`;
  const settings = profileSettings[profileKey] || { ...defaultPatterns[profileNum] };

  Object.entries(patterns).forEach(([pattern, info]) => {
    const patternItem = document.createElement('div');
    patternItem.className = 'setting-item';

    const label = document.createElement('label');
    label.className = 'setting-label';
    label.style.cursor = 'pointer';

    const labelText = document.createElement('span');
    labelText.className = 'label-text';
    labelText.textContent = info.display;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = settings[pattern] !== false;
    checkbox.dataset.pattern = pattern;
    checkbox.dataset.profileNum = profileNum;
    checkbox.className = 'query-setting';

    label.appendChild(labelText);
    label.addEventListener('click', () => checkbox.click());

    patternItem.appendChild(label);
    patternItem.appendChild(checkbox);
    container.appendChild(patternItem);
  });
}

function saveProfileSettings() {
  const profileKey = `profile${currentProfile}`;

  // Initialize profileSettings if it doesn't exist
  if (!profileSettings || typeof profileSettings !== 'object') {
    profileSettings = {};
  }

  // Initialize the specific profile if it doesn't exist
  if (!profileSettings[profileKey] || typeof profileSettings[profileKey] !== 'object') {
    profileSettings[profileKey] = {};
  }

  // Now safely iterate
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    const pattern = checkbox.dataset.pattern;
    if (pattern) {  // Extra safety check
      profileSettings[profileKey][pattern] = checkbox.checked;
    }
  });

  chrome.storage.sync.set({ profileSettings: profileSettings }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving profile: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('✓ Profile saved successfully!', 'success');
    }
  });
}

function resetProfileSettings() {
  if (!confirm(`Are you sure you want to reset the ${currentProfile} element profile to default?`)) {
    return;
  }

  const profileKey = `profile${currentProfile}`;
  profileSettings[profileKey] = { ...defaultPatterns[currentProfile] };

  chrome.storage.sync.set({ profileSettings: profileSettings }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error resetting profile: ' + chrome.runtime.lastError.message, 'error');
    } else {
      initializeProfileUI(currentProfile);
      showStatus('✓ Profile reset to defaults', 'success');
    }
  });
}

function selectAllProfile() {
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    checkbox.checked = true;
  });
  showStatus('All patterns selected', 'info');
}

function deselectAllProfile() {
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    checkbox.checked = false;
  });
  showStatus('All patterns deselected', 'info');
}

// Sidebar Navigation
function initializeSidebarNavigation() {
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.settings-section');

  if (sidebarLinks.length === 0 || sections.length === 0) {
    console.warn('Settings sidebar navigation elements not found');
    return;
  }

  // Handle scroll-based active state tracking
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateActiveLink();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  function updateActiveLink() {
    const fromTop = window.scrollY + 100; // Offset for better UX

    // Check if we're at the bottom of the page
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 10;

    if (isAtBottom) {
      // Activate the last link when at bottom
      sidebarLinks.forEach(link => link.classList.remove('active'));
      sidebarLinks[sidebarLinks.length - 1].classList.add('active');
      return;
    }

    sidebarLinks.forEach(link => {
      const section = document.querySelector(link.hash);

      if (section) {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (sectionTop <= fromTop && sectionBottom > fromTop) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    });
  }

  // Initial check
  updateActiveLink();
}

// ==========================================
// Per-Site Bookmark Functions
// ==========================================

/**
 * Parse bookmarks by domain from hidden input
 */
function parseBookmarksByDomain(value) {
  if (!value || value === '') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse bookmarks by domain:', e);
    return {};
  }
}

/**
 * Parse notification time by domain from hidden input
 * Values are stored in seconds
 */
function parseNotificationTimeByDomain(value) {
  if (!value || value === '') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse notification time by domain:', e);
    return {};
  }
}

/**
 * Parse silent mode by domain hidden input value
 * @param {string} value - JSON string of silent mode by domain
 * @returns {object} - Object with domain keys and boolean values
 */
function parseSilentModeByDomain(value) {
  if (!value || value === '') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse silent mode by domain:', e);
    return {};
  }
}

/**
 * Parse delay by domain from hidden input value
 * @param {string} value - JSON string of delay by domain object
 * @returns {object} Object mapping domain names to delay values in ms
 */
function parseDelayByDomain(value) {
  if (!value || value === '') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse delay by domain:', e);
    return {};
  }
}

/**
 * Parse random time range by domain from hidden input value
 * @param {string} value - JSON string of random time range by domain object
 * @returns {object} Object mapping domain names to { minSeconds, maxSeconds, enabled }
 */
function parseRandomTimeRangeByDomain(value) {
  if (!value || value === '') return {};
  try {
    const parsed = JSON.parse(value);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse random time range by domain:', e);
    return {};
  }
}

/**
 * Format seconds to MM:SS display
 * @param {number} totalSeconds - Time in seconds
 * @returns {string} Formatted time like "11:11" or "5:00"
 */
function formatSecondsToMMSS(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || typeof totalSeconds !== 'number' || totalSeconds < 0) {
    return '';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse MM:SS format to seconds
 * @param {string} timeStr - Time string like "11:11" or "5:00" or just "30" (minutes only)
 * @returns {number|null} Time in seconds, or null if invalid
 */
function parseMMSSToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // Check if it contains a colon (MM:SS format)
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;

    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);

    if (isNaN(minutes) || isNaN(seconds)) return null;
    if (minutes < 0 || seconds < 0 || seconds >= 60) return null;

    return (minutes * 60) + seconds;
  } else {
    // Just a number - treat as minutes for backwards compatibility
    const minutes = parseInt(trimmed, 10);
    if (isNaN(minutes) || minutes < 0) return null;
    return minutes * 60;
  }
}

/**
 * Open modal to edit bookmarks and notification time for a domain (called from domain list)
 */
function openEditSiteModal(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange) {
  openSiteBookmarkModal(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange);
}

/**
 * Open the site bookmark configuration modal
 * @param {string} domain - Domain to configure bookmarks for
 * @param {Array} existingBookmarks - Current bookmarks for this domain
 * @param {number} existingNotificationTime - Current notification time in seconds for this domain
 * @param {boolean} existingSilentMode - Current silent mode setting for this domain
 * @param {number} existingDomainDelay - Current default delay for this domain in ms
 */
function openSiteBookmarkModal(domain, existingBookmarks, existingNotificationTime, existingSilentMode, existingDomainDelay, existingRandomTimeRange) {
  const existingModal = document.getElementById('bookmark-selector-modal');
  if (existingModal) existingModal.remove();

  // Track selected bookmarks for this modal session (with delayAfter property)
  let selectedBookmarks = [...existingBookmarks].map(bm => ({
    ...bm,
    delayAfter: typeof bm.delayAfter === 'number' ? bm.delayAfter : 0
  }));
  let selectedIds = new Set(selectedBookmarks.map(b => b.id));

  // Track notification time for this modal session
  let currentNotificationTime = existingNotificationTime || 0;

  // Track silent mode for this modal session
  let currentSilentMode = existingSilentMode === true;

  // Track domain delay for this modal session (in ms)
  let currentDomainDelay = typeof existingDomainDelay === 'number' ? existingDomainDelay : 0;

  // Track random time range for this modal session
  let currentRandomTimeRange = existingRandomTimeRange || { enabled: false, minSeconds: 0, maxSeconds: 0 };

  // Drag-and-drop state
  let draggedItem = null;

  const modal = document.createElement('div');
  modal.id = 'bookmark-selector-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: var(--primary-bg); border-radius: 12px; width: 95%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: var(--text-primary); margin: 10px;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;';

  const headerTitle = document.createElement('h3');
  headerTitle.textContent = `Configure ${domain}`;
  headerTitle.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary); word-break: break-word;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 0;';
  closeBtn.addEventListener('click', () => modal.remove());

  header.appendChild(headerTitle);
  header.appendChild(closeBtn);

  // Notification Time Section
  const notificationSection = document.createElement('div');
  notificationSection.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface-bg); flex-shrink: 0;';

  const notificationLabel = document.createElement('label');
  notificationLabel.style.cssText = 'display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;';
  notificationLabel.textContent = 'Notification Time for this domain';

  const notificationInputRow = document.createElement('div');
  notificationInputRow.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

  const notificationTimeInput = document.createElement('input');
  notificationTimeInput.type = 'text';
  notificationTimeInput.id = 'modal-notification-time';
  notificationTimeInput.placeholder = 'MM:SS (e.g., 11:11)';
  notificationTimeInput.value = currentNotificationTime > 0 ? formatSecondsToMMSS(currentNotificationTime) : '';
  notificationTimeInput.style.cssText = 'width: 120px; min-width: 100px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); font-size: 14px;';

  const notificationHint = document.createElement('span');
  notificationHint.style.cssText = 'font-size: 12px; color: var(--text-secondary); flex: 1; min-width: 150px;';
  notificationHint.textContent = 'Leave empty to use default time';

  notificationInputRow.appendChild(notificationTimeInput);
  notificationInputRow.appendChild(notificationHint);

  notificationSection.appendChild(notificationLabel);
  notificationSection.appendChild(notificationInputRow);

  // Silent Mode Section
  const silentSection = document.createElement('div');
  silentSection.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface-bg); flex-shrink: 0;';

  const silentRow = document.createElement('div');
  silentRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  const silentCheckbox = document.createElement('input');
  silentCheckbox.type = 'checkbox';
  silentCheckbox.id = 'modal-silent-mode';
  silentCheckbox.checked = currentSilentMode;
  silentCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
  silentCheckbox.addEventListener('change', () => {
    currentSilentMode = silentCheckbox.checked;
  });

  const silentLabel = document.createElement('label');
  silentLabel.htmlFor = 'modal-silent-mode';
  silentLabel.style.cssText = 'font-size: 13px; color: var(--text-primary); cursor: pointer;';
  silentLabel.textContent = 'Silent Mode - run bookmarklets without popup notification';

  silentRow.appendChild(silentCheckbox);
  silentRow.appendChild(silentLabel);
  silentSection.appendChild(silentRow);

  // Domain Delay Section
  const delaySection = document.createElement('div');
  delaySection.className = 'domain-delay-section';
  delaySection.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface-bg); flex-shrink: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

  const delayLabel = document.createElement('label');
  delayLabel.htmlFor = 'modal-domain-delay';
  delayLabel.style.cssText = 'font-size: 13px; color: var(--text-primary);';
  delayLabel.textContent = 'Default Delay:';

  const delayInput = document.createElement('input');
  delayInput.type = 'number';
  delayInput.id = 'modal-domain-delay';
  delayInput.min = '0';
  delayInput.max = '60000';
  delayInput.value = currentDomainDelay;
  delayInput.style.cssText = 'width: 80px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--text-primary); font-size: 13px; text-align: right;';
  delayInput.addEventListener('change', () => {
    currentDomainDelay = parseInt(delayInput.value, 10) || 0;
  });

  const delayUnit = document.createElement('span');
  delayUnit.style.cssText = 'font-size: 12px; color: var(--text-secondary);';
  delayUnit.textContent = 'ms';

  const delayHint = document.createElement('span');
  delayHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-left: auto;';
  delayHint.textContent = '0 = use global default';

  delaySection.appendChild(delayLabel);
  delaySection.appendChild(delayInput);
  delaySection.appendChild(delayUnit);
  delaySection.appendChild(delayHint);

  // Random Time Range Section
  const randomRangeSection = document.createElement('div');
  randomRangeSection.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--surface-bg); flex-shrink: 0;';

  const randomToggleRow = document.createElement('div');
  randomToggleRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';

  const randomCheckbox = document.createElement('input');
  randomCheckbox.type = 'checkbox';
  randomCheckbox.id = 'modal-random-time-enabled';
  randomCheckbox.checked = currentRandomTimeRange.enabled === true;
  randomCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';

  const randomToggleLabel = document.createElement('label');
  randomToggleLabel.htmlFor = 'modal-random-time-enabled';
  randomToggleLabel.style.cssText = 'font-size: 13px; color: var(--text-primary); cursor: pointer;';
  randomToggleLabel.textContent = 'Use Random Time Range';

  randomToggleRow.appendChild(randomCheckbox);
  randomToggleRow.appendChild(randomToggleLabel);

  const randomRangeInputRow = document.createElement('div');
  randomRangeInputRow.id = 'modal-random-range-inputs';
  randomRangeInputRow.style.cssText = 'display: none; align-items: center; gap: 10px; flex-wrap: wrap;';

  const randomMinInput = document.createElement('input');
  randomMinInput.type = 'text';
  randomMinInput.id = 'modal-random-min';
  randomMinInput.placeholder = 'MM:SS';
  randomMinInput.value = currentRandomTimeRange.minSeconds > 0 ? formatSecondsToMMSS(currentRandomTimeRange.minSeconds) : '';
  randomMinInput.style.cssText = 'width: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);';

  const toLabel = document.createElement('span');
  toLabel.textContent = 'to';
  toLabel.style.cssText = 'font-size: 13px; color: var(--text-secondary);';

  const randomMaxInput = document.createElement('input');
  randomMaxInput.type = 'text';
  randomMaxInput.id = 'modal-random-max';
  randomMaxInput.placeholder = 'MM:SS';
  randomMaxInput.value = currentRandomTimeRange.maxSeconds > 0 ? formatSecondsToMMSS(currentRandomTimeRange.maxSeconds) : '';
  randomMaxInput.style.cssText = 'width: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);';

  const randomHint = document.createElement('span');
  randomHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-left: auto;';
  randomHint.textContent = 'Leave empty to use global range';

  randomRangeInputRow.appendChild(randomMinInput);
  randomRangeInputRow.appendChild(toLabel);
  randomRangeInputRow.appendChild(randomMaxInput);
  randomRangeInputRow.appendChild(randomHint);

  // Toggle random range inputs visibility
  function updateRandomRangeVisibility() {
    randomRangeInputRow.style.display = randomCheckbox.checked ? 'flex' : 'none';
  }
  randomCheckbox.addEventListener('change', updateRandomRangeVisibility);
  updateRandomRangeVisibility();

  randomRangeSection.appendChild(randomToggleRow);
  randomRangeSection.appendChild(randomRangeInputRow);

  // Sortable Bookmarklet List Section (replaces chip preview)
  const sortableSection = document.createElement('div');
  sortableSection.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; max-height: 250px; overflow-y: auto;';

  const sortableHeader = document.createElement('div');
  sortableHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

  const sortableLabel = document.createElement('div');
  sortableLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary);';
  sortableLabel.textContent = 'Bookmarklets to Run';

  const sortableHint = document.createElement('div');
  sortableHint.style.cssText = 'font-size: 11px; color: var(--text-secondary);';
  sortableHint.innerHTML = 'Drag ☰ to reorder';

  sortableHeader.appendChild(sortableLabel);
  sortableHeader.appendChild(sortableHint);

  const sortableList = document.createElement('div');
  sortableList.className = 'sortable-bookmark-list';
  sortableList.id = 'modal-sortable-list';

  // Function to render the sortable list
  function renderSortableList() {
    sortableList.innerHTML = '';

    if (selectedBookmarks.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'sortable-list-empty';
      emptyMsg.textContent = 'No bookmarklets selected. Add some from below.';
      sortableList.appendChild(emptyMsg);
      return;
    }

    selectedBookmarks.forEach((bm, index) => {
      const item = document.createElement('div');
      item.className = 'sortable-bookmark-item';
      item.draggable = true;
      item.dataset.index = index;

      // Drag handle
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '☰';

      // Order number
      const order = document.createElement('span');
      order.className = 'bookmark-order';
      order.textContent = `${index + 1}.`;

      // Title
      const title = document.createElement('span');
      title.className = 'bookmark-title';
      const isCode = bm.isCustomCode || (bm.url && bm.url.startsWith('javascript:'));
      const isEditorBookmarklet = bm.isEditorBookmarklet;
      let prefix = '';
      if (isEditorBookmarklet) prefix = '📜 ';
      else if (isCode) prefix = '</> ';
      title.textContent = `${prefix}${bm.title || 'Untitled'}`;
      title.title = bm.title || bm.url || 'Untitled';

      // Delay input
      const delayInputItem = document.createElement('input');
      delayInputItem.type = 'number';
      delayInputItem.className = 'delay-input';
      delayInputItem.min = '0';
      delayInputItem.max = '60000';
      delayInputItem.value = bm.delayAfter || 0;
      delayInputItem.placeholder = '0';
      delayInputItem.title = 'Delay after this bookmarklet (ms)';
      delayInputItem.addEventListener('change', () => {
        selectedBookmarks[index].delayAfter = parseInt(delayInputItem.value, 10) || 0;
      });

      // Delay unit
      const delayUnitItem = document.createElement('span');
      delayUnitItem.className = 'delay-unit';
      delayUnitItem.textContent = 'ms';

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-bookmark-btn';
      removeBtn.textContent = '🗑';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => {
        selectedIds.delete(bm.id);
        selectedBookmarks.splice(index, 1);
        renderSortableList();
        // Update checkboxes in other sections
        updateBookmarkCheckboxes();
      });

      // Drag events
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.sortable-bookmark-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedItem = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem !== item) {
          item.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');

        if (draggedItem && draggedItem !== item) {
          const fromIndex = parseInt(draggedItem.dataset.index, 10);
          const toIndex = parseInt(item.dataset.index, 10);

          // Reorder the array
          const [movedItem] = selectedBookmarks.splice(fromIndex, 1);
          selectedBookmarks.splice(toIndex, 0, movedItem);

          renderSortableList();
        }
      });

      item.appendChild(handle);
      item.appendChild(order);
      item.appendChild(title);
      item.appendChild(delayInputItem);
      item.appendChild(delayUnitItem);
      item.appendChild(removeBtn);

      sortableList.appendChild(item);
    });
  }

  // Function to update checkboxes in bookmark tree and editor bookmarklets
  function updateBookmarkCheckboxes() {
    // Update bookmark tree checkboxes
    const treeCheckboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
    treeCheckboxes.forEach(cb => {
      const bookmarkItem = cb.closest('[data-bookmark-title]');
      if (bookmarkItem) {
        const bookmarkId = bookmarkItem.getAttribute('data-bookmark-id');
        cb.checked = selectedIds.has(bookmarkId);
      }
    });

    // Update editor bookmarklets checkboxes
    const editorCheckboxes = savedBookmarkletsList.querySelectorAll('input[type="checkbox"]');
    editorCheckboxes.forEach(cb => {
      const editorId = cb.getAttribute('data-editor-id');
      if (editorId) {
        const isSelected = selectedBookmarks.some(sb => sb.editorBookmarkletId === editorId);
        cb.checked = isSelected;
      }
    });
  }

  // Initial render
  renderSortableList();

  sortableSection.appendChild(sortableHeader);
  sortableSection.appendChild(sortableList);

  // Instructions
  const instructions = document.createElement('div');
  instructions.style.cssText = 'padding: 10px 16px; background: var(--surface-bg); font-size: 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border); flex-shrink: 0;';
  instructions.innerHTML = 'Add bookmarks or <strong>custom code</strong> to run when notification is dismissed.';

  // Add Custom Code section
  const customCodeSection = document.createElement('div');
  customCodeSection.style.cssText = 'padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

  const addCodeBtn = document.createElement('button');
  addCodeBtn.textContent = '+ Add Custom Code';
  addCodeBtn.className = 'secondary-button';
  addCodeBtn.style.cssText = 'font-size: 13px; padding: 8px 16px;';

  const codeInputContainer = document.createElement('div');
  codeInputContainer.style.cssText = 'display: none; margin-top: 12px;';

  const codeNameInput = document.createElement('input');
  codeNameInput.type = 'text';
  codeNameInput.placeholder = 'Name (e.g., "Check all boxes")';
  codeNameInput.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; background: var(--input-bg); color: var(--text-primary);';

  const codeTextarea = document.createElement('textarea');
  codeTextarea.placeholder = 'Paste JavaScript code here...\n\nExamples:\n• document.querySelectorAll(\'input[type="checkbox"]\').forEach(c => c.checked = true);\n• document.querySelector(\'#myButton\').click();';
  codeTextarea.style.cssText = 'width: 100%; height: 120px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-family: monospace; font-size: 12px; resize: vertical; background: var(--input-bg); color: var(--text-primary);';

  const codeHint = document.createElement('div');
  codeHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-top: 6px; margin-bottom: 10px;';
  codeHint.innerHTML = '<strong>Note:</strong> Code runs in isolated world (DOM access only). Cannot call page JavaScript functions.';

  const codeButtonsRow = document.createElement('div');
  codeButtonsRow.style.cssText = 'display: flex; gap: 8px;';

  const addCodeConfirmBtn = document.createElement('button');
  addCodeConfirmBtn.textContent = 'Add Code';
  addCodeConfirmBtn.className = 'primary-button';
  addCodeConfirmBtn.style.cssText = 'font-size: 12px; padding: 6px 14px;';

  const cancelCodeBtn = document.createElement('button');
  cancelCodeBtn.textContent = 'Cancel';
  cancelCodeBtn.className = 'secondary-button';
  cancelCodeBtn.style.cssText = 'font-size: 12px; padding: 6px 14px;';

  addCodeBtn.addEventListener('click', () => {
    codeInputContainer.style.display = 'block';
    addCodeBtn.style.display = 'none';
    codeNameInput.focus();
  });

  cancelCodeBtn.addEventListener('click', () => {
    codeInputContainer.style.display = 'none';
    addCodeBtn.style.display = 'inline-block';
    codeNameInput.value = '';
    codeTextarea.value = '';
  });

  addCodeConfirmBtn.addEventListener('click', () => {
    const name = codeNameInput.value.trim() || 'Custom Code';
    let code = codeTextarea.value.trim();

    if (!code) {
      alert('Please enter some code');
      return;
    }

    // Wrap code in javascript: URL format for storage (like a bookmarklet)
    // But keep it clean - don't double-encode if already encoded
    if (!code.startsWith('javascript:')) {
      code = 'javascript:' + encodeURIComponent(code);
    }

    // Create a custom bookmark entry with a unique ID (timestamp + random)
    const customBookmark = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      title: name,
      url: code,
      isCustomCode: true,
      delayAfter: 0
    };

    selectedBookmarks.push(customBookmark);
    selectedIds.add(customBookmark.id);
    renderSortableList();

    // Reset form
    codeInputContainer.style.display = 'none';
    addCodeBtn.style.display = 'inline-block';
    codeNameInput.value = '';
    codeTextarea.value = '';
  });

  codeButtonsRow.appendChild(addCodeConfirmBtn);
  codeButtonsRow.appendChild(cancelCodeBtn);

  codeInputContainer.appendChild(codeNameInput);
  codeInputContainer.appendChild(codeTextarea);
  codeInputContainer.appendChild(codeHint);
  codeInputContainer.appendChild(codeButtonsRow);

  customCodeSection.appendChild(addCodeBtn);
  customCodeSection.appendChild(codeInputContainer);

  // Saved Bookmarklets Section (from bookmarklet editor)
  const savedBookmarkletsSection = document.createElement('div');
  savedBookmarkletsSection.style.cssText = 'padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

  const savedBookmarkletsLabel = document.createElement('div');
  savedBookmarkletsLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;';
  savedBookmarkletsLabel.innerHTML = '<span style="font-size: 14px;">📜</span> Saved Bookmarklets';

  const savedBookmarkletsList = document.createElement('div');
  savedBookmarkletsList.style.cssText = 'max-height: 120px; overflow-y: auto; background: var(--surface-bg); border-radius: 6px; padding: 6px; border: 1px solid var(--border);';
  savedBookmarkletsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px; padding: 8px; text-align: center;">Loading...</div>';

  savedBookmarkletsSection.appendChild(savedBookmarkletsLabel);
  savedBookmarkletsSection.appendChild(savedBookmarkletsList);

  // Load saved bookmarklets from storage
  chrome.storage.local.get(['customBookmarklets'], (data) => {
    const bookmarklets = data.customBookmarklets || {};
    const sortedBookmarklets = Object.values(bookmarklets)
      .filter(bm => bm.enabled !== false && bm.code)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    savedBookmarkletsList.innerHTML = '';

    if (sortedBookmarklets.length === 0) {
      savedBookmarkletsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px; padding: 8px; text-align: center; font-style: italic;">No saved bookmarklets. Create some in the Editor.</div>';
      return;
    }

    sortedBookmarklets.forEach(bm => {
      const isAlreadySelected = selectedBookmarks.some(sb => sb.editorBookmarkletId === bm.id);

      const item = document.createElement('label');
      item.style.cssText = 'display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px; margin: 2px 0; gap: 8px;';
      item.addEventListener('mouseenter', () => item.style.background = 'var(--hover-color)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isAlreadySelected;
      checkbox.style.cssText = 'cursor: pointer; accent-color: var(--accent); flex-shrink: 0;';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = bm.name || 'Untitled';
      nameSpan.style.cssText = 'font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          // Add to selected bookmarks
          const editorBookmark = {
            id: 'editor_' + bm.id,
            editorBookmarkletId: bm.id,
            title: bm.name || 'Untitled Bookmarklet',
            isEditorBookmarklet: true,
            delayAfter: 0
          };
          selectedBookmarks.push(editorBookmark);
          selectedIds.add(editorBookmark.id);
        } else {
          // Remove from selected bookmarks
          const idx = selectedBookmarks.findIndex(sb => sb.editorBookmarkletId === bm.id);
          if (idx !== -1) {
            selectedIds.delete(selectedBookmarks[idx].id);
            selectedBookmarks.splice(idx, 1);
          }
        }
        renderSortableList();
      });

      item.appendChild(checkbox);
      item.appendChild(nameSpan);
      savedBookmarkletsList.appendChild(item);
    });
  });

  // Search section for bookmarks
  const searchSection = document.createElement('div');
  searchSection.style.cssText = 'padding: 10px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search bookmarks...';
  searchInput.style.cssText = 'width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); font-size: 14px;';

  // Search functionality
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    const bookmarkItems = treeContainer.querySelectorAll('[data-bookmark-title]');
    const folderItems = treeContainer.querySelectorAll('[data-folder]');

    if (!query) {
      // Show all items when search is empty
      bookmarkItems.forEach(item => {
        item.style.display = 'flex';
      });
      folderItems.forEach(folder => {
        folder.style.display = 'block';
        const childrenContainer = folder.querySelector('[data-folder-children]');
        if (childrenContainer) {
          childrenContainer.style.display = 'block';
        }
      });
      return;
    }

    // Hide all folders first, then show ones with matching bookmarks
    folderItems.forEach(folder => {
      folder.style.display = 'none';
    });

    // Filter bookmarks by title or URL
    bookmarkItems.forEach(item => {
      const title = (item.getAttribute('data-bookmark-title') || '').toLowerCase();
      const url = (item.getAttribute('data-bookmark-url') || '').toLowerCase();
      const matches = title.includes(query) || url.includes(query);
      item.style.display = matches ? 'flex' : 'none';

      // If matches, show parent folders
      if (matches) {
        let parent = item.parentElement;
        while (parent && parent !== treeContainer) {
          if (parent.hasAttribute('data-folder')) {
            parent.style.display = 'block';
            const childrenContainer = parent.querySelector('[data-folder-children]');
            if (childrenContainer) {
              childrenContainer.style.display = 'block';
            }
          }
          if (parent.hasAttribute('data-folder-children')) {
            parent.style.display = 'block';
          }
          parent = parent.parentElement;
        }
      }
    });
  });

  searchSection.appendChild(searchInput);

  // Bookmark tree container
  const treeContainer = document.createElement('div');
  treeContainer.style.cssText = 'flex: 1; overflow-y: auto; padding: 12px 16px; min-height: 150px;';

  const loading = document.createElement('div');
  loading.textContent = 'Loading bookmarks...';
  loading.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
  treeContainer.appendChild(loading);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = 'padding: 12px 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0; flex-wrap: wrap;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'secondary-button';
  cancelBtn.addEventListener('click', () => modal.remove());

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'primary-button';
  saveBtn.addEventListener('click', () => {
    const bookmarksHiddenInput = document.getElementById('stopwatch-bookmarks-by-domain');
    const notificationTimeHiddenInput = document.getElementById('stopwatch-notification-time-by-domain');
    const silentModeHiddenInput = document.getElementById('stopwatch-silent-mode-by-domain');

    if (!bookmarksHiddenInput) return;

    // Save bookmarks
    let bookmarksByDomain = parseBookmarksByDomain(bookmarksHiddenInput.value);
    bookmarksByDomain[domain] = selectedBookmarks;
    bookmarksHiddenInput.value = JSON.stringify(bookmarksByDomain);

    // Save notification time
    if (notificationTimeHiddenInput) {
      let notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeHiddenInput.value);
      const timeInputValue = notificationTimeInput.value.trim();

      if (timeInputValue) {
        const parsedSeconds = parseMMSSToSeconds(timeInputValue);
        if (parsedSeconds === null) {
          // Invalid format
          alert('Invalid time format. Use MM:SS (e.g., 11:11 for 11 minutes 11 seconds)');
          return;
        } else if (parsedSeconds > 0) {
          // Valid time, save it
          notificationTimeByDomain[domain] = parsedSeconds;
        } else {
          // parsedSeconds is 0 - treat as "use default" (don't save)
          delete notificationTimeByDomain[domain];
        }
      } else {
        // Empty - remove custom time for this domain (will use default)
        delete notificationTimeByDomain[domain];
      }

      notificationTimeHiddenInput.value = JSON.stringify(notificationTimeByDomain);
    }

    // Save silent mode
    if (silentModeHiddenInput) {
      let silentModeByDomain = parseSilentModeByDomain(silentModeHiddenInput.value);
      if (currentSilentMode) {
        silentModeByDomain[domain] = true;
      } else {
        // Remove if not silent (use default)
        delete silentModeByDomain[domain];
      }
      silentModeHiddenInput.value = JSON.stringify(silentModeByDomain);
    }

    // Save domain delay
    const delayHiddenInput = document.getElementById('stopwatch-delay-by-domain');
    if (delayHiddenInput) {
      let delayByDomain = parseDelayByDomain(delayHiddenInput.value);
      if (currentDomainDelay > 0) {
        delayByDomain[domain] = currentDomainDelay;
      } else {
        // Remove if 0 (use global default)
        delete delayByDomain[domain];
      }
      delayHiddenInput.value = JSON.stringify(delayByDomain);
    }

    // Save random time range
    const randomRangeHiddenInput = document.getElementById('stopwatch-random-time-range-by-domain');
    if (randomRangeHiddenInput) {
      let randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeHiddenInput.value);
      const randomEnabled = randomCheckbox.checked;
      const minValue = randomMinInput.value.trim();
      const maxValue = randomMaxInput.value.trim();

      if (randomEnabled) {
        const minSeconds = minValue ? parseMMSSToSeconds(minValue) : 0;
        const maxSeconds = maxValue ? parseMMSSToSeconds(maxValue) : 0;

        if (minValue && minSeconds === null) {
          alert('Invalid min time format. Use MM:SS (e.g., 11:00 for 11 minutes)');
          return;
        }
        if (maxValue && maxSeconds === null) {
          alert('Invalid max time format. Use MM:SS (e.g., 15:00 for 15 minutes)');
          return;
        }

        randomRangeByDomain[domain] = {
          enabled: true,
          minSeconds: minSeconds || 0,
          maxSeconds: maxSeconds || 0
        };
      } else {
        // Remove if not enabled
        delete randomRangeByDomain[domain];
      }
      randomRangeHiddenInput.value = JSON.stringify(randomRangeByDomain);
    }

    renderDomainList();
    markUnsaved();
    modal.remove();
  });

  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modalContent.appendChild(header);
  modalContent.appendChild(notificationSection);
  modalContent.appendChild(silentSection);
  modalContent.appendChild(delaySection);
  modalContent.appendChild(randomRangeSection);
  modalContent.appendChild(sortableSection);
  modalContent.appendChild(instructions);
  modalContent.appendChild(customCodeSection);
  modalContent.appendChild(savedBookmarkletsSection);
  modalContent.appendChild(searchSection);
  modalContent.appendChild(treeContainer);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);

  // Load bookmarks into tree
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    treeContainer.innerHTML = '';

    if (!bookmarkTreeNodes || bookmarkTreeNodes.length === 0) {
      treeContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">No bookmarks found</div>';
      return;
    }

    bookmarkTreeNodes.forEach(node => {
      renderBookmarkNodeForSite(treeContainer, node, selectedIds, selectedBookmarks, 0, renderSortableList);
    });
  });
}

/**
 * Render a bookmark node for site configuration modal
 */
function renderBookmarkNodeForSite(container, node, selectedIds, selectedBookmarks, depth, onSelectionChange) {
  if (!node.title && node.children) {
    node.children.forEach(child => {
      renderBookmarkNodeForSite(container, child, selectedIds, selectedBookmarks, depth, onSelectionChange);
    });
    return;
  }

  const item = document.createElement('div');
  item.style.cssText = `padding-left: ${depth * 20}px;`;

  if (node.children) {
    // Add data attribute for folder filtering
    item.setAttribute('data-folder', 'true');

    const folderHeader = document.createElement('div');
    folderHeader.style.cssText = 'display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 6px; margin: 2px 0;';
    folderHeader.addEventListener('mouseenter', () => folderHeader.style.background = 'var(--hover-color)');
    folderHeader.addEventListener('mouseleave', () => folderHeader.style.background = 'transparent');

    folderHeader.innerHTML = `<span style="margin-right: 8px;">📁</span><span style="font-weight: 500; color: var(--text-primary);">${node.title || 'Bookmarks'}</span><span style="margin-left: auto; font-size: 10px; color: var(--text-secondary);">▼</span>`;

    const childrenContainer = document.createElement('div');
    childrenContainer.style.cssText = 'display: block;';
    childrenContainer.setAttribute('data-folder-children', 'true');

    node.children.forEach(child => {
      renderBookmarkNodeForSite(childrenContainer, child, selectedIds, selectedBookmarks, depth + 1, onSelectionChange);
    });

    folderHeader.addEventListener('click', () => {
      const isCollapsed = childrenContainer.style.display === 'none';
      childrenContainer.style.display = isCollapsed ? 'block' : 'none';
      folderHeader.querySelector('span:last-child').style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    item.appendChild(folderHeader);
    item.appendChild(childrenContainer);
  } else if (node.url) {
    const bookmarkItem = document.createElement('div');
    const isSelected = selectedIds.has(node.id);
    bookmarkItem.style.cssText = `display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 6px; margin: 2px 0; border: 2px solid ${isSelected ? 'var(--accent)' : 'transparent'}; background: ${isSelected ? 'var(--accent-glow)' : 'transparent'};`;

    // Add data attributes for search filtering
    bookmarkItem.setAttribute('data-bookmark-title', node.title || '');
    bookmarkItem.setAttribute('data-bookmark-url', node.url || '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isSelected;
    checkbox.style.cssText = 'margin-right: 10px; cursor: pointer; accent-color: var(--accent);';

    bookmarkItem.innerHTML = `<span style="margin-right: 8px;">🔖</span><div style="flex: 1; min-width: 0; overflow: hidden;"><div style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${node.title || 'Untitled'}</div><div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${node.url}</div></div>`;
    bookmarkItem.prepend(checkbox);

    const toggleSelection = () => {
      const existingIndex = selectedBookmarks.findIndex(b => b.id === node.id);

      if (existingIndex >= 0) {
        selectedBookmarks.splice(existingIndex, 1);
        selectedIds.delete(node.id);
        checkbox.checked = false;
        bookmarkItem.style.border = '2px solid transparent';
        bookmarkItem.style.background = 'transparent';
      } else {
        selectedBookmarks.push({ id: node.id, title: node.title, url: node.url, delayAfter: 0 });
        selectedIds.add(node.id);
        checkbox.checked = true;
        bookmarkItem.style.border = '2px solid var(--accent)';
        bookmarkItem.style.background = 'var(--accent-glow)';
      }

      onSelectionChange();
    };

    bookmarkItem.addEventListener('click', toggleSelection);
    bookmarkItem.addEventListener('mouseenter', () => {
      if (!selectedIds.has(node.id)) bookmarkItem.style.background = 'var(--hover-color)';
    });
    bookmarkItem.addEventListener('mouseleave', () => {
      if (!selectedIds.has(node.id)) bookmarkItem.style.background = 'transparent';
    });

    item.appendChild(bookmarkItem);
  }

  container.appendChild(item);
}

// Listen for storage changes from other tabs/windows
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    // Reload settings if changed elsewhere and no unsaved changes
    if (!hasUnsavedChanges) {
      loadSettings()
        .then(() => {
          showStatus('✓ Settings updated from another window', 'info');
        })
        .catch((error) => {
          console.error('Error reloading settings:', error);
          showStatus('Error reloading settings', 'error');
        });
    } else {
      showStatus('⚠ Settings changed elsewhere (not applied - you have unsaved changes)', 'warning');
    }
  }
});
