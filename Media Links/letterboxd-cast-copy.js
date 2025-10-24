// Letterboxd Cast Copy Functionality

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

  // Early exit if extension context is invalid (e.g., extension was reloaded)
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping Letterboxd cast copy functionality');
    return;
  }

function isLetterboxdFilmPage() {
  return window.location.hostname === 'letterboxd.com' &&
         window.location.pathname.match(/\/film\/[^\/]+\/?$/);
}

function getThemeColors() {
  // Get theme from storage
  return new Promise((resolve) => {
    const themeColors = {
      light: {
        button: '#00c030',
        buttonHover: '#00a028',
        buttonText: '#fff'
      },
      dark: {
        button: '#8b5cf6',
        buttonHover: '#7c3aed',
        buttonText: '#fff'
      },
      'catppuccin-mocha': {
        button: '#cba6f7',
        buttonHover: '#b4a1e8',
        buttonText: '#000'
      },
      cats: {
        button: '#ff9933',
        buttonHover: '#ff7700',
        buttonText: '#000'
      },
      'cat-night': {
        button: '#818cf8',
        buttonHover: '#6366f1',
        buttonText: '#fff'
      }
    };

    try {
      if (!isExtensionContextValid()) {
        resolve(themeColors.light);
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['theme'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error getting theme:', chrome.runtime.lastError);
            resolve(themeColors.light);
          } else {
            const theme = result.theme || 'light';
            resolve(themeColors[theme] || themeColors.light);
          }
        });
      } else {
        // Fallback if chrome.storage is not available
        resolve(themeColors.light);
      }
    } catch (error) {
      console.warn('Error accessing chrome.storage:', error);
      resolve(themeColors.light);
    }
  });
}

function getDialogColors(buttonColors) {
  // Determine if button color is dark or light
  const isDark = buttonColors.buttonText === '#fff';

  if (isDark) {
    // Dark theme dialogs
    return {
      background: '#1a1a2e',
      text: '#e0e7ff',
      border: '#2d2d44',
      inputBg: '#252540',
      inputBorder: '#3d3d5c',
      cancelBg: '#2d2d44',
      cancelHover: '#3d3d5c',
      cancelText: '#c7d2fe'
    };
  } else {
    // Light theme dialogs
    return {
      background: '#ffffff',
      text: '#1a1a1a',
      border: '#e0e0e0',
      inputBg: '#f8f8f8',
      inputBorder: '#d0d0d0',
      cancelBg: '#e5e5e5',
      cancelHover: '#d5d5d5',
      cancelText: '#333333'
    };
  }
}

function getCopyButtonSettings() {
  // Get copy button visibility settings from storage
  return new Promise((resolve) => {
    const defaults = {
      showLetterboxdCast: true
    };

    try {
      if (!isExtensionContextValid()) {
        resolve(defaults);
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['showLetterboxdCast'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error getting copy button settings:', chrome.runtime.lastError);
            resolve(defaults);
          } else {
            resolve({
              showLetterboxdCast: result.showLetterboxdCast !== undefined ? result.showLetterboxdCast : defaults.showLetterboxdCast
            });
          }
        });
      } else {
        resolve(defaults);
      }
    } catch (error) {
      console.warn('Error accessing chrome.storage for copy button settings:', error);
      resolve(defaults);
    }
  });
}

let isProcessingLetterboxdButtons = false;

async function addLetterboxdCastButtons() {
  if (!isLetterboxdFilmPage()) return;

  // Prevent concurrent executions
  if (isProcessingLetterboxdButtons) return;
  isProcessingLetterboxdButtons = true;

  try {
    const settings = await getCopyButtonSettings();
    if (!settings.showLetterboxdCast) {
      console.log('Letterboxd copy buttons disabled');
      return;
    }

    const colors = await getThemeColors();

    // Process all tabs
    await processTab('#tab-cast', 'Cast', colors);
    await processTab('#tab-crew', 'Crew', colors);
    await processTab('#tab-details', 'Details', colors);
    await processTab('#tab-genres', 'Genres', colors);
    await processTab('#tab-releases', 'Releases', colors);

  } finally {
    // Reset flag when done
    isProcessingLetterboxdButtons = false;
  }
}

