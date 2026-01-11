/**
 * Monkey.js - Script Injection Engine
 *
 * Provides multiple methods to execute JavaScript code in web pages,
 * bypassing Content Security Policy (CSP) and Trusted Types restrictions.
 *
 * Inspired by Tampermonkey, Violentmonkey, and ScriptCat techniques.
 *
 * EXECUTION METHODS (in order of preference):
 * 1. Script tag injection (MAIN world, full page access)
 * 2. Blob URL injection (bypasses inline CSP)
 * 3. Trusted Types policy (for sites enforcing Trusted Types)
 * 4. Compiled Function with context (ScriptCat-style, supports async/context)
 * 5. eval/Function (isolated world)
 * 6. Shadow DOM injection (isolated container)
 * 7. Shadow DOM + iframe isolation (Tampermonkey-style, maximum isolation)
 * 8. Sandboxed iframe (fallback for strict CSP)
 * 9. Background execution via chrome.scripting.executeScript
 *
 * SCRIPTCAT-STYLE FEATURES:
 * - Context injection via `with()` statement
 * - Top-level await support via async IIFE wrapper
 * - SourceURL for debugging in DevTools
 * - Custom API injection (GM-style APIs)
 * - Timer isolation for script cleanup
 * - Property listener for script detection
 * - Performance API messaging (CSP bypass)
 * - Event handler interception
 *
 * TAMPERMONKEY-STYLE FEATURES:
 * - Vault pattern - preserved native APIs before page can override
 * - Shadow DOM + iframe isolation for robust execution
 * - ACK-based reliable messaging
 * - Nonce detection and reuse
 */

