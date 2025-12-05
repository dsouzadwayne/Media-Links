// Apple TV+ Customized View Page Script

(function() {
  'use strict';

  let viewData = null;
  let filteredItems = [];
  let currentFilter = 'all';
  let searchQuery = '';

  /**
   * Initialize the page
   */
  async function initialize() {
    // Initialize theme
    try {
      if (typeof ThemeManager !== 'undefined') {
        await ThemeManager.initialize();
      }
    } catch (e) {
      console.warn('ThemeManager not available:', e);
    }

    // Get view ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('id');

    if (!viewId) {
      showError('No view ID provided');
      return;
    }

    // Load data from storage
    try {
      const storageKey = `customizedView_${viewId}`;
      const result = await chrome.storage.local.get([storageKey]);
      viewData = result[storageKey];

      if (!viewData) {
        showError('View data not found. It may have expired.');
        return;
      }

      // Clean up storage after loading
      chrome.storage.local.remove([storageKey]);

      // Render the page
      renderPage();
      setupEventListeners();

    } catch (error) {
      console.error('Error loading view data:', error);
      showError('Failed to load view data: ' + error.message);
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    document.getElementById('show-title').textContent = 'Error';
    document.getElementById('content').innerHTML = `
      <div class="section" style="grid-column: 1 / -1;">
        <div class="empty-state">
          <p style="color: #f44336; font-weight: 600;">${escapeHtml(message)}</p>
          <p style="margin-top: 12px;">
            <a href="#" id="close-tab-link" style="color: var(--accent-color);">Close this tab</a>
          </p>
        </div>
      </div>
    `;

    // Add click handler for close link
    const closeLink = document.getElementById('close-tab-link');
    if (closeLink) {
      closeLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.close();
      });
    }
  }

  /**
   * Render the page with data
   */
  function renderPage() {
    // Set title
    document.getElementById('show-title').textContent = viewData.title || 'Unknown Show';
    document.title = `${viewData.title} - Apple TV+ Customized View`;

    // Set metadata
    const metadataEl = document.getElementById('metadata');
    const meta = viewData.metadata || {};
    let metadataHtml = '';

    if (meta.year) {
      metadataHtml += `<span>📅 ${meta.year}</span>`;
    }
    if (meta.rating) {
      metadataHtml += `<span>🎬 ${meta.rating}</span>`;
    }
    if (meta.runtime) {
      metadataHtml += `<span>⏱️ ${meta.runtime}</span>`;
    }
    if (meta.genres && meta.genres.length > 0) {
      metadataHtml += `<span>🏷️ ${meta.genres.join(', ')}</span>`;
    }
    if (viewData.url) {
      metadataHtml += `<span><a href="${viewData.url}" target="_blank" style="color: var(--accent-color);">View on Apple TV+</a></span>`;
    }

    metadataEl.innerHTML = metadataHtml;

    // Generate dynamic filter buttons based on available role types
    generateFilterButtons();

    // Apply filters and render content
    applyFiltersAndRender();
  }

  /**
   * Generate filter buttons dynamically based on available role types
   */
  function generateFilterButtons() {
    const filterGroup = document.getElementById('filter-group');
    if (!filterGroup || !viewData || !viewData.items) return;

    // Get unique role types from data
    const roleTypes = new Set();
    viewData.items.forEach(item => {
      if (item.roleType) {
        roleTypes.add(item.roleType);
      }
    });

    // Define the order for filter buttons (matching section order)
    const filterOrder = [
      'Episodes',
      'Cast',
      'Creators',
      'Directors',
      'Producers',
      'Writers',
      'Writers Screenplay',
      'Executive Producers',
      'Music',
      'Cinematography',
      'Editors'
    ];

    // Build filter buttons HTML
    let buttonsHtml = '<button class="filter-btn active" data-filter="all">All</button>';

    // Add buttons in order for types that exist
    filterOrder.forEach(type => {
      if (roleTypes.has(type)) {
        buttonsHtml += `<button class="filter-btn" data-filter="${type}">${type}</button>`;
      }
    });

    // Add any remaining types not in the predefined order
    roleTypes.forEach(type => {
      if (!filterOrder.includes(type)) {
        buttonsHtml += `<button class="filter-btn" data-filter="${type}">${type}</button>`;
      }
    });

    filterGroup.innerHTML = buttonsHtml;

    // Re-attach click handlers
    filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFiltersAndRender();
      });
    });
  }

  /**
   * Apply current filters and render content
   */
  function applyFiltersAndRender() {
    if (!viewData || !viewData.items) {
      filteredItems = [];
    } else {
      filteredItems = viewData.items.filter(item => {
        // Apply role type filter
        if (currentFilter !== 'all' && item.roleType !== currentFilter) {
          return false;
        }

        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const nameMatch = (item.name || '').toLowerCase().includes(query);
          const roleMatch = (item.role || '').toLowerCase().includes(query);
          const descMatch = (item.description || '').toLowerCase().includes(query);
          return nameMatch || roleMatch || descMatch;
        }

        return true;
      });

      // Apply role filters if available
      if (typeof RoleFilters !== 'undefined' && RoleFilters.filterExcludedRoles) {
        filteredItems = RoleFilters.filterExcludedRoles(filteredItems);
      }
    }

    renderContent();
  }

  /**
   * Render content sections
   */
  function renderContent() {
    const contentEl = document.getElementById('content');

    // Group items by roleType
    const groups = {};
    filteredItems.forEach(item => {
      const type = item.roleType || 'Other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
    });

    // Define section order as requested
    const sectionOrder = [
      'Episodes',
      'Cast',
      'Creators',
      'Directors',
      'Producers',
      'Writers',
      'Writers Screenplay',
      'Executive Producers',
      'Music',
      'Cinematography',
      'Editors',
      'Other'
    ];

    let html = '';

    // First render sections in defined order
    sectionOrder.forEach(sectionType => {
      const items = groups[sectionType];
      if (!items || items.length === 0) return;

      html += renderSection(sectionType, items);
    });

    // Then render any remaining sections not in the predefined order
    Object.keys(groups).forEach(sectionType => {
      if (!sectionOrder.includes(sectionType)) {
        const items = groups[sectionType];
        if (items && items.length > 0) {
          html += renderSection(sectionType, items);
        }
      }
    });

    if (html === '') {
      html = `
        <div class="section" style="grid-column: 1 / -1;">
          <div class="empty-state">
            <p>No items match your current filters.</p>
          </div>
        </div>
      `;
    }

    contentEl.innerHTML = html;

    // Add click handlers for items
    document.querySelectorAll('.item-row').forEach(row => {
      row.addEventListener('click', () => {
        const text = row.dataset.copyText;
        if (text) {
          copyToClipboard(text);
        }
      });
    });

    // Add click handlers for section copy buttons
    document.querySelectorAll('.copy-section-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sectionType = btn.dataset.section;
        copySection(sectionType);
      });
    });
  }

  /**
   * Render a single section
   */
  function renderSection(sectionType, items) {
    return `
      <div class="section" data-section="${sectionType}">
        <div class="section-header">
          <h2>
            ${getSectionIcon(sectionType)} ${sectionType}
            <span class="count">${items.length}</span>
          </h2>
          <button class="copy-section-btn copy-all-btn" data-section="${sectionType}" style="padding: 6px 12px; font-size: 12px;">
            📋 Copy
          </button>
        </div>
        <div class="section-content">
          ${items.map(item => renderItem(item, sectionType)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get section icon
   */
  function getSectionIcon(sectionType) {
    const icons = {
      'Episodes': '📺',
      'Cast': '🎭',
      'Creators': '✨',
      'Directors': '🎬',
      'Producers': '🎥',
      'Writers': '✍️',
      'Writers Screenplay': '📝',
      'Executive Producers': '💼',
      'Music': '🎵',
      'Cinematography': '📷',
      'Editors': '✂️',
      'Other': '📋'
    };
    return icons[sectionType] || '📋';
  }

  /**
   * Render a single item
   */
  function renderItem(item, sectionType) {
    if (sectionType === 'Episodes') {
      const copyText = `${item.name}: ${item.role || ''}`.trim();
      return `
        <div class="item-row episode" data-copy-text="${escapeHtml(copyText)}">
          <div class="episode-num">${extractEpisodeNum(item.name)}</div>
          <div>
            <div class="name">${escapeHtml(extractEpisodeTitle(item.name))}</div>
            ${item.role ? `<div class="description">${escapeHtml(item.role)}</div>` : ''}
            ${item.duration ? `<div class="duration">⏱️ ${escapeHtml(item.duration)}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      const copyText = item.role ? `${item.name}:${item.role}` : item.name;
      return `
        <div class="item-row" data-copy-text="${escapeHtml(copyText)}">
          <div></div>
          <div>
            <div class="name">${escapeHtml(item.name)}</div>
            ${item.role ? `<div class="role">${escapeHtml(item.role)}</div>` : ''}
          </div>
        </div>
      `;
    }
  }

  /**
   * Extract episode number from name like "E1: Title"
   */
  function extractEpisodeNum(name) {
    const match = name.match(/^E(\d+)/i);
    return match ? `E${match[1]}` : '';
  }

  /**
   * Extract episode title from name like "E1: Title"
   */
  function extractEpisodeTitle(name) {
    return name.replace(/^E\d+:\s*/, '');
  }

  /**
   * Escape HTML special characters
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = e.target.value.trim();
        applyFiltersAndRender();
      }, 200);
    });

    // Note: Filter buttons are set up dynamically in generateFilterButtons()

    // Copy all button
    document.getElementById('copy-all-btn').addEventListener('click', showCopyDialog);
  }

  /**
   * Show copy dialog
   */
  function showCopyDialog() {
    const backdrop = document.createElement('div');
    backdrop.className = 'copy-dialog-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'copy-dialog';

    dialog.innerHTML = `
      <h3>📋 Copy ${filteredItems.length} Items</h3>

      <label>Content Type:</label>
      <select id="copy-content-type">
        <option value="all">Episodes + Cast (current filter)</option>
        <option value="episodes-only">Episodes only</option>
        <option value="cast-only">Cast only</option>
      </select>

      <label>Episode Format:</label>
      <select id="copy-episode-format">
        <option value="num-desc">Episode Number + Description</option>
        <option value="num-title-desc">Episode Number + Title + Description</option>
        <option value="num-title">Episode Number + Title only</option>
        <option value="title-only">Title only</option>
      </select>

      <label>Cast Format:</label>
      <select id="copy-cast-format">
        <option value="name-role">Name:Role</option>
        <option value="name-only">Name only</option>
        <option value="role-only">Role only</option>
      </select>

      <label>Output Format:</label>
      <select id="copy-output-format">
        <option value="newline">One per line</option>
        <option value="comma">Comma separated</option>
        <option value="json">JSON Array</option>
      </select>

      <div class="button-group">
        <button class="copy-btn" id="dialog-copy-btn">Copy</button>
        <button class="cancel-btn" id="dialog-cancel-btn">Cancel</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Event handlers
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
      }
    });

    document.getElementById('dialog-cancel-btn').addEventListener('click', () => {
      backdrop.remove();
    });

    document.getElementById('dialog-copy-btn').addEventListener('click', () => {
      const contentType = document.getElementById('copy-content-type').value;
      const episodeFormat = document.getElementById('copy-episode-format').value;
      const castFormat = document.getElementById('copy-cast-format').value;
      const outputFormat = document.getElementById('copy-output-format').value;

      copyAllItems(contentType, episodeFormat, castFormat, outputFormat);
      backdrop.remove();
    });
  }

  /**
   * Copy all items with specified format
   */
  function copyAllItems(contentType, episodeFormat, castFormat, outputFormat) {
    let itemsToCopy = filteredItems;

    // Filter by content type
    if (contentType === 'episodes-only') {
      itemsToCopy = filteredItems.filter(i => i.roleType === 'Episodes');
    } else if (contentType === 'cast-only') {
      itemsToCopy = filteredItems.filter(i => i.roleType === 'Cast');
    }

    if (itemsToCopy.length === 0) {
      showNotification('No items to copy', true);
      return;
    }

    // Format items
    const formattedItems = itemsToCopy.map(item => {
      if (item.roleType === 'Episodes') {
        const epNum = extractEpisodeNum(item.name);
        const epTitle = extractEpisodeTitle(item.name);
        const desc = item.role || '';

        switch (episodeFormat) {
          case 'num-desc':
            return `${epNum}: ${desc}`;
          case 'num-title-desc':
            return `${epNum}: ${epTitle} - ${desc}`;
          case 'num-title':
            return `${epNum}: ${epTitle}`;
          case 'title-only':
            return epTitle;
          default:
            return `${epNum}: ${desc}`;
        }
      } else {
        switch (castFormat) {
          case 'name-role':
            return item.role ? `${item.name}:${item.role}` : item.name;
          case 'name-only':
            return item.name;
          case 'role-only':
            return item.role || '';
          default:
            return item.role ? `${item.name}:${item.role}` : item.name;
        }
      }
    }).filter(text => text.trim());

    // Format output
    let output = '';
    switch (outputFormat) {
      case 'newline':
        output = formattedItems.join('\n');
        break;
      case 'comma':
        output = formattedItems.join(', ');
        break;
      case 'json':
        output = JSON.stringify(formattedItems, null, 2);
        break;
      default:
        output = formattedItems.join('\n');
    }

    copyToClipboard(output, `Copied ${formattedItems.length} items!`);
  }

  /**
   * Copy a specific section
   */
  function copySection(sectionType) {
    const items = filteredItems.filter(i => i.roleType === sectionType);

    if (items.length === 0) {
      showNotification('No items to copy', true);
      return;
    }

    const formattedItems = items.map(item => {
      if (sectionType === 'Episodes') {
        return `${item.name}: ${item.role || ''}`.trim();
      } else {
        return item.role ? `${item.name}:${item.role}` : item.name;
      }
    });

    copyToClipboard(formattedItems.join('\n'), `Copied ${items.length} ${sectionType}!`);
  }

  /**
   * Copy text to clipboard
   */
  function copyToClipboard(text, message = 'Copied!') {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(message);
    }).catch(err => {
      console.error('Failed to copy:', err);
      showNotification('Failed to copy', true);
    });
  }

  /**
   * Show notification
   */
  function showNotification(message, isError = false) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification${isError ? ' error' : ''}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
