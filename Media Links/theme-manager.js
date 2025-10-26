/**
 * Theme Manager - Centralized theme management utility
 * Handles all theme-related operations across the extension
 */

window.ThemeManager = (() => {
  'use strict';

  // Private variables
  let currentTheme = 'light';
  const subscribers = new Set();
  let isInitialized = false;

  // Theme color definitions
  const themeColors = {
    light: {
      button: '#6366f1',
      buttonHover: '#4f46e5',
      buttonText: '#fff',
      bg: '#ffffff',
      text: '#1f2937'
    },
    dark: {
      button: '#8b5cf6',
      buttonHover: '#7c3aed',
      buttonText: '#fff',
      bg: '#1a1a1a',
      text: '#e5e5e5'
    },
    'catppuccin-mocha': {
      button: '#cba6f7',
      buttonHover: '#b4a1e8',
      buttonText: '#000',
      bg: '#1e1e2e',
      text: '#cdd6f4'
    },
    cats: {
      button: '#ff9933',
      buttonHover: '#ff7700',
      buttonText: '#000',
      bg: '#2d1f1a',
      text: '#f5deb3'
    },
    'cat-night': {
      button: '#818cf8',
      buttonHover: '#6366f1',
      buttonText: '#fff',
      bg: '#0a0e27',
      text: '#e0e7ff'
    }
  };

  // Dialog colors based on button text (dark or light)
  const getDialogColors = (buttonText) => {
    const isDark = buttonText === '#fff';
    if (isDark) {
      return {
        background: '#1a1a2e',
        text: '#e0e7ff',
        border: '#2d2d44',
        inputBg: '#252540',
        inputBorder: '#3d3d5c',
        cancelBg: '#2d2d44',
        cancelHover: '#3d3d5c',
        cancelText: '#c7d2fe'
      };
    } else {
      return {
        background: '#ffffff',
        text: '#1a1a1a',
        border: '#e0e0e0',
        inputBg: '#f8f8f8',
        inputBorder: '#d0d0d0',
        cancelBg: '#e5e5e5',
        cancelHover: '#d5d5d5',
        cancelText: '#333333'
      };
    }
  };

  /**
   * Check if extension context is valid
   */
  const isExtensionContextValid = () => {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  };

  /**
   * Load current theme from storage
   */
  const loadTheme = () => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          currentTheme = 'light';
          resolve('light');
          return;
        }

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['theme'], (result) => {
            currentTheme = result.theme || 'light';
            resolve(currentTheme);
          });
        } else {
          currentTheme = 'light';
          resolve('light');
        }
      } catch (error) {
        console.warn('ThemeManager: Error loading theme:', error);
        currentTheme = 'light';
        resolve('light');
      }
    });
  };

  /**
   * Apply theme to document
   */
  const applyThemeToDOM = (theme = currentTheme) => {
    try {
      if (typeof document !== 'undefined') {
        // Check if document.body exists before trying to set attributes
        if (document.body) {
          document.body.setAttribute('data-theme', theme);
        }
        // document.documentElement should always exist, but check to be safe
        if (document.documentElement) {
          document.documentElement.setAttribute('data-theme', theme);
        }
      }
    } catch (error) {
      console.warn('ThemeManager: Error applying theme to DOM:', error);
    }
  };

  /**
   * Initialize theme manager
   */
  const initialize = async () => {
    if (isInitialized) return;

    const theme = await loadTheme();
    applyThemeToDOM(theme);

    // Listen for theme changes from background script
    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'themeChanged' && message.theme) {
          setTheme(message.theme);
        }
      });
    }

    isInitialized = true;
  };

  /**
   * Set theme and notify subscribers
   */
  const setTheme = (theme) => {
    if (!themeColors[theme]) {
      console.warn(`ThemeManager: Invalid theme "${theme}", using "light"`);
      theme = 'light';
    }

    currentTheme = theme;
    applyThemeToDOM(theme);
    notifySubscribers(theme);
  };

  /**
   * Get current theme
   */
  const getTheme = () => currentTheme;

  /**
   * Get theme colors for a specific theme
   */
  const getThemeColors = (theme = currentTheme) => {
    return themeColors[theme] || themeColors.light;
  };

  /**
   * Get dialog colors based on current theme
   */
  const getDialogColorsForTheme = (theme = currentTheme) => {
    const colors = getThemeColors(theme);
    return getDialogColors(colors.buttonText);
  };

  /**
   * Subscribe to theme changes
   */
  const subscribe = (callback) => {
    if (typeof callback === 'function') {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };

  /**
   * Notify all subscribers of theme change
   */
  const notifySubscribers = (theme) => {
    subscribers.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('ThemeManager: Error in subscriber callback:', error);
      }
    });
  };

  /**
   * Get all available themes
   */
  const getAvailableThemes = () => Object.keys(themeColors);

  /**
   * Public API
   */
  return {
    initialize,
    loadTheme,
    applyThemeToDOM,
    setTheme,
    getTheme,
    getThemeColors,
    getDialogColorsForTheme,
    getDialogColors,
    subscribe,
    getAvailableThemes,
    isExtensionContextValid
  };
})();

// Auto-initialize if in browser context
if (typeof document !== 'undefined' && typeof chrome !== 'undefined' && typeof window !== 'undefined') {
  if (window.ThemeManager && typeof window.ThemeManager.initialize === 'function') {
    // Wait for DOM to be ready before initializing
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.ThemeManager.initialize().catch(error => {
          console.warn('ThemeManager: Initialization error:', error);
        });
      });
    } else {
      // DOM is already ready
      window.ThemeManager.initialize().catch(error => {
        console.warn('ThemeManager: Initialization error:', error);
      });
    }
  }
}
