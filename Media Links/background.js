// Helper function to generate unique IDs (UUID v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Offscreen document management for Tesseract OCR
let offscreenDocumentCreated = false;

// UserScripts world configuration for bookmarklet execution
let userScriptsWorldConfigured = false;

/**
 * Configure the userScripts world for bookmarklet execution
 * The USER_SCRIPT world is exempt from page CSP, allowing bookmarklets to run
 */
async function configureUserScriptsWorld() {
  if (userScriptsWorldConfigured) return;

  try {
    // Check if userScripts API is available
    if (!chrome.userScripts) {
      console.warn('Background: userScripts API not available');
      return;
    }

    // Configure the world with permissive CSP and messaging enabled
    await chrome.userScripts.configureWorld({
      csp: "script-src 'unsafe-inline' 'unsafe-eval';",
      messaging: true
    });

    userScriptsWorldConfigured = true;
    console.log('Background: userScripts world configured for bookmarklet execution');
  } catch (error) {
    console.error('Background: Failed to configure userScripts world:', error);
  }
}

/**
 * Execute a bookmarklet in the specified tab using userScripts API
 * This bypasses page CSP restrictions
 *
 * @param {number} tabId - The tab ID to execute in
 * @param {string} code - The JavaScript code to execute
 * @param {string} title - The bookmarklet title (for logging)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeBookmarkletInTab(tabId, code, title) {
  console.log(`Background: Executing bookmarklet "${title}" in tab ${tabId}`);

  // Log Chrome version and API availability for debugging
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
  console.log(`Background: Chrome version: ${chromeVersion}`);
  console.log(`Background: userScripts API available: ${!!chrome.userScripts}`);
  console.log(`Background: userScripts.execute available: ${!!(chrome.userScripts && chrome.userScripts.execute)}`);

  try {
    // Ensure userScripts world is configured
    await configureUserScriptsWorld();

    // Check if userScripts.execute is available (Chrome 135+)
    if (chrome.userScripts && typeof chrome.userScripts.execute === 'function') {
      try {
        console.log('Background: Using userScripts.execute (CSP-exempt, Trusted Types-exempt)');
        // Use userScripts.execute for CSP-exempt execution
        // The USER_SCRIPT world bypasses both CSP and Trusted Types
        await chrome.userScripts.execute({
          target: { tabId: tabId },
          js: [{ code: code }]
        });

        console.log(`Background: Bookmarklet "${title}" executed successfully via userScripts`);
        return { success: true };
      } catch (userScriptError) {
        console.error(`Background: userScripts.execute failed:`, userScriptError);
        console.log(`Background: Error name: ${userScriptError.name}, message: ${userScriptError.message}`);
        // Fall through to scripting.executeScript fallback
      }
    } else {
      console.log('Background: userScripts.execute not available (requires Chrome 135+ and Developer Mode)');
    }

    // Fallback: Try chrome.scripting.executeScript with MAIN world
    // Must handle Trusted Types for sites like YouTube that enforce it
    console.log('Background: Trying scripting.executeScript with Trusted Types handling');

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (jsCode) => {
        // Helper to execute code, handling Trusted Types if present
        const executeCode = (codeStr) => {
          try {
            // Method 1: Try using Trusted Types policy if available
            if (window.trustedTypes && window.trustedTypes.createPolicy) {
              try {
                // Create a policy for our bookmarklet execution
                const policy = window.trustedTypes.createPolicy('mediaLinksBookmarklet', {
                  createScript: (s) => s
                });
                const trustedCode = policy.createScript(codeStr);
                return { method: 'trustedTypes', result: eval(trustedCode) };
              } catch (ttError) {
                // Policy creation might fail if site has strict CSP for policies
                console.log('Trusted Types policy creation failed:', ttError.message);
              }
            }

            // Method 2: Try direct eval (works if no Trusted Types or CSP allows it)
            return { method: 'eval', result: eval(codeStr) };
          } catch (evalError) {
            // Method 3: Try Function constructor
            try {
              const fn = new Function(codeStr);
              return { method: 'function', result: fn() };
            } catch (fnError) {
              // Method 4: Try script tag with Trusted Types handling
              try {
                const script = document.createElement('script');

                if (window.trustedTypes && window.trustedTypes.createPolicy) {
                  try {
                    const scriptPolicy = window.trustedTypes.createPolicy('mediaLinksScript', {
                      createScript: (s) => s
                    });
                    script.text = scriptPolicy.createScript(codeStr);
                  } catch (e) {
                    // Fallback to direct assignment (will fail if Trusted Types enforced)
                    script.textContent = codeStr;
                  }
                } else {
                  script.textContent = codeStr;
                }

                document.documentElement.appendChild(script);
                script.remove();
                return { method: 'script', result: undefined };
              } catch (scriptError) {
                throw new Error(`All execution methods failed. Last error: ${scriptError.message}`);
              }
            }
          }
        };

        try {
          const execResult = executeCode(jsCode);
          console.log(`Bookmarklet executed via ${execResult.method}`);
          return { success: true, method: execResult.method };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      args: [code],
      world: 'MAIN'
    });

    // Check the injection result
    if (injectionResults && injectionResults.length > 0) {
      const result = injectionResults[0].result;
      if (result && result.success) {
        console.log(`Background: Bookmarklet "${title}" executed via scripting.executeScript (${result.method})`);
        return { success: true };
      } else {
        const errorMsg = result?.error || 'Execution failed in page context';
        console.log(`Background: scripting.executeScript failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    console.log(`Background: Bookmarklet "${title}" executed via scripting.executeScript (no result)`);
    return { success: true };

  } catch (error) {
    console.error(`Background: Failed to execute bookmarklet "${title}":`, error);
    return { success: false, error: error.message };
  }
}

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
 * Opens tabs as active (foreground) like the consolidated overview does
 * @param {string} imdbId - The IMDb ID
 * @param {function} sendProgress - Optional callback to send progress updates
 */
