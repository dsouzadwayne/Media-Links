// Settings Patterns Module - Query patterns configuration
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // Apply patterns settings to UI
  function applyPatternsSettings(settings) {
    // Load profile settings from storage
    loadProfileSettings();
  }

  // Load profile settings from storage
  function loadProfileSettings() {
    const profileContainer = document.getElementById('profile-container');
    if (profileContainer) {
      const profileSettingsEls = profileContainer.querySelectorAll('.profile-settings');
      profileSettingsEls.forEach(el => {
        el.style.opacity = '0.6';
        el.style.pointerEvents = 'none';
      });
    }

    chrome.storage.sync.get(['profileSettings'], (result) => {
      app.profileSettings = result.profileSettings || {};

      // Initialize all profiles
      for (let i = 1; i <= 4; i++) {
        initializeProfileUI(i);
      }

      // Hide loading indicator
      if (profileContainer) {
        const profileSettingsEls = profileContainer.querySelectorAll('.profile-settings');
        profileSettingsEls.forEach(el => {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        });
      }

      // Set up profile selector
      const profileSelect = document.getElementById('profile-select');
      if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
          const parsedProfile = parseInt(e.target.value, 10);
          if (isNaN(parsedProfile) || parsedProfile < 1 || parsedProfile > 4) {
            console.warn('Invalid profile ID:', e.target.value);
            return;
          }
          app.currentProfile = parsedProfile;
          document.querySelectorAll('.profile-content').forEach(p => p.classList.remove('active'));
          const activeProfile = document.getElementById(`profile${app.currentProfile}`);
          if (activeProfile) {
            activeProfile.classList.add('active');
          }
          core.markUnsaved();
        });
      }
    });
  }

  // Initialize profile UI for a specific profile number
  function initializeProfileUI(profileNum) {
    const container = document.querySelector(`.profile-settings[data-profile="${profileNum}"]`);
    if (!container) return;

    container.innerHTML = '';
    const patterns = app.patternDescriptions[profileNum];
    const profileKey = `profile${profileNum}`;
    const settings = app.profileSettings[profileKey] || { ...app.defaultPatterns[profileNum] };

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

  // Save profile settings
  function saveProfileSettings() {
    const profileKey = `profile${app.currentProfile}`;

    if (!app.profileSettings || typeof app.profileSettings !== 'object') {
      app.profileSettings = {};
    }

    if (!app.profileSettings[profileKey] || typeof app.profileSettings[profileKey] !== 'object') {
      app.profileSettings[profileKey] = {};
    }

    document.querySelectorAll(`#profile${app.currentProfile} .query-setting`).forEach(checkbox => {
      const pattern = checkbox.dataset.pattern;
      if (pattern) {
        app.profileSettings[profileKey][pattern] = checkbox.checked;
      }
    });

    chrome.storage.sync.set({ profileSettings: app.profileSettings }, () => {
      if (chrome.runtime.lastError) {
        core.showStatus('Error saving profile: ' + chrome.runtime.lastError.message, 'error');
      } else {
        core.showStatus('✓ Profile saved successfully!', 'success');
      }
    });
  }

  // Reset profile settings
  function resetProfileSettings() {
    if (!confirm(`Are you sure you want to reset the ${app.currentProfile} element profile to default?`)) {
      return;
    }

    const profileKey = `profile${app.currentProfile}`;
    app.profileSettings[profileKey] = { ...app.defaultPatterns[app.currentProfile] };

    chrome.storage.sync.set({ profileSettings: app.profileSettings }, () => {
      if (chrome.runtime.lastError) {
        core.showStatus('Error resetting profile: ' + chrome.runtime.lastError.message, 'error');
      } else {
        initializeProfileUI(app.currentProfile);
        core.showStatus('✓ Profile reset to defaults', 'success');
      }
    });
  }

  // Select all patterns in current profile
  function selectAllProfile() {
    document.querySelectorAll(`#profile${app.currentProfile} .query-setting`).forEach(checkbox => {
      checkbox.checked = true;
    });
    core.showStatus('All patterns selected', 'info');
  }

  // Deselect all patterns in current profile
  function deselectAllProfile() {
    document.querySelectorAll(`#profile${app.currentProfile} .query-setting`).forEach(checkbox => {
      checkbox.checked = false;
    });
    core.showStatus('All patterns deselected', 'info');
  }

  // Attach patterns event listeners
  function attachPatternsListeners() {
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
  }

  // Get patterns settings for save (patterns are saved separately via profile buttons)
  function getPatternsSettings() {
    // Profile settings are saved via their own buttons, not the main save
    return {};
  }

  // Register module
  app.modules.patterns = {
    apply: applyPatternsSettings,
    attach: attachPatternsListeners,
    getSettings: getPatternsSettings
  };
})();
