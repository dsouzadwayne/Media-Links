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

  /**
   * Sanitize HTML to prevent XSS attacks
   * Escapes special characters that could be used for script injection
   */
  function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
   * Check if we're on an IMDb title page (main page like /title/tt0234000/)
   */
  function isIMDbTitlePage() {
    return window.location.hostname === 'www.imdb.com' &&
           /\/title\/tt\d+\/?$/.test(window.location.pathname);
  }

  /**
   * Check if we're on an IMDb technical specs page
   */
  function isIMDbTechnicalPage() {
    return window.location.hostname === 'www.imdb.com' &&
           window.location.pathname.includes('/technical');
  }

  /**
   * Normalize role text by removing "the" prefix and "(as ...)" suffix and location info
   */
  function normalizeRole(roleText) {
    let normalized = roleText.toLowerCase().trim();
    // Remove "the " prefix if present
    if (normalized.startsWith('the ')) {
      normalized = normalized.substring(4);
    }
    // Remove "(as ...)" suffix if present
    normalized = normalized.replace(/\s*\(as\s+[^)]*\)\s*/g, '').trim();
    // Remove location information (e.g., ": New York", ": London", etc.)
    normalized = normalized.replace(/:\s+[A-Z][a-zA-Z\s]+$/i, '').trim();
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
      'female producer',
      'line producer'
    ];

    // Director roles to exclude
    const excludedDirectorRoles = [
      'director of photography',
      'casting director',
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

    // Exclude dialogue writers - check for dialogue as sole credit
    if (roleLower.includes('dialogue')) {
      // Exclude if dialogue is the only role or if writer + dialogue
      if (!hasMultipleRoles) {
        // Singular role - exclude if it's dialogue-related
        if (roleLower.includes('dialogue')) {
          return true;
        }
      } else {
        // Multiple roles - exclude if one of them is dialogue
        const roles = roleText.split('/').map(r => normalizeRole(r));
        const hasSoleDialogue = roles.some(role => role.includes('dialogue') && !role.includes('writer'));
        if (hasSoleDialogue || (roleLower.includes('writer') && roleLower.includes('dialogue'))) {
          return true;
        }
      }
    }

    // Exclude "story co-developed by" writer credits - only for singular roles
    if (!hasMultipleRoles && roleLower.includes('story') && roleLower.includes('co-developed')) {
      return true;
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

    if (roleLower.includes('screenplay')) {
      return 'Writers Screenplay';
    }

    if (roleLower.includes('writer') || roleLower.includes('written by')) {
      return 'Writers';
    }

    if (roleLower.includes('producer')) {
      // Filter out vfx line producer if it's the sole role
      if (roleLower.trim() === 'vfx line producer') {
        return null;
      }
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
    console.log('Awards extraction: Found', seeAllButtons.length, 'see-all buttons, auto-clicking to expand...');

    for (const btn of seeAllButtons) {
      btn.click();
      // Wait a bit for the section to expand
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait a bit more for all content to fully render
    await new Promise(resolve => setTimeout(resolve, 500));

    const awardsData = [];

    // Try primary selector
    let awardItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list-summary-item');

    // Fallback selectors
    if (awardItems.length === 0) {
      awardItems = document.querySelectorAll('[data-testid="list-item"]');
    }
    if (awardItems.length === 0) {
      awardItems = document.querySelectorAll('li.ipc-metadata-list-summary-item');
    }

    console.log('Awards extraction: Found', awardItems.length, 'award items on page');
    console.log('Awards page DOM analysis:', {
      'li elements': document.querySelectorAll('li').length,
      'list-item data-testids': document.querySelectorAll('[data-testid="list-item"]').length,
      'ipc-metadata elements': document.querySelectorAll('.ipc-metadata-list-summary-item').length,
      'body text length': document.body.innerText.length
    });

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
    console.log('Release extraction: Found', seeAllButtons.length, 'see-all/more buttons, auto-clicking to expand...');

    for (const btn of seeAllButtons) {
      btn.click();
      // Wait a bit for the section to expand
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait a bit more for all content to fully render
    await new Promise(resolve => setTimeout(resolve, 500));

    const releaseData = [];

    // Try primary selector
    let releaseItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list__item');

    // Fallback selectors
    if (releaseItems.length === 0) {
      releaseItems = document.querySelectorAll('[data-testid="list-item"]');
    }
    if (releaseItems.length === 0) {
      releaseItems = document.querySelectorAll('.ipc-metadata-list__item');
    }
    if (releaseItems.length === 0) {
      releaseItems = document.querySelectorAll('li[data-testid*="release"]');
    }

    console.log('Release extraction: Found', releaseItems.length, 'release items on page');
    console.log('Release page DOM analysis:', {
      'li elements': document.querySelectorAll('li').length,
      'list-item data-testids': document.querySelectorAll('[data-testid="list-item"]').length,
      'ipc-metadata-list items': document.querySelectorAll('.ipc-metadata-list__item').length,
      'release data-testids': document.querySelectorAll('[data-testid*="release"]').length,
      'table elements': document.querySelectorAll('table').length,
      'body text length': document.body.innerText.length
    });

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
   * Extract description/plot from the main title page
   */
  function extractTitlePageDescription() {
    let description = '';
    let title = '';

    // Try to get the title
    const titleElement = document.querySelector('h1[data-testid="hero__pageTitle"]') ||
                        document.querySelector('h1.sc-afe43def-0') ||
                        document.querySelector('h1');
    if (titleElement) {
      title = titleElement.textContent.trim();
    }

    // Try to get the description/plot - multiple selectors for different IMDb layouts
    const plotSelectors = [
      '[data-testid="plot"] .sc-cd293e3c-0',  // New IMDb layout
      '[data-testid="plot"] p',
      '.plot_summary_wrapper .summary_text',  // Old IMDb layout
      '[data-testid="storyline-plot-summary"]',
      '.GenresAndPlot__TextContainerBreakpointXS-cum89p-0 span',
      'span[data-testid="plot-xl"]',
      'span[data-testid="plot-l"]'
    ];

    for (const selector of plotSelectors) {
      const plotElement = document.querySelector(selector);
      if (plotElement) {
        description = plotElement.textContent.trim();
        if (description) {
          console.log('Found plot using selector:', selector);
          break;
        }
      }
    }

    // If still no description, try alternate method - look for paragraph in hero section
    if (!description) {
      const heroSection = document.querySelector('[data-testid="hero-subnav-bar"]');
      if (heroSection) {
        const nextSection = heroSection.nextElementSibling;
        if (nextSection) {
          const paragraphs = nextSection.querySelectorAll('p');
          for (const p of paragraphs) {
            const text = p.textContent.trim();
            if (text && text.length > 50) { // Assume description is substantial
              description = text;
              console.log('Found plot in hero section paragraph');
              break;
            }
          }
        }
      }
    }

    console.log('Title page extraction complete:', {
      title: title ? 'Found' : 'Not found',
      description: description ? `Found (${description.length} chars)` : 'Not found'
    });

    return {
      title: title || 'Unknown Title',
      description: description || ''
    };
  }

  /**
   * Wait for technical specs DOM elements to be available (enterprise networks may block resources)
   */
  async function waitForTechnicalDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    const requiredSelectors = [
      'li[data-testid="title-techspec_runtime"]',
      'li[data-testid="title-techspec_color"]'
    ];

    while (Date.now() - startTime < maxWaitTime) {
      // Check if at least one technical spec element exists
      const hasAnyElement = requiredSelectors.some(selector =>
        document.querySelector(selector) !== null
      );

      if (hasAnyElement) {
        console.log('Technical specs DOM elements found');
        return true;
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Technical specs DOM elements not found after ${elapsedSeconds}s (page may not have technical data)`);
    return false;
  }

  /**
   * Wait for title page DOM elements to be available (title and plot)
   */
  async function waitForTitleDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    const requiredSelectors = [
      'h1[data-testid="hero__pageTitle"]',
      'h1.sc-afe43def-0',
      'h1'
    ];

    const plotSelectors = [
      '[data-testid="plot"] .sc-cd293e3c-0',
      '[data-testid="plot"] p',
      'span[data-testid="plot-xl"]',
      'span[data-testid="plot-l"]',
      '[data-testid="storyline-plot-summary"]'
    ];

    while (Date.now() - startTime < maxWaitTime) {
      // Check if title element exists
      const hasTitle = requiredSelectors.some(selector =>
        document.querySelector(selector) !== null
      );

      // Check if plot element exists
      const hasPlot = plotSelectors.some(selector =>
        document.querySelector(selector) !== null
      );

      // We need at least the title; plot is optional
      if (hasTitle) {
        console.log('Title page DOM elements found');
        if (hasPlot) {
          console.log('Plot/description found');
        } else {
          console.log('Title found but plot not available (may not have description)');
        }
        return true;
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Title page DOM elements not found after ${elapsedSeconds}s (page may not have loaded)`);
    return false;
  }

  /**
   * Wait for cast/crew DOM elements to load (fullcredits page)
   */
  async function waitForCastDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      const castItems = document.querySelectorAll('li[data-testid="name-credits-list-item"]');
      if (castItems.length > 0) {
        console.log('Cast/crew DOM elements found');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Cast/crew DOM elements not found after ${elapsedSeconds}s (page may not have cast data)`);
    return false;
  }

  /**
   * Wait for company credits DOM elements to load (companycredits page)
   */
  async function waitForCompanyDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      const sections = document.querySelectorAll('section.ipc-page-section');
      if (sections.length > 0) {
        console.log('Company credits DOM elements found');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Company credits DOM elements not found after ${elapsedSeconds}s (page may not have company data)`);
    return false;
  }

  /**
   * Wait for awards DOM elements to load (awards page)
   */
  async function waitForAwardsDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      // Try multiple selectors for awards
      let awardItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list-summary-item');

      // Fallback: try broader selector
      if (awardItems.length === 0) {
        awardItems = document.querySelectorAll('[data-testid="list-item"]');
      }

      // Another fallback: look for any list items
      if (awardItems.length === 0) {
        awardItems = document.querySelectorAll('li.ipc-metadata-list-summary-item');
      }

      if (awardItems.length > 0) {
        console.log(`Awards DOM elements found (${awardItems.length} items)`);
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Awards DOM elements not found after ${elapsedSeconds}s (page may not have awards data)`);
    return false;
  }

  /**
   * Wait for release info DOM elements to load (releaseinfo page)
   */
  async function waitForReleaseDOM(maxWaitTime = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
      // Try multiple selectors for release info
      let releaseTable = document.querySelector('table[data-testid="releaseinfo-table"]');
      let releaseItems = document.querySelectorAll('.ipc-table__row');

      // Fallback: look for any table
      if (!releaseTable && releaseItems.length === 0) {
        releaseTable = document.querySelector('table');
        releaseItems = document.querySelectorAll('tr[data-testid]');
      }

      // Another fallback: look for release date containers
      if (!releaseTable && releaseItems.length === 0) {
        releaseItems = document.querySelectorAll('[data-testid*="release"]');
      }

      if (releaseTable || releaseItems.length > 0) {
        console.log(`Release info DOM elements found (${releaseItems.length} rows)`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Release info DOM elements not found after ${elapsedSeconds}s (page may not have release data)`);
    return false;
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
    // Check if extension context is still valid before making API call
    if (!isExtensionContextValid()) {
      console.log('Extension context invalidated, cannot store consolidated data');
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `consolidatedViewData_${pageType}`;
      chrome.storage.local.set({ [storageKey]: data }, () => {
        // Check context again in the callback
        if (!isExtensionContextValid()) {
          console.log('Extension context invalidated in callback');
          return;
        }

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
        sectionNameLower.includes('art director') ||
        sectionNameLower.includes('casting director');

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
        // Check if extension context is still valid before making API call
        if (!isExtensionContextValid()) {
          console.log('Extension context invalidated, using default settings');
          resolve({
            showBtn: true,
            columns: ['name', 'role', 'roleType'],
            showConsolidatedViewBtn: true,
            autoOpenConsolidatedView: true
          });
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['showCustomizedViewBtn', 'defaultViewColumns', 'showConsolidatedViewBtn', 'autoOpenConsolidatedView'], (result) => {
            // Check context again in the callback in case it was invalidated during the async operation
            if (!isExtensionContextValid()) {
              console.log('Extension context invalidated in callback, using default settings');
              resolve({
                showBtn: true,
                columns: ['name', 'role', 'roleType'],
                showConsolidatedViewBtn: true,
                autoOpenConsolidatedView: true
              });
              return;
            }

            if (chrome.runtime.lastError) {
              console.warn('Error loading customized view settings:', chrome.runtime.lastError);
              resolve({
                showBtn: true,
                columns: ['name', 'role', 'roleType'],
                showConsolidatedViewBtn: true,
                autoOpenConsolidatedView: true
              });
            } else {
              resolve({
                showBtn: result.showCustomizedViewBtn !== false,
                columns: result.defaultViewColumns || ['name', 'role', 'roleType'],
                showConsolidatedViewBtn: result.showConsolidatedViewBtn !== false,
                autoOpenConsolidatedView: result.autoOpenConsolidatedView !== false
              });
            }
          });
        } else {
          resolve({
            showBtn: true,
            columns: ['name', 'role', 'roleType'],
            showConsolidatedViewBtn: true,
            autoOpenConsolidatedView: true
          });
        }
      } catch (error) {
        console.warn('Error loading customized view settings:', error);
        resolve({
          showBtn: true,
          columns: ['name', 'role', 'roleType'],
          showConsolidatedViewBtn: true,
          autoOpenConsolidatedView: true
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

    // Build notification content safely using DOM methods
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '16px';

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    contentDiv.appendChild(iconSpan);
    contentDiv.appendChild(messageSpan);

    const progressDiv = document.createElement('div');
    progressDiv.id = 'extraction-progress';
    progressDiv.style.cssText = 'font-size: 12px; opacity: 0.9; display: none;';

    notification.appendChild(contentDiv);
    notification.appendChild(progressDiv);
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
      // Clear existing content
      progressDiv.textContent = '';
      // Add each page as a text node with line breaks
      completedPages.forEach((page, index) => {
        if (index > 0) {
          progressDiv.appendChild(document.createElement('br'));
        }
        const pageText = document.createTextNode(`✓ ${page}`);
        progressDiv.appendChild(pageText);
      });
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

      // Get current tab ID to return focus later
      if (!isExtensionContextValid()) {
        showConsolidatedViewNotification('❌ Extension context invalidated. Please reload the page and try again.', 'error');
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          button.textContent = '🎬 Consolidated Overview';
        }
        return;
      }

      chrome.runtime.sendMessage({ type: 'getCurrentTabId' }, (response) => {
        if (!isExtensionContextValid()) {
          showConsolidatedViewNotification('❌ Extension context invalidated. Please reload the page and try again.', 'error');
          if (button) {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.textContent = '🎬 Consolidated Overview';
          }
          return;
        }

        const originalTabId = response && response.tabId ? response.tabId : null;
        if (originalTabId) {
          console.log('Current tab ID:', originalTabId);
        } else {
          console.warn('Could not get current tab ID');
        }

        // Store movie ID and reset extraction flags
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // First, clear any existing data including single view temp data
        chrome.storage.local.remove([
          'customized-view-temp',
          'consolidatedViewData_title',
          'consolidatedViewData_fullcredits',
          'consolidatedViewData_companycredits',
          'consolidatedViewData_awards',
          'consolidatedViewData_releaseinfo',
          'consolidatedViewData_technical'
        ], () => {
          // Then set the movie ID and extraction flags
          chrome.storage.local.set({
            'consolidatedViewMovieId': movieId,
            'consolidatedViewExtractingTitle': false,
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

          console.log('Opening tabs for consolidated view extraction...');
          showConsolidatedViewNotification('📂 Opening tabs for extraction...', 'info', true);

          // Define extraction pages (without ?ref_=consolidatedView to prevent auto-extraction)
          const extractionPages = [
            { url: `https://www.imdb.com/title/${movieId}/`, name: 'Title & Description', type: 'title' },
            { url: `https://www.imdb.com/title/${movieId}/fullcredits`, name: 'Cast & Crew', type: 'fullcredits' },
            { url: `https://www.imdb.com/title/${movieId}/companycredits`, name: 'Production Companies', type: 'companycredits' },
            { url: `https://www.imdb.com/title/${movieId}/awards`, name: 'Awards', type: 'awards' },
            { url: `https://www.imdb.com/title/${movieId}/releaseinfo`, name: 'Release Info', type: 'releaseinfo' },
            { url: `https://www.imdb.com/title/${movieId}/technical`, name: 'Technical', type: 'technical' }
          ];

          const openedTabIds = [];
          let tabsOpenedCount = 0;

          /**
           * Open all extraction tabs
           */
          const openAllTabs = () => {
            extractionPages.forEach((page, index) => {
              setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'createTab', url: page.url, active: true }, (response) => {
                  if (response && response.success) {
                    const tabId = response.tabId;
                    openedTabIds.push({ tabId, page });
                    tabsOpenedCount++;
                    console.log(`Opened ${page.name} tab (ID: ${tabId}) - URL: ${page.url}`);
                    console.log(`Tracked tabs so far:`, openedTabIds.map(t => `${t.page.type}(${t.tabId})`).join(', '));

                    if (tabsOpenedCount === extractionPages.length) {
                      // All tabs opened, refocus the original tab
                      if (originalTabId) {
                        chrome.runtime.sendMessage({
                          type: 'focusTab',
                          tabId: originalTabId
                        }, (response) => {
                          if (response && response.success) {
                            console.log('Refocused original tab:', originalTabId);
                          }
                        });
                      }
                      // Show tab selector modal after refocusing
                      setTimeout(() => showTabSelectorModal(), 1000);
                    }
                  }
                });
              }, index * 300); // Stagger tab opening by 300ms each
            });
          };

          /**
           * Show modal with tab selector
           */
          const showTabSelectorModal = () => {
            console.log('Showing tab selector modal');
            showConsolidatedViewNotification('✓ All tabs opened! Select which ones to extract...', 'success', true);

            // Create modal overlay
            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'consolidated-tab-selector-overlay';
            modalOverlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 10002;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            `;

            // Create modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
              background: white;
              border-radius: 10px;
              padding: 30px;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
              max-height: 80vh;
              overflow-y: auto;
            `;

            // Create modal content using DOM methods to avoid XSS
            const modalTitle = document.createElement('h2');
            modalTitle.textContent = '🎬 Consolidated Overview';
            modalTitle.style.cssText = 'margin-top: 0; margin-bottom: 20px; color: #111;';

            const modalDesc = document.createElement('p');
            modalDesc.textContent = 'Select pages to extract data from:';
            modalDesc.style.cssText = 'color: #666; margin-bottom: 20px;';

            const tabCheckboxesDiv = document.createElement('div');
            tabCheckboxesDiv.id = 'tab-checkboxes';
            tabCheckboxesDiv.style.cssText = 'margin-bottom: 25px; display: flex; flex-direction: column; gap: 10px;';

            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.cssText = 'display: flex; gap: 12px; margin-top: 25px;';

            const extractBtn = document.createElement('button');
            extractBtn.id = 'extract-btn';
            extractBtn.textContent = 'Extract Data';
            extractBtn.style.cssText = 'flex: 1; padding: 12px; background: #8b5cf6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
            extractBtn.addEventListener('mouseover', () => extractBtn.style.background = '#7c3aed');
            extractBtn.addEventListener('mouseout', () => extractBtn.style.background = '#8b5cf6');

            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancel-btn';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = 'flex: 1; padding: 12px; background: #e5e7eb; color: #333; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
            cancelBtn.addEventListener('mouseover', () => cancelBtn.style.background = '#d1d5db');
            cancelBtn.addEventListener('mouseout', () => cancelBtn.style.background = '#e5e7eb');

            buttonsDiv.appendChild(extractBtn);
            buttonsDiv.appendChild(cancelBtn);

            modal.appendChild(modalTitle);
            modal.appendChild(modalDesc);
            modal.appendChild(tabCheckboxesDiv);
            modal.appendChild(buttonsDiv);

            modalOverlay.appendChild(modal);
            document.body.appendChild(modalOverlay);

            // Add checkboxes dynamically after modal is in DOM
            const tabCheckboxesDiv = document.getElementById('tab-checkboxes');
            extractionPages.forEach((page, idx) => {
              const label = document.createElement('label');
              label.style.cssText = 'display: flex; align-items: center; cursor: pointer; padding: 10px; border-radius: 6px; transition: background 0.2s;';

              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.id = `select-${idx}`;
              checkbox.className = 'page-selector-checkbox';
              checkbox.dataset.type = page.type;
              checkbox.checked = true;
              checkbox.style.cssText = 'margin-right: 12px; width: 18px; height: 18px; cursor: pointer;';

              const span = document.createElement('span');
              span.textContent = page.name;
              span.style.cssText = 'color: #333; font-weight: 500;';

              label.appendChild(checkbox);
              label.appendChild(span);

              label.addEventListener('mouseover', () => {
                label.style.background = '#f0f0f0';
              });
              label.addEventListener('mouseout', () => {
                label.style.background = 'transparent';
              });

              tabCheckboxesDiv.appendChild(label);
            });

            console.log('Tab selector modal created with', extractionPages.length, 'pages');

            // Handle extract button click
            document.getElementById('extract-btn').addEventListener('click', () => {
              const selectedCheckboxes = document.querySelectorAll('.page-selector-checkbox:checked');
              const selectedPages = Array.from(selectedCheckboxes).map(cb => cb.dataset.type);

              console.log('Selected pages for extraction:', selectedPages);

              // Update modal to show extraction progress
              const tabCheckboxesDiv = document.getElementById('tab-checkboxes');
              const buttonsDiv = modal.querySelector('div:last-of-type');

              // Hide checkboxes and buttons
              tabCheckboxesDiv.style.display = 'none';
              buttonsDiv.style.display = 'none';

              // Add progress container with much more prominent styling
              const progressDiv = document.createElement('div');
              progressDiv.id = 'extraction-progress-container';
              progressDiv.style.cssText = `
                margin: 20px 0;
                padding: 20px;
                background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
                border-radius: 8px;
                border-left: 4px solid #8b5cf6;
                min-height: 200px;
                display: flex;
                flex-direction: column;
              `;

              const progressTitle = document.createElement('p');
              progressTitle.style.cssText = `
                margin: 0 0 15px 0;
                color: #111;
                font-weight: 700;
                font-size: 16px;
              `;
              // Use textContent and span to avoid XSS
              progressTitle.textContent = '📂 ';
              const extractingSpan = document.createElement('span');
              extractingSpan.textContent = 'Extracting data...';
              extractingSpan.style.color = '#8b5cf6';
              progressTitle.appendChild(extractingSpan);

              const progressList = document.createElement('div');
              progressList.id = 'extraction-progress-list';
              progressList.style.cssText = `
                font-size: 14px;
                color: #333;
                line-height: 1.8;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', monospace;
                flex-grow: 1;
              `;

              progressDiv.appendChild(progressTitle);
              progressDiv.appendChild(progressList);

              // Insert at the top of modal content, right after the heading
              const heading = modal.querySelector('h2');
              heading.parentNode.insertBefore(progressDiv, heading.nextSibling);

              // Start extraction (modal stays visible during extraction)
              extractFromSelectedPages(selectedPages, () => {
                // This callback runs after extraction completes
                // Remove modal after extraction is done
                setTimeout(() => {
                  modalOverlay.remove();
                }, 1000);
              });
            });

            // Handle cancel button click
            document.getElementById('cancel-btn').addEventListener('click', () => {
              console.log('User cancelled consolidated overview extraction');
              modalOverlay.remove();

              // Close all opened tabs
              openedTabIds.forEach(({ tabId }) => {
                chrome.runtime.sendMessage({ type: 'closeTab', tabId });
              });

              // Reset button
              if (button) {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
                button.textContent = '🎬 Consolidated Overview';
              }

              showConsolidatedViewNotification('Cancelled consolidated overview extraction', 'success');
            });
          };

          /**
           * Extract from selected pages by injecting extraction scripts into their tabs
           */
          const extractFromSelectedPages = async (selectedPageTypes, onComplete) => {
            console.log('Starting extraction from selected pages...');
            // Don't show separate notifications - everything is shown in the modal
            // showConsolidatedViewNotification('📂 Extracting data from tabs...', 'info', true);

            let completedCount = 0;
            const completedPages = [];

            // For each selected page type, wait for extraction to complete
            for (const pageType of selectedPageTypes) {
              const page = extractionPages.find(p => p.type === pageType);
              if (!page) continue;

              console.log(`Waiting for ${page.name} extraction...`);

              // Show waiting status in modal progress
              const progressList = document.getElementById('extraction-progress-list');
              if (progressList) {
                const waitingLine = document.createElement('div');
                waitingLine.id = `waiting-${pageType}`;
                waitingLine.style.cssText = 'color: #f59e0b; margin: 5px 0; font-weight: 500;';
                waitingLine.textContent = `⏳ ${page.name}...`;
                progressList.appendChild(waitingLine);
              }

              // No notification - shown in modal instead

              // Inject extraction message into the matching tab via background script
              // This ensures we only extract from the tabs we opened, not other IMDb pages
              const tabData = openedTabIds.find(t => t.page.type === pageType);
              if (tabData) {
                console.log(`Sending extraction message to tab ${tabData.tabId} for ${pageType}`);
                chrome.runtime.sendMessage({
                  type: 'sendExtractionMessage',
                  targetTabId: tabData.tabId,
                  extractionMessage: {
                    type: 'performConsolidatedExtraction',
                    pageType: pageType
                  }
                }).catch((error) => {
                  console.warn(`Could not send extraction message to tab ${tabData.tabId}:`, error);
                });
              } else {
                console.warn(`No tab found for page type: ${pageType}`);
              }

              // Wait for data to be stored by monitoring storage
              let checkCount = 0;
              const maxChecks = 240; // 120 seconds max (500ms * 240)

              await new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                  checkCount++;

                  try {
                    chrome.storage.local.get([`consolidatedViewData_${pageType}`], (result) => {
                      // Check for chrome.runtime.lastError
                      if (chrome.runtime.lastError) {
                        console.error(`Storage error for ${page.name}:`, chrome.runtime.lastError);
                        clearInterval(checkInterval);
                        resolve();
                        return;
                      }

                      const hasData = result[`consolidatedViewData_${pageType}`] !== undefined &&
                                     Array.isArray(result[`consolidatedViewData_${pageType}`]);

                      if (hasData) {
                        clearInterval(checkInterval);
                        completedCount++;
                        completedPages.push(page.name);
                        console.log(`✓ ${page.name} extraction complete`);

                        // Update modal progress - remove waiting indicator and add completed
                        const progressList = document.getElementById('extraction-progress-list');
                        if (progressList) {
                          const waitingIndicator = document.getElementById(`waiting-${pageType}`);
                          if (waitingIndicator) {
                            waitingIndicator.remove();
                          }

                          const progressLine = document.createElement('div');
                          progressLine.style.cssText = 'color: #10b981; margin: 5px 0;';
                          progressLine.textContent = `✓ ${page.name} (${completedCount}/${selectedPageTypes.length})`;
                          progressList.appendChild(progressLine);
                        }

                        // Notification shown in modal, not separately
                        // showConsolidatedViewNotification(`✓ ${page.name} extracted (${completedCount}/${selectedPageTypes.length})`, 'success', true);
                        updateExtractionProgress(completedPages);
                        resolve();
                      } else if (checkCount >= maxChecks) {
                        clearInterval(checkInterval);
                        console.warn(`Timeout waiting for ${page.name} extraction`);
                        // Timeout message shown in modal, not separately
                        resolve();
                      }
                    });
                  } catch (error) {
                    console.error(`Exception during storage polling for ${page.name}:`, error);
                    clearInterval(checkInterval);
                    resolve();
                  }
                }, 500);
              });
            }

            // All pages processed, close tabs and open consolidated view
            console.log('All extractions complete, closing tabs...');

            // Update modal progress - show completion
            const finalProgressList = document.getElementById('extraction-progress-list');
            if (finalProgressList) {
              const completionLine = document.createElement('div');
              completionLine.style.cssText = 'color: #10b981; margin-top: 10px; font-weight: 600; padding-top: 10px; border-top: 1px solid #d1d5db;';
              completionLine.textContent = '✅ Extraction complete! Closing tabs...';
              finalProgressList.appendChild(completionLine);
            }

            // Call the completion callback (closes modal)
            if (onComplete) {
              onComplete();
            }

            // Close all opened tabs
            openedTabIds.forEach(({ tabId }) => {
              setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'closeTab', tabId }).catch(() => {
                  console.warn(`Could not close tab ${tabId}`);
                });
              }, 300);
            });

            // Shown in modal, not separately

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
                  showConsolidatedViewNotification('✓ Data extraction complete! Check the consolidated view on the title page.', 'success');
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
            }, 1000);
          };

          // Start by opening all tabs
          openAllTabs();
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
      }); // Close chrome.runtime.sendMessage callback
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
    const isTitle = isIMDbTitlePage();

    if (!isFullCredits && !isCompanyCredits && !isAwards && !isReleaseInfo && !isTechnical && !isTitle) return;

    // Load customized view settings
    const settings = await loadCustomizedViewSettings();

    // Check if the button should be shown (skip for title page since it only shows consolidated button)
    if (!isTitle && !settings.showBtn) {
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

    if (isTitle) {
      // On title page, skip individual view button and only show consolidated overview
      viewData = null;
    } else if (isFullCredits) {
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

    if (!isTitle && viewData && viewData.length === 0) {
      console.log('No data found for customized view');
      return;
    }

    if (!isTitle) {
      console.log(`Found ${viewData.length} items for ${title}`);
    }

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
    let view = null;
    if (!isTitle) {
      view = new CustomizedView({
        containerId: 'imdb-customized-view-temp',
        data: viewData,
        title: title,
        columns: columns,
        pagePath: window.location.pathname
      });

      // Load and apply saved preferences
      const savedPrefs = await view.loadPreferences();
      view.applyPreferences(savedPrefs);
    }

    // Create button (skip for title page)
    let button = null;
    if (!isTitle) {
      button = document.createElement('button');
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
    }

    // Create consolidated overview button (check settings first)
    const showConsolidatedBtn = settings.showConsolidatedViewBtn !== false; // Default to true
    if (!showConsolidatedBtn && !isTitle) {
      // Don't create the consolidated button if setting is disabled (and not on title page)
      if (button) {
        container.appendChild(button);
        targetElement.insertAdjacentElement('afterend', container);
      }
      return;
    }

    // On title page without consolidated button setting, just return
    if (!showConsolidatedBtn && isTitle) {
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
      if (button) {
        wrapper.appendChild(button);
      }
      wrapper.appendChild(consolidatedButton);
      console.log('Consolidated overview button created successfully next to h1 title');
      inserted = true;
    }

    // Fallback 1: Try to find and use the page header
    if (!inserted) {
      const pageHeader = document.querySelector('.sc-ab2f0a4f-4') || document.querySelector('[class*="title"]');
      if (pageHeader) {
        if (button) {
          pageHeader.appendChild(button);
        }
        pageHeader.appendChild(consolidatedButton);
        console.log('Consolidated overview button created in page header');
        inserted = true;
      }
    }

    // Fallback 2: insert at top of main content if no title found
    if (!inserted) {
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainContent) {
        if (button) {
          mainContent.insertBefore(button, mainContent.firstChild);
        }
        mainContent.insertBefore(consolidatedButton, mainContent.firstChild);
        console.log('Consolidated overview button created at top of content');
        inserted = true;
      }
    }

    // Fallback 3: Just append to body if nothing else works
    if (!inserted) {
      if (button) {
        document.body.insertBefore(button, document.body.firstChild);
      }
      document.body.insertBefore(consolidatedButton, document.body.firstChild);
      console.log('Consolidated overview button created at top of body');
    }
  }

  /**
   * Initialize on page load
   */
  if (isIMDbFullCreditsPage() || isIMDbCompanyCreditsPage() || isIMDbAwardsPage() || isIMDbReleaseInfoPage() || isIMDbTechnicalPage() || isIMDbTitlePage()) {
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

        if (isIMDbTitlePage()) {
          // Wait for title page DOM to load
          await waitForTitleDOM();
          // Extract title and description from main title page
          const titleData = extractTitlePageDescription();
          extractedData = [titleData]; // Wrap in array for consistency
          pageType = 'title';
        } else if (isIMDbFullCreditsPage()) {
          // Wait for cast/crew DOM to load (may be delayed due to network issues)
          await waitForCastDOM();
          extractedData = extractCastData();
          pageType = 'fullcredits';
        } else if (isIMDbCompanyCreditsPage()) {
          // Wait for company DOM to load
          await waitForCompanyDOM();
          extractedData = extractCompanyData();
          pageType = 'companycredits';
        } else if (isIMDbAwardsPage()) {
          // Wait for awards DOM to load
          await waitForAwardsDOM();
          extractedData = await extractAwardsData();
          pageType = 'awards';
        } else if (isIMDbReleaseInfoPage()) {
          // Wait for release info DOM to load
          await waitForReleaseDOM();
          extractedData = await extractReleaseData();
          pageType = 'releaseinfo';
        } else if (isIMDbTechnicalPage()) {
          // Wait for technical specs to load (may be delayed due to network/CSM resource issues)
          await waitForTechnicalDOM();
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
        console.log('Awards page: No awards content found (page may not have awards)');
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

  /**
   * Listen for extraction requests from the background/main script (tab selector mode)
   */
  // Register message listener with error handling
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'performConsolidatedExtraction') {
          const pageType = request.pageType;
          console.log(`Received extraction request for ${pageType}`);

          (async () => {
            try {
              // Check context at the start of the async operation
              if (!isExtensionContextValid()) {
                console.warn('Extension context invalidated during extraction');
                sendResponse({ success: false, error: 'Extension context invalidated' });
                return;
              }

              let extractedData = null;

              // Wait for DOM to be ready first
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Perform extraction based on page type
              if (pageType === 'title' && isIMDbTitlePage()) {
                // Wait for title page DOM to load
                await waitForTitleDOM();
                // Extract title and description
                const titleData = extractTitlePageDescription();
                extractedData = [titleData]; // Wrap in array for consistency
              } else if (pageType === 'fullcredits' && isIMDbFullCreditsPage()) {
                await waitForCastDOM();
                extractedData = extractCastData();
              } else if (pageType === 'companycredits' && isIMDbCompanyCreditsPage()) {
                await waitForCompanyDOM();
                extractedData = extractCompanyData();
              } else if (pageType === 'awards' && isIMDbAwardsPage()) {
                await waitForAwardsDOM();
                extractedData = await extractAwardsData();
              } else if (pageType === 'releaseinfo' && isIMDbReleaseInfoPage()) {
                await waitForReleaseDOM();
                extractedData = await extractReleaseData();
              } else if (pageType === 'technical' && isIMDbTechnicalPage()) {
                await waitForTechnicalDOM();
                extractedData = extractTechnicalData();
              }

              // Check context before storing data
              if (!isExtensionContextValid()) {
                console.warn('Extension context invalidated before storing data');
                sendResponse({ success: false, error: 'Extension context invalidated' });
                return;
              }

              // Store extracted data
              if (extractedData) {
                storeConsolidatedData(pageType, extractedData);
                console.log(`✓ Extracted and stored ${pageType} data (${extractedData.length} items)`);
              } else {
                storeConsolidatedData(pageType, []);
                console.log(`No data found for ${pageType}, stored empty array`);
              }

              sendResponse({ success: true, pageType, itemsExtracted: extractedData ? extractedData.length : 0 });
            } catch (error) {
              console.error(`Error extracting ${pageType}:`, error);
              storeConsolidatedData(pageType, []);
              sendResponse({ success: false, error: error.message });
            }
          })();

          return true; // Keep channel open for async response
        }
      });
    } else {
      console.warn('Extension context invalid at startup, message listener not registered');
    }
  } catch (error) {
    console.warn('Error registering message listener:', error);
  }

  /**
   * Listen for settings changes to show/hide customized view buttons
   */
  try {
    if (isExtensionContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          // Check if consolidated view button setting changed
          if (changes.showConsolidatedViewBtn) {
            const isEnabled = changes.showConsolidatedViewBtn.newValue !== false;
            const button = document.getElementById('open-consolidated-view-btn');

            if (!isEnabled && button) {
              // Remove button if disabled
              button.remove();
              console.log('Consolidated overview button removed due to settings change');
            } else if (isEnabled && !button && isIMDbTitlePage()) {
              // Re-create button if enabled and we're on a title page
              createOpenViewButton();
              console.log('Consolidated overview button added due to settings change');
            }
          }

          // Check if individual customized view button setting changed
          if (changes.showCustomizedViewBtn) {
            const isEnabled = changes.showCustomizedViewBtn.newValue !== false;
            const button = document.getElementById('open-customized-view-btn');

            if (!isEnabled && button) {
              // Remove button if disabled
              button.remove();
              console.log('Customized view button removed due to settings change');
            } else if (isEnabled && !button) {
              // Re-create button if enabled and we're on a supported page
              const isSupported = isIMDbFullCreditsPage() || isIMDbCompanyCreditsPage() ||
                                 isIMDbAwardsPage() || isIMDbReleaseInfoPage() || isIMDbTechnicalPage();
              if (isSupported) {
                createOpenViewButton();
                console.log('Customized view button added due to settings change');
              }
            }
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error setting up customized view settings change listener:', error);
  }

})();
