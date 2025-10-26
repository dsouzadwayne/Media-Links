/**
 * Settings Utils - Centralized settings management utility
 * Handles all chrome.storage.sync operations with validation and migration
 */

window.SettingsUtils = (() => {
  'use strict';

  // Default settings
  const DEFAULT_SETTINGS = {
    // Appearance
    theme: 'light',

    // Search & Query
    defaultSearchEngine: 'google',
    defaultProfile: '',
    autoOpenResults: false,
    tabDelay: 150,
    showPreview: true,

    // Content & Format
    defaultCastCount: 5,
    defaultContentFormat: 'name-role',
    defaultOutputFormat: 'newline',

    // Debug
    debugMode: false,
    showCopyWebpageBtn: false,

    // IMDb Settings
    showImdbCast: true,
    showImdbCompany: true,
    showImdbAwards: true,
    showImdbMain: true,

    // Wikipedia Settings
    showWikiCast: true,
    showWikiTables: true,
    wikiOutputFormat: 'newline',

    // Letterboxd Settings
    showLetterboxdCast: true,
    letterboxdCastCount: 10,
    letterboxdOutputFormat: 'colon',
    letterboxdIncludeRoles: true,

    // Apple TV+ Settings
    showAppleTVCast: true,
    appleTVCastCount: 10,
    appleTVOutputFormat: 'colon',
    appleTVIncludeRoles: true,

    // BookMyShow Settings
    showBookMyShowCopy: true,
    bookMyShowCastCount: 10,
    bookMyShowOutputFormat: 'colon',
    bookMyShowIncludeRoles: true
  };

  // Validation rules
  const VALIDATION_RULES = {
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'catppuccin-mocha', 'cats', 'cat-night'],
      default: 'light'
    },
    defaultSearchEngine: {
      type: 'string',
      enum: ['google', 'youtube', 'google-ai', 'bing', 'duckduckgo'],
      default: 'google'
    },
    defaultProfile: {
      type: 'string',
      default: ''
    },
    autoOpenResults: {
      type: 'boolean',
      default: false
    },
    tabDelay: {
      type: 'number',
      min: 0,
      max: 5000,
      default: 150
    },
    showPreview: {
      type: 'boolean',
      default: true
    },
    defaultCastCount: {
      type: 'number',
      min: 1,
      max: 1000,
      default: 5
    },
    defaultContentFormat: {
      type: 'string',
      enum: ['name-role', 'name-only', 'role-only'],
      default: 'name-role'
    },
    defaultOutputFormat: {
      type: 'string',
      enum: ['newline', 'comma', 'csv', 'json', 'table'],
      default: 'newline'
    },
    debugMode: {
      type: 'boolean',
      default: false
    },
    showCopyWebpageBtn: {
      type: 'boolean',
      default: false
    },
    showImdbCast: {
      type: 'boolean',
      default: true
    },
    showImdbCompany: {
      type: 'boolean',
      default: true
    },
    showImdbAwards: {
      type: 'boolean',
      default: true
    },
    showImdbMain: {
      type: 'boolean',
      default: true
    },
    showWikiCast: {
      type: 'boolean',
      default: true
    },
    showWikiTables: {
      type: 'boolean',
      default: true
    },
    wikiOutputFormat: {
      type: 'string',
      enum: ['newline', 'comma', 'csv', 'json', 'table'],
      default: 'newline'
    },
    showLetterboxdCast: {
      type: 'boolean',
      default: true
    },
    letterboxdCastCount: {
      type: 'number',
      min: 1,
      max: 1000,
      default: 10
    },
    letterboxdOutputFormat: {
      type: 'string',
      enum: ['newline', 'comma', 'colon', 'csv', 'json', 'table'],
      default: 'colon'
    },
    letterboxdIncludeRoles: {
      type: 'boolean',
      default: true
    },
    showAppleTVCast: {
      type: 'boolean',
      default: true
    },
    appleTVCastCount: {
      type: 'number',
      min: 1,
      max: 1000,
      default: 10
    },
    appleTVOutputFormat: {
      type: 'string',
      enum: ['newline', 'comma', 'colon', 'csv', 'json', 'table'],
      default: 'colon'
    },
    appleTVIncludeRoles: {
      type: 'boolean',
      default: true
    },
    showBookMyShowCopy: {
      type: 'boolean',
      default: true
    },
    bookMyShowCastCount: {
      type: 'number',
      min: 1,
      max: 1000,
      default: 10
    },
    bookMyShowOutputFormat: {
      type: 'string',
      enum: ['newline', 'comma', 'colon', 'csv', 'json', 'table'],
      default: 'colon'
    },
    bookMyShowIncludeRoles: {
      type: 'boolean',
      default: true
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
   * Validate a single setting value (used only when SAVING)
   * Ensures type correctness and constraint satisfaction
   */
  const validateSetting = (key, value) => {
    const rule = VALIDATION_RULES[key];

    if (!rule) {
      console.warn(`SettingsUtils: Unknown setting key "${key}"`);
      return DEFAULT_SETTINGS[key];
    }

    // Check type
    if (typeof value !== rule.type) {
      console.warn(
        `SettingsUtils: Invalid type for "${key}": expected ${rule.type}, got ${typeof value}. Using default: ${rule.default}`
      );
      return rule.default;
    }

    // Check enum values
    if (rule.enum && !rule.enum.includes(value)) {
      console.warn(
        `SettingsUtils: Invalid value for "${key}": "${value}" not in ${JSON.stringify(rule.enum)}. Using default: ${rule.default}`
      );
      return rule.default;
    }

    // Check min/max for numbers
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        console.warn(`SettingsUtils: Value for "${key}" (${value}) below minimum ${rule.min}. Using default: ${rule.default}`);
        return rule.default;
      }
      if (rule.max !== undefined && value > rule.max) {
        console.warn(`SettingsUtils: Value for "${key}" (${value}) exceeds maximum ${rule.max}. Using default: ${rule.default}`);
        return rule.default;
      }
    }

    return value;
  };

  /**
   * Validate all settings
   */
  const validateSettings = (settings) => {
    const validated = {};
    for (const [key, value] of Object.entries(settings)) {
      validated[key] = validateSetting(key, value);
    }
    return validated;
  };

  /**
   * Migrate settings - fill in missing keys with defaults
   * Preserves user data when loading (doesn't overwrite invalid values)
   */
  const migrateSettings = (settings) => {
    const migrated = { ...DEFAULT_SETTINGS };

    // Copy over settings, preserving user data even if it fails validation on load
    for (const [key, value] of Object.entries(settings)) {
      if (key in DEFAULT_SETTINGS) {
        // During load, prefer user's value even if type seems wrong
        // Only validate when saving, not when loading
        if (value !== undefined && value !== null) {
          migrated[key] = value;
        } else {
          migrated[key] = DEFAULT_SETTINGS[key];
        }
      }
    }

    return migrated;
  };

  /**
   * Load settings from storage
   */
  const loadSettings = () => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(DEFAULT_SETTINGS);
          return;
        }

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(null, (result) => {
            const migrated = migrateSettings(result || {});
            resolve(migrated);
          });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.warn('SettingsUtils: Error loading settings:', error);
        resolve(DEFAULT_SETTINGS);
      }
    });
  };

  /**
   * Save a single setting
   */
  const saveSetting = (key, value) => {
    return new Promise((resolve, reject) => {
      try {
        if (!isExtensionContextValid()) {
          reject(new Error('Extension context invalid'));
          return;
        }

        const validated = validateSetting(key, value);
        const update = { [key]: validated };

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set(update, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(validated);
            }
          });
        } else {
          reject(new Error('chrome.storage not available'));
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Save multiple settings
   */
  const saveSettings = (settings) => {
    return new Promise((resolve, reject) => {
      try {
        if (!isExtensionContextValid()) {
          reject(new Error('Extension context invalid'));
          return;
        }

        const validated = validateSettings(settings);

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set(validated, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(validated);
            }
          });
        } else {
          reject(new Error('chrome.storage not available'));
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Get a single setting
   */
  const getSetting = (key) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          resolve(DEFAULT_SETTINGS[key]);
          return;
        }

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get([key], (result) => {
            const value = result[key] !== undefined ? result[key] : DEFAULT_SETTINGS[key];
            resolve(validateSetting(key, value));
          });
        } else {
          resolve(DEFAULT_SETTINGS[key]);
        }
      } catch (error) {
        console.warn(`SettingsUtils: Error getting setting "${key}":`, error);
        resolve(DEFAULT_SETTINGS[key]);
      }
    });
  };

  /**
   * Get multiple settings
   */
  const getSettings = (keys) => {
    return new Promise((resolve) => {
      try {
        if (!isExtensionContextValid()) {
          const result = {};
          keys.forEach(key => {
            result[key] = DEFAULT_SETTINGS[key];
          });
          resolve(result);
          return;
        }

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(keys, (result) => {
            const validated = {};
            keys.forEach(key => {
              const value = result[key] !== undefined ? result[key] : DEFAULT_SETTINGS[key];
              validated[key] = validateSetting(key, value);
            });
            resolve(validated);
          });
        } else {
          const result = {};
          keys.forEach(key => {
            result[key] = DEFAULT_SETTINGS[key];
          });
          resolve(result);
        }
      } catch (error) {
        console.warn('SettingsUtils: Error getting settings:', error);
        const result = {};
        keys.forEach(key => {
          result[key] = DEFAULT_SETTINGS[key];
        });
        resolve(result);
      }
    });
  };

  /**
   * Reset settings to defaults
   */
  const resetSettings = () => {
    return new Promise((resolve, reject) => {
      try {
        if (!isExtensionContextValid()) {
          reject(new Error('Extension context invalid'));
          return;
        }

        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.clear(() => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(DEFAULT_SETTINGS);
            }
          });
        } else {
          reject(new Error('chrome.storage not available'));
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Get validation rules for a setting
   */
  const getValidationRule = (key) => VALIDATION_RULES[key];

  /**
   * Get all default settings
   */
  const getDefaultSettings = () => ({ ...DEFAULT_SETTINGS });

  /**
   * Public API
   */
  return {
    loadSettings,
    saveSetting,
    saveSettings,
    getSetting,
    getSettings,
    resetSettings,
    validateSetting,
    validateSettings,
    migrateSettings,
    getValidationRule,
    getDefaultSettings,
    DEFAULT_SETTINGS,
    isExtensionContextValid
  };
})();
