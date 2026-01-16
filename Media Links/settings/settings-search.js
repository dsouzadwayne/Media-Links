// Settings Search Module - Search engine and query settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply search settings to UI
  function applySearchSettings(settings) {
    core.safeSetValue('default-search-engine', settings.defaultSearchEngine);
    core.safeSetValue('default-profile', settings.defaultProfile || '');
    core.safeSetChecked('auto-open-results', settings.autoOpenResults);
    core.safeSetValue('tab-delay', settings.tabDelay);
    core.safeSetChecked('show-preview', settings.showPreview);

    // Load available profiles for dropdown
    loadProfiles();
  }

  // Load available profiles into dropdown
  function loadProfiles() {
    chrome.storage.sync.get(['profiles'], (result) => {
      const profiles = result.profiles || {};
      const select = document.getElementById('default-profile');

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
      select.value = app.currentSettings.defaultProfile || '';
    });
  }

  // Attach search event listeners
  function attachSearchListeners() {
    // No special listeners needed - generic change handler in core handles markUnsaved
  }

  // Get search settings for save
  function getSearchSettings() {
    return {
      defaultSearchEngine: core.getSafeValue('default-search-engine'),
      defaultProfile: core.getSafeValue('default-profile'),
      autoOpenResults: core.getSafeValue('auto-open-results', 'checked'),
      tabDelay: core.validateNumericInput(core.getSafeValue('tab-delay'), 0, 5000, 150),
      showPreview: core.getSafeValue('show-preview', 'checked')
    };
  }

  // Register module
  app.modules.search = {
    apply: applySearchSettings,
    attach: attachSearchListeners,
    getSettings: getSearchSettings
  };
})();
