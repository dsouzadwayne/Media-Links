// Settings Bookmarklets Module - JS Bookmarklet editor button
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply bookmarklets settings to UI (nothing to apply)
  function applyBookmarkletsSettings(settings) {
    // No settings to apply - just the editor button
  }

  // Attach bookmarklets event listeners
  function attachBookmarkletsListeners() {
    core.safeAddListener('open-bookmarklet-editor', 'click', () => {
      const editorUrl = chrome.runtime.getURL('bookmarklet-editor/bookmarkleteditor.html');
      chrome.tabs.create({ url: editorUrl });
    });
  }

  // Get bookmarklets settings for save (none)
  function getBookmarkletsSettings() {
    return {};
  }

  // Register module
  app.modules.bookmarklets = {
    apply: applyBookmarkletsSettings,
    attach: attachBookmarkletsListeners,
    getSettings: getBookmarkletsSettings
  };
})();
