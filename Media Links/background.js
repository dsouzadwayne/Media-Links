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
      'full-phrase': { template: '"{0} {1} {2}"' },
      'and': { template: '"{0}" AND "{1}" AND "{2}"' }
    },
    4: {
      'plain': { template: '{0} {1} {2} {3}' },
      'all-quoted': { template: '"{0}" "{1}" "{2}" "{3}"' },
      'paired': { template: '"{0} {1}" "{2} {3}"' },
      'full-phrase': { template: '"{0} {1} {2} {3}"' },
      'and': { template: '"{0}" AND "{1}" AND "{2}" AND "{3}"' }
    }
  };

  const defaultPatterns = {
    1: { 'plain': true, 'quoted': true, 'intitle': true, 'allintitle': true, 'intext': true },
    2: { 'plain': true, 'first-quoted': true, 'second-quoted': true, 'both-quoted': true, 'phrase': true, 'intitle': true, 'and': true, 'or': true },
    3: { 'plain': true, 'all-quoted': true, 'first-phrase': true, 'full-phrase': true, 'and': true },
    4: { 'plain': true, 'all-quoted': true, 'paired': true, 'full-phrase': true, 'and': true }
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

  // Sanitize text for context menu display
  const sanitizeForContextMenu = (text) => {
    // Remove special characters that could cause issues
    // Limit length to prevent display issues
    return text.replace(/[&<>"']/g, '').substring(0, 50);
  };

  // Update context menu when selection changes
  const updateContextMenu = (selectionText) => {
    const words = selectionText.trim().split(/\s+/).slice(0, 4);
    const wordCount = words.length;

    // Sanitize words before storing
    const sanitizedWords = words.map(sanitizeForContextMenu);
    currentSelectionInfo = { words: sanitizedWords, wordCount };

    // Remove all existing menus
    chrome.contextMenus.removeAll(() => {
      // Recreate parent menu
      chrome.contextMenus.create({
        id: 'search-selection',
        title: 'Search with Media Links',
        contexts: ['selection']
      });

      // Create submenus based on word count
      const patterns = groupingPatterns[wordCount] || [];
      patterns.forEach(pattern => {
        // Replace placeholders with sanitized words
        let displayText = pattern.display;
        sanitizedWords.forEach((word, index) => {
          // Use replaceAll to handle all occurrences
          displayText = displayText.replaceAll(`word${index + 1}`, word);
        });

        chrome.contextMenus.create({
          id: `grouping-${wordCount}-${pattern.id}`,
          parentId: 'search-selection',
          title: displayText,
          contexts: ['selection']
        });
      });
    });
  };

  // Listen for selection updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'selectionChanged' && message.text) {
      updateContextMenu(message.text);
    }
  });

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId.startsWith('grouping-')) {
      // Parse the grouping pattern from menu item ID
      const parts = info.menuItemId.split('-');
      const wordCount = parseInt(parts[1]);
      const patternId = parts.slice(2).join('-');

      const words = currentSelectionInfo.words;
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
