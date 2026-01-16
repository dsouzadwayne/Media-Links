// Settings Customized View Module - IMDb and Wikipedia customized views
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply customized view settings to UI
  function applyCustomViewSettings(settings) {
    // Entry limit
    core.safeSetValue('customized-view-limit', settings.customizedViewLimit || 8);

    // IMDb settings
    core.safeSetChecked('show-customized-view-btn', settings.showCustomizedViewBtn !== false);
    core.safeSetChecked('auto-open-individual-view', settings.autoOpenIndividualView !== false);
    core.safeSetChecked('show-consolidated-view-btn', settings.showConsolidatedViewBtn !== false);
    core.safeSetChecked('auto-open-consolidated-view', settings.autoOpenConsolidatedView !== false);

    // Wikipedia settings
    core.safeSetChecked('show-wiki-customized-view-btn', settings.showWikiCustomizedViewBtn !== false);
    core.safeSetChecked('auto-open-wiki-view', settings.autoOpenWikiView !== false);

    // Default view columns
    const defaultColumns = settings.defaultViewColumns || ['name', 'role', 'roleType'];
    const columnCheckboxes = document.querySelectorAll('.view-column-checkbox');
    columnCheckboxes.forEach(checkbox => {
      checkbox.checked = defaultColumns.includes(checkbox.value);
    });
  }

  // Attach customized view event listeners
  function attachCustomViewListeners() {
    // No special listeners needed - generic change handler in core handles markUnsaved
  }

  // Get customized view settings for save
  function getCustomViewSettings() {
    return {
      customizedViewLimit: core.validateNumericInput(core.getSafeValue('customized-view-limit'), 1, 1000, 8),
      showCustomizedViewBtn: core.getSafeValue('show-customized-view-btn', 'checked'),
      autoOpenIndividualView: core.getSafeValue('auto-open-individual-view', 'checked'),
      showConsolidatedViewBtn: core.getSafeValue('show-consolidated-view-btn', 'checked'),
      autoOpenConsolidatedView: core.getSafeValue('auto-open-consolidated-view', 'checked'),
      showWikiCustomizedViewBtn: core.getSafeValue('show-wiki-customized-view-btn', 'checked'),
      autoOpenWikiView: core.getSafeValue('auto-open-wiki-view', 'checked'),
      defaultViewColumns: Array.from(document.querySelectorAll('.view-column-checkbox:checked')).map(cb => cb.value)
    };
  }

  // Register module
  app.modules.customview = {
    apply: applyCustomViewSettings,
    attach: attachCustomViewListeners,
    getSettings: getCustomViewSettings
  };
})();
