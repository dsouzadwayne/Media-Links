// Helper function to safely send message to background script
const sendSelectionUpdate = (text, fromContextMenu = false) => {
  try {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'selectionChanged',
        text: text,
        fromContextMenu: fromContextMenu
      });
    }
  } catch (error) {
    // Extension context might be invalidated, ignore silently
    console.debug('Failed to send selection update:', error);
  }
};

// Listen for text selection and notify background script
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    sendSelectionUpdate(selectedText);
  }
});

// Also listen for keyboard-based selection
document.addEventListener('keyup', (e) => {
  // Only check on Shift key releases (used for selection)
  if (e.key === 'Shift') {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      sendSelectionUpdate(selectedText);
    }
  }
});

// Listen for right-click to ensure menu has current selection
// Priority: true ensures this runs before the browser's context menu
document.addEventListener('contextmenu', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    sendSelectionUpdate(selectedText, true);  // true = from context menu
  }
}, true);

// ===== IMDb Cast Copy Functionality =====

function isIMDbFullCreditsPage() {
  return window.location.hostname === 'www.imdb.com' &&
         window.location.pathname.includes('/fullcredits');
}

function addCastCopyButtons() {
  if (!isIMDbFullCreditsPage()) return;

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
      background: #f5c518;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #000;
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#e6b614';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#f5c518';
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

function showCopyDialog(section, sectionName) {
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 9999;
  `;

  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    min-width: 350px;
    max-width: 450px;
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #000; font-size: 18px;">Copy ${sectionName}</h3>
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 8px; color: #000; font-weight: 500;">Number of members:</label>
      <input type="number" id="cast-count" min="1" max="1000" value="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
    </div>
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 8px; color: #000; font-weight: 500;">Format:</label>
      <select id="copy-format" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <option value="name-role">Name + Role/Character</option>
        <option value="name-only">Name Only</option>
        <option value="role-only">Role/Character Only</option>
      </select>
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="copy-btn" style="flex: 1; padding: 12px; background: #f5c518; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px;">Copy</button>
      <button id="cancel-btn" style="flex: 1; padding: 12px; background: #e0e0e0; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 14px;">Cancel</button>
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
    const format = dialog.querySelector('#copy-format').value;
    copyCastData(section, count, format, sectionName);
    document.body.removeChild(dialog);
    document.body.removeChild(backdrop);
  });

  // Handle cancel
  dialog.querySelector('#cancel-btn').addEventListener('click', () => {
    document.body.removeChild(dialog);
    document.body.removeChild(backdrop);
  });
}

function copyCastData(section, count, format, sectionName) {
  // Extract cast members from the section
  const castMembers = [];

  // Find all list items in this section
  const listItems = section.querySelectorAll('li.ipc-metadata-list-summary-item');

  listItems.forEach((item, index) => {
    if (index >= count) return;

    // Get name from the link
    const nameLink = item.querySelector('a.name-credits--title-text');
    if (!nameLink) return;

    const name = nameLink.textContent.trim();

    // Get role/character from the metadata
    let role = '';
    const roleElement = item.querySelector('.sc-2840b417-7 span');
    if (roleElement) {
      role = roleElement.textContent.trim();
    }

    // If no role found, check for character name (for Cast section)
    if (!role) {
      const charElement = item.querySelector('td.character, .character');
      if (charElement) {
        role = charElement.textContent.trim();
      }
    }

    let output = '';
    switch(format) {
      case 'name-role':
        output = role ? `${name} - ${role}` : name;
        break;
      case 'name-only':
        output = name;
        break;
      case 'role-only':
        output = role || '(No role info)';
        break;
    }

    if (output) {
      castMembers.push(output);
    }
  });

  // Copy to clipboard
  const text = castMembers.join('\n');
  if (castMembers.length === 0) {
    showNotification('No cast members found!', true);
    return;
  }

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
    document.body.removeChild(notification);
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
