// IMDb Cast Copy Functionality
// Separate file for better organization

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
  console.log('Extension context invalidated, skipping IMDb cast copy functionality');
  throw new Error('Extension context invalidated');
}

function isIMDbFullCreditsPage() {
  return window.location.hostname === 'www.imdb.com' &&
         window.location.pathname.includes('/fullcredits');
}

function getThemeColors() {
  // Get theme from storage
  return new Promise((resolve) => {
    const themeColors = {
      light: {
        button: '#f5c518',
        buttonHover: '#e6b614',
        buttonText: '#000'
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

async function addCastCopyButtons() {
  if (!isIMDbFullCreditsPage()) return;

  const colors = await getThemeColors();

  // Find all cast/crew section containers
  const sections = document.querySelectorAll('section.ipc-page-section');

  sections.forEach(section => {
    // Find the title wrapper in this section
    const titleWrapper = section.querySelector('.ipc-title__wrapper');
    if (!titleWrapper) return;

    // Skip if button already added
    if (titleWrapper.querySelector('.media-links-copy-btn')) return;

    // Get the section name (Directors, Writers, Cast, etc.)
    const titleText = titleWrapper.querySelector('.ipc-title__text');
    if (!titleText) return;

    const sectionName = titleText.textContent.trim();

    // Create copy button
    const button = document.createElement('button');
    button.className = 'media-links-copy-btn';
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
      showCopyDialog(section, sectionName);
    });

    // Add button to the title
    const h3Element = titleWrapper.querySelector('h3');
    if (h3Element) {
      h3Element.style.display = 'inline-flex';
      h3Element.style.alignItems = 'center';
      h3Element.appendChild(button);
    }
  });
}

async function showCopyDialog(section, sectionName) {
  // Get theme colors
  const colors = await getThemeColors();

  // Get additional theme-specific colors
  const dialogColors = getDialogColors(colors);

  // Get default settings
  const defaults = await new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({
          count: 5,
          content: 'name-role',
          output: 'newline'
        });
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['defaultCastCount', 'defaultContentFormat', 'defaultOutputFormat'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error getting default settings:', chrome.runtime.lastError);
            resolve({
              count: 5,
              content: 'name-role',
              output: 'newline'
            });
          } else {
            resolve({
              count: result.defaultCastCount || 5,
              content: result.defaultContentFormat || 'name-role',
              output: result.defaultOutputFormat || 'newline'
            });
          }
        });
      } else {
        // Fallback defaults
        resolve({
          count: 5,
          content: 'name-role',
          output: 'newline'
        });
      }
    } catch (error) {
      console.warn('Error accessing chrome.storage for defaults:', error);
      resolve({
        count: 5,
        content: 'name-role',
        output: 'newline'
      });
    }
  });

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
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of members:</label>
      <input type="number" id="cast-count" min="1" max="1000" value="${defaults.count}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
    </div>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Content:</label>
      <select id="copy-content"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="name-role" ${defaults.content === 'name-role' ? 'selected' : ''}>Name + Role/Character</option>
        <option value="name-only" ${defaults.content === 'name-only' ? 'selected' : ''}>Name Only</option>
        <option value="role-only" ${defaults.content === 'role-only' ? 'selected' : ''}>Role/Character Only</option>
      </select>
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="output-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line (Name - Role)</option>
        <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated (Name:Role,Name:Role)</option>
        <option value="csv" ${defaults.output === 'csv' ? 'selected' : ''}>CSV (Name,Role per line)</option>
        <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
        <option value="table" ${defaults.output === 'table' ? 'selected' : ''}>Markdown Table</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
        onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
        onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
        Copy
      </button>
      <button id="cancel-btn"
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

  // Close on backdrop click
  backdrop.addEventListener('click', () => {
    document.body.removeChild(dialog);
    document.body.removeChild(backdrop);
  });

  // Handle copy
  dialog.querySelector('#copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#cast-count').value);
    const content = dialog.querySelector('#copy-content').value;
    const outputFormat = dialog.querySelector('#output-format').value;
    copyCastData(section, count, content, outputFormat, sectionName);
    document.body.removeChild(dialog);
    document.body.removeChild(backdrop);
  });

  // Handle cancel
  dialog.querySelector('#cancel-btn').addEventListener('click', () => {
    document.body.removeChild(dialog);
    document.body.removeChild(backdrop);
  });
}

