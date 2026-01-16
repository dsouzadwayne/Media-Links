// Settings Appearance Module - Theme and visual settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply appearance settings to UI
  function applyAppearanceSettings(settings) {
    core.safeSetValue('theme-select', settings.theme);
    core.safeSetChecked('show-sidebar-bookmarklet-runner', settings.showSidebarBookmarkletRunner === true);
  }

  // Attach appearance event listeners
  function attachAppearanceListeners() {
    // Theme change - apply immediately
    core.safeAddListener('theme-select', 'change', (e) => {
      core.applyTheme(e.target.value);
      core.markUnsaved();
    });
  }

  // Get appearance settings for save
  function getAppearanceSettings() {
    return {
      theme: core.getSafeValue('theme-select'),
      showSidebarBookmarkletRunner: core.getSafeValue('show-sidebar-bookmarklet-runner', 'checked')
    };
  }

  // Register module
  app.modules.appearance = {
    apply: applyAppearanceSettings,
    attach: attachAppearanceListeners,
    getSettings: getAppearanceSettings
  };
})();
