/**
 * Date Utilities - Thin wrapper around Luxon
 *
 * Luxon does the heavy lifting. This just provides:
 * - getUserDateFormat() for reading settings
 * - parseAndFormat() convenience function
 * - isNonDateString() to skip non-date values
 *
 * For advanced usage, access luxon.DateTime directly.
 * Docs: https://moment.github.io/luxon/
 */

window.DateFormattingUtils = (() => {
  'use strict';

  const DateTime = window.luxon?.DateTime;

  // Strings that are not dates
  const NON_DATE_STRINGS = ['release date', 'release dates', 'date', 'dates', 'year', 'runtime', 'duration', 'n/a', 'tba', 'tbd', 'unknown', '-'];

  // Our format strings -> Luxon tokens
  const FORMATS = {
    'DD MMM YYYY': 'dd LLL yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MMM DD, YYYY': 'LLL dd, yyyy',
    'MMMM DD, YYYY': 'LLLL dd, yyyy'
  };

  const isNonDateString = (s) => !s || typeof s !== 'string' || NON_DATE_STRINGS.includes(s.trim().toLowerCase()) || s.length < 3;

  const looksLikeDate = (s) => !isNonDateString(s) && /\d{4}|\d{1,2}[\/\-\s][A-Za-z\d]/.test(s);

  function parseDate(str) {
    if (!DateTime || isNonDateString(str)) return null;
    str = str.trim();

    // Extract ISO from parens: "(2017-12-09)"
    const iso = str.match(/\((\d{4}-\d{2}-\d{2})\)/);
    if (iso) { const d = DateTime.fromISO(iso[1]); if (d.isValid) return d; }

    // Try ISO
    let d = DateTime.fromISO(str);
    if (d.isValid) return d;

    // Try common formats
    for (const fmt of ['d LLLL yyyy', 'd LLL yyyy', 'LLLL d, yyyy', 'LLL d, yyyy', 'd-LLL-yyyy', 'MM/dd/yyyy', 'dd/MM/yyyy']) {
      d = DateTime.fromFormat(str, fmt);
      if (d.isValid) return d;
    }

    // Extract from complex string
    let m = str.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) { d = DateTime.fromISO(m[1]); if (d.isValid) return d; }

    m = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (m) {
      d = DateTime.fromFormat(`${m[1]} ${m[2]}, ${m[3]}`, 'LLLL d, yyyy');
      if (d.isValid) return d;
      d = DateTime.fromFormat(`${m[1]} ${m[2]}, ${m[3]}`, 'LLL d, yyyy');
      if (d.isValid) return d;
    }

    return null;
  }

  function parseAndFormat(str, format) {
    const dt = parseDate(str);
    if (!dt) {
      if (str && !isNonDateString(str)) console.log(`DateUtils: Could not parse "${str.substring(0, 40)}"`);
      return null;
    }
    return dt.toFormat(FORMATS[format] || FORMATS['DD MMM YYYY']);
  }

  /**
   * Get user's preferred date format based on context.
   * Resolution order: field > view > global default > legacy fallback
   *
   * @param {Object} context - Optional context for format resolution
   * @param {string} context.view - View name: 'imdb', 'wikipedia', 'hotstar', 'consolidated', 'comparison'
   * @param {string} context.field - Field name: 'Release Dates', 'Air Date', 'Birth Date', etc.
   * @returns {Promise<string>} The date format string
   */
  function getUserDateFormat(context = {}) {
    return new Promise(resolve => {
      const DEFAULT = 'DD MMM YYYY';
      const { view, field } = context;

      try {
        if (chrome?.storage?.sync) {
          chrome.storage.sync.get([
            'dateFormatDefault',
            'dateFormatByView',
            'dateFormatByField',
            'hotstarDateFormat' // Legacy fallback
          ], r => {
            if (chrome.runtime.lastError) {
              resolve(DEFAULT);
              return;
            }

            // Priority 1: Field-specific format (highest priority)
            if (field && r.dateFormatByField && r.dateFormatByField[field]) {
              resolve(r.dateFormatByField[field]);
              return;
            }

            // Priority 2: View-specific format
            if (view && r.dateFormatByView && r.dateFormatByView[view]) {
              resolve(r.dateFormatByView[view]);
              return;
            }

            // Priority 3: Global default (new setting)
            if (r.dateFormatDefault) {
              resolve(r.dateFormatDefault);
              return;
            }

            // Priority 4: Legacy fallback
            resolve(r.hotstarDateFormat || DEFAULT);
          });
        } else {
          resolve(DEFAULT);
        }
      } catch {
        resolve(DEFAULT);
      }
    });
  }

  return { parseDate, parseAndFormat, looksLikeDate, isNonDateString, getUserDateFormat, DateTime };
})();
