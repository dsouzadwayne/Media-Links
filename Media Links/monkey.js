/**
 * Monkey.js - Script Injection Engine
 *
 * Provides multiple methods to execute JavaScript code in web pages,
 * bypassing Content Security Policy (CSP) and Trusted Types restrictions.
 *
 * Inspired by Tampermonkey and Violentmonkey techniques.
 *
 * Methods (in order of preference):
 * 1. Script tag injection (MAIN world, full page access)
 * 2. Blob URL injection (bypasses inline CSP)
 * 3. Trusted Types policy (for sites enforcing Trusted Types)
 * 4. eval/Function constructor (isolated world)
 * 5. Shadow DOM injection (isolated container)
 * 6. Sandboxed iframe (fallback for strict CSP)
 * 7. Background execution via chrome.scripting.executeScript
 * 8. Nonce detection and reuse (for CSP with nonces)
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.MonkeyEngine) {
    return;
  }

  // Track availability of execution methods
  const methodAvailability = {
    scriptInjection: null,
    blobUrl: null,
    trustedTypes: null,
    eval: null,
    shadowDom: null,
    iframe: null,
    nonce: null
  };

  // Detected page nonce (if any)
  let detectedNonce = null;

  /**
   * Check if extension context is valid for messaging
   */
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect CSP nonce from existing scripts
   * Sites using CSP with nonces have scripts like: <script nonce="abc123">
   */
  function detectNonce() {
    if (detectedNonce !== null) return detectedNonce;

    try {
      // Look for scripts with nonce attribute
      const scripts = document.querySelectorAll('script[nonce]');
      for (const script of scripts) {
        const nonce = script.getAttribute('nonce') || script.nonce;
        if (nonce && nonce.length > 0) {
          detectedNonce = nonce;
          console.log('Monkey: Detected CSP nonce:', nonce.substring(0, 8) + '...');
          return nonce;
        }
      }

      // Also check meta tag for CSP with nonce
      const cspMeta = document.querySelector('meta[http-equiv="content-security-policy" i]');
      if (cspMeta) {
        const content = cspMeta.getAttribute('content') || '';
        const nonceMatch = content.match(/nonce-([A-Za-z0-9+/=]+)/);
        if (nonceMatch) {
          detectedNonce = nonceMatch[1];
          console.log('Monkey: Detected nonce from CSP meta:', detectedNonce.substring(0, 8) + '...');
          return detectedNonce;
        }
      }
    } catch (e) {
      console.log('Monkey: Nonce detection failed:', e.message);
    }

    detectedNonce = false;
    return false;
  }

  /**
   * Check if script tag injection is available
   * Uses CSP detection to avoid triggering console errors
   */
  function isScriptInjectionAvailable() {
    if (methodAvailability.scriptInjection !== null) {
      return methodAvailability.scriptInjection;
    }

    // Check known strict CSP sites first (fastest check, works across all browsers)
    const hostname = window.location.hostname;
    const strictCspSites = ['youtube.com', 'www.youtube.com', 'music.youtube.com', 'google.com', 'www.google.com'];
    if (strictCspSites.some(site => hostname === site || hostname.endsWith('.' + site))) {
      methodAvailability.scriptInjection = false;
      console.log('Monkey: Script injection blocked (strict CSP site)');
      return false;
    }

    // Check for CSP meta tag that would block inline scripts
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
      const cspContent = cspMeta.getAttribute('content') || '';
      // If CSP has script-src without 'unsafe-inline', inline scripts are blocked
      if (cspContent.includes('script-src') && !cspContent.includes("'unsafe-inline'")) {
        methodAvailability.scriptInjection = false;
        console.log('Monkey: Script injection blocked (CSP meta detected)');
        return false;
      }
    }

    // Check if Trusted Types are required (indicates strict CSP)
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
      methodAvailability.scriptInjection = false;
      console.log('Monkey: Script injection blocked (Trusted Types detected)');
      return false;
    }

    // If no CSP indicators found, assume script injection is available
    // We avoid the actual test to prevent CSP console errors
    methodAvailability.scriptInjection = true;
    console.log('Monkey: Script injection assumed available');
    return true;
  }

  /**
   * Check if Blob URL injection is available
   */
  function isBlobUrlAvailable() {
    if (methodAvailability.blobUrl !== null) {
      return methodAvailability.blobUrl;
    }

    try {
      // Test if we can create and use blob URLs
      const testCode = 'window.__monkeyBlobTest = true;';
      const blob = new Blob([testCode], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      const script = document.createElement('script');
      script.src = url;

      // Create a promise to check if it worked
      return new Promise((resolve) => {
        script.onload = () => {
          URL.revokeObjectURL(url);
          script.remove();
          if (window.__monkeyBlobTest) {
            delete window.__monkeyBlobTest;
            methodAvailability.blobUrl = true;
            console.log('Monkey: Blob URL injection available');
            resolve(true);
          } else {
            methodAvailability.blobUrl = false;
            resolve(false);
          }
        };
        script.onerror = () => {
          URL.revokeObjectURL(url);
          script.remove();
          methodAvailability.blobUrl = false;
          console.log('Monkey: Blob URL injection blocked');
          resolve(false);
        };
        document.documentElement.appendChild(script);

        // Timeout fallback
        setTimeout(() => {
          if (methodAvailability.blobUrl === null) {
            methodAvailability.blobUrl = false;
            resolve(false);
          }
        }, 1000);
      });
    } catch (e) {
      methodAvailability.blobUrl = false;
      return Promise.resolve(false);
    }
  }

  /**
   * Check if Trusted Types is enforced and available
   */
  function isTrustedTypesAvailable() {
    if (methodAvailability.trustedTypes !== null) {
      return methodAvailability.trustedTypes;
    }

    try {
      if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
        methodAvailability.trustedTypes = true;
        console.log('Monkey: Trusted Types API available');
        return true;
      }
    } catch (e) {
      // Not available
    }

    methodAvailability.trustedTypes = false;
    return false;
  }

  /**
   * Check if eval/Function is available
   * Uses CSP detection to avoid triggering console errors
   */
  function isEvalAvailable() {
    if (methodAvailability.eval !== null) {
      return methodAvailability.eval;
    }

    // Check known strict CSP sites first (fastest check, works across all browsers)
    const hostname = window.location.hostname;
    const strictCspSites = ['youtube.com', 'www.youtube.com', 'music.youtube.com', 'google.com', 'www.google.com'];
    if (strictCspSites.some(site => hostname === site || hostname.endsWith('.' + site))) {
      methodAvailability.eval = false;
      console.log('Monkey: eval blocked (strict CSP site)');
      return false;
    }

    // Check for CSP meta tag that would block eval
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
      const cspContent = cspMeta.getAttribute('content') || '';
      // If CSP has script-src without 'unsafe-eval', eval is blocked
      if (cspContent.includes('script-src') && !cspContent.includes("'unsafe-eval'")) {
        methodAvailability.eval = false;
        console.log('Monkey: eval blocked (CSP meta detected)');
        return false;
      }
    }

    // Assume eval is available if no CSP indicators found
    methodAvailability.eval = true;
    console.log('Monkey: eval assumed available');
    return true;
  }

  /**
   * Execute via script tag injection (Method 1)
   * Runs in MAIN world with full access to page JavaScript
   */
  function executeViaScriptTag(code, options = {}) {
    try {
      const script = document.createElement('script');

      // Apply nonce if detected or provided
      const nonce = options.nonce || detectNonce();
      if (nonce) {
        script.setAttribute('nonce', nonce);
      }

      // Wrap in try-catch for error handling
      script.textContent = `
        try {
          ${code}
        } catch (e) {
          console.error('Monkey: Script execution error:', e);
        }
      `;

      document.documentElement.appendChild(script);
      script.remove();

      return { success: true, method: 'scriptTag' };
    } catch (e) {
      return { success: false, method: 'scriptTag', error: e.message };
    }
  }

  /**
   * Execute via Blob URL (Method 2)
   * Creates external script source, bypasses inline CSP restrictions
   */
  async function executeViaBlobUrl(code, options = {}) {
    try {
      const wrappedCode = `
        try {
          ${code}
        } catch (e) {
          console.error('Monkey: Blob script error:', e);
        }
      `;

      const blob = new Blob([wrappedCode], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = url;

        // Apply nonce if available
        const nonce = options.nonce || detectNonce();
        if (nonce) {
          script.setAttribute('nonce', nonce);
        }

        script.onload = () => {
          URL.revokeObjectURL(url);
          script.remove();
          resolve({ success: true, method: 'blobUrl' });
        };

        script.onerror = (e) => {
          URL.revokeObjectURL(url);
          script.remove();
          resolve({ success: false, method: 'blobUrl', error: 'Blob URL blocked by CSP' });
        };

        document.documentElement.appendChild(script);

        // Timeout fallback
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (script.parentNode) {
            script.remove();
            resolve({ success: false, method: 'blobUrl', error: 'Timeout' });
          }
        }, 5000);
      });
    } catch (e) {
      return { success: false, method: 'blobUrl', error: e.message };
    }
  }

  /**
   * Execute via Trusted Types policy (Method 3)
   * Creates a policy that allows script content
   */
  function executeViaTrustedTypes(code, options = {}) {
    try {
      if (!window.trustedTypes || !window.trustedTypes.createPolicy) {
        return { success: false, method: 'trustedTypes', error: 'Trusted Types not available' };
      }

      // Create a unique policy name to avoid conflicts
      const policyName = options.policyName || 'monkeyScript' + Date.now();

      const policy = window.trustedTypes.createPolicy(policyName, {
        createScript: (s) => s,
        createScriptURL: (s) => s
      });

      const trustedCode = policy.createScript(`
        try {
          ${code}
        } catch (e) {
          console.error('Monkey: Trusted Types script error:', e);
        }
      `);

      // Try eval with trusted script
      eval(trustedCode);

      return { success: true, method: 'trustedTypes' };
    } catch (e) {
      // Try script tag with Trusted Types
      try {
        const policyName = 'monkeyScriptTag' + Date.now();
        const policy = window.trustedTypes.createPolicy(policyName, {
          createScript: (s) => s
        });

        const script = document.createElement('script');
        script.text = policy.createScript(`
          try {
            ${code}
          } catch (e) {
            console.error('Monkey: Trusted script tag error:', e);
          }
        `);

        document.documentElement.appendChild(script);
        script.remove();

        return { success: true, method: 'trustedTypesScriptTag' };
      } catch (e2) {
        return { success: false, method: 'trustedTypes', error: e2.message };
      }
    }
  }

  /**
   * Execute via eval/Function (Method 4)
   * Runs in isolated world with DOM access but no page JS access
   */
  function executeViaEval(code, options = {}) {
    try {
      // Try IIFE style first
      if (code.trim().startsWith('(') || code.trim().startsWith('!') || code.trim().startsWith('void')) {
        eval(code);
      } else {
        const fn = new Function(code);
        fn();
      }
      return { success: true, method: 'eval' };
    } catch (e) {
      return { success: false, method: 'eval', error: e.message };
    }
  }

  /**
   * Execute via Shadow DOM (Method 5)
   * Creates isolated container for script execution
   */
  function executeViaShadowDom(code, options = {}) {
    try {
      const container = document.createElement('div');
      container.style.display = 'none';

      // Create closed shadow root for isolation
      const shadow = container.attachShadow({ mode: 'closed' });

      const script = document.createElement('script');
      script.textContent = `
        try {
          ${code}
        } catch (e) {
          console.error('Monkey: Shadow DOM script error:', e);
        }
      `;

      // Apply nonce if available
      const nonce = options.nonce || detectNonce();
      if (nonce) {
        script.setAttribute('nonce', nonce);
      }

      document.documentElement.appendChild(container);
      shadow.appendChild(script);

      // Clean up
      setTimeout(() => container.remove(), 100);

      return { success: true, method: 'shadowDom' };
    } catch (e) {
      return { success: false, method: 'shadowDom', error: e.message };
    }
  }

  /**
   * Execute via sandboxed iframe (Method 6)
   * Creates iframe with minimal permissions for script execution
   */
  async function executeViaIframe(code, options = {}) {
    try {
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.src = 'about:blank';

        iframe.onload = () => {
          try {
            const iframeWindow = iframe.contentWindow;

            // Copy necessary references from parent
            if (options.shareWindow !== false) {
              iframeWindow.__parentWindow = window;
              iframeWindow.__parentDocument = document;
            }

            // Execute the code in iframe context
            const script = iframeWindow.document.createElement('script');
            script.textContent = `
              try {
                // Provide access to parent window
                const parentWindow = window.__parentWindow || window.parent;
                const parentDocument = window.__parentDocument || window.parent.document;

                // Execute the user code
                ${code}
              } catch (e) {
                console.error('Monkey: Iframe script error:', e);
              }
            `;

            iframeWindow.document.body.appendChild(script);

            // Clean up after a delay
            setTimeout(() => {
              iframe.remove();
              resolve({ success: true, method: 'iframe' });
            }, 100);
          } catch (e) {
            iframe.remove();
            resolve({ success: false, method: 'iframe', error: e.message });
          }
        };

        iframe.onerror = () => {
          iframe.remove();
          resolve({ success: false, method: 'iframe', error: 'Iframe creation failed' });
        };

        document.documentElement.appendChild(iframe);

        // Timeout fallback
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.remove();
            resolve({ success: false, method: 'iframe', error: 'Timeout' });
          }
        }, 5000);
      });
    } catch (e) {
      return { success: false, method: 'iframe', error: e.message };
    }
  }

  /**
   * Execute via background script (Method 7)
   * Uses chrome.scripting.executeScript with MAIN world
   * Falls back to userScripts API if available
   */
  async function executeViaBackground(code, title = 'Untitled') {
    if (!isExtensionContextValid()) {
      return { success: false, method: 'background', error: 'Extension context invalid' };
    }

    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'executeBookmarklet',
          code: code,
          title: title
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              method: 'background',
              error: chrome.runtime.lastError.message
            });
            return;
          }

          if (response && response.success) {
            resolve({ success: true, method: 'background' });
          } else {
            resolve({
              success: false,
              method: 'background',
              error: response?.error || 'Unknown error'
            });
          }
        });
      });
    } catch (e) {
      return { success: false, method: 'background', error: e.message };
    }
  }

  /**
   * Execute multiple scripts via background (batch execution)
   */
  async function executeMultipleViaBackground(scripts) {
    if (!isExtensionContextValid()) {
      return {
        success: false,
        method: 'background',
        results: { total: scripts.length, executed: 0, failed: scripts.length, errors: ['Extension context invalid'] }
      };
    }

    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'executeMultipleBookmarklets',
          bookmarklets: scripts
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              method: 'background',
              results: {
                total: scripts.length,
                executed: 0,
                failed: scripts.length,
                errors: [chrome.runtime.lastError.message]
              }
            });
            return;
          }

          if (response && response.results) {
            resolve({
              success: response.results.executed > 0,
              method: 'background',
              results: response.results
            });
          } else {
            resolve({
              success: false,
              method: 'background',
              results: {
                total: scripts.length,
                executed: 0,
                failed: scripts.length,
                errors: [response?.error || 'Unknown error']
              }
            });
          }
        });
      });
    } catch (e) {
      return {
        success: false,
        method: 'background',
        results: { total: scripts.length, executed: 0, failed: scripts.length, errors: [e.message] }
      };
    }
  }

  /**
   * Execute code using all available methods (auto-fallback)
   * Tries each method in order until one succeeds
   *
   * @param {string} code - JavaScript code to execute
   * @param {object} options - Execution options
   * @param {string} options.title - Script title for logging
   * @param {string} options.nonce - CSP nonce to use
   * @param {string} options.preferredMethod - Try this method first
   * @param {array} options.skipMethods - Methods to skip
   * @returns {Promise<{success: boolean, method: string, error?: string}>}
   */
  async function execute(code, options = {}) {
    const title = options.title || 'Script';
    const skipMethods = options.skipMethods || [];

    console.log(`Monkey: Executing "${title}"`);

    // Check which methods are available to avoid triggering CSP errors
    const scriptInjectionAvailable = isScriptInjectionAvailable();
    const evalAvailable = isEvalAvailable();

    // On strict CSP sites, most client-side methods are blocked:
    // - blobUrl: blob: URLs not in script-src
    // - trustedTypes: uses eval internally
    // - iframe: inherits CSP from parent with allow-same-origin
    const blobUrlAvailable = scriptInjectionAvailable;
    const trustedTypesAvailable = isTrustedTypesAvailable() && evalAvailable;
    const iframeAvailable = scriptInjectionAvailable; // iframe with allow-same-origin inherits parent CSP

    // Define execution order
    let methods = [
      { name: 'scriptTag', fn: () => executeViaScriptTag(code, options), async: false, available: scriptInjectionAvailable },
      { name: 'blobUrl', fn: () => executeViaBlobUrl(code, options), async: true, available: blobUrlAvailable },
      { name: 'trustedTypes', fn: () => executeViaTrustedTypes(code, options), async: false, available: trustedTypesAvailable },
      { name: 'eval', fn: () => executeViaEval(code, options), async: false, available: evalAvailable },
      { name: 'shadowDom', fn: () => executeViaShadowDom(code, options), async: false, available: scriptInjectionAvailable },
      { name: 'iframe', fn: () => executeViaIframe(code, options), async: true, available: iframeAvailable },
      { name: 'background', fn: () => executeViaBackground(code, title), async: true, available: isExtensionContextValid() }
    ];

    // Filter out unavailable methods to prevent CSP errors
    methods = methods.filter(m => m.available !== false);

    // Move preferred method to front
    if (options.preferredMethod) {
      const idx = methods.findIndex(m => m.name === options.preferredMethod);
      if (idx > 0) {
        const preferred = methods.splice(idx, 1)[0];
        methods.unshift(preferred);
      }
    }

    // Filter out skipped methods
    methods = methods.filter(m => !skipMethods.includes(m.name));

    // Try each method
    for (const method of methods) {
      console.log(`Monkey: Trying ${method.name}...`);

      try {
        const result = method.async ? await method.fn() : method.fn();

        if (result.success) {
          console.log(`Monkey: "${title}" executed successfully via ${result.method}`);
          return result;
        } else {
          console.log(`Monkey: ${method.name} failed:`, result.error);
        }
      } catch (e) {
        console.log(`Monkey: ${method.name} threw error:`, e.message);
      }
    }

    console.log(`Monkey: All execution methods failed for "${title}"`);
    return { success: false, method: 'none', error: 'All execution methods failed' };
  }

  /**
   * Execute multiple scripts sequentially with auto-fallback
   *
   * @param {array} scripts - Array of {code, title} objects
   * @param {object} options - Execution options
   * @returns {Promise<{total, executed, failed, errors, results}>}
   */
  async function executeMultiple(scripts, options = {}) {
    const results = {
      total: scripts.length,
      executed: 0,
      failed: 0,
      errors: [],
      results: []
    };

    // Check if local execution is possible
    const canExecuteLocally = isScriptInjectionAvailable() || isEvalAvailable();

    if (!canExecuteLocally && isExtensionContextValid()) {
      // Use batch background execution for efficiency
      console.log('Monkey: Local execution blocked, using background batch execution');
      const bgResult = await executeMultipleViaBackground(scripts);
      return bgResult.results || results;
    }

    // Execute each script
    for (const script of scripts) {
      const result = await execute(script.code, {
        ...options,
        title: script.title
      });

      results.results.push(result);

      if (result.success) {
        results.executed++;
      } else {
        results.failed++;
        results.errors.push(`${script.title}: ${result.error}`);
      }
    }

    console.log(`Monkey: Batch execution complete. Executed: ${results.executed}/${results.total}`);
    return results;
  }

  /**
   * Get current method availability status
   */
  function getMethodStatus() {
    return {
      scriptInjection: isScriptInjectionAvailable(),
      eval: isEvalAvailable(),
      trustedTypes: isTrustedTypesAvailable(),
      nonce: detectNonce() !== false,
      extensionContext: isExtensionContextValid()
    };
  }

  /**
   * Reset cached method availability (useful after page changes)
   */
  function resetCache() {
    Object.keys(methodAvailability).forEach(key => {
      methodAvailability[key] = null;
    });
    detectedNonce = null;
    console.log('Monkey: Cache reset');
  }

  // Initialize and expose the engine
  window.MonkeyEngine = {
    // Main execution methods
    execute,
    executeMultiple,

    // Individual methods (for direct use if needed)
    executeViaScriptTag,
    executeViaBlobUrl,
    executeViaTrustedTypes,
    executeViaEval,
    executeViaShadowDom,
    executeViaIframe,
    executeViaBackground,
    executeMultipleViaBackground,

    // Detection utilities
    detectNonce,
    isScriptInjectionAvailable,
    isBlobUrlAvailable,
    isTrustedTypesAvailable,
    isEvalAvailable,
    isExtensionContextValid,

    // Status and cache
    getMethodStatus,
    resetCache
  };

  // Log initialization
  const status = getMethodStatus();
  console.log('Monkey: Engine initialized', status);

})();
