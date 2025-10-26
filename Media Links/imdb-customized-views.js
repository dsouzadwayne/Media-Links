// IMDb Customized Views Integration
// Extracts cast/crew data and creates customized views on IMDb pages

(function() {
  'use strict';

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Early exit if extension context is invalid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping IMDb customized views');
    return;
  }

  /**
   * Check if we're on an IMDb fullcredits page
   */
  function isIMDbFullCreditsPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/fullcredits');
  }

  /**
   * Normalize role text by removing "the" prefix and "(as ...)" suffix
   */
  function normalizeRole(roleText) {
    let normalized = roleText.toLowerCase().trim();
    // Remove "the " prefix if present
    if (normalized.startsWith('the ')) {
      normalized = normalized.substring(4);
    }
    // Remove "(as ...)" suffix if present
    normalized = normalized.replace(/\s*\(as\s+[^)]*\)\s*/g, '').trim();
    return normalized;
  }

  /**
   * Check if role should be excluded entirely
   */
  function shouldExcludeRole(roleText, sectionName) {
    const roleLower = roleText.toLowerCase().trim();

    // Check if role has multiple parts (separated by /)
    const hasMultipleRoles = roleText.includes('/');

    // Roles to exclude
    const excludedProducerRoles = [
      'co-producer',
      'supervising producer',
      'coordinating producer',
      'music producer',
      'record producer',
      'associate producer',
      'female producer'
    ];

    // Director roles to exclude
    const excludedDirectorRoles = [
      'director of photography',
      'senior art director',
      'dneg',
      'supervising art director',
      'standby art director',
      'junior art director'
    ];

    // For creators, only include if role contains 'created by' or 'creator'
    if (sectionName && sectionName.toLowerCase().includes('creator')) {
      const hasValidCreatorRole = roleLower.includes('created by') || roleLower.includes('creator');
      if (!hasValidCreatorRole) {
        return true;
      }
    }

    // Check if it's an excluded director role
    if (excludedDirectorRoles.some(dirRole => roleLower.includes(dirRole))) {
      return true;
    }

    // If no multiple roles and the single role is in the excluded producer list, exclude it entirely
    if (!hasMultipleRoles) {
      const normalizedRole = normalizeRole(roleLower);
      if (excludedProducerRoles.includes(normalizedRole)) {
        return true;
      }
    }

    // If has multiple roles, check if it contains at least one valid producer role
    if (hasMultipleRoles) {
      // Split and normalize each role
      const roles = roleText.split('/').map(r => normalizeRole(r));

      // Check if all roles are from the excluded producer list
      const allExcludedProducers = roles.every(role => excludedProducerRoles.includes(role));

      if (allExcludedProducers) {
        return true;
      }

      // Check if all roles are excluded director roles
      const allExcludedDirectors = roles.every(role =>
        excludedDirectorRoles.some(dirRole => role.includes(dirRole))
      );

      if (allExcludedDirectors) {
        return true;
      }

      // Check if it has at least one main producer role
      const hasMainProducer = roles.some(role =>
        !excludedProducerRoles.includes(role) && role.includes('producer')
      );

      if (!hasMainProducer) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine role type from the actual role text
   */
  function determineRoleTypeFromRole(roleText, sectionName) {
    const roleLower = roleText.toLowerCase();
    const sectionLower = sectionName.toLowerCase();

    // Check if role has multiple parts (separated by /)
    const hasMultipleRoles = roleText.includes('/');

    // Check for specific roles in order of priority
    // Executive Producer must be checked before regular Producer
    // But exclude co-executive producer
    if (roleLower.includes('executive producer') && !roleLower.includes('co-executive producer')) {
      return 'Executive Producers';
    }

    if (roleLower.includes('director')) {
      return 'Directors';
    }

    if (roleLower.includes('creator') || roleLower.includes('created by')) {
      return 'Creators';
    }

    if (roleLower.includes('screenplay') || roleLower.includes('written by')) {
      return 'Writers Screenplay';
    }

    if (roleLower.includes('writer')) {
      return 'Writers';
    }

    if (roleLower.includes('producer')) {
      return 'Producers';
    }

    // Fall back to section name
    if (sectionLower.includes('executive')) return 'Executive Producers';
    if (sectionLower.includes('director')) return 'Directors';
    if (sectionLower.includes('writer')) {
      if (sectionLower.includes('screenplay')) return 'Writers Screenplay';
      return 'Writers';
    }
    if (sectionLower.includes('producer')) return 'Producers';
    if (sectionLower.includes('creator')) return 'Creators';
    if (sectionLower.includes('cast')) return 'Cast';

    return 'Cast';
  }

  /**
   * Extract all cast members from the fullcredits page
   */
  function extractCastData() {
    const castData = [];
    const sections = document.querySelectorAll('section.ipc-page-section');

    sections.forEach(section => {
      // Get section name (Cast, Crew, etc.)
      const titleWrapper = section.querySelector('.ipc-title__wrapper');
      if (!titleWrapper) return;

      const titleText = titleWrapper.querySelector('.ipc-title__text');
      if (!titleText) return;

      const sectionName = titleText.textContent.trim();
      const sectionNameLower = sectionName.toLowerCase();

      // Check if this section is one we want to include
      // Only include: "Director(s)" (not "Second Unit Directors" or "Assistant Directors")
      // "Cast", "Writer(s)", "Producer(s)"
      const isAllowedSection =
        sectionNameLower === 'director' ||
        sectionNameLower === 'directors' ||
        sectionNameLower === 'cast' ||
        sectionNameLower.includes('writer') ||
        sectionNameLower.includes('producer');

      // Exclude sections with "assistant" or "second unit" in the name
      const isExcludedSection =
        sectionNameLower.includes('assistant') ||
        sectionNameLower.includes('second unit');

      if (!isAllowedSection || isExcludedSection) {
        return;
      }

      // Extract list items from this section
      const listItems = section.querySelectorAll('li[data-testid="name-credits-list-item"]');

      listItems.forEach(item => {
        // Get name
        const nameLink = item.querySelector('a.name-credits--title-text-big') ||
                        item.querySelector('a.name-credits--title-text') ||
                        item.querySelector('a[href*="/name/"]');

        if (!nameLink) return;

        const name = nameLink.textContent.trim();
        const imdbUrl = nameLink.href;

        // Get role/character
        let role = '';

        // Method 1: Character link in cast section
        const charLinkDiv = item.querySelector('div[class*="sc-2840b417-6"], div.gBAHic');
        if (charLinkDiv) {
          const charLink = charLinkDiv.querySelector('a');
          if (charLink) {
            role = charLink.textContent.trim();
          } else {
            role = charLinkDiv.textContent.trim();
          }
        }

        // Method 2: Role in crew section (directors, writers, producers, etc.)
        if (!role) {
          const roleDiv = item.querySelector('div[class*="sc-2840b417-7"]');
          if (roleDiv) {
            const roleSpan = roleDiv.querySelector('span');
            if (roleSpan) {
              role = roleSpan.textContent.trim();
            }
          }
        }

        // Method 3: Fallback for metadata div
        if (!role) {
          const metadataDiv = item.querySelector('.name-credits--crew-metadata');
          if (metadataDiv) {
            const spanInMetadata = metadataDiv.querySelector('span');
            if (spanInMetadata) {
              role = spanInMetadata.textContent.trim();
            }
          }
        }

        // Check if this role should be excluded entirely
        if (shouldExcludeRole(role, sectionName)) {
          return;
        }

        // Determine role type from the actual role text
        const roleType = determineRoleTypeFromRole(role, sectionName);

        // Only add if we got a name
        if (name) {
          castData.push({
            name: name,
            role: role || '-',
            roleType: roleType,
            imdbUrl: imdbUrl
          });
        }
      });
    });

    return castData;
  }

  /**
   * Inject extension styles into the page
   */
  function injectExtensionStyles() {
    // Check if styles are already injected
    if (document.querySelector('style[data-extension="media-links"]')) {
      return;
    }

    // Create a style element with extension CSS
    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-extension', 'media-links');
    styleElement.textContent = `
      .imdb-title-wrapper {
        display: flex !important;
        align-items: center !important;
        gap: 15px !important;
        flex-wrap: wrap !important;
        margin-bottom: 20px !important;
      }

      .imdb-title-wrapper h1 {
        margin: 0 !important;
        flex: 0 1 auto !important;
      }

      #open-customized-view-btn {
        padding: 10px 16px !important;
        background: #6366f1 !important;
        border: none !important;
        border-radius: 6px !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        margin: 0 !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
        display: inline-block !important;
        text-decoration: none !important;
        white-space: nowrap !important;
        vertical-align: middle !important;
        line-height: 1.5 !important;
        flex: 0 0 auto !important;
      }

      #open-customized-view-btn:hover {
        background: #4f46e5 !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
      }

      #open-customized-view-btn:active {
        transform: translateY(0) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
      }

      #open-customized-view-btn:focus {
        outline: 2px solid #6366f1 !important;
        outline-offset: 2px !important;
      }

      #open-customized-view-btn:disabled {
        opacity: 0.6 !important;
        cursor: not-allowed !important;
      }
    `;

    document.head.appendChild(styleElement);
    console.log('Extension styles injected');
  }

  /**
   * Load customized view settings from extension storage
   */
  function loadCustomizedViewSettings() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['showCustomizedViewBtn', 'defaultViewColumns'], (result) => {
            if (chrome.runtime.lastError) {
              console.warn('Error loading customized view settings:', chrome.runtime.lastError);
              resolve({
                showBtn: true,
                columns: ['name', 'role', 'roleType']
              });
            } else {
              resolve({
                showBtn: result.showCustomizedViewBtn !== false,
                columns: result.defaultViewColumns || ['name', 'role', 'roleType']
              });
            }
          });
        } else {
          resolve({
            showBtn: true,
            columns: ['name', 'role', 'roleType']
          });
        }
      } catch (error) {
        console.warn('Error loading customized view settings:', error);
        resolve({
          showBtn: true,
          columns: ['name', 'role', 'roleType']
        });
      }
    });
  }

  /**
   * Create a button to open the customized view in a new tab
   */
  async function createOpenViewButton() {
    if (!isIMDbFullCreditsPage()) return;

    // Load customized view settings
    const settings = await loadCustomizedViewSettings();

    // Check if the button should be shown
    if (!settings.showBtn) {
      console.log('Customized view button is disabled in settings');
      return;
    }

    // Inject styles first
    injectExtensionStyles();

    // Wait for CustomizedView to be available
    if (typeof CustomizedView === 'undefined') {
      console.log('CustomizedView not available yet, retrying...');
      setTimeout(createOpenViewButton, 500);
      return;
    }

    // Extract cast data
    const castData = extractCastData();

    if (castData.length === 0) {
      console.log('No cast data found');
      return;
    }

    // Create a temporary view instance just to use the openInNewTab method
    const view = new CustomizedView({
      containerId: 'imdb-customized-view-temp',
      data: castData,
      title: '📋 Cast & Crew Overview',
      columns: settings.columns,
      pagePath: window.location.pathname
    });

    // Load and apply saved preferences
    const savedPrefs = await view.loadPreferences();
    view.applyPreferences(savedPrefs);

    // Create button
    const button = document.createElement('button');
    button.textContent = '📋 View Cast & Crew in New Tab';
    button.id = 'open-customized-view-btn';
    button.title = 'Open the cast and crew overview in a new tab';

    button.addEventListener('click', () => {
      view.openInNewTab();
    });

    // Find the page title and position button next to it
    const pageTitle = document.querySelector('h1');
    if (pageTitle) {
      // Check if wrapper already exists
      let wrapper = pageTitle.closest('.imdb-title-wrapper');

      if (!wrapper) {
        // Create wrapper div
        wrapper = document.createElement('div');
        wrapper.className = 'imdb-title-wrapper';

        // Move title into wrapper
        pageTitle.parentNode.insertBefore(wrapper, pageTitle);
        wrapper.appendChild(pageTitle);
      }

      // Add button to wrapper
      wrapper.appendChild(button);
      console.log('Open view button created successfully next to title with columns:', settings.columns);
    } else {
      // Fallback: insert at top of main content if no title found
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainContent) {
        mainContent.insertBefore(button, mainContent.firstChild);
        console.log('Open view button created at top of content with columns:', settings.columns);
      }
    }
  }

  /**
   * Initialize on page load
   */
  if (isIMDbFullCreditsPage()) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(createOpenViewButton, 1000);
      });
    } else {
      setTimeout(createOpenViewButton, 1000);
    }
  }

})();
