// IMDb Cast Copy Functionality
// Separate file for better organization

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
    console.log('Extension context invalidated, skipping IMDb cast copy functionality');
    return;
  }

function isIMDbCreditsPage() {
  return window.location.hostname === 'www.imdb.com' &&
         (window.location.pathname.includes('/fullcredits') ||
          window.location.pathname.includes('/companycredits') ||
          window.location.pathname.match(/\/title\/tt\d+\/?$/));
}

function isIMDbAwardsPage() {
  return window.location.hostname === 'www.imdb.com' &&
         window.location.pathname.includes('/awards');
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

function getCopyButtonSettings() {
  // Get copy button visibility settings from storage
  return new Promise((resolve) => {
    const defaults = {
      showImdbCast: true,
      showImdbCompany: true,
      showImdbAwards: true,
      showImdbMain: true
    };

    try {
      if (!isExtensionContextValid()) {
        resolve(defaults);
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['showImdbCast', 'showImdbCompany', 'showImdbAwards', 'showImdbMain'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error getting copy button settings:', chrome.runtime.lastError);
            resolve(defaults);
          } else {
            resolve({
              showImdbCast: result.showImdbCast !== undefined ? result.showImdbCast : defaults.showImdbCast,
              showImdbCompany: result.showImdbCompany !== undefined ? result.showImdbCompany : defaults.showImdbCompany,
              showImdbAwards: result.showImdbAwards !== undefined ? result.showImdbAwards : defaults.showImdbAwards,
              showImdbMain: result.showImdbMain !== undefined ? result.showImdbMain : defaults.showImdbMain
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

let isProcessingIMDbButtons = false;

async function addCastCopyButtons() {
  if (!isIMDbCreditsPage()) return;

  // Prevent concurrent executions
  if (isProcessingIMDbButtons) return;
  isProcessingIMDbButtons = true;

  try {
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
      // Use different dialog for company credits
      if (window.location.pathname.includes('/companycredits')) {
        showCompanyCopyDialog(section, sectionName);
      } else {
        showCopyDialog(section, sectionName);
      }
    });

    // Add button to the title
    const h3Element = titleWrapper.querySelector('h3');
    if (h3Element) {
      h3Element.style.display = 'inline-flex';
      h3Element.style.alignItems = 'center';
      h3Element.appendChild(button);
    }

    // Add individual copy buttons for each cast member
    addIndividualCopyButtons(section, colors);
  });

  // Also add buttons for cast on main title page
  addMainPageCastButtons(colors);
  } finally {
    // Reset flag when done
    isProcessingIMDbButtons = false;
  }
}

async function addIndividualCopyButtons(section, colors) {
  // Check if this is a company credits page
  const isCompanyCredits = window.location.pathname.includes('/companycredits');

  // Find all list items in this section - try multiple selectors
  let listItems;
  if (isCompanyCredits) {
    listItems = section.querySelectorAll('li.ipc-metadata-list__item');
  } else {
    listItems = section.querySelectorAll('li[data-testid="name-credits-list-item"], li[data-testid="title-cast-item"], li.ipc-metadata-list-summary-item, li[class*="cast"], li[class*="crew"]');
  }

  listItems.forEach(item => {
    // Skip if already has copy buttons - check for BOTH IMDb and accidentally-added Wikipedia buttons
    if (item.querySelector('.media-links-name-copy-btn') ||
        item.querySelector('.media-links-role-copy-btn') ||
        item.querySelector('.media-links-wiki-name-copy-btn') ||
        item.querySelector('.media-links-wiki-role-copy-btn')) return;

    // Extract cast member or company data - try multiple selector patterns
    let nameLink;
    if (isCompanyCredits) {
      nameLink = item.querySelector('a[href*="/company/"]') ||
                 item.querySelector('a.ipc-metadata-list-item__label');
    } else {
      nameLink = item.querySelector('a.name-credits--title-text-big') ||
                 item.querySelector('a.name-credits--title-text') ||
                 item.querySelector('a[data-testid="title-cast-item__actor"]') ||
                 item.querySelector('a[href*="/name/"]');
    }

    if (!nameLink) return;

    const name = nameLink.textContent.trim();

    // Get role/character - try multiple methods
    let role = '';
    let roleElement = null;  // Store the element that contains the role

    if (isCompanyCredits) {
      // For company credits, extract the role/description (only exists for some sections like Distributors, Special Effects)
      const roleSpan = item.querySelector('span.ipc-metadata-list-item__list-content-item');
      if (roleSpan) {
        role = roleSpan.textContent.trim();
        roleElement = roleSpan.parentElement; // Use the parent ul as the roleElement
      }
      // Note: Production Companies have no role, so role will remain empty - that's expected
    } else {
      // Method 1: Character link in cast section
      const charLinkDiv = item.querySelector('div[class*="sc-2840b417-6"], div.gBAHic, div[data-testid="cast-item-characters-list"]');
      if (charLinkDiv) {
        const charLink = charLinkDiv.querySelector('a');
        if (charLink) {
          role = charLink.textContent.trim();
          roleElement = charLinkDiv;
        } else {
          // Sometimes character is just text without a link
          role = charLinkDiv.textContent.trim();
          roleElement = charLinkDiv;
        }
      }

      // Method 2: Role in crew section
      if (!role) {
        const roleDiv = item.querySelector('div[class*="sc-2840b417-7"]');
        if (roleDiv) {
          const roleSpan = roleDiv.querySelector('span');
          if (roleSpan) {
            let spanText = '';
            roleSpan.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) {
                spanText += node.textContent;
              }
            });
            role = spanText.trim();
            roleElement = roleDiv;
          }
        }
      }

      // Method 3: Character in main title page format
      if (!role) {
        const charElement = item.querySelector('[data-testid="title-cast-item__characters"]');
        if (charElement) {
          role = charElement.textContent.trim();
          roleElement = charElement;
        }
      }

      // Method 4: Generic metadata search
      if (!role) {
        const metadata = item.querySelector('.ipc-inline-list, [class*="metadata"]');
        if (metadata) {
          const allSpans = metadata.querySelectorAll('span');
          allSpans.forEach(span => {
            const text = span.textContent.trim();
            if (text && text !== name && !text.includes('episode') && !text.match(/^\d{4}$/)) {
              if (!role || text.length < role.length) {
                role = text;
                roleElement = metadata;
              }
            }
          });
        }
      }
    }

    // Create copy name button and insert next to name
    const nameLabel = isCompanyCredits ? 'Copy company name' : 'Copy name';
    const copyNameBtn = createCopyButton(nameLabel, () => name);

    if (isCompanyCredits) {
      // For company credits, insert button directly inside the link element (right after text)
      nameLink.style.display = 'inline-flex';
      nameLink.style.alignItems = 'center';
      nameLink.style.gap = '4px';
      nameLink.appendChild(copyNameBtn);
    } else {
      // For cast/crew, insert after the link element
      const nameParent = nameLink.parentElement;
      if (nameParent) {
        nameParent.style.display = 'inline-flex';
        nameParent.style.alignItems = 'center';
        nameParent.appendChild(copyNameBtn);
      }
    }

    // Create copy role button and insert next to role (only if role exists)
    if (role && roleElement) {
      const roleLabel = isCompanyCredits ? 'Copy company role' : 'Copy role';
      const copyRoleBtn = createCopyButton(roleLabel, () => role);

      // Style the role element to allow inline button
      roleElement.style.display = 'inline-flex';
      roleElement.style.alignItems = 'center';
      roleElement.style.gap = '4px';

      // Insert button right after the role element
      roleElement.insertAdjacentElement('afterend', copyRoleBtn);
    }
  });
}

// Helper function to create a copy button
function createCopyButton(title, getTextFunc) {
  const copyBtn = document.createElement('button');
  const isNameButton = title.includes('name');
  copyBtn.className = isNameButton ? 'media-links-name-copy-btn' : 'media-links-role-copy-btn';
  copyBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon">
      <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"></path>
    </svg>
  `;
  copyBtn.title = title;
  copyBtn.style.cssText = `
    padding: 3px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    opacity: 0.4;
    transition: all 0.15s ease;
    vertical-align: middle;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
  `;

  copyBtn.addEventListener('mouseenter', () => {
    copyBtn.style.opacity = '1';
    copyBtn.style.background = 'rgba(128, 128, 128, 0.15)';
    copyBtn.style.transform = 'scale(1.15)';
  });

  copyBtn.addEventListener('mouseleave', () => {
    copyBtn.style.opacity = '0.4';
    copyBtn.style.background = 'transparent';
    copyBtn.style.transform = 'scale(1)';
  });

  const copyIconSVG = copyBtn.innerHTML;

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = getTextFunc();
    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback - show checkmark
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.6668 5L7.50016 14.1667L3.3335 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      `;
      copyBtn.style.color = '#4caf50';
      copyBtn.style.opacity = '1';

      setTimeout(() => {
        copyBtn.innerHTML = copyIconSVG;
        copyBtn.style.color = 'currentColor';
        copyBtn.style.opacity = '0.4';
      }, 1000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      `;
      copyBtn.style.color = '#f44336';
      copyBtn.style.opacity = '1';

      setTimeout(() => {
        copyBtn.innerHTML = copyIconSVG;
        copyBtn.style.color = 'currentColor';
        copyBtn.style.opacity = '0.4';
      }, 1000);
    });
  });

  return copyBtn;
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
  dialog.querySelector('#copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#cast-count').value);
    const content = dialog.querySelector('#copy-content').value;
    const outputFormat = dialog.querySelector('#output-format').value;
    copyCastData(section, count, content, outputFormat, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#cancel-btn').addEventListener('click', closeDialog);
}

function copyCastData(section, count, content, outputFormat, sectionName) {
  // Check if this is a company credits page
  const isCompanyCredits = window.location.pathname.includes('/companycredits');

  // Extract cast members or companies from the section
  const castMembers = [];

  // Find all list items in this section - use querySelectorAll from section
  let listItems;
  if (isCompanyCredits) {
    // Company credits use different list item structure
    listItems = section.querySelectorAll('li.ipc-metadata-list__item');
  } else {
    // Cast/crew credits
    listItems = section.querySelectorAll('li[data-testid="name-credits-list-item"]');
  }

  console.log('Found list items:', listItems.length); // Debug

  listItems.forEach((item, index) => {
    if (index >= count) return;

    let name = '';
    let nameLink = null;

    if (isCompanyCredits) {
      // For company credits, look for company name links
      nameLink = item.querySelector('a[href*="/company/"]') ||
                 item.querySelector('a.ipc-metadata-list-item__label');
    } else {
      // Get name from the link (try multiple selectors for cast/crew)
      nameLink = item.querySelector('a.name-credits--title-text-big') ||
                 item.querySelector('a.name-credits--title-text') ||
                 item.querySelector('a[href*="/name/"]');
    }

    if (!nameLink) {
      console.log('No name link found in item', index);
      return;
    }

    name = nameLink.textContent.trim();
    console.log('Found name:', name); // Debug

    // Get role/character from the metadata
    let role = '';

    if (isCompanyCredits) {
      // For company credits, extract the role/description (only exists for some sections like Distributors, Special Effects)
      const roleSpan = item.querySelector('span.ipc-metadata-list-item__list-content-item');
      if (roleSpan) {
        role = roleSpan.textContent.trim();
        console.log('Found company role:', role);
      }
      // Note: Production Companies have no role, so role will remain empty - that's expected
    } else {
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

// Company Credits specific dialog
async function showCompanyCopyDialog(section, sectionName) {
  // Get theme colors
  const colors = await getThemeColors();
  const dialogColors = getDialogColors(colors);

  // Get default settings
  const defaults = await new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({ count: 5, output: 'newline' });
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['defaultCastCount', 'defaultOutputFormat'], (result) => {
          if (chrome.runtime.lastError) {
            resolve({ count: 5, output: 'newline' });
          } else {
            resolve({
              count: result.defaultCastCount || 5,
              output: result.defaultOutputFormat || 'newline'
            });
          }
        });
      } else {
        resolve({ count: 5, output: 'newline' });
      }
    } catch (error) {
      resolve({ count: 5, output: 'newline' });
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
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of companies:</label>
      <input type="number" id="company-count" min="1" max="1000" value="${defaults.count}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
    </div>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Include:</label>
      <select id="company-content"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="name-only">Company Name Only</option>
        <option value="name-description">Company Name + Description (if available)</option>
      </select>
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="company-output-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
        onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
        onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
        <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line</option>
        <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated</option>
        <option value="csv" ${defaults.output === 'csv' ? 'selected' : ''}>CSV</option>
        <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
        <option value="table" ${defaults.output === 'table' ? 'selected' : ''}>Markdown Table</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="company-copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
        onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
        onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
        Copy
      </button>
      <button id="company-cancel-btn"
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
  dialog.querySelector('#company-copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#company-count').value);
    const content = dialog.querySelector('#company-content').value;
    const outputFormat = dialog.querySelector('#company-output-format').value;
    copyCompanyData(section, count, content, outputFormat, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#company-cancel-btn').addEventListener('click', closeDialog);
}

// Company Credits specific copy function
function copyCompanyData(section, count, content, outputFormat, sectionName) {
  const companies = [];

  // Find all list items in this section
  const listItems = section.querySelectorAll('li.ipc-metadata-list__item');

  listItems.forEach((item, index) => {
    if (index >= count) return;

    // Get company name
    const nameLink = item.querySelector('a[href*="/company/"]') ||
                     item.querySelector('a.ipc-metadata-list-item__label');

    if (!nameLink) return;

    const name = nameLink.textContent.trim();

    // Get description (if available)
    let description = '';
    const descSpan = item.querySelector('span.ipc-metadata-list-item__list-content-item');
    if (descSpan) {
      description = descSpan.textContent.trim();
    }

    companies.push({ name, description });
  });

  if (companies.length === 0) {
    showNotification('No companies found!', true);
    return;
  }

  // Format the output
  let text = '';

  switch(outputFormat) {
    case 'newline':
      text = companies.map(company => {
        if (content === 'name-only') return company.name;
        return company.description ? `${company.name} - ${company.description}` : company.name;
      }).join('\n');
      break;

    case 'comma':
      text = companies.map(company => {
        if (content === 'name-only') return company.name;
        return company.description ? `${company.name}:${company.description}` : company.name;
      }).join(',');
      break;

    case 'csv':
      if (content === 'name-only') {
        text = 'Company\n' + companies.map(company => `"${company.name}"`).join('\n');
      } else {
        text = 'Company,Description\n' + companies.map(company =>
          `"${company.name}","${company.description || ''}"`
        ).join('\n');
      }
      break;

    case 'json':
      if (content === 'name-only') {
        text = JSON.stringify(companies.map(c => c.name), null, 2);
      } else {
        text = JSON.stringify(companies, null, 2);
      }
      break;

    case 'table':
      if (content === 'name-only') {
        text = '| Company |\n|------|\n' +
               companies.map(company => `| ${company.name} |`).join('\n');
      } else {
        text = '| Company | Description |\n|------|------|\n' +
               companies.map(company => `| ${company.name} | ${company.description || ''} |`).join('\n');
      }
      break;
  }

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${companies.length} companies from ${sectionName}!`);
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

async function addMainPageCastButtons(colors) {
  // Check settings first
  const settings = await getCopyButtonSettings();
  if (!settings.showImdbMain) {
    return; // Don't add buttons if disabled
  }

  // Add buttons for cast/crew on main title page
  // Look for cast cards that aren't in sections
  const castItems = document.querySelectorAll('[data-testid="title-cast-item"], [data-testid="title-pc-principal-credit"]');

  castItems.forEach(item => {
    // Skip if already has copy buttons - check for BOTH IMDb and accidentally-added Wikipedia buttons
    if (item.querySelector('.media-links-name-copy-btn') ||
        item.querySelector('.media-links-role-copy-btn') ||
        item.querySelector('.media-links-wiki-name-copy-btn') ||
        item.querySelector('.media-links-wiki-role-copy-btn')) return;

    // Find the name link
    const nameLink = item.querySelector('a[data-testid="title-cast-item__actor"]') ||
                     item.querySelector('a[href*="/name/"]');

    if (!nameLink) return;

    const name = nameLink.textContent.trim();

    // Get role/character
    let role = '';
    const charElement = item.querySelector('[data-testid="title-cast-item__characters"]') ||
                       item.querySelector('span[class*="char"]');
    if (charElement) {
      role = charElement.textContent.trim();
    }

    // Create copy name button and insert next to name
    const copyNameBtn = createCopyButton('Copy name', () => name);
    const nameParent = nameLink.parentElement;
    if (nameParent) {
      nameParent.style.display = 'inline-flex';
      nameParent.style.alignItems = 'center';
      nameParent.appendChild(copyNameBtn);
    }

    // Create copy role button and insert next to role (only if role exists)
    if (role && charElement) {
      const copyRoleBtn = createCopyButton('Copy role', () => role);

      // Style the character element to allow inline button
      charElement.style.display = 'inline-flex';
      charElement.style.alignItems = 'center';
      charElement.style.gap = '4px';

      // Insert button right after the character element
      charElement.insertAdjacentElement('afterend', copyRoleBtn);
    }
  });
}

async function addAwardsCopyButtons() {
  if (!isIMDbAwardsPage()) return;

  const colors = await getThemeColors();

  // Find all award list items
  const awardItems = document.querySelectorAll('li[data-testid="list-item"].ipc-metadata-list-summary-item');

  awardItems.forEach(item => {
    // Skip if already has copy buttons
    if (item.querySelector('.media-links-name-copy-btn') ||
        item.querySelector('.media-links-role-copy-btn') ||
        item.querySelector('.media-links-award-copy-btn')) return;

    // Find the person name link (in the stl section)
    const personLink = item.querySelector('.ipc-metadata-list-summary-item__stl a.ipc-metadata-list-summary-item__li--link');

    if (personLink) {
      const personName = personLink.textContent.trim();
      const copyNameBtn = createCopyButton('Copy person name', () => personName);

      // Insert the button after the person link within the same li
      personLink.insertAdjacentElement('afterend', copyNameBtn);
    }

    // Find the award category (in the tl section)
    const categorySpan = item.querySelector('.ipc-metadata-list-summary-item__tl span.awardCategoryName');

    if (categorySpan) {
      const categoryName = categorySpan.textContent.trim();
      const copyCategoryBtn = createCopyButton('Copy award category', () => categoryName);

      // Insert the button after the category span within the same li
      categorySpan.insertAdjacentElement('afterend', copyCategoryBtn);
    }

    // Find the award body (e.g., "BAFTA TV Award", "Oscar", etc.)
    const awardLink = item.querySelector('.ipc-metadata-list-summary-item__tc a.ipc-metadata-list-summary-item__t');

    if (awardLink) {
      // Extract award body from the span inside the link
      const awardBodySpan = awardLink.querySelector('span.ipc-metadata-list-summary-item__tst');

      if (awardBodySpan) {
        const awardBody = awardBodySpan.textContent.trim();
        const copyAwardBtn = createCopyButton('Copy award body', () => awardBody);
        copyAwardBtn.classList.add('media-links-award-copy-btn');

        // Style the link to allow inline button
        awardLink.style.display = 'inline-flex';
        awardLink.style.alignItems = 'center';
        awardLink.style.gap = '4px';

        // Insert the button inside the link, after the span
        awardBodySpan.insertAdjacentElement('afterend', copyAwardBtn);
      }
    }
  });
}

// Initialize on page load and when content changes
if (isIMDbCreditsPage()) {
  // Check settings before initializing
  getCopyButtonSettings().then(settings => {
    const isCompanyCredits = window.location.pathname.includes('/companycredits');
    const shouldShow = isCompanyCredits ? settings.showImdbCompany : settings.showImdbCast;

    if (!shouldShow) {
      console.log('IMDb copy buttons disabled for this page type');
      return;
    }

    // Initial load
    setTimeout(addCastCopyButtons, 1000);

  // Debounce mechanism to prevent excessive calls
  let debounceTimer = null;

  // Watch for dynamic content loading
  const observer = new MutationObserver((mutations) => {
    // Check if any of the mutations actually added new cast-related content
    // IMPORTANT: Ignore mutations that are just our own button additions
    const hasNewContent = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => {
          // Skip if this is just a button we added
          if (node.nodeType === 1 &&
              (node.classList && (
                node.classList.contains('media-links-name-copy-btn') ||
                node.classList.contains('media-links-role-copy-btn') ||
                node.classList.contains('media-links-copy-btn')
              ))) {
            return false;
          }

          // Check for actual cast-related content
          return node.nodeType === 1 && // Element node
            (node.querySelector && (
              node.querySelector('section.ipc-page-section') ||
              node.querySelector('li[data-testid="title-cast-item"]') ||
              node.querySelector('a[href*="/name/"]') ||
              node.matches('section.ipc-page-section') ||
              node.matches('li[data-testid="title-cast-item"]')
            ));
        });
    });

    // Only re-run if new cast-related content was added
    if (hasNewContent) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        addCastCopyButtons();
      }, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Clean up observer when page is unloaded or extension context is invalidated
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    clearTimeout(debounceTimer);
  });

  // Also disconnect on navigation (for single-page apps)
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    clearTimeout(debounceTimer);
  });
  }); // End of getCopyButtonSettings().then()
}

