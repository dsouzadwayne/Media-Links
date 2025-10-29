// Wikipedia Customized Views - Extract and display movie/TV show data
// Similar to IMDb customized views with Directors, Producers, Writers, Cast, etc.

(function() {
  'use strict';

  // EARLY EXIT: Only run on Wikipedia pages
  if (!window.location.hostname.includes('wikipedia.org')) {
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
    console.log('Extension context invalidated, skipping Wikipedia customized views');
    return;
  }

  /**
   * Check if this is a Wikipedia movie/TV show page
   */
  function isWikipediaMediaPage() {
    // Check if page has infobox (typical for movies/TV shows)
    const hasInfobox = document.querySelector('.infobox');

    // Check for cast or production sections
    const hasCastSection = document.querySelector('#Cast') ||
                          document.querySelector('#cast') ||
                          document.querySelector('#Cast_and_characters');

    const hasProductionSection = document.querySelector('#Production') ||
                                document.querySelector('#production');

    return hasInfobox && (hasCastSection || hasProductionSection);
  }

  /**
   * Normalize text for comparison (handles line breaks, extra spaces, etc.)
   */
  function normalizeText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Get the main movie/film infobox (not other metadata infoboxes)
   */
  function getMainInfobox() {
    // Try to get the infobox with vevent class (film infobox)
    let infobox = document.querySelector('.infobox.vevent');

    // If not found, try to get any infobox on the page
    if (!infobox) {
      infobox = document.querySelector('.infobox');
    }

    return infobox;
  }

  /**
   * Extract cast data from Wikipedia - prioritize cast section with character names
   */
  function extractCastData() {
    const castData = [];
    const seen = new Set();

    // First, extract from cast sections with character names (most detailed)
    const castSections = document.querySelectorAll('#Cast, #cast, #Cast_and_characters');

    castSections.forEach(section => {
      let currentElement = section.parentElement;
      const castHeadingLevel = parseInt(section.tagName.substring(1));

      // Traverse to find cast lists
      while (currentElement && currentElement.nextElementSibling) {
        currentElement = currentElement.nextElementSibling;

        // Stop at same-level headings
        if (currentElement.tagName.match(/^H[1-6]$/)) {
          const currentHeadingLevel = parseInt(currentElement.tagName.substring(1));
          if (currentHeadingLevel <= castHeadingLevel) break;
        }

        // Process UL elements
        if (currentElement.tagName === 'UL' || currentElement.classList.contains('div-col')) {
          const uls = currentElement.tagName === 'UL' ?
            [currentElement] :
            currentElement.querySelectorAll('ul');

          uls.forEach(ul => {
            ul.querySelectorAll('li').forEach(li => {
              const itemClone = li.cloneNode(true);
              // Remove citations
              itemClone.querySelectorAll('sup.reference, sup[id^="cite_ref"]').forEach(el => el.remove());

              const links = itemClone.querySelectorAll('a');
              if (links.length > 0) {
                const name = cleanName(links[0].textContent.trim());

                // Skip invalid cast entries (generic terms that shouldn't be cast members)
                const invalidPatterns = ['official website', 'cast', 'bugonia', 'wikipedia', 'IMDb', 'external link'];
                if (invalidPatterns.some(pattern => name.toLowerCase().includes(pattern))) {
                  return; // Skip this entry
                }

                let role = '';
                const text = itemClone.textContent;

                // Try multiple patterns to find character name
                // Pattern 1: " as " (e.g., "Actor as Character")
                let charIndex = text.indexOf(' as ');
                let separator = ' as ';

                // Pattern 2: " who portrayed " (e.g., "Actor, who portrayed Character")
                if (charIndex === -1) {
                  charIndex = text.indexOf(' who portrayed ');
                  separator = ' who portrayed ';
                }

                // Pattern 3: "—" em-dash (e.g., "Actor — Character")
                if (charIndex === -1) {
                  charIndex = text.indexOf('—');
                  separator = '—';
                }

                // Pattern 4: " - " hyphen (e.g., "Actor - Character")
                if (charIndex === -1) {
                  charIndex = text.indexOf(' - ');
                  separator = ' - ';
                }

                if (charIndex !== -1) {
                  const afterSeparator = text.substring(charIndex + separator.length);

                  // If there's a second link, check if it's a valid character name
                  // (not common words like "actor", "beekeeper", etc. in descriptive contexts)
                  if (links.length > 1) {
                    const potentialCharName = cleanName(links[1].textContent.trim());
                    // Only use it if it looks like a proper name or character name (has capital letters or is substantial)
                    if (potentialCharName.length > 2 && /[A-Z]/.test(potentialCharName) && !potentialCharName.match(/^(the|a|an|beekeeper|actor|cop|officer|mother|brother|sister|cousin|friend)$/i)) {
                      role = potentialCharName;
                    } else {
                      // Fall back to extracting text until punctuation
                      const commaIndex = afterSeparator.indexOf(',');
                      const colonIndex = afterSeparator.indexOf(':');
                      let endIndex = afterSeparator.length;

                      if (commaIndex !== -1) endIndex = Math.min(endIndex, commaIndex);
                      if (colonIndex !== -1) endIndex = Math.min(endIndex, colonIndex);

                      role = cleanName(afterSeparator.substring(0, endIndex).trim());
                    }
                  } else {
                    // No second link - extract text until next punctuation
                    const commaIndex = afterSeparator.indexOf(',');
                    const colonIndex = afterSeparator.indexOf(':');
                    let endIndex = afterSeparator.length;

                    if (commaIndex !== -1) endIndex = Math.min(endIndex, commaIndex);
                    if (colonIndex !== -1) endIndex = Math.min(endIndex, colonIndex);

                    role = cleanName(afterSeparator.substring(0, endIndex).trim());
                  }
                }

                if (!seen.has(name)) {
                  seen.add(name);
                  castData.push({
                    name,
                    role: role || 'Cast',
                    roleType: 'Cast'
                  });
                }
              }
            });
          });
        }
      }
    });

    // Then, if we haven't found enough from cast section, add from infobox "Starring" row
    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);
          // Match "Starring" label
          if (thText === 'starring') {
            const links = td.querySelectorAll('a[href*="/wiki/"]');
            links.forEach(link => {
              const name = cleanName(link.textContent.trim());
              if (name && !seen.has(name)) {
                seen.add(name);
                castData.push({
                  name,
                  role: 'Cast',
                  roleType: 'Cast'
                });
              }
            });
          }
        }
      });
    }

    return castData;
  }

  /**
   * Extract directors from infobox only
   */
  function extractDirectorData() {
    const directorData = [];

    // Check infobox for directors - look for "Directed by" row
    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Match "Directed by" (flexible matching)
          if (thText.includes('directed by') || thText === 'directed by') {
            // Extract from links
            const links = td.querySelectorAll('a[href*="/wiki/"]');
            links.forEach(link => {
              const name = cleanName(link.textContent.trim());
              if (name && !directorData.some(d => d.name === name)) {
                directorData.push({
                  name,
                  role: 'Director',
                  roleType: 'Directors'
                });
              }
            });

            // Also extract plain text from list items
            const listItems = td.querySelectorAll('li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll('a').forEach(a => a.remove()); // Remove links to get plain text
                const name = cleanName(liClone.textContent.trim());
                if (name && !directorData.some(d => d.name === name)) {
                  directorData.push({
                    name,
                    role: 'Director',
                    roleType: 'Directors'
                  });
                }
              });
            }
          }
        }
      });
    }

    return directorData;
  }

  /**
   * Extract producers from infobox only
   */
  function extractProducerData() {
    const producerData = [];

    // Check infobox for producers - look for "Produced by" row
    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);
          // Match "Produced by" (flexible)
          if (thText.includes('produced by') || thText === 'produced by') {
            // Extract from links
            const links = td.querySelectorAll('a[href*="/wiki/"]');
            links.forEach(link => {
              const name = cleanName(link.textContent.trim());
              if (name && !producerData.some(p => p.name === name)) {
                producerData.push({
                  name,
                  role: 'Producer',
                  roleType: 'Producers'
                });
              }
            });

            // Also extract plain text from list items
            const listItems = td.querySelectorAll('li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll('a').forEach(a => a.remove()); // Remove links to get plain text
                const name = cleanName(liClone.textContent.trim());
                if (name && !producerData.some(p => p.name === name)) {
                  producerData.push({
                    name,
                    role: 'Producer',
                    roleType: 'Producers'
                  });
                }
              });
            }
          }
        }
      });
    }

    return producerData;
  }

  /**
   * Extract writers from infobox only
   */
  function extractWriterData() {
    const writerData = [];

    // Check infobox for writers/screenplay
    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Skip dialogue writers
          if (thText.includes('dialogue')) {
            return;
          }

          // Match specific labels - separate handling for screenplay vs writer/story
          const isScreenplay = thText.includes('screenplay');
          const isWriter = thText.includes('written by') || thText === 'writer' || thText === 'writers';
          const isStory = thText.includes('story by') || thText === 'story';

          if (isScreenplay || isWriter || isStory) {
            // Determine default role type based on label
            let roleType = 'Writers';
            let role = 'Writer';

            if (isScreenplay) {
              roleType = 'Writers Screenplay';
              role = 'Screenplay';
            } else if (isStory) {
              roleType = 'Writers';
              role = 'Story';
            }

            // For "Written by" rows that may contain multiple credits, we need to parse the content
            // to determine which people should be skipped (e.g., those credited as Dialogue)
            const tdClone = td.cloneNode(true);
            const tdText = tdClone.textContent.trim();

            // Check if this row contains dialogue credits that should be skipped
            const hasDialogueSection = tdText.toLowerCase().includes('dialogue');

            // Extract from list items first (to check context for dialogue)
            const listItems = td.querySelectorAll('li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                const fullText = li.textContent.trim();

                // Skip if marked as dialogue
                if (fullText.toLowerCase().includes('dialogue')) {
                  return;
                }

                // Try to get name from link first
                const link = li.querySelector('a[href*="/wiki/"]');
                let name;
                if (link) {
                  name = cleanName(link.textContent.trim());
                } else {
                  // Fallback to plain text
                  const liClone = li.cloneNode(true);
                  liClone.querySelectorAll('a').forEach(a => a.remove());
                  name = cleanName(liClone.textContent.trim());
                }

                // Allow same person to appear with different roleTypes
                if (name && !writerData.some(w => w.name === name && w.roleType === roleType)) {
                  writerData.push({
                    name,
                    role,
                    roleType
                  });
                }
              });
            } else {
              // If no list items, extract from direct links in the td
              // But check if link comes after "Dialogue" section
              const links = td.querySelectorAll('a[href*="/wiki/"]');

              // If there's a dialogue section, we need to be more careful
              if (hasDialogueSection) {
                // Split the content at dialogue section
                links.forEach(link => {
                  // Get the text node before this link to check if we're in dialogue section
                  let prevText = '';
                  let currentNode = link.previousSibling;
                  while (currentNode) {
                    if (currentNode.nodeType === Node.TEXT_NODE) {
                      prevText = currentNode.textContent + prevText;
                    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                      prevText = currentNode.textContent + prevText;
                    }
                    currentNode = currentNode.previousSibling;
                  }

                  // Check if we're in dialogue section
                  const inDialogueSection = prevText.toLowerCase().includes('dialogue');

                  // Skip if in dialogue section
                  if (inDialogueSection) {
                    return;
                  }

                  const name = cleanName(link.textContent.trim());

                  // Check each credit type independently - person can have multiple credits
                  // Check for Story credit
                  if (prevText.toLowerCase().includes('story')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === 'Writers')) {
                      writerData.push({
                        name,
                        role: 'Story',
                        roleType: 'Writers'
                      });
                    }
                  }

                  // Check for Screenplay credit
                  if (prevText.toLowerCase().includes('screenplay')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === 'Writers Screenplay')) {
                      writerData.push({
                        name,
                        role: 'Screenplay',
                        roleType: 'Writers Screenplay'
                      });
                    }
                  }

                  // If neither story nor screenplay is mentioned, use the default role type
                  if (!prevText.toLowerCase().includes('story') && !prevText.toLowerCase().includes('screenplay')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === roleType)) {
                      writerData.push({
                        name,
                        role,
                        roleType
                      });
                    }
                  }
                });
              } else {
                // No dialogue section, extract all normally
                links.forEach(link => {
                  let prevText = '';
                  let currentNode = link.previousSibling;
                  while (currentNode) {
                    if (currentNode.nodeType === Node.TEXT_NODE) {
                      prevText = currentNode.textContent + prevText;
                    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                      prevText = currentNode.textContent + prevText;
                    }
                    currentNode = currentNode.previousSibling;
                  }

                  const name = cleanName(link.textContent.trim());

                  // Check each credit type independently - person can have multiple credits
                  // Check for Story credit
                  if (prevText.toLowerCase().includes('story')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === 'Writers')) {
                      writerData.push({
                        name,
                        role: 'Story',
                        roleType: 'Writers'
                      });
                    }
                  }

                  // Check for Screenplay credit
                  if (prevText.toLowerCase().includes('screenplay')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === 'Writers Screenplay')) {
                      writerData.push({
                        name,
                        role: 'Screenplay',
                        roleType: 'Writers Screenplay'
                      });
                    }
                  }

                  // If neither story nor screenplay is mentioned, use the default role type
                  if (!prevText.toLowerCase().includes('story') && !prevText.toLowerCase().includes('screenplay')) {
                    if (name && !writerData.some(w => w.name === name && w.roleType === roleType)) {
                      writerData.push({
                        name,
                        role,
                        roleType
                      });
                    }
                  }
                });
              }
            }
          }
        }
      });
    }

    return writerData;
  }

  /**
   * Extract production companies from infobox (exclude distributors)
   */
  function extractProductionCompanies() {
    const companyData = [];

    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Only match "Production companies" (exclude distributors)
          if (thText.includes('production')) {
            // Extract from links
            const links = td.querySelectorAll('a[href*="/wiki/"]');
            links.forEach(link => {
              const name = cleanName(link.textContent.trim());
              // Skip empty or very generic terms
              if (name && name.length > 0 && !companyData.some(c => c.name === name)) {
                companyData.push({
                  name,
                  role: 'Production Company',
                  roleType: 'Production Companies'
                });
              }
            });

            // Also extract plain text company names from list items
            const listItems = td.querySelectorAll('li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll('a').forEach(a => a.remove()); // Remove links to get plain text
                const name = cleanName(liClone.textContent.trim());
                // Skip empty or very generic terms
                if (name && name.length > 0 && !companyData.some(c => c.name === name)) {
                  companyData.push({
                    name,
                    role: 'Production Company',
                    roleType: 'Production Companies'
                  });
                }
              });
            }
          }
        }
      });
    }

    return companyData;
  }

  /**
   * Extract runtime from infobox
   */
  function extractRuntimeData() {
    const runtimeData = [];

    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Match "Running time"
          if (thText.includes('running time')) {
            const tdClone = td.cloneNode(true);
            tdClone.querySelectorAll('a').forEach(a => a.remove()); // Remove citations
            const runtime = cleanName(tdClone.textContent.trim());

            if (runtime) {
              runtimeData.push({
                name: runtime,
                role: 'Duration',
                roleType: 'Runtime'
              });
            }
          }
        }
      });
    }

    return runtimeData;
  }

  /**
   * Extract countries from infobox
   */
  function extractCountriesData() {
    const countriesData = [];

    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Match "Countries" (flexible matching)
          if (thText.includes('countries') || thText === 'country') {
            // Extract from list items
            const listItems = td.querySelectorAll('li');
            if (listItems.length > 0) {
              listItems.forEach(li => {
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll('a').forEach(a => a.remove()); // Remove links
                const country = cleanName(liClone.textContent.trim());
                if (country && !countriesData.some(c => c.name === country)) {
                  countriesData.push({
                    name: country,
                    role: 'Country',
                    roleType: 'Countries'
                  });
                }
              });
            } else {
              // No list items - split by line breaks or bullets
              const tdClone = td.cloneNode(true);
              tdClone.querySelectorAll('a').forEach(a => a.remove());
              const text = tdClone.textContent.trim();

              // Split by bullet points or line breaks
              const countries = text.split(/[\n•]/);
              countries.forEach(country => {
                const cleanCountry = cleanName(country.trim());
                if (cleanCountry && !countriesData.some(c => c.name === cleanCountry)) {
                  countriesData.push({
                    name: cleanCountry,
                    role: 'Country',
                    roleType: 'Countries'
                  });
                }
              });
            }
          }
        }
      });
    }

    return countriesData;
  }

  /**
   * Extract language from infobox
   */
  function extractLanguageData() {
    const languageData = [];

    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');

      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Match "Language" (flexible matching)
          if (thText.includes('language')) {
            // Extract from list items
            const listItems = td.querySelectorAll('li');

            if (listItems.length > 0) {
              listItems.forEach(li => {
                const liClone = li.cloneNode(true);
                liClone.querySelectorAll('a').forEach(a => a.remove());
                const language = cleanName(liClone.textContent.trim());
                if (language && !languageData.some(l => l.name === language)) {
                  languageData.push({
                    name: language,
                    role: 'Language',
                    roleType: 'Languages'
                  });
                }
              });
            } else {
              // Plain text without list
              const tdClone = td.cloneNode(true);
              tdClone.querySelectorAll('a').forEach(a => a.remove());
              const text = tdClone.textContent.trim();

              // Split by comma or line breaks if multiple languages
              const languages = text.split(/[,\n]/);
              languages.forEach(lang => {
                const cleanLang = cleanName(lang.trim());
                if (cleanLang && !languageData.some(l => l.name === cleanLang)) {
                  languageData.push({
                    name: cleanLang,
                    role: 'Language',
                    roleType: 'Languages'
                  });
                }
              });
            }
          }
        }
      });
    }

    return languageData;
  }

  /**
   * Extract release date from infobox
   */
  function extractReleaseDateData() {
    const releaseDateData = [];

    const infobox = getMainInfobox();
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
          const thText = normalizeText(th.textContent);

          // Match "Release date" or "Released"
          if (thText.includes('release date') || thText === 'released' || thText === 'release') {
            const tdClone = td.cloneNode(true);
            tdClone.querySelectorAll('a').forEach(a => a.remove()); // Remove links
            const releaseDate = cleanName(tdClone.textContent.trim());

            if (releaseDate) {
              releaseDateData.push({
                name: releaseDate,
                role: 'Release Date',
                roleType: 'Release Date'
              });
            }
          }
        }
      });
    }

    return releaseDateData;
  }


  /**
   * Clean name by removing citations and nicknames
   */
  function cleanName(text) {
    if (!text) return text;

    // Remove citations [1], [2], etc.
    text = text.replace(/\[\d+\]/g, '');

    // Remove text in quotes (nicknames)
    text = text.replace(/\s*"[^"]+"\s*/g, ' ');
    text = text.replace(/\s*"[^"]+"\s*/g, ' ');

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Get theme colors
   */
  function getThemeColors() {
    return new Promise((resolve) => {
      try {
        if (typeof ThemeManager !== 'undefined') {
          const colors = ThemeManager.getThemeColors();
          resolve(colors);
        } else {
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

  /**
   * Get customized view button visibility setting
   */
  function getCustomizedViewButtonSetting() {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(true); // Default to enabled
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['showWikiCustomizedViewBtn'], (result) => {
            if (chrome.runtime.lastError) {
              console.warn('Error getting customized view button setting:', chrome.runtime.lastError);
              resolve(true); // Default to enabled on error
            } else {
              // Default to true if not set
              resolve(result.showWikiCustomizedViewBtn !== false);
            }
          });
        } else {
          resolve(true); // Default to enabled
        }
      } catch (error) {
        console.warn('Error accessing chrome.storage for customized view button setting:', error);
        resolve(true); // Default to enabled on error
      }
    });
  }

  /**
   * Add customized view button to Wikipedia pages
   */
  async function addCustomizedViewButton() {
    if (!isWikipediaMediaPage()) return;

    // Check if the button is enabled in settings
    const isEnabled = await getCustomizedViewButtonSetting();
    if (!isEnabled) return;

    const colors = await getThemeColors();

    // Find the page title
    const titleElement = document.querySelector('#firstHeading');
    if (!titleElement) return;

    // Skip if button already added
    if (titleElement.parentElement.querySelector('.media-links-wiki-customized-view-btn')) return;

    const button = document.createElement('button');
    button.className = 'media-links-wiki-customized-view-btn';
    button.innerHTML = '📊 Customized View';
    button.style.cssText = `
      margin-left: 12px;
      padding: 8px 14px;
      background: ${colors.button};
      border: none;
      border-radius: 6px;
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

    button.addEventListener('click', openCustomizedView);

    // Insert button after title
    titleElement.insertAdjacentElement('afterend', button);
  }

  /**
   * Open customized view with all extracted data
   */
  async function openCustomizedView() {
    try {
      if (!isExtensionContextValid()) {
        alert('Extension context has been invalidated. Please reload the page and try again.');
        return;
      }

      // Extract all data
      const directorData = extractDirectorData();
      const producerData = extractProducerData();
      const writerData = extractWriterData();
      const castData = extractCastData();
      const companyData = extractProductionCompanies();
      const runtimeData = extractRuntimeData();
      const countriesData = extractCountriesData();
      const languageData = extractLanguageData();
      const releaseDateData = extractReleaseDateData();

      // Combine all data in order
      const allData = [
        ...directorData,
        ...producerData,
        ...writerData,
        ...castData,
        ...companyData,
        ...runtimeData,
        ...countriesData,
        ...languageData,
        ...releaseDateData
      ];

      if (allData.length === 0) {
        alert('No data found to display in customized view.');
        return;
      }

      // Prepare view data
      const viewData = {
        data: allData,
        title: `${document.title.split('|')[0].trim()} - Cast & Crew`,
        columns: ['name', 'role'],
        pagePath: window.location.pathname,
        pageSource: 'Wikipedia',
        timestamp: Date.now()
      };

      // Save to chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 'customized-view-temp': viewData }, () => {
          if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated during storage operation');
            return;
          }

          if (chrome.runtime.lastError) {
            console.error('Error saving view data:', chrome.runtime.lastError);
            alert('Failed to save view data. Please try again.');
            return;
          }

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
      console.error('Error opening customized view:', error);
      alert('Failed to open customized view: ' + error.message);
    }
  }

  /**
   * Remove customized view button
   */
  function removeCustomizedViewButton() {
    const button = document.querySelector('.media-links-wiki-customized-view-btn');
    if (button) {
      button.remove();
    }
  }

  /**
   * Initialize when page loads
   */
  if (isWikipediaMediaPage()) {
    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addCustomizedViewButton);
    } else {
      addCustomizedViewButton();
    }
  }

  /**
   * Listen for settings changes to show/hide button
   */
  try {
    if (isExtensionContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.showWikiCustomizedViewBtn) {
          const isEnabled = changes.showWikiCustomizedViewBtn.newValue !== false;
          if (isEnabled) {
            addCustomizedViewButton();
          } else {
            removeCustomizedViewButton();
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error setting up settings change listener:', error);
  }

  /**
   * Listen for comparison extraction requests
   */
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractForComparison' && request.pageType === 'Wikipedia') {
          console.log('Wikipedia: Received comparison extraction request');

          try {
            // Extract all available data from Wikipedia page
            const wikipediaData = {
              cast: extractCastData(),
              directors: extractDirectorData(),
              producers: extractProducerData(),
              writers: extractWriterData(),
              productionCompanies: extractProductionCompanies(),
              runtime: extractRuntimeData(),
              countries: extractCountriesData(),
              languages: extractLanguageData(),
              releaseDate: extractReleaseDateData()
            };

            console.log('Wikipedia extraction complete:', {
              cast: wikipediaData.cast.length,
              directors: wikipediaData.directors.length,
              producers: wikipediaData.producers.length,
              writers: wikipediaData.writers.length,
              productionCompanies: wikipediaData.productionCompanies.length
            });

            sendResponse({ success: true, data: wikipediaData });
          } catch (error) {
            console.error('Error extracting Wikipedia data for comparison:', error);
            sendResponse({ success: false, error: error.message });
          }

          return true; // Keep channel open for async response
        }
      });
    } else {
      console.warn('Extension context invalid, message listener not registered');
    }
  } catch (error) {
    console.warn('Error registering Wikipedia comparison message listener:', error);
  }

})();