async function processTab(tabSelector, tabName, colors) {
  const tab = document.querySelector(tabSelector);
  if (!tab) return;

  // Special handling for different tab types
  if (tabSelector === '#tab-cast') {
    processCastTab(tab, colors);
  } else if (tabSelector === '#tab-crew') {
    processCrewTab(tab, colors);
  } else if (tabSelector === '#tab-details') {
    processDetailsTab(tab, colors);
  } else if (tabSelector === '#tab-genres') {
    processGenresTab(tab, colors);
  } else if (tabSelector === '#tab-releases') {
    processReleasesTab(tab, colors);
  }
}

function processCastTab(castTab, colors) {
  // Find the cast heading
  const castHeading = castTab.querySelector('h3');
  if (castHeading && !castHeading.querySelector('.media-links-letterboxd-bulk-copy-btn')) {
    // Add bulk copy button to the cast heading
    addBulkCopyButton(castHeading, castTab, colors, 'Cast');
  }

  // Find all cast member links and add click handlers
  const castList = castTab.querySelector('.cast-list.text-sluglist');
  if (!castList) return;

  const castLinks = castList.querySelectorAll('a.text-slug.tooltip');
  addCopyHandlersToLinks(castLinks);
}

function processCrewTab(crewTab, colors) {
  // Find all crew sections (each h3 represents a crew role)
  const crewSections = crewTab.querySelectorAll('h3');

  crewSections.forEach(heading => {
    if (!heading.querySelector('.media-links-letterboxd-bulk-copy-btn')) {
      const roleName = heading.querySelector('.crewrole')?.textContent.trim() || 'Crew';
      // Get the text-sluglist that follows this heading
      const textSlugList = heading.nextElementSibling;
      if (textSlugList && textSlugList.classList.contains('text-sluglist')) {
        addBulkCopyButton(heading, crewTab, colors, roleName, textSlugList);
      }
    }
  });

  // Add click handlers to all crew links
  const crewLinks = crewTab.querySelectorAll('a.text-slug');
  addCopyHandlersToLinks(crewLinks);
}

function processDetailsTab(detailsTab, colors) {
  // Find all detail sections (each h3 represents a detail type)
  const detailSections = detailsTab.querySelectorAll('h3');

  detailSections.forEach(heading => {
    if (!heading.querySelector('.media-links-letterboxd-bulk-copy-btn')) {
      const sectionName = heading.querySelector('span')?.textContent.trim() || 'Details';
      // Get the text-sluglist that follows this heading
      const textSlugList = heading.nextElementSibling;
      if (textSlugList && textSlugList.classList.contains('text-sluglist')) {
        addBulkCopyButton(heading, detailsTab, colors, sectionName, textSlugList);
      }
    }
  });

  // Add click handlers to all detail links
  const detailLinks = detailsTab.querySelectorAll('a.text-slug');
  addCopyHandlersToLinks(detailLinks);
}

function processGenresTab(genresTab, colors) {
  // Find all genre sections
  const genreSections = genresTab.querySelectorAll('h3');

  genreSections.forEach(heading => {
    if (!heading.querySelector('.media-links-letterboxd-bulk-copy-btn')) {
      const sectionName = heading.querySelector('span')?.textContent.trim() || 'Genres';
      // Get the text-sluglist that follows this heading
      const textSlugList = heading.nextElementSibling;
      if (textSlugList && textSlugList.classList.contains('text-sluglist')) {
        addBulkCopyButton(heading, genresTab, colors, sectionName, textSlugList);
      }
    }
  });

  // Add click handlers to all genre links
  const genreLinks = genresTab.querySelectorAll('a.text-slug');
  addCopyHandlersToLinks(genreLinks);
}

