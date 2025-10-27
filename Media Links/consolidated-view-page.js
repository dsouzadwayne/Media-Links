// Unified View Page Script
// Handles both individual customized views and consolidated overview

(function() {
  'use strict';

  let viewMode = null; // 'single' or 'consolidated'
  let allData = {
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
   * Detect view mode and load appropriate data
   */
  async function detectViewMode() {
    return new Promise((resolve) => {
      // First check for single view data
      chrome.storage.local.get(['customized-view-temp'], (result) => {
        if (result['customized-view-temp']) {
          viewMode = 'single';
          resolve({ mode: 'single', data: result['customized-view-temp'] });
          return;
        }

        // Otherwise check for consolidated view data
        chrome.storage.local.get([
          'consolidatedViewData_fullcredits',
          'consolidatedViewData_companycredits',
          'consolidatedViewData_awards',
          'consolidatedViewData_releaseinfo',
          'consolidatedViewData_technical'
        ], (consolidatedResult) => {
          const hasConsolidatedData = consolidatedResult['consolidatedViewData_fullcredits'] ||
                                      consolidatedResult['consolidatedViewData_companycredits'] ||
                                      consolidatedResult['consolidatedViewData_awards'] ||
                                      consolidatedResult['consolidatedViewData_releaseinfo'] ||
                                      consolidatedResult['consolidatedViewData_technical'];

          if (hasConsolidatedData) {
            viewMode = 'consolidated';
            resolve({ mode: 'consolidated', data: consolidatedResult });
          } else {
            viewMode = null;
            resolve({ mode: null, data: null });
          }
        });
      });
    });
  }

  /**
   * Render single view mode
   */
  function renderSingleView(viewDataObj) {
    const contentDiv = document.getElementById('page-content');
    const headerControls = document.getElementById('header-controls');

    try {
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

        // Load preferences
        view.loadPreferences().then((prefs) => {
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
      console.error('Error loading single view:', error);
      contentDiv.innerHTML = `
        <div class="error-message">
          ⚠️ Error loading data: ${error.message}
        </div>
      `;
    }
  }

  /**
   * Load consolidated data from storage
   */
  async function loadConsolidatedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'consolidatedViewData_fullcredits',
        'consolidatedViewData_companycredits',
        'consolidatedViewData_awards',
        'consolidatedViewData_releaseinfo',
        'consolidatedViewData_technical'
      ], (result) => {
        console.log('Retrieved consolidated data from storage:', result);

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
    headerControls.innerHTML = `
      <div class="page-search">
        <div class="search-result-count" style="font-size: 14px; color: var(--text-primary);">
          Showing ${Object.keys(allData).filter(k => Array.isArray(allData[k]) && allData[k].length > 0).length} sections
        </div>
      </div>
    `;

    contentDiv.innerHTML = '<div class="loading-message">Rendering sections...</div>';

    let hasData = false;

    // Cast & Crew section
    if (allData.castCrew && allData.castCrew.length > 0) {
      hasData = true;
      const section = await createSection('📋 Cast & Crew', 'cast-crew', allData.castCrew, ['name', 'role', 'roleType']);
      contentDiv.innerHTML = '';
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
        'consolidatedViewData_fullcredits',
        'consolidatedViewData_companycredits',
        'consolidatedViewData_awards',
        'consolidatedViewData_releaseinfo',
        'consolidatedViewData_technical'
      ], (result) => {
        const hasData = result['consolidatedViewData_fullcredits'] ||
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

  // Load when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