async function extractConsolidatedIMDbData(imdbId, sendProgress = () => {}) {
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
    // 1. Open all extraction tabs as active (foreground) tabs - like the consolidated overview
    console.log('Opening IMDb tabs for extraction (active/foreground)...');
    for (let i = 0; i < extractionPages.length; i++) {
      const page = extractionPages[i];
      sendProgress('imdb-open', `Opening ${page.name} (${i + 1}/${extractionPages.length})...`);
      const tab = await chrome.tabs.create({ url: page.url, active: true });
      openedTabs.push({ tab, page });
      console.log(`Opened ${page.name} tab (ID: ${tab.id})`);

      // Stagger tab opening by 300ms like consolidated overview
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 2. Wait for all tabs to fully load
    console.log('Waiting for all tabs to load...');
    sendProgress('imdb-loading', 'Waiting for IMDb pages to load...');

    // Helper function to check if a tab is loaded
    const isTabLoaded = async (tabId) => {
      try {
        const tab = await chrome.tabs.get(tabId);
        return tab.status === 'complete';
      } catch (e) {
        return false;
      }
    };

    // Wait for all tabs to be loaded (poll every 500ms, max 60 seconds)
    let allLoaded = false;
    let loadAttempts = 0;
    const maxLoadAttempts = 120; // 60 seconds

    while (!allLoaded && loadAttempts < maxLoadAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      loadAttempts++;

      const loadStates = await Promise.all(
        openedTabs.map(({ tab }) => isTabLoaded(tab.id))
      );

      allLoaded = loadStates.every(loaded => loaded);

      if (loadAttempts % 10 === 0) {
        const loadedCount = loadStates.filter(l => l).length;
        console.log(`Tab loading progress: ${loadedCount}/${openedTabs.length} loaded (${loadAttempts * 0.5}s elapsed)`);
      }
    }

    if (!allLoaded) {
      console.warn('Not all tabs loaded within timeout, proceeding anyway...');
    } else {
      console.log('All IMDb tabs loaded successfully');
    }

    // Additional wait for content scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Extract data from each tab
    console.log('Extracting data from IMDb tabs...');
    sendProgress('imdb-extract', 'Extracting data from IMDb pages...');
    for (let i = 0; i < openedTabs.length; i++) {
      const { tab, page } = openedTabs[i];
      try {
        console.log(`Sending extraction message to ${page.name} tab`);
        sendProgress('imdb-extract', `Extracting ${page.name} (${i + 1}/${openedTabs.length})...`);

        // Initialize maxChecks
        let maxChecks = 40; // 20 seconds max (reduced from 60 for better UX)

        // CRITICAL FIX: Use UUID instead of Date.now() for truly unique keys
        const uniqueStorageKey = `consolidatedViewData_${page.type}_${tab.id}_${generateUUID()}`;

        // Send extraction message to the tab with proper validation
        try {
          const messageResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'performConsolidatedExtraction',
            pageType: page.type,
            storageKey: uniqueStorageKey
          });

          // Verify message was acknowledged before starting polling
          if (!messageResponse || !messageResponse.success) {
            console.warn(`${page.name} tab did not acknowledge extraction request`);
            // Still wait for data via polling, but with reduced timeout
            maxChecks = 30; // Reduce timeout since acknowledgment failed
          } else {
            console.log(`${page.name} tab acknowledged extraction request`);
          }
        } catch (sendError) {
          console.warn(`Could not send message to ${page.name}:`, sendError.message);
          // Tab is unloaded or doesn't have content script - don't start polling
          consolidatedData[page.type] = [];
          console.log(`Skipping data retrieval for ${page.name} - tab not ready`);
          continue; // Skip to next tab
        }

        // CRITICAL FIX: Ensure cleanup ALWAYS happens with try-finally
        try {
          // Wait for data to be stored in chrome.storage (polling mechanism)
          let checkCount = 0;
          let lastProgressLog = Date.now();

          while (checkCount < maxChecks) {
            // Use unique key to prevent concurrent operations from overwriting each other
            const result = await chrome.storage.local.get([uniqueStorageKey]);

            if (result[uniqueStorageKey] !== undefined) {
              consolidatedData[page.type] = result[uniqueStorageKey];
              console.log(`✓ Retrieved ${page.name} data (${consolidatedData[page.type].length} items)`);
              break;
            }

            // Log progress every 5 seconds
            const now = Date.now();
            if (now - lastProgressLog >= 5000) {
              console.log(`Still waiting for ${page.name} data... (${checkCount * 0.5}s elapsed)`);
              lastProgressLog = now;

              // Check if tab is still alive - early exit if tab was closed
              try {
                const tabInfo = await chrome.tabs.get(tab.id);
                if (!tabInfo) {
                  console.warn(`Tab ${tab.id} no longer exists, stopping polling for ${page.name}`);
                  break;
                }
              } catch (tabError) {
                console.warn(`Tab ${tab.id} became invalid, stopping polling for ${page.name}`);
                break;
              }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            checkCount++;
          }

          if (checkCount >= maxChecks) {
            console.warn(`Timeout waiting for ${page.name} data after ${maxChecks * 0.5}s - using empty array`);
            consolidatedData[page.type] = [];
          }
        } finally {
          // CRITICAL FIX: Ensure cleanup ALWAYS happens
          try {
            await chrome.storage.local.remove([uniqueStorageKey]);
            console.log(`Cleaned up storage key: ${uniqueStorageKey}`);
          } catch (cleanupError) {
            console.warn(`Failed to clean up storage key ${uniqueStorageKey}:`, cleanupError);
          }
        }
      } catch (error) {
        console.error(`Error extracting from ${page.name}:`, error);
        consolidatedData[page.type] = [];
      }
    }

    // 4. Close all opened tabs
    console.log('Closing IMDb tabs...');
    sendProgress('imdb-cleanup', 'Closing IMDb tabs...');
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
   * Handles variations like "J.J. Abrams" vs "JJ Abrams"
   */
  function normalizeName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/\./g, '')        // Remove periods (J.J. -> JJ)
      .replace(/[''`]/g, '')     // Remove apostrophes
      .replace(/\s+/g, ' ');     // Collapse multiple spaces
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
   * Note: IMDb data uses 'roleType' field (e.g., "Cast", "Directors", "Writers", "Producers")
   */
  function flattenIMDbData(imdbData) {
    const flattened = {
      cast: [],
      directors: [],
      producers: [],
      writers: [],
      productionCompanies: []
    };

    // Flatten fullcredits data - use roleType field (not section)
    if (imdbData.fullcredits && Array.isArray(imdbData.fullcredits)) {
      imdbData.fullcredits.forEach(item => {
        // Check roleType field first (this is what imdb-customized-views.js sets)
        const roleType = (item.roleType || item.section || '').toLowerCase();

        if (roleType.includes('cast') || roleType === 'actor' || roleType === 'actress') {
          flattened.cast.push(item);
        } else if (roleType.includes('director') && !roleType.includes('executive')) {
          flattened.directors.push(item);
        } else if (roleType.includes('producer')) {
          flattened.producers.push(item);
        } else if (roleType.includes('writer')) {
          flattened.writers.push(item);
        }
      });
    }

    // Add company credits - use roleType or section field
    if (imdbData.companycredits && Array.isArray(imdbData.companycredits)) {
      flattened.productionCompanies = imdbData.companycredits.filter(c => {
        const roleType = (c.roleType || c.section || '').toLowerCase();
        return roleType.includes('production');
      });
    }

    return flattened;
  }

  /**
   * Consolidate both Wikipedia and IMDb data into unified format
   * Each entry has: { name, role, roleType, source }
   */
  function consolidateBothSources(wikipediaData, imdbData) {
    const consolidated = {
      cast: [],
      directors: [],
      producers: [],
      writers: [],
      productionCompanies: []
    };

    // Process Wikipedia data
    if (wikipediaData.cast && Array.isArray(wikipediaData.cast)) {
      wikipediaData.cast.forEach(item => {
        consolidated.cast.push({
          name: item.name || '',
          role: item.role || item.character || 'Cast',
          roleType: item.roleType || 'Cast',
          source: 'Wikipedia'
        });
      });
    }

    if (wikipediaData.directors && Array.isArray(wikipediaData.directors)) {
      wikipediaData.directors.forEach(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        const role = typeof item === 'string' ? 'Director' : (item.role || 'Director');
        consolidated.directors.push({
          name: name,
          role: role,
          roleType: 'Directing',
          source: 'Wikipedia'
        });
      });
    }

    if (wikipediaData.producers && Array.isArray(wikipediaData.producers)) {
      wikipediaData.producers.forEach(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        const role = typeof item === 'string' ? 'Producer' : (item.role || 'Producer');
        consolidated.producers.push({
          name: name,
          role: role,
          roleType: 'Producing',
          source: 'Wikipedia'
        });
      });
    }

    if (wikipediaData.writers && Array.isArray(wikipediaData.writers)) {
      wikipediaData.writers.forEach(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        const role = typeof item === 'string' ? 'Writer' : (item.role || 'Writer');
        consolidated.writers.push({
          name: name,
          role: role,
          roleType: 'Writing',
          source: 'Wikipedia'
        });
      });
    }

    if (wikipediaData.productionCompanies && Array.isArray(wikipediaData.productionCompanies)) {
      wikipediaData.productionCompanies.forEach(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        consolidated.productionCompanies.push({
          name: name,
          role: 'Production Company',
          roleType: 'Production',
          source: 'Wikipedia'
        });
      });
    }

    // Process IMDb data (flatten first)
    const flatIMDb = flattenIMDbData(imdbData);

    flatIMDb.cast.forEach(item => {
      consolidated.cast.push({
        name: item.name || '',
        role: item.role || item.character || 'Cast',
        roleType: item.roleType || 'Cast',
        source: 'IMDb'
      });
    });

    flatIMDb.directors.forEach(item => {
      consolidated.directors.push({
        name: item.name || '',
        role: item.role || 'Director',
        roleType: item.roleType || 'Directing',
        source: 'IMDb'
      });
    });

    flatIMDb.producers.forEach(item => {
      consolidated.producers.push({
        name: item.name || '',
        role: item.role || 'Producer',
        roleType: item.roleType || 'Producing',
        source: 'IMDb'
      });
    });

    flatIMDb.writers.forEach(item => {
      consolidated.writers.push({
        name: item.name || '',
        role: item.role || 'Writer',
        roleType: item.roleType || 'Writing',
        source: 'IMDb'
      });
    });

    flatIMDb.productionCompanies.forEach(item => {
      consolidated.productionCompanies.push({
        name: item.name || '',
        role: item.role || 'Production Company',
        roleType: item.roleType || 'Production',
        source: 'IMDb'
      });
    });

    return consolidated;
  }

  /**
   * Enhanced comparison that handles same-name-different-role conflicts
   * Returns: { common, wikiOnly, imdbOnly }
   */
  function compareListEnhanced(wikiList, imdbList, nameField = 'name') {
    const result = {
      common: [],
      wikiOnly: [],
      imdbOnly: []
    };

    // Create normalized name -> IMDb items map (can have multiple items per name)
    const imdbByName = new Map();
    imdbList.forEach(item => {
      const normalizedName = normalizeName(item[nameField]);
      if (!imdbByName.has(normalizedName)) {
        imdbByName.set(normalizedName, []);
      }
      imdbByName.get(normalizedName).push(item);
    });

    const processedImdbNames = new Set();

    // Process Wikipedia entries
    wikiList.forEach(wikiItem => {
      const normalizedName = normalizeName(wikiItem[nameField]);

      if (imdbByName.has(normalizedName)) {
        const imdbItems = imdbByName.get(normalizedName);
        processedImdbNames.add(normalizedName);

        // Check if any IMDb item has matching role
        const normalizedWikiRole = normalizeName(wikiItem.role || '');
        const exactMatch = imdbItems.find(imdbItem =>
          normalizeName(imdbItem.role || '') === normalizedWikiRole
        );

        if (exactMatch) {
          // Exact match - same name AND same role
          result.common.push({
            name: wikiItem.name,
            role: wikiItem.role,
            roleType: wikiItem.roleType,
            matchType: 'exact',
            sources: ['Wikipedia', 'IMDb'],
            conflictFlag: false
          });
        } else {
          // Name matches but role differs - add BOTH entries with conflict flag
          result.common.push({
            name: wikiItem.name,
            role: wikiItem.role,
            roleType: wikiItem.roleType,
            matchType: 'name-only',
            sources: ['Wikipedia'],
            conflictFlag: true
          });

          // Add all IMDb entries with different roles
          imdbItems.forEach(imdbItem => {
            result.common.push({
              name: imdbItem.name,
              role: imdbItem.role,
              roleType: imdbItem.roleType,
              matchType: 'name-only',
              sources: ['IMDb'],
              conflictFlag: true
            });
          });
        }
      } else {
        // Wikipedia only
        result.wikiOnly.push({
          name: wikiItem.name,
          role: wikiItem.role,
          roleType: wikiItem.roleType,
          sources: ['Wikipedia']
        });
      }
    });

    // Find IMDb-only entries (not matched with Wikipedia)
    imdbList.forEach(imdbItem => {
      const normalizedName = normalizeName(imdbItem[nameField]);
      if (!processedImdbNames.has(normalizedName)) {
        result.imdbOnly.push({
          name: imdbItem.name,
          role: imdbItem.role,
          roleType: imdbItem.roleType,
          sources: ['IMDb']
        });
      }
    });

    return result;
  }

  // Consolidate both sources into unified format
  const consolidated = consolidateBothSources(wikipediaData, imdbData);

  // Compare cast using enhanced comparison
  comparison.cast = compareListEnhanced(
    consolidated.cast.filter(item => item.source === 'Wikipedia'),
    consolidated.cast.filter(item => item.source === 'IMDb'),
    'name'
  );

  // Compare directors
  comparison.directors = compareListEnhanced(
    consolidated.directors.filter(item => item.source === 'Wikipedia'),
    consolidated.directors.filter(item => item.source === 'IMDb'),
    'name'
  );

  // Compare producers
  comparison.producers = compareListEnhanced(
    consolidated.producers.filter(item => item.source === 'Wikipedia'),
    consolidated.producers.filter(item => item.source === 'IMDb'),
    'name'
  );

  // Compare writers
  comparison.writers = compareListEnhanced(
    consolidated.writers.filter(item => item.source === 'Wikipedia'),
    consolidated.writers.filter(item => item.source === 'IMDb'),
    'name'
  );

  // Compare production companies
  comparison.production = compareListEnhanced(
    consolidated.productionCompanies.filter(item => item.source === 'Wikipedia'),
    consolidated.productionCompanies.filter(item => item.source === 'IMDb'),
    'name'
  );

  // Add other metadata (runtime, countries, languages, release dates)
  // These use simple structure with common/wikiOnly/imdbOnly format
  comparison.runtime = {
    common: [],
    wikiOnly: (wikipediaData.runtime || []).map(r => ({ name: r, sources: ['Wikipedia'] })),
    imdbOnly: (imdbData.technical || []).map(r => ({ name: typeof r === 'string' ? r : r.name, sources: ['IMDb'] }))
  };

  comparison.countries = {
    common: [],
    wikiOnly: (wikipediaData.countries || []).map(c => ({ name: c, sources: ['Wikipedia'] })),
    imdbOnly: []
  };

  comparison.languages = {
    common: [],
    wikiOnly: (wikipediaData.languages || []).map(l => ({ name: l, sources: ['Wikipedia'] })),
    imdbOnly: []
  };

  comparison.releaseDate = {
    common: [],
    wikiOnly: (wikipediaData.releaseDate || []).map(d => ({ name: d, sources: ['Wikipedia'] })),
    imdbOnly: (imdbData.releaseinfo || []).map(r => ({ name: typeof r === 'string' ? r : r.name, sources: ['IMDb'] }))
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

  // Queue size limiting constants
  const MAX_PENDING_UPDATES = 50; // Prevent unbounded growth
  const UPDATE_TIMEOUT = 5 * 60 * 1000; // 5 minutes - auto-clean old updates

  // Sanitize text for context menu display
  const sanitizeForContextMenu = (text) => {
    // Remove special characters that could cause issues
    // Limit length to prevent display issues
    return text.replace(/[&<>"']/g, '').substring(0, 50);
  };

  // Add update to queue with size limiting
  const addPendingUpdate = (textToUpdate) => {
    // Add timestamp to track age
    pendingUpdates.push({ text: textToUpdate, timestamp: Date.now() });

    // Clean up old updates (older than 5 minutes)
    const now = Date.now();
    pendingUpdates = pendingUpdates.filter(update =>
      now - update.timestamp < UPDATE_TIMEOUT
    );

    // If queue exceeds max size, remove oldest items
    if (pendingUpdates.length > MAX_PENDING_UPDATES) {
      const removedCount = pendingUpdates.length - MAX_PENDING_UPDATES;
      const removed = pendingUpdates.splice(0, removedCount);
      console.warn(`Pending updates queue exceeded limit. Removed ${removedCount} old items.`);
    }
  };

  // Process any pending updates that came in while we were busy
  const processPendingUpdate = () => {
    if (pendingUpdates.length > 0) {
      // Get the most recent update from the queue
      const updateObj = pendingUpdates.pop();
      const textToUpdate = updateObj.text || updateObj; // Handle both old and new format
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
        addPendingUpdate(selectionText);
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
              // HIGH SEVERITY FIX: Use safe string replacement instead of regex with user input
              sanitizedWords.forEach((word, index) => {
                const placeholder = `word${index + 1}`;
                // Use split and join for safe string replacement
                displayText = displayText.split(placeholder).join(word);
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
    let failedTabs = [];
    let successCount = 0;

    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      let completed = 0;
      const totalTabs = tabs.length;

      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'themeChanged',
          theme: theme
        }).then(() => {
          successCount++;
        }).catch((error) => {
          // Only track errors that aren't "no content script" errors
          if (error.message && !error.message.includes('Could not establish connection')) {
            failedTabs.push({ id: tab.id, url: tab.url, error: error.message });
            console.warn(`Failed to update theme for tab ${tab.id}:`, error);
          }
        }).finally(() => {
          completed++;

          // After all tabs processed, log summary
          if (completed === totalTabs && failedTabs.length > 0) {
            console.warn(`Theme broadcast completed: ${successCount} succeeded, ${failedTabs.length} failed`);
            console.warn('Failed tabs:', failedTabs);
          }
        });
      });
    });

    // Send to offscreen document
    chrome.runtime.sendMessage({
      type: 'themeChanged',
      theme: theme
    }).catch((error) => {
      // Only warn if the error is NOT "no offscreen document"
      if (error.message && !error.message.includes('Could not establish connection')) {
        console.warn('Failed to update theme for offscreen document:', error);
      }
    });
  };

  // Prevent duplicate message listener registration
  let messageListenerRegistered = false;

  // HIGH SEVERITY FIX: Only register listener once
  if (!messageListenerRegistered) {
    // Listen for selection updates and OCR requests
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background: Received message:', message.type || message.action, 'from:', sender.tab?.id);

    // Handle creating tabs for consolidated view extraction
    if (message.type === 'createTab') {
      console.log('Background: Creating tab with URL:', message.url);

      // Use promise-based approach for better error handling
      (async () => {
        try {
          // Validate context before starting
          if (!chrome.runtime?.id) {
            throw new Error('Extension context invalid');
          }

          const tab = await chrome.tabs.create({
            url: message.url,
            active: message.active || false
          });

          // Validate context after async operation
          if (!chrome.runtime?.id) {
            console.warn('Extension context lost after tab creation');
            // Clean up the tab we just created
            if (tab?.id) {
              await chrome.tabs.remove(tab.id).catch(() => {});
            }
            throw new Error('Extension context lost');
          }

          if (tab) {
            console.log('Background: Created tab:', tab.id, 'URL:', tab.url);
            sendResponse({ success: true, tabId: tab.id });
          } else {
            throw new Error('Tab creation failed - no tab returned');
          }
        } catch (error) {
          const errorMsg = error.message || JSON.stringify(error);
          console.error('Background: Error creating tab:', errorMsg, 'URL was:', message.url);

          // Only send response if context is still valid
          if (chrome.runtime?.id) {
            sendResponse({ success: false, error: errorMsg });
          }
        }
      })();

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
        // Helper to send progress updates to the initiating tab
        const sendProgress = (step, detail) => {
          try {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'comparisonProgress',
              step: step,
              detail: detail
            }).catch(() => {}); // Ignore errors if tab closed
          } catch (e) {
            // Ignore
          }
        };

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

          sendProgress('start', 'Starting comparison...');

          // 1. Consolidate IMDb data from all pages
          console.log('Background: Consolidating IMDb data from all pages');
          sendProgress('imdb-tabs', 'Opening IMDb pages...');
          const imdbConsolidatedData = await extractConsolidatedIMDbData(imdbId, sendProgress);

          // 2. Extract Wikipedia data
          console.log('Background: Extracting from Wikipedia');
          sendProgress('wikipedia', 'Extracting Wikipedia data...');
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
          sendProgress('comparing', 'Comparing data from both sources...');
          const comparisonResults = compareData(wikipediaData, imdbConsolidatedData);

          // 4. Build final comparison data structure
          comparisonData.sourceA = wikipediaData;
          comparisonData.sourceB = imdbConsolidatedData;
          comparisonData.comparison = comparisonResults;

          // Store comparison data and open comparison page
          console.log('Background: Storing comparison data and opening comparison page');
          sendProgress('complete', 'Opening comparison view...');

          chrome.storage.local.set({ 'comparison-data': comparisonData }, () => {
            // BUG FIX: Check for storage quota errors
            if (chrome.runtime.lastError) {
              console.error('Background: Failed to store comparison data:', chrome.runtime.lastError.message);
              sendResponse({ success: false, error: 'Failed to store comparison data: ' + chrome.runtime.lastError.message });
              return;
            }
            const comparisonUrl = chrome.runtime.getURL('comparison-view-page.html');
            chrome.tabs.create({ url: comparisonUrl, active: true }, () => {
              // Send success response after tab is created
              sendResponse({ success: true });
            });
          });
        } catch (error) {
          console.error('Comparison error:', error);
          sendProgress('error', error.message);
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
          let copyFormats = settings.copyFormats || {
            includeTitle: true,
            includeURL: true,
            separator: '\\n\\n---\\n\\n'
          };

          // MEDIUM FIX: Validate copyFormats structure
          if (!copyFormats || typeof copyFormats !== 'object') {
            console.warn('Invalid copyFormats, using defaults');
            copyFormats = {
              includeTitle: true,
              includeURL: true,
              separator: '\\n\\n---\\n\\n'
            };
          }

          // Validate separator exists and is a string
          if (typeof copyFormats.separator !== 'string') {
            console.warn('Invalid separator, using default');
            copyFormats.separator = '\\n\\n---\\n\\n';
          }

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

    // Handle openTranscriptView request from YouTube transcript copy script
    if (message.action === 'openTranscriptView') {
      console.log('Background: Opening transcript view page');
      chrome.tabs.create({ url: message.url, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to open transcript view:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, tabId: tab.id });
        }
      });
      return true; // Keep channel open for async response
    }

    // Handle focusCurrentTab request (used by stopwatch notifications)
    if (message.type === 'focusCurrentTab') {
      if (sender.tab && sender.tab.id) {
        const tabId = sender.tab.id;
        const windowId = sender.tab.windowId;

        console.log(`Background: focusCurrentTab - tabId: ${tabId}, windowId: ${windowId}`);

        // Use async/await for more reliable focus handling
        (async () => {
          try {
            // First, try to focus the window if windowId is valid
            if (windowId !== undefined && windowId !== chrome.windows.WINDOW_ID_NONE) {
              try {
                await chrome.windows.update(windowId, { focused: true });
                console.log(`Background: Window ${windowId} focused`);
              } catch (winError) {
                console.warn('Background: Failed to focus window:', winError.message);
                // Continue anyway - maybe the window is already focused
              }
            } else {
              console.warn('Background: No valid windowId, skipping window focus');
            }

            // Then activate the tab
            try {
              await chrome.tabs.update(tabId, { active: true });
              console.log(`Background: Tab ${tabId} activated`);
            } catch (tabError) {
              console.warn('Background: Failed to activate tab:', tabError.message);
              sendResponse({ success: false, error: tabError.message });
              return;
            }

            // Try to draw attention if focus didn't work (flash taskbar on Windows/Linux)
            try {
              await chrome.windows.update(windowId, { drawAttention: true });
              // Clear draw attention after a short delay
              setTimeout(async () => {
                try {
                  await chrome.windows.update(windowId, { drawAttention: false });
                } catch (e) {
                  // Ignore
                }
              }, 2000);
            } catch (e) {
              // drawAttention might not be supported, ignore
            }

            sendResponse({ success: true });
          } catch (error) {
            console.error('Background: focusCurrentTab error:', error);
            sendResponse({ success: false, error: error.message });
          }
        })();

        return true; // Keep channel open for async response
      } else {
        console.warn('Background: focusCurrentTab - no tab info available');
        sendResponse({ success: false, error: 'No tab information available' });
        return;
      }
    }

    // Handle openBookmarks request (used by stopwatch notifications)
    // Note: Bookmarklets (javascript: URLs) are now handled directly in stopwatch.js
    // This handler only opens regular URL bookmarks in new tabs
    if (message.type === 'openBookmarks') {
      const bookmarks = message.bookmarks;

      console.log('Background: Received openBookmarks request', {
        bookmarkCount: bookmarks?.length,
        senderUrl: sender.url
      });

      if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
        console.warn('Background: No bookmarks provided or invalid format');
        sendResponse({ success: false, error: 'No bookmarks provided' });
        return;
      }

      console.log(`Background: Opening ${bookmarks.length} bookmark(s) in new tabs`);

      (async () => {
        let openedCount = 0;
        let errors = [];
        const delayBetweenTabs = 300; // ms between opening each tab

        for (let i = 0; i < bookmarks.length; i++) {
          const bookmark = bookmarks[i];

          // Validate bookmark has a URL
          if (!bookmark.url) {
            console.warn(`Background: Skipping bookmark without URL:`, bookmark);
            errors.push(`Bookmark ${i + 1}: No URL`);
            continue;
          }

          // Skip bookmarklets - they should be handled by stopwatch.js directly
          if (bookmark.url.startsWith('javascript:')) {
            console.warn(`Background: Skipping bookmarklet (should be handled by content script):`, bookmark.title);
            continue;
          }

          console.log(`Background: Opening bookmark ${i + 1}/${bookmarks.length}:`, bookmark.title || bookmark.url);

          try {
            // Open URL in a new tab (first one active, rest in background)
            const newTab = await chrome.tabs.create({
              url: bookmark.url,
              active: i === 0 // First bookmark is active
            });
            openedCount++;
            console.log(`Background: Opened tab ${newTab.id}: ${bookmark.title || bookmark.url}`);

            // Wait before opening the next one (if there are more)
            if (i < bookmarks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, delayBetweenTabs));
            }
          } catch (error) {
            const errMsg = `Failed to open ${bookmark.title || bookmark.url}: ${error.message}`;
            console.error(`Background: ${errMsg}`, error);
            errors.push(errMsg);
          }
        }

        console.log(`Background: Finished. Opened: ${openedCount}, Errors: ${errors.length}`);
        sendResponse({ success: openedCount > 0, openedCount, errors: errors.length > 0 ? errors : undefined });
      })();

      return true; // Keep channel open for async response
    }

    // Handle executeBookmarklet request (used by bookmarklets.js when CSP blocks execution)
    // Uses userScripts API which is exempt from page CSP
    if (message.type === 'executeBookmarklet') {
      const { code, title } = message;

      console.log(`Background: Received executeBookmarklet request for "${title}"`);

      if (!code) {
        console.warn('Background: No code provided for bookmarklet execution');
        sendResponse({ success: false, error: 'No code provided' });
        return;
      }

      if (!sender.tab || !sender.tab.id) {
        console.warn('Background: No tab info available for bookmarklet execution');
        sendResponse({ success: false, error: 'No tab information available' });
        return;
      }

      (async () => {
        const result = await executeBookmarkletInTab(sender.tab.id, code, title || 'Untitled');
        sendResponse(result);
      })();

      return true; // Keep channel open for async response
    }

    // Handle executeMultipleBookmarklets request (batch execution)
    if (message.type === 'executeMultipleBookmarklets') {
      const { bookmarklets } = message;

      console.log(`Background: Received executeMultipleBookmarklets request for ${bookmarklets?.length || 0} bookmarklet(s)`);

      if (!bookmarklets || !Array.isArray(bookmarklets) || bookmarklets.length === 0) {
        console.warn('Background: No bookmarklets provided');
        sendResponse({ success: false, error: 'No bookmarklets provided', results: { total: 0, executed: 0, failed: 0 } });
        return;
      }

      if (!sender.tab || !sender.tab.id) {
        console.warn('Background: No tab info available for bookmarklet execution');
        sendResponse({ success: false, error: 'No tab information available' });
        return;
      }

      (async () => {
        const results = {
          total: bookmarklets.length,
          executed: 0,
          failed: 0,
          errors: []
        };

        for (const bookmarklet of bookmarklets) {
          if (!bookmarklet.code) {
            results.failed++;
            results.errors.push(`${bookmarklet.title || 'Untitled'}: No code`);
            continue;
          }

          const result = await executeBookmarkletInTab(
            sender.tab.id,
            bookmarklet.code,
            bookmarklet.title || 'Untitled'
          );

          if (result.success) {
            results.executed++;
          } else {
            results.failed++;
            results.errors.push(`${bookmarklet.title || 'Untitled'}: ${result.error}`);
          }
        }

        console.log(`Background: Batch bookmarklet execution complete. Executed: ${results.executed}/${results.total}`);
        sendResponse({ success: results.executed > 0, results });
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

    messageListenerRegistered = true;
    console.log('Background: Message listener registered');
  }
