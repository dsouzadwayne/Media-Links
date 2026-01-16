// Settings Comparison Module - Wikipedia/IMDb comparison feature
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Toggle comparison settings subsection visibility
  function toggleComparisonSettings(enabled) {
    const subsection = document.getElementById('comparison-settings');
    if (subsection) {
      if (enabled) {
        subsection.style.opacity = '1';
        subsection.style.pointerEvents = 'auto';
        subsection.setAttribute('aria-disabled', 'false');
        const inputs = subsection.querySelectorAll('input, select');
        inputs.forEach(input => {
          input.disabled = false;
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

  // Apply comparison settings to UI
  function applyComparisonSettings(settings) {
    core.safeSetChecked('enable-comparison-feature', settings.enableComparisonFeature === true);
    core.safeSetChecked('show-comparison-btn-wiki', settings.showComparisonBtnWiki !== false);
    core.safeSetChecked('show-comparison-btn-imdb', settings.showComparisonBtnImdb !== false);
    core.safeSetChecked('auto-open-comparison', settings.autoOpenComparison !== false);

    // Toggle subsection based on enable state
    toggleComparisonSettings(settings.enableComparisonFeature === true);
  }

  // Attach comparison event listeners
  function attachComparisonListeners() {
    core.safeAddListener('enable-comparison-feature', 'change', (e) => {
      toggleComparisonSettings(e.target.checked);
      core.markUnsaved();
    });
  }

  // Get comparison settings for save
  function getComparisonSettings() {
    return {
      enableComparisonFeature: core.getSafeValue('enable-comparison-feature', 'checked'),
      showComparisonBtnWiki: core.getSafeValue('show-comparison-btn-wiki', 'checked'),
      showComparisonBtnImdb: core.getSafeValue('show-comparison-btn-imdb', 'checked'),
      autoOpenComparison: core.getSafeValue('auto-open-comparison', 'checked')
    };
  }

  // Register module
  app.modules.comparison = {
    apply: applyComparisonSettings,
    attach: attachComparisonListeners,
    getSettings: getComparisonSettings
  };
})();
