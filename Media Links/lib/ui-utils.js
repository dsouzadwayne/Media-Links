/**
 * UI Utilities - Centralized UI components
 * Provides notifications, toasts, and theme color helpers
 */

window.UIUtils = (() => {
  'use strict';

  // Animation styles injected flag
  let animationsInjected = false;

  // Theme colors for fallback (when ThemeManager not available)
  const FALLBACK_THEME_COLORS = {
    light: {
      button: '#6366f1',
      buttonHover: '#4f46e5',
      buttonText: '#fff',
      success: '#10b981',
      error: '#ef4444',
      primary: '#6366f1'
    },
    dark: {
      button: '#8b5cf6',
      buttonHover: '#7c3aed',
      buttonText: '#fff',
      success: '#34d399',
      error: '#f87171',
      primary: '#818cf8'
    }
  };

  // Dialog colors based on theme
  const DIALOG_COLORS = {
    dark: {
      background: '#1a1a2e',
      text: '#e0e7ff',
      border: '#2d2d44',
      inputBg: '#252540',
      inputBorder: '#3d3d5c',
      cancelBg: '#2d2d44',
      cancelHover: '#3d3d5c',
      cancelText: '#c7d2fe'
    },
    light: {
      background: '#ffffff',
      text: '#1a1a1a',
      border: '#e0e0e0',
      inputBg: '#f8f8f8',
      inputBorder: '#d0d0d0',
      cancelBg: '#e5e5e5',
      cancelHover: '#d5d5d5',
      cancelText: '#333333'
    }
  };

  /**
   * Inject CSS animations for notifications and dialogs
   */
  const injectAnimations = () => {
    if (animationsInjected || document.querySelector('style[data-media-links-animations]')) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-media-links-animations', 'true');
    style.textContent = `
      @keyframes ml-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ml-slideIn {
        from { transform: translate(-50%, -45%); opacity: 0; }
        to { transform: translate(-50%, -50%); opacity: 1; }
      }
      @keyframes ml-slideInRight {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes ml-slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100px); opacity: 0; }
      }
      @keyframes ml-slideInUp {
        from { transform: translateY(20px) translateX(-50%); opacity: 0; }
        to { transform: translateY(0) translateX(-50%); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    animationsInjected = true;
  };

  /**
   * Get theme colors - uses ThemeManager if available, falls back to defaults
   * @returns {Promise<Object>} Theme colors object
   */
  const getThemeColors = () => {
    return new Promise((resolve) => {
      try {
        if (typeof ThemeManager !== 'undefined') {
          const colors = ThemeManager.getThemeColors();
          resolve(colors);
        } else {
          // Fallback: check document theme attribute
          const theme = document.documentElement.getAttribute('data-theme') || 'dark';
          resolve(FALLBACK_THEME_COLORS[theme] || FALLBACK_THEME_COLORS.dark);
        }
      } catch (error) {
        console.warn('UIUtils: Error getting theme colors:', error);
        resolve(FALLBACK_THEME_COLORS.dark);
      }
    });
  };

  /**
   * Get dialog colors based on button text color (determines dark/light mode)
   * @param {string} buttonTextColor - The button text color (e.g., '#fff' or '#000')
   * @returns {Object} Dialog colors object
   */
  const getDialogColors = (buttonTextColor) => {
    // Try ThemeManager first
    try {
      if (typeof ThemeManager !== 'undefined' && ThemeManager.getDialogColors) {
        return ThemeManager.getDialogColors(buttonTextColor);
      }
    } catch (error) {
      console.warn('UIUtils: Error getting dialog colors from ThemeManager:', error);
    }

    // Fallback: determine based on button text color
    const isDark = buttonTextColor === '#fff' || buttonTextColor === '#ffffff';
    return isDark ? DIALOG_COLORS.dark : DIALOG_COLORS.light;
  };

  /**
   * Show a notification/toast message
   * @param {string} message - The message to display
   * @param {Object} options - Options for the notification
   * @param {boolean} options.isError - Whether this is an error message
   * @param {string} options.type - Type: 'success', 'error', 'info', 'warning'
   * @param {number} options.duration - Duration in ms (default: 3000)
   * @param {string} options.position - Position: 'bottom-right', 'bottom-center', 'top-right'
   */
  const showNotification = (message, options = {}) => {
    const {
      isError = false,
      type = isError ? 'error' : 'success',
      duration = 3000,
      position = 'bottom-right'
    } = options;

    // Inject animations if needed
    injectAnimations();

    const notification = document.createElement('div');
    notification.className = 'media-links-notification';
    notification.textContent = message;

    // Get colors based on type
    const colors = {
      success: '#4caf50',
      error: '#f44336',
      info: '#2196F3',
      warning: '#ff9800'
    };
    const bgColor = colors[type] || colors.info;

    // Position styles
    const isMobile = window.innerWidth < 768;
    let positionCSS = '';
    let animation = 'ml-slideInRight';

    switch (position) {
      case 'bottom-center':
        positionCSS = 'bottom: 20px; left: 50%; transform: translateX(-50%);';
        animation = 'ml-slideInUp';
        break;
      case 'top-right':
        positionCSS = 'top: 20px; right: 20px;';
        break;
      case 'bottom-right':
      default:
        positionCSS = isMobile
          ? 'bottom: 20px; left: 50%; transform: translateX(-50%);'
          : 'bottom: 20px; right: 20px;';
        animation = isMobile ? 'ml-slideInUp' : 'ml-slideInRight';
        break;
    }

    notification.style.cssText = `
      position: fixed;
      ${positionCSS}
      background: ${bgColor};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10001;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 90%;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: ${animation} 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Auto-remove after duration
    setTimeout(() => {
      notification.style.animation = 'ml-slideOutRight 0.3s ease-out forwards';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);

    return notification;
  };

  /**
   * Show a toast notification (alias for showNotification with shorter duration)
   * @param {string} message - The message to display
   * @param {string} type - Type: 'success', 'error', 'info'
   */
  const showToast = (message, type = 'success') => {
    return showNotification(message, { type, duration: 2000 });
  };

  /**
   * Show copy feedback on an element
   * @param {HTMLElement} element - The element to show feedback on
   * @param {string} text - The text that was copied (for tooltip)
   * @param {boolean} isError - Whether copy failed
   */
  const showCopyFeedback = (element, text, isError = false) => {
    // Store original styles
    const originalColor = element.style.color;
    const originalBackground = element.style.backgroundColor;

    // Show success/error feedback
    element.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
    element.style.color = isError ? '#c62828' : '#2e7d32';
    element.style.transition = 'all 0.2s ease';

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.textContent = isError ? 'Failed to copy' : 'Copied!';
    tooltip.style.cssText = `
      position: fixed;
      background: ${isError ? '#f44336' : '#4caf50'};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      z-index: 10002;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    // Position tooltip near the element
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 30}px`;
    tooltip.style.transform = 'translateX(-50%)';

    document.body.appendChild(tooltip);

    // Reset after delay
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      element.style.color = originalColor;
      if (document.body.contains(tooltip)) {
        document.body.removeChild(tooltip);
      }
    }, 1000);
  };

  /**
   * Create a modal backdrop
   * @param {Function} onClose - Callback when backdrop is clicked
   * @returns {HTMLElement} The backdrop element
   */
  const createBackdrop = (onClose) => {
    injectAnimations();

    const backdrop = document.createElement('div');
    backdrop.className = 'media-links-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 9999;
      backdrop-filter: blur(4px);
      animation: ml-fadeIn 0.2s ease-out;
    `;

    if (onClose) {
      backdrop.addEventListener('click', onClose);
    }

    return backdrop;
  };

  /**
   * Create a dialog/modal container
   * @param {Object} colors - Dialog colors from getDialogColors()
   * @returns {HTMLElement} The dialog element
   */
  const createDialog = (colors) => {
    injectAnimations();

    const dialog = document.createElement('div');
    dialog.className = 'media-links-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${colors.background};
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      z-index: 10000;
      min-width: 400px;
      max-width: 500px;
      border: 1px solid ${colors.border};
      animation: ml-slideIn 0.3s ease-out;
    `;

    return dialog;
  };

  /**
   * Close and remove a dialog and its backdrop
   * @param {HTMLElement} dialog - The dialog element
   * @param {HTMLElement} backdrop - The backdrop element
   */
  const closeDialog = (dialog, backdrop) => {
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.removeChild(backdrop);
    }
  };

  // Public API
  return {
    getThemeColors,
    getDialogColors,
    showNotification,
    showToast,
    showCopyFeedback,
    createBackdrop,
    createDialog,
    closeDialog,
    injectAnimations
  };
})();
