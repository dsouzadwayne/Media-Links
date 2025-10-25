// Settings management
const DEFAULT_SETTINGS = {
  theme: 'light',
  defaultSearchEngine: 'google',
  defaultProfile: '',
  autoOpenResults: false,
  tabDelay: 150,
  showPreview: true,
  defaultCastCount: 5,
  defaultContentFormat: 'name-role',
  defaultOutputFormat: 'newline',
  debugMode: false,
  showCopyWebpageBtn: false,
  // Copy button visibility settings
  showImdbCast: true,
  showImdbCompany: true,
  showImdbAwards: true,
  showImdbMain: true,
  showWikiCast: true,
  showWikiTables: true,
  showLetterboxdCast: true,
  showAppleTVCast: true,
  // Apple TV+ specific settings
  appleTVCastCount: 10,
  appleTVOutputFormat: 'colon',
  appleTVIncludeRoles: true
};

let currentSettings = { ...DEFAULT_SETTINGS };
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
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
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
  document.getElementById('default-search-engine').value = currentSettings.defaultSearchEngine;
  document.getElementById('default-profile').value = currentSettings.defaultProfile || '';
  document.getElementById('auto-open-results').checked = currentSettings.autoOpenResults;
  document.getElementById('tab-delay').value = currentSettings.tabDelay;
  document.getElementById('show-preview').checked = currentSettings.showPreview;
  document.getElementById('default-cast-count').value = currentSettings.defaultCastCount;
  document.getElementById('default-content-format').value = currentSettings.defaultContentFormat;
  document.getElementById('default-output-format').value = currentSettings.defaultOutputFormat;
  document.getElementById('debug-mode').checked = currentSettings.debugMode;
  document.getElementById('show-copy-webpage-btn').checked = currentSettings.showCopyWebpageBtn;

  // Copy webpage format settings
  const copyFormats = currentSettings.copyFormats || {};
  document.getElementById('copy-include-title').checked = copyFormats.includeTitle !== false;
  document.getElementById('copy-include-url').checked = copyFormats.includeURL !== false;
  document.getElementById('copy-separator').value = copyFormats.separator || '\\n\\n---\\n\\n';

  // Copy button visibility settings
  document.getElementById('show-imdb-cast').checked = currentSettings.showImdbCast;
  document.getElementById('show-imdb-company').checked = currentSettings.showImdbCompany;
  document.getElementById('show-imdb-awards').checked = currentSettings.showImdbAwards;
  document.getElementById('show-imdb-main').checked = currentSettings.showImdbMain;
  document.getElementById('show-wiki-cast').checked = currentSettings.showWikiCast;
  document.getElementById('show-wiki-tables').checked = currentSettings.showWikiTables;
  document.getElementById('show-letterboxd-cast').checked = currentSettings.showLetterboxdCast;
  document.getElementById('show-appletv-cast').checked = currentSettings.showAppleTVCast;
  document.getElementById('show-bookmyshow-copy').checked = currentSettings.showBookMyShowCopy !== false;

  // Apple TV+ specific settings
  document.getElementById('appletv-cast-count').value = currentSettings.appleTVCastCount;
  document.getElementById('appletv-output-format').value = currentSettings.appleTVOutputFormat;
  document.getElementById('appletv-include-roles').checked = currentSettings.appleTVIncludeRoles;

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
  document.documentElement.setAttribute('data-theme', theme);
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
    defaultSearchEngine: document.getElementById('default-search-engine').value,
    defaultProfile: document.getElementById('default-profile').value,
    autoOpenResults: document.getElementById('auto-open-results').checked,
    tabDelay: parseInt(document.getElementById('tab-delay').value),
    showPreview: document.getElementById('show-preview').checked,
    defaultCastCount: parseInt(document.getElementById('default-cast-count').value),
    defaultContentFormat: document.getElementById('default-content-format').value,
    defaultOutputFormat: document.getElementById('default-output-format').value,
    debugMode: document.getElementById('debug-mode').checked,
    showCopyWebpageBtn: document.getElementById('show-copy-webpage-btn').checked,
    // Copy webpage format settings
    copyFormats: {
      includeTitle: document.getElementById('copy-include-title').checked,
      includeURL: document.getElementById('copy-include-url').checked,
      separator: document.getElementById('copy-separator').value
    },
    // Copy button visibility settings
    showImdbCast: document.getElementById('show-imdb-cast').checked,
    showImdbCompany: document.getElementById('show-imdb-company').checked,
    showImdbAwards: document.getElementById('show-imdb-awards').checked,
    showImdbMain: document.getElementById('show-imdb-main').checked,
    showWikiCast: document.getElementById('show-wiki-cast').checked,
    showWikiTables: document.getElementById('show-wiki-tables').checked,
    showLetterboxdCast: document.getElementById('show-letterboxd-cast').checked,
    showAppleTVCast: document.getElementById('show-appletv-cast').checked,
    showBookMyShowCopy: document.getElementById('show-bookmyshow-copy').checked,
    // Apple TV+ specific settings
    appleTVCastCount: parseInt(document.getElementById('appletv-cast-count').value),
    appleTVOutputFormat: document.getElementById('appletv-output-format').value,
    appleTVIncludeRoles: document.getElementById('appletv-include-roles').checked
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

// Profile Settings Functions
function loadProfileSettings() {
  chrome.storage.sync.get(['profileSettings'], (result) => {
    profileSettings = result.profileSettings || {};

    // Initialize all profiles
    for (let i = 1; i <= 4; i++) {
      initializeProfileUI(i);
    }

    // Set up profile selector
    const profileSelect = document.getElementById('profile-select');
    if (profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        currentProfile = parseInt(e.target.value);
        document.querySelectorAll('.profile-content').forEach(p => p.classList.remove('active'));
        document.getElementById(`profile${currentProfile}`).classList.add('active');
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
  if (!profileSettings[profileKey]) {
    profileSettings[profileKey] = {};
  }

  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    const pattern = checkbox.dataset.pattern;
    profileSettings[profileKey][pattern] = checkbox.checked;
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
    // Reload settings if changed elsewhere
    if (!hasUnsavedChanges) {
      loadSettings();
    }
  }
});