function processReleasesTab(releasesTab, colors) {
  // Find the first heading in the releases tab
  const firstHeading = releasesTab.querySelector('h3.release-table-group-title');
  if (firstHeading && !firstHeading.querySelector('.media-links-letterboxd-bulk-copy-btn')) {
    addBulkCopyButton(firstHeading, releasesTab, colors, 'Releases', null, true);
  }

  // Add click handlers to all country name links
  const countryLinks = releasesTab.querySelectorAll('.release-country .name');
  countryLinks.forEach(link => {
    if (link.dataset.letterboxdCopyEnabled) return;

    link.dataset.letterboxdCopyEnabled = 'true';
    const countryName = link.textContent.trim();

    link.style.cursor = 'pointer';
    link.title = `Click to copy: ${countryName}`;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      navigator.clipboard.writeText(countryName).then(() => {
        showCopyNotification(link, countryName);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showCopyNotification(link, countryName, true);
      });
    });
  });
}

function addCopyHandlersToLinks(links) {
  links.forEach(link => {
    // Skip if it's the "Show All" button or already processed
    if (link.id === 'has-cast-overflow' ||
        link.id === 'has-crew-overflow' ||
        link.dataset.letterboxdCopyEnabled) {
      return;
    }

    // Mark as processed
    link.dataset.letterboxdCopyEnabled = 'true';

    const itemName = link.textContent.trim();

    // Add visual indication that it's clickable
    link.style.cursor = 'pointer';
    const originalTitle = link.title || link.getAttribute('data-original-title') || '';
    link.title = originalTitle ? `Click to copy: ${itemName}` : `Click to copy: ${itemName}`;

    // Add click handler
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Copy to clipboard
      navigator.clipboard.writeText(itemName).then(() => {
        showCopyNotification(link, itemName);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showCopyNotification(link, itemName, true);
      });
    });
  });
}

