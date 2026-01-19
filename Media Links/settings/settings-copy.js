// Settings Copy Module - Copy button visibility for all sites
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply copy visibility settings to UI
  function applyCopySettings(settings) {
    // IMDb settings
    core.safeSetValue('default-cast-count', settings.defaultCastCount);
    core.safeSetValue('default-content-format', settings.defaultContentFormat);
    core.safeSetValue('default-output-format', settings.defaultOutputFormat);
    core.safeSetChecked('show-imdb-cast', settings.showImdbCast);
    core.safeSetChecked('show-imdb-company', settings.showImdbCompany);
    core.safeSetChecked('show-imdb-awards', settings.showImdbAwards);
    core.safeSetChecked('show-imdb-main', settings.showImdbMain);

    // Wikipedia settings
    core.safeSetChecked('show-wiki-cast', settings.showWikiCast);
    core.safeSetChecked('show-wiki-tables', settings.showWikiTables);
    core.safeSetValue('wiki-output-format', settings.wikiOutputFormat);

    // Letterboxd settings
    core.safeSetChecked('show-letterboxd-cast', settings.showLetterboxdCast);
    core.safeSetValue('letterboxd-cast-count', settings.letterboxdCastCount);
    core.safeSetValue('letterboxd-output-format', settings.letterboxdOutputFormat);
    core.safeSetChecked('letterboxd-include-roles', settings.letterboxdIncludeRoles);

    // Apple TV+ settings
    core.safeSetChecked('show-appletv-cast', settings.showAppleTVCast);
    core.safeSetValue('appletv-cast-count', settings.appleTVCastCount);
    core.safeSetValue('appletv-output-format', settings.appleTVOutputFormat);
    core.safeSetChecked('appletv-include-roles', settings.appleTVIncludeRoles);

    // BookMyShow settings
    core.safeSetChecked('show-bookmyshow-copy', settings.showBookMyShowCopy !== false);
    core.safeSetValue('bookmyshow-cast-count', settings.bookMyShowCastCount);
    core.safeSetValue('bookmyshow-output-format', settings.bookMyShowOutputFormat);
    core.safeSetChecked('bookmyshow-include-roles', settings.bookMyShowIncludeRoles);
  }

  // Attach copy event listeners
  function attachCopyListeners() {
    // No special listeners needed - generic change handler in core handles markUnsaved
  }

  // Get copy settings for save
  function getCopySettings() {
    return {
      // IMDb settings
      defaultCastCount: core.validateNumericInput(core.getSafeValue('default-cast-count'), 1, 1000, 5),
      defaultContentFormat: core.getSafeValue('default-content-format'),
      defaultOutputFormat: core.getSafeValue('default-output-format'),
      showImdbCast: core.getSafeValue('show-imdb-cast', 'checked'),
      showImdbCompany: core.getSafeValue('show-imdb-company', 'checked'),
      showImdbAwards: core.getSafeValue('show-imdb-awards', 'checked'),
      showImdbMain: core.getSafeValue('show-imdb-main', 'checked'),

      // Wikipedia settings
      showWikiCast: core.getSafeValue('show-wiki-cast', 'checked'),
      showWikiTables: core.getSafeValue('show-wiki-tables', 'checked'),
      wikiOutputFormat: core.getSafeValue('wiki-output-format'),

      // Letterboxd settings
      showLetterboxdCast: core.getSafeValue('show-letterboxd-cast', 'checked'),
      letterboxdCastCount: core.validateNumericInput(core.getSafeValue('letterboxd-cast-count'), 1, 1000, 10),
      letterboxdOutputFormat: core.getSafeValue('letterboxd-output-format'),
      letterboxdIncludeRoles: core.getSafeValue('letterboxd-include-roles', 'checked'),

      // Apple TV+ settings
      showAppleTVCast: core.getSafeValue('show-appletv-cast', 'checked'),
      appleTVCastCount: core.validateNumericInput(core.getSafeValue('appletv-cast-count'), 1, 1000, 10),
      appleTVOutputFormat: core.getSafeValue('appletv-output-format'),
      appleTVIncludeRoles: core.getSafeValue('appletv-include-roles', 'checked'),

      // BookMyShow settings
      showBookMyShowCopy: core.getSafeValue('show-bookmyshow-copy', 'checked'),
      bookMyShowCastCount: core.validateNumericInput(core.getSafeValue('bookmyshow-cast-count'), 1, 1000, 10),
      bookMyShowOutputFormat: core.getSafeValue('bookmyshow-output-format'),
      bookMyShowIncludeRoles: core.getSafeValue('bookmyshow-include-roles', 'checked')
    };
  }

  // Register module
  app.modules.copy = {
    apply: applyCopySettings,
    attach: attachCopyListeners,
    getSettings: getCopySettings
  };
})();
