/**
 * Storage Utilities - Centralized chrome.storage access
 * Provides a unified API for storage operations with error handling
 */

window.StorageUtils = (() => {
  'use strict';

  /**
   * Check if extension context is still valid
   * This is used across all content scripts to handle extension reload scenarios
   * @returns {boolean} True if extension context is valid
   */
  const isExtensionContextValid = () => {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  };

  /**
   * Get values from chrome.storage.sync with defaults
   * @param {string|string[]} keys - Key(s) to retrieve
   * @param {Object} defaults - Default values for each key
   * @returns {Promise<Object>} Object with retrieved/default values
   */
  const getSettings = (keys, defaults = {}) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(defaults);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          chrome.storage.sync.get(keyArray, (result) => {
            if (chrome.runtime.lastError) {
              console.warn('StorageUtils: Error getting settings:', chrome.runtime.lastError);
              resolve(defaults);
            } else {
              // Merge results with defaults
              const merged = { ...defaults };
              Object.keys(defaults).forEach(key => {
                if (result[key] !== undefined) {
                  merged[key] = result[key];
                }
              });
              resolve(merged);
            }
          });
        } else {
          resolve(defaults);
        }
      } catch (error) {
        console.warn('StorageUtils: Error accessing chrome.storage:', error);
        resolve(defaults);
      }
    });
  };

  /**
   * Get a single setting value
   * @param {string} key - Key to retrieve
   * @param {*} defaultValue - Default value if not found
   * @returns {Promise<*>} The retrieved or default value
   */
  const getSetting = async (key, defaultValue = null) => {
    const result = await getSettings([key], { [key]: defaultValue });
    return result[key];
  };

  /**
   * Save a single setting
   * @param {string} key - Key to save
   * @param {*} value - Value to save
   * @returns {Promise<boolean>} True if save succeeded
   */
  const saveSetting = (key, value) => {
    return saveSettings({ [key]: value });
  };

  /**
   * Save multiple settings
   * @param {Object} obj - Key-value pairs to save
   * @returns {Promise<boolean>} True if save succeeded
   */
  const saveSettings = (obj) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(false);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set(obj, () => {
            if (chrome.runtime.lastError) {
              console.warn('StorageUtils: Error saving settings:', chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } else {
          resolve(false);
        }
      } catch (error) {
        console.warn('StorageUtils: Error saving to chrome.storage:', error);
        resolve(false);
      }
    });
  };

  /**
   * Get values from chrome.storage.local (for larger data)
   * @param {string|string[]} keys - Key(s) to retrieve
   * @param {Object} defaults - Default values for each key
   * @returns {Promise<Object>} Object with retrieved/default values
   */
  const getLocal = (keys, defaults = {}) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(defaults);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          chrome.storage.local.get(keyArray, (result) => {
            if (chrome.runtime.lastError) {
              console.warn('StorageUtils: Error getting local storage:', chrome.runtime.lastError);
              resolve(defaults);
            } else {
              const merged = { ...defaults };
              Object.keys(defaults).forEach(key => {
                if (result[key] !== undefined) {
                  merged[key] = result[key];
                }
              });
              resolve(merged);
            }
          });
        } else {
          resolve(defaults);
        }
      } catch (error) {
        console.warn('StorageUtils: Error accessing chrome.storage.local:', error);
        resolve(defaults);
      }
    });
  };

  /**
   * Save to chrome.storage.local (for larger data)
   * @param {Object} obj - Key-value pairs to save
   * @returns {Promise<boolean>} True if save succeeded
   */
  const saveLocal = (obj) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(false);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(obj, () => {
            if (chrome.runtime.lastError) {
              console.warn('StorageUtils: Error saving to local storage:', chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } else {
          resolve(false);
        }
      } catch (error) {
        console.warn('StorageUtils: Error saving to chrome.storage.local:', error);
        resolve(false);
      }
    });
  };

  /**
   * Remove keys from chrome.storage.sync
   * @param {string|string[]} keys - Key(s) to remove
   * @returns {Promise<boolean>} True if removal succeeded
   */
  const removeSettings = (keys) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(false);
          return;
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          chrome.storage.sync.remove(keyArray, () => {
            if (chrome.runtime.lastError) {
              console.warn('StorageUtils: Error removing settings:', chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(true);
            }
          });
        } else {
          resolve(false);
        }
      } catch (error) {
        console.warn('StorageUtils: Error removing from chrome.storage:', error);
        resolve(false);
      }
    });
  };

  // Public API
  return {
    isExtensionContextValid,
    getSettings,
    getSetting,
    saveSetting,
    saveSettings,
    getLocal,
    saveLocal,
    removeSettings
  };
})();
