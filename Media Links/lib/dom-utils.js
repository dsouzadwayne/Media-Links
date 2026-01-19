/**
 * DOM Utilities - Centralized DOM helpers
 * Provides selector utilities, button creation, and MutationObserver helpers
 */

window.DOMUtils = (() => {
  'use strict';

  // Copy icon SVG (used in copy buttons)
  const COPY_ICON_SVG = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon">
      <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"></path>
    </svg>
  `;

  const CHECK_ICON_SVG = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.6668 5L7.50016 14.1667L3.3335 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `;

  const ERROR_ICON_SVG = `
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>
  `;

  /**
   * Query selector with fallback selectors
   * @param {HTMLElement} element - Parent element to search in
   * @param {string|string[]} selectors - Selector or array of selectors to try
   * @returns {HTMLElement|null} First matching element or null
   */
  const querySelector = (element, selectors) => {
    if (!element) return null;

    if (typeof selectors === 'string') {
      return element.querySelector(selectors);
    }

    // Array of selectors - try each one
    for (const selector of selectors) {
      try {
        const result = element.querySelector(selector);
        if (result) return result;
      } catch (e) {
        // Invalid selector, skip
        continue;
      }
    }
    return null;
  };

  /**
   * Query selector all with fallback selectors
   * @param {HTMLElement} element - Parent element to search in
   * @param {string} primarySelector - Primary selector to try first
   * @param {string[]} fallbackSelectors - Fallback selectors if primary returns empty
   * @returns {NodeList} Matching elements
   */
  const querySelectorAll = (element, primarySelector, fallbackSelectors = []) => {
    if (!element) return [];

    let results = element.querySelectorAll(primarySelector);
    if (results.length === 0 && fallbackSelectors.length > 0) {
      for (const selector of fallbackSelectors) {
        try {
          results = element.querySelectorAll(selector);
          if (results.length > 0) break;
        } catch (e) {
          continue;
        }
      }
    }
    return results;
  };

  /**
   * Create an inline copy button (small, icon-only)
   * @param {string} title - Tooltip text
   * @param {Function} getTextFunc - Function that returns text to copy
   * @param {Object} options - Additional options
   * @param {string} options.className - CSS class name for the button
   * @returns {HTMLElement} The button element
   */
  const createInlineCopyButton = (title, getTextFunc, options = {}) => {
    const { className = 'media-links-copy-btn' } = options;
    const isNameButton = title.toLowerCase().includes('name');

    const copyBtn = document.createElement('button');
    copyBtn.className = isNameButton ? 'media-links-name-copy-btn' : 'media-links-role-copy-btn';
    if (className && className !== 'media-links-copy-btn') {
      copyBtn.classList.add(className);
    }
    copyBtn.innerHTML = COPY_ICON_SVG;
    copyBtn.title = title;
    copyBtn.style.cssText = `
      padding: 3px;
      background: transparent;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0.4;
      transition: all 0.15s ease;
      vertical-align: middle;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: currentColor;
    `;

    // Hover effects
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.opacity = '1';
      copyBtn.style.background = 'rgba(128, 128, 128, 0.15)';
      copyBtn.style.transform = 'scale(1.15)';
    });

    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.opacity = '0.4';
      copyBtn.style.background = 'transparent';
      copyBtn.style.transform = 'scale(1)';
    });

    // Click handler
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const text = getTextFunc();
      navigator.clipboard.writeText(text).then(() => {
        // Success feedback
        copyBtn.innerHTML = CHECK_ICON_SVG;
        copyBtn.style.color = '#4caf50';
        copyBtn.style.opacity = '1';

        setTimeout(() => {
          copyBtn.innerHTML = COPY_ICON_SVG;
          copyBtn.style.color = 'currentColor';
          copyBtn.style.opacity = '0.4';
        }, 1000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        // Error feedback
        copyBtn.innerHTML = ERROR_ICON_SVG;
        copyBtn.style.color = '#f44336';
        copyBtn.style.opacity = '1';

        setTimeout(() => {
          copyBtn.innerHTML = COPY_ICON_SVG;
          copyBtn.style.color = 'currentColor';
          copyBtn.style.opacity = '0.4';
        }, 1000);
      });
    });

    return copyBtn;
  };

  /**
   * Create a styled button with hover effects
   * @param {string} label - Button text
   * @param {Object} colors - Theme colors (button, buttonHover, buttonText)
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} The button element
   */
  const createButton = (label, colors, onClick) => {
    const button = document.createElement('button');
    button.className = 'media-links-copy-btn';
    button.innerHTML = label;
    button.style.cssText = `
      margin-left: 10px;
      padding: 6px 12px;
      background: ${colors.button};
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: ${colors.buttonText};
      transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = colors.buttonHover;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = colors.button;
      button.style.transform = 'scale(1)';
    });

    if (onClick) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      });
    }

    return button;
  };

  /**
   * Inject a style element into the document head
   * @param {string} cssText - CSS content
   * @param {string} id - Unique identifier for the style element
   * @returns {HTMLStyleElement} The style element
   */
  const injectStyles = (cssText, id) => {
    // Check if already injected
    const existingStyle = document.querySelector(`style[data-media-links="${id}"]`);
    if (existingStyle) {
      return existingStyle;
    }

    const style = document.createElement('style');
    style.setAttribute('data-media-links', id);
    style.textContent = cssText;
    document.head.appendChild(style);
    return style;
  };

  /**
   * Create a debounced MutationObserver
   * @param {Object} options - Observer options
   * @param {Function} options.callback - Callback when relevant changes detected
   * @param {number} options.debounceDelay - Debounce delay in ms (default: 500)
   * @param {string[]} options.ignoredClasses - Classes to ignore when checking mutations
   * @param {Function} options.contentChecker - Function to check if node contains relevant content
   * @returns {Object} Observer controller with observe, disconnect, and cleanup methods
   */
  const createDebouncedObserver = (options = {}) => {
    const {
      callback,
      debounceDelay = 500,
      ignoredClasses = [],
      contentChecker = () => true
    } = options;

    let observer = null;
    let debounceTimer = null;
    let isObserving = false;

    const observerCallback = (mutations) => {
      const hasNewContent = mutations.some(mutation => {
        return mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some(node => {
            // Skip nodes with ignored classes
            if (node.nodeType === 1 && node.classList) {
              for (const ignoredClass of ignoredClasses) {
                if (node.classList.contains(ignoredClass)) {
                  return false;
                }
              }
            }
            // Check custom content checker
            return contentChecker(node);
          });
      });

      if (hasNewContent) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(callback, debounceDelay);
      }
    };

    const observe = (targetElement, config = { childList: true, subtree: true }) => {
      if (!targetElement) {
        console.warn('DOMUtils.createDebouncedObserver: No target element provided');
        return;
      }

      observer = new MutationObserver(observerCallback);
      observer.observe(targetElement, config);
      isObserving = true;
    };

    const disconnect = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      isObserving = false;
    };

    const cleanup = () => {
      disconnect();
    };

    return {
      observe,
      disconnect,
      cleanup,
      isObserving: () => isObserving
    };
  };

  /**
   * Setup page unload cleanup for observers and timers
   * @param {Function} cleanupFn - Cleanup function to call
   */
  const setupCleanupOnUnload = (cleanupFn) => {
    window.addEventListener('beforeunload', cleanupFn);
    window.addEventListener('pagehide', cleanupFn);
  };

  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms (default: 10000)
   * @param {HTMLElement} parent - Parent element to search in (default: document)
   * @returns {Promise<HTMLElement>} The element when found
   */
  const waitForElement = (selector, timeout = 10000, parent = document) => {
    return new Promise((resolve, reject) => {
      const element = parent.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = parent.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(parent.body || parent, {
        childList: true,
        subtree: true
      });

      // Timeout
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  };

  // Public API
  return {
    querySelector,
    querySelectorAll,
    createInlineCopyButton,
    createButton,
    injectStyles,
    createDebouncedObserver,
    setupCleanupOnUnload,
    waitForElement,
    COPY_ICON_SVG,
    CHECK_ICON_SVG,
    ERROR_ICON_SVG
  };
})();
