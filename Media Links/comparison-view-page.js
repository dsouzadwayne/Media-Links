// Comparison View Page Script
// Displays comparison results between Wikipedia and IMDb data

(function() {
  'use strict';

  let comparisonData = null;
  let sourceA = '';
  let sourceB = '';

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.copy-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Copy category data to clipboard
   */
  function copyCategoryData(categoryData, categoryName, section = 'all') {
    let dataToCopy = [];

    if (section === 'all') {
      // Copy all data
      dataToCopy = [
        ...categoryData.common.map(item => ({
          name: item.name,
          role: item.role || '—',
          source: item.sources?.join(', ') || (item.conflictFlag ? 'Conflict' : 'Both')
        })),
        ...categoryData.wikiOnly.map(item => ({
          name: item.name,
          role: item.role || '—',
          source: 'Wikipedia'
        })),
        ...categoryData.imdbOnly.map(item => ({
          name: item.name,
          role: item.role || '—',
          source: 'IMDb'
        }))
      ];
    } else if (section === 'common') {
      dataToCopy = categoryData.common.map(item => ({
        name: item.name,
        role: item.role || '—',
        source: item.sources?.join(', ') || (item.conflictFlag ? 'Conflict' : 'Both')
      }));
    } else if (section === 'wiki') {
      dataToCopy = categoryData.wikiOnly.map(item => ({
        name: item.name,
        role: item.role || '—',
        source: 'Wikipedia'
      }));
    } else if (section === 'imdb') {
      dataToCopy = categoryData.imdbOnly.map(item => ({
        name: item.name,
        role: item.role || '—',
        source: 'IMDb'
      }));
    }

    if (dataToCopy.length === 0) {
      showToast('No data to copy', 'error');
      return;
    }

    // Format as tab-separated values for easy pasting
    const header = 'Name\tRole\tSource';
    const rows = dataToCopy.map(item => `${item.name}\t${item.role}\t${item.source}`);
    const text = [header, ...rows].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied ${dataToCopy.length} ${categoryName} entries!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy', 'error');
    });
  }

  /**
   * Copy single row to clipboard
   */
  function copyRowData(name, role, source) {
    const text = `${name}\t${role}\t${source}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied: ${name}`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy', 'error');
    });
  }

  /**
   * Load comparison data from storage
   */
  async function loadComparisonData() {
    return new Promise((resolve) => {
      // Try new storage key first
      chrome.storage.local.get(['comparison-data'], (result) => {
        if (result['comparison-data']) {
          comparisonData = result['comparison-data'];
          sourceA = comparisonData.sourceAName || 'Source A';
          sourceB = comparisonData.sourceBName || 'Source B';
          resolve(true);
          return;
        }

        // Fallback to old key
        chrome.storage.local.get(['comparison-view-data'], (oldResult) => {
          if (oldResult['comparison-view-data']) {
            comparisonData = oldResult['comparison-view-data'];
            sourceA = comparisonData.sourceA;
            sourceB = comparisonData.sourceB;
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    });
  }

  /**
   * Render the comparison view
   */
  async function renderComparison() {
    const contentDiv = document.getElementById('comparison-content');
    const summaryDiv = document.getElementById('summary-section');

    try {
      const loaded = await loadComparisonData();
      if (!loaded || !comparisonData) {
        contentDiv.innerHTML = `
          <div class="no-categories">
            ⚠️ No comparison data found. Please try again.
          </div>
        `;
        return;
      }

      // Update source badges
      document.getElementById('source-wiki').textContent = `📖 ${sourceA}`;
      document.getElementById('source-imdb').textContent = `🎬 ${sourceB}`;

      // Calculate summary statistics
      const summary = calculateSummary(comparisonData.comparison);
      renderSummary(summaryDiv, summary);

      // Render categories
      contentDiv.innerHTML = '';

      // MEDIUM FIX: Validate comparison data structure
      if (!comparisonData.comparison || typeof comparisonData.comparison !== 'object') {
        throw new Error('comparisonData.comparison is missing or invalid');
      }

      const comparison = comparisonData.comparison;

      // Helper function to validate comparison category (new structure: common, wikiOnly, imdbOnly)
      function validateCategoryData(categoryData) {
        if (!categoryData || typeof categoryData !== 'object') {
          return null;
        }

        return {
          common: Array.isArray(categoryData.common) ? categoryData.common : [],
          wikiOnly: Array.isArray(categoryData.wikiOnly) ? categoryData.wikiOnly : [],
          imdbOnly: Array.isArray(categoryData.imdbOnly) ? categoryData.imdbOnly : []
        };
      }

      const categories = ['directors', 'producers', 'writers', 'cast', 'production', 'runtime', 'countries', 'languages', 'releaseDate'];
      let hasContent = false;

      categories.forEach(categoryKey => {
        const categoryData = validateCategoryData(comparison[categoryKey]);

        if (!categoryData) {
          console.warn(`Skipping invalid category: ${categoryKey}`);
          return;
        }

        // Safe to use categoryData now
        if (categoryData.common.length > 0 || categoryData.wikiOnly.length > 0 || categoryData.imdbOnly.length > 0) {
          const categoryElement = renderCategory(categoryData, categoryKey);
          contentDiv.appendChild(categoryElement);
          hasContent = true;
        }
      });

      if (!hasContent) {
        contentDiv.innerHTML = `
          <div class="no-categories">
            ℹ️ No data to compare
          </div>
        `;
      }
    } catch (error) {
      console.error('Error rendering comparison:', error);
      contentDiv.innerHTML = `
        <div style="color: #ef4444; padding: 20px; text-align: center;">
          ⚠️ Error loading comparison: ${error.message}
        </div>
      `;
    }
  }

  /**
   * Calculate summary statistics (new structure: common, wikiOnly, imdbOnly)
   */
  function calculateSummary(comparison) {
    let totalCommon = 0;
    let totalConflicts = 0;
    let totalWikiOnly = 0;
    let totalImdbOnly = 0;

    Object.values(comparison).forEach(category => {
      if (category) {
        const common = category.common || [];
        // Count exact matches vs conflicts
        common.forEach(item => {
          if (item.conflictFlag) {
            totalConflicts++;
          } else {
            totalCommon++;
          }
        });
        totalWikiOnly += (category.wikiOnly || []).length;
        totalImdbOnly += (category.imdbOnly || []).length;
      }
    });

    return { totalCommon, totalConflicts, totalWikiOnly, totalImdbOnly };
  }

  /**
   * Render summary statistics (new structure)
   */
  function renderSummary(summaryDiv, summary) {
    summaryDiv.innerHTML = `
      <div class="summary-item">
        <div class="summary-value" style="color: #22c55e;">✓</div>
        <div class="summary-label">Exact Matches</div>
        <div class="summary-value" style="color: #22c55e;">${summary.totalCommon}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #f97316;">⚠</div>
        <div class="summary-label">Role Conflicts</div>
        <div class="summary-value" style="color: #f97316;">${summary.totalConflicts}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #3b82f6;">📖</div>
        <div class="summary-label">Only in ${sourceA}</div>
        <div class="summary-value" style="color: #3b82f6;">${summary.totalWikiOnly}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #ef4444;">🎬</div>
        <div class="summary-label">Only in ${sourceB}</div>
        <div class="summary-value" style="color: #ef4444;">${summary.totalImdbOnly}</div>
      </div>
    `;
  }

  /**
   * Create a comparison row element
   */
  function createComparisonRow(entry, rowType) {
    const row = document.createElement('tr');
    row.className = `row-${rowType}`;

    // Determine source badge and source text for copying
    let sourceBadge = '';
    let sourceText = '';
    if (entry.sources && entry.sources.length === 2) {
      sourceBadge = '<span class="source-badge source-both">✓ Both</span>';
      sourceText = 'Both';
    } else if (entry.sources && entry.sources.includes('Wikipedia')) {
      sourceBadge = '<span class="source-badge source-wiki">📖 Wikipedia</span>';
      sourceText = 'Wikipedia';
    } else if (entry.sources && entry.sources.includes('IMDb')) {
      sourceBadge = '<span class="source-badge source-imdb">🎬 IMDb</span>';
      sourceText = 'IMDb';
    }

    // Add conflict indicator if applicable
    const conflictIndicator = entry.conflictFlag ? ' <span class="conflict-indicator">⚠</span>' : '';

    const name = entry.name || '—';
    const role = entry.role || '—';

    row.innerHTML = `
      <td><strong>${name}${conflictIndicator}</strong></td>
      <td>${role}</td>
      <td>${sourceBadge}</td>
      <td class="action-cell">
        <button class="copy-row-btn" title="Copy this row">📋</button>
      </td>
    `;

    // Add click handler for copy button
    const copyBtn = row.querySelector('.copy-row-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyRowData(name, role, sourceText);
      });
    }

    return row;
  }

  /**
   * Render individual category section (new structure: common first, then wikiOnly, then imdbOnly)
   * Now with copy buttons and proper data division like Consolidated Overview
   */
  function renderCategory(categoryData, categoryKey) {
    // Map category keys to display names and icons
    const categoryConfig = {
      'directors': { name: 'Directors', icon: '🎬' },
      'producers': { name: 'Producers', icon: '🎥' },
      'writers': { name: 'Writers', icon: '✍️' },
      'cast': { name: 'Cast', icon: '👥' },
      'production': { name: 'Production Companies', icon: '🏢' },
      'runtime': { name: 'Runtime', icon: '⏱️' },
      'countries': { name: 'Countries', icon: '🌍' },
      'languages': { name: 'Languages', icon: '🗣️' },
      'releaseDate': { name: 'Release Date', icon: '📅' }
    };

    const config = categoryConfig[categoryKey] || { name: categoryKey, icon: '📋' };
    const categoryName = config.name;

    const section = document.createElement('div');
    section.className = 'category-section';

    const header = document.createElement('div');
    header.className = 'category-header';

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'category-title-wrapper';

    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = `${config.icon} ${categoryName}`;

    // Add copy all button next to title
    const copyAllBtn = document.createElement('button');
    copyAllBtn.className = 'copy-category-btn';
    copyAllBtn.innerHTML = '📋 Copy All';
    copyAllBtn.title = `Copy all ${categoryName}`;
    copyAllBtn.addEventListener('click', () => {
      copyCategoryData(categoryData, categoryName, 'all');
    });

    titleWrapper.appendChild(title);
    titleWrapper.appendChild(copyAllBtn);

    const stats = document.createElement('div');
    stats.className = 'category-stats';

    // Count exact matches and conflicts separately
    const exactMatches = categoryData.common.filter(item => !item.conflictFlag);
    const conflicts = categoryData.common.filter(item => item.conflictFlag);

    if (exactMatches.length > 0) {
      const exactStat = document.createElement('div');
      exactStat.className = 'stat stat-same';
      exactStat.innerHTML = `✓ ${exactMatches.length} Match`;
      stats.appendChild(exactStat);
    }

    if (conflicts.length > 0) {
      const conflictStat = document.createElement('div');
      conflictStat.className = 'stat stat-conflict';
      conflictStat.innerHTML = `⚠ ${conflicts.length} Conflict`;
      stats.appendChild(conflictStat);
    }

    if (categoryData.wikiOnly.length > 0) {
      const wikiStat = document.createElement('div');
      wikiStat.className = 'stat stat-unique-a';
      wikiStat.innerHTML = `📖 ${categoryData.wikiOnly.length} Wiki`;
      stats.appendChild(wikiStat);
    }

    if (categoryData.imdbOnly.length > 0) {
      const imdbStat = document.createElement('div');
      imdbStat.className = 'stat stat-unique-b';
      imdbStat.innerHTML = `🎬 ${categoryData.imdbOnly.length} IMDb`;
      stats.appendChild(imdbStat);
    }

    header.appendChild(titleWrapper);
    header.appendChild(stats);
    section.appendChild(header);

    // Create table with 4-column structure (added Action column)
    const table = document.createElement('table');
    table.className = 'comparison-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th style="width: 30%;">Name</th>
      <th style="width: 30%;">Role</th>
      <th style="width: 25%;">Source</th>
      <th style="width: 15%;">Action</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Section: COMMON ENTRIES (exact matches first, then conflicts)
    if (categoryData.common.length > 0) {
      // Add section divider with copy button
      const commonDivider = document.createElement('tr');
      commonDivider.className = 'section-divider';
      const commonTd = document.createElement('td');
      commonTd.colSpan = 4;
      commonTd.innerHTML = `
        <div class="divider-content">
          <span>COMMON ENTRIES (${categoryData.common.length})</span>
          <button class="copy-section-btn" title="Copy common entries">📋 Copy</button>
        </div>
      `;
      commonDivider.appendChild(commonTd);
      tbody.appendChild(commonDivider);

      // Add copy handler for common section
      const copyCommonBtn = commonTd.querySelector('.copy-section-btn');
      if (copyCommonBtn) {
        copyCommonBtn.addEventListener('click', () => {
          copyCategoryData(categoryData, categoryName + ' (Common)', 'common');
        });
      }

      // Add exact matches (green)
      exactMatches.forEach(item => {
        tbody.appendChild(createComparisonRow(item, 'exact-match'));
      });

      // Add conflicts (orange) - same name but different roles
      conflicts.forEach(item => {
        tbody.appendChild(createComparisonRow(item, 'conflict'));
      });
    }

    // Section: WIKIPEDIA ONLY
    if (categoryData.wikiOnly.length > 0) {
      const wikiDivider = document.createElement('tr');
      wikiDivider.className = 'section-divider';
      const wikiTd = document.createElement('td');
      wikiTd.colSpan = 4;
      wikiTd.innerHTML = `
        <div class="divider-content">
          <span>WIKIPEDIA ONLY (${categoryData.wikiOnly.length})</span>
          <button class="copy-section-btn" title="Copy Wikipedia entries">📋 Copy</button>
        </div>
      `;
      wikiDivider.appendChild(wikiTd);
      tbody.appendChild(wikiDivider);

      // Add copy handler for wiki section
      const copyWikiBtn = wikiTd.querySelector('.copy-section-btn');
      if (copyWikiBtn) {
        copyWikiBtn.addEventListener('click', () => {
          copyCategoryData(categoryData, categoryName + ' (Wikipedia)', 'wiki');
        });
      }

      categoryData.wikiOnly.forEach(item => {
        tbody.appendChild(createComparisonRow(item, 'wiki-only'));
      });
    }

    // Section: IMDB ONLY
    if (categoryData.imdbOnly.length > 0) {
      const imdbDivider = document.createElement('tr');
      imdbDivider.className = 'section-divider';
      const imdbTd = document.createElement('td');
      imdbTd.colSpan = 4;
      imdbTd.innerHTML = `
        <div class="divider-content">
          <span>IMDB ONLY (${categoryData.imdbOnly.length})</span>
          <button class="copy-section-btn" title="Copy IMDb entries">📋 Copy</button>
        </div>
      `;
      imdbDivider.appendChild(imdbTd);
      tbody.appendChild(imdbDivider);

      // Add copy handler for imdb section
      const copyImdbBtn = imdbTd.querySelector('.copy-section-btn');
      if (copyImdbBtn) {
        copyImdbBtn.addEventListener('click', () => {
          copyCategoryData(categoryData, categoryName + ' (IMDb)', 'imdb');
        });
      }

      categoryData.imdbOnly.forEach(item => {
        tbody.appendChild(createComparisonRow(item, 'imdb-only'));
      });
    }

    table.appendChild(tbody);

    if (tbody.children.length === 0) {
      section.innerHTML += '<div class="empty-category">No data in this category</div>';
    } else {
      section.appendChild(table);
    }

    return section;
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
   * Switch to Wikipedia customized view
   */
  function switchToWikipediaView() {
    console.log('switchToWikipediaView called');

    if (!comparisonData || !comparisonData.sourceA) {
      alert('Wikipedia data not available');
      return;
    }

    // Convert Wikipedia data to flat format
    const flatData = convertWikipediaDataToViewFormat(comparisonData.sourceA);
    console.log('Wikipedia flatData length:', flatData.length);

    if (flatData.length === 0) {
      alert('No Wikipedia data to display');
      return;
    }

    // Clear conflicting IMDb consolidated keys first, then set Wikipedia data
    chrome.storage.local.remove([
      'consolidatedViewData_fullcredits',
      'consolidatedViewData_companycredits',
      'consolidatedViewData_awards',
      'consolidatedViewData_releaseinfo',
      'consolidatedViewData_technical',
      'consolidatedViewData_title',
      'consolidatedViewMovieId'
    ], () => {
      // Store Wikipedia data for the customized view page
      chrome.storage.local.set({
        'customized-view-temp': {
          data: flatData,
          source: 'Wikipedia',
          title: sourceA,
          columns: ['name', 'role', 'roleType'],
          pageSource: 'Wikipedia'
        }
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error storing Wikipedia data:', chrome.runtime.lastError);
          alert('Error storing data: ' + chrome.runtime.lastError.message);
          return;
        }
        // Open customized view page
        const viewUrl = chrome.runtime.getURL('consolidated-view-page.html?source=wikipedia');
        window.location.href = viewUrl;
      });
    });
  }

  /**
   * Switch to IMDb consolidated view
   */
  function switchToIMDbView() {
    console.log('switchToIMDbView called');

    if (!comparisonData || !comparisonData.sourceB) {
      alert('IMDb data not available');
      return;
    }

    const imdbData = comparisonData.sourceB;
    console.log('IMDb fullcredits length:', (imdbData.fullcredits || []).length);

    // Clear conflicting Wikipedia single-view key first, then set IMDb data
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
        if (chrome.runtime.lastError) {
          console.error('Error storing IMDb data:', chrome.runtime.lastError);
          alert('Error storing data: ' + chrome.runtime.lastError.message);
          return;
        }
        // Open consolidated view page
        const viewUrl = chrome.runtime.getURL('consolidated-view-page.html?source=comparison');
        window.location.href = viewUrl;
      });
    });
  }

  /**
   * Setup navigation button event listeners (CSP-compliant)
   */
  function setupNavigationListeners() {
    const wikiBtn = document.getElementById('nav-wiki');
    const imdbBtn = document.getElementById('nav-imdb');

    if (wikiBtn) {
      wikiBtn.addEventListener('click', switchToWikipediaView);
    }

    if (imdbBtn) {
      imdbBtn.addEventListener('click', switchToIMDbView);
    }
  }

  /**
   * Initialize theme on page load
   */
  async function initializeTheme() {
    try {
      if (typeof ThemeManager !== 'undefined') {
        await ThemeManager.initialize();
        console.log('Comparison View: Theme initialized');
      } else {
        console.warn('Comparison View: ThemeManager not available');
      }
    } catch (error) {
      console.error('Comparison View: Error initializing theme:', error);
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

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await initializeTheme();
      setupThemeListeners();
      setupNavigationListeners();
      await renderComparison();
    });
  } else {
    (async () => {
      await initializeTheme();
      setupThemeListeners();
      setupNavigationListeners();
      await renderComparison();
    })();
  }
})();