function addBulkCopyButton(heading, tab, colors, sectionName, contextElement = null, isReleasesTab = false) {
  const button = document.createElement('button');
  button.className = 'media-links-letterboxd-bulk-copy-btn';
  button.innerHTML = '📋 Copy';
  button.style.cssText = `
    margin-left: 10px;
    padding: 6px 12px;
    background: ${colors.button};
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: ${colors.buttonText};
    transition: all 0.2s;
    vertical-align: middle;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.background = colors.buttonHover;
    button.style.transform = 'scale(1.05)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = colors.button;
    button.style.transform = 'scale(1)';
  });

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReleasesTab) {
      showReleaseCopyDialog(tab, sectionName);
    } else {
      showCopyDialog(tab, sectionName, contextElement);
    }
  });

  // Make heading inline to accommodate button
  heading.style.display = 'inline-flex';
  heading.style.alignItems = 'center';
  heading.appendChild(button);
}

// Helper function to show visual feedback when copying
function showCopyNotification(element, text, isError = false) {
  // Store original styles
  const originalColor = element.style.color;
  const originalBackground = element.style.backgroundColor;

  // Show success/error feedback
  element.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
  element.style.color = isError ? '#c62828' : '#2e7d32';
  element.style.transition = 'all 0.2s ease';

  // Create a small tooltip near the element
  const tooltip = document.createElement('div');
  tooltip.textContent = isError ? 'Failed to copy' : '✓ Copied!';
  tooltip.style.cssText = `
    position: absolute;
    background: ${isError ? '#f44336' : '#4caf50'};
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  // Position tooltip near the element
  const rect = element.getBoundingClientRect();
  tooltip.style.position = 'fixed';
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 30}px`;
  tooltip.style.transform = 'translateX(-50%)';

  document.body.appendChild(tooltip);

  // Reset after a delay
  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
    element.style.color = originalColor;
    if (document.body.contains(tooltip)) {
      document.body.removeChild(tooltip);
    }
  }, 1000);
}

async function showCopyDialog(tab, sectionName, contextElement = null) {
  // Get theme colors
  const colors = await getThemeColors();
  const dialogColors = getDialogColors(colors);

  // Get default settings
  const defaults = await new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({ count: 5, content: 'name-role', output: 'newline' });
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['defaultCastCount', 'defaultContentFormat', 'defaultOutputFormat'], (result) => {
          if (chrome.runtime.lastError) {
            resolve({ count: 5, content: 'name-role', output: 'newline' });
          } else {
            resolve({
              count: result.defaultCastCount || 5,
              content: result.defaultContentFormat || 'name-role',
              output: result.defaultOutputFormat || 'newline'
            });
          }
        });
      } else {
        resolve({ count: 5, content: 'name-role', output: 'newline' });
      }
    } catch (error) {
      resolve({ count: 5, content: 'name-role', output: 'newline' });
    }
  });

  // Collect all members/items from the section
  const members = [];

  // Use contextElement if provided, otherwise search within the whole tab
  const searchContext = contextElement || tab;

  // For Cast tab - special handling
  if (sectionName === 'Cast') {
    const castList = tab.querySelector('.cast-list.text-sluglist');
    if (castList) {
      const castLinks = castList.querySelectorAll('a.text-slug.tooltip');
      castLinks.forEach(link => {
        if (link.id === 'has-cast-overflow') return;
        const name = link.textContent.trim();
        const role = link.getAttribute('title') || link.getAttribute('data-original-title') || '';
        members.push({ name, role });
      });

      const overflowSpan = castList.querySelector('#cast-overflow');
      if (overflowSpan) {
        const overflowLinks = overflowSpan.querySelectorAll('a.text-slug.tooltip');
        overflowLinks.forEach(link => {
          const name = link.textContent.trim();
          const role = link.getAttribute('title') || link.getAttribute('data-original-title') || '';
          members.push({ name, role });
        });
      }
    }
  } else {
    // For other tabs (Crew, Details, Genres)
    const links = searchContext.querySelectorAll('a.text-slug');
    links.forEach(link => {
      const name = link.textContent.trim();
      const role = link.getAttribute('title') || link.getAttribute('data-original-title') || '';
      members.push({ name, role });
    });
  }

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translate(-50%, -45%); opacity: 0; }
      to { transform: translate(-50%, -50%); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${dialogColors.background};
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    z-index: 10000;
    min-width: 400px;
    max-width: 500px;
    border: 1px solid ${dialogColors.border};
    animation: slideIn 0.3s ease-out;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.button}; padding-bottom: 10px;">
      📋 Copy ${sectionName}
    </h3>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of items:</label>
      <input type="number" id="letterboxd-cast-count" min="1" max="1000" value="${Math.min(defaults.count, members.length)}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
    </div>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Content:</label>
      <select id="letterboxd-copy-content"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="name-role" ${defaults.content === 'name-role' ? 'selected' : ''}>Name + Info</option>
        <option value="name-only" ${defaults.content === 'name-only' ? 'selected' : ''}>Name Only</option>
        <option value="role-only" ${defaults.content === 'role-only' ? 'selected' : ''}>Info Only</option>
      </select>
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="letterboxd-output-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line (Name - Info)</option>
        <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated (Name:Info,Name:Info)</option>
        <option value="csv" ${defaults.output === 'csv' ? 'selected' : ''}>CSV (Name,Info per line)</option>
        <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
        <option value="table" ${defaults.output === 'table' ? 'selected' : ''}>Markdown Table</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="letterboxd-copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
        onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
        onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
        Copy
      </button>
      <button id="letterboxd-cancel-btn"
        style="flex: 1; padding: 14px; background: ${dialogColors.cancelBg}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 15px; color: ${dialogColors.cancelText}; transition: all 0.2s;"
        onmouseover="this.style.background='${dialogColors.cancelHover}'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.background='${dialogColors.cancelBg}'; this.style.transform='translateY(0)'">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);

  // Helper function to safely remove dialog
  const closeDialog = () => {
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  };

  // Close on backdrop click
  backdrop.addEventListener('click', closeDialog);

  // Handle copy
  dialog.querySelector('#letterboxd-copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#letterboxd-cast-count').value);
    const content = dialog.querySelector('#letterboxd-copy-content').value;
    const outputFormat = dialog.querySelector('#letterboxd-output-format').value;
    copyCastData(members, count, content, outputFormat, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#letterboxd-cancel-btn').addEventListener('click', closeDialog);
}

function copyCastData(castMembers, count, content, outputFormat, sectionName) {
  const limitedMembers = castMembers.slice(0, count);

  if (limitedMembers.length === 0) {
    showNotification('No cast members found!', true);
    return;
  }

  // Format the output based on user selection
  let text = '';

  switch(outputFormat) {
    case 'newline':
      // Line by line: Name - Role
      text = limitedMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name} - ${member.role}` : member.name;
      }).join('\n');
      break;

    case 'comma':
      // Comma separated: Name:Role,Name:Role
      text = limitedMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name}:${member.role}` : member.name;
      }).join(',');
      break;

    case 'csv':
      // CSV format: Name,Role per line
      if (content === 'name-role') {
        text = 'Name,Role\n' + limitedMembers.map(member =>
          `"${member.name}","${member.role || ''}"`
        ).join('\n');
      } else if (content === 'name-only') {
        text = 'Name\n' + limitedMembers.map(member => `"${member.name}"`).join('\n');
      } else {
        text = 'Role\n' + limitedMembers.map(member => `"${member.role || ''}"`).join('\n');
      }
      break;

    case 'json':
      // JSON array
      if (content === 'name-only') {
        text = JSON.stringify(limitedMembers.map(m => m.name), null, 2);
      } else if (content === 'role-only') {
        text = JSON.stringify(limitedMembers.map(m => m.role || ''), null, 2);
      } else {
        text = JSON.stringify(limitedMembers, null, 2);
      }
      break;

    case 'table':
      // Markdown table
      if (content === 'name-role') {
        text = '| Name | Role |\n|------|------|\n' +
               limitedMembers.map(member => `| ${member.name} | ${member.role || ''} |`).join('\n');
      } else if (content === 'name-only') {
        text = '| Name |\n|------|\n' +
               limitedMembers.map(member => `| ${member.name} |`).join('\n');
      } else {
        text = '| Role |\n|------|\n' +
               limitedMembers.map(member => `| ${member.role || ''} |`).join('\n');
      }
      break;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${limitedMembers.length} ${sectionName} members!`);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy to clipboard', true);
  });
}

