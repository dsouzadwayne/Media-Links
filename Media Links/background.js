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

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });

    // Create parent context menu
    chrome.contextMenus.create({
      id: 'search-selection',
      title: 'Search with Media Links',
      contexts: ['selection']
    });

    // Create CBFC India search submenu
    chrome.contextMenus.create({
      id: 'cbfc-search',
      parentId: 'search-selection',
      title: 'Search on CBFC India',
      contexts: ['selection']
    });

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
  let pendingUpdate = null;  // Store only the most recent pending update

  // Sanitize text for context menu display
  const sanitizeForContextMenu = (text) => {
    // Remove special characters that could cause issues
    // Limit length to prevent display issues
    return text.replace(/[&<>"']/g, '').substring(0, 50);
  };

  // Process any pending update that came in while we were busy
  const processPendingUpdate = () => {
    if (pendingUpdate !== null) {
      // Get the most recent update
      const textToUpdate = pendingUpdate;
      pendingUpdate = null;  // Clear the pending update
      updateContextMenu(textToUpdate, true);
    }
  };

  // Update context menu when selection changes
  const updateContextMenu = (selectionText, immediate = false) => {
    clearTimeout(menuUpdateTimeout);

    const updateMenus = () => {
      // If already updating, store this request and return
      if (isUpdatingMenu) {
        pendingUpdate = selectionText;
        return;
      }

      const words = selectionText.trim().split(/\s+/).slice(0, 4);
      const wordCount = words.length;

      // Don't rebuild for empty selection
      if (wordCount === 0) return;

      // Sanitize words before storing
      const sanitizedWords = words.map(sanitizeForContextMenu);
      currentSelectionInfo = { words: sanitizedWords, wordCount };

      // Mark that we're updating
      isUpdatingMenu = true;

      // Remove all existing menus
      chrome.contextMenus.removeAll(() => {
        // Check if menu removal failed
        if (chrome.runtime.lastError) {
          console.error('Failed to remove context menus:', chrome.runtime.lastError);
          isUpdatingMenu = false;
          processPendingUpdate();
          return;
        }

        try {
          // Recreate parent menu
          chrome.contextMenus.create({
            id: 'search-selection',
            title: 'Search with Media Links',
            contexts: ['selection']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Failed to create parent menu:', chrome.runtime.lastError);
              isUpdatingMenu = false;
              processPendingUpdate();
              return;
            }

            // Always add CBFC India search option
            chrome.contextMenus.create({
              id: 'cbfc-search',
              parentId: 'search-selection',
              title: 'Search on CBFC India',
              contexts: ['selection']
            });

            // Add separator between CBFC and regular search options
            chrome.contextMenus.create({
              id: 'cbfc-separator',
              parentId: 'search-selection',
              type: 'separator',
              contexts: ['selection']
            });

            // Create submenus based on word count
            const patterns = groupingPatterns[wordCount] || [];
            let createdCount = 0;
            const totalPatterns = patterns.length;

            if (totalPatterns === 0) {
              isUpdatingMenu = false;
              processPendingUpdate();
              return;
            }

            patterns.forEach(pattern => {
              // Replace placeholders with sanitized words
              let displayText = pattern.display;
              sanitizedWords.forEach((word, index) => {
                // Use regex replace for compatibility
                const regex = new RegExp(`word${index + 1}`, 'g');
                displayText = displayText.replace(regex, word);
              });

              // Truncate menu title if too long (Chrome limit is ~50 chars)
              if (displayText.length > 50) {
                displayText = displayText.substring(0, 47) + '...';
              }

              try {
                chrome.contextMenus.create({
                  id: `grouping-${wordCount}-${pattern.id}`,
                  parentId: 'search-selection',
                  title: displayText,
                  contexts: ['selection']
                }, () => {
                  createdCount++;

                  // If this was the last menu item, mark update as complete
                  if (createdCount === totalPatterns) {
                    isUpdatingMenu = false;
                    processPendingUpdate();
                  }

                  if (chrome.runtime.lastError) {
                    console.error('Failed to create context menu item:', chrome.runtime.lastError, displayText);
                  }
                });
              } catch (error) {
                console.error('Failed to create context menu item:', error, displayText);
                createdCount++;

                // Check if we're done even with errors
                if (createdCount === totalPatterns) {
                  isUpdatingMenu = false;
                  processPendingUpdate();
                }
              }
            });
          });
        } catch (error) {
          console.error('Failed to create context menu:', error);
          isUpdatingMenu = false;
          processPendingUpdate();
        }
      });
    };

    // If immediate update requested (from contextmenu), update right away
    // Otherwise use minimal debouncing for other events
    if (immediate) {
      updateMenus();
    } else {
      menuUpdateTimeout = setTimeout(updateMenus, 20);
    }
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
