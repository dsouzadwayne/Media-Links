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
   * Check if we're on an IMDb company credits page
   */
  function isIMDbCompanyCreditsPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/companycredits');
  }

  /**
   * Check if we're on an IMDb awards page
   */
  function isIMDbAwardsPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/awards');
  }

  /**
   * Check if we're on an IMDb release info page
   */
  function isIMDbReleaseInfoPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/releaseinfo');
  }

  /**
   * Check if we're on an IMDb technical specs page
   */
  function isIMDbTechnicalPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/technical');
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
   * Extract awards from the awards page (Winners only)
   */
  async function extractAwardsData() {
    // Auto-click all "See all" buttons to expand all award categories
    const seeAllButtons = document.querySelectorAll('.ipc-see-more__button');
    console.log('Found', seeAllButtons.length, 'see-all buttons, auto-clicking to expand...');

    for (const btn of seeAllButtons) {
      btn.click();
      // Wait a bit for the section to expand
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait a bit more for all content to fully render
    await new Promise(resolve => setTimeout(resolve, 500));

    const awardsData = [];
    const awardItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list-summary-item');

    console.log('Awards extraction: Found', awardItems.length, 'award items on page');

    awardItems.forEach((item, index) => {
      try {
        // Get the full text content of the item to check for "Winner"
        const fullText = item.textContent.trim();

        // Only process if it contains "Winner" - skip nominees
        if (!fullText.includes('Winner') || fullText.includes('Nominee')) {
          if (index < 2) console.log('Debug item', index, ': Not a winner (skipping)');
          return;
        }

        // Get person/entity name - look for any link in the left section
        const stlSection = item.querySelector('.ipc-metadata-list-summary-item__stl');
        let personName = '';
        let personLink = null;

        if (stlSection) {
          // Try to find a link
          const link = stlSection.querySelector('a');
          if (link) {
            personName = link.textContent.trim();
            personLink = link;
          } else {
            // If no link, get the text content
            personName = stlSection.textContent.trim();
          }
        }

        // Get award organization/body from the right section
        const tcSection = item.querySelector('.ipc-metadata-list-summary-item__tc');
        let awardBody = '';
        if (tcSection) {
          const link = tcSection.querySelector('a');
          if (link) {
            awardBody = link.textContent.trim();
            // Remove year pattern (e.g., "2024", "2023")
            awardBody = awardBody.replace(/\b(19|20)\d{2}\b/g, '').trim();
            // Remove "Winner" text
            awardBody = awardBody.replace(/Winner/gi, '').trim();
            // Clean up extra spaces
            awardBody = awardBody.replace(/\s+/g, ' ').trim();
          }
        }

        // Get award category and other info from middle section
        const tlSection = item.querySelector('.ipc-metadata-list-summary-item__tl');
        let category = '';
        let year = '';
        if (tlSection) {
          // Extract all text and clean it up
          const allText = tlSection.textContent.trim();
          // Try to extract the award category (usually the longest text part)
          const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          // The category is usually after the "Winner" text
          if (lines.length > 1) {
            category = lines[lines.length - 1]; // Last line is usually the category
          } else if (lines.length > 0) {
            category = lines[0];
          }
        }

        // Try to extract year from the item - look for 4-digit year pattern
        const yearMatch = fullText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          year = yearMatch[0];
        }

        if (index < 2) {
          console.log('Debug item', index, ':', {
            personName: personName || '(empty)',
            awardBody: awardBody || '(empty)',
            category: category || '(empty)',
            year: year || '(empty)',
            hasWinner: fullText.includes('Winner')
          });
        }

        // Add if we have at least name and award body
        if (personName && awardBody) {
          const roleType = category || 'Award';

          awardsData.push({
            name: personName,
            role: awardBody,
            award: category,  // Store award category separately for display
            year: year,       // Store year for display
            roleType: roleType,
            imdbUrl: personLink ? personLink.href : ''
          });
        }
      } catch (e) {
        console.error('Error processing award item', index, ':', e);
      }
    });

    console.log('Awards extraction complete: Found', awardsData.length, 'winners');
    return awardsData;
  }

  /**
   * Extract release dates from the release info page
   */
  async function extractReleaseData() {
    // Auto-click all "See all" and "more" buttons to expand all release sections
    const seeAllButtons = document.querySelectorAll('.ipc-see-more__button');
    console.log('Found', seeAllButtons.length, 'see-all/more buttons, auto-clicking to expand...');

    for (const btn of seeAllButtons) {
      btn.click();
      // Wait a bit for the section to expand
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait a bit more for all content to fully render
    await new Promise(resolve => setTimeout(resolve, 500));

    const releaseData = [];
    const releaseItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list__item');

    console.log('Release extraction: Found', releaseItems.length, 'release items on page');

    let earliestEntry = null;

    releaseItems.forEach((item, index) => {
      try {
        // Get region/country name
        const regionLink = item.querySelector('.ipc-metadata-list-item__label--link');
        let region = '';
        if (regionLink) {
          region = regionLink.textContent.trim();
        }

        // Get date and location info
        let date = '';
        let location = '';

        const contentContainer = item.querySelector('.ipc-metadata-list-item__content-container');
        if (contentContainer) {
          // Get the date
          const dateSpan = contentContainer.querySelector('.ipc-metadata-list-item__list-content-item:not(.ipc-metadata-list-item__list-content-item--subText)');
          if (dateSpan) {
            date = dateSpan.textContent.trim();
          }

          // Get the location/event info from subtext
          const subText = contentContainer.querySelector('.ipc-metadata-list-item__list-content-item--subText');
          if (subText) {
            location = subText.textContent.trim();
          }
        }

        // Store the first (earliest) entry
        if (index === 0 && region && date) {
          earliestEntry = {
            name: region,
            role: date,
            award: location,
            roleType: 'Release Dates',
            imdbUrl: ''
          };
        }

        if (index < 2) {
          console.log('Debug item', index, ':', {
            region: region || '(empty)',
            date: date || '(empty)',
            location: location || '(empty)'
          });
        }

        // Add only India entries
        if (region && date && region.toLowerCase() === 'india') {
          releaseData.push({
            name: region,
            role: date,
            award: location,  // Using award column for location info
            roleType: 'Release Dates',
            imdbUrl: ''
          });
        }
      } catch (e) {
        console.error('Error processing release item', index, ':', e);
      }
    });

    // If earliest entry exists and is not India, add it as well
    if (earliestEntry && earliestEntry.name.toLowerCase() !== 'india') {
      releaseData.unshift(earliestEntry);
      console.log('Added earliest release date:', earliestEntry);
    }

    console.log('Release extraction complete: Found', releaseData.length, 'release dates (India + earliest)');
    return releaseData;
  }

  /**
   * Extract technical specifications from the technical specs page
   */
  function extractTechnicalData() {
    const technicalData = [];
    let runtimeCount = 0;

    // Extract Runtime - look for runtime spec item
    const runtimeItem = document.querySelector('li[data-testid="title-techspec_runtime"]');
    if (runtimeItem) {
      const contentContainer = runtimeItem.querySelector('.ipc-metadata-list-item__content-container');
      if (contentContainer) {
        // Get all inline list items (each runtime is a separate item)
        const runtimeItems = contentContainer.querySelectorAll('.ipc-inline-list__item');
        runtimeItems.forEach((item) => {
          let timeValue = item.textContent.trim();
          // Clean up the value - remove extra whitespace
          timeValue = timeValue.replace(/\s+/g, ' ').trim();

          if (timeValue) {
            runtimeCount++;
            const runtimeLabel = runtimeCount === 1 ? 'Runtime' : `Runtime (${runtimeCount})`;
            technicalData.push({
              name: runtimeLabel,
              role: timeValue,
              award: '',
              roleType: 'Technical Specifications',
              imdbUrl: ''
            });
          }
        });
      }
    }

    // Extract Color - look for color spec item
    const colorItem = document.querySelector('li[data-testid="title-techspec_color"]');
    if (colorItem) {
      const contentContainer = colorItem.querySelector('.ipc-metadata-list-item__content-container');
      if (contentContainer) {
        // Get all color values (there can be multiple)
        const colorLinks = contentContainer.querySelectorAll('.ipc-metadata-list-item__list-content-item--link');
        let colorCount = 0;
        colorLinks.forEach((link) => {
          const colorValue = link.textContent.trim();
          if (colorValue) {
            colorCount++;
            const colorLabel = colorCount === 1 ? 'Color' : `Color (${colorCount})`;
            technicalData.push({
              name: colorLabel,
              role: colorValue,
              award: '',
              roleType: 'Technical Specifications',
              imdbUrl: ''
            });
          }
        });
        console.log('Color items found:', colorCount);
      }
    }

    console.log('Technical extraction complete: Found', technicalData.length, 'specifications');
    return technicalData;
  }

  /**
   * Extract production companies from the company credits page
   */
  function extractCompanyData() {
    const companyData = [];
    const sections = document.querySelectorAll('section.ipc-page-section');

    sections.forEach(section => {
      // Get section name
      const titleWrapper = section.querySelector('.ipc-title__wrapper');
      if (!titleWrapper) return;

      const titleText = titleWrapper.querySelector('.ipc-title__text');
      if (!titleText) return;

      const sectionName = titleText.textContent.trim();

      // Only process Production Companies section
      if (!sectionName.toLowerCase().includes('production')) {
        return;
      }

      // Extract list items from this section
      const listItems = section.querySelectorAll('li.ipc-metadata-list__item');

      listItems.forEach(item => {
        // Get company name
        const nameLink = item.querySelector('a[href*="/company/"]') ||
                        item.querySelector('a.ipc-metadata-list-item__label');

        if (!nameLink) return;

        const name = nameLink.textContent.trim();
        const imdbUrl = nameLink.href;

        // Get role/description (if available)
        let role = '';
        const roleSpan = item.querySelector('span.ipc-metadata-list-item__list-content-item');
        if (roleSpan) {
          role = roleSpan.textContent.trim();
        }

        // Only add if we got a name
        if (name) {
          companyData.push({
            name: name,
            role: role || '-',
            roleType: sectionName,
            imdbUrl: imdbUrl
          });
        }
      });
    });

    return companyData;
  }

  /**
   * Store extracted data in chrome storage for consolidated view
   */
  function storeConsolidatedData(pageType, data) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `consolidatedViewData_${pageType}`;
      chrome.storage.local.set({ [storageKey]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Error storing ${pageType} data:`, chrome.runtime.lastError);
        } else {
          console.log(`Stored ${pageType} data (${data.length} items)`);
        }
      });
    }
  }

  /**
   * Extract all cast members from the fullcredits page
   */
  function extractCastData() {
    const castData = [];
    const sections = document.querySelectorAll('section.ipc-page-section');

    console.log(`[Extract] Found ${sections.length} sections on page`);

    sections.forEach((section, sectionIndex) => {
      // Get section name (Cast, Crew, etc.)
      const titleWrapper = section.querySelector('.ipc-title__wrapper');
      if (!titleWrapper) {
        console.log(`[Extract] Section ${sectionIndex}: No title wrapper found, skipping`);
        return;
      }

      const titleText = titleWrapper.querySelector('.ipc-title__text');
      if (!titleText) {
        console.log(`[Extract] Section ${sectionIndex}: No title text found, skipping`);
        return;
      }

      const sectionName = titleText.textContent.trim();
      const sectionNameLower = sectionName.toLowerCase();

      console.log(`[Extract] Section ${sectionIndex}: "${sectionName}"`);

      // Check if this section is one we want to include
      // Only include: "Director(s)" (not "Second Unit Directors", "Assistant Directors", or "Art Directors")
      // "Cast", "Writer(s)", "Producer(s)"

      // First check exclusions
      const isExcludedSection =
        sectionNameLower.includes('assistant') ||
        sectionNameLower.includes('second unit') ||
        sectionNameLower.includes('art director');

      // Then check if allowed (using includes for flexibility with section titles like "Director (1)")
      const isAllowedSection =
        (sectionNameLower.includes('director') && !isExcludedSection) ||
        sectionNameLower.includes('cast') ||
        sectionNameLower.includes('writer') ||
        sectionNameLower.includes('producer') ||
        sectionNameLower.includes('creator');

      if (!isAllowedSection || isExcludedSection) {
        console.log(`[Extract] Section "${sectionName}" skipped: isAllowed=${isAllowedSection}, isExcluded=${isExcludedSection}`);
        return;
      }

      console.log(`[Extract] Processing section: "${sectionName}"`);

      // Extract list items from this section
      const listItems = section.querySelectorAll('li[data-testid="name-credits-list-item"]');
      console.log(`[Extract] Section "${sectionName}": Found ${listItems.length} list items`);

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

    console.log(`[Extract] Total items extracted: ${castData.length}`);

    // Log summary by role type
    const roleTypeCounts = {};
    castData.forEach(item => {
      roleTypeCounts[item.roleType] = (roleTypeCounts[item.roleType] || 0) + 1;
    });
    console.log('[Extract] Items by role type:', roleTypeCounts);

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

      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
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
   * Show a status notification for consolidated view operations
   */
  function showConsolidatedViewNotification(message, type = 'info', persist = false) {
    // Remove existing notification if any
    const existing = document.querySelector('.consolidated-view-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'consolidated-view-notification';

    const bgColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    const icon = type === 'error' ? '✗' : type === 'success' ? '✓' : '⏳';

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 14px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      max-width: 350px;
      word-break: break-word;
      animation: slideInRight 0.3s ease-out;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">${icon}</span>
        <span>${message}</span>
      </div>
      <div id="extraction-progress" style="font-size: 12px; opacity: 0.9; display: none;"></div>
    `;
    document.body.appendChild(notification);

    // Auto-remove success messages after 3 seconds (unless persist is true)
    if (type === 'success' && !persist) {
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    return notification;
  }

  /**
   * Update extraction progress in notification
   */
  function updateExtractionProgress(completedPages) {
    const progressDiv = document.getElementById('extraction-progress');
    if (progressDiv) {
      progressDiv.style.display = 'block';
      progressDiv.innerHTML = completedPages.map(page => `✓ ${page}`).join('<br>');
    }
  }

  /**
   * Open consolidated view with data from all pages
   */
  function openConsolidatedView(button) {
    try {
      // Disable button and show loading state
      if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        const originalText = button.textContent;
        button.textContent = '⏳ Loading...';

        // Re-enable button after timeout in case something goes wrong
        setTimeout(() => {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.textContent = originalText;
        }, 60000); // 60 second timeout (allows time for page loads, extraction, and tab closing)
      }

      // Show initial status message
      showConsolidatedViewNotification('Starting consolidated view extraction...', 'info');

      // Check if extension context is still valid
      if (!isExtensionContextValid()) {
        showConsolidatedViewNotification('❌ Extension context invalidated. Please reload the page and try again.', 'error');
        console.warn('Extension context invalid when trying to open consolidated view');
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.textContent = '🎬 Consolidated Overview';
        }
        return;
      }

      // Extract movie ID from current URL
      const pathMatch = window.location.pathname.match(/\/title\/(tt\d+)/);
      if (!pathMatch) {
        showConsolidatedViewNotification('❌ Could not extract movie ID from URL', 'error');
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.textContent = '🎬 Consolidated Overview';
        }
        return;
      }

      const movieId = pathMatch[1];
      console.log('Opening consolidated view for movie:', movieId);

      // Store movie ID and reset extraction flags
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // First, clear any existing data including single view temp data
        chrome.storage.local.remove([
          'customized-view-temp',
          'consolidatedViewData_fullcredits',
          'consolidatedViewData_companycredits',
          'consolidatedViewData_awards',
          'consolidatedViewData_releaseinfo',
          'consolidatedViewData_technical'
        ], () => {
          // Then set the movie ID and extraction flags
          chrome.storage.local.set({
            'consolidatedViewMovieId': movieId,
            'consolidatedViewExtractingFullcredits': false,
            'consolidatedViewExtractingCompanycredits': false,
            'consolidatedViewExtractingAwards': false,
            'consolidatedViewExtractingReleaseinfo': false,
            'consolidatedViewExtractingTechnical': false
          }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving movie ID:', chrome.runtime.lastError);
            showConsolidatedViewNotification('❌ Failed to save data. Please try again.', 'error');
            if (button) {
              button.disabled = false;
              button.style.opacity = '1';
              button.style.cursor = 'pointer';
              button.textContent = '🎬 Consolidated Overview';
            }
            return;
          }

          console.log('Starting sequential extraction...');
          showConsolidatedViewNotification('📂 Starting data extraction...', 'info', true);

          // Define extraction pages
          const extractionPages = [
            { url: `https://www.imdb.com/title/${movieId}/fullcredits?ref_=consolidatedView`, name: 'Cast & Crew', type: 'fullcredits' },
            { url: `https://www.imdb.com/title/${movieId}/companycredits?ref_=consolidatedView`, name: 'Production Companies', type: 'companycredits' },
            { url: `https://www.imdb.com/title/${movieId}/awards?ref_=consolidatedView`, name: 'Awards', type: 'awards' },
            { url: `https://www.imdb.com/title/${movieId}/releaseinfo?ref_=consolidatedView`, name: 'Release Info', type: 'releaseinfo' },
            { url: `https://www.imdb.com/title/${movieId}/technical?ref_=consolidatedView`, name: 'Technical', type: 'technical' }
          ];

          let currentPageIndex = 0;
          const completedPages = [];

          /**
           * Process one extraction page at a time
           */
          const processNextPage = () => {
            if (currentPageIndex >= extractionPages.length) {
              // All pages processed, open consolidated view
              console.log('All extraction pages processed, opening consolidated view');
              showConsolidatedViewNotification('🔄 Compiling consolidated view...', 'info', true);

              setTimeout(async () => {
                try {
                  // Check settings to see if we should auto-open
                  const settings = await window.SettingsUtils.loadSettings();
                  const autoOpen = settings.autoOpenConsolidatedView !== false; // Default to true

                  if (autoOpen) {
                    const extensionUrl = chrome.runtime.getURL('consolidated-view-page.html');
                    window.open(extensionUrl, '_blank');
                    console.log('Opened consolidated view page');
                    showConsolidatedViewNotification('✓ Consolidated view opened successfully!', 'success');
                  } else {
                    console.log('Auto-open consolidated view is disabled in settings');
                    showConsolidatedViewNotification('✓ Data extraction complete! Open consolidated view from title page.', 'success');
                  }

                  // Reset button state
                  if (button) {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                    button.textContent = '🎬 Consolidated Overview';
                  }
                } catch (urlError) {
                  console.error('Error opening consolidated view:', urlError);
                  showConsolidatedViewNotification('❌ Failed to open consolidated view. Please try again.', 'error');
                  if (button) {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                    button.textContent = '🎬 Consolidated Overview';
                  }
                }
              }, 500);
              return;
            }

            const page = extractionPages[currentPageIndex];
            console.log(`Opening extraction page ${currentPageIndex + 1}/${extractionPages.length}: ${page.name}`);
            showConsolidatedViewNotification(`📂 Extracting ${page.name}... (${currentPageIndex + 1}/${extractionPages.length})`, 'info', true);

            // Open the page in a new tab via background script
            chrome.runtime.sendMessage({ type: 'createTab', url: page.url, active: false }, (response) => {
              if (!response || !response.success) {
                console.error(`Error opening ${page.name} tab:`, response?.error);
                currentPageIndex++;
                processNextPage();
                return;
              }

              const tabId = response.tabId;
              console.log(`Opened ${page.name} tab (ID: ${tabId})`);

              // Wait for extraction to complete by monitoring storage
              let checkCount = 0;
              const maxChecks = 60; // 30 seconds max (500ms * 60)

              const checkInterval = setInterval(() => {
                checkCount++;

                chrome.storage.local.get([`consolidatedViewData_${page.type}`], (result) => {
                  // Check if data exists (even if empty array) - this indicates extraction completed
                  const hasData = result[`consolidatedViewData_${page.type}`] !== undefined &&
                                 Array.isArray(result[`consolidatedViewData_${page.type}`]);

                  if (hasData) {
                    // Data extracted successfully
                    clearInterval(checkInterval);
                    completedPages.push(page.name);
                    console.log(`✓ ${page.name} extraction complete`);

                    // Show progress
                    const progressMsg = `📂 Extracting ${page.name}... ✓ (${currentPageIndex + 1}/${extractionPages.length})`;
                    showConsolidatedViewNotification(progressMsg, 'info', true);
                    updateExtractionProgress(completedPages);

                    // Wait a bit for tab to close itself, then move to next page
                    setTimeout(() => {
                      currentPageIndex++;
                      processNextPage();
                    }, 800);
                  } else if (checkCount >= maxChecks) {
                    // Timeout - move to next page anyway
                    clearInterval(checkInterval);
                    console.warn(`Timeout waiting for ${page.name} extraction`);
                    showConsolidatedViewNotification(`⚠️ ${page.name} timed out, skipping...`, 'info', true);

                    setTimeout(() => {
                      currentPageIndex++;
                      processNextPage();
                    }, 500);
                  }
                });
              }, 500);
            });
          };

          // Start processing the first page
          processNextPage();
          });
        });
      } else {
        console.error('Chrome storage API not available');
        showConsolidatedViewNotification('❌ Chrome storage API not available. Please reload the extension.', 'error');
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.textContent = '🎬 Consolidated Overview';
        }
      }
    } catch (error) {
      console.error('Error opening consolidated view:', error);
      showConsolidatedViewNotification('❌ Failed to open consolidated view: ' + error.message, 'error');
      if (button) {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.textContent = '🎬 Consolidated Overview';
      }
    }
  }

  /**
   * Create a button to open the customized view in a new tab
   */
  async function createOpenViewButton() {
    const isFullCredits = isIMDbFullCreditsPage();
    const isCompanyCredits = isIMDbCompanyCreditsPage();
    const isAwards = isIMDbAwardsPage();
    const isReleaseInfo = isIMDbReleaseInfoPage();
    const isTechnical = isIMDbTechnicalPage();

    if (!isFullCredits && !isCompanyCredits && !isAwards && !isReleaseInfo && !isTechnical) return;

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

    // Extract data based on page type
    let viewData, title, buttonText;
    if (isFullCredits) {
      viewData = extractCastData();
      title = '📋 Cast & Crew Overview';
      buttonText = '📋 View Cast & Crew in New Tab';
    } else if (isCompanyCredits) {
      viewData = extractCompanyData();
      title = '📋 Production Companies';
      buttonText = '📋 View Production Companies in New Tab';
    } else if (isAwards) {
      viewData = await extractAwardsData();
      title = '🏆 Awards Overview';
      buttonText = '🏆 View Awards in New Tab';
    } else if (isReleaseInfo) {
      viewData = await extractReleaseData();
      title = '📅 Release Dates';
      buttonText = '📅 View Release Dates in New Tab';
    } else if (isTechnical) {
      viewData = extractTechnicalData();
      title = '⚙️ Technical Specifications';
      buttonText = '⚙️ View Technical Specs in New Tab';
    }

    if (viewData.length === 0) {
      console.log('No data found for customized view');
      return;
    }

    console.log(`Found ${viewData.length} items for ${title}`);

    // Determine columns based on page type
    let columns = settings.columns;
    if (isAwards) {
      columns = ['name', 'role', 'award', 'year'];
    } else if (isReleaseInfo) {
      columns = ['name', 'role', 'award'];
    } else if (isTechnical) {
      columns = ['name', 'role'];
    }

    // Create a temporary view instance just to use the openInNewTab method
    const view = new CustomizedView({
      containerId: 'imdb-customized-view-temp',
      data: viewData,
      title: title,
      columns: columns,
      pagePath: window.location.pathname
    });

    // Load and apply saved preferences
    const savedPrefs = await view.loadPreferences();
    view.applyPreferences(savedPrefs);

    // Create button
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.id = 'open-customized-view-btn';
    if (isAwards) {
      button.title = 'Open the awards overview in a new tab';
    } else if (isCompanyCredits) {
      button.title = 'Open the production companies overview in a new tab';
    } else if (isReleaseInfo) {
      button.title = 'Open the release dates overview in a new tab';
    } else if (isTechnical) {
      button.title = 'Open the technical specifications in a new tab';
    } else {
      button.title = 'Open the cast and crew overview in a new tab';
    }

    button.addEventListener('click', async () => {
      // Check settings to see if we should open in new tab
      const autoOpen = settings.autoOpenIndividualView !== false; // Default to true
      if (autoOpen) {
        view.openInNewTab();
      } else {
        // If not auto-opening, just show a message
        alert('Individual view opening in new tab is disabled in settings. Enable it in the extension settings.');
      }
    });

    // Create consolidated overview button (check settings first)
    const showConsolidatedBtn = settings.showConsolidatedViewBtn !== false; // Default to true
    if (!showConsolidatedBtn) {
      // Don't create the consolidated button if setting is disabled
      container.appendChild(button);
      targetElement.insertAdjacentElement('afterend', container);
      return;
    }

    const consolidatedButton = document.createElement('button');
    consolidatedButton.textContent = '🎬 Consolidated Overview';
    consolidatedButton.id = 'open-consolidated-view-btn';
    consolidatedButton.title = 'Open consolidated overview from all pages in a new tab';
    consolidatedButton.style.cssText = `
      padding: 10px 16px !important;
      background: #8b5cf6 !important;
      border: none !important;
      border-radius: 6px !important;
      color: white !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      margin: 0 !important;
      margin-left: 10px !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif !important;
      display: inline-block !important;
      text-decoration: none !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      line-height: 1.5 !important;
    `;

    consolidatedButton.addEventListener('mouseenter', () => {
      consolidatedButton.style.background = '#7c3aed !important';
      consolidatedButton.style.transform = 'translateY(-2px) !important';
      consolidatedButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2) !important';
    });

    consolidatedButton.addEventListener('mouseleave', () => {
      consolidatedButton.style.background = '#8b5cf6 !important';
      consolidatedButton.style.transform = 'translateY(0) !important';
      consolidatedButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15) !important';
    });

    consolidatedButton.addEventListener('click', () => {
      openConsolidatedView(consolidatedButton);
    });

    // Find the page title and position button next to it
    let inserted = false;

    // Try to find h1 title
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

      // Add buttons to wrapper
      wrapper.appendChild(button);
      wrapper.appendChild(consolidatedButton);
      console.log('Open view button created successfully next to h1 title');
      inserted = true;
    }

    // Fallback 1: Try to find and use the page header
    if (!inserted) {
      const pageHeader = document.querySelector('.sc-ab2f0a4f-4') || document.querySelector('[class*="title"]');
      if (pageHeader) {
        pageHeader.appendChild(button);
        console.log('Open view button created in page header');
        inserted = true;
      }
    }

    // Fallback 2: insert at top of main content if no title found
    if (!inserted) {
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainContent) {
        mainContent.insertBefore(button, mainContent.firstChild);
        console.log('Open view button created at top of content');
        inserted = true;
      }
    }

    // Fallback 3: Just append to body if nothing else works
    if (!inserted) {
      document.body.insertBefore(button, document.body.firstChild);
      console.log('Open view button created at top of body');
    }
  }

  /**
   * Initialize on page load
   */
  if (isIMDbFullCreditsPage() || isIMDbCompanyCreditsPage() || isIMDbAwardsPage() || isIMDbReleaseInfoPage() || isIMDbTechnicalPage()) {
    // Function to try initializing the view button
    const tryInitialize = async () => {
      // Check if this is a consolidated view extraction request
      const isConsolidatedViewRequest = window.location.search.includes('consolidatedView');

      // Wait a bit for DOM to settle (extraction pages should close quickly)
      await new Promise(resolve => setTimeout(resolve, 800));

      // If this is a consolidated view request, extract and store data, then close tab
      if (isConsolidatedViewRequest) {
        console.log('Consolidated view extraction requested for:', window.location.pathname);

        let extractedData = null;
        let pageType = '';

        if (isIMDbFullCreditsPage()) {
          extractedData = extractCastData();
          pageType = 'fullcredits';
        } else if (isIMDbCompanyCreditsPage()) {
          extractedData = extractCompanyData();
          pageType = 'companycredits';
        } else if (isIMDbAwardsPage()) {
          extractedData = await extractAwardsData();
          pageType = 'awards';
        } else if (isIMDbReleaseInfoPage()) {
          extractedData = await extractReleaseData();
          pageType = 'releaseinfo';
        } else if (isIMDbTechnicalPage()) {
          extractedData = extractTechnicalData();
          pageType = 'technical';
        }

        if (extractedData) {
          storeConsolidatedData(pageType, extractedData);
          console.log(`Extracted and stored ${pageType} data (${extractedData.length} items)`);
        } else {
          // Store empty array if no data found
          storeConsolidatedData(pageType, []);
          console.log(`No data found for ${pageType}, stored empty array`);
        }

        // Request background script to close this tab
        setTimeout(() => {
          try {
            chrome.runtime.sendMessage(
              { type: 'closeConsolidatedViewTab', pageType: pageType },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.warn('Could not close tab via background script, trying window.close()');
                  window.close();
                }
              }
            );
          } catch (error) {
            console.warn('Error sending close message:', error);
            window.close();
          }
        }, 300);

        return;
      }

      // For awards pages, wait for awards data to load
      if (isIMDbAwardsPage()) {
        let retries = 0;
        while (retries < 5) {
          const awardItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list-summary-item');
          if (awardItems.length > 0) {
            console.log('Awards page: Found awards content, initializing button');
            await createOpenViewButton();
            return;
          }
          console.log(`Awards page: Waiting for awards content... (attempt ${retries + 1}/5)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
        console.warn('Awards page: Could not find awards content after retries');
        return;
      }

      // For other pages, just initialize directly
      await createOpenViewButton();
    };

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInitialize);
    } else {
      tryInitialize();
    }
  }

})();