function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${isError ? '#f44336' : '#4caf50'};
    color: white;
    padding: 15px 20px;
    border-radius: 4px;
    z-index: 10001;
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

async function showReleaseCopyDialog(releasesTab, sectionName) {
  // Get theme colors
  const colors = await getThemeColors();
  const dialogColors = getDialogColors(colors);

  // Collect all release information
  const releases = [];
  const releaseItems = releasesTab.querySelectorAll('.release-table .listitem');

  releaseItems.forEach(item => {
    const dateElement = item.querySelector('.date');
    const date = dateElement ? dateElement.textContent.trim() : '';

    const countryElements = item.querySelectorAll('.release-country');
    countryElements.forEach(countryEl => {
      const countryName = countryEl.querySelector('.name')?.textContent.trim() || '';
      const type = countryEl.closest('.release-table-title')?.previousElementSibling?.textContent.trim() || 'Unknown';
      const certification = countryEl.querySelector('.release-certification-badge .label')?.textContent.trim() || '';
      const note = countryEl.querySelector('.release-note')?.textContent.trim() || '';

      releases.push({
        date,
        country: countryName,
        type,
        certification,
        note
      });
    });
  });

  if (releases.length === 0) {
    showNotification('No release information found!', true);
    return;
  }

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${dialogColors.background};
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    z-index: 10000;
    min-width: 400px;
    max-width: 500px;
    border: 1px solid ${dialogColors.border};
    animation: slideIn 0.3s ease-out;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.button}; padding-bottom: 10px;">
      📋 Copy ${sectionName}
    </h3>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of releases:</label>
      <input type="number" id="letterboxd-release-count" min="1" max="1000" value="${Math.min(10, releases.length)}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="letterboxd-release-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="detailed">Detailed (Date | Country | Type | Cert | Note)</option>
        <option value="simple">Simple (Date - Country)</option>
        <option value="csv">CSV Format</option>
        <option value="json">JSON Array</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="letterboxd-release-copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
        onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
        onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
        Copy
      </button>
      <button id="letterboxd-release-cancel-btn"
        style="flex: 1; padding: 14px; background: ${dialogColors.cancelBg}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 15px; color: ${dialogColors.cancelText}; transition: all 0.2s;"
        onmouseover="this.style.background='${dialogColors.cancelHover}'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.background='${dialogColors.cancelBg}'; this.style.transform='translateY(0)'">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);

  // Helper function to safely remove dialog
  const closeDialog = () => {
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  };

  // Close on backdrop click
  backdrop.addEventListener('click', closeDialog);

  // Handle copy
  dialog.querySelector('#letterboxd-release-copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#letterboxd-release-count').value);
    const format = dialog.querySelector('#letterboxd-release-format').value;
    copyReleaseData(releases, count, format, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#letterboxd-release-cancel-btn').addEventListener('click', closeDialog);
}

