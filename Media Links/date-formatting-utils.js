/**
 * Date Formatting Utilities
 * Shared utility functions for parsing, formatting, and copying dates across all views
 * Used by: Wikipedia customized views, IMDb customized views, IMDb consolidated views
 */

window.DateFormattingUtils = (() => {
  'use strict';

  // Month names for parsing and formatting
  const MONTH_NAMES = {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    lowercase: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  };

  /**
   * Parse a date string in various formats
   * Supports: "DD Month YYYY", "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", etc.
   * Returns a Date object or null if parsing fails
   *
   * NOTE: Dates like "10/11" are ambiguous (could be MM/DD or DD/MM).
   * Current logic: If first number > 12, interpret as DD/MM. Otherwise assume MM/DD (American format).
   * For unambiguous dates, use formats like "DD Month YYYY" or "YYYY-MM-DD" instead.
   */
  function parseDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const trimmed = dateString.trim();

    // Try parsing different common date formats
    // Order matters: More specific formats first, ambiguous formats last

    // Format 1: "25 Nov 2025" or "25 November 2025"
    let match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (match) {
      const [_, day, month, year] = match;
      const dayNum = parseInt(day, 10);
      const monthIndex = findMonthIndex(month);
      if (monthIndex !== -1 && dayNum >= 1 && dayNum <= 31) {
        return new Date(parseInt(year, 10), monthIndex, dayNum);
      }
    }

    // Format 2: "YYYY-MM-DD"
    match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const [_, year, month, day] = match;
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return new Date(parseInt(year, 10), monthNum - 1, dayNum);
      }
    }

    // Format 3 & 4: "MM/DD/YYYY" or "DD/MM/YYYY" (ambiguous)
    // Logic: If first number > 12, it must be day (DD/MM/YYYY)
    // Otherwise, assume MM/DD/YYYY (American format)
    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [_, first, second, year] = match;
      const firstNum = parseInt(first, 10);
      const secondNum = parseInt(second, 10);

      // If first number > 12, it must be day (DD/MM/YYYY format)
      if (firstNum > 12 && secondNum >= 1 && secondNum <= 12 && firstNum >= 1 && firstNum <= 31) {
        return new Date(parseInt(year, 10), secondNum - 1, firstNum);
      }
      // Otherwise assume MM/DD/YYYY (American format)
      if (firstNum >= 1 && firstNum <= 12 && secondNum >= 1 && secondNum <= 31) {
        return new Date(parseInt(year, 10), firstNum - 1, secondNum);
      }
    }

    // Format 5: "25-Nov-2025" or "25-November-2025"
    match = trimmed.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
    if (match) {
      const [_, day, month, year] = match;
      const dayNum = parseInt(day, 10);
      const monthIndex = findMonthIndex(month);
      if (monthIndex !== -1 && dayNum >= 1 && dayNum <= 31) {
        return new Date(parseInt(year, 10), monthIndex, dayNum);
      }
    }

    // Format 6: "Month DD, YYYY" (e.g., "November 25, 2025")
    match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (match) {
      const [_, month, day, year] = match;
      const dayNum = parseInt(day, 10);
      const monthIndex = findMonthIndex(month);
      if (monthIndex !== -1 && dayNum >= 1 && dayNum <= 31) {
        return new Date(parseInt(year, 10), monthIndex, dayNum);
      }
    }

    return null;
  }

  /**
   * Find month index from month name (short or long, case insensitive)
   */
  function findMonthIndex(monthStr) {
    const lower = monthStr.toLowerCase();

    // Check short months
    let index = MONTH_NAMES.short.findIndex(m => m.toLowerCase() === lower);
    if (index !== -1) return index;

    // Check long months
    index = MONTH_NAMES.long.findIndex(m => m.toLowerCase() === lower);
    if (index !== -1) return index;

    return -1;
  }

  /**
   * Format a Date object according to user's preference
   * Format options: 'DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD, YYYY'
   */
  function formatDate(date, format) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }

    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    const pad = (n) => String(n).padStart(2, '0');

    switch (format) {
      case 'DD MMM YYYY':
        return `${pad(day)} ${MONTH_NAMES.short[month]} ${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${pad(month + 1)}-${pad(day)}`;
      case 'MM/DD/YYYY':
        return `${pad(month + 1)}/${pad(day)}/${year}`;
      case 'DD/MM/YYYY':
        return `${pad(day)}/${pad(month + 1)}/${year}`;
      case 'MMM DD, YYYY':
        return `${MONTH_NAMES.short[month]} ${day}, ${year}`;
      default:
        // Default to DD MMM YYYY if format not recognized
        return `${pad(day)} ${MONTH_NAMES.short[month]} ${year}`;
    }
  }

  /**
   * Parse and reformat a date string
   * @param {string} dateString - Date string in any supported format
   * @param {string} outputFormat - Target format
   * @returns {string|null} - Formatted date string or null if parsing fails
   */
  function parseAndFormat(dateString, outputFormat) {
    const date = parseDate(dateString);
    if (!date) {
      return null;
    }
    return formatDate(date, outputFormat);
  }

  /**
   * Check if a string looks like it contains a date
   */
  function looksLikeDate(str) {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // Check for common date patterns
    const datePatterns = [
      /\d{1,2}\s+[A-Za-z]+\s+\d{4}/,        // DD Month YYYY
      /\d{4}-\d{1,2}-\d{1,2}/,              // YYYY-MM-DD
      /\d{1,2}\/\d{1,2}\/\d{4}/,            // MM/DD/YYYY or DD/MM/YYYY
      /[A-Za-z]+\s+\d{1,2},?\s+\d{4}/,     // Month DD, YYYY
    ];

    return datePatterns.some(pattern => pattern.test(str));
  }

  /**
   * Get user's preferred date format from settings
   * Falls back to 'DD MMM YYYY' if not set or on timeout
   */
  function getUserDateFormat() {
    return new Promise((resolve) => {
      const DEFAULT_FORMAT = 'DD MMM YYYY';
      let resolved = false;

      // Set timeout to prevent deadlock if storage fails
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('Storage timeout: using default date format');
          resolve(DEFAULT_FORMAT);
        }
      }, 1000);

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['hotstarDateFormat'], (result) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.warn('Storage error:', chrome.runtime.lastError);
                resolve(DEFAULT_FORMAT);
              } else {
                const format = result.hotstarDateFormat || DEFAULT_FORMAT;
                resolve(format);
              }
            }
          });
        } else {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(DEFAULT_FORMAT); // Chrome API not available
          }
        }
      } catch (e) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.warn('Error accessing storage:', e);
          resolve(DEFAULT_FORMAT);
        }
      }
    });
  }

  /**
   * Extract year from a string (e.g., "2024" from "Winner 2024")
   */
  function extractYear(str) {
    if (!str || typeof str !== 'string') {
      return null;
    }

    const match = str.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
  }

  /**
   * Public API
   */
  return {
    parseDate,
    formatDate,
    parseAndFormat,
    looksLikeDate,
    getUserDateFormat,
    extractYear,
    MONTH_NAMES
  };
})();
