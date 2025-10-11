// Settings management
const DEFAULT_SETTINGS = {
  theme: 'light',
  defaultProfile: '',
  autoOpenResults: false,
  tabDelay: 150,
  showPreview: true,
  defaultCastCount: 5,
  defaultContentFormat: 'name-role',
  defaultOutputFormat: 'newline',
  debugMode: false
};

let currentSettings = { ...DEFAULT_SETTINGS };
let hasUnsavedChanges = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  attachEventListeners();
  loadProfiles();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...result };
    applySettingsToUI();
    applyTheme(currentSettings.theme);
  });
}

// Apply settings to UI elements
function applySettingsToUI() {
  document.getElementById('theme-select').value = currentSettings.theme;
  document.getElementById('default-profile').value = currentSettings.defaultProfile || '';
  document.getElementById('auto-open-results').checked = currentSettings.autoOpenResults;
  document.getElementById('tab-delay').value = currentSettings.tabDelay;
  document.getElementById('show-preview').checked = currentSettings.showPreview;
  document.getElementById('default-cast-count').value = currentSettings.defaultCastCount;
  document.getElementById('default-content-format').value = currentSettings.defaultContentFormat;
  document.getElementById('default-output-format').value = currentSettings.defaultOutputFormat;
  document.getElementById('debug-mode').checked = currentSettings.debugMode;

  hasUnsavedChanges = false;
}

// Load available profiles
function loadProfiles() {
  chrome.storage.sync.get(['profiles'], (result) => {
    const profiles = result.profiles || {};
    const select = document.getElementById('default-profile');

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
}

// Attach event listeners
function attachEventListeners() {
  // Theme change
  document.getElementById('theme-select').addEventListener('change', (e) => {
    applyTheme(e.target.value);
    markUnsaved();
  });

  // All input changes
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.addEventListener('change', markUnsaved);
  });

  // Save button
  document.getElementById('save-btn').addEventListener('click', saveSettings);

  // Cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        loadSettings(); // Reload original settings
      }
    } else {
      window.close();
    }
  });

  // Close button
  document.getElementById('close-btn').addEventListener('click', () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        window.close();
      }
    } else {
      window.close();
    }
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', resetSettings);

  // Warn before closing with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// Mark settings as unsaved
function markUnsaved() {
  hasUnsavedChanges = true;
  showStatus('Unsaved changes', 'warning');
}

// Save settings
function saveSettings() {
  // Collect all settings
  const newSettings = {
    theme: document.getElementById('theme-select').value,
    defaultProfile: document.getElementById('default-profile').value,
    autoOpenResults: document.getElementById('auto-open-results').checked,
    tabDelay: parseInt(document.getElementById('tab-delay').value),
    showPreview: document.getElementById('show-preview').checked,
    defaultCastCount: parseInt(document.getElementById('default-cast-count').value),
    defaultContentFormat: document.getElementById('default-content-format').value,
    defaultOutputFormat: document.getElementById('default-output-format').value,
    debugMode: document.getElementById('debug-mode').checked
  };

  // Save to storage
  chrome.storage.sync.set(newSettings, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
    } else {
      currentSettings = { ...newSettings };
      hasUnsavedChanges = false;
      showStatus('✓ Settings saved successfully!', 'success');

      // Notify other pages about theme change
      chrome.runtime.sendMessage({
        type: 'themeChanged',
        theme: newSettings.theme
      });
    }
  });
}

// Reset settings
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
    chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error resetting settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        currentSettings = { ...DEFAULT_SETTINGS };
        applySettingsToUI();
        applyTheme(DEFAULT_SETTINGS.theme);
        showStatus('✓ Settings reset to defaults', 'success');

        // Notify other pages about theme change
        chrome.runtime.sendMessage({
          type: 'themeChanged',
          theme: DEFAULT_SETTINGS.theme
        });
      }
    });
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('save-status');
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

// Listen for storage changes from other tabs/windows
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    // Reload settings if changed elsewhere
    if (!hasUnsavedChanges) {
      loadSettings();
    }
  }
});