// Initialize awards page functionality
if (isIMDbAwardsPage()) {
  // Check settings before initializing
  getCopyButtonSettings().then(settings => {
    if (!settings.showImdbAwards) {
      console.log('IMDb awards copy buttons disabled');
      return;
    }

    // Initial load
    setTimeout(addAwardsCopyButtons, 1000);

  // Debounce mechanism to prevent excessive calls
  let debounceTimer = null;

  // Watch for dynamic content loading (e.g., "See more" buttons expanding lists)
  const observer = new MutationObserver((mutations) => {
    // Check if any of the mutations actually added new award items
    // IMPORTANT: Ignore mutations that are just our own button additions
    const hasNewContent = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => {
          // Skip if this is just a button we added
          if (node.nodeType === 1 &&
              (node.classList && (
                node.classList.contains('media-links-name-copy-btn') ||
                node.classList.contains('media-links-role-copy-btn')
              ))) {
            return false;
          }

          // Check for actual award-related content
          return node.nodeType === 1 && // Element node
            (node.querySelector && (
              node.querySelector('li[data-testid="list-item"]') ||
              node.matches('li[data-testid="list-item"]')
            ));
        });
    });

    // Only re-run if new award content was added
    if (hasNewContent) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        addAwardsCopyButtons();
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
  }); // End of getCopyButtonSettings().then()
}

})(); // End of IIFE
