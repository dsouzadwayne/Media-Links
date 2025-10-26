// BookMyShow Copy Functionality

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
    console.log('Extension context invalidated, skipping BookMyShow copy functionality');
    return;
  }

  function isBookMyShowMoviePage() {
    return window.location.hostname.includes('bookmyshow.com') &&
           window.location.pathname.includes('/movies/');
  }

  function getThemeColors() {
    // Use ThemeManager if available, fallback to default colors
    return new Promise((resolve) => {
      try {
        if (typeof ThemeManager !== 'undefined') {
          const colors = ThemeManager.getThemeColors();
          resolve(colors);
        } else {
          // Fallback: return default light theme colors
          resolve({
            button: '#6366f1',
            buttonHover: '#4f46e5',
            buttonText: '#fff'
          });
        }
      } catch (error) {
        console.warn('Error getting theme colors:', error);
        resolve({
          button: '#6366f1',
          buttonHover: '#4f46e5',
          buttonText: '#fff'
        });
      }
    });
  }

  function getDialogColors(buttonColors) {
    // Use ThemeManager if available for consistent dialog colors
    try {
      if (typeof window.ThemeManager !== 'undefined') {
        return window.ThemeManager.getDialogColors(buttonColors.buttonText);
      }
    } catch (error) {
      console.warn('Error getting dialog colors from ThemeManager:', error);
    }

    // Fallback: determine if button color is dark or light
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
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        resolve({ showBookMyShowCopy: true });
        return;
      }

      try {
        chrome.storage.sync.get(['showBookMyShowCopy'], (result) => {
          resolve({
            showBookMyShowCopy: result.showBookMyShowCopy !== false
          });
        });
      } catch (e) {
        resolve({ showBookMyShowCopy: true });
      }
    });
  }

  function createCopyButton(text, colors, label = 'Copy') {
    const button = document.createElement('button');
    button.className = 'media-links-bms-copy-btn';
    button.textContent = label;
    button.title = 'Click to copy';

    Object.assign(button.style, {
      marginLeft: '8px',
      padding: '4px 12px',
      backgroundColor: colors.button,
      color: colors.buttonText,
      border: 'none',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'inline-block',
      verticalAlign: 'middle'
    });

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = colors.buttonHover;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = colors.button;
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        await navigator.clipboard.writeText(text);

        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.style.backgroundColor = '#10b981';

        setTimeout(() => {
          button.textContent = originalText;
          button.style.backgroundColor = colors.button;
        }, 1500);
      } catch (error) {
        console.error('Failed to copy:', error);
        button.textContent = '✗ Failed';
        button.style.backgroundColor = '#ef4444';

        setTimeout(() => {
          button.textContent = label;
          button.style.backgroundColor = colors.button;
        }, 1500);
      }
    });

    return button;
  }

  function showNotification(message, isSuccess = true) {
    const notification = document.createElement('div');
    notification.className = 'media-links-bms-notification';
    notification.textContent = message;

    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: isSuccess ? '#10b981' : '#ef4444',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: '999999',
      animation: 'slideInRight 0.3s ease'
    });

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  async function processMovieTitle(colors) {
    // Find movie title - BookMyShow typically has it in h1 or with specific classes
    const titleSelectors = [
      'h1',
      '[data-region="title"]',
      '.movie-title',
      '.__name'
    ];

    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && !titleElement.dataset.bmsCopyEnabled) {
        titleElement.dataset.bmsCopyEnabled = 'true';
        const title = titleElement.textContent.trim();

        if (title) {
          const copyBtn = createCopyButton(title, colors, 'Copy Title');

          // Create a wrapper div to hold both title and button without disrupting layout
          const wrapper = document.createElement('div');
          wrapper.style.display = 'inline-flex';
          wrapper.style.alignItems = 'center';
          wrapper.style.gap = '10px';
          wrapper.style.flexWrap = 'wrap';

          // Insert wrapper after title element and move title into it
          titleElement.parentNode.insertBefore(wrapper, titleElement);
          wrapper.appendChild(titleElement);
          wrapper.appendChild(copyBtn);
          break;
        }
      }
    }
  }

  function createBulkCopyDialog(members, colors, sectionName) {
    // Get theme-aware dialog colors
    const dialogColors = getDialogColors(colors);

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'media-links-bms-dialog-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '999998',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'media-links-bms-dialog';
    Object.assign(dialog.style, {
      backgroundColor: dialogColors.background,
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '500px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: `1px solid ${dialogColors.border}`,
      color: dialogColors.text
    });

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 20px; color: ${dialogColors.text};">Copy ${sectionName}</h3>
      <div style="margin-bottom: 20px; padding: 12px; background: ${dialogColors.inputBg}; border-radius: 6px; border: 1px solid ${dialogColors.inputBorder};">
        <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: ${dialogColors.text};">Number of ${sectionName.toLowerCase()} to copy:</label>
        <input type="number" id="bms-cast-count" min="1" max="${members.length}" value="5" style="width: 100%; padding: 8px 12px; border: 1px solid ${dialogColors.inputBorder}; background: ${dialogColors.background}; color: ${dialogColors.text}; border-radius: 6px; font-size: 14px;">
        <div style="margin-top: 8px; font-size: 12px; color: ${dialogColors.text}; opacity: 0.8;">Selected: <span id="bms-count-display">5</span> / ${members.length}</div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
        <button class="bms-copy-format" data-format="name-role" style="padding: 12px; border: 1px solid ${dialogColors.inputBorder}; border-radius: 6px; background: ${dialogColors.background}; color: ${dialogColors.text}; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s;">
          <strong>Name + Role</strong><br>
          <span style="font-size: 12px; color: ${dialogColors.text}; opacity: 0.7;">Harshvardhan Rane (Actor)</span>
        </button>
        <button class="bms-copy-format" data-format="name-only" style="padding: 12px; border: 1px solid ${dialogColors.inputBorder}; border-radius: 6px; background: ${dialogColors.background}; color: ${dialogColors.text}; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s;">
          <strong>Names Only</strong><br>
          <span style="font-size: 12px; color: ${dialogColors.text}; opacity: 0.7;">Harshvardhan Rane, Sonam Bajwa, ...</span>
        </button>
        <button class="bms-copy-format" data-format="role-only" style="padding: 12px; border: 1px solid ${dialogColors.inputBorder}; border-radius: 6px; background: ${dialogColors.background}; color: ${dialogColors.text}; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s;">
          <strong>Roles Only</strong><br>
          <span style="font-size: 12px; color: ${dialogColors.text}; opacity: 0.7;">Actor, Actor, Director, ...</span>
        </button>
        <button class="bms-copy-format" data-format="csv" style="padding: 12px; border: 1px solid ${dialogColors.inputBorder}; border-radius: 6px; background: ${dialogColors.background}; color: ${dialogColors.text}; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s;">
          <strong>CSV Format</strong><br>
          <span style="font-size: 12px; color: ${dialogColors.text}; opacity: 0.7;">Name,Role (one per line)</span>
        </button>
        <button class="bms-copy-format" data-format="json" style="padding: 12px; border: 1px solid ${dialogColors.inputBorder}; border-radius: 6px; background: ${dialogColors.background}; color: ${dialogColors.text}; cursor: pointer; text-align: left; font-size: 14px; transition: all 0.2s;">
          <strong>JSON Format</strong><br>
          <span style="font-size: 12px; color: ${dialogColors.text}; opacity: 0.7;">[{"name": "...", "role": "..."}]</span>
        </button>
      </div>
      <button class="bms-dialog-close" style="width: 100%; padding: 12px; background: ${dialogColors.cancelBg}; color: ${dialogColors.cancelText}; border: 1px solid ${dialogColors.border}; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">
        Close
      </button>
    `;

    overlay.appendChild(dialog);

    // Add count input listener
    const countInput = dialog.querySelector('#bms-cast-count');
    const countDisplay = dialog.querySelector('#bms-count-display');
    countInput.addEventListener('input', () => {
      const count = Math.min(parseInt(countInput.value) || 1, members.length);
      countInput.value = count;
      countDisplay.textContent = count;
    });

    // Add hover effects
    const formatButtons = dialog.querySelectorAll('.bms-copy-format');
    formatButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = dialogColors.inputBg;
        btn.style.borderColor = colors.button;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = dialogColors.background;
        btn.style.borderColor = dialogColors.inputBorder;
      });

      btn.addEventListener('click', async () => {
        const format = btn.dataset.format;
        const count = Math.min(parseInt(countInput.value) || 1, members.length);
        const selectedMembers = members.slice(0, count);
        let text = '';

        switch (format) {
          case 'name-role':
            text = selectedMembers.map(m => `${m.name} (${m.role})`).join('\n');
            break;
          case 'name-only':
            text = selectedMembers.map(m => m.name).join(', ');
            break;
          case 'role-only':
            text = selectedMembers.map(m => m.role).join(', ');
            break;
          case 'csv':
            text = 'Name,Role\n' + selectedMembers.map(m => `"${m.name}","${m.role}"`).join('\n');
            break;
          case 'json':
            text = JSON.stringify(selectedMembers, null, 2);
            break;
        }

        try {
          await navigator.clipboard.writeText(text);
          showNotification(`✓ Copied ${count} ${sectionName.toLowerCase()}!`, true);
          overlay.remove();
        } catch (error) {
          showNotification('✗ Failed to copy', false);
        }
      });
    });

    // Close dialog
    dialog.querySelector('.bms-dialog-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  async function processCastAndCrew(colors) {
    // Process Cast section
    processCastOrCrewSection('Cast', colors);

    // Process Crew section
    processCastOrCrewSection('Crew', colors);
  }

  function processCastOrCrewSection(sectionName, colors) {
    // Find the section header
    const headers = document.querySelectorAll('h4.sc-8zwcys-3, h4[class*="dBMMrU"]');
    let sectionHeader = null;

    headers.forEach(header => {
      if (header.textContent.trim() === sectionName) {
        sectionHeader = header;
      }
    });

    if (!sectionHeader || sectionHeader.dataset.bmsCopyEnabled) return;
    sectionHeader.dataset.bmsCopyEnabled = 'true';

    // Find the section container
    const section = sectionHeader.closest('section');
    if (!section) return;

    // Find all member links
    const memberLinks = section.querySelectorAll('a.sc-17p4id8-0, a[class*="chrvLp"]');
    const members = [];

    memberLinks.forEach(link => {
      const nameEl = link.querySelector('h5.sc-17p4id8-1, h5[class*="bXBEXa"]');
      const roleEl = link.querySelector('h5.sc-17p4id8-2, h5[class*="dddChM"]');

      if (nameEl && roleEl) {
        const name = nameEl.textContent.trim();
        const role = roleEl.textContent.trim();

        members.push({ name, role });

        // Make name clickable to copy
        if (!nameEl.dataset.bmsCopyEnabled) {
          nameEl.dataset.bmsCopyEnabled = 'true';
          nameEl.style.cursor = 'pointer';
          nameEl.style.transition = 'all 0.2s ease';
          nameEl.title = 'Click to copy name';

          // Store original styles for reset
          const originalNameStyles = {
            backgroundColor: nameEl.style.backgroundColor,
            color: nameEl.style.color
          };

          nameEl.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Visual feedback - highlight
            nameEl.style.backgroundColor = '#e8f5e9';
            nameEl.style.color = '#2e7d32';

            try {
              await navigator.clipboard.writeText(name);
              showNotification(`✓ Copied: ${name}`, true);
            } catch (error) {
              showNotification('✗ Failed to copy', false);
            }

            // Reset styling after a delay
            setTimeout(() => {
              nameEl.style.backgroundColor = originalNameStyles.backgroundColor;
              nameEl.style.color = originalNameStyles.color;
            }, 1000);
          });

          // Hover effects for visual indication
          nameEl.addEventListener('mouseenter', () => {
            nameEl.style.backgroundColor = '#f5f5f5';
            nameEl.style.opacity = '0.8';
          });
          nameEl.addEventListener('mouseleave', () => {
            nameEl.style.backgroundColor = originalNameStyles.backgroundColor;
            nameEl.style.opacity = '1';
          });
        }

        // Make role clickable to copy
        if (!roleEl.dataset.bmsCopyEnabled) {
          roleEl.dataset.bmsCopyEnabled = 'true';
          roleEl.style.cursor = 'pointer';
          roleEl.style.transition = 'all 0.2s ease';
          roleEl.title = 'Click to copy role';

          // Store original styles for reset
          const originalRoleStyles = {
            backgroundColor: roleEl.style.backgroundColor,
            color: roleEl.style.color
          };

          roleEl.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Visual feedback - highlight
            roleEl.style.backgroundColor = '#e8f5e9';
            roleEl.style.color = '#2e7d32';

            try {
              await navigator.clipboard.writeText(role);
              showNotification(`✓ Copied: ${role}`, true);
            } catch (error) {
              showNotification('✗ Failed to copy', false);
            }

            // Reset styling after a delay
            setTimeout(() => {
              roleEl.style.backgroundColor = originalRoleStyles.backgroundColor;
              roleEl.style.color = originalRoleStyles.color;
            }, 1000);
          });

          // Hover effects for visual indication
          roleEl.addEventListener('mouseenter', () => {
            roleEl.style.backgroundColor = '#f5f5f5';
            roleEl.style.opacity = '0.8';
          });
          roleEl.addEventListener('mouseleave', () => {
            roleEl.style.backgroundColor = originalRoleStyles.backgroundColor;
            roleEl.style.opacity = '1';
          });
        }
      }
    });

    if (members.length > 0) {
      // Create bulk copy button
      const bulkBtn = createCopyButton('', colors, `Copy All ${sectionName} (${members.length})`);
      bulkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        createBulkCopyDialog(members, colors, sectionName);
      });

      // Add button next to header
      const headerWrapper = sectionHeader.parentNode;
      headerWrapper.style.display = 'flex';
      headerWrapper.style.alignItems = 'center';
      headerWrapper.style.gap = '8px';
      headerWrapper.appendChild(bulkBtn);
    }
  }

  async function processMovieInfo(colors) {
    // Find movie info section (genre, language, duration, etc.)
    const infoSelectors = [
      '[data-region="info"]',
      '.movie-info',
      '.__genre',
      '[class*="movie-details"]'
    ];

    for (const selector of infoSelectors) {
      const infoSection = document.querySelector(selector);
      if (infoSection && !infoSection.dataset.bmsCopyEnabled) {
        infoSection.dataset.bmsCopyEnabled = 'true';

        const infoText = infoSection.textContent.trim();
        if (infoText) {
          const copyBtn = createCopyButton(infoText, colors, 'Copy Info');
          infoSection.style.display = 'inline-flex';
          infoSection.style.alignItems = 'center';
          infoSection.style.gap = '8px';
          infoSection.appendChild(copyBtn);
        }
        break;
      }
    }
  }

  async function processSynopsis(colors) {
    // Find synopsis/about section
    const synopsisSelectors = [
      '[data-region="synopsis"]',
      '.synopsis',
      '.about-movie',
      '[class*="synopsis"]',
      '[class*="about"]'
    ];

    for (const selector of synopsisSelectors) {
      const synopsisSection = document.querySelector(selector);
      if (synopsisSection && !synopsisSection.dataset.bmsCopyEnabled) {
        synopsisSection.dataset.bmsCopyEnabled = 'true';

        const synopsisText = synopsisSection.textContent.trim();
        if (synopsisText) {
          const copyBtn = createCopyButton(synopsisText, colors, 'Copy Synopsis');

          // Find header
          const header = synopsisSection.querySelector('h2, h3, .section-title');
          if (header) {
            header.style.display = 'inline-flex';
            header.style.alignItems = 'center';
            header.appendChild(copyBtn);
          } else {
            synopsisSection.insertBefore(copyBtn, synopsisSection.firstChild);
          }
        }
        break;
      }
    }
  }

  let isProcessingBMSButtons = false;

  async function addBookMyShowCopyButtons() {
    if (!isBookMyShowMoviePage()) return;

    // Prevent concurrent executions
    if (isProcessingBMSButtons) return;
    isProcessingBMSButtons = true;

    try {
      const settings = await getCopyButtonSettings();
      if (!settings.showBookMyShowCopy) {
        console.log('BookMyShow copy buttons disabled');
        return;
      }

      const colors = await getThemeColors();

      // Process different sections
      await processMovieTitle(colors);
      await processCastAndCrew(colors);
      await processMovieInfo(colors);
      await processSynopsis(colors);

      console.log('BookMyShow copy buttons added');
    } catch (error) {
      console.error('Error adding BookMyShow copy buttons:', error);
    } finally {
      isProcessingBMSButtons = false;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addBookMyShowCopyButtons);
  } else {
    addBookMyShowCopyButtons();
  }

  // Watch for dynamic content changes
  const observer = new MutationObserver(() => {
    if (!isProcessingBMSButtons) {
      addBookMyShowCopyButtons();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Re-check after navigation
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isBookMyShowMoviePage()) {
        setTimeout(addBookMyShowCopyButtons, 1000);
      }
    }
  }, 1000);

})();
