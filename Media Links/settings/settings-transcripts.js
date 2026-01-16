// Settings Transcripts Module - YouTube transcript settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply transcripts settings to UI
  function applyTranscriptsSettings(settings) {
    core.safeSetChecked('show-youtube-transcript', settings.showYouTubeTranscript !== false);
  }

  // Attach transcripts event listeners
  function attachTranscriptsListeners() {
    // No special listeners needed - generic change handler in core handles markUnsaved
  }

  // Get transcripts settings for save
  function getTranscriptsSettings() {
    return {
      showYouTubeTranscript: core.getSafeValue('show-youtube-transcript', 'checked')
    };
  }

  // Register module
  app.modules.transcripts = {
    apply: applyTranscriptsSettings,
    attach: attachTranscriptsListeners,
    getSettings: getTranscriptsSettings
  };
})();