function copyReleaseData(releases, count, format, sectionName) {
  const limitedReleases = releases.slice(0, count);

  if (limitedReleases.length === 0) {
    showNotification('No releases found!', true);
    return;
  }

  let text = '';

  switch(format) {
    case 'detailed':
      text = limitedReleases.map(r => {
        const parts = [r.date, r.country, r.type];
        if (r.certification) parts.push(r.certification);
        if (r.note) parts.push(r.note);
        return parts.join(' | ');
      }).join('\n');
      break;

    case 'simple':
      text = limitedReleases.map(r => `${r.date} - ${r.country}`).join('\n');
      break;

    case 'csv':
      text = 'Date,Country,Type,Certification,Note\n' +
             limitedReleases.map(r =>
               `"${r.date}","${r.country}","${r.type}","${r.certification}","${r.note}"`
             ).join('\n');
      break;

    case 'json':
      text = JSON.stringify(limitedReleases, null, 2);
      break;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${limitedReleases.length} ${sectionName}!`);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy to clipboard', true);
  });
}

// Initialize on page load and when content changes
if (isLetterboxdFilmPage()) {
  // Check settings before initializing
  getCopyButtonSettings().then(settings => {
    if (!settings.showLetterboxdCast) {
      console.log('Letterboxd copy buttons disabled');
      return;
    }

    // Initial load - wait a bit for the page to fully render
    setTimeout(addLetterboxdCastButtons, 1500);

    // Debounce mechanism to prevent excessive calls
    let debounceTimer = null;

    // Watch for dynamic content loading (e.g., clicking "Show All" button or tab changes)
    const observer = new MutationObserver((mutations) => {
      // Check if any of the mutations actually added new content
      // IMPORTANT: Ignore mutations that are just our own modifications
      const hasNewContent = mutations.some(mutation => {
        return mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some(node => {
            // Skip if this is just the bulk copy button we added
            if (node.nodeType === 1 &&
                (node.classList &&
                  node.classList.contains('media-links-letterboxd-bulk-copy-btn'))) {
              return false;
            }

            // Check for actual content in any tab
            return node.nodeType === 1 && // Element node
              (node.querySelector && (
                node.querySelector('a.text-slug') ||
                node.querySelector('#cast-overflow') ||
                node.querySelector('.release-country') ||
                node.matches('a.text-slug') ||
                node.matches('.text-sluglist')
              ));
          });
      });

      // Only re-run if new content was added
      if (hasNewContent) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          addLetterboxdCastButtons();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Clean up observer when page is unloaded
    window.addEventListener('beforeunload', () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    });

    // Also disconnect on navigation (for single-page apps)
    window.addEventListener('pagehide', () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    });
  });
}

})(); // End of IIFE
