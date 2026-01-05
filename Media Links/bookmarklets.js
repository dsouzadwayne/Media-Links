/**
 * Bookmarklets Handler
 * Handles execution of bookmarklets (javascript: URLs) and DOM actions
 *
 * For enterprise environments with strict CSP that blocks eval/new Function,
 * this module also supports config-based DOM actions as an alternative.
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.mediaLinksBookmarkletsInitialized) {
    return;
  }
  window.mediaLinksBookmarkletsInitialized = true;

  // Track if eval/Function is available (enterprise CSP may block it)
  let evalAvailable = null;

  /**
   * Check if eval/new Function is available (not blocked by CSP)
   */
  function isEvalAvailable() {
    if (evalAvailable !== null) return evalAvailable;

    try {
      new Function('return true')();
      evalAvailable = true;
    } catch (e) {
      evalAvailable = false;
      // Use log instead of warn to avoid showing in extension error page
      console.log('Bookmarklets: eval/Function blocked by CSP - using action-based fallback');
    }
    return evalAvailable;
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
   * Execute a bookmarklet - tries eval first, falls back to action parsing
   *
   * @param {string} jsCode - The JavaScript code to execute
   * @param {string} title - The bookmarklet title (for logging)
   * @returns {boolean} - True if execution succeeded, false otherwise
   */
  function executeBookmarklet(jsCode, title) {
    console.log(`Bookmarklets: Executing "${title}"`);
    console.log(`Bookmarklets: Code:`, jsCode.substring(0, 200) + (jsCode.length > 200 ? '...' : ''));

    // Try eval/Function if available (not blocked by CSP)
    if (isEvalAvailable()) {
      try {
        console.log('Bookmarklets: Using eval (CSP allows it)');
        if (jsCode.trim().startsWith('(') || jsCode.trim().startsWith('!') || jsCode.trim().startsWith('void')) {
          eval(jsCode);
        } else {
          const fn = new Function(jsCode);
          fn();
        }
        console.log(`Bookmarklets: "${title}" executed successfully via eval`);
        return true;
      } catch (e) {
        // If it's a CSP error, mark eval as unavailable and try fallback
        if (e.name === 'EvalError' || e.message.includes('Content Security Policy')) {
          evalAvailable = false;
          console.log('Bookmarklets: eval blocked by CSP, trying action-based fallback');
        } else {
          console.log(`Bookmarklets: "${title}" execution failed:`, e.message);
          return false;
        }
      }
    }

    // Fallback: Try to parse bookmarklet into DOM actions
    console.log('Bookmarklets: CSP blocks eval - attempting to parse bookmarklet into actions');
    const actions = parseBookmarkletToActions(jsCode);

    if (actions.length === 0) {
      console.log(`Bookmarklets: Could not parse "${title}" into actions. Enterprise CSP blocks eval.`);
      console.log('Bookmarklets: Consider using DOM Actions instead of bookmarklets.');
      console.log('Bookmarklets: Original code:', jsCode);
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
   * @returns {boolean} - True if execution succeeded, false otherwise
   */
  function executeBookmarkletFromUrl(bookmark) {
    if (!bookmark || !bookmark.url) {
      console.log('Bookmarklets: No bookmark or URL provided');
      return false;
    }

    const jsCode = parseBookmarkletUrl(bookmark.url);
    if (!jsCode) {
      return false;
    }

    return executeBookmarklet(jsCode, bookmark.title || 'Untitled');
  }

  /**
   * Execute multiple bookmarklets sequentially
   *
   * @param {array} bookmarks - Array of bookmark objects with url and title
   * @returns {object} - Results object with executed count and errors
   */
  function executeMultipleBookmarklets(bookmarks) {
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

    for (const bookmarklet of bookmarklets) {
      try {
        if (executeBookmarkletFromUrl(bookmarklet)) {
          results.executed++;
        } else {
          results.failed++;
          results.errors.push(`Failed to execute: ${bookmarklet.title || 'Untitled'}`);
        }
      } catch (e) {
        results.failed++;
        results.errors.push(`Error in "${bookmarklet.title || 'Untitled'}": ${e.message}`);
        console.log(`Bookmarklets: Exception processing "${bookmarklet.title}":`, e.message);
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
    // Bookmarklet execution (tries eval, falls back to action parsing)
    execute: executeBookmarklet,
    executeFromUrl: executeBookmarkletFromUrl,
    executeMultiple: executeMultipleBookmarklets,
    parse: parseBookmarkletUrl,
    isBookmarklet: isBookmarklet,

    // DOM Actions (enterprise-safe, no eval needed)
    action: executeDOMAction,
    parseToActions: parseBookmarkletToActions,

    // Utility
    isEvalAvailable: isEvalAvailable
  };

  // Check eval availability on init
  const evalStatus = isEvalAvailable() ? 'available' : 'BLOCKED by CSP (using action fallback)';
  console.log(`Bookmarklets: Handler initialized - eval is ${evalStatus}`);

})();
