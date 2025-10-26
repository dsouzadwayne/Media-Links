// Apple TV+ Cast Copy Functionality

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
    console.log('Extension context invalidated, skipping Apple TV+ cast copy functionality');
    return;
  }

  // FEATURE 1: Inject CSS to enable text selection globally
  function enableTextSelection() {
    const style = document.createElement('style');
    style.id = 'media-links-appletv-text-select';
    style.textContent = `
      /* Enable text selection for all elements on Apple TV+ */
      * {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }

      /* Keep buttons and interactive elements clickable */
      button, a, input, select, [role="button"] {
        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
    console.log('Apple TV+ text selection enabled');
  }

  // FEATURE 2: Add copy buttons following the extension pattern

  function isAppleTVShowPage() {
    return window.location.hostname === 'tv.apple.com' &&
           (window.location.pathname.includes('/movie/') ||
            window.location.pathname.includes('/show/') ||
            window.location.pathname.includes('/episode/'));
  }

  function hasAppleTVCastAndCrew() {
    // Detect if this is an Apple TV+ page (saved or live) with Cast & Crew section
    const hasCastCrew = document.querySelector('[aria-label="Cast & Crew"]') !== null;
    const hasPersonLockup = document.querySelector('.person-lockup') !== null;
    const hasAppleTVStructure = document.querySelector('.content-logo') !== null;

    // Works on both saved pages AND live Apple TV+ pages with Cast & Crew section
    const hasAppleTVContent = hasCastCrew || hasPersonLockup || hasAppleTVStructure;

    if (hasAppleTVContent) {
      console.log('Detected Apple TV+ page with Cast & Crew:', {
        hasCastCrew,
        hasPersonLockup,
        hasAppleTVStructure,
        url: window.location.href,
        isLive: isAppleTVShowPage()
      });
    }

    return hasAppleTVContent;
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
        showAppleTVCast: true
      };

      try {
        if (!isExtensionContextValid()) {
          resolve(defaults);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['showAppleTVCast'], (result) => {
            if (chrome.runtime.lastError) {
              console.warn('Error getting copy button settings:', chrome.runtime.lastError);
              resolve(defaults);
            } else {
              resolve({
                showAppleTVCast: result.showAppleTVCast !== undefined ? result.showAppleTVCast : defaults.showAppleTVCast
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

  let isProcessingAppleTVButtons = false;

  async function addAppleTVCastButtons() {
    if (!isAppleTVShowPage()) return;

    // Prevent concurrent executions
    if (isProcessingAppleTVButtons) return;
    isProcessingAppleTVButtons = true;

    try {
      const settings = await getCopyButtonSettings();
      if (!settings.showAppleTVCast) {
        console.log('Apple TV+ copy buttons disabled');
        return;
      }

      const colors = await getThemeColors();

      // Process title
      processTitle(colors);

      // Process cast/crew (starring and director sections)
      processPersonnel(colors);

      // Process description
      processDescription(colors);

      // Process metadata (genre, year, etc.)
      processMetadata(colors);

      // Process episodes if present
      processEpisodes(colors);

    } finally {
      // Reset flag when done
      isProcessingAppleTVButtons = false;
    }
  }

  function processTitle(colors) {
    // Find the title in the content-logo or heading
    const titleImg = document.querySelector('.content-logo img');
    if (titleImg && !titleImg.dataset.appleTVCopyEnabled) {
      const title = titleImg.alt;
      if (title) {
        addCopyIconAfterElement(titleImg.closest('.content-logo'), title, colors, 'title');
      }
    }
  }

  function processPersonnel(colors) {
    // Find the personnel section
    const personnelSection = document.querySelector('.personnel');
    if (!personnelSection) return;

    // Process starring
    const starringTitle = Array.from(personnelSection.querySelectorAll('.personnel-title'))
      .find(el => el.textContent.trim() === 'Starring');

    if (starringTitle && !starringTitle.querySelector('.media-links-appletv-bulk-copy-btn')) {
      addBulkCopyButton(starringTitle, personnelSection, colors, 'Cast', '.personnel-list .person-link');
    }

    // Process director
    const directorTitle = Array.from(personnelSection.querySelectorAll('.personnel-title'))
      .find(el => el.textContent.trim() === 'Director');

    if (directorTitle && !directorTitle.querySelector('.media-links-appletv-bulk-copy-btn')) {
      addBulkCopyButton(directorTitle, personnelSection, colors, 'Director', '.personnel-list .person-link');
    }

    // Add click handlers to all person links
    const personLinks = personnelSection.querySelectorAll('.person-link');
    addCopyHandlersToLinks(personLinks);
  }

  function processDescription(colors) {
    // Find description text
    const description = document.querySelector('[data-testid="truncate-text"]');
    if (description && !description.dataset.appleTVCopyEnabled) {
      description.dataset.appleTVCopyEnabled = 'true';
      const descText = description.textContent.trim();

      // Add copy button next to the MORE button or at the end of description
      const moreButton = document.querySelector('[data-testid="truncate-more-button"]');
      if (moreButton && !moreButton.previousElementSibling?.classList?.contains('media-links-appletv-inline-copy')) {
        const copyBtn = createInlineCopyButton(descText, colors, 'description');
        moreButton.parentNode.insertBefore(copyBtn, moreButton);
      }
    }
  }

  function processMetadata(colors) {
    // Process genres from metadata
    const metadataList = document.querySelector('.metadata .metadata-list');
    if (metadataList && !metadataList.dataset.appleTVCopyEnabled) {
      metadataList.dataset.appleTVCopyEnabled = 'true';
      const spans = metadataList.querySelectorAll('span');

      spans.forEach(span => {
        const text = span.textContent.trim();
        if (text && text !== '·' && !span.dataset.appleTVCopyEnabled) {
          span.dataset.appleTVCopyEnabled = 'true';
          span.style.cursor = 'pointer';
          span.title = `Click to copy: ${text}`;

          span.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            navigator.clipboard.writeText(text).then(() => {
              showCopyNotification(span, text);
            }).catch(err => {
              console.error('Failed to copy:', err);
              showCopyNotification(span, text, true);
            });
          }, true); // Use capture phase
        }
      });
    }
  }

  function processEpisodes(colors) {
    // Find episodes section
    const episodesSection = document.querySelector('[aria-label="Episodes"]');
    if (!episodesSection) return;

    // Find season selector header
    const seasonHeader = episodesSection.querySelector('.header-title-wrapper h2');
    if (seasonHeader && !seasonHeader.querySelector('.media-links-appletv-bulk-copy-btn')) {
      addBulkCopyButton(seasonHeader, episodesSection, colors, 'Episodes', '.metadata .title');
    }

    // Process individual episode titles
    const episodeTitles = episodesSection.querySelectorAll('.metadata .title');
    episodeTitles.forEach(title => {
      if (!title.dataset.appleTVCopyEnabled) {
        title.dataset.appleTVCopyEnabled = 'true';
        const episodeText = title.textContent.trim();

        title.style.cursor = 'pointer';
        title.title = `Click to copy: ${episodeText}`;

        title.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          navigator.clipboard.writeText(episodeText).then(() => {
            showCopyNotification(title, episodeText);
          }).catch(err => {
            console.error('Failed to copy:', err);
            showCopyNotification(title, episodeText, true);
          });
        }, true); // Use capture phase
      }
    });
  }

  function addCopyHandlersToLinks(links) {
    links.forEach(link => {
      if (link.dataset.appleTVCopyEnabled) return;

      link.dataset.appleTVCopyEnabled = 'true';
      const itemName = link.textContent.trim();

      link.style.cursor = 'pointer';
      const originalTitle = link.title || '';
      link.title = originalTitle ? `${originalTitle} - Click to copy (Ctrl/Cmd+Click to visit)` : `Click to copy: ${itemName} (Ctrl/Cmd+Click to visit)`;

      // Use capture phase to intercept clicks before they reach the link
      link.addEventListener('click', (e) => {
        // Allow Ctrl/Cmd+Click to open link normally
        if (e.ctrlKey || e.metaKey) {
          return;
        }

        // Prevent navigation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Copy to clipboard
        navigator.clipboard.writeText(itemName).then(() => {
          showCopyNotification(link, itemName);
        }).catch(err => {
          console.error('Failed to copy:', err);
          showCopyNotification(link, itemName, true);
        });
      }, true); // Use capture phase
    });
  }

  // SAVED PAGE PROCESSING FUNCTIONS
  function processSavedPageCastAndCrew(colors) {
    console.log('Processing saved page Cast & Crew...');

    // Find the Cast & Crew section
    const castCrewSection = document.querySelector('[aria-label="Cast & Crew"]');
    if (!castCrewSection) {
      console.log('Cast & Crew section not found');
      return;
    }

    console.log('Cast & Crew section found:', castCrewSection);

    // Find the section header - try multiple selectors
    let sectionHeader = castCrewSection.querySelector('.header-title-wrapper h2');
    if (!sectionHeader) {
      sectionHeader = castCrewSection.querySelector('[data-testid="header-title"]');
    }
    if (!sectionHeader) {
      sectionHeader = castCrewSection.querySelector('.title.title-link');
    }

    console.log('Section header found:', sectionHeader);

    if (sectionHeader && !sectionHeader.querySelector('.media-links-appletv-bulk-copy-btn')) {
      // Add bulk copy button to the header
      const button = document.createElement('button');
      button.className = 'media-links-appletv-bulk-copy-btn';
      button.innerHTML = '📋 Copy All';
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
        showSavedPageCopyDialog(castCrewSection);
      });

      sectionHeader.style.display = 'inline-flex';
      sectionHeader.style.alignItems = 'center';
      sectionHeader.appendChild(button);
    }

    // Process individual person lockups
    const personLockups = castCrewSection.querySelectorAll('.person-lockup');
    console.log(`Found ${personLockups.length} person lockups`);

    personLockups.forEach(lockup => {
      if (lockup.dataset.appleTVCopyEnabled) return;
      lockup.dataset.appleTVCopyEnabled = 'true';

      const titleEl = lockup.querySelector('[data-testid="person-title"]');
      const subtitleEl = lockup.querySelector('[data-testid="person-subtitle"]');

      if (!titleEl) return;

      const name = titleEl.textContent.trim();
      const role = subtitleEl ? subtitleEl.textContent.trim() : '';
      const fullText = role ? `${name}:${role}` : name;

      // Make the entire lockup clickable for full name:role copy
      lockup.style.cursor = 'pointer';
      lockup.title = `Click to copy: ${fullText} (Ctrl/Cmd+Click to visit)`;

      // Add individual copy handler for name (title)
      if (!titleEl.dataset.appleTVIndividualCopy) {
        titleEl.dataset.appleTVIndividualCopy = 'true';
        titleEl.style.cursor = 'pointer';
        titleEl.style.transition = 'all 0.2s';
        titleEl.title = `Click to copy: ${name}`;

        titleEl.addEventListener('click', (e) => {
          // Allow Ctrl/Cmd+Click to navigate
          if (e.ctrlKey || e.metaKey) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          navigator.clipboard.writeText(name).then(() => {
            showCopyNotification(titleEl, name);
          }).catch(err => {
            console.error('Failed to copy:', err);
            showCopyNotification(titleEl, name, true);
          });
        }, true);

        // Add hover effect for name
        titleEl.addEventListener('mouseenter', () => {
          titleEl.style.textDecoration = 'underline';
        });
        titleEl.addEventListener('mouseleave', () => {
          titleEl.style.textDecoration = 'none';
        });
      }

      // Add individual copy handler for role (subtitle)
      if (subtitleEl && role && !subtitleEl.dataset.appleTVIndividualCopy) {
        subtitleEl.dataset.appleTVIndividualCopy = 'true';
        subtitleEl.style.cursor = 'pointer';
        subtitleEl.style.transition = 'all 0.2s';
        subtitleEl.title = `Click to copy: ${role}`;

        subtitleEl.addEventListener('click', (e) => {
          // Allow Ctrl/Cmd+Click to navigate
          if (e.ctrlKey || e.metaKey) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          navigator.clipboard.writeText(role).then(() => {
            showCopyNotification(subtitleEl, role);
          }).catch(err => {
            console.error('Failed to copy:', err);
            showCopyNotification(subtitleEl, role, true);
          });
        }, true);

        // Add hover effect for role
        subtitleEl.addEventListener('mouseenter', () => {
          subtitleEl.style.textDecoration = 'underline';
        });
        subtitleEl.addEventListener('mouseleave', () => {
          subtitleEl.style.textDecoration = 'none';
        });
      }

      // Add click handler for the lockup (background/image area) - copies full text
      lockup.addEventListener('click', (e) => {
        // Allow Ctrl/Cmd+Click to navigate
        if (e.ctrlKey || e.metaKey) {
          return;
        }

        // Only copy full text if clicking on the lockup itself, not on title or subtitle
        if (e.target === titleEl || e.target === subtitleEl ||
            titleEl.contains(e.target) || (subtitleEl && subtitleEl.contains(e.target))) {
          return; // Let the individual handlers take care of it
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        navigator.clipboard.writeText(fullText).then(() => {
          showCopyNotification(lockup, fullText);
        }).catch(err => {
          console.error('Failed to copy:', err);
          showCopyNotification(lockup, fullText, true);
        });
      }, true);
    });
  }

  async function showSavedPageCopyDialog(container) {
    const colors = await getThemeColors();
    const dialogColors = getDialogColors(colors);

    // Get default settings
    const defaults = await new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve({ count: 10, output: 'colon', includeRoles: true });
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['appleTVCastCount', 'appleTVOutputFormat', 'appleTVIncludeRoles'], (result) => {
            if (chrome.runtime.lastError) {
              resolve({ count: 10, output: 'colon', includeRoles: true });
            } else {
              resolve({
                count: result.appleTVCastCount || 10,
                output: result.appleTVOutputFormat || 'colon',
                includeRoles: result.appleTVIncludeRoles !== undefined ? result.appleTVIncludeRoles : true
              });
            }
          });
        } else {
          resolve({ count: 10, output: 'colon', includeRoles: true });
        }
      } catch (error) {
        resolve({ count: 10, output: 'colon', includeRoles: true });
      }
    });

    // Collect cast and crew data
    const items = [];
    const personLockups = container.querySelectorAll('.person-lockup');

    personLockups.forEach(lockup => {
      const titleEl = lockup.querySelector('[data-testid="person-title"]');
      const subtitleEl = lockup.querySelector('[data-testid="person-subtitle"]');

      if (titleEl) {
        const name = titleEl.textContent.trim();
        const role = subtitleEl ? subtitleEl.textContent.trim() : '';
        items.push({ name, role });
      }
    });

    if (items.length === 0) {
      showNotification('No cast & crew found!', true);
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
      z-index: 99999;
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
      z-index: 100000;
      min-width: 400px;
      max-width: 500px;
      border: 1px solid ${dialogColors.border};
      animation: slideIn 0.3s ease-out;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.button}; padding-bottom: 10px;">
        📋 Copy Cast & Crew
      </h3>
      <div style="margin-bottom: 18px;">
        <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of items:</label>
        <input type="number" id="appletv-saved-item-count" min="1" max="1000" value="${Math.min(defaults.count, items.length)}"
          style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
          background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
          onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
          onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
      </div>
      <div style="margin-bottom: 18px;">
        <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Include Roles:</label>
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" id="appletv-saved-include-roles" ${defaults.includeRoles ? 'checked' : ''}
            style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
          <span style="color: ${dialogColors.text};">Include character/role names</span>
        </label>
      </div>
      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
        <select id="appletv-saved-output-format"
          style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
          background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
          onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
          onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
          <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line</option>
          <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated</option>
          <option value="colon" ${defaults.output === 'colon' ? 'selected' : ''}>Name:Role format</option>
          <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="appletv-saved-copy-btn"
          style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
          font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
          onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
          onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
          Copy
        </button>
        <button id="appletv-saved-cancel-btn"
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
    dialog.querySelector('#appletv-saved-copy-btn').addEventListener('click', () => {
      const count = parseInt(dialog.querySelector('#appletv-saved-item-count').value);
      const includeRoles = dialog.querySelector('#appletv-saved-include-roles').checked;
      const outputFormat = dialog.querySelector('#appletv-saved-output-format').value;

      const limitedItems = items.slice(0, count);
      let text = '';

      switch(outputFormat) {
        case 'newline':
          text = limitedItems.map(item => includeRoles && item.role ? `${item.name} - ${item.role}` : item.name).join('\n');
          break;

        case 'comma':
          text = limitedItems.map(item => includeRoles && item.role ? `${item.name} (${item.role})` : item.name).join(', ');
          break;

        case 'colon':
          // Format: "Actor:Role, Actor:Role, ..."
          text = limitedItems.map(item => {
            if (includeRoles && item.role) {
              return `${item.name}:${item.role}`;
            }
            return item.name;
          }).join(', ');
          break;

        case 'json':
          if (includeRoles) {
            text = JSON.stringify(limitedItems, null, 2);
          } else {
            text = JSON.stringify(limitedItems.map(item => item.name), null, 2);
          }
          break;
      }

      navigator.clipboard.writeText(text).then(() => {
        showNotification(`Copied ${limitedItems.length} cast & crew members!`);
        closeDialog();
      }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy to clipboard', true);
      });
    });

    // Handle cancel
    dialog.querySelector('#appletv-saved-cancel-btn').addEventListener('click', closeDialog);
  }

  function createInlineCopyButton(text, colors, label) {
    const button = document.createElement('button');
    button.className = 'media-links-appletv-inline-copy';
    button.innerHTML = '📋';
    button.title = `Copy ${label}`;
    button.style.cssText = `
      margin-left: 8px;
      padding: 4px 8px;
      background: ${colors.button};
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
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

      navigator.clipboard.writeText(text).then(() => {
        showNotification(`Copied ${label}!`);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification(`Failed to copy ${label}`, true);
      });
    });

    return button;
  }

  function addCopyIconAfterElement(element, text, colors, label) {
    if (!element || element.dataset.appleTVCopyEnabled) return;
    element.dataset.appleTVCopyEnabled = 'true';

    const copyBtn = createInlineCopyButton(text, colors, label);
    element.parentNode.insertBefore(copyBtn, element.nextSibling);
  }

  function addBulkCopyButton(heading, container, colors, sectionName, selector) {
    const button = document.createElement('button');
    button.className = 'media-links-appletv-bulk-copy-btn';
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
      showCopyDialog(container, sectionName, selector);
    });

    // Make heading inline to accommodate button
    heading.style.display = 'inline-flex';
    heading.style.alignItems = 'center';
    heading.appendChild(button);
  }

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
      position: fixed;
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

  async function showCopyDialog(container, sectionName, selector) {
    const colors = await getThemeColors();
    const dialogColors = getDialogColors(colors);

    // Get default settings
    const defaults = await new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve({ count: 10, output: 'colon' });
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['appleTVCastCount', 'appleTVOutputFormat'], (result) => {
            if (chrome.runtime.lastError) {
              resolve({ count: 10, output: 'colon' });
            } else {
              resolve({
                count: result.appleTVCastCount || 10,
                output: result.appleTVOutputFormat || 'colon'
              });
            }
          });
        } else {
          resolve({ count: 10, output: 'colon' });
        }
      } catch (error) {
        resolve({ count: 10, output: 'colon' });
      }
    });

    // Collect items based on selector
    const items = [];
    const elements = container.querySelectorAll(selector);

    elements.forEach(el => {
      const text = el.textContent.trim();
      if (text) {
        items.push(text);
      }
    });

    if (items.length === 0) {
      showNotification(`No ${sectionName} found!`, true);
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
      z-index: 99999;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('media-links-appletv-animations')) {
      const style = document.createElement('style');
      style.id = 'media-links-appletv-animations';
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
    }

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
      z-index: 100000;
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
        <input type="number" id="appletv-item-count" min="1" max="1000" value="${Math.min(defaults.count, items.length)}"
          style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
          background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
          onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
          onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
      </div>
      <div style="margin-bottom: 25px;">
        <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
        <select id="appletv-output-format"
          style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
          background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
          onfocus="this.style.borderColor='${colors.button}'; this.style.boxShadow='0 0 0 3px ${colors.button}33'"
          onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
          <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line</option>
          <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated</option>
          <option value="colon" ${defaults.output === 'colon' ? 'selected' : ''}>Name:Role format</option>
          <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
        </select>
      </div>
      <div style="display: flex; gap: 12px;">
        <button id="appletv-copy-btn"
          style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
          font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.button}44;"
          onmouseover="this.style.background='${colors.buttonHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.button}66'"
          onmouseout="this.style.background='${colors.button}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.button}44'">
          Copy
        </button>
        <button id="appletv-cancel-btn"
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
    dialog.querySelector('#appletv-copy-btn').addEventListener('click', () => {
      const count = parseInt(dialog.querySelector('#appletv-item-count').value);
      const outputFormat = dialog.querySelector('#appletv-output-format').value;
      copyData(items, count, outputFormat, sectionName);
      closeDialog();
    });

    // Handle cancel
    dialog.querySelector('#appletv-cancel-btn').addEventListener('click', closeDialog);
  }

  function copyData(items, count, outputFormat, sectionName) {
    const limitedItems = items.slice(0, count);

    if (limitedItems.length === 0) {
      showNotification('No items found!', true);
      return;
    }

    let text = '';

    switch(outputFormat) {
      case 'newline':
        text = limitedItems.join('\n');
        break;

      case 'comma':
        text = limitedItems.join(', ');
        break;

      case 'colon':
        // For regular items (episodes, etc), just use comma separated
        text = limitedItems.join(', ');
        break;

      case 'json':
        text = JSON.stringify(limitedItems, null, 2);
        break;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      showNotification(`Copied ${limitedItems.length} ${sectionName}!`);
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
      border-radius: 8px;
      z-index: 100001;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 200);
      }
    }, 3000);
  }

  // Initialize: Enable text selection immediately
  enableTextSelection();

  console.log('AppleTV Cast Copy script loaded', {
    url: window.location.href,
    hostname: window.location.hostname,
    protocol: window.location.protocol
  });

  // Initialize: Add copy buttons for pages with Cast & Crew
  const hasCastAndCrew = hasAppleTVCastAndCrew(); // This works for both saved and live pages

  if (hasCastAndCrew) {
    console.log('✓ Detected Apple TV+ page with Cast & Crew, adding copy functionality');

    getCopyButtonSettings().then(settings => {
      console.log('Copy button settings:', settings);

      if (!settings.showAppleTVCast) {
        console.log('Apple TV+ copy buttons disabled in settings');
        return;
      }

      const colors = getThemeColors();

      // Initial processing with multiple delays to catch dynamic loading
      colors.then(c => {
        console.log('Got theme colors:', c);

        // Process Cast & Crew
        processSavedPageCastAndCrew(c);

        // If on live Apple TV+, also process other elements
        if (isAppleTVShowPage()) {
          processTitle(c);
          processPersonnel(c);
          processDescription(c);
          processMetadata(c);
          processEpisodes(c);
        }

        // Try again after 1 second
        setTimeout(() => {
          processSavedPageCastAndCrew(c);
          if (isAppleTVShowPage()) {
            processTitle(c);
            processPersonnel(c);
            processDescription(c);
            processMetadata(c);
            processEpisodes(c);
          }
        }, 1000);

        // Try again after 2 seconds
        setTimeout(() => {
          processSavedPageCastAndCrew(c);
          if (isAppleTVShowPage()) {
            processTitle(c);
            processPersonnel(c);
            processDescription(c);
            processMetadata(c);
            processEpisodes(c);
          }
        }, 2000);
      });

      // Watch for dynamic content loading
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          colors.then(c => {
            processSavedPageCastAndCrew(c);
            if (isAppleTVShowPage()) {
              processTitle(c);
              processPersonnel(c);
              processDescription(c);
              processMetadata(c);
              processEpisodes(c);
            }
          });
        }, 500);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }).catch(err => {
      console.error('Error getting copy button settings:', err);
    });
  }

  // Initialize: Add copy buttons for other elements on live Apple TV+ pages
  // Only run if we're on Apple TV+ but DON'T have Cast & Crew (to avoid conflicts)
  if (isAppleTVShowPage() && !hasCastAndCrew) {
    getCopyButtonSettings().then(settings => {
      if (!settings.showAppleTVCast) {
        console.log('Apple TV+ copy buttons disabled');
        return;
      }

      // Initial load - wait for page to render
      setTimeout(addAppleTVCastButtons, 2000);

      // Debounce mechanism
      let debounceTimer = null;

      // Watch for dynamic content loading
      const observer = new MutationObserver((mutations) => {
        const hasNewContent = mutations.some(mutation => {
          return mutation.addedNodes.length > 0 &&
            Array.from(mutation.addedNodes).some(node => {
              if (node.nodeType === 1 &&
                  (node.classList &&
                    (node.classList.contains('media-links-appletv-bulk-copy-btn') ||
                     node.classList.contains('media-links-appletv-inline-copy')))) {
                return false;
              }

              return node.nodeType === 1 &&
                (node.querySelector && (
                  node.querySelector('.person-link') ||
                  node.querySelector('.metadata .title') ||
                  node.querySelector('[data-testid="truncate-text"]') ||
                  node.matches('.personnel') ||
                  node.matches('.lockup.svelte-93u9ds')
                ));
            });
        });

        if (hasNewContent) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            addAppleTVCastButtons();
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

      window.addEventListener('pagehide', () => {
        observer.disconnect();
        clearTimeout(debounceTimer);
      });
    });
  }

})(); // End of IIFE
