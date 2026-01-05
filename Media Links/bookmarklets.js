/**
 * Bookmarklets Handler
 * Handles execution of bookmarklets (javascript: URLs) and DOM actions
 *
 * Uses MonkeyEngine for script execution with CSP bypass capabilities.
 * Also supports config-based DOM actions as a fallback for strict CSP environments.
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.mediaLinksBookmarkletsInitialized) {
    return;
  }
  window.mediaLinksBookmarkletsInitialized = true;

  // Wait for MonkeyEngine to be available
  function getMonkeyEngine() {
    return window.MonkeyEngine;
  }

  /**
   * Check if extension context is valid for messaging
   */
  function isExtensionContextValid() {
    const engine = getMonkeyEngine();
    if (engine) {
      return engine.isExtensionContextValid();
    }
    // Fallback check
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Execute bookmarklet via background script
   * Delegates to MonkeyEngine
   */
  async function executeViaBackground(jsCode, title) {
    const engine = getMonkeyEngine();
    if (engine) {
      const result = await engine.executeViaBackground(jsCode, title);
      if (result.success) {
        console.log(`Bookmarklets: "${title}" executed successfully via background`);
      }
      return result.success;
    }
    console.log('Bookmarklets: MonkeyEngine not available for background execution');
    return false;
  }

  /**
   * Execute multiple bookmarklets via background script
   * Delegates to MonkeyEngine
   */
  async function executeMultipleViaBackground(bookmarklets) {
    const engine = getMonkeyEngine();
    if (engine) {
      const result = await engine.executeMultipleViaBackground(bookmarklets);
      console.log(`Bookmarklets: Background batch execution complete:`, result.results);
      return result.results;
    }
    return { total: bookmarklets.length, executed: 0, failed: bookmarklets.length, errors: ['MonkeyEngine not available'] };
  }

  /**
   * Check if eval/new Function is available (not blocked by CSP)
   */
  function isEvalAvailable() {
    const engine = getMonkeyEngine();
    if (engine) {
      return engine.isEvalAvailable();
    }
    // Fallback check
    try {
      new Function('return true')();
      return true;
    } catch (e) {
      console.log('Bookmarklets: eval/Function blocked by CSP');
      return false;
    }
  }

  /**
   * Check if script tag injection is available (not blocked by CSP)
   */
  function isScriptInjectionAvailable() {
    const engine = getMonkeyEngine();
    if (engine) {
      return engine.isScriptInjectionAvailable();
    }
    // Fallback check
    try {
      const testScript = document.createElement('script');
      testScript.textContent = 'window.__bookmarkletTestFlag = true;';
      document.documentElement.appendChild(testScript);
      testScript.remove();
      if (window.__bookmarkletTestFlag) {
        delete window.__bookmarkletTestFlag;
        return true;
      }
    } catch (e) {
      // CSP blocked
    }
    return false;
  }

  /**
   * Execute code via script tag injection
   * Delegates to MonkeyEngine if available
   */
  function executeViaScriptInjection(jsCode) {
    const engine = getMonkeyEngine();
    if (engine) {
      const result = engine.executeViaScriptTag(jsCode);
      return result.success;
    }
    // Fallback
    try {
      const script = document.createElement('script');
      script.textContent = `try { ${jsCode} } catch (e) { console.error('Bookmarklet error:', e); }`;
      document.documentElement.appendChild(script);
      script.remove();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Execute a DOM action without eval (enterprise-safe)
   *
   * Supported actions:
   * - check: Check checkbox(es) matching selector
   * - uncheck: Uncheck checkbox(es) matching selector
   * - click: Click element(s) matching selector
   * - setValue: Set value of input(s) matching selector
   * - focus: Focus element matching selector
   * - getText: Get text content (returns value, doesn't modify)
   * - hasText: Check if page contains text (returns boolean)
   * - alert: Show an alert message
   *
   * @param {object} action - Action configuration
   * @param {string} action.type - Action type (check, uncheck, click, setValue, etc.)
   * @param {string} action.selector - CSS selector for target element(s)
   * @param {string} action.value - Value for setValue action or text for hasText/alert
   * @param {boolean} action.all - If true, apply to all matching elements (default: first only)
   * @returns {object} - Result with success boolean and data
   */
  function executeDOMAction(action) {
    if (!action || !action.type) {
      console.log('Bookmarklets: Invalid action - missing type');
      return { success: false, error: 'Missing action type' };
    }

    console.log(`Bookmarklets: Executing DOM action: ${action.type}`, action);

    try {
      const selector = action.selector;
      const value = action.value;
      const all = action.all === true;

      // Get elements if selector is provided
      let elements = [];
      if (selector) {
        elements = all
          ? Array.from(document.querySelectorAll(selector))
          : [document.querySelector(selector)].filter(Boolean);

        if (elements.length === 0) {
          console.log(`Bookmarklets: No elements found for selector: ${selector}`);
          return { success: false, error: `No elements found: ${selector}`, elementsFound: 0 };
        }
        console.log(`Bookmarklets: Found ${elements.length} element(s) for selector: ${selector}`);
      }

      switch (action.type) {
        case 'check':
          elements.forEach(el => {
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = true;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          return { success: true, elementsModified: elements.length };

        case 'uncheck':
          elements.forEach(el => {
            if (el.type === 'checkbox') {
              el.checked = false;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          return { success: true, elementsModified: elements.length };

        case 'click':
          elements.forEach(el => el.click());
          return { success: true, elementsClicked: elements.length };

        case 'setValue':
          elements.forEach(el => {
            el.value = value || '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
          return { success: true, elementsModified: elements.length };

        case 'focus':
          if (elements[0]) {
            elements[0].focus();
            return { success: true };
          }
          return { success: false, error: 'No element to focus' };

        case 'getText':
          if (elements[0]) {
            const text = elements[0].textContent || elements[0].value || '';
            return { success: true, text: text };
          }
          return { success: false, error: 'No element found' };

        case 'hasText':
          const searchText = (value || '').toLowerCase();
          const bodyText = document.body.textContent.toLowerCase();
          const found = bodyText.includes(searchText);
          return { success: true, found: found, searchText: value };

        case 'alert':
          alert(value || 'Action completed');
          return { success: true };

        default:
          return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (e) {
      console.log(`Bookmarklets: DOM action failed:`, e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Parse a bookmarklet and try to convert it to DOM actions
   * This is a best-effort parser for common bookmarklet patterns
   *
   * Note: This parser cannot handle conditional logic (if/else).
   * For complex bookmarklets, use DOM Actions directly.
   */
  function parseBookmarkletToActions(jsCode) {
    const actions = [];
    // Track seen selectors to prevent duplicates
    const seenActions = new Set();

    /**
     * Helper to add an action while preventing duplicates
     */
    function addAction(action) {
      const key = `${action.type}|${action.selector}|${action.all || false}|${action.value || ''}`;
      if (!seenActions.has(key)) {
        seenActions.add(key);
        actions.push(action);
      }
    }

    /**
     * Extract selector from a querySelector/getElementById call
     * Handles nested quotes like: 'input[name="foo"]'
     */
    function extractSelector(code, startIndex) {
      const quoteChar = code[startIndex];
      if (quoteChar !== '"' && quoteChar !== "'") return null;

      let result = '';
      let i = startIndex + 1;
      let depth = 0;

      while (i < code.length) {
        const char = code[i];

        // Handle escaped characters
        if (char === '\\' && i + 1 < code.length) {
          result += char + code[i + 1];
          i += 2;
          continue;
        }

        // Track nested quotes of the OPPOSITE type
        if (char === '"' && quoteChar === "'") depth += 0; // ignore
        if (char === "'" && quoteChar === '"') depth += 0; // ignore

        // End of selector
        if (char === quoteChar && depth === 0) {
          return { selector: result, endIndex: i };
        }

        result += char;
        i++;
      }

      return null; // Unclosed string
    }

    // First, find all querySelector/getElementById calls and map variable names to selectors
    const selectorMap = {};

    // Pattern: var/let/const x = document.querySelector('selector')
    // Use a more robust approach that handles nested quotes
    const varQuerySelectorPattern = /(?:var|let|const)\s+(\w+)\s*=\s*document\.querySelector\(\s*(['"])/g;
    let match;
    while ((match = varQuerySelectorPattern.exec(jsCode)) !== null) {
      const varName = match[1];
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        selectorMap[varName] = extracted.selector;
        console.log(`Bookmarklets: Found variable ${varName} = querySelector('${extracted.selector}')`);
      }
    }

    // Pattern: var/let/const x = document.getElementById('id')
    const varGetByIdPattern = /(?:var|let|const)\s+(\w+)\s*=\s*document\.getElementById\(\s*['"]([\w-]+)['"]\s*\)/g;
    while ((match = varGetByIdPattern.exec(jsCode)) !== null) {
      selectorMap[match[1]] = '#' + match[2];
      console.log(`Bookmarklets: Found variable ${match[1]} = getElementById('${match[2]}') -> '#${match[2]}'`);
    }

    // Pattern: direct document.querySelector('selector').checked = true
    const checkPattern = /document\.querySelector\(\s*(['"])/g;
    while ((match = checkPattern.exec(jsCode)) !== null) {
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        // Check what comes after the selector
        const afterSelector = jsCode.substring(extracted.endIndex + 1, extracted.endIndex + 50);
        if (/^\s*\)\s*\.\s*checked\s*=\s*true/.test(afterSelector)) {
          addAction({ type: 'check', selector: extracted.selector });
        }
      }
    }

    // Pattern: direct document.getElementById('id').checked = true
    const checkByIdPattern = /document\.getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*checked\s*=\s*true/g;
    while ((match = checkByIdPattern.exec(jsCode)) !== null) {
      addAction({ type: 'check', selector: '#' + match[1] });
    }

    // Pattern: variable.checked = true (using mapped selectors)
    const varCheckPattern = /(\w+)\.checked\s*=\s*true/g;
    while ((match = varCheckPattern.exec(jsCode)) !== null) {
      if (selectorMap[match[1]]) {
        addAction({ type: 'check', selector: selectorMap[match[1]] });
      }
    }

    // Pattern: document.querySelectorAll('selector').forEach(...checked = true)
    const checkAllPattern = /document\.querySelectorAll\(\s*(['"])/g;
    while ((match = checkAllPattern.exec(jsCode)) !== null) {
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        // Check if followed by forEach and checked = true
        const afterSelector = jsCode.substring(extracted.endIndex + 1, extracted.endIndex + 200);
        if (/^\s*\).*?\.checked\s*=\s*true/.test(afterSelector)) {
          addAction({ type: 'check', selector: extracted.selector, all: true });
        }
      }
    }

    // Pattern: document.querySelectorAll('selector').forEach(...click())
    const clickAllQueryPattern = /document\.querySelectorAll\(\s*(['"])/g;
    while ((match = clickAllQueryPattern.exec(jsCode)) !== null) {
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        const afterSelector = jsCode.substring(extracted.endIndex + 1, extracted.endIndex + 200);
        if (/^\s*\).*?\.click\s*\(\s*\)/.test(afterSelector)) {
          addAction({ type: 'click', selector: extracted.selector, all: true });
        }
      }
    }

    // Pattern: direct document.querySelector('selector').value = 'something'
    const directValueQueryPattern = /document\.querySelector\(\s*(['"])/g;
    while ((match = directValueQueryPattern.exec(jsCode)) !== null) {
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        const afterSelector = jsCode.substring(extracted.endIndex + 1, extracted.endIndex + 100);
        const valueMatch = afterSelector.match(/^\s*\)\s*\.\s*value\s*=\s*['"](.*?)['"]/);
        if (valueMatch) {
          addAction({ type: 'setValue', selector: extracted.selector, value: valueMatch[1] });
        }
      }
    }

    // Pattern: direct document.getElementById('id').value = 'something'
    const valueByIdPattern = /document\.getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*value\s*=\s*['"](.*?)['"]/g;
    while ((match = valueByIdPattern.exec(jsCode)) !== null) {
      addAction({ type: 'setValue', selector: '#' + match[1], value: match[2] });
    }

    // Pattern: variable.value = 'something' (using mapped selectors)
    const varValuePattern = /(\w+)\.value\s*=\s*['"](.*?)['"]/g;
    while ((match = varValuePattern.exec(jsCode)) !== null) {
      if (selectorMap[match[1]]) {
        addAction({ type: 'setValue', selector: selectorMap[match[1]], value: match[2] });
      }
    }

    // Pattern: direct document.querySelector('selector').click()
    const clickQueryPattern = /document\.querySelector\(\s*(['"])/g;
    while ((match = clickQueryPattern.exec(jsCode)) !== null) {
      const quoteStart = match.index + match[0].length - 1;
      const extracted = extractSelector(jsCode, quoteStart);
      if (extracted) {
        const afterSelector = jsCode.substring(extracted.endIndex + 1, extracted.endIndex + 50);
        if (/^\s*\)\s*\.\s*click\s*\(\s*\)/.test(afterSelector)) {
          addAction({ type: 'click', selector: extracted.selector });
        }
      }
    }

    // Pattern: direct document.getElementById('id').click()
    const clickByIdPattern = /document\.getElementById\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*click\s*\(\s*\)/g;
    while ((match = clickByIdPattern.exec(jsCode)) !== null) {
      addAction({ type: 'click', selector: '#' + match[1] });
    }

    // Pattern: variable.click() (using mapped selectors)
    const varClickPattern = /(\w+)\.click\(\)/g;
    while ((match = varClickPattern.exec(jsCode)) !== null) {
      if (selectorMap[match[1]]) {
        addAction({ type: 'click', selector: selectorMap[match[1]] });
      }
    }

    // Skip alert() patterns inside else blocks - they're usually error messages
    // Only parse alerts that are NOT preceded by 'else'
    // For now, we skip alerts entirely since they're often conditional error messages
    // If you need alerts, use DOM Actions directly

    return actions;
  }

  /**
   * Execute a bookmarklet - uses MonkeyEngine for multi-method execution
   *
   * MonkeyEngine tries these methods in order:
   * 1. Script tag injection (MAIN world, full page access)
   * 2. Blob URL injection (bypasses inline CSP)
   * 3. Trusted Types policy (for sites enforcing Trusted Types)
   * 4. eval/Function (isolated world, DOM access only)
   * 5. Shadow DOM injection
   * 6. Sandboxed iframe
   * 7. Background script with chrome.scripting.executeScript
   *
   * Falls back to DOM action parsing if all methods fail.
   *
   * @param {string} jsCode - The JavaScript code to execute
   * @param {string} title - The bookmarklet title (for logging)
   * @returns {Promise<boolean>} - True if execution succeeded, false otherwise
   */
  async function executeBookmarklet(jsCode, title) {
    console.log(`Bookmarklets: Executing "${title}"`);
    console.log(`Bookmarklets: Code:`, jsCode.substring(0, 200) + (jsCode.length > 200 ? '...' : ''));

    // Use MonkeyEngine if available
    const engine = getMonkeyEngine();
    if (engine) {
      const result = await engine.execute(jsCode, { title });

      if (result.success) {
        console.log(`Bookmarklets: "${title}" executed successfully via ${result.method}`);
        return true;
      }

      console.log(`Bookmarklets: MonkeyEngine failed (${result.error}), trying DOM action parsing`);
    } else {
      // Fallback if MonkeyEngine not loaded
      console.log('Bookmarklets: MonkeyEngine not available, using legacy methods');

      // Try script injection
      if (isScriptInjectionAvailable()) {
        if (executeViaScriptInjection(jsCode)) {
          console.log(`Bookmarklets: "${title}" executed via script injection`);
          return true;
        }
      }

      // Try eval
      if (isEvalAvailable()) {
        try {
          if (jsCode.trim().startsWith('(') || jsCode.trim().startsWith('!') || jsCode.trim().startsWith('void')) {
            eval(jsCode);
          } else {
            new Function(jsCode)();
          }
          console.log(`Bookmarklets: "${title}" executed via eval`);
          return true;
        } catch (e) {
          console.log('Bookmarklets: eval failed:', e.message);
        }
      }

      // Try background execution
      const bgResult = await executeViaBackground(jsCode, title);
      if (bgResult) {
        return true;
      }
    }

    // Final fallback: DOM action parsing
    console.log('Bookmarklets: Attempting to parse bookmarklet into DOM actions');
    const actions = parseBookmarkletToActions(jsCode);

    if (actions.length === 0) {
      console.log(`Bookmarklets: Could not parse "${title}" into actions.`);
      console.log('Bookmarklets: All execution methods failed.');
      return false;
    }

    console.log(`Bookmarklets: Parsed ${actions.length} action(s) from bookmarklet`);

    // Execute parsed actions
    let allSucceeded = true;
    for (const action of actions) {
      const result = executeDOMAction(action);
      if (!result.success) {
        allSucceeded = false;
        console.log(`Bookmarklets: Action failed:`, action, result.error);
      }
    }

    return allSucceeded;
  }

  /**
   * Parse a bookmarklet URL and extract the JavaScript code
   * Handles single and double-encoded bookmarklets
   *
   * @param {string} bookmarkletUrl - The javascript: URL
   * @returns {string|null} - The decoded JavaScript code, or null if invalid
   */
  function parseBookmarkletUrl(bookmarkletUrl) {
    if (!bookmarkletUrl || typeof bookmarkletUrl !== 'string') {
      console.log('Bookmarklets: Invalid bookmarklet URL provided');
      return null;
    }

    if (!bookmarkletUrl.startsWith('javascript:')) {
      console.log('Bookmarklets: URL does not start with javascript:', bookmarkletUrl);
      return null;
    }

    try {
      // Remove 'javascript:' prefix
      let code = bookmarkletUrl.slice(11);

      // Decode URI components - some bookmarklets are double or triple encoded
      // Keep decoding while the string contains encoded characters
      let previousCode;
      let maxIterations = 3; // Prevent infinite loops
      let iterations = 0;

      while (iterations < maxIterations) {
        previousCode = code;
        try {
          code = decodeURIComponent(code);
        } catch (e) {
          // If decoding fails, the string is not encoded (or has invalid encoding)
          break;
        }
        // If decoding didn't change anything, we're done
        if (code === previousCode) {
          break;
        }
        iterations++;
      }

      if (iterations > 1) {
        console.log(`Bookmarklets: Decoded ${iterations} times (was multi-encoded)`);
      }

      return code;
    } catch (e) {
      console.log('Bookmarklets: Failed to decode bookmarklet URL:', e.message);
      return null;
    }
  }

  /**
   * Execute a bookmarklet from its URL
   *
   * @param {object} bookmark - Bookmark object with url and title properties
   * @returns {Promise<boolean>} - True if execution succeeded, false otherwise
   */
  async function executeBookmarkletFromUrl(bookmark) {
    if (!bookmark || !bookmark.url) {
      console.log('Bookmarklets: No bookmark or URL provided');
      return false;
    }

    const jsCode = parseBookmarkletUrl(bookmark.url);
    if (!jsCode) {
      return false;
    }

    return await executeBookmarklet(jsCode, bookmark.title || 'Untitled');
  }

  /**
   * Execute multiple bookmarklets sequentially
   * Uses MonkeyEngine for efficient multi-method execution
   *
   * @param {array} bookmarks - Array of bookmark objects with url and title
   * @returns {Promise<object>} - Results object with executed count and errors
   */
  async function executeMultipleBookmarklets(bookmarks) {
    const results = {
      total: 0,
      executed: 0,
      failed: 0,
      errors: []
    };

    if (!bookmarks || !Array.isArray(bookmarks)) {
      console.log('Bookmarklets: Invalid bookmarks array provided');
      return results;
    }

    // Filter to only bookmarklets
    const bookmarklets = bookmarks.filter(b => b.url && b.url.startsWith('javascript:'));
    results.total = bookmarklets.length;

    console.log(`Bookmarklets: Processing ${bookmarklets.length} bookmarklet(s)`);

    // Parse all bookmarklet URLs first
    const parsedBookmarklets = bookmarklets.map(b => ({
      code: parseBookmarkletUrl(b.url),
      title: b.title || 'Untitled'
    })).filter(b => b.code !== null);

    if (parsedBookmarklets.length === 0) {
      results.failed = bookmarklets.length;
      results.errors.push('Failed to parse bookmarklet URLs');
      return results;
    }

    // Use MonkeyEngine if available
    const engine = getMonkeyEngine();
    if (engine) {
      const engineResults = await engine.executeMultiple(parsedBookmarklets);
      results.executed = engineResults.executed;
      results.failed = engineResults.failed;
      results.errors = engineResults.errors || [];
    } else {
      // Fallback: Check if local execution methods are available
      const canExecuteLocally = isScriptInjectionAvailable() || isEvalAvailable();

      if (canExecuteLocally) {
        // Try local execution for each bookmarklet
        for (const bookmarklet of bookmarklets) {
          try {
            if (await executeBookmarkletFromUrl(bookmarklet)) {
              results.executed++;
            } else {
              results.failed++;
              results.errors.push(`Failed to execute: ${bookmarklet.title || 'Untitled'}`);
            }
          } catch (e) {
            results.failed++;
            results.errors.push(`Error in "${bookmarklet.title || 'Untitled'}": ${e.message}`);
          }
        }
      } else {
        // Use background batch execution
        console.log('Bookmarklets: Local execution blocked, using background batch execution');
        const bgResults = await executeMultipleViaBackground(parsedBookmarklets);
        results.executed = bgResults.executed;
        results.failed = bgResults.failed;
        results.errors = bgResults.errors || [];
      }
    }

    console.log(`Bookmarklets: Finished. Executed: ${results.executed}/${results.total}, Failed: ${results.failed}`);
    return results;
  }

  /**
   * Check if a URL is a bookmarklet
   *
   * @param {string} url - The URL to check
   * @returns {boolean} - True if it's a bookmarklet (javascript: URL)
   */
  function isBookmarklet(url) {
    return url && typeof url === 'string' && url.startsWith('javascript:');
  }

  // Expose functions globally for use by other scripts (like stopwatch.js)
  window.MediaLinksBookmarklets = {
    // Bookmarklet execution (uses MonkeyEngine with multi-method fallback)
    execute: executeBookmarklet,
    executeFromUrl: executeBookmarkletFromUrl,
    executeMultiple: executeMultipleBookmarklets,
    parse: parseBookmarkletUrl,
    isBookmarklet: isBookmarklet,

    // Script injection (MAIN world)
    executeInPageContext: executeViaScriptInjection,
    isScriptInjectionAvailable: isScriptInjectionAvailable,

    // Background execution (CSP-bypassing)
    executeViaBackground: executeViaBackground,
    executeMultipleViaBackground: executeMultipleViaBackground,

    // DOM Actions (enterprise-safe, no eval needed)
    action: executeDOMAction,
    parseToActions: parseBookmarkletToActions,

    // Utility
    isEvalAvailable: isEvalAvailable,
    isExtensionContextValid: isExtensionContextValid,

    // MonkeyEngine access
    getEngine: getMonkeyEngine
  };

  // Check availability on init
  const engine = getMonkeyEngine();
  if (engine) {
    const status = engine.getMethodStatus();
    console.log(`Bookmarklets: Handler initialized with MonkeyEngine`, status);
  } else {
    const scriptStatus = isScriptInjectionAvailable() ? 'available' : 'blocked';
    const evalStatus = isEvalAvailable() ? 'available' : 'blocked';
    const bgStatus = isExtensionContextValid() ? 'available' : 'unavailable';
    console.log(`Bookmarklets: Handler initialized (legacy) - script: ${scriptStatus}, eval: ${evalStatus}, bg: ${bgStatus}`);
  }

})();
