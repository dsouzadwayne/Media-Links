/**
 * CDP Input Module
 * Chrome Debugging Protocol integration for reliable keyboard/mouse input
 * Requires "debugger" permission in manifest.json
 */

(function(global) {
  'use strict';

  // Configuration
  const CONFIG = {
    PROTOCOL_VERSION: '1.3',
    SESSION_TIMEOUT_MS: 60 * 1000,  // 60 seconds
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 500,
    DEBUGGING_ERROR_RETRY_DELAY_MS: 1000
  };

  // Session pool: Map<tabId, CDPSession>
  const sessions = new Map();

  // ============ Key Mapping ============

  const KEY_MAP = {
    // Navigation
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    Delete: { key: 'Delete', code: 'Delete', keyCode: 46 },

    // Arrow keys
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },

    // Page navigation
    PageUp: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    PageDown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    Home: { key: 'Home', code: 'Home', keyCode: 36 },
    End: { key: 'End', code: 'End', keyCode: 35 },

    // Whitespace
    Space: { key: ' ', code: 'Space', keyCode: 32 },

    // Modifiers (used for combinations)
    Shift: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
    Control: { key: 'Control', code: 'ControlLeft', keyCode: 17 },
    Alt: { key: 'Alt', code: 'AltLeft', keyCode: 18 },
    Meta: { key: 'Meta', code: 'MetaLeft', keyCode: 91 },

    // Function keys
    F1: { key: 'F1', code: 'F1', keyCode: 112 },
    F2: { key: 'F2', code: 'F2', keyCode: 113 },
    F3: { key: 'F3', code: 'F3', keyCode: 114 },
    F4: { key: 'F4', code: 'F4', keyCode: 115 },
    F5: { key: 'F5', code: 'F5', keyCode: 116 },
    F6: { key: 'F6', code: 'F6', keyCode: 117 },
    F7: { key: 'F7', code: 'F7', keyCode: 118 },
    F8: { key: 'F8', code: 'F8', keyCode: 119 },
    F9: { key: 'F9', code: 'F9', keyCode: 120 },
    F10: { key: 'F10', code: 'F10', keyCode: 121 },
    F11: { key: 'F11', code: 'F11', keyCode: 122 },
    F12: { key: 'F12', code: 'F12', keyCode: 123 }
  };

  /**
   * Get key info for a key name
   * @param {string} keyName - Key name (e.g., 'Enter', 'a', 'A', '1')
   * @returns {Object|null} Key info or null if unsupported
   */
  function getKeyInfo(keyName) {
    // Check special keys first
    if (KEY_MAP[keyName]) {
      return KEY_MAP[keyName];
    }

    // Handle single character keys
    if (keyName.length === 1) {
      const char = keyName;
      const lower = char.toLowerCase();
      const upper = char.toUpperCase();

      // Letters a-z
      if (lower >= 'a' && lower <= 'z') {
        const keyCode = upper.charCodeAt(0);
        return { key: char, code: `Key${upper}`, keyCode };
      }

      // Digits 0-9
      if (char >= '0' && char <= '9') {
        const keyCode = char.charCodeAt(0);
        return { key: char, code: `Digit${char}`, keyCode };
      }

      // Common punctuation
      const punctuation = {
        '-': { key: '-', code: 'Minus', keyCode: 189 },
        '=': { key: '=', code: 'Equal', keyCode: 187 },
        '[': { key: '[', code: 'BracketLeft', keyCode: 219 },
        ']': { key: ']', code: 'BracketRight', keyCode: 221 },
        '\\': { key: '\\', code: 'Backslash', keyCode: 220 },
        ';': { key: ';', code: 'Semicolon', keyCode: 186 },
        "'": { key: "'", code: 'Quote', keyCode: 222 },
        ',': { key: ',', code: 'Comma', keyCode: 188 },
        '.': { key: '.', code: 'Period', keyCode: 190 },
        '/': { key: '/', code: 'Slash', keyCode: 191 },
        '`': { key: '`', code: 'Backquote', keyCode: 192 }
      };

      if (punctuation[char]) {
        return punctuation[char];
      }
    }

    return null;
  }

  /**
   * Calculate modifier bitmask from modifier key names
   * @param {string[]} modifierKeys - Array of modifier key names
   * @returns {number} Modifier bitmask
   */
  function calculateModifiers(modifierKeys) {
    let flags = 0;
    for (const key of modifierKeys) {
      const normalized = key.toLowerCase();
      if (normalized === 'alt') flags |= 1;
      else if (normalized === 'control' || normalized === 'ctrl') flags |= 2;
      else if (normalized === 'meta' || normalized === 'cmd' || normalized === 'command') flags |= 4;
      else if (normalized === 'shift') flags |= 8;
    }
    return flags;
  }

  // ============ CDP Session Management ============

  /**
   * Check if an error is a debugging-specific error
   * @param {string} message - Error message
   * @returns {boolean}
   */
  function isDebuggingError(message) {
    const patterns = [
      'Debugger is not attached',
      'Target closed',
      'Inspector protocol error',
      'Detached while handling',
      'Cannot access contents of',
      'Target crashed',
      'Debugger session not found',
      'Connection lost'
    ];
    const lowerMessage = message.toLowerCase();
    return patterns.some(p => lowerMessage.includes(p.toLowerCase()));
  }

  /**
   * Attach debugger to a tab
   * @param {number} tabId
   * @returns {Promise<Object>} Debugger target
   */
  async function attachDebugger(tabId) {
    const target = { tabId };
    return new Promise((resolve, reject) => {
      chrome.debugger.attach(target, CONFIG.PROTOCOL_VERSION, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(target);
        }
      });
    });
  }

  /**
   * Detach debugger from a target
   * @param {Object} target
   * @returns {Promise<void>}
   */
  async function detachDebugger(target) {
    return new Promise((resolve) => {
      chrome.debugger.detach(target, () => {
        // Ignore errors during detach
        if (chrome.runtime.lastError) {
          console.warn('Detach warning:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });
  }

  /**
   * Create a CDP session wrapper
   * @param {Object} target - Debugger target
   * @returns {Object} Session with send method
   */
  function createSessionWrapper(target) {
    return {
      target,
      send(method, params = {}) {
        return new Promise((resolve, reject) => {
          chrome.debugger.sendCommand(target, method, params, (result) => {
            if (chrome.runtime.lastError) {
              const error = new Error(chrome.runtime.lastError.message);
              error.isDebuggingError = isDebuggingError(chrome.runtime.lastError.message);
              reject(error);
            } else {
              resolve(result);
            }
          });
        });
      }
    };
  }

  /**
   * Set up session timeout for auto-cleanup
   * @param {number} tabId
   * @param {Object} session
   */
  function refreshSessionTimeout(tabId, session) {
    if (session.detachTimer) {
      clearTimeout(session.detachTimer);
    }

    session.detachTimer = setTimeout(async () => {
      console.log(`CDP session timeout for tab ${tabId}, detaching...`);
      try {
        await detachDebugger(session.target);
      } catch (e) {
        console.warn('Timeout detach failed:', e);
      }
      sessions.delete(tabId);
    }, CONFIG.SESSION_TIMEOUT_MS);
  }

  /**
   * Get or create a CDP session for a tab
   * @param {number} tabId
   * @returns {Promise<Object>} CDP session
   */
  async function getOrCreateSession(tabId) {
    // Return existing session if valid
    let session = sessions.get(tabId);
    if (session) {
      refreshSessionTimeout(tabId, session);
      return session;
    }

    // Create new session
    console.log(`Creating new CDP session for tab ${tabId}`);
    const target = await attachDebugger(tabId);
    const wrapper = createSessionWrapper(target);

    // Enable Page domain for navigation events
    await wrapper.send('Page.enable');

    session = {
      target,
      session: wrapper,
      lastUsed: Date.now()
    };

    sessions.set(tabId, session);
    refreshSessionTimeout(tabId, session);

    return session;
  }

  /**
   * Execute a handler with CDP session, with retry logic
   * @param {number} tabId
   * @param {Function} handler - async (session) => result
   * @returns {Promise<any>}
   */
  async function withCDPSession(tabId, handler) {
    let session = await getOrCreateSession(tabId);
    let attempts = 0;

    while (attempts <= CONFIG.MAX_RETRIES) {
      try {
        const result = await handler(session.session);
        session.lastUsed = Date.now();
        refreshSessionTimeout(tabId, session);
        return result;
      } catch (error) {
        const isDebugError = error.isDebuggingError;

        // Clean up failed session
        if (session.detachTimer) {
          clearTimeout(session.detachTimer);
        }
        try {
          await detachDebugger(session.target);
        } catch (e) {
          // Ignore detach errors
        }
        sessions.delete(tabId);

        attempts++;
        if (attempts > CONFIG.MAX_RETRIES) {
          console.error(`CDP session failed after ${CONFIG.MAX_RETRIES + 1} attempts for tab ${tabId}`);
          throw error;
        }

        // Wait before retry
        const delay = isDebugError
          ? CONFIG.DEBUGGING_ERROR_RETRY_DELAY_MS
          : CONFIG.RETRY_DELAY_MS;
        await new Promise(r => setTimeout(r, delay));

        // Create fresh session
        console.log(`Retrying CDP session (attempt ${attempts}) for tab ${tabId}`);
        session = await getOrCreateSession(tabId);
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Close all CDP sessions (for extension cleanup)
   */
  async function closeAllSessions() {
    const closePromises = [];
    for (const [tabId, session] of sessions) {
      if (session.detachTimer) {
        clearTimeout(session.detachTimer);
      }
      closePromises.push(
        detachDebugger(session.target).catch(() => {})
      );
    }
    await Promise.all(closePromises);
    sessions.clear();
  }

  /**
   * Close session for a specific tab
   * @param {number} tabId
   */
  async function closeSession(tabId) {
    const session = sessions.get(tabId);
    if (session) {
      if (session.detachTimer) {
        clearTimeout(session.detachTimer);
      }
      await detachDebugger(session.target).catch(() => {});
      sessions.delete(tabId);
    }
  }

  // ============ Input Methods ============

  /**
   * Press a key or key combination
   * @param {number} tabId
   * @param {string} keyString - Key string like 'Enter', 'Ctrl+Shift+End', 'a'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function pressKey(tabId, keyString) {
    console.log(`Pressing key "${keyString}" on tab ${tabId}`);

    try {
      // Parse key string (e.g., "Ctrl+Shift+End")
      const parts = keyString.split('+').map(s => s.trim());
      const modifiers = [];
      let mainKey = null;

      for (const part of parts) {
        const lower = part.toLowerCase();
        if (['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd', 'command'].includes(lower)) {
          modifiers.push(part);
        } else {
          mainKey = part;
        }
      }

      if (!mainKey) {
        return { success: false, error: `No main key in: ${keyString}` };
      }

      const keyInfo = getKeyInfo(mainKey);
      if (!keyInfo) {
        return { success: false, error: `Unsupported key: ${mainKey}` };
      }

      return await withCDPSession(tabId, async (session) => {
        const modifierFlags = calculateModifiers(modifiers);

        // Build key event params
        const baseParams = {
          key: keyInfo.key,
          code: keyInfo.code,
          nativeVirtualKeyCode: keyInfo.keyCode,
          windowsVirtualKeyCode: keyInfo.keyCode,
          ...(modifierFlags > 0 ? { modifiers: modifierFlags } : {})
        };

        // Key down
        await session.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          ...baseParams
        });

        // Key up
        await session.send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          ...baseParams
        });

        return { success: true };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('pressKey failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Type a string character by character
   * @param {number} tabId
   * @param {string} text
   * @param {number} delayMs - Delay between characters (default 50ms)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function typeText(tabId, text, delayMs = 50) {
    console.log(`Typing text on tab ${tabId}: "${text.substring(0, 20)}..."`);

    try {
      return await withCDPSession(tabId, async (session) => {
        for (const char of text) {
          // Use insertText for reliable character input
          await session.send('Input.insertText', { text: char });

          if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
        return { success: true };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('typeText failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Click at coordinates
   * @param {number} tabId
   * @param {number} x
   * @param {number} y
   * @param {Object} options
   * @param {string} options.button - 'left', 'right', 'middle' (default 'left')
   * @param {number} options.clickCount - 1 for single, 2 for double (default 1)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function click(tabId, x, y, options = {}) {
    const { button = 'left', clickCount = 1 } = options;
    console.log(`Clicking at (${x}, ${y}) on tab ${tabId}`);

    try {
      return await withCDPSession(tabId, async (session) => {
        // Mouse down
        await session.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x,
          y,
          button,
          clickCount
        });

        // Mouse up
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x,
          y,
          button,
          clickCount
        });

        return { success: true };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('click failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Scroll the page
   * @param {number} tabId
   * @param {Object} options
   * @param {number} options.deltaX - Horizontal scroll amount
   * @param {number} options.deltaY - Vertical scroll amount
   * @param {number} options.x - X position for scroll (default viewport center)
   * @param {number} options.y - Y position for scroll (default viewport center)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function scroll(tabId, options = {}) {
    const { deltaX = 0, deltaY = 0, x = 100, y = 100 } = options;
    console.log(`Scrolling on tab ${tabId}: deltaX=${deltaX}, deltaY=${deltaY}`);

    try {
      return await withCDPSession(tabId, async (session) => {
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x,
          y,
          deltaX,
          deltaY
        });

        return { success: true };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('scroll failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Scroll down by one page
   * @param {number} tabId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function scrollPageDown(tabId) {
    return pressKey(tabId, 'PageDown');
  }

  /**
   * Scroll up by one page
   * @param {number} tabId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function scrollPageUp(tabId) {
    return pressKey(tabId, 'PageUp');
  }

  /**
   * Scroll to top of page
   * @param {number} tabId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function scrollToTop(tabId) {
    return pressKey(tabId, 'Ctrl+Home');
  }

  /**
   * Scroll to bottom of page
   * @param {number} tabId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function scrollToBottom(tabId) {
    return pressKey(tabId, 'Ctrl+End');
  }

  // ============ Export ============

  const CDPInput = {
    // Configuration
    CONFIG,

    // Key mapping
    KEY_MAP,
    getKeyInfo,
    calculateModifiers,

    // Session management
    withCDPSession,
    closeSession,
    closeAllSessions,

    // Input methods
    pressKey,
    typeText,
    click,
    scroll,

    // Convenience scroll methods
    scrollPageDown,
    scrollPageUp,
    scrollToTop,
    scrollToBottom
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CDPInput;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() { return CDPInput; });
  } else {
    global.CDPInput = CDPInput;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
