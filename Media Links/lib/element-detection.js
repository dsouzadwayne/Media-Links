/**
 * Element Detection Module
 * Provides grid-based visibility sampling, Shadow DOM traversal, and element marking
 */

(function(global) {
  'use strict';

  // Configuration constants
  const CONFIG = {
    VISIBILITY_THRESHOLD: 0.5,    // 50% of sample points must see element
    TARGET_SAMPLE_SPACING: 5,     // 5px between sample points
    MAX_SAMPLE_GRID: 8,           // Maximum 8x8 grid = 64 points
    MIN_RENDERABLE_SIZE: 1,       // Minimum 1px to be considered visible
    MARKER_ATTR: 'data-medialinks-id'
  };

  // ============ Visibility Sampling ============

  /**
   * Build grid sample points for an element's bounding rect
   * @param {DOMRect} rect - Element bounding rectangle
   * @returns {Array<{x: number, y: number}>} Array of sample point coordinates
   */
  function buildSamplePoints(rect) {
    const cols = Math.min(
      CONFIG.MAX_SAMPLE_GRID,
      Math.max(1, Math.round(rect.width / CONFIG.TARGET_SAMPLE_SPACING))
    );
    const rows = Math.min(
      CONFIG.MAX_SAMPLE_GRID,
      Math.max(1, Math.round(rect.height / CONFIG.TARGET_SAMPLE_SPACING))
    );

    const stepX = rect.width / cols;
    const stepY = rect.height / rows;
    const points = [];
    const maxPoints = CONFIG.MAX_SAMPLE_GRID * CONFIG.MAX_SAMPLE_GRID;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: rect.left + stepX * (col + 0.5),
          y: rect.top + stepY * (row + 0.5)
        });
        if (points.length >= maxPoints) return points;
      }
    }

    return points;
  }

  /**
   * Check if element has renderable size (>1px in both dimensions)
   * @param {DOMRect} rect - Element bounding rectangle
   * @returns {boolean}
   */
  function hasRenderableSize(rect) {
    return rect.width > CONFIG.MIN_RENDERABLE_SIZE &&
           rect.height > CONFIG.MIN_RENDERABLE_SIZE;
  }

  /**
   * Clip a rect to the viewport boundaries
   * @param {DOMRect} rect - Element bounding rectangle
   * @param {number} viewportWidth
   * @param {number} viewportHeight
   * @returns {Object|null} Clipped rect or null if not visible
   */
  function clipRectToViewport(rect, viewportWidth, viewportHeight) {
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, viewportWidth);
    const bottom = Math.min(rect.bottom, viewportHeight);
    const width = right - left;
    const height = bottom - top;

    if (width <= CONFIG.MIN_RENDERABLE_SIZE || height <= CONFIG.MIN_RENDERABLE_SIZE) {
      return null;
    }

    return { left, top, width, height, right, bottom };
  }

  /**
   * Check if element is visually visible via CSS properties
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  function isElementVisuallyVisible(element) {
    const style = window.getComputedStyle(element);

    // Check display
    if (style.display === 'none') return false;

    // Check visibility
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;

    // Check opacity
    const opacity = parseFloat(style.opacity || '1');
    if (!isNaN(opacity) && opacity <= 0) return false;

    // Check pointer-events (elements with none are not interactive)
    if (style.pointerEvents === 'none') return false;

    // Check if in hidden/template ancestor
    if (element.closest('[hidden], template')) return false;

    return true;
  }

  // ============ Shadow DOM Traversal ============

  /**
   * Get the topmost element at a point, traversing into Shadow DOM
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Document|ShadowRoot} root - Root to start from
   * @returns {Element|null}
   */
  function getTopElementAtPoint(x, y, root = document) {
    const element = root.elementFromPoint(x, y);
    if (!element) return null;

    // If element has a shadow root, check inside it
    if (element.shadowRoot) {
      const shadowElement = element.shadowRoot.elementFromPoint(x, y);
      if (shadowElement && shadowElement !== element) {
        return getTopElementAtPoint(x, y, element.shadowRoot);
      }
    }

    return element;
  }

  /**
   * Check if an element is on top at a given point (not occluded)
   * @param {HTMLElement} target - Element to check
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean}
   */
  function isElementOnTopAtPoint(target, x, y) {
    const topElement = getTopElementAtPoint(x, y);
    if (!topElement) return false;

    // Check if top element is the target or a descendant of target
    return target === topElement || target.contains(topElement) || isDescendantOf(topElement, target);
  }

  /**
   * Check if node is a descendant of target, crossing Shadow DOM boundaries
   * @param {Node} node
   * @param {Node} target
   * @returns {boolean}
   */
  function isDescendantOf(node, target) {
    if (node === target) return true;
    if (target.contains(node)) return true;

    const visited = new Set();
    let current = node;

    while (current && !visited.has(current)) {
      if (current === target) return true;
      visited.add(current);

      if (current.parentElement) {
        current = current.parentElement;
      } else {
        // Cross shadow DOM boundary
        const root = current.getRootNode();
        if (root instanceof ShadowRoot) {
          current = root.host;
        } else {
          current = null;
        }
      }
    }

    return false;
  }

  /**
   * Compute the visibility ratio of an element (0-1)
   * @param {HTMLElement} element
   * @param {Object} clippedRect - Viewport-clipped bounding rect
   * @returns {number} Ratio of visible sample points (0-1)
   */
  function computeVisibilityRatio(element, clippedRect) {
    const points = buildSamplePoints(clippedRect);
    if (points.length === 0) return 1;

    let visibleCount = 0;
    for (const point of points) {
      if (isElementOnTopAtPoint(element, point.x, point.y)) {
        visibleCount++;
      }
    }

    return visibleCount / points.length;
  }

  // ============ Element Marking ============

  /**
   * Mark interactive elements with unique IDs
   * @param {Document|Element} root - Root to search within
   * @returns {Map<number, HTMLElement>} Map of ID to element
   */
  function markInteractiveElements(root = document) {
    // Clear existing markers
    root.querySelectorAll(`[${CONFIG.MARKER_ATTR}]`).forEach(el => {
      el.removeAttribute(CONFIG.MARKER_ATTR);
    });

    // Interactive element selectors
    const selectors = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])',
      '[data-testid]'
    ];

    const elements = root.querySelectorAll(selectors.join(','));
    const markedElements = new Map();
    let index = 1;

    elements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.setAttribute(CONFIG.MARKER_ATTR, String(index));
        markedElements.set(index, el);
        index++;
      }
    });

    return markedElements;
  }

  /**
   * Get element by its marker ID
   * @param {number|string} id
   * @returns {HTMLElement|null}
   */
  function getElementByMarkerId(id) {
    return document.querySelector(`[${CONFIG.MARKER_ATTR}="${id}"]`);
  }

  // ============ Semantic Descriptions ============

  /**
   * Normalize text (trim and truncate)
   * @param {string} value
   * @param {number} limit - Max length
   * @returns {string}
   */
  function normalizeText(value, limit = 50) {
    if (!value) return '';
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    return trimmed.length > limit ? trimmed.slice(0, limit) + '...' : trimmed;
  }

  /**
   * Build semantic description for an element
   * @param {HTMLElement} element
   * @returns {{text: string, description: string}}
   */
  function buildDescription(element) {
    const tagName = element.tagName.toLowerCase();
    const hints = [];

    // ID attribute
    if (element.id) {
      hints.push(`id:"${normalizeText(element.id, 30)}"`);
    }

    // ARIA label, title, or role
    const ariaLabel = element.getAttribute('aria-label') || element.title || '';
    if (ariaLabel) {
      hints.push(`hint:"${normalizeText(ariaLabel, 50)}"`);
    }

    // Placeholder for inputs
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      hints.push(`placeholder:"${normalizeText(placeholder, 40)}"`);
    }

    // Role attribute
    const role = element.getAttribute('role');
    if (role && ['textbox', 'searchbox', 'combobox', 'button', 'link'].includes(role.toLowerCase())) {
      hints.push(`role:"${role}"`);
    }

    // Input type
    if (element instanceof HTMLInputElement && element.type) {
      hints.push(`type:"${element.type}"`);
    }

    // Link href (truncated)
    if (element instanceof HTMLAnchorElement && element.href) {
      const href = element.href.length > 50 ? element.href.slice(0, 47) + '...' : element.href;
      hints.push(`link:"${href}"`);
    }

    // Get visible text
    let text = '';
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      text = normalizeText(element.value || element.placeholder || '');
    } else if (element instanceof HTMLSelectElement) {
      const selected = element.options[element.selectedIndex];
      text = selected ? normalizeText(selected.text) : '';
    } else {
      text = normalizeText(element.textContent || '');
    }

    const hintText = hints.length ? `{${hints.join(',')}}` : '{}';
    const description = text
      ? `${tagName} ${hintText} ${text}`.trim()
      : `${tagName} ${hintText}`.trim();

    return { text, description };
  }

  // ============ Main API ============

  /**
   * Find visible interactive elements with visibility validation
   * @param {Object} options
   * @param {Document|Element} options.root - Root to search within
   * @param {string[]} options.selectors - CSS selectors to use (optional)
   * @param {Function} options.filter - Optional filter function (element, description) => boolean
   * @param {number} options.visibilityThreshold - Minimum visibility ratio (default 0.5)
   * @returns {Array<{element: HTMLElement, index: number, text: string, description: string, rect: Object}>}
   */
  function findVisibleElements(options = {}) {
    const {
      root = document,
      selectors = null,
      filter = null,
      visibilityThreshold = CONFIG.VISIBILITY_THRESHOLD
    } = options;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const results = [];

    // Use provided selectors or mark all interactive elements
    let elements;
    if (selectors && selectors.length > 0) {
      elements = root.querySelectorAll(selectors.join(','));
    } else {
      const marked = markInteractiveElements(root);
      elements = Array.from(marked.values());
    }

    let index = 1;
    elements.forEach(element => {
      if (!(element instanceof HTMLElement)) return;

      // Check if element is connected to DOM
      if (!element.isConnected) return;

      // Get bounding rect
      const rect = element.getBoundingClientRect();

      // Check minimum size
      if (!hasRenderableSize(rect)) return;

      // Clip to viewport
      const clippedRect = clipRectToViewport(rect, viewportWidth, viewportHeight);
      if (!clippedRect) return;

      // Check CSS visibility
      if (!isElementVisuallyVisible(element)) return;

      // Grid-based visibility sampling
      const visibilityRatio = computeVisibilityRatio(element, clippedRect);
      if (visibilityRatio < visibilityThreshold) return;

      // Build description
      const { text, description } = buildDescription(element);

      // Apply custom filter if provided
      if (filter && !filter(element, description)) return;

      results.push({
        element,
        index,
        text,
        description,
        rect: clippedRect,
        visibilityRatio
      });

      index++;
    });

    return results;
  }

  /**
   * Find elements by text content with visibility check
   * @param {string|RegExp} textMatch - Text to match
   * @param {Object} options - Same options as findVisibleElements plus:
   * @param {boolean} options.caseSensitive - Case sensitive matching (default false)
   * @returns {Array}
   */
  function findByText(textMatch, options = {}) {
    const { caseSensitive = false, ...otherOptions } = options;

    const filter = (element, description) => {
      const text = element.textContent || '';
      if (textMatch instanceof RegExp) {
        return textMatch.test(text);
      }
      const searchText = caseSensitive ? text : text.toLowerCase();
      const searchTerm = caseSensitive ? textMatch : textMatch.toLowerCase();
      return searchText.includes(searchTerm);
    };

    return findVisibleElements({ ...otherOptions, filter });
  }

  /**
   * Find clickable elements (buttons, links, etc.)
   * @param {Object} options
   * @returns {Array}
   */
  function findClickable(options = {}) {
    const clickableSelectors = [
      'a[href]',
      'button',
      '[role="button"]',
      '[role="link"]',
      '[onclick]',
      'input[type="button"]',
      'input[type="submit"]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    return findVisibleElements({
      ...options,
      selectors: clickableSelectors
    });
  }

  // ============ Export ============

  const ElementDetection = {
    // Configuration
    CONFIG,

    // Core visibility functions
    buildSamplePoints,
    hasRenderableSize,
    clipRectToViewport,
    isElementVisuallyVisible,
    computeVisibilityRatio,

    // Shadow DOM
    getTopElementAtPoint,
    isElementOnTopAtPoint,
    isDescendantOf,

    // Element marking
    markInteractiveElements,
    getElementByMarkerId,

    // Descriptions
    normalizeText,
    buildDescription,

    // Main API
    findVisibleElements,
    findByText,
    findClickable
  };

  // Export for different environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElementDetection;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() { return ElementDetection; });
  } else {
    global.ElementDetection = ElementDetection;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
