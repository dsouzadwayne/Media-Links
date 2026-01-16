// Settings Core Module - Shared state, utilities, and initialization
// This module provides the foundation for all other settings modules

// Global state accessible by all modules
window.SettingsApp = {
  currentSettings: {},
  hasUnsavedChanges: false,
  modules: {},
  currentProfile: 1,
  profileSettings: {},

  // Search profile patterns configuration
  patternDescriptions: {
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
  },

  defaultPatterns: {
    1: { 'plain': true, 'quoted': true, 'intitle': true, 'allintitle': true, 'intext': true },
    2: { 'plain': true, 'first-quoted': true, 'second-quoted': true, 'both-quoted': true, 'phrase': true, 'intitle': true, 'and': true, 'or': true },
    3: { 'plain': true, 'all-quoted': true, 'first-phrase': true, 'second-phrase': true, 'full-phrase': true, 'and': true, 'or': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true },
    4: { 'plain': true, 'all-quoted': true, 'paired': true, 'full-phrase': true, 'and': true, 'or': true, 'first-three-phrase': true, 'last-three-phrase': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'fourth-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true, 'middle-pair': true }
  }
};

// Use centralized DEFAULT_SETTINGS from SettingsUtils to avoid duplication
const getDefaultSettings = () => {
  if (typeof window.SettingsUtils !== 'undefined') {
    return window.SettingsUtils.getDefaultSettings();
  }
  // Fallback defaults if SettingsUtils not loaded yet
  console.warn('SettingsUtils not available, using minimal fallback defaults');
  return {
    theme: 'dark',
    defaultSearchEngine: 'google',
    autoOpenResults: false,
    tabDelay: 150
  };
};

// Initialize settings on load
window.SettingsApp.currentSettings = getDefaultSettings();

// Shared utility functions
function safeSetValue(elementId, value, isCheckbox = false) {
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
}

function safeSetChecked(elementId, value) {
  safeSetValue(elementId, value, true);
}

function safeAddListener(elementId, eventType, handler) {
  const element = document.getElementById(elementId);
  if (element) {
    element.addEventListener(eventType, handler);
  } else {
    console.warn(`Element with id '${elementId}' not found`);
  }
}

function getSafeValue(elementId, type = 'value') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element '${elementId}' not found - using fallback`);
    return type === 'checked' ? false : '';
  }
  return type === 'checked' ? element.checked : element.value;
}

// Validate numeric inputs
function validateNumericInput(value, min, max, defaultVal) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// Mark settings as unsaved
function markUnsaved() {
  window.SettingsApp.hasUnsavedChanges = true;
  showStatus('Unsaved changes', 'warning');
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

// Apply theme
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
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

// Load settings from storage
async function loadSettings() {
  const app = window.SettingsApp;
  try {
    if (typeof window.SettingsUtils !== 'undefined') {
      app.currentSettings = await window.SettingsUtils.loadSettings();
      console.log('Settings loaded via SettingsUtils');
    } else {
      const defaults = getDefaultSettings();
      await new Promise((resolve) => {
        chrome.storage.sync.get(defaults, (result) => {
          app.currentSettings = { ...defaults, ...result };
          resolve();
        });
      });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    app.currentSettings = getDefaultSettings();
  }

  applySettingsToUI();
  applyTheme(app.currentSettings.theme);
}

// Apply settings to UI elements - calls each module's apply function
function applySettingsToUI() {
  const app = window.SettingsApp;

  // Call each registered module's apply function
  Object.values(app.modules).forEach(module => {
    if (typeof module.apply === 'function') {
      try {
        module.apply(app.currentSettings);
      } catch (error) {
        console.error('Error applying module settings:', error);
      }
    }
  });

  app.hasUnsavedChanges = false;
}

// Save settings - collects from all modules
function saveSettings() {
  const app = window.SettingsApp;

  // Start with base settings object
  let newSettings = {};

  // Collect settings from each module
  Object.values(app.modules).forEach(module => {
    if (typeof module.getSettings === 'function') {
      try {
        const moduleSettings = module.getSettings();
        newSettings = { ...newSettings, ...moduleSettings };
      } catch (error) {
        console.error('Error collecting module settings:', error);
      }
    }
  });

  // Save to storage using SettingsUtils with validation
  if (typeof window.SettingsUtils !== 'undefined') {
    window.SettingsUtils.saveSettings(newSettings)
      .then((validated) => {
        app.currentSettings = { ...validated };
        app.hasUnsavedChanges = false;
        showStatus('✓ Settings saved successfully!', 'success');

        // Notify other pages about theme change
        try {
          chrome.runtime.sendMessage({
            type: 'themeChanged',
            theme: validated.theme
          });
        } catch (error) {
          console.log('No listeners for theme change message (this is normal)');
        }
      })
      .catch((error) => {
        showStatus('Error saving settings: ' + error.message, 'error');
      });
  } else {
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        app.currentSettings = { ...newSettings };
        app.hasUnsavedChanges = false;
        showStatus('✓ Settings saved successfully!', 'success');

        try {
          chrome.runtime.sendMessage({
            type: 'themeChanged',
            theme: newSettings.theme
          });
        } catch (error) {
          console.log('No listeners for theme change message (this is normal)');
        }
      }
    });
  }
}

// Reset settings
async function resetSettings() {
  const app = window.SettingsApp;

  if (confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
    try {
      const defaults = getDefaultSettings();
      if (typeof window.SettingsUtils !== 'undefined') {
        await window.SettingsUtils.resetSettings();
        app.currentSettings = { ...window.SettingsUtils.getDefaultSettings() };
      } else {
        chrome.storage.sync.clear(() => {
          app.currentSettings = { ...defaults };
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
        console.log('No listeners for theme change message (this is normal)');
      }
    } catch (error) {
      showStatus('Error resetting settings: ' + error.message, 'error');
    }
  }
}

// Attach core event listeners
function attachCoreEventListeners() {
  const app = window.SettingsApp;

  // Use event delegation for all input changes
  document.addEventListener('change', (e) => {
    if (e.target.matches('input, select')) {
      markUnsaved();
    }
  }, { once: false });

  // Save button
  safeAddListener('save-btn', 'click', saveSettings);

  // Cancel button
  safeAddListener('cancel-btn', 'click', async () => {
    if (app.hasUnsavedChanges) {
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
    if (app.hasUnsavedChanges) {
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

  // Warn before closing with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (app.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Call each module's attach function
  Object.values(app.modules).forEach(module => {
    if (typeof module.attach === 'function') {
      try {
        module.attach();
      } catch (error) {
        console.error('Error attaching module listeners:', error);
      }
    }
  });
}

// Sidebar Navigation
function initializeSidebarNavigation() {
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.settings-section');

  if (sidebarLinks.length === 0 || sections.length === 0) {
    console.warn('Settings sidebar navigation elements not found');
    return;
  }

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
    const fromTop = window.scrollY + 100;
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 10;

    if (isAtBottom) {
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

  updateActiveLink();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SettingsApp;

  // Load settings asynchronously
  await loadSettings();

  // Attach core listeners first
  attachCoreEventListeners();

  // Initialize sidebar navigation
  initializeSidebarNavigation();

  // Listen for theme changes from other pages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'themeChanged') {
      applyTheme(message.theme);
      const themeSelect = document.getElementById('theme-select');
      if (themeSelect && themeSelect.value !== message.theme) {
        themeSelect.value = message.theme;
      }
    }
  });
});

// Listen for storage changes from other tabs/windows
chrome.storage.onChanged.addListener((changes, namespace) => {
  const app = window.SettingsApp;
  if (namespace === 'sync') {
    if (!app.hasUnsavedChanges) {
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

// Export functions for use by modules
window.SettingsCore = {
  getDefaultSettings,
  safeSetValue,
  safeSetChecked,
  safeAddListener,
  getSafeValue,
  validateNumericInput,
  markUnsaved,
  showStatus,
  applyTheme,
  getSeparatorValue,
  getSeparatorOption,
  loadSettings,
  saveSettings,
  resetSettings
};