(function() {
  'use strict';

  // Prevent multiple instances
  if (window.MonkeyEngine) {
    return;
  }

  // ============================================================================
  // VAULT PATTERN - PRESERVE NATIVE APIS (Tampermonkey-style)
  // ============================================================================
  // Capture native functions BEFORE page scripts can override them.
  // This protects against prototype pollution and function hijacking.

  const vault = Object.freeze({
    // Core constructors
    Function: Function,
    Object: Object,
    Array: Array,
    Promise: Promise,
    Error: Error,
    Proxy: Proxy,

    // Evaluation
    eval: eval,

    // Timers (bound to window)
    setTimeout: setTimeout.bind(window),
    clearTimeout: clearTimeout.bind(window),
    setInterval: setInterval.bind(window),
    clearInterval: clearInterval.bind(window),

    // Events
    CustomEvent: CustomEvent,
    MouseEvent: MouseEvent,
    Event: Event,

    // DOM creation (bound)
    createElement: Document.prototype.createElement.bind(document),
    createElementNS: Document.prototype.createElementNS.bind(document),

    // DOM manipulation (unbound - need to call with .call())
    appendChild: Node.prototype.appendChild,
    removeChild: Node.prototype.removeChild,
    remove: Element.prototype.remove,
    setAttribute: Element.prototype.setAttribute,
    removeAttribute: Element.prototype.removeAttribute,
    attachShadow: Element.prototype.attachShadow,

    // Events (unbound)
    addEventListener: EventTarget.prototype.addEventListener,
    removeEventListener: EventTarget.prototype.removeEventListener,
    dispatchEvent: EventTarget.prototype.dispatchEvent,

    // URL
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),

    // Blob
    Blob: Blob,

    // Selectors (unbound)
    querySelector: Document.prototype.querySelector,
    querySelectorAll: Document.prototype.querySelectorAll,
    getElementById: Document.prototype.getElementById,

    // Performance API (for CSP bypass communication)
    perfAddEventListener: performance.addEventListener.bind(performance),
    perfRemoveEventListener: performance.removeEventListener.bind(performance),
    perfDispatchEvent: performance.dispatchEvent.bind(performance),

    // JSON
    JSONparse: JSON.parse,
    JSONstringify: JSON.stringify,

    // Encoding
    btoa: btoa.bind(window),
    atob: atob.bind(window),
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent
  });

  // ============================================================================
  // TIMER ISOLATION (ScriptCat-style)
  // ============================================================================
  // Track timers per-script for proper cleanup when scripts are stopped.

  /**
   * Create an isolated timer manager for a script
   * Tracks all setTimeout/setInterval calls for cleanup
   *
   * @returns {object} Timer manager with setTimeout, setInterval, clear*, and cleanup
   */
  function createTimerIsolation() {
    const timeouts = new Set();
    const intervals = new Set();

    return {
      setTimeout: (fn, ms, ...args) => {
        const id = vault.setTimeout(() => {
          timeouts.delete(id);
          if (typeof fn === 'function') fn(...args);
        }, ms);
        timeouts.add(id);
        return id;
      },

      setInterval: (fn, ms, ...args) => {
        const id = vault.setInterval(() => {
          if (typeof fn === 'function') fn(...args);
        }, ms);
        intervals.add(id);
        return id;
      },

      clearTimeout: (id) => {
        timeouts.delete(id);
        vault.clearTimeout(id);
      },

      clearInterval: (id) => {
        intervals.delete(id);
        vault.clearInterval(id);
      },

      // Cleanup all timers (call when script stops)
      cleanup: () => {
        timeouts.forEach(id => vault.clearTimeout(id));
        intervals.forEach(id => vault.clearInterval(id));
        timeouts.clear();
        intervals.clear();
      },

      // Get active timer counts
      getStats: () => ({
        timeouts: timeouts.size,
        intervals: intervals.size
      })
    };
  }

  // ============================================================================
  // PROPERTY LISTENER (ScriptCat-style)
  // ============================================================================
  // Detect when a property is set on an object (useful for script mounting)

  /**
   * Listen for a property to be set on an object
   * Self-destructs after the property is set
   *
   * @param {object} obj - Object to watch
   * @param {string} prop - Property name to watch
   * @param {function} callback - Called when property is set
   */
  function definePropertyListener(obj, prop, callback) {
    // If property already exists, call immediately
    if (obj[prop] !== undefined) {
      const val = obj[prop];
      delete obj[prop];
      callback(val);
      return;
    }

    // Define a setter that calls callback and self-destructs
    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: false,
      set: (val) => {
        delete obj[prop]; // Remove the property descriptor
        obj[prop] = val;  // Set actual value
        callback(val);
      },
      get: () => undefined
    });
  }

  // ============================================================================
  // PERFORMANCE API COMMUNICATION (ScriptCat-style CSP Bypass)
  // ============================================================================
  // Uses performance object for events instead of document (bypasses some CSP)

  const perfMessaging = {
    _listeners: new Map(),
    _messageId: 0,

    /**
     * Send a message via performance API
     * @param {string} channel - Channel name
     * @param {any} data - Data to send
     */
    send: (channel, data) => {
      const event = new vault.CustomEvent(`monkey_${channel}`, {
        detail: data,
        bubbles: false,
        cancelable: true
      });
      vault.perfDispatchEvent(event);
    },

    /**
     * Listen for messages on a channel
     * @param {string} channel - Channel name
     * @param {function} handler - Message handler
     * @returns {function} Unsubscribe function
     */
    listen: (channel, handler) => {
      const eventName = `monkey_${channel}`;
      const wrappedHandler = (e) => handler(e.detail);

      vault.perfAddEventListener(eventName, wrappedHandler, true);

      // Track for cleanup
      if (!perfMessaging._listeners.has(channel)) {
        perfMessaging._listeners.set(channel, []);
      }
      perfMessaging._listeners.get(channel).push(wrappedHandler);

      // Return unsubscribe function
      return () => {
        vault.perfRemoveEventListener(eventName, wrappedHandler, true);
        const handlers = perfMessaging._listeners.get(channel);
        if (handlers) {
          const idx = handlers.indexOf(wrappedHandler);
          if (idx > -1) handlers.splice(idx, 1);
        }
      };
    },

    /**
     * Send a message and wait for response
     * @param {string} channel - Channel name
     * @param {any} data - Data to send
     * @param {number} timeout - Timeout in ms
     * @returns {Promise} Response promise
     */
    request: (channel, data, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const msgId = ++perfMessaging._messageId;
        const responseChannel = `${channel}_response_${msgId}`;

        const timer = vault.setTimeout(() => {
          unsubscribe();
          reject(new Error('Performance messaging timeout'));
        }, timeout);

        const unsubscribe = perfMessaging.listen(responseChannel, (response) => {
          vault.clearTimeout(timer);
          unsubscribe();
          resolve(response);
        });

        perfMessaging.send(channel, { ...data, _msgId: msgId, _responseChannel: responseChannel });
      });
    },

    /**
     * Cleanup all listeners
     */
    cleanup: () => {
      perfMessaging._listeners.forEach((handlers, channel) => {
        const eventName = `monkey_${channel}`;
        handlers.forEach(handler => {
          vault.perfRemoveEventListener(eventName, handler, true);
        });
      });
      perfMessaging._listeners.clear();
    }
  };

  // ============================================================================
  // ACK-BASED RELIABLE MESSAGING (Tampermonkey-style)
  // ============================================================================
  // Guaranteed message delivery with acknowledgments

  /**
   * Create a reliable messaging channel with ACK support
   * @returns {object} Messaging interface
   */
  function createReliableMessaging() {
    const pending = new Map();
    let msgId = 0;

    return {
      /**
       * Send a message and wait for ACK
       * @param {string} type - Message type
       * @param {any} data - Message data
       * @param {number} timeout - Timeout in ms
       * @returns {Promise} Response promise
       */
      send: (type, data, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          if (!isExtensionContextValid()) {
            reject(new Error('Extension context invalid'));
            return;
          }

          const id = ++msgId;
          const timer = vault.setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Message timeout: ${type}`));
          }, timeout);

          pending.set(id, { resolve, reject, timer, type });

          try {
            chrome.runtime.sendMessage({
              type,
              data,
              _ackId: id
            }, (response) => {
              if (chrome.runtime.lastError) {
                vault.clearTimeout(timer);
                pending.delete(id);
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }

              vault.clearTimeout(timer);
              pending.delete(id);
              resolve(response);
            });
          } catch (e) {
            vault.clearTimeout(timer);
            pending.delete(id);
            reject(e);
          }
        });
      },

      /**
       * Handle an ACK response (call from message listener)
       * @param {number} ackId - ACK ID
       * @param {any} response - Response data
       * @returns {boolean} Whether ACK was handled
       */
      handleAck: (ackId, response) => {
        const p = pending.get(ackId);
        if (p) {
          vault.clearTimeout(p.timer);
          pending.delete(ackId);
          p.resolve(response);
          return true;
        }
        return false;
      },

      /**
       * Get pending message count
       */
      getPendingCount: () => pending.size,

      /**
       * Cancel all pending messages
       */
      cancelAll: () => {
        pending.forEach(({ timer, reject, type }) => {
          vault.clearTimeout(timer);
          reject(new Error(`Message cancelled: ${type}`));
        });
        pending.clear();
      }
    };
  }

  // ============================================================================
  // EVENT HANDLER INTERCEPTION (ScriptCat-style)
  // ============================================================================
  // Intercept on* event handlers to work properly in sandbox context

  /**
   * Create event property descriptors for sandbox context
   * Allows scripts to use window.onload = fn style handlers
   *
   * @param {object} context - Sandbox context
   * @param {array} eventNames - Event names to intercept (e.g., ['load', 'click'])
   * @returns {object} Property descriptors for Object.defineProperties
   */
  function createEventInterceptors(context, eventNames = [
    'load', 'unload', 'beforeunload',
    'error', 'message',
    'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
    'keydown', 'keyup', 'keypress',
    'focus', 'blur',
    'scroll', 'resize',
    'hashchange', 'popstate'
  ]) {
    const descriptors = {};
    const handlers = new Map();

    eventNames.forEach(eventName => {
      const propName = `on${eventName}`;

      descriptors[propName] = {
        enumerable: true,
        configurable: true,
        get: () => handlers.get(eventName) || null,
        set: (fn) => {
          const oldHandler = handlers.get(eventName);

          // Remove old handler if exists
          if (oldHandler && oldHandler._wrapper) {
            vault.removeEventListener.call(window, eventName, oldHandler._wrapper);
          }

          if (typeof fn === 'function') {
            // Create wrapper that calls handler with correct context
            const wrapper = (event) => {
              try {
                fn.call(context, event);
              } catch (e) {
                console.log(`MonkeyEngine: Error in ${propName} handler:`, e);
              }
            };
            fn._wrapper = wrapper;
            handlers.set(eventName, fn);
            vault.addEventListener.call(window, eventName, wrapper);
          } else {
            handlers.delete(eventName);
          }
        }
      };
    });

    // Add cleanup method
    descriptors._cleanupEventHandlers = {
      enumerable: false,
      configurable: true,
      value: () => {
        handlers.forEach((fn, eventName) => {
          if (fn._wrapper) {
            vault.removeEventListener.call(window, eventName, fn._wrapper);
          }
        });
        handlers.clear();
      }
    };

    return descriptors;
  }

  // Track availability of execution methods
  const methodAvailability = {
    scriptInjection: null,
    blobUrl: null,
    trustedTypes: null,
    eval: null,
    shadowDom: null,
    shadowIframe: null,
    iframe: null,
    nonce: null
  };

  // Detected page nonce (if any)
  let detectedNonce = null;

  // ============================================================================
  // SCRIPTCAT-STYLE COMPILATION AND CONTEXT (NEW)
  // ============================================================================

  /**
   * Compile script code into an executable function (ScriptCat-style)
   *
   * This wraps the code with:
   * - with() block for context injection
   * - async IIFE for top-level await support
   * - try-catch with script name for error reporting
   * - sourceURL for debugging in DevTools
   *
   * @param {string} code - JavaScript code to compile
   * @param {string} title - Script title for debugging
   * @param {string} requireCode - Optional pre-loaded dependencies
   * @returns {Function} Compiled function ready for execution
   */
  function compileScript(code, title = 'Script', requireCode = '') {
    const sourceURL = `//# sourceURL=MonkeyEngine/${encodeURIComponent(title)}.user.js`;

    // ScriptCat-style wrapper:
    // - arguments[0] = context object (custom APIs, variables)
    // - arguments[1] = script name for error reporting
    // - this.$ = one-time getter for context (fallback)
    // - with() block allows context variables to be accessed directly
    // - async IIFE enables top-level await
    const wrappedCode = `try {
  with(arguments[0]||this.$||{}){
${requireCode}
    return (async function(){
${code}
    }).call(this);
  }
} catch (e) {
  if (e.message && e.stack) {
    console.log("MonkeyEngine: Script '" + arguments[1] + "' failed! " + e.message);
    console.log(e.stack);
  } else {
    console.log("MonkeyEngine: Script '" + arguments[1] + "' error:", e);
  }
}
${sourceURL}`;

    return new Function(wrappedCode);
  }

  /**
   * Create a sandbox context with custom APIs (ScriptCat-style)
   *
   * This creates an isolated context object that can be passed to compiled scripts.
   * Variables and functions in the context become directly accessible in the script
   * via the with() statement.
   *
   * @param {object} options - Context options
   * @param {object} options.apis - Custom APIs to inject (e.g., GM_setValue, GM_getValue)
   * @param {object} options.variables - Custom variables to inject
   * @param {boolean} options.exposeWindow - Whether to expose unsafeWindow (default: true)
   * @param {boolean} options.exposeDocument - Whether to expose document reference
   * @returns {object} Context object for script execution
   */
  function createContext(options = {}) {
    const context = {};

    // Inject custom APIs
    if (options.apis) {
      Object.assign(context, options.apis);
    }

    // Inject custom variables
    if (options.variables) {
      Object.assign(context, options.variables);
    }

    // Expose window reference (like Tampermonkey's unsafeWindow)
    if (options.exposeWindow !== false) {
      context.unsafeWindow = window;
    }

    // Expose document reference
    if (options.exposeDocument !== false) {
      context.document = document;
    }

    // Add console reference for logging
    context.console = console;

    // One-time getter for context (ScriptCat pattern)
    // This is used as fallback: with(arguments[0]||this.$||{})
    let contextAccessed = false;
    Object.defineProperty(context, '$', {
      enumerable: false,
      configurable: true,
      get() {
        if (!contextAccessed) {
          contextAccessed = true;
          delete this.$;
        }
        return context;
      }
    });

    return context;
  }

  /**
   * Create a basic GM-style API context
   *
   * Provides commonly used Greasemonkey/Tampermonkey-like APIs
   *
   * @param {string} scriptName - Name of the script for GM_info
   * @param {object} storage - Optional storage object for GM_setValue/getValue
   * @returns {object} Context with GM-style APIs
   */
  function createGMContext(scriptName = 'Script', storage = null) {
    // Use provided storage or create in-memory storage
    const scriptStorage = storage || {};

    const gmApis = {
      // Script info
      GM_info: {
        script: {
          name: scriptName,
          version: '1.0',
          description: '',
          author: '',
        },
        scriptHandler: 'MonkeyEngine',
        version: '1.0.0'
      },

      // Storage APIs
      GM_setValue: (key, value) => {
        scriptStorage[key] = value;
        return Promise.resolve();
      },
      GM_getValue: (key, defaultValue) => {
        return key in scriptStorage ? scriptStorage[key] : defaultValue;
      },
      GM_deleteValue: (key) => {
        delete scriptStorage[key];
        return Promise.resolve();
      },
      GM_listValues: () => {
        return Object.keys(scriptStorage);
      },

      // Logging
      GM_log: (...args) => {
        console.log(`[${scriptName}]`, ...args);
      },

      // Clipboard
      GM_setClipboard: (text, type = 'text/plain') => {
        return navigator.clipboard.writeText(text);
      },

      // Notification (basic)
      GM_notification: (details, ondone) => {
        if (typeof details === 'string') {
          details = { text: details };
        }
        alert(details.text || details.title || 'Notification');
        if (ondone) ondone();
      },

      // Open in new tab
      GM_openInTab: (url, options = {}) => {
        const target = options.active === false ? '_blank' : '_blank';
        return window.open(url, target);
      },

      // Add style
      GM_addStyle: (css) => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
      },

      // Get resource URL (placeholder)
      GM_getResourceURL: (resourceName) => {
        console.warn('GM_getResourceURL not fully implemented');
        return '';
      },

      // XMLHttpRequest wrapper (basic - same origin only without background)
      GM_xmlhttpRequest: (details) => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(details.method || 'GET', details.url);

          if (details.headers) {
            Object.entries(details.headers).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value);
            });
          }

          xhr.onload = () => {
            const response = {
              responseText: xhr.responseText,
              response: xhr.response,
              status: xhr.status,
              statusText: xhr.statusText,
              responseHeaders: xhr.getAllResponseHeaders(),
              finalUrl: xhr.responseURL
            };
            if (details.onload) details.onload(response);
            resolve(response);
          };

          xhr.onerror = (e) => {
            if (details.onerror) details.onerror(e);
            reject(e);
          };

          xhr.send(details.data);
        });
      }
    };

    // Also add GM. namespace versions
    gmApis.GM = {
      info: gmApis.GM_info,
      setValue: (k, v) => gmApis.GM_setValue(k, v),
      getValue: (k, d) => Promise.resolve(gmApis.GM_getValue(k, d)),
      deleteValue: (k) => gmApis.GM_deleteValue(k),
      listValues: () => Promise.resolve(gmApis.GM_listValues()),
      log: gmApis.GM_log,
      setClipboard: gmApis.GM_setClipboard,
      notification: gmApis.GM_notification,
      openInTab: gmApis.GM_openInTab,
      addStyle: gmApis.GM_addStyle,
      getResourceUrl: gmApis.GM_getResourceURL,
      xmlHttpRequest: gmApis.GM_xmlhttpRequest
    };

    return createContext({ apis: gmApis });
  }

  /**
   * Execute script with context (ScriptCat-style)
   *
   * This is the main ScriptCat-style execution method that:
   * - Compiles the script with proper wrapping
   * - Creates or uses provided context
   * - Executes with context injection
   * - Supports top-level await
   *
   * @param {string} code - JavaScript code to execute
   * @param {object} options - Execution options
   * @param {string} options.title - Script title for debugging
   * @param {object} options.context - Custom context object (or one will be created)
   * @param {object} options.apis - Custom APIs to inject into context
   * @param {object} options.variables - Custom variables to inject into context
   * @param {boolean} options.useGMContext - Create a GM-style context (default: false)
   * @returns {Promise<{success: boolean, method: string, result?: any, error?: string}>}
   */
  async function executeWithContext(code, options = {}) {
    const title = options.title || 'Script';

    try {
      // Create or use provided context
      let context;
      if (options.context) {
        context = options.context;
      } else if (options.useGMContext) {
        context = createGMContext(title);
      } else {
        context = createContext({
          apis: options.apis,
          variables: options.variables
        });
      }

      // Compile the script
      const compiledFn = compileScript(code, title, options.requireCode || '');

      // Execute with context
      // The function is called with: fn.call(context, context, title)
      // - this = context (for this.$ fallback)
      // - arguments[0] = context (for with statement)
      // - arguments[1] = title (for error reporting)
      const result = await compiledFn.call(context, context, title);

      return {
        success: true,
        method: 'compiledContext',
        result: result
      };
    } catch (e) {
      return {
        success: false,
        method: 'compiledContext',
        error: e.message
      };
    }
  }

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

    // If Trusted Types is present, assume eval is also blocked
    // (sites with TT typically have strict CSP that blocks eval)
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
      methodAvailability.eval = false;
      console.log('Monkey: eval blocked (Trusted Types detected)');
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
          console.log('Monkey: Script execution error:', e);
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
          console.log('Monkey: Blob script error:', e);
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
          console.log('Monkey: Trusted Types script error:', e);
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
            console.log('Monkey: Trusted script tag error:', e);
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
   * Execute via eval/Function (Method 4) - Now uses ScriptCat-style compilation
   * Runs in isolated world with DOM access but no page JS access
   * Supports top-level await and context injection
   */
  function executeViaEval(code, options = {}) {
    try {
      const title = options.title || 'Script';

      // Use ScriptCat-style compilation for better features
      // This adds: async support, context injection, sourceURL, better error handling
      const compiledFn = compileScript(code, title);

      // Create a minimal context with essential globals
      const context = options.context || createContext({
        apis: options.apis,
        variables: options.variables
      });

      // Execute with context
      // Returns a promise due to async wrapper, but we handle sync execution too
      const result = compiledFn.call(context, context, title);

      // If it's a promise, we can't wait for it in sync mode
      // The caller should use executeWithContext for async scripts
      if (result instanceof Promise) {
        result.catch(e => {
          console.log(`MonkeyEngine: Async error in "${title}":`, e);
        });
      }

      return { success: true, method: 'eval' };
    } catch (e) {
      return { success: false, method: 'eval', error: e.message };
    }
  }

  /**
   * Execute via eval/Function (Legacy mode - simple execution without ScriptCat features)
   * Use this if you need the old behavior without async wrapper
   */
  function executeViaEvalSimple(code, options = {}) {
    try {
      // Try IIFE style first
      if (code.trim().startsWith('(') || code.trim().startsWith('!') || code.trim().startsWith('void')) {
        eval(code);
      } else {
        const fn = new Function(code);
        fn();
      }
      return { success: true, method: 'evalSimple' };
    } catch (e) {
      return { success: false, method: 'evalSimple', error: e.message };
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
          console.log('Monkey: Shadow DOM script error:', e);
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
                console.log('Monkey: Iframe script error:', e);
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
   * Execute via Shadow DOM + iframe isolation (Tampermonkey-style)
   * Creates a closed shadow DOM with hidden iframe for maximum isolation
   * This is more robust than regular shadow DOM or iframe alone
   */
  async function executeViaShadowIframe(code, options = {}) {
    try {
      return new Promise((resolve) => {
        const title = options.title || 'Script';

        // Create container element
        const container = vault.createElement('div');

        // Create closed shadow root (completely isolated from page)
        const shadow = vault.attachShadow.call(container, { mode: 'closed' });

        // Add hidden style
        const style = vault.createElement('style');
        style.textContent = ':host { display: none !important; }';
        vault.appendChild.call(shadow, style);

        // Create sandboxed iframe
        const iframe = vault.createElement('iframe');
        vault.setAttribute.call(iframe, 'sandbox', 'allow-scripts allow-same-origin');
        vault.setAttribute.call(iframe, 'src', 'javascript:void 0'); // No network request
        vault.setAttribute.call(iframe, 'style', 'display:none;width:0;height:0;border:0;');

        let resolved = false;
        let timeoutId = null;

        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            if (timeoutId) {
              vault.clearTimeout(timeoutId);
              timeoutId = null;
            }
            vault.remove.call(container);
          }
        };

        iframe.onload = () => {
          try {
            const iframeDoc = iframe.contentDocument;
            const iframeWin = iframe.contentWindow;

            if (!iframeDoc || !iframeWin) {
              cleanup();
              resolve({ success: false, method: 'shadowIframe', error: 'Cannot access iframe' });
              return;
            }

            // Provide parent references
            iframeWin.__parentWindow = window;
            iframeWin.__parentDocument = document;
            iframeWin.__monkeyVault = vault;

            // Create script element in iframe
            const script = iframeDoc.createElement('script');

            // Apply nonce if available
            const nonce = options.nonce || detectNonce();
            if (nonce) {
              script.setAttribute('nonce', nonce);
            }

            // Escape title for use in string literal
            const safeTitle = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            // Wrap code with error handling and parent access
            script.textContent = `
              try {
                const parentWindow = window.__parentWindow;
                const parentDocument = window.__parentDocument;
                const unsafeWindow = parentWindow;
                const vault = window.__monkeyVault;

                ${code}
              } catch (e) {
                console.log('MonkeyEngine: ShadowIframe script \\'` + safeTitle + `\\' error:', e);
              }
            `;

            // Get body or create one
            const body = iframeDoc.body || iframeDoc.documentElement;
            body.appendChild(script);

            // Nonce removal after execution
            if (nonce) {
              script.removeAttribute('nonce');
            }

            // Clean up after delay
            vault.setTimeout(() => {
              cleanup();
              resolve({ success: true, method: 'shadowIframe' });
            }, 100);

          } catch (e) {
            cleanup();
            resolve({ success: false, method: 'shadowIframe', error: e.message });
          }
        };

        iframe.onerror = () => {
          cleanup();
          resolve({ success: false, method: 'shadowIframe', error: 'Iframe creation failed' });
        };

        // Append iframe to shadow DOM
        vault.appendChild.call(shadow, iframe);

        // Append container to document
        vault.appendChild.call(document.documentElement, container);

        // Timeout fallback
        timeoutId = vault.setTimeout(() => {
          if (!resolved) {
            cleanup();
            resolve({ success: false, method: 'shadowIframe', error: 'Timeout' });
          }
        }, 5000);
      });
    } catch (e) {
      return { success: false, method: 'shadowIframe', error: e.message };
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
    // Note: 'compiledContext' is the new ScriptCat-style method that uses eval internally
    // but provides better features (async support, context injection, sourceURL)
    // 'shadowIframe' combines shadow DOM + iframe for maximum isolation (Tampermonkey-style)
    let methods = [
      { name: 'scriptTag', fn: () => executeViaScriptTag(code, options), async: false, available: scriptInjectionAvailable },
      { name: 'blobUrl', fn: () => executeViaBlobUrl(code, options), async: true, available: blobUrlAvailable },
      { name: 'trustedTypes', fn: () => executeViaTrustedTypes(code, options), async: false, available: trustedTypesAvailable },
      { name: 'compiledContext', fn: () => executeWithContext(code, options), async: true, available: evalAvailable },
      { name: 'eval', fn: () => executeViaEval(code, options), async: false, available: evalAvailable },
      { name: 'shadowDom', fn: () => executeViaShadowDom(code, options), async: false, available: scriptInjectionAvailable },
      { name: 'shadowIframe', fn: () => executeViaShadowIframe(code, options), async: true, available: scriptInjectionAvailable },
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
    const scriptInjection = isScriptInjectionAvailable();
    return {
      scriptInjection: scriptInjection,
      eval: isEvalAvailable(),
      trustedTypes: isTrustedTypesAvailable(),
      shadowIframe: scriptInjection, // Same availability as scriptInjection
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

    // ScriptCat-style execution
    executeWithContext,
    compileScript,
    createContext,
    createGMContext,

    // Individual execution methods (for direct use if needed)
    executeViaScriptTag,
    executeViaBlobUrl,
    executeViaTrustedTypes,
    executeViaEval,
    executeViaEvalSimple,  // Legacy eval without ScriptCat features
    executeViaShadowDom,
    executeViaShadowIframe,  // Shadow DOM + iframe isolation (Tampermonkey-style)
    executeViaIframe,
    executeViaBackground,
    executeMultipleViaBackground,

    // Vault - preserved native APIs (Tampermonkey-style)
    vault,

    // Timer isolation (ScriptCat-style)
    createTimerIsolation,

    // Property listener (ScriptCat-style)
    definePropertyListener,

    // Performance API messaging (ScriptCat-style CSP bypass)
    perfMessaging,

    // Reliable messaging with ACK (Tampermonkey-style)
    createReliableMessaging,

    // Event handler interception (ScriptCat-style)
    createEventInterceptors,

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
  console.log('MonkeyEngine: Initialized with Tampermonkey/ScriptCat-style features', status);

})();
