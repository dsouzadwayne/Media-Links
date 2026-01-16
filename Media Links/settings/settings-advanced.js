// Settings Advanced Module - Debug mode, copy webpage, reset settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply advanced settings to UI
  function applyAdvancedSettings(settings) {
    core.safeSetChecked('debug-mode', settings.debugMode);
    core.safeSetChecked('show-copy-webpage-btn', settings.showCopyWebpageBtn !== undefined ? settings.showCopyWebpageBtn : false);

    // Copy webpage format settings
    const copyFormats = settings.copyFormats;
    if (copyFormats && typeof copyFormats === 'object') {
      core.safeSetChecked('copy-include-title', copyFormats.includeTitle !== false);
      core.safeSetChecked('copy-include-url', copyFormats.includeURL !== false);
      core.safeSetValue('copy-separator', core.getSeparatorOption(copyFormats.separator || '\n\n---\n\n'));
    } else {
      // Use defaults if copyFormats is missing
      core.safeSetChecked('copy-include-title', true);
      core.safeSetChecked('copy-include-url', true);
      core.safeSetValue('copy-separator', 'horizontal-line');
    }
  }

  // Attach advanced event listeners
  function attachAdvancedListeners() {
    // Reset button is handled in core
  }

  // Get advanced settings for save
  function getAdvancedSettings() {
    return {
      debugMode: core.getSafeValue('debug-mode', 'checked'),
      showCopyWebpageBtn: core.getSafeValue('show-copy-webpage-btn', 'checked'),
      copyFormats: {
        includeTitle: core.getSafeValue('copy-include-title', 'checked'),
        includeURL: core.getSafeValue('copy-include-url', 'checked'),
        separator: core.getSeparatorValue(core.getSafeValue('copy-separator'))
      }
    };
  }

  // Register module
  app.modules.advanced = {
    apply: applyAdvancedSettings,
    attach: attachAdvancedListeners,
    getSettings: getAdvancedSettings
  };
})();
