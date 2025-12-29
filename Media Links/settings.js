// Settings management
// Use centralized DEFAULT_SETTINGS from SettingsUtils to avoid duplication
const getDefaultSettings = () => {
  if (typeof window.SettingsUtils !== 'undefined') {
    return window.SettingsUtils.getDefaultSettings();
  }
  // Fallback defaults if SettingsUtils not loaded yet (shouldn't happen in normal flow)
  console.warn('SettingsUtils not available, using minimal fallback defaults');
  return {
    theme: 'light',
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

  // Render domain tags from the hidden input value
  renderDomainTags();

  // Toggle stopwatch options subsection based on enable state
  toggleStopwatchSettings(currentSettings.stopwatchEnabled === true);
  toggleNotificationMinutes(currentSettings.stopwatchNotificationEnabled === true);

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
    markUnsaved();
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
    stopwatchIncludedDomains: getSafeValue('stopwatch-included-domains')
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

// Domain Tag Management Functions
function renderDomainTags() {
  const tagsContainer = document.getElementById('stopwatch-domain-tags');
  const hiddenInput = document.getElementById('stopwatch-included-domains');

  if (!tagsContainer || !hiddenInput) return;

  // Clear existing tags
  tagsContainer.innerHTML = '';

  // Get domains from hidden input
  const domainsStr = hiddenInput.value || '';
  const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

  // Create tags for each domain
  domains.forEach(domain => {
    const tag = createDomainTag(domain);
    tagsContainer.appendChild(tag);
  });
}

function createDomainTag(domain) {
  const tag = document.createElement('span');
  tag.className = 'domain-tag';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'domain-name';
  nameSpan.textContent = domain;
  nameSpan.title = domain; // Show full domain on hover if truncated

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-domain';
  removeBtn.innerHTML = '×';
  removeBtn.title = 'Remove ' + domain;
  removeBtn.addEventListener('click', () => removeDomain(domain));

  tag.appendChild(nameSpan);
  tag.appendChild(removeBtn);

  return tag;
}

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

  // Check for invalid characters (allow letters, numbers, dots, hyphens, and internal wildcards)
  // Domain pattern: alphanumeric, dots, hyphens, and wildcards
  const validPattern = /^[\w\-.*]+$/;
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
