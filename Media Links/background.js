chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });

    // Create context menu
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

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'search-selection' && info.selectionText) {
      // Split selected text into words (max 4)
      const words = info.selectionText.trim().split(/\s+/).slice(0, 4);

      // Load settings and execute searches
      chrome.storage.sync.get(['profileSettings', 'defaultSearchEngine'], (result) => {
        const wordCount = words.length;
        const profileKey = `profile${wordCount}`;
        const profileSettings = result.profileSettings?.[profileKey] || {};
        const searchEngine = result.defaultSearchEngine || 'google';

        // Generate queries based on saved profile
        const queries = generateQueries(words, profileSettings);

        // Open each query in a new tab
        queries.forEach((query, index) => {
          setTimeout(() => {
            const searchUrl = getSearchUrl(query, searchEngine);
            chrome.tabs.create({ url: searchUrl, active: index === 0 });
          }, index * 100); // Stagger tab opening
        });
      });
    }
  });
