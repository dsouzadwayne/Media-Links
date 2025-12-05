// Unified View Page Script
// Handles both individual customized views and consolidated overview

(function() {
  'use strict';

  let viewMode = null; // 'single' or 'consolidated'
  let allData = {
    titleDescription: null,
    castCrew: [],
    productionCompanies: [],
    awards: [],
    releaseDates: [],
    technical: []
  };

  /**
   * Download file helper
   */
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Promisified wrapper for chrome.storage.local.get with error handling
   * HIGH SEVERITY FIX: Prevents race conditions by using async/await pattern
   */
  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Detect view mode and load appropriate data
   * HIGH SEVERITY FIX: Converted to async/await to prevent race conditions
   */
  async function detectViewMode() {
    try {
      // First check for single view data
      const singleResult = await storageGet(['customized-view-temp']);

      if (singleResult['customized-view-temp']) {
        viewMode = 'single';
        return { mode: 'single', data: singleResult['customized-view-temp'] };
      }

      // Otherwise check for consolidated view data
      const consolidatedResult = await storageGet([
        'consolidatedViewData_title',
        'consolidatedViewData_fullcredits',
        'consolidatedViewData_companycredits',
        'consolidatedViewData_awards',
        'consolidatedViewData_releaseinfo',
        'consolidatedViewData_technical'
      ]);

      // Validate consolidatedResult is an object
      if (!consolidatedResult || typeof consolidatedResult !== 'object') {
        console.warn('Invalid consolidated result:', consolidatedResult);
        viewMode = null;
        return { mode: null, data: null };
      }

      const hasConsolidatedData = consolidatedResult['consolidatedViewData_title'] ||
                                  consolidatedResult['consolidatedViewData_fullcredits'] ||
                                  consolidatedResult['consolidatedViewData_companycredits'] ||
                                  consolidatedResult['consolidatedViewData_awards'] ||
                                  consolidatedResult['consolidatedViewData_releaseinfo'] ||
                                  consolidatedResult['consolidatedViewData_technical'];

      if (hasConsolidatedData) {
        viewMode = 'consolidated';
        return { mode: 'consolidated', data: consolidatedResult };
      } else {
        viewMode = null;
        return { mode: null, data: null };
      }
    } catch (error) {
      console.error('Error in detectViewMode:', error);
      viewMode = null;
      return { mode: null, data: null };
    }
  }

  /**
   * Render single view mode
   */
  function renderSingleView(viewDataObj) {
    const contentDiv = document.getElementById('page-content');
    const headerControls = document.getElementById('header-controls');

    try {
      // HIGH SEVERITY FIX: Validate input data exists and has correct structure
      if (!viewDataObj) {
        throw new Error('viewDataObj is null or undefined');
      }

      if (!viewDataObj.data) {
        throw new Error('viewDataObj.data is missing');
      }

      if (!Array.isArray(viewDataObj.data)) {
        console.warn('viewDataObj.data is not an array:', typeof viewDataObj.data);
        throw new Error('viewDataObj.data must be an array');
      }

      const data = viewDataObj.data;
      const options = {
        title: viewDataObj.title,
        columns: viewDataObj.columns,
        pagePath: viewDataObj.pagePath,
        pageSource: viewDataObj.pageSource
      };

      // Update page title and source info
      document.title = `${options.title} - Media Links`;
      const pageTitle = document.getElementById('page-title');
      if (pageTitle) {
        pageTitle.textContent = `${options.title} View`;
      }
      const sourceInfo = document.getElementById('source-info');
      if (options.pageSource) {
        sourceInfo.textContent = `From: ${options.pageSource}`;
        sourceInfo.style.display = 'block';
      }

      // Add action buttons for single view
      headerControls.innerHTML = `
        <div class="view-page-actions">
          <button class="action-btn" id="export-csv-btn">📥 Export CSV</button>
          <button class="action-btn" id="export-json-btn">📥 Export JSON</button>
          <button class="action-btn secondary" id="go-back-btn">← Back</button>
        </div>
      `;

      // Create and render customized view
      if (typeof CustomizedView !== 'undefined') {
        const view = new CustomizedView({
          containerId: 'customized-view-full',
          data: data,
          title: options.title,
          columns: options.columns || ['name', 'role', 'roleType'],
          pagePath: options.pagePath
        });

        // MEDIUM FIX: Add .catch() handler for promise rejection
        view.loadPreferences()
          .then((prefs) => {
            // Validate that preferences were loaded
            // Note: null prefs is expected on first use, so don't warn
            if (!prefs || typeof prefs !== 'object') {
              prefs = {};
            }

            // Always ensure all available roles from current data are selected by default
            const allRoles = view.getAvailableRoles();
            view.selectedRoles = new Set(allRoles);

            // If there are saved preferences, use the search query (but not the role filters)
            if (prefs && prefs.searchQuery) {
              view.searchQuery = prefs.searchQuery;
            }

            contentDiv.innerHTML = '';
            view.render().then(viewElement => {
              contentDiv.appendChild(viewElement);
            });
          })
          .catch(async (error) => {
            // MEDIUM FIX: Handle preference loading errors with proper async/await
            console.error('Failed to load preferences:', error);

            // Set default empty preferences if load fails
            const allRoles = view.getAvailableRoles();
            view.selectedRoles = new Set(allRoles);
            view.searchQuery = '';

            // Continue with rendering despite error - await to prevent race condition
            contentDiv.innerHTML = '';
            const viewElement = await view.render();
            contentDiv.appendChild(viewElement);

            // Show user warning message
            const warning = document.createElement('div');
            warning.style.cssText = 'color: orange; padding: 10px; background: #fff3cd; margin: 10px 0; border-radius: 4px;';
            warning.textContent = 'Warning: Could not load saved preferences. Using defaults.';
            viewElement.insertBefore(warning, viewElement.firstChild);
          });
      } else {
        throw new Error('CustomizedView not available');
      }

      // Export to CSV
      document.getElementById('export-csv-btn').addEventListener('click', () => {
        const headers = options.columns || ['name', 'role', 'roleType'];
        const csvContent = [
          headers.join(','),
          ...data.map(row =>
            headers.map(col =>
              `"${(row[col] || '').toString().replace(/"/g, '""')}"`
            ).join(',')
          )
        ].join('\n');

        const filename = options.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.csv';
        downloadFile(csvContent, filename, 'text/csv');
      });

      // Export to JSON
      document.getElementById('export-json-btn').addEventListener('click', () => {
        const jsonContent = JSON.stringify(data, null, 2);
        const filename = options.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json';
        downloadFile(jsonContent, filename, 'application/json');
      });

      // Go back button
      document.getElementById('go-back-btn').addEventListener('click', () => {
        window.history.back();
      });

    } catch (error) {
      console.error('Error rendering single view:', error);
      // HIGH SEVERITY FIX: Display error to user
      const contentDiv = document.getElementById('page-content');
      if (contentDiv) {
        contentDiv.innerHTML = `
          <div style="color: red; padding: 20px;">
            <h3>Error Loading View</h3>
            <p>${error.message}</p>
            <p>Please refresh the page or try again.</p>
          </div>
        `;
      }
    }
  }

  /**
   * Load consolidated data from storage
   */
  async function loadConsolidatedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'consolidatedViewData_title',
        'consolidatedViewData_fullcredits',
        'consolidatedViewData_companycredits',
        'consolidatedViewData_awards',
        'consolidatedViewData_releaseinfo',
        'consolidatedViewData_technical'
      ], (result) => {
        console.log('Retrieved consolidated data from storage:', result);

        // Extract title and description from the title data
        const titleData = result['consolidatedViewData_title'];
        if (titleData && Array.isArray(titleData) && titleData.length > 0) {
          allData.titleDescription = titleData[0]; // Get the first (and only) item
        } else {
          allData.titleDescription = null;
        }

        allData.castCrew = result['consolidatedViewData_fullcredits'] || [];
        allData.productionCompanies = result['consolidatedViewData_companycredits'] || [];
        allData.awards = result['consolidatedViewData_awards'] || [];
        allData.releaseDates = result['consolidatedViewData_releaseinfo'] || [];
        allData.technical = result['consolidatedViewData_technical'] || [];

        console.log('Loaded consolidated data:', allData);
        resolve();
      });
    });
  }

  /**
   * Create a section with CustomizedView component (for consolidated view)
   */
  async function createSection(title, sectionId, items, columns) {
    const section = document.createElement('div');
    section.className = 'section';
    section.id = sectionId;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'section-title';
    titleDiv.textContent = title;

    section.appendChild(titleDiv);

    // If no items, show empty state
    if (!items || items.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'no-results';
      emptyDiv.textContent = 'No data available';
      section.appendChild(emptyDiv);
      return section;
    }

    // Create a container for the customized view
    const viewContainer = document.createElement('div');
    viewContainer.id = `${sectionId}-view-container`;
    section.appendChild(viewContainer);

    // Check if CustomizedView is available
    if (typeof CustomizedView !== 'undefined') {
      try {
        const view = new CustomizedView({
          containerId: `${sectionId}-view-container`,
          data: items,
          title: title.replace(/^[📋🏢🏆📅⚙️]\s*/, ''), // Remove emoji from title
          columns: columns || ['name', 'role', 'roleType'],
          pagePath: `/consolidated/${sectionId}`
        });

        // Load preferences and render
        const prefs = await view.loadPreferences();
        const allRoles = view.getAvailableRoles();
        view.selectedRoles = new Set(allRoles);

        if (prefs && prefs.searchQuery) {
          view.searchQuery = prefs.searchQuery;
        }

        const viewElement = await view.render();
        viewContainer.innerHTML = '';
        viewContainer.appendChild(viewElement);
      } catch (error) {
        console.error(`Error creating CustomizedView for ${sectionId}:`, error);
        // Fallback to simple display
        viewContainer.innerHTML = '<div class="no-results">Error loading view</div>';
      }
    } else {
      // Fallback if CustomizedView not available
      console.warn('CustomizedView not available, using simple display');
      items.forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';

        let nameText = item.name || item.role || '';
        let detailText = '';

        if (item.role && item.name !== item.role) {
          detailText += `${item.role}`;
        }
        if (item.award) {
          detailText += (detailText ? ' • ' : '') + item.award;
        }
        if (item.year) {
          detailText += (detailText ? ' • ' : '') + item.year;
        }

        itemDiv.innerHTML = `
          <div class="item-name">${nameText}</div>
          ${detailText ? `<div class="item-detail">${detailText}</div>` : ''}
        `;

        viewContainer.appendChild(itemDiv);
      });
    }

    return section;
  }

  /**
   * Render consolidated view mode
   */
  async function renderConsolidatedView() {
    const contentDiv = document.getElementById('page-content');
    const headerControls = document.getElementById('header-controls');
    const pageTitle = document.getElementById('page-title');
    const sourceInfo = document.getElementById('source-info');

    // Update page title
    document.title = 'Consolidated Overview - Media Links';
    if (pageTitle) {
      pageTitle.textContent = '🎬 Consolidated Overview';
    }
    if (sourceInfo) {
      sourceInfo.style.display = 'none';
    }

    // Add search controls for consolidated view (removed for now since each section has its own search)
    // Count sections: arrays with items + titleDescription if it has description
    const arraySectionCount = Object.keys(allData).filter(k => Array.isArray(allData[k]) && allData[k].length > 0).length;
    const hasTitleDescription = allData.titleDescription && allData.titleDescription.description;
    const totalSections = arraySectionCount + (hasTitleDescription ? 1 : 0);

    headerControls.innerHTML = `
      <div class="page-search">
        <div class="search-result-count" style="font-size: 14px; color: var(--text-primary);">
          Showing ${totalSections} section${totalSections !== 1 ? 's' : ''}
        </div>
      </div>
    `;

    contentDiv.innerHTML = '<div class="loading-message">Rendering sections...</div>';

    let hasData = false;

    // Title and Description section (displayed at the top)
    if (allData.titleDescription && allData.titleDescription.description) {
      hasData = true;
      const descriptionSection = document.createElement('div');
      descriptionSection.className = 'section description-section';
      descriptionSection.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        border-radius: 8px;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;

      const titleDiv = document.createElement('h2');
      titleDiv.textContent = allData.titleDescription.title || 'Movie Overview';
      titleDiv.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: 700;
      `;

      const descDiv = document.createElement('p');
      descDiv.textContent = allData.titleDescription.description;
      descDiv.style.cssText = `
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        opacity: 0.95;
      `;

      descriptionSection.appendChild(titleDiv);
      descriptionSection.appendChild(descDiv);

      contentDiv.innerHTML = '';
      contentDiv.appendChild(descriptionSection);
    } else {
      contentDiv.innerHTML = '';
    }

    // Cast & Crew section
    // Note: Column visibility per roleType is handled by RoleFilters in customized-views.js
    // Single credit roles (Directors, Producers, etc.) will hide the Role column automatically
    if (allData.castCrew && allData.castCrew.length > 0) {
      hasData = true;
      const section = await createSection('📋 Cast & Crew', 'cast-crew', allData.castCrew, ['name', 'role', 'roleType']);
      contentDiv.appendChild(section);
    }

    // Production Companies section
    if (allData.productionCompanies && allData.productionCompanies.length > 0) {
      hasData = true;
      const section = await createSection('🏢 Production Companies', 'companies', allData.productionCompanies, ['name', 'role']);
      contentDiv.appendChild(section);
    }

    // Awards section
    if (allData.awards && allData.awards.length > 0) {
      hasData = true;
      const section = await createSection('🏆 Awards', 'awards', allData.awards, ['name', 'role', 'award', 'year']);
      contentDiv.appendChild(section);
    }

    // Release Dates section
    if (allData.releaseDates && allData.releaseDates.length > 0) {
      hasData = true;
      const section = await createSection('📅 Release Dates', 'releases', allData.releaseDates, ['name', 'role', 'award']);
      contentDiv.appendChild(section);
    }

    // Technical Specifications section
    if (allData.technical && allData.technical.length > 0) {
      hasData = true;
      const section = await createSection('⚙️ Technical Specifications', 'technical', allData.technical, ['name', 'role']);
      contentDiv.appendChild(section);
    }

    if (!hasData) {
      contentDiv.innerHTML = '<div class="no-results">No data available yet. The extraction pages may still be loading. Please wait a moment...</div>';
    }
  }


  /**
   * Poll for consolidated data updates (pages may still be extracting)
   */
  function pollForConsolidatedUpdates() {
    const maxWaitTime = 30000; // Wait up to 30 seconds
    const pollInterval = 2000; // Poll every 2 seconds
    let elapsedTime = 0;

    const pollTimer = setInterval(() => {
      elapsedTime += pollInterval;

      chrome.storage.local.get([
        'consolidatedViewData_title',
        'consolidatedViewData_fullcredits',
        'consolidatedViewData_companycredits',
        'consolidatedViewData_awards',
        'consolidatedViewData_releaseinfo',
        'consolidatedViewData_technical'
      ], (result) => {
        const hasData = result['consolidatedViewData_title'] ||
                       result['consolidatedViewData_fullcredits'] ||
                       result['consolidatedViewData_companycredits'] ||
                       result['consolidatedViewData_awards'] ||
                       result['consolidatedViewData_releaseinfo'] ||
                       result['consolidatedViewData_technical'];

        if (hasData) {
          clearInterval(pollTimer);
          console.log('New consolidated data available, updating view');
          loadConsolidatedData().then(async () => {
            await renderConsolidatedView();
          });
        } else if (elapsedTime >= maxWaitTime) {
          clearInterval(pollTimer);
          console.log('Stopped polling after 30 seconds');
        }
      });
    }, pollInterval);
  }

  /**
   * Initialize theme on page load
   */
  async function initializeTheme() {
    try {
      if (typeof ThemeManager !== 'undefined') {
        await ThemeManager.initialize();
        console.log('Consolidated View: Theme initialized');
      } else {
        console.warn('Consolidated View: ThemeManager not available');
      }
    } catch (error) {
      console.error('Consolidated View: Error initializing theme:', error);
    }
  }

  /**
   * Listen for theme changes
   */
  function setupThemeListeners() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'themeChanged' && message.theme) {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.setTheme(message.theme);
        } else {
          // Fallback if ThemeManager not available
          document.body.setAttribute('data-theme', message.theme);
          document.documentElement.setAttribute('data-theme', message.theme);
        }
      }
    });
  }

  /**
   * Initialize the view page
   */
  async function initialize() {
    console.log('Initializing unified view page');

    // Check if chrome storage is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      const contentDiv = document.getElementById('page-content');
      contentDiv.innerHTML = `
        <div class="error-message">
          ⚠️ Chrome storage API not available.
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h2>Storage Error</h2>
          <p>The extension cannot access storage. Please reload the extension and try again.</p>
        </div>
      `;
      return;
    }

    // Detect view mode
    const detection = await detectViewMode();
    console.log('Detected view mode:', detection.mode);

    if (detection.mode === 'single') {
      // Render single view
      renderSingleView(detection.data);
    } else if (detection.mode === 'consolidated') {
      // Load and render consolidated view
      await loadConsolidatedData();
      await renderConsolidatedView();
      // Poll for updates
      pollForConsolidatedUpdates();
    } else {
      // No data found
      const contentDiv = document.getElementById('page-content');
      contentDiv.innerHTML = `
        <div class="error-message">
          ⚠️ No data found. Please open a view from an IMDb page.
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h2>No Data Available</h2>
          <p>Navigate to an IMDb page and click on a view button to see data here.</p>
        </div>
      `;
    }
  }

  /**
   * Check if this view was opened from comparison
   */
  function checkIfFromComparison() {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');

    if (source === 'comparison' || source === 'wikipedia') {
      // Show navigation tabs
      const navDiv = document.getElementById('view-navigation');
      if (navDiv) {
        navDiv.style.display = 'flex';

        // Get all nav buttons
        const wikiBtn = document.getElementById('nav-wiki-view');
        const imdbBtn = document.getElementById('nav-imdb-view');
        const comparisonBtn = document.getElementById('nav-comparison-view');

        // Remove active from all first
        wikiBtn?.classList.remove('active');
        imdbBtn?.classList.remove('active');
        comparisonBtn?.classList.remove('active');

        // Update active tab based on source
        if (source === 'wikipedia') {
          wikiBtn?.classList.add('active');
        } else if (source === 'comparison') {
          // This is IMDb view from comparison
          imdbBtn?.classList.add('active');
        }
      }
    }
  }

  /**
   * Convert Wikipedia data structure to flat array format for view
   */
  function convertWikipediaDataToViewFormat(wikiData) {
    const flatData = [];

    // Add cast
    if (wikiData.cast && Array.isArray(wikiData.cast)) {
      wikiData.cast.forEach(item => {
        flatData.push({
          name: item.name || item.actor || '',
          role: item.character || item.role || '',
          roleType: 'Cast',
          section: 'Cast'
        });
      });
    }

    // Add directors
    if (wikiData.directors && Array.isArray(wikiData.directors)) {
      wikiData.directors.forEach(item => {
        flatData.push({
          name: item.name || item,
          role: 'Director',
          roleType: 'Directing',
          section: 'Directing'
        });
      });
    }

    // Add producers
    if (wikiData.producers && Array.isArray(wikiData.producers)) {
      wikiData.producers.forEach(item => {
        flatData.push({
          name: item.name || item,
          role: item.role || 'Producer',
          roleType: 'Producing',
          section: 'Producing'
        });
      });
    }

    // Add writers
    if (wikiData.writers && Array.isArray(wikiData.writers)) {
      wikiData.writers.forEach(item => {
        flatData.push({
          name: item.name || item,
          role: item.role || 'Writer',
          roleType: 'Writing',
          section: 'Writing'
        });
      });
    }

    // Add production companies
    if (wikiData.productionCompanies && Array.isArray(wikiData.productionCompanies)) {
      wikiData.productionCompanies.forEach(item => {
        flatData.push({
          name: item.name || item,
          role: 'Production Company',
          roleType: 'Production',
          section: 'Production'
        });
      });
    }

    return flatData;
  }

  /**
   * Switch to Wikipedia view from consolidated view
   */
  function switchToWikipediaViewFromConsolidated() {
    // Get comparison data from storage
    chrome.storage.local.get(['comparison-data'], (result) => {
      if (result['comparison-data'] && result['comparison-data'].sourceA) {
        // Convert Wikipedia data to flat format
        const flatData = convertWikipediaDataToViewFormat(result['comparison-data'].sourceA);

        // Clear conflicting IMDb consolidated keys first
        chrome.storage.local.remove([
          'consolidatedViewData_fullcredits',
          'consolidatedViewData_companycredits',
          'consolidatedViewData_awards',
          'consolidatedViewData_releaseinfo',
          'consolidatedViewData_technical',
          'consolidatedViewData_title',
          'consolidatedViewMovieId'
        ], () => {
          // Store Wikipedia data
          chrome.storage.local.set({
            'customized-view-temp': {
              data: flatData,
              source: 'Wikipedia',
              title: result['comparison-data'].sourceAName || 'Wikipedia',
              columns: ['name', 'role', 'roleType'],
              pageSource: 'Wikipedia'
            }
          }, () => {
            // Reload with wikipedia source parameter
            window.location.href = chrome.runtime.getURL('consolidated-view-page.html?source=wikipedia');
          });
        });
      } else {
        alert('Wikipedia data not available');
      }
    });
  }

  /**
   * Switch to IMDb view from consolidated/wikipedia view
   */
  function switchToIMDbViewFromConsolidated() {
    // Get comparison data from storage
    chrome.storage.local.get(['comparison-data'], (result) => {
      if (result['comparison-data'] && result['comparison-data'].sourceB) {
        const imdbData = result['comparison-data'].sourceB;

        // Clear conflicting Wikipedia single-view key first
        chrome.storage.local.remove(['customized-view-temp'], () => {
          // Store IMDb consolidated data for the consolidated view page
          chrome.storage.local.set({
            'consolidatedViewData_fullcredits': imdbData.fullcredits || [],
            'consolidatedViewData_companycredits': imdbData.companycredits || [],
            'consolidatedViewData_awards': imdbData.awards || [],
            'consolidatedViewData_releaseinfo': imdbData.releaseinfo || [],
            'consolidatedViewData_technical': imdbData.technical || [],
            'consolidatedViewMovieId': 'comparison-view'
          }, () => {
            // Reload with comparison source parameter
            window.location.href = chrome.runtime.getURL('consolidated-view-page.html?source=comparison');
          });
        });
      } else {
        alert('IMDb data not available');
      }
    });
  }

  /**
   * Switch to comparison view from consolidated view
   */
  function switchToComparisonViewFromConsolidated() {
    // Check if comparison data exists
    chrome.storage.local.get(['comparison-data'], (result) => {
      if (result['comparison-data']) {
        // Go to comparison page
        window.location.href = chrome.runtime.getURL('comparison-view-page.html');
      } else {
        alert('Comparison data not available. Please start a new comparison from IMDb or Wikipedia.');
      }
    });
  }

  /**
   * Setup navigation button event listeners (CSP-compliant)
   */
  function setupConsolidatedNavigationListeners() {
    const wikiBtn = document.getElementById('nav-wiki-view');
    const imdbBtn = document.getElementById('nav-imdb-view');
    const comparisonBtn = document.getElementById('nav-comparison-view');

    if (wikiBtn) {
      wikiBtn.addEventListener('click', switchToWikipediaViewFromConsolidated);
    }

    if (imdbBtn) {
      imdbBtn.addEventListener('click', switchToIMDbViewFromConsolidated);
    }

    if (comparisonBtn) {
      comparisonBtn.addEventListener('click', switchToComparisonViewFromConsolidated);
    }
  }

  // Load when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await initializeTheme();
      setupThemeListeners();
      setupConsolidatedNavigationListeners();
      initialize();
      checkIfFromComparison();
    });
  } else {
    (async () => {
      await initializeTheme();
      setupThemeListeners();
      setupConsolidatedNavigationListeners();
      initialize();
      checkIfFromComparison();
    })();
  }
})();
