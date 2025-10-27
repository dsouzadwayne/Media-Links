// Comparison View Page Script
// Displays comparison results between Wikipedia and IMDb data

(function() {
  'use strict';

  let comparisonData = null;
  let sourceA = '';
  let sourceB = '';

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
      const comparison = comparisonData.comparison;

      const categories = ['directors', 'producers', 'writers', 'cast', 'production', 'runtime', 'countries', 'languages', 'releaseDate'];
      let hasContent = false;

      categories.forEach(categoryKey => {
        const categoryData = comparison[categoryKey];
        if (categoryData && (categoryData.same.length > 0 || categoryData.sourceA.unique.length > 0 || categoryData.sourceB.unique.length > 0 || categoryData.different.length > 0)) {
          const categoryElement = renderCategory(categoryData);
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
   * Calculate summary statistics
   */
  function calculateSummary(comparison) {
    let totalSame = 0;
    let totalDifferent = 0;
    let totalUniqueA = 0;
    let totalUniqueB = 0;

    Object.values(comparison).forEach(category => {
      if (category) {
        totalSame += (category.same || []).length;
        totalDifferent += (category.different || []).length;
        totalUniqueA += (category.sourceA?.unique || []).length;
        totalUniqueB += (category.sourceB?.unique || []).length;
      }
    });

    return { totalSame, totalDifferent, totalUniqueA, totalUniqueB };
  }

  /**
   * Render summary statistics
   */
  function renderSummary(summaryDiv, summary) {
    summaryDiv.innerHTML = `
      <div class="summary-item">
        <div class="summary-value" style="color: #22c55e;">✓</div>
        <div class="summary-label">Matching Data</div>
        <div class="summary-value" style="color: #22c55e;">${summary.totalSame}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #f97316;">⚠</div>
        <div class="summary-label">Different Values</div>
        <div class="summary-value" style="color: #f97316;">${summary.totalDifferent}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #3b82f6;">+</div>
        <div class="summary-label">Only in ${sourceA}</div>
        <div class="summary-value" style="color: #3b82f6;">${summary.totalUniqueA}</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: #ef4444;">+</div>
        <div class="summary-label">Only in ${sourceB}</div>
        <div class="summary-value" style="color: #ef4444;">${summary.totalUniqueB}</div>
      </div>
    `;
  }

  /**
   * Render individual category section
   */
  function renderCategory(categoryData) {
    const section = document.createElement('div');
    section.className = 'category-section';

    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = `👥 ${categoryData.category}`;

    const stats = document.createElement('div');
    stats.className = 'category-stats';

    if (categoryData.same.length > 0) {
      const sameStat = document.createElement('div');
      sameStat.className = 'stat stat-same';
      sameStat.innerHTML = `✓ ${categoryData.same.length} Same`;
      stats.appendChild(sameStat);
    }

    if (categoryData.different.length > 0) {
      const diffStat = document.createElement('div');
      diffStat.className = 'stat stat-different';
      diffStat.innerHTML = `⚠ ${categoryData.different.length} Different`;
      stats.appendChild(diffStat);
    }

    if (categoryData.sourceA.unique.length > 0) {
      const uniqueAStat = document.createElement('div');
      uniqueAStat.className = 'stat stat-unique-a';
      uniqueAStat.innerHTML = `+ ${categoryData.sourceA.unique.length} Only in ${sourceA}`;
      stats.appendChild(uniqueAStat);
    }

    if (categoryData.sourceB.unique.length > 0) {
      const uniqueBStat = document.createElement('div');
      uniqueBStat.className = 'stat stat-unique-b';
      uniqueBStat.innerHTML = `+ ${categoryData.sourceB.unique.length} Only in ${sourceB}`;
      stats.appendChild(uniqueBStat);
    }

    header.appendChild(title);
    header.appendChild(stats);
    section.appendChild(header);

    // Create table
    const table = document.createElement('table');
    table.className = 'comparison-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th style="width: 25%;">Entry</th>
      <th style="width: 25%;">${sourceA}</th>
      <th style="width: 25%;">${sourceB}</th>
      <th style="width: 25%;">Status</th>
    `;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Add matching entries
    categoryData.same.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'row-same';
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>${item.role}</td>
        <td>${item.role}</td>
        <td><span class="status-badge status-same">✓ Match</span></td>
      `;
      tbody.appendChild(row);
    });

    // Add different entries
    categoryData.different.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'row-different';
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>${item[sourceA] || '—'}</td>
        <td>${item[sourceB] || '—'}</td>
        <td><span class="status-badge status-different">⚠ Different</span></td>
      `;
      tbody.appendChild(row);
    });

    // Add unique to source A
    categoryData.sourceA.unique.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'row-unique';
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>${item.role}</td>
        <td>—</td>
        <td><span class="status-badge status-missing">+ Only in ${sourceA}</span></td>
      `;
      tbody.appendChild(row);
    });

    // Add unique to source B
    categoryData.sourceB.unique.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'row-unique';
      row.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td>—</td>
        <td>${item.role}</td>
        <td><span class="status-badge status-missing">+ Only in ${sourceB}</span></td>
      `;
      tbody.appendChild(row);
    });

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
  window.switchToWikipediaView = function() {
    if (!comparisonData || !comparisonData.sourceA) {
      alert('Wikipedia data not available');
      return;
    }

    // Convert Wikipedia data to flat format
    const flatData = convertWikipediaDataToViewFormat(comparisonData.sourceA);

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
      // Open customized view page
      const viewUrl = chrome.runtime.getURL('consolidated-view-page.html?source=wikipedia');
      window.location.href = viewUrl;
    });
  };

  /**
   * Switch to IMDb consolidated view
   */
  window.switchToIMDbView = function() {
    if (!comparisonData || !comparisonData.sourceB) {
      alert('IMDb data not available');
      return;
    }

    // Store IMDb consolidated data for the consolidated view page
    // The consolidated view page expects data in consolidated storage keys
    const imdbData = comparisonData.sourceB;

    chrome.storage.local.set({
      'consolidatedViewData_fullcredits': imdbData.fullcredits || [],
      'consolidatedViewData_companycredits': imdbData.companycredits || [],
      'consolidatedViewData_awards': imdbData.awards || [],
      'consolidatedViewData_releaseinfo': imdbData.releaseinfo || [],
      'consolidatedViewData_technical': imdbData.technical || [],
      'consolidatedViewMovieId': 'comparison-view'
    }, () => {
      // Open consolidated view page
      const viewUrl = chrome.runtime.getURL('consolidated-view-page.html?source=comparison');
      window.location.href = viewUrl;
    });
  };

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderComparison);
  } else {
    renderComparison();
  }
})();
