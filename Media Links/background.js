// Offscreen document management for Tesseract OCR
let offscreenDocumentCreated = false;

// Create offscreen document for OCR processing
async function createOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }

  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      console.log('Background: Offscreen document already exists');
      offscreenDocumentCreated = true;
      return;
    }

    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'OCR processing using Tesseract.js requires Web Workers'
    });

    offscreenDocumentCreated = true;
    console.log('Background: Offscreen document created');
  } catch (error) {
    console.error('Background: Failed to create offscreen document:', error);
    throw error;
  }
}

// Helper function to extract IMDb ID from URL
function extractIMDbId(url) {
  const match = url.match(/\/title\/(tt\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract consolidated IMDb data from all pages (fullcredits, companycredits, awards, releaseinfo, technical)
 */
async function extractConsolidatedIMDbData(imdbId) {
  console.log(`Extracting consolidated IMDb data for ${imdbId}`);

  // Define extraction pages
  const extractionPages = [
    { url: `https://www.imdb.com/title/${imdbId}/fullcredits`, type: 'fullcredits', name: 'Cast & Crew' },
    { url: `https://www.imdb.com/title/${imdbId}/companycredits`, type: 'companycredits', name: 'Production Companies' },
    { url: `https://www.imdb.com/title/${imdbId}/awards`, type: 'awards', name: 'Awards' },
    { url: `https://www.imdb.com/title/${imdbId}/releaseinfo`, type: 'releaseinfo', name: 'Release Info' },
    { url: `https://www.imdb.com/title/${imdbId}/technical`, type: 'technical', name: 'Technical' }
  ];

  const openedTabs = [];
  const consolidatedData = {};

  try {
    // 1. Open all extraction tabs
    console.log('Opening IMDb tabs for extraction...');
    for (const page of extractionPages) {
      const tab = await chrome.tabs.create({ url: page.url, active: false });
      openedTabs.push({ tab, page });
      console.log(`Opened ${page.name} tab (ID: ${tab.id})`);

      // Stagger tab opening
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 2. Wait for tabs to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Extract data from each tab
    console.log('Extracting data from IMDb tabs...');
    for (const { tab, page } of openedTabs) {
      try {
        console.log(`Sending extraction message to ${page.name} tab`);

        // Send extraction message to the tab (don't wait for response, use storage polling instead)
        try {
          chrome.tabs.sendMessage(tab.id, {
            type: 'performConsolidatedExtraction',
            pageType: page.type
          }).catch(err => {
            // Ignore message port errors - we'll poll storage instead
            console.warn(`Message send warning for ${page.name}:`, err.message);
          });
        } catch (sendError) {
          console.warn(`Could not send message to ${page.name}:`, sendError.message);
        }

        // Wait for data to be stored in chrome.storage (polling mechanism)
        let checkCount = 0;
        const maxChecks = 60; // 30 seconds max (increased from 20)

        while (checkCount < maxChecks) {
          const result = await chrome.storage.local.get([`consolidatedViewData_${page.type}`]);

          if (result[`consolidatedViewData_${page.type}`] !== undefined) {
            consolidatedData[page.type] = result[`consolidatedViewData_${page.type}`];
            console.log(`✓ Retrieved ${page.name} data (${consolidatedData[page.type].length} items)`);
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
          checkCount++;
        }

        if (checkCount >= maxChecks) {
          console.warn(`Timeout waiting for ${page.name} data - using empty array`);
          consolidatedData[page.type] = [];
        }
      } catch (error) {
        console.error(`Error extracting from ${page.name}:`, error);
        consolidatedData[page.type] = [];
      }
    }

    // 4. Close all opened tabs
    console.log('Closing IMDb tabs...');
    for (const { tab } of openedTabs) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (error) {
        console.warn(`Could not close tab ${tab.id}:`, error);
      }
    }

    console.log('IMDb consolidation complete:', consolidatedData);
    return consolidatedData;

  } catch (error) {
    // Clean up: close any opened tabs
    console.error('Error during IMDb consolidation:', error);
    for (const { tab } of openedTabs) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}

/**
 * Extract Wikipedia data from a tab
 */
async function extractWikipediaData(tabId) {
  console.log(`Extracting Wikipedia data from tab ${tabId}`);

  try {
    // Add timeout to the message sending
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, {
        action: 'extractForComparison',
        pageType: 'Wikipedia'
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Wikipedia extraction timeout')), 30000)
      )
    ]);

    if (response && response.data) {
      console.log('✓ Wikipedia extraction complete');
      return response.data;
    }

    console.warn('No data received from Wikipedia tab');
    return {
      cast: [],
      directors: [],
      producers: [],
      writers: [],
      productionCompanies: [],
      runtime: [],
      countries: [],
      languages: [],
      releaseDate: []
    };
  } catch (error) {
    console.error('Error extracting from Wikipedia:', error);
    // Return empty data structure instead of null
    return {
      cast: [],
      directors: [],
      producers: [],
      writers: [],
      productionCompanies: [],
      runtime: [],
      countries: [],
      languages: [],
      releaseDate: []
    };
  }
}

/**
 * Compare two data sources and return comparison results
 */
function compareData(wikipediaData, imdbData) {
  console.log('Comparing Wikipedia and IMDb data');

  const comparison = {};

  /**
   * Normalize name for comparison
   */
  function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Compare two lists of items (cast, crew, etc.)
   */
  function compareLists(listA, listB, nameField = 'name') {
    const result = {
      same: [],
      different: [],
      sourceA: { unique: [] },
      sourceB: { unique: [] }
    };

    const normalizedB = new Map();
    listB.forEach(item => {
      const normalizedName = normalizeName(item[nameField]);
      normalizedB.set(normalizedName, item);
    });

    const processedFromB = new Set();

    // Process items from list A
    listA.forEach(itemA => {
      const normalizedNameA = normalizeName(itemA[nameField]);
      if (normalizedB.has(normalizedNameA)) {
        const itemB = normalizedB.get(normalizedNameA);
        result.same.push({
          sourceA: itemA,
          sourceB: itemB
        });
        processedFromB.add(normalizedNameA);
      } else {
        result.sourceA.unique.push(itemA);
      }
    });

    // Find items unique to list B
    listB.forEach(itemB => {
      const normalizedNameB = normalizeName(itemB[nameField]);
      if (!processedFromB.has(normalizedNameB)) {
        result.sourceB.unique.push(itemB);
      }
    });

    return result;
  }

  /**
   * Flatten IMDb consolidated data into lists
   */
  function flattenIMDbData(imdbData) {
    const flattened = {
      cast: [],
      directors: [],
      producers: [],
      writers: [],
      productionCompanies: []
    };

    // Flatten fullcredits data
    if (imdbData.fullcredits && Array.isArray(imdbData.fullcredits)) {
      imdbData.fullcredits.forEach(item => {
        if (item.section) {
          const sectionLower = item.section.toLowerCase();
          if (sectionLower.includes('cast') || sectionLower === 'actor' || sectionLower === 'actress') {
            flattened.cast.push(item);
          } else if (sectionLower.includes('director')) {
            flattened.directors.push(item);
          } else if (sectionLower.includes('producer')) {
            flattened.producers.push(item);
          } else if (sectionLower.includes('writ')) {
            flattened.writers.push(item);
          }
        }
      });
    }

    // Add company credits
    if (imdbData.companycredits && Array.isArray(imdbData.companycredits)) {
      flattened.productionCompanies = imdbData.companycredits.filter(c =>
        c.section && c.section.toLowerCase().includes('production')
      );
    }

    return flattened;
  }

  // Flatten IMDb data
  const flatIMDb = flattenIMDbData(imdbData);

  // Compare cast
  comparison.cast = compareLists(
    wikipediaData.cast || [],
    flatIMDb.cast,
    'name'
  );

  // Compare directors
  comparison.directors = compareLists(
    wikipediaData.directors || [],
    flatIMDb.directors,
    'name'
  );

  // Compare producers
  comparison.producers = compareLists(
    wikipediaData.producers || [],
    flatIMDb.producers,
    'name'
  );

  // Compare writers
  comparison.writers = compareLists(
    wikipediaData.writers || [],
    flatIMDb.writers,
    'name'
  );

  // Compare production companies
  comparison.production = compareLists(
    wikipediaData.productionCompanies || [],
    flatIMDb.productionCompanies,
    'name'
  );

  // Add other metadata (runtime, countries, languages, release dates)
  // These will be added as simple comparisons
  comparison.runtime = {
    same: [],
    different: [],
    sourceA: { unique: wikipediaData.runtime || [] },
    sourceB: { unique: imdbData.technical || [] }
  };

  comparison.countries = {
    same: [],
    different: [],
    sourceA: { unique: wikipediaData.countries || [] },
    sourceB: { unique: [] }
  };

  comparison.languages = {
    same: [],
    different: [],
    sourceA: { unique: wikipediaData.languages || [] },
    sourceB: { unique: [] }
  };

  comparison.releaseDate = {
    same: [],
    different: [],
    sourceA: { unique: wikipediaData.releaseDate || [] },
    sourceB: { unique: imdbData.releaseinfo || [] }
  };

  console.log('Comparison complete');
  return comparison;
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });

    // Create static parent context menu
    chrome.contextMenus.create({
      id: 'search-selection',
      title: 'Search with Media Links',
      contexts: ['selection']
    });

    // Create CBFC India search submenu (static)
    chrome.contextMenus.create({
      id: 'cbfc-search',
      parentId: 'search-selection',
      title: 'Search on CBFC India',
      contexts: ['selection']
    });

    // Create separator (static)
    chrome.contextMenus.create({
      id: 'cbfc-separator',
      parentId: 'search-selection',
      type: 'separator',
      contexts: ['selection']
    });

    // Pre-create all possible menu structures for 1-4 words
    // We'll show/hide and update titles dynamically
    for (let wordCount = 1; wordCount <= 4; wordCount++) {
      const patterns = groupingPatterns[wordCount] || [];
      patterns.forEach(pattern => {
        chrome.contextMenus.create({
          id: `grouping-${wordCount}-${pattern.id}`,
          parentId: 'search-selection',
          title: pattern.display,  // Placeholder, will be updated
          contexts: ['selection'],
          visible: false  // Hidden by default
        });
      });
    }

    // Create offscreen document for Tesseract
    createOffscreenDocument().catch(err => {
      console.error('Failed to create offscreen document on install:', err);
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidebar.html'
      });
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === '_execute_sidebar_action') {
      chrome.sidePanel.open();
    }
  });

  // Grouping patterns for word combinations
  const groupingPatterns = {
    1: [
      { id: '1', display: 'word1', pattern: [[0]] }
    ],
    2: [
      { id: '1-1', display: 'word1 | word2', pattern: [[0], [1]] },
      { id: '2', display: 'word1-word2', pattern: [[0, 1]] }
    ],
    3: [
      { id: '1-1-1', display: 'word1 | word2 | word3', pattern: [[0], [1], [2]] },
      { id: '1-2', display: 'word1 | word2-word3', pattern: [[0], [1, 2]] },
      { id: '2-1', display: 'word1-word2 | word3', pattern: [[0, 1], [2]] },
      { id: '3', display: 'word1-word2-word3', pattern: [[0, 1, 2]] }
    ],
    4: [
      { id: '1-1-1-1', display: 'word1 | word2 | word3 | word4', pattern: [[0], [1], [2], [3]] },
      { id: '1-1-2', display: 'word1 | word2 | word3-word4', pattern: [[0], [1], [2, 3]] },
      { id: '1-2-1', display: 'word1 | word2-word3 | word4', pattern: [[0], [1, 2], [3]] },
      { id: '2-1-1', display: 'word1-word2 | word3 | word4', pattern: [[0, 1], [2], [3]] },
      { id: '1-3', display: 'word1 | word2-word3-word4', pattern: [[0], [1, 2, 3]] },
      { id: '2-2', display: 'word1-word2 | word3-word4', pattern: [[0, 1], [2, 3]] },
      { id: '3-1', display: 'word1-word2-word3 | word4', pattern: [[0, 1, 2], [3]] },
      { id: '4', display: 'word1-word2-word3-word4', pattern: [[0, 1, 2, 3]] }
    ]
  };

  // Pattern templates for generating queries
  const patternDescriptions = {
    1: {
      'plain': { template: '{0}' },
      'quoted': { template: '"{0}"' },
      'intitle': { template: 'intitle:"{0}"' },
      'allintitle': { template: 'allintitle:{0}' },
      'intext': { template: 'intext:"{0}"' }
    },
    2: {
      'plain': { template: '{0} {1}' },
      'first-quoted': { template: '"{0}" {1}' },
      'second-quoted': { template: '{0} "{1}"' },
      'both-quoted': { template: '"{0}" "{1}"' },
      'phrase': { template: '"{0} {1}"' },
      'intitle': { template: 'intitle:"{0}" {1}' },
      'and': { template: '"{0}" AND "{1}"' },
      'or': { template: '"{0}" OR "{1}"' }
    },
    3: {
      'plain': { template: '{0} {1} {2}' },
      'all-quoted': { template: '"{0}" "{1}" "{2}"' },
      'first-phrase': { template: '"{0} {1}" {2}' },
      'second-phrase': { template: '{0} "{1} {2}"' },
      'full-phrase': { template: '"{0} {1} {2}"' },
      'and': { template: '"{0}" AND "{1}" AND "{2}"' },
      'or': { template: '"{0}" OR "{1}" OR "{2}"' },
      'first-quoted': { template: '"{0}" {1} {2}' },
      'second-quoted': { template: '{0} "{1}" {2}' },
      'third-quoted': { template: '{0} {1} "{2}"' },
      'first-two-quoted': { template: '"{0}" "{1}" {2}' },
      'last-two-quoted': { template: '{0} "{1}" "{2}"' }
    },
    4: {
      'plain': { template: '{0} {1} {2} {3}' },
      'all-quoted': { template: '"{0}" "{1}" "{2}" "{3}"' },
      'paired': { template: '"{0} {1}" "{2} {3}"' },
      'full-phrase': { template: '"{0} {1} {2} {3}"' },
      'and': { template: '"{0}" AND "{1}" AND "{2}" AND "{3}"' },
      'or': { template: '"{0}" OR "{1}" OR "{2}" OR "{3}"' },
      'first-three-phrase': { template: '"{0} {1} {2}" {3}' },
      'last-three-phrase': { template: '{0} "{1} {2} {3}"' },
      'first-quoted': { template: '"{0}" {1} {2} {3}' },
      'second-quoted': { template: '{0} "{1}" {2} {3}' },
      'third-quoted': { template: '{0} {1} "{2}" {3}' },
      'fourth-quoted': { template: '{0} {1} {2} "{3}"' },
      'first-two-quoted': { template: '"{0}" "{1}" {2} {3}' },
      'last-two-quoted': { template: '{0} {1} "{2}" "{3}"' },
      'middle-pair': { template: '{0} "{1} {2}" {3}' }
    }
  };

  const defaultPatterns = {
    1: { 'plain': true, 'quoted': true, 'intitle': true, 'allintitle': true, 'intext': true },
    2: { 'plain': true, 'first-quoted': true, 'second-quoted': true, 'both-quoted': true, 'phrase': true, 'intitle': true, 'and': true, 'or': true },
    3: { 'plain': true, 'all-quoted': true, 'first-phrase': true, 'second-phrase': true, 'full-phrase': true, 'and': true, 'or': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true },
    4: { 'plain': true, 'all-quoted': true, 'paired': true, 'full-phrase': true, 'and': true, 'or': true, 'first-three-phrase': true, 'last-three-phrase': true, 'first-quoted': true, 'second-quoted': true, 'third-quoted': true, 'fourth-quoted': true, 'first-two-quoted': true, 'last-two-quoted': true, 'middle-pair': true }
  };

  // Generate search URL
  const getSearchUrl = (query, engine) => {
    const encodedQuery = encodeURIComponent(query);
    switch(engine) {
      case 'youtube':
        return `https://www.youtube.com/results?search_query=${encodedQuery}`;
      case 'google-ai':
        return `https://www.google.com/search?q=${encodedQuery}&udm=50&aep=11`;
      case 'bing':
        return `https://www.bing.com/search?q=${encodedQuery}`;
      case 'duckduckgo':
        return `https://duckduckgo.com/?q=${encodedQuery}`;
      case 'google':
      default:
        return `https://www.google.com/search?q=${encodedQuery}`;
    }
  };

  // Generate combinations
  const getCombinations = (elements, size) => {
    if (size === 1) {
      return elements.map(el => [el]);
    }

    const combinations = [];

    function combine(start, combo) {
      if (combo.length === size) {
        combinations.push([...combo]);
        return;
      }

      for (let i = start; i < elements.length; i++) {
        combo.push(elements[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }

    combine(0, []);
    return combinations;
  };

  // Generate queries from words
  const generateQueries = (words, profileSettings) => {
    const queries = [];
    const profileNum = words.length;

    // Generate queries for all word counts from 1 to profileNum
    for (let wordCount = 1; wordCount <= profileNum; wordCount++) {
      // Get settings for this specific word count within the profile
      const settings = (profileSettings && profileSettings[wordCount])
        ? profileSettings[wordCount]
        : defaultPatterns[wordCount];
      const patterns = patternDescriptions[wordCount];
      const combinations = getCombinations(words, wordCount);

      if (!patterns) continue;

      combinations.forEach(combo => {
        Object.keys(patterns).forEach(pattern => {
          // Check if pattern is explicitly enabled (true) or not disabled
          if (settings[pattern] !== false) {
            let query = patterns[pattern].template;
            combo.forEach((word, index) => {
              query = query.replace(`{${index}}`, word);
            });
            queries.push(query);
          }
        });
      });
    }

    return queries;
  };

  // Store current selection info for context menu
  let currentSelectionInfo = { words: [], wordCount: 0 };
  let menuUpdateTimeout = null;
  let isUpdatingMenu = false;
  let pendingUpdates = [];  // Queue to store all pending updates
  let lastMenuStructureWordCount = 0;  // Track the menu structure (changes with word count)

  // Sanitize text for context menu display
  const sanitizeForContextMenu = (text) => {
    // Remove special characters that could cause issues
    // Limit length to prevent display issues
    return text.replace(/[&<>"']/g, '').substring(0, 50);
  };

  // Process any pending updates that came in while we were busy
  const processPendingUpdate = () => {
    if (pendingUpdates.length > 0) {
      // Get the most recent update from the queue
      const textToUpdate = pendingUpdates.pop();
      // Clear any older pending updates (only process the most recent)
      pendingUpdates = [];
      updateContextMenu(textToUpdate, true);
    }
  };

  // Update context menu when selection changes
  const updateContextMenu = (selectionText, immediate = false) => {
    clearTimeout(menuUpdateTimeout);

    const updateMenus = () => {
      // If already updating, add this request to queue and return
      if (isUpdatingMenu) {
        pendingUpdates.push(selectionText);
        return;
      }

      const words = selectionText.trim().split(/\s+/).slice(0, 4);
      const wordCount = words.length;

      // Don't rebuild for empty selection
      if (wordCount === 0) return;

      // Sanitize words before storing
      const sanitizedWords = words.map(sanitizeForContextMenu);

      // Check if this is the same selection we already have
      const isSameSelection = currentSelectionInfo.wordCount === wordCount &&
                              currentSelectionInfo.words.every((word, i) => word === sanitizedWords[i]);

      if (isSameSelection) {
        // Menu is already built for this selection, no need to rebuild
        return;
      }

      currentSelectionInfo = { words: sanitizedWords, wordCount };

      // Mark that we're updating
      isUpdatingMenu = true;

      // Update strategy: show menus for current word count, hide others
      // This is MUCH faster than removeAll + create
      try {
        let updatesCompleted = 0;
        let totalUpdates = 0;

        // Count total updates needed
        for (let wc = 1; wc <= 4; wc++) {
          const patterns = groupingPatterns[wc] || [];
          totalUpdates += patterns.length;
        }

        // Update all menu items
        for (let wc = 1; wc <= 4; wc++) {
          const patterns = groupingPatterns[wc] || [];
          const shouldBeVisible = (wc === wordCount);

          patterns.forEach(pattern => {
            const menuId = `grouping-${wc}-${pattern.id}`;
            let displayText = pattern.display;

            // If this menu should be visible, update its title with actual words
            if (shouldBeVisible) {
              sanitizedWords.forEach((word, index) => {
                const regex = new RegExp(`word${index + 1}`, 'g');
                displayText = displayText.replace(regex, word);
              });

              // Truncate menu title if too long
              if (displayText.length > 50) {
                displayText = displayText.substring(0, 47) + '...';
              }
            }

            // Update menu visibility and title
            chrome.contextMenus.update(menuId, {
              visible: shouldBeVisible,
              title: displayText
            }, () => {
              updatesCompleted++;
              if (chrome.runtime.lastError) {
                console.debug('Menu update error (may not exist yet):', chrome.runtime.lastError);
              }

              // Mark update as complete when all updates are done
              if (updatesCompleted === totalUpdates) {
                isUpdatingMenu = false;
                processPendingUpdate();
              }
            });
          });
        }

        // Handle edge case where no updates are needed
        if (totalUpdates === 0) {
          isUpdatingMenu = false;
          processPendingUpdate();
        }
      } catch (error) {
        console.error('Failed to update context menu:', error);
        isUpdatingMenu = false;
        processPendingUpdate();
      }
    };

    // Always update immediately to ensure menu is ready when user right-clicks
    // The isSameSelection check above prevents unnecessary rebuilds
    updateMenus();
  };

  // Broadcast theme change to all pages
  const broadcastThemeChange = (theme) => {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'themeChanged',
          theme: theme
        }).catch(() => {
          // Silently catch errors for tabs that don't have content script
        });
      });
    });

    // Send to offscreen document
    chrome.runtime.sendMessage({
      type: 'themeChanged',
      theme: theme
    }).catch(() => {
      // Silently catch errors if offscreen document isn't loaded
    });
  };

  // Listen for selection updates and OCR requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background: Received message:', message.type || message.action, 'from:', sender.tab?.id);

    // Handle creating tabs for consolidated view extraction
    if (message.type === 'createTab') {
      console.log('Background: Creating tab with URL:', message.url);
      chrome.tabs.create({ url: message.url, active: message.active || false }, (tab) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError);
          console.error('Background: Error creating tab:', errorMsg, 'URL was:', message.url);
          sendResponse({ success: false, error: errorMsg });
        } else if (tab) {
          console.log('Background: Created tab:', tab.id, 'URL:', tab.url);
          sendResponse({ success: true, tabId: tab.id });
        } else {
          console.error('Background: Tab creation failed - no tab returned and no error');
          sendResponse({ success: false, error: 'Tab creation failed' });
        }
      });
      return true; // Keep channel open for async response
    }

    // Handle closing consolidated view extraction tabs
    if (message.type === 'closeConsolidatedViewTab') {
      const tabId = sender.tab.id;
      console.log(`Background: Closing consolidated view tab ${tabId} (${message.pageType})`);

      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to close tab ${tabId}:`, chrome.runtime.lastError);
        } else {
          console.log(`Successfully closed tab ${tabId}`);
        }
        sendResponse({ success: true });
      });

      return true; // Keep channel open for async response
    }

    // Handle closing tabs for tab selector mode
    if (message.type === 'closeTab') {
      const tabId = message.tabId;
      console.log(`Background: Closing tab ${tabId}`);

      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to close tab ${tabId}:`, chrome.runtime.lastError);
        } else {
          console.log(`Successfully closed tab ${tabId}`);
        }
        sendResponse({ success: true });
      });

      return true; // Keep channel open for async response
    }

    // Handle getting tab status
    if (message.type === 'getTabStatus') {
      const tabId = message.tabId;

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to get tab ${tabId} status:`, chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, status: tab.status });
        }
      });

      return true; // Keep channel open for async response
    }

    // Handle focusing a specific tab
    if (message.type === 'focusTab') {
      const tabId = message.tabId;

      chrome.tabs.update(tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to focus tab ${tabId}:`, chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });

      return true; // Keep channel open for async response
    }

    // Handle relaying extraction messages to target tabs
    if (message.type === 'sendExtractionMessage') {
      const targetTabId = message.targetTabId;
      const extractionMessage = message.extractionMessage;

      console.log(`Background: Relaying extraction message to tab ${targetTabId}:`, extractionMessage.pageType);

      chrome.tabs.sendMessage(targetTabId, extractionMessage).then(() => {
        console.log(`Background: Successfully sent extraction message to tab ${targetTabId}`);
        sendResponse({ success: true });
      }).catch((error) => {
        console.warn(`Background: Failed to send extraction message to tab ${targetTabId}:`, error);
        sendResponse({ success: false, error: error.message });
      });

      return true; // Keep channel open for async response
    }

    // Handle theme change broadcasts from settings page
    if (message.type === 'themeChanged' && message.theme) {
      console.log('Background: Broadcasting theme change to all pages:', message.theme);
      broadcastThemeChange(message.theme);
      return;
    }

    if (message.type === 'selectionChanged' && message.text) {
      // Check if this is from a contextmenu event (immediate update needed)
      const isContextMenu = message.fromContextMenu || false;
      updateContextMenu(message.text, isContextMenu);
    }

    // Handle getTabs request
    if (message.type === 'getTabs') {
      chrome.tabs.query({}, (tabs) => {
        sendResponse({ tabs: tabs });
      });
      return true; // Keep channel open for async response
    }

    // Handle queryTabs for comparison feature
    if (message.action === 'queryTabs') {
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        const currentTabId = activeTabs.length > 0 ? activeTabs[0].id : null;

        chrome.tabs.query({}, (allTabs) => {
          const source = message.source;
          const filteredTabs = allTabs.filter(tab => {
            if (currentTabId && tab.id === currentTabId) return false;

            try {
              const tabUrl = new URL(tab.url);
              const tabHostname = tabUrl.hostname;

              if (source === 'wikipedia' && tabHostname === 'www.imdb.com') {
                return /\/title\/tt\d+/.test(tabUrl.pathname) && !tabUrl.pathname.includes('fullcredits');
              }
              if (source === 'imdb' && tabHostname.includes('wikipedia.org')) {
                return true;
              }
            } catch (e) {
              return false;
            }
            return false;
          });

          sendResponse({ tabs: filteredTabs });
        });
      });
      return true; // Keep channel open for async response
    }

    // Handle updateTab for comparison feature
    if (message.action === 'updateTab') {
      const tabId = message.tabId;
      const updateOptions = {};

      if (message.url) {
        updateOptions.url = message.url;
      }
      if (message.active !== undefined) {
        updateOptions.active = message.active;
      }

      chrome.tabs.update(tabId, updateOptions, (tab) => {
        if (chrome.runtime.lastError) {
          console.error(`Error updating tab ${tabId}:`, chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`Successfully updated tab ${tabId}`);
          sendResponse({ success: true, tab: tab });
        }
      });
      return true; // Keep channel open for async response
    }

    // Handle startComparison for comparison feature
    if (message.action === 'startComparison') {
      console.log('Background: Starting comparison with consolidated data');
      (async () => {
        try {
          const { currentSource, currentPageInfo, selectedTab } = message;
          let comparisonData = {
            sourceA: null,
            sourceB: null,
            sourceAName: currentSource === 'wikipedia' ? 'Wikipedia' : 'IMDb',
            sourceBName: currentSource === 'wikipedia' ? 'IMDb' : 'Wikipedia'
          };

          // Get IMDb ID from either source
          const imdbId = currentPageInfo.imdbId || extractIMDbId(currentPageInfo.url) || extractIMDbId(selectedTab.url);

          if (!imdbId) {
            throw new Error('Could not extract IMDb ID');
          }

          // 1. Consolidate IMDb data from all pages
          console.log('Background: Consolidating IMDb data from all pages');
          const imdbConsolidatedData = await extractConsolidatedIMDbData(imdbId);

          // 2. Extract Wikipedia data
          console.log('Background: Extracting from Wikipedia');
          let wikipediaData = null;

          if (currentSource === 'wikipedia') {
            // Current page is Wikipedia
            wikipediaData = await extractWikipediaData(sender.tab.id);
          } else {
            // Selected tab is Wikipedia
            wikipediaData = await extractWikipediaData(selectedTab.id);
          }

          // 3. Perform comparison
          console.log('Background: Performing comparison');
          const comparisonResults = compareData(wikipediaData, imdbConsolidatedData);

          // 4. Build final comparison data structure
          comparisonData.sourceA = wikipediaData;
          comparisonData.sourceB = imdbConsolidatedData;
          comparisonData.comparison = comparisonResults;

          // Store comparison data and open comparison page
          console.log('Background: Storing comparison data and opening comparison page');
          chrome.storage.local.set({ 'comparison-data': comparisonData }, () => {
            const comparisonUrl = chrome.runtime.getURL('comparison-view-page.html');
            chrome.tabs.create({ url: comparisonUrl, active: true });
          });

          sendResponse({ success: true });
        } catch (error) {
          console.error('Comparison error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();

      return true; // Keep channel open for async response
    }

    // Handle copyMultipleTabs request
    if (message.type === 'copyMultipleTabs') {
      (async () => {
        try {
          const results = [];

          // Get copy format settings
          const settings = await chrome.storage.sync.get(['copyFormats']);
          const copyFormats = settings.copyFormats || {
            includeTitle: true,
            includeURL: true,
            separator: '\\n\\n---\\n\\n'
          };

          // Convert escaped newlines to actual newlines
          const separator = copyFormats.separator.replace(/\\n/g, '\n');

          // Get content from each selected tab
          for (const tabId of message.tabIds) {
            try {
              const response = await chrome.tabs.sendMessage(tabId, { type: 'copyPageContent' });
              if (response && response.success) {
                results.push({
                  content: response.content,
                  title: response.title,
                  url: response.url,
                  tabId: tabId
                });
              }
            } catch (error) {
              console.error(`Failed to get content from tab ${tabId}:`, error);
            }
          }

          if (results.length > 0) {
            // Format the combined content based on settings
            let combinedText = '';
            results.forEach((result, index) => {
              if (index > 0) {
                combinedText += separator;
              }

              // Add the actual page content
              combinedText += result.content;

              // Optionally add title and URL after the content
              if (copyFormats.includeTitle || copyFormats.includeURL) {
                combinedText += '\n\n';
                if (copyFormats.includeTitle) {
                  combinedText += result.title + '\n';
                }
                if (copyFormats.includeURL) {
                  combinedText += result.url;
                }
              }
            });

            // Send combined text back to sender tab to copy
            sendResponse({ success: true, count: results.length, combinedText: combinedText });
          } else {
            sendResponse({ success: false, error: 'No content copied' });
          }
        } catch (error) {
          console.error('Error copying multiple tabs:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep channel open for async response
    }

    // Handle getCurrentTabId request
    if (message.type === 'getCurrentTabId') {
      sendResponse({ tabId: sender.tab.id });
      return;
    }

    // Handle focusTab request
    if (message.type === 'focusTab') {
      const tabId = message.tabId;
      chrome.tabs.update(tabId, { active: true }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`Failed to focus tab ${tabId}:`, chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`Successfully focused tab ${tabId}`);
          sendResponse({ success: true });
        }
      });
      return true; // Keep channel open for async response
    }

    // Handle OCR requests from content script - forward to offscreen document
    if (message.action === 'performOCR') {
      console.log('Background: Received performOCR message from:', sender.tab?.id, sender.url);

      (async () => {
        try {
          console.log('Background: Creating/ensuring offscreen document exists...');

          // Ensure offscreen document is created
          await createOffscreenDocument();

          console.log('Background: Offscreen document ready, forwarding OCR request...');
          console.log('Background: Image data length:', message.imageData?.length || 0);

          // Forward the message to offscreen document
          const response = await chrome.runtime.sendMessage({
            action: 'performOCR',
            imageData: message.imageData
          });

          console.log('Background: Received response from offscreen:', response);

          if (!response) {
            throw new Error('No response from offscreen document');
          }

          sendResponse(response);
        } catch (error) {
          console.error('Background: Error handling OCR request:', error);
          console.error('Background: Error stack:', error.stack);
          sendResponse({
            success: false,
            error: error.message || 'Failed to process OCR request'
          });
        }
      })();

      // Return true to indicate we'll send response asynchronously
      return true;
    }
  });

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Handle CBFC India search
    if (info.menuItemId === 'cbfc-search') {
      if (!info.selectionText) {
        console.warn('CBFC search clicked without selection text');
        return;
      }

      const searchTerm = info.selectionText.trim();

      // Store the search term in chrome.storage for the CBFC page to read
      chrome.storage.local.set({ cbfcSearchTerm: searchTerm }, () => {
        // Open the CBFC search page
        chrome.tabs.create({
          url: 'https://www.cbfcindia.gov.in/cbfcAdmin/search-film.php',
          active: true
        });
      });
      return;
    }

    if (info.menuItemId.startsWith('grouping-')) {
      // Validate selection text exists
      if (!info.selectionText) {
        console.warn('Context menu clicked without selection text');
        return;
      }

      // Parse the grouping pattern from menu item ID
      const parts = info.menuItemId.split('-');
      const wordCount = parseInt(parts[1]);
      const patternId = parts.slice(2).join('-');

      // Use actual selected text instead of stored info
      // Don't double-sanitize - the text is already clean for use
      const words = info.selectionText.trim().split(/\s+/).slice(0, 4);
      const groupingPattern = groupingPatterns[wordCount].find(p => p.id === patternId);

      if (!groupingPattern) return;

      // Group words according to pattern
      const groupedWords = groupingPattern.pattern.map(indices => {
        return indices.map(i => words[i]).join(' ');
      });

      // Load settings and execute searches
      chrome.storage.sync.get(['profileSettings', 'defaultSearchEngine'], (result) => {
        const profileKey = `profile${groupedWords.length}`;
        const profileSettings = result.profileSettings?.[profileKey] || {};
        const searchEngine = result.defaultSearchEngine || 'google';

        // Generate queries based on grouped words
        const queries = generateQueries(groupedWords, profileSettings);

        // Open each query in a new tab
        queries.forEach((query, index) => {
          setTimeout(() => {
            const searchUrl = getSearchUrl(query, searchEngine);
            chrome.tabs.create({ url: searchUrl, active: index === 0 });
          }, index * 100);
        });
      });
    }
  });
