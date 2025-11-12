// Customized Views System
// Provides reusable view creation, filtering, searching, and copying functionality

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
    console.log('Extension context invalidated, skipping customized views');
    return;
  }

  // Helper function to sanitize storage keys
  function sanitizeStorageKey(key) {
    // Only allow alphanumeric, dash, underscore, forward slash, and dot
    // This prevents injection attacks
    return key.replace(/[^a-zA-Z0-9_\-.\/]/g, '_');
  }

  // CustomizedView class - manages a single view
  class CustomizedView {
    constructor(options = {}) {
      this.containerId = options.containerId || 'customized-view-container';
      this.data = options.data || [];
      this.title = options.title || 'Cast & Crew';
      this.columns = options.columns || ['name', 'role'];
      this.pagePath = options.pagePath || window.location.pathname;

      // Filter state
      this.searchQuery = '';
      this.selectedRoles = new Set(this.getAvailableRoles());

      // Storage key for preferences - sanitize pagePath to prevent injection
      this.storageKey = `view-prefs-${sanitizeStorageKey(this.pagePath)}`;

      // Set up MutationObserver to clean up removed dropdowns
      this.setupDropdownCleanupObserver();
    }

    /**
     * Set up MutationObserver to clean up event listeners when dropdowns are removed
     */
    setupDropdownCleanupObserver() {
      if (this.dropdownObserver) {
        return; // Already set up
      }

      this.dropdownObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the removed node or its children have dropdowns
              const dropdowns = node.querySelectorAll ?
                node.querySelectorAll('[data-copy-dropdown]') : [];

              dropdowns.forEach(dropdown => {
                if (dropdown._cleanup && typeof dropdown._cleanup === 'function') {
                  dropdown._cleanup();
                }
              });

              // Also check if the node itself is a dropdown
              if (node.hasAttribute && node.hasAttribute('data-copy-dropdown')) {
                if (node._cleanup && typeof node._cleanup === 'function') {
                  node._cleanup();
                }
              }
            }
          });
        });
      });

      // Start observing when DOM is ready
      if (document.body) {
        this.dropdownObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }

    /**
     * Clean up observer when view is destroyed
     */
    destroy() {
      if (this.dropdownObserver) {
        this.dropdownObserver.disconnect();
        this.dropdownObserver = null;
      }
    }

    /**
     * Define role type order
     */
    getRoleTypeOrder() {
      return ['Creators', 'Directors', 'Producers', 'Writers', 'Writers Screenplay', 'Executive Producers', 'Cast', 'Production Companies', 'Runtime', 'Countries', 'Languages', 'Release Date'];
    }

    /**
     * Get all unique roles from the data
     */
    getAvailableRoles() {
      const roles = new Set();
      this.data.forEach(item => {
        if (item.roleType) {
          roles.add(item.roleType);
        }
      });
      return Array.from(roles);
    }

    /**
     * Group data by role type in specified order
     */
    getGroupedData() {
      const roleOrder = this.getRoleTypeOrder();
      const grouped = {};

      // Initialize groups
      roleOrder.forEach(role => {
        grouped[role] = [];
      });

      // Distribute data into groups
      this.data.forEach(item => {
        const roleType = item.roleType || 'Other';
        if (!grouped[roleType]) {
          grouped[roleType] = [];
        }
        grouped[roleType].push(item);
      });

      // Filter by selected roles and search
      const filteredGrouped = {};

      // Process predefined role types first (in order)
      roleOrder.forEach(role => {
        if (this.selectedRoles.has(role)) {
          const filtered = grouped[role].filter(item => {
            if (this.searchQuery.trim()) {
              const query = this.searchQuery.toLowerCase();
              return (
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.role && item.role.toLowerCase().includes(query))
              );
            }
            return true;
          });

          if (filtered.length > 0) {
            filteredGrouped[role] = filtered;
          }
        }
      });

      // Also process any other role types not in the predefined list (e.g., company types)
      Object.keys(grouped).forEach(role => {
        if (!roleOrder.includes(role) && this.selectedRoles.has(role)) {
          const filtered = grouped[role].filter(item => {
            if (this.searchQuery.trim()) {
              const query = this.searchQuery.toLowerCase();
              return (
                (item.name && item.name.toLowerCase().includes(query)) ||
                (item.role && item.role.toLowerCase().includes(query))
              );
            }
            return true;
          });

          if (filtered.length > 0) {
            filteredGrouped[role] = filtered;
          }
        }
      });

      return filteredGrouped;
    }

    /**
     * Filter data based on search and role selection
     */
    getFilteredData() {
      return this.data.filter(item => {
        // Check role filter
        if (!this.selectedRoles.has(item.roleType)) {
          return false;
        }

        // Check search filter
        if (this.searchQuery.trim()) {
          const query = this.searchQuery.toLowerCase();
          return (
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.role && item.role.toLowerCase().includes(query))
          );
        }

        return true;
      });
    }

    /**
     * Save view preferences to storage
     * Note: We don't save columns anymore - they're controlled by settings
     */
    savePreferences() {
      return new Promise((resolve) => {
        try {
          if (!isExtensionContextValid()) {
            resolve(false);
            return;
          }

          const prefs = {
            selectedRoles: Array.from(this.selectedRoles),
            pagePath: this.pagePath,
            timestamp: Date.now()
          };

          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ [this.storageKey]: prefs }, () => {
              if (chrome.runtime.lastError) {
                console.warn('Error saving view preferences:', chrome.runtime.lastError);
                resolve(false);
              } else {
                resolve(true);
              }
            });
          } else {
            resolve(false);
          }
        } catch (error) {
          console.warn('Error saving view preferences:', error);
          resolve(false);
        }
      });
    }

    /**
     * Load view preferences from storage
     */
    loadPreferences() {
      return new Promise((resolve) => {
        try {
          if (!isExtensionContextValid()) {
            resolve(null);
            return;
          }

          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get([this.storageKey], (result) => {
              if (chrome.runtime.lastError) {
                console.warn('Error loading view preferences:', chrome.runtime.lastError);
                resolve(null);
              } else {
                resolve(result[this.storageKey] || null);
              }
            });
          } else {
            resolve(null);
          }
        } catch (error) {
          console.warn('Error loading view preferences:', error);
          resolve(null);
        }
      });
    }

    /**
     * Apply loaded preferences
     * Note: Columns are now controlled by settings, not saved preferences
     */
    applyPreferences(prefs) {
      if (prefs) {
        // Don't apply columns from saved preferences anymore - use settings instead
        if (prefs.selectedRoles && prefs.selectedRoles.length > 0) {
          this.selectedRoles = new Set(prefs.selectedRoles);
        }
      }
    }

    /**
     * Check if extension context is valid
     */
    isExtensionContextValid() {
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
     * Open the view in a new tab
     */
    openInNewTab() {
      try {
        // Check if extension context is still valid
        if (!this.isExtensionContextValid()) {
          alert('Extension context has been invalidated. Please reload the page and try again.');
          console.warn('Extension context invalid when trying to open view in new tab');
          return;
        }

        // Prepare view data
        const viewData = {
          data: this.data,
          title: this.title,
          columns: Array.from(this.columns),
          pagePath: this.pagePath,
          pageSource: window.location.hostname + window.location.pathname,
          timestamp: Date.now()
        };

        // Use Chrome storage API to persist data across tabs
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ 'customized-view-temp': viewData }, () => {
            // Check if context is still valid after async operation
            if (!this.isExtensionContextValid()) {
              console.warn('Extension context invalidated during storage operation');
              alert('Extension context was lost. Please reload the page and try again.');
              return;
            }

            if (chrome.runtime.lastError) {
              console.error('Error saving view data:', chrome.runtime.lastError);
              alert('Failed to save view data. Please try again.');
              return;
            }

            // Open the consolidated view page in a new tab (handles both single and consolidated views)
            try {
              const extensionUrl = chrome.runtime.getURL('consolidated-view-page.html');
              window.open(extensionUrl, '_blank');
            } catch (urlError) {
              console.error('Error getting extension URL:', urlError);
              alert('Failed to open new tab. Please try again.');
            }
          });
        } else {
          console.error('Chrome storage API not available');
          alert('Chrome storage API not available. Please reload the extension.');
        }
      } catch (error) {
        console.error('Error opening view in new tab:', error);
        alert('Failed to open view in new tab: ' + error.message);
      }
    }

    /**
     * Copy section data with format options
     */
    copySectionData(items, roleType, format) {
      // Comprehensive input validation
      if (!Array.isArray(items)) {
        console.error('copySectionData: items must be an array');
        alert('Invalid items data');
        return;
      }

      if (items.length === 0) {
        console.warn('copySectionData: empty items array');
        alert('No items to copy');
        return;
      }

      if (!roleType || typeof roleType !== 'string') {
        console.warn('copySectionData: invalid roleType:', roleType);
        roleType = 'Unknown';
      }

      if (!format || typeof format !== 'string' || !['names', 'roles', 'names-roles', 'names-colon-roles'].includes(format)) {
        console.warn('copySectionData: invalid format:', format);
        format = 'names-roles'; // Default format
      }

      let text = '';
      let formatLabel = '';

      switch(format) {
        case 'names':
          text = items.map(item => item.name).join(',');
          formatLabel = 'names';
          break;
        case 'roles':
          text = items.map(item => item.role).join(',');
          formatLabel = 'roles';
          break;
        case 'names-roles':
          text = items.map(item => `${item.name} - ${item.role}`).join('\n');
          formatLabel = 'entries';
          break;
        case 'names-colon-roles':
          text = items.map(item => `${item.name}:${item.role}`).join(',');
          formatLabel = 'entries';
          break;
        default:
          text = items.map(item => `${item.name} - ${item.role}`).join('\n');
          formatLabel = 'entries';
      }

      navigator.clipboard.writeText(text).then(() => {
        this.showCopyNotification(`Copied ${items.length} ${roleType} ${formatLabel}`);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    }

    /**
     * Show a copy notification
     */
    showCopyNotification(text) {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'copy-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent);
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-break: break-word;
      `;

      // Helper function to escape HTML special characters to prevent XSS
      const escapeHtml = (str) => {
        const map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
      };

      const safeText = escapeHtml(text.substring(0, 50));
      notification.innerHTML = `✓ Copied: <span style="opacity: 0.9;">${safeText}${text.length > 50 ? '...' : ''}</span>`;

      // Add animation styles if not already in document
      if (!document.querySelector('style[data-copy-notification]')) {
        const style = document.createElement('style');
        style.setAttribute('data-copy-notification', 'true');
        style.textContent = `
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
        document.head.appendChild(style);
      }

      document.body.appendChild(notification);

      // Remove after 2 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 2000);
    }

    /**
     * Get display name for column header
     */
    getColumnDisplayName(col) {
      const displayNames = {
        'name': 'Name',
        'role': 'Award Body',
        'award': 'Award',
        'year': 'Year',
        'roleType': 'Role Type'
      };

      // Check if we're in a cast/crew context
      const castCrewRoleTypes = ['Cast', 'Directors', 'Producers', 'Writers', 'Writers Screenplay', 'Executive Producers', 'Creators'];
      const isCastCrew = this.data.some(item => castCrewRoleTypes.includes(item.roleType));
      if (isCastCrew && col === 'role') {
        return 'Role / Character';
      }

      // Check if we're in a technical specs context
      const isTechnical = this.data.some(item => item.roleType === 'Technical Specifications');
      if (isTechnical && col === 'name') {
        return 'Specification';
      } else if (isTechnical && col === 'role') {
        return 'Value';
      }

      // Check if we're in a release info context
      const isReleaseInfo = this.data.some(item => item.roleType === 'Release Dates');
      if (isReleaseInfo && col === 'name') {
        return 'Country';
      } else if (isReleaseInfo && col === 'role') {
        return 'Date';
      } else if (isReleaseInfo && col === 'award') {
        return 'Location';
      }

      // Check if we're in a production companies context
      const isProductionCompanies = this.data.some(item => item.roleType && item.roleType.toLowerCase().includes('production'));
      if (isProductionCompanies && col === 'role') {
        return 'Role';
      }

      return displayNames[col] || (col.charAt(0).toUpperCase() + col.slice(1));
    }

    /**
     * Load the customized view limit from settings
     */
    loadViewLimit() {
      return new Promise((resolve) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['customizedViewLimit'], (result) => {
              const limit = result.customizedViewLimit || 8;
              resolve(limit);
            });
          } else {
            resolve(8);
          }
        } catch (error) {
          console.warn('Error loading view limit:', error);
          resolve(8);
        }
      });
    }

    /**
     * Create the view container HTML
     */
    async render() {
      const filteredData = this.getFilteredData();
      const availableRoles = this.getAvailableRoles();
      const viewLimit = await this.loadViewLimit();

      // Create main container
      const container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'customized-view';
      container.style.cssText = `
        background: var(--secondary-bg);
        color: var(--text-primary);
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      `;

      // Header with title and controls
      const header = document.createElement('div');
      header.className = 'view-header';
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        gap: 15px;
        flex-wrap: wrap;
      `;

      // Title and button wrapper
      const titleAndBtn = document.createElement('div');
      titleAndBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
      `;

      // Title
      const title = document.createElement('h2');
      title.textContent = this.title;
      title.style.cssText = `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      `;
      titleAndBtn.appendChild(title);
      header.appendChild(titleAndBtn);

      // Controls wrapper
      const controls = document.createElement('div');
      controls.className = 'view-controls';
      controls.style.cssText = `
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      `;

      // Search input
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search names or roles...';
      searchInput.value = this.searchQuery;
      searchInput.className = 'view-search';
      searchInput.style.cssText = `
        padding: 8px 12px;
        border: 2px solid var(--hover-color);
        border-radius: 4px;
        background: var(--primary-bg);
        color: var(--text-primary);
        font-size: 13px;
        min-width: 200px;
        transition: all 0.2s;
      `;

      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        this.savePreferences();
      });

      controls.appendChild(searchInput);

      // Role filter dropdown
      const roleFilterDiv = document.createElement('div');
      roleFilterDiv.style.cssText = `
        display: flex;
        gap: 5px;
        align-items: center;
        flex-wrap: wrap;
      `;

      const roleLabel = document.createElement('label');
      roleLabel.textContent = 'Filter:';
      roleLabel.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
      `;
      roleFilterDiv.appendChild(roleLabel);

      availableRoles.forEach(role => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = role;
        checkbox.checked = this.selectedRoles.has(role);
        checkbox.className = 'role-filter-checkbox';
        checkbox.style.cssText = `
          cursor: pointer;
          margin-right: 3px;
        `;

        checkbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectedRoles.add(role);
          } else {
            this.selectedRoles.delete(role);
          }
          this.render();
          this.savePreferences();
        });

        const label = document.createElement('label');
        label.style.cssText = `
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-right: 10px;
        `;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(role));

        roleFilterDiv.appendChild(label);
      });

      controls.appendChild(roleFilterDiv);
      header.appendChild(controls);
      container.appendChild(header);

      // Get grouped data
      const groupedData = this.getGroupedData();
      const totalEntries = Object.values(groupedData).reduce((sum, group) => sum + group.length, 0);

      // Results counter
      const counter = document.createElement('div');
      counter.className = 'view-counter';
      counter.textContent = `Showing ${totalEntries} of ${this.data.length} entries`;
      counter.style.cssText = `
        font-size: 12px;
        color: var(--text-primary);
        margin-bottom: 15px;
        opacity: 0.8;
      `;
      container.appendChild(counter);

      // Create tables for each role type group
      const roleOrder = this.getRoleTypeOrder();
      const self = this; // Preserve 'this' context

      // Collect all role types: predefined first, then any custom ones
      const allRoleTypes = [];
      roleOrder.forEach(roleType => {
        if (groupedData[roleType] && groupedData[roleType].length > 0) {
          allRoleTypes.push(roleType);
        }
      });
      // Add any custom role types (like "Production Companies")
      Object.keys(groupedData).forEach(roleType => {
        if (!roleOrder.includes(roleType) && groupedData[roleType].length > 0) {
          allRoleTypes.push(roleType);
        }
      });

      allRoleTypes.forEach(roleType => {
        let groupItems = groupedData[roleType];

        // Skip if no items in this group
        if (!groupItems || groupItems.length === 0) {
          return;
        }

        // Apply view limit
        const displayItems = groupItems.slice(0, viewLimit);
        const totalItems = groupItems.length;
        const isLimited = totalItems > viewLimit;

        // Create section header for role type
        const sectionHeader = document.createElement('div');
        sectionHeader.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 25px;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid var(--accent);
          flex-wrap: wrap;
        `;

        const titleWrapper = document.createElement('div');
        titleWrapper.style.cssText = `
          display: flex;
          align-items: center;
          gap: 10px;
        `;

        const roleTypeIcon = document.createElement('span');
        roleTypeIcon.textContent = '👥';
        roleTypeIcon.style.cssText = `
          font-size: 18px;
        `;
        titleWrapper.appendChild(roleTypeIcon);

        const roleTypeTitle = document.createElement('h3');
        const countText = isLimited ? `${displayItems.length}/${totalItems}` : `${displayItems.length}`;
        roleTypeTitle.textContent = `${roleType} (${countText})`;
        roleTypeTitle.style.cssText = `
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--accent);
        `;
        titleWrapper.appendChild(roleTypeTitle);
        sectionHeader.appendChild(titleWrapper);

        // Create copy dropdown button for this section
        const copyDropdown = document.createElement('div');
        copyDropdown.setAttribute('data-copy-dropdown', 'true'); // Mark for cleanup
        copyDropdown.style.cssText = `
          position: relative;
          display: inline-block;
        `;

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy';
        copyBtn.style.cssText = `
          padding: 6px 12px;
          background: var(--accent);
          border: none;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        `;

        copyBtn.addEventListener('mouseenter', () => {
          copyBtn.style.opacity = '0.8';
          copyBtn.style.transform = 'translateY(-2px)';
        });

        copyBtn.addEventListener('mouseleave', () => {
          copyBtn.style.opacity = '1';
          copyBtn.style.transform = 'translateY(0)';
        });

        // Create dropdown menu
        const dropdownMenu = document.createElement('div');
        dropdownMenu.style.cssText = `
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--secondary-bg);
          border: 2px solid var(--accent);
          border-radius: 4px;
          min-width: 200px;
          display: none;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-top: 5px;
        `;

        const copyOptions = [
          { label: 'Names Only', format: 'names' },
          { label: 'Roles Only', format: 'roles' },
          { label: 'Names - Roles', format: 'names-roles' },
          { label: 'Names:Roles', format: 'names-colon-roles' }
        ];

        copyOptions.forEach(option => {
          const optionBtn = document.createElement('button');
          optionBtn.textContent = option.label;
          optionBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px 12px;
            background: transparent;
            border: none;
            text-align: left;
            color: var(--text-primary);
            font-size: 13px;
            cursor: pointer;
            transition: background-color 0.2s;
          `;

          optionBtn.addEventListener('mouseenter', () => {
            optionBtn.style.backgroundColor = 'var(--hover-color)';
          });

          optionBtn.addEventListener('mouseleave', () => {
            optionBtn.style.backgroundColor = 'transparent';
          });

          optionBtn.addEventListener('click', () => {
            self.copySectionData(displayItems, roleType, option.format);
            dropdownMenu.style.display = 'none';
          });

          dropdownMenu.appendChild(optionBtn);
        });

        // Track active handlers for this dropdown for proper cleanup
        const handlerTracking = { active: false, handler: null };

        // Create handler function with proper cleanup
        const createOutsideClickHandler = () => {
          return (e) => {
            if (!copyDropdown.contains(e.target)) {
              dropdownMenu.style.display = 'none';
              // Remove the listener when dropdown closes
              if (handlerTracking.handler) {
                document.removeEventListener('click', handlerTracking.handler);
                handlerTracking.active = false;
              }
            }
          };
        };

        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent immediate trigger of outsideClickHandler
          const isVisible = dropdownMenu.style.display !== 'none';
          dropdownMenu.style.display = isVisible ? 'none' : 'block';

          if (!isVisible) {
            // Add listener only when opening dropdown
            // Create and store the handler
            if (!handlerTracking.handler) {
              handlerTracking.handler = createOutsideClickHandler();
            }
            handlerTracking.active = true;
            // Use setTimeout to avoid immediate trigger from this click
            setTimeout(() => {
              if (handlerTracking.active) {
                document.addEventListener('click', handlerTracking.handler);
              }
            }, 0);
          } else {
            // Remove listener when closing dropdown
            if (handlerTracking.handler && handlerTracking.active) {
              document.removeEventListener('click', handlerTracking.handler);
              handlerTracking.active = false;
            }
          }
        });

        // Store cleanup function for this dropdown
        const cleanupDropdown = () => {
          if (handlerTracking.handler && handlerTracking.active) {
            document.removeEventListener('click', handlerTracking.handler);
            handlerTracking.active = false;
          }
        };

        // Store cleanup function on copyDropdown element for later cleanup
        copyDropdown._cleanup = cleanupDropdown;

        copyDropdown.appendChild(copyBtn);
        copyDropdown.appendChild(dropdownMenu);
        sectionHeader.appendChild(copyDropdown);
        container.appendChild(sectionHeader);

        // Table for this role type
        const table = document.createElement('table');
        table.className = 'customized-view-table';
        table.style.cssText = `
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 15px;
        `;

        // Table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.cssText = `
          border-bottom: 2px solid var(--accent);
          background-color: var(--secondary-bg);
        `;

        this.columns.forEach(col => {
          const th = document.createElement('th');
          th.textContent = this.getColumnDisplayName(col);
          th.style.cssText = `
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: var(--accent);
          `;
          headerRow.appendChild(th);
        });

        // Add action column for copy
        const actionTh = document.createElement('th');
        actionTh.textContent = 'Action';
        actionTh.style.cssText = `
          padding: 12px;
          text-align: center;
          font-weight: 600;
          color: var(--accent);
        `;
        headerRow.appendChild(actionTh);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = document.createElement('tbody');
        displayItems.forEach((item, index) => {
        const row = document.createElement('tr');
        row.style.cssText = `
          border-bottom: 1px solid var(--hover-color);
          transition: background-color 0.2s;
        `;

        row.addEventListener('mouseenter', () => {
          row.style.backgroundColor = 'var(--hover-color)';
        });

        row.addEventListener('mouseleave', () => {
          row.style.backgroundColor = 'transparent';
        });

        this.columns.forEach(col => {
          const td = document.createElement('td');
          const cellValue = item[col] || '-';
          td.textContent = cellValue;
          td.style.cssText = `
            padding: 10px 12px;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.2s;
            border-radius: 3px;
          `;

          // Add hover effects
          td.addEventListener('mouseenter', () => {
            td.style.backgroundColor = 'var(--accent)';
            td.style.color = 'white';
          });

          td.addEventListener('mouseleave', () => {
            td.style.backgroundColor = 'transparent';
            td.style.color = 'var(--text-primary)';
          });

          // Add click to copy
          td.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(cellValue).then(() => {
              // Show feedback
              td.style.backgroundColor = 'var(--accent)';
              td.style.color = 'white';

              // Show notification
              self.showCopyNotification(cellValue);

              setTimeout(() => {
                // Reset to transparent and original color
                td.style.backgroundColor = 'transparent';
                td.style.color = 'var(--text-primary)';
              }, 600);
            }).catch(err => {
              console.error('Failed to copy:', err);
            });
          });

          row.appendChild(td);
        });

        // Copy button
        const actionTd = document.createElement('td');
        actionTd.style.cssText = `
          padding: 10px 12px;
          text-align: center;
        `;

        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '📋';
        copyBtn.title = `Copy: ${item.name}:${item.role}`;
        copyBtn.style.cssText = `
          background: var(--accent);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        `;

        copyBtn.addEventListener('mouseenter', () => {
          copyBtn.style.opacity = '0.8';
          copyBtn.style.transform = 'scale(1.1)';
        });

        copyBtn.addEventListener('mouseleave', () => {
          copyBtn.style.opacity = '1';
          copyBtn.style.transform = 'scale(1)';
        });

        copyBtn.addEventListener('click', () => {
          const text = `${item.name}:${item.role}`;
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '✓';
            self.showCopyNotification(text);
            setTimeout(() => {
              copyBtn.innerHTML = '📋';
            }, 1000);
          }).catch(err => {
            console.error('Failed to copy:', err);
            copyBtn.innerHTML = '✗';
            setTimeout(() => {
              copyBtn.innerHTML = '📋';
            }, 1000);
          });
        });

        actionTd.appendChild(copyBtn);
        row.appendChild(actionTd);
        tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.appendChild(table);
      });

      // If no results
      if (totalEntries === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = 'No results found';
        noResults.style.cssText = `
          padding: 40px;
          text-align: center;
          color: var(--text-primary);
          font-size: 14px;
        `;
        container.appendChild(noResults);
      }

      // Replace existing container or insert new
      const existingContainer = document.getElementById(this.containerId);
      if (existingContainer) {
        // Clean up event listeners from the old container before removing it
        const dropdowns = existingContainer.querySelectorAll('[data-copy-dropdown]');
        dropdowns.forEach(dropdown => {
          if (dropdown._cleanup && typeof dropdown._cleanup === 'function') {
            dropdown._cleanup();
          }
        });

        // Now safely replace the container
        try {
          if (existingContainer.parentNode) {
            existingContainer.parentNode.replaceChild(container, existingContainer);
          } else {
            // Fallback: parent doesn't exist, just append
            console.warn('Container parent not found, appending instead');
            document.body.appendChild(container);
          }
        } catch (error) {
          console.error('Error replacing container:', error);
          // Fallback: append if replace fails
          if (document.body) {
            document.body.appendChild(container);
          }
        }
      } else {
        // First render: append instead of replace
        if (document.body) {
          document.body.appendChild(container);
        }
      }

      return container;
    }
  }

  // Export to global scope
  window.CustomizedView = CustomizedView;

})();
