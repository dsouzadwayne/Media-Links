// Settings Hotstar Module - Hotstar-specific settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply Hotstar settings to UI
  function applyHotstarSettings(settings) {
    core.safeSetChecked('hotstar-auto-viewmore-paused', settings.hotstarAutoViewMorePaused !== undefined ? settings.hotstarAutoViewMorePaused : false);
  }

  // Attach Hotstar event listeners
  function attachHotstarListeners() {
    // No special listeners needed - generic change handler in core handles markUnsaved
  }

  // Get Hotstar settings for save
  function getHotstarSettings() {
    return {
      hotstarAutoViewMorePaused: core.getSafeValue('hotstar-auto-viewmore-paused', 'checked')
    };
  }

  // Register module
  app.modules.hotstar = {
    apply: applyHotstarSettings,
    attach: attachHotstarListeners,
    getSettings: getHotstarSettings
  };
})();