function copyCastData(section, count, content, outputFormat, sectionName) {
  // Extract cast members from the section
  const castMembers = [];

  // Find all list items in this section - use querySelectorAll from section
  const listItems = section.querySelectorAll('li[data-testid="name-credits-list-item"]');

  console.log('Found list items:', listItems.length); // Debug

  listItems.forEach((item, index) => {
    if (index >= count) return;

    // Get name from the link (try multiple selectors)
    const nameLink = item.querySelector('a.name-credits--title-text-big') ||
                     item.querySelector('a.name-credits--title-text') ||
                     item.querySelector('a[href*="/name/"]');

    if (!nameLink) {
      console.log('No name link found in item', index);
      return;
    }

    const name = nameLink.textContent.trim();
    console.log('Found name:', name); // Debug

    // Get role/character from the metadata
    let role = '';

    // Method 1: Look for character name in Cast section (inside sc-2840b417-6 or gBAHic)
    const charLinkDiv = item.querySelector('div[class*="sc-2840b417-6"], div.gBAHic');
    if (charLinkDiv) {
      const charLink = charLinkDiv.querySelector('a');
      if (charLink) {
        role = charLink.textContent.trim();
        console.log('Found character name (Cast):', role);
      }
    }

    // Method 2: Look for role in crew section (span inside sc-2840b417-7)
    if (!role) {
      const roleDiv = item.querySelector('div[class*="sc-2840b417-7"]');
      if (roleDiv) {
        const roleSpan = roleDiv.querySelector('span');
        if (roleSpan) {
          // Get only the span content, not nested divs
          let spanText = '';
          roleSpan.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              spanText += node.textContent;
            }
          });
          role = spanText.trim();
          console.log('Found role (Crew):', role);
        }
      }
    }

    // Method 3: Fallback - look in metadata container
    if (!role) {
      const metadata = item.querySelector('.name-credits--crew-metadata');
      if (metadata) {
        const allDivs = metadata.querySelectorAll('div');
        allDivs.forEach(div => {
          const text = div.textContent.trim();
          // Skip if it's the name, episodes, or year
          if (text && text !== name && !text.includes('episode') && !text.match(/^\d{4}$/)) {
            if (!role || text.length < role.length) {
              role = text;
            }
          }
        });
        console.log('Found role (Fallback):', role);
      }
    }

    // Store as object for flexible formatting
    castMembers.push({ name, role });
  });

  console.log('Total cast members extracted:', castMembers.length); // Debug

  if (castMembers.length === 0) {
    showNotification('No cast members found!', true);
    return;
  }

  // Format the output based on user selection
  let text = '';

  switch(outputFormat) {
    case 'newline':
      // Line by line: Name - Role
      text = castMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name} - ${member.role}` : member.name;
      }).join('\n');
      break;

    case 'comma':
      // Comma separated: Name:Role,Name:Role
      text = castMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name}:${member.role}` : member.name;
      }).join(',');
      break;

    case 'csv':
      // CSV format: Name,Role per line
      if (content === 'name-role') {
        text = 'Name,Role\n' + castMembers.map(member =>
          `"${member.name}","${member.role || ''}"`
        ).join('\n');
      } else if (content === 'name-only') {
        text = 'Name\n' + castMembers.map(member => `"${member.name}"`).join('\n');
      } else {
        text = 'Role\n' + castMembers.map(member => `"${member.role || ''}"`).join('\n');
      }
      break;

    case 'json':
      // JSON array
      if (content === 'name-only') {
        text = JSON.stringify(castMembers.map(m => m.name), null, 2);
      } else if (content === 'role-only') {
        text = JSON.stringify(castMembers.map(m => m.role || ''), null, 2);
      } else {
        text = JSON.stringify(castMembers, null, 2);
      }
      break;

    case 'table':
      // Markdown table
      if (content === 'name-role') {
        text = '| Name | Role |\n|------|------|\n' +
               castMembers.map(member => `| ${member.name} | ${member.role || ''} |`).join('\n');
      } else if (content === 'name-only') {
        text = '| Name |\n|------|\n' +
               castMembers.map(member => `| ${member.name} |`).join('\n');
      } else {
        text = '| Role |\n|------|\n' +
               castMembers.map(member => `| ${member.role || ''} |`).join('\n');
      }
      break;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${castMembers.length} ${sectionName} members!`);
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

// Initialize on page load and when content changes
if (isIMDbFullCreditsPage()) {
  // Initial load
  setTimeout(addCastCopyButtons, 1000);

  // Watch for dynamic content loading
  const observer = new MutationObserver(() => {
    addCastCopyButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
