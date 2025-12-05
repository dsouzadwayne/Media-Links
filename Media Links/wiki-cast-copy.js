// Wikipedia Cast Copy Functionality

(function() {
  'use strict';

  // EARLY EXIT: Only run on Wikipedia pages
  if (!window.location.hostname.includes('wikipedia.org')) {
    // Exit silently if not on Wikipedia
    return;
  }

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
    console.log('Extension context invalidated, skipping Wikipedia cast copy functionality');
    return;
  }

function isWikipediaCastPage() {
  // IMPORTANT: Only run on Wikipedia, NOT on IMDb or other sites
  if (!window.location.hostname.includes('wikipedia.org')) {
    return false;
  }

  // Check if it has either a Cast section or an infobox (for movies/TV shows)
  return document.querySelector('#Cast') ||
         document.querySelector('#cast') ||
         document.querySelector('#Cast_and_characters') ||
         document.querySelector('.infobox');
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

function getCopyButtonSettings() {
  // Get copy button visibility settings from storage
  return new Promise((resolve) => {
    const defaults = {
      showWikiCast: true,
      showWikiTables: true
    };

    try {
      if (!isExtensionContextValid()) {
        resolve(defaults);
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['showWikiCast', 'showWikiTables'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('Error getting copy button settings:', chrome.runtime.lastError);
            resolve(defaults);
          } else {
            resolve({
              showWikiCast: result.showWikiCast !== undefined ? result.showWikiCast : defaults.showWikiCast,
              showWikiTables: result.showWikiTables !== undefined ? result.showWikiTables : defaults.showWikiTables
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

let isProcessingWikiButtons = false;

async function addWikipediaCastButtons() {
  if (!isWikipediaCastPage()) return;

  // Prevent concurrent executions
  if (isProcessingWikiButtons) return;
  isProcessingWikiButtons = true;

  try {
    const colors = await getThemeColors();
    const settings = await getCopyButtonSettings();

  // Find all cast list items (including "Cast and characters" for TV shows)
  const castSections = document.querySelectorAll('#Cast, #cast, #Cast_and_characters');

  castSections.forEach(castSection => {
    // Add bulk copy button to the cast section heading if cast is enabled
    if (settings.showWikiCast) {
      addBulkCopyButton(castSection, colors);
    }

    // Get the parent element and find all lists after the Cast heading
    let currentElement = castSection.parentElement;

    // Determine the heading level of the cast section
    // BUG FIX: Validate that tagName is a heading (H1-H6) before parsing
    const tagName = castSection.tagName || '';
    const headingMatch = tagName.match(/^H([1-6])$/);

    if (!headingMatch) {
      console.warn('Wiki Cast Copy: Cast section element is not a heading:', tagName, '- defaulting to H2 level');
    }

    const castHeadingLevel = headingMatch ? parseInt(headingMatch[1], 10) : 2; // Default to H2 if not a valid heading

    // Traverse siblings to find ul elements and tables
    while (currentElement && currentElement.nextElementSibling) {
      currentElement = currentElement.nextElementSibling;

      // Stop only at headings of the same level or higher (e.g., if Cast is H2, stop at next H2 or H1)
      // LOW FIX: Use safer regex matching for heading level extraction
      const currentTagMatch = currentElement.tagName && currentElement.tagName.match(/^H([1-6])$/);
      if (currentTagMatch) {
        const currentHeadingLevel = parseInt(currentTagMatch[1], 10);
        if (currentHeadingLevel <= castHeadingLevel) {
          break;
        }
      }

      // Check if it's a mw-heading div that contains a same-level or higher heading
      if (currentElement.classList.contains('mw-heading')) {
        const headingInside = currentElement.querySelector('h1, h2, h3, h4, h5, h6');
        if (headingInside) {
          const headingInsideLevel = parseInt(headingInside.tagName.substring(1));
          if (headingInsideLevel <= castHeadingLevel) {
            break; // Stop processing - we've reached another section at same or higher level
          }
        }
        continue; // Skip this mw-heading div and continue to next element
      }

      // Process ul elements if cast is enabled (could be direct UL or inside div-col)
      if (currentElement.tagName === 'UL' && settings.showWikiCast) {
        processCastList(currentElement, colors);
      } else if (currentElement.classList && currentElement.classList.contains('div-col') && settings.showWikiCast) {
        // Cast lists are often wrapped in div-col, process ULs inside
        const ulsInside = currentElement.querySelectorAll('ul');
        ulsInside.forEach(ul => processCastList(ul, colors));
      }

      // Process table elements (infobox cast lists) if tables are enabled
      if (currentElement.tagName === 'TABLE' && settings.showWikiTables) {
        processCastTable(currentElement, colors);
      }
    }
  });

  // Also process all infobox tables anywhere on the page if tables are enabled
  if (settings.showWikiTables) {
    const infoboxes = document.querySelectorAll('.infobox');
    infoboxes.forEach(infobox => {
      processCastTable(infobox, colors);
    });
  }
  } finally {
    // Reset flag when done
    isProcessingWikiButtons = false;
  }
}

function addBulkCopyButton(castSection, colors) {
  // Skip if button already added
  if (castSection.parentElement.querySelector('.media-links-wiki-bulk-copy-btn')) return;

  const button = document.createElement('button');
  button.className = 'media-links-wiki-bulk-copy-btn';
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
    showWikiCopyDialog(castSection, 'Cast');
  });

  // Insert after the cast heading
  castSection.parentElement.style.display = 'inline-flex';
  castSection.parentElement.style.alignItems = 'center';
  castSection.insertAdjacentElement('afterend', button);
}

function addTableBulkCopyButton(th, td, colors, sectionName) {
  // Skip if button already added
  if (th.querySelector('.media-links-wiki-table-bulk-copy-btn')) return;

  const button = document.createElement('button');
  button.className = 'media-links-wiki-table-bulk-copy-btn';
  button.innerHTML = '📋';
  button.style.cssText = `
    margin-left: 6px;
    padding: 4px 8px;
    background: ${colors.button};
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
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
    showTableCopyDialog(td, sectionName);
  });

  // Insert at the end of the th element
  th.appendChild(button);
}

function processCastTable(tableElement, colors) {
  // Skip if this table has already been processed
  if (tableElement.dataset.mediaLinksProcessed === 'true') {
    return;
  }
  tableElement.dataset.mediaLinksProcessed = 'true';

  // Find all rows with th/td structure
  const rows = tableElement.querySelectorAll('tr');

  rows.forEach(row => {
    const th = row.querySelector('th');
    const td = row.querySelector('td');

    // Check if this row has both th and td
    if (th && td) {
      // Get the section name from the th element, excluding any bulk copy button text
      const thClone = th.cloneNode(true);
      const bulkButton = thClone.querySelector('.media-links-wiki-table-bulk-copy-btn');
      if (bulkButton) {
        bulkButton.remove();
      }
      const sectionName = thClone.textContent.trim();

      // Get text content from td, excluding any copy buttons
      const tdClone = td.cloneNode(true);
      tdClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
      const tdText = tdClone.textContent.trim();
      if (!tdText) return;

      // Add bulk copy button to the th element
      addTableBulkCopyButton(th, td, colors, sectionName);

      // Check if there are list items first
      const listItems = td.querySelectorAll('li');

      if (listItems.length > 0) {
        // Process each list item individually
        listItems.forEach(li => {
          // Skip if already has a copy button
          if (li.querySelector('.media-links-wiki-name-copy-btn') ||
              li.querySelector('.media-links-wiki-role-copy-btn')) return;

          // Check if this list item has a wiki link
          const link = li.querySelector('a[href*="/wiki/"]');

          if (link) {
            // Add button after the link
            const itemName = link.textContent.trim();
            if (itemName) {
              const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => itemName);
              link.insertAdjacentElement('afterend', copyBtn);
            }
          } else {
            // No link - add button for the entire list item text
            const liClone = li.cloneNode(true);
            liClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
            const itemText = liClone.textContent.trim();

            if (itemText) {
              const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => itemText);
              copyBtn.style.marginLeft = '4px';
              li.appendChild(copyBtn);
            }
          }
        });
      } else {
        // No list items - check if there are direct wiki links
        const allLinks = td.querySelectorAll('a[href*="/wiki/"]');

        if (allLinks.length > 0) {
          // Add copy buttons next to each link
          allLinks.forEach(link => {
            // Skip if there's already a copy button next to this link
            const nextSibling = link.nextElementSibling;
            if (nextSibling && (
              nextSibling.classList.contains('media-links-wiki-name-copy-btn') ||
              nextSibling.classList.contains('media-links-wiki-role-copy-btn')
            )) return;

            const itemName = link.textContent.trim();
            if (itemName) {
              const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => itemName);
              link.insertAdjacentElement('afterend', copyBtn);
            }
          });
        } else {
          // No links and no list items - check if there are <br> tags separating names
          const brTags = td.querySelectorAll('br');

          if (brTags.length > 0) {
            // Plain text with <br> separators - parse individual names
            // Clone to get clean text
            const tdClone = td.cloneNode(true);
            tdClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn, .media-links-wiki-table-bulk-copy-btn').forEach(btn => btn.remove());

            // Split by <br> tags to get individual names
            const html = tdClone.innerHTML;
            const names = html.split(/<br\s*\/?>/i)
              .map(name => name.trim())
              .filter(name => name && !name.match(/^<|>$/)); // Filter out HTML artifacts

            if (names.length > 1) {
              // Multiple names - insert buttons after each <br>
              let insertPoint = td.firstChild;
              names.forEach((name, index) => {
                // Create a text node for the name if needed
                const nameText = name.replace(/<[^>]*>/g, '').trim(); // Strip any remaining HTML
                if (nameText) {
                  const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => nameText);
                  copyBtn.style.marginLeft = '4px';

                  // Find the br tag and insert button after the text before it
                  if (index < brTags.length) {
                    brTags[index].insertAdjacentElement('beforebegin', copyBtn);
                  } else {
                    // Last item - append to end
                    td.appendChild(copyBtn);
                  }
                }
              });
            } else {
              // Single name or fallback - add one button for entire cell
              if (!td.querySelector('.media-links-wiki-name-copy-btn') &&
                  !td.querySelector('.media-links-wiki-role-copy-btn')) {
                const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => tdText);
                copyBtn.style.marginLeft = '8px';
                td.appendChild(copyBtn);
              }
            }
          } else {
            // No links, no list items, no br tags - add a single copy button for the entire cell content
            // Check if button already exists
            if (!td.querySelector('.media-links-wiki-name-copy-btn') &&
                !td.querySelector('.media-links-wiki-role-copy-btn')) {
              const copyBtn = createCopyButton(`Copy ${sectionName.toLowerCase()}`, () => tdText);
              copyBtn.style.marginLeft = '8px';
              td.appendChild(copyBtn);
            }
          }
        }
      }
    }
  });
}

function processCastList(listElement, colors) {
  // Skip if this list has already been processed
  if (listElement.dataset.mediaLinksProcessed === 'true') {
    return;
  }
  listElement.dataset.mediaLinksProcessed = 'true';

  const listItems = listElement.querySelectorAll('li');

  listItems.forEach(item => {
    // Skip if already has copy buttons
    if (item.querySelector('.media-links-wiki-name-copy-btn') || item.querySelector('.media-links-wiki-role-copy-btn')) return;

    // Parse the list item format: "Actor Name as Character Name"
    const links = item.querySelectorAll('a');

    // Handle plain text items without links
    if (links.length === 0) {
      // Clone item and remove any existing buttons and citations to get clean text
      const itemClone = item.cloneNode(true);
      itemClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
      removeCitations(itemClone);
      const itemText = itemClone.textContent.trim();
      if (!itemText) return;

      // Check if it has " as " format
      const asIndex = itemText.indexOf(' as ');
      if (asIndex !== -1) {
        const actorName = removeNickname(itemText.substring(0, asIndex).trim());
        const characterName = removeNickname(itemText.substring(asIndex + 4).trim());

        // Create copy button for actor name
        const copyNameBtn = createCopyButton('Copy actor name', () => actorName);
        item.style.display = 'inline';
        item.appendChild(copyNameBtn);

        // Create copy button for character name if exists
        if (characterName) {
          const copyRoleBtn = createCopyButton('Copy character name', () => characterName);
          item.appendChild(copyRoleBtn);
        }
      } else {
        // Just a plain name without " as "
        const copyBtn = createCopyButton('Copy name', () => removeNickname(itemText));
        item.style.display = 'inline';
        item.appendChild(copyBtn);
      }
      return;
    }

    // First link is usually the actor
    const actorLink = links[0];
    // Clone the link to get clean text without buttons and citations
    const actorLinkClone = actorLink.cloneNode(true);
    actorLinkClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
    removeCitations(actorLinkClone);
    const actorName = removeNickname(actorLinkClone.textContent.trim());

    // Find "as" text and get character name (use clone to avoid button text)
    let characterName = '';
    const itemClone = item.cloneNode(true);
    itemClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
    removeCitations(itemClone);
    const itemText = itemClone.textContent;
    const asIndex = itemText.indexOf(' as ');

    if (asIndex !== -1) {
      // Extract text after " as "
      const afterAs = itemText.substring(asIndex + 4);

      // Try to find character link (second link) - use clone to avoid button text and citations
      const itemCloneForChar = item.cloneNode(true);
      itemCloneForChar.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
      removeCitations(itemCloneForChar);
      const linksInClone = itemCloneForChar.querySelectorAll('a');

      if (linksInClone.length > 1) {
        characterName = removeNickname(linksInClone[1].textContent.trim());
      } else {
        // No link, just get the text until comma or end
        const commaIndex = afterAs.indexOf(',');
        const rawCharName = commaIndex !== -1 ? afterAs.substring(0, commaIndex).trim() : afterAs.trim();
        characterName = removeNickname(rawCharName);
      }
    }

    // Create copy button for actor name
    const copyNameBtn = createCopyButton('Copy actor name', () => actorName);
    actorLink.parentElement.style.display = 'inline';
    actorLink.insertAdjacentElement('afterend', copyNameBtn);

    // Create copy button for character (if exists)
    if (characterName) {
      const copyRoleBtn = createCopyButton('Copy character name', () => characterName);

      // Try to insert after character link if it exists
      if (links.length > 1) {
        links[1].insertAdjacentElement('afterend', copyRoleBtn);
      } else {
        // Otherwise, find the " as " text and insert after
        const walker = document.createTreeWalker(
          item,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let foundAs = false;
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.textContent.includes(' as ')) {
            foundAs = true;
            // Create a span to hold the button after the text
            const span = document.createElement('span');
            span.style.display = 'inline';
            node.parentNode.insertBefore(span, node.nextSibling);
            span.appendChild(copyRoleBtn);
            break;
          }
        }

        if (!foundAs) {
          // Fallback: append to the end of the list item
          item.appendChild(copyRoleBtn);
        }
      }
    }
  });
}

// Helper function to remove citation references from cloned elements
function removeCitations(clonedElement) {
  if (!clonedElement) return clonedElement;

  // Remove all <sup> elements with citation references (class="reference")
  clonedElement.querySelectorAll('sup.reference, sup[id^="cite_ref"]').forEach(sup => sup.remove());

  // Also remove edit section links
  clonedElement.querySelectorAll('.mw-editsection').forEach(edit => edit.remove());

  return clonedElement;
}

// Helper function to remove nicknames (text in quotes) from names
function removeNickname(text) {
  if (!text) return text;

  // Remove text in double quotes (e.g., "Rancho")
  // Handles both regular ASCII quotes (") and Unicode quotes (" ")
  return text
    .replace(/\s*"[^"]+"\s*/g, ' ')  // ASCII quotes
    .replace(/\s*"[^"]+"\s*/g, ' ')  // Unicode left/right quotes
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .trim();
}

// Helper function to create a copy button
function createCopyButton(title, getTextFunc) {
  const copyBtn = document.createElement('button');
  // Check if this is a name button (not a role/character button)
  const isNameButton = title.includes('name') || title.includes('actor');
  copyBtn.className = isNameButton ? 'media-links-wiki-name-copy-btn' : 'media-links-wiki-role-copy-btn';
  copyBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon">
      <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"></path>
    </svg>
  `;
  copyBtn.title = title;
  copyBtn.style.cssText = `
    margin-left: 4px;
    padding: 2px;
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

async function showWikiCopyDialog(castSection, sectionName) {
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

  // Collect all cast members
  const castMembers = [];
  let currentElement = castSection.parentElement;

  // Determine the heading level of the cast section
  // LOW FIX: Use safer regex matching for heading level extraction
  const dialogTagName = castSection.tagName || '';
  const dialogHeadingMatch = dialogTagName.match(/^H([1-6])$/);
  const castHeadingLevel = dialogHeadingMatch ? parseInt(dialogHeadingMatch[1], 10) : 2;

  while (currentElement && currentElement.nextElementSibling) {
    currentElement = currentElement.nextElementSibling;

    // Stop at headings of the same level or higher
    // LOW FIX: Use safer regex matching for heading level extraction
    const currentTagMatch = currentElement.tagName && currentElement.tagName.match(/^H([1-6])$/);
    if (currentTagMatch) {
      const currentHeadingLevel = parseInt(currentTagMatch[1], 10);
      if (currentHeadingLevel <= castHeadingLevel) {
        break;
      }
    }

    // Check if it's a mw-heading div that contains a same-level or higher heading
    if (currentElement.classList && currentElement.classList.contains('mw-heading')) {
      const headingInside = currentElement.querySelector('h1, h2, h3, h4, h5, h6');
      if (headingInside) {
        const insideTagMatch = headingInside.tagName && headingInside.tagName.match(/^H([1-6])$/);
        const headingInsideLevel = insideTagMatch ? parseInt(insideTagMatch[1], 10) : 6;
        if (headingInsideLevel <= castHeadingLevel) {
          break; // Stop processing - we've reached another section at same or higher level
        }
      }
      continue; // Skip this mw-heading div and continue to next element
    }

    // Check for UL elements (could be direct or inside div-col)
    const ulElements = [];
    if (currentElement.tagName === 'UL') {
      ulElements.push(currentElement);
    } else if (currentElement.classList && currentElement.classList.contains('div-col')) {
      // Cast lists are often wrapped in div-col, check inside
      const ulsInside = currentElement.querySelectorAll('ul');
      ulsInside.forEach(ul => ulElements.push(ul));
    }

    ulElements.forEach(ulElement => {
      const items = ulElement.querySelectorAll('li');
      items.forEach(item => {
        // Clone item to safely extract text without button artifacts and citations
        const itemClone = item.cloneNode(true);
        itemClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
        removeCitations(itemClone);

        const links = itemClone.querySelectorAll('a');
        if (links.length > 0) {
          const name = removeNickname(links[0].textContent.trim());
          let role = '';
          const itemText = itemClone.textContent;
          const asIndex = itemText.indexOf(' as ');
          if (asIndex !== -1) {
            const afterAs = itemText.substring(asIndex + 4);
            if (links.length > 1) {
              role = removeNickname(links[1].textContent.trim());
            } else {
              const commaIndex = afterAs.indexOf(',');
              const rawRole = commaIndex !== -1 ? afterAs.substring(0, commaIndex).trim() : afterAs.trim();
              role = removeNickname(rawRole);
            }
          }
          castMembers.push({ name, role });
        }
      });
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
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.button}; padding-bottom: 10px;">
      📋 Copy ${sectionName}
    </h3>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of members:</label>
      <input type="number" id="wiki-cast-count" min="1" max="1000" value="${defaults.count}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text};">
    </div>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Content:</label>
      <select id="wiki-copy-content"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer;">
        <option value="name-role">Name + Role/Character</option>
        <option value="name-only">Name Only</option>
        <option value="role-only">Role/Character Only</option>
      </select>
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="wiki-output-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer;">
        <option value="newline">Line by line (Name - Role)</option>
        <option value="comma">Comma separated (Name:Role,Name:Role)</option>
        <option value="csv">CSV (Name,Role per line)</option>
        <option value="json">JSON Array</option>
        <option value="table">Markdown Table</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="wiki-copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s;">
        Copy
      </button>
      <button id="wiki-cancel-btn"
        style="flex: 1; padding: 14px; background: ${dialogColors.cancelBg}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 15px; color: ${dialogColors.cancelText}; transition: all 0.2s;">
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
  dialog.querySelector('#wiki-copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#wiki-cast-count').value);
    const content = dialog.querySelector('#wiki-copy-content').value;
    const outputFormat = dialog.querySelector('#wiki-output-format').value;
    copyWikiCastData(castMembers, count, content, outputFormat, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#wiki-cancel-btn').addEventListener('click', closeDialog);
}

function getDialogColors(buttonColors) {
  // BUG FIX: More robust dark mode detection - handle various color formats
  const normalizeColor = (color) => {
    if (!color) return '';
    const lower = color.toLowerCase().trim();
    // Check for common white color formats
    if (lower === '#fff' || lower === '#ffffff' || lower === 'white') {
      return 'white';
    }
    // Check for rgb format
    if (lower.startsWith('rgb')) {
      const match = lower.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (match && match[1] === '255' && match[2] === '255' && match[3] === '255') {
        return 'white';
      }
    }
    return lower;
  };

  const isDark = normalizeColor(buttonColors.buttonText) === 'white';

  if (isDark) {
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

function copyWikiCastData(castMembers, count, content, outputFormat, sectionName) {
  const limitedMembers = castMembers.slice(0, count);

  if (limitedMembers.length === 0) {
    showNotification('No cast members found!', true);
    return;
  }

  let text = '';

  switch(outputFormat) {
    case 'newline':
      text = limitedMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name} - ${member.role}` : member.name;
      }).join('\n');
      break;

    case 'comma':
      text = limitedMembers.map(member => {
        if (content === 'name-only') return member.name;
        if (content === 'role-only') return member.role || '(No role info)';
        return member.role ? `${member.name}:${member.role}` : member.name;
      }).join(',');
      break;

    case 'csv':
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
      if (content === 'name-only') {
        text = JSON.stringify(limitedMembers.map(m => m.name), null, 2);
      } else if (content === 'role-only') {
        text = JSON.stringify(limitedMembers.map(m => m.role || ''), null, 2);
      } else {
        text = JSON.stringify(limitedMembers, null, 2);
      }
      break;

    case 'table':
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

  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${limitedMembers.length} ${sectionName} items!`);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy to clipboard', true);
  });
}

async function showTableCopyDialog(td, sectionName) {
  // Get theme colors
  const colors = await getThemeColors();
  const dialogColors = getDialogColors(colors);

  // Get default settings
  const defaults = await new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        resolve({ count: 5, content: 'name-only', output: 'newline' });
        return;
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['defaultCastCount', 'defaultContentFormat', 'defaultOutputFormat'], (result) => {
          if (chrome.runtime.lastError) {
            resolve({ count: 5, content: 'name-only', output: 'newline' });
          } else {
            resolve({
              count: result.defaultCastCount || 5,
              content: 'name-only', // Default to name-only for table lists
              output: result.defaultOutputFormat || 'newline'
            });
          }
        });
      } else {
        resolve({ count: 5, content: 'name-only', output: 'newline' });
      }
    } catch (error) {
      resolve({ count: 5, content: 'name-only', output: 'newline' });
    }
  });

  // Collect all items from the table cell
  const castMembers = [];

  // First check if there are list items (most common in infoboxes)
  const listItems = td.querySelectorAll('li');

  console.log(`[Wiki Cast Copy] Found ${listItems.length} list items in ${sectionName}`);

  if (listItems.length > 0) {
    // Process each list item individually
    listItems.forEach((li, index) => {
      // Clone to get clean text without buttons and citations
      const liClone = li.cloneNode(true);
      liClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
      removeCitations(liClone);

      // Check if there's a wiki link in this list item
      const link = li.querySelector('a[href*="/wiki/"]');

      if (link) {
        // Get text from the link
        const linkClone = link.cloneNode(true);
        linkClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
        removeCitations(linkClone);
        const name = linkClone.textContent.trim();
        console.log(`[Wiki Cast Copy] Item ${index}: Found link with text "${name}"`);
        if (name) {
          castMembers.push({ name, role: '' });
        }
      } else {
        // No link - get text from the entire list item
        const itemText = liClone.textContent.trim();
        console.log(`[Wiki Cast Copy] Item ${index}: No link, text is "${itemText}"`);
        if (itemText) {
          castMembers.push({ name: itemText, role: '' });
        }
      }
    });

    console.log(`[Wiki Cast Copy] Collected ${castMembers.length} members:`, castMembers);
  } else {
    // No list items - check for wiki links directly
    const links = td.querySelectorAll('a[href*="/wiki/"]');

    if (links.length > 0) {
      // If there are wiki links, collect each link's text (exclude button content and citations)
      links.forEach(link => {
        // Clone the link to safely extract text without button artifacts and citations
        const linkClone = link.cloneNode(true);
        // Remove any copy buttons that might be inside
        linkClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn').forEach(btn => btn.remove());
        removeCitations(linkClone);
        const name = linkClone.textContent.trim();
        if (name) {
          castMembers.push({ name, role: '' });
        }
      });
    } else {
      // If no wiki links, use the entire cell's text content (exclude button content and citations)
      const tdClone = td.cloneNode(true);
      // Remove all copy buttons before extracting text
      tdClone.querySelectorAll('.media-links-wiki-name-copy-btn, .media-links-wiki-role-copy-btn, .media-links-wiki-table-bulk-copy-btn').forEach(btn => btn.remove());
      removeCitations(tdClone);
      const cellText = tdClone.textContent.trim();
      if (cellText) {
        // Split by common separators if present
        const items = cellText.split(/[,;]\s*/);
        items.forEach(item => {
          const trimmedItem = item.trim();
          if (trimmedItem) {
            castMembers.push({ name: trimmedItem, role: '' });
          }
        });
      }
    }
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
  `;

  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.button}; padding-bottom: 10px;">
      📋 Copy ${sectionName}
    </h3>
    <div style="margin-bottom: 18px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of items:</label>
      <input type="number" id="wiki-table-cast-count" min="1" max="1000" value="${Math.min(defaults.count, castMembers.length)}"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text};">
    </div>
    <div style="margin-bottom: 25px;">
      <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
      <select id="wiki-table-output-format"
        style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
        background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer;">
        <option value="newline">Line by line</option>
        <option value="comma">Comma separated</option>
        <option value="csv">CSV</option>
        <option value="json">JSON Array</option>
      </select>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="wiki-table-copy-btn"
        style="flex: 1; padding: 14px; background: ${colors.button}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 700; font-size: 15px; color: ${colors.buttonText}; transition: all 0.2s;">
        Copy
      </button>
      <button id="wiki-table-cancel-btn"
        style="flex: 1; padding: 14px; background: ${dialogColors.cancelBg}; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 15px; color: ${dialogColors.cancelText}; transition: all 0.2s;">
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
  dialog.querySelector('#wiki-table-copy-btn').addEventListener('click', () => {
    const count = parseInt(dialog.querySelector('#wiki-table-cast-count').value);
    const outputFormat = dialog.querySelector('#wiki-table-output-format').value;
    copyTableCastData(castMembers, count, outputFormat, sectionName);
    closeDialog();
  });

  // Handle cancel
  dialog.querySelector('#wiki-table-cancel-btn').addEventListener('click', closeDialog);
}

function copyTableCastData(castMembers, count, outputFormat, sectionName) {
  const limitedMembers = castMembers.slice(0, count);

  if (limitedMembers.length === 0) {
    showNotification('No items found!', true);
    return;
  }

  let text = '';

  switch(outputFormat) {
    case 'newline':
      text = limitedMembers.map(member => member.name).join('\n');
      break;

    case 'comma':
      text = limitedMembers.map(member => member.name).join(',');
      break;

    case 'csv':
      text = 'Name\n' + limitedMembers.map(member => `"${member.name}"`).join('\n');
      break;

    case 'json':
      text = JSON.stringify(limitedMembers.map(m => m.name), null, 2);
      break;
  }

  navigator.clipboard.writeText(text).then(() => {
    showNotification(`Copied ${limitedMembers.length} ${sectionName} items!`);
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
if (isWikipediaCastPage()) {
  // Initial load
  setTimeout(addWikipediaCastButtons, 1000);

  // Debounce mechanism to prevent excessive calls
  let debounceTimer = null;

  // Watch for dynamic content loading
  const observer = new MutationObserver((mutations) => {
    // Check if any of the mutations actually added new content
    // IMPORTANT: Ignore mutations that are just our own button additions
    const hasNewContent = mutations.some(mutation => {
      return mutation.addedNodes.length > 0 &&
        Array.from(mutation.addedNodes).some(node => {
          // Skip if this is just a button we added
          if (node.nodeType === 1 &&
              (node.classList && (
                node.classList.contains('media-links-wiki-name-copy-btn') ||
                node.classList.contains('media-links-wiki-role-copy-btn') ||
                node.classList.contains('media-links-wiki-bulk-copy-btn') ||
                node.classList.contains('media-links-wiki-table-bulk-copy-btn')
              ))) {
            return false;
          }

          // Check for actual new wiki content
          return node.nodeType === 1 && // Element node
            (node.querySelector && (
              node.querySelector('a[href*="/wiki/"]') ||
              node.matches('a[href*="/wiki/"]')
            ));
        });
    });

    // Only re-run if new wiki links were added
    if (hasNewContent) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        addWikipediaCastButtons();
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
}

})(); // End of IIFE
