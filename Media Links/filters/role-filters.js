/**
 * Role Filters Configuration
 *
 * This file defines which role types should hide/show the "Role / Character" column
 * in customized views, and which specific roles should be filtered out.
 *
 * USAGE:
 * - Import/reference this when building customized views
 * - When roleType is in HIDE_ROLE_COLUMN, hide the "Role / Character" column
 * - Use EXCLUDED_ROLES to filter out entries with specific role values
 * - All other role types show the "Role / Character" column by default
 *
 * REFERENCED BY:
 * - customized-views.js
 * - imdb-customized-views.js
 * - wiki-customized-views.js
 * - consolidated-view-page.js
 */

(function() {
  'use strict';

  /**
   * EXCLUDED ROLES
   *
   * Role values that should be filtered out for specific role types.
   * Key: roleType (e.g., 'Directors')
   * Value: Array of role patterns to exclude (case-insensitive, partial match)
   *
   * Example: Directors with role "ending sequence" will be filtered out
   */
  const EXCLUDED_ROLES = {
    'Directors': [
      'ending sequence',
      'opening',
      'episode director'
    ],
    'Producers': [
      'assistant producer',
      'planning',
      'animation producer'
    ],
    'Writers': [
      'composition',
      'head writer',
      'comedy writer'
    ]
  };

  /**
   * PRODUCER-ONLY TITLES
   *
   * If a Producer's role contains ONLY these titles (separated by /),
   * they should be filtered out. These are generic producer titles
   * without additional meaningful context.
   *
   * Example: "producer / co-producer" -> filtered out
   * Example: "producer / writer" -> NOT filtered (has non-producer role)
   */
  const PRODUCER_ONLY_TITLES = [
    'producer',
    'executive producer',
    'co-executive producer',
    'co-producer',
    'associate producer',
    'line producer',
    'supervising producer',
    'consulting producer',
    'coordinating producer'
  ];

  /**
   * SCREENPLAY-ONLY TITLES
   *
   * For Writers Screenplay, if a writer's role is ONLY one of these titles
   * (single role, not combined with others), they should be filtered out.
   * These indicate adaptation work rather than original screenplay writing.
   *
   * Example: "adapted screenplay" -> filtered out (single role)
   * Example: "screenplay / adapted screenplay" -> NOT filtered (has multiple roles)
   * Example: "screenplay" -> NOT filtered (original work)
   */
  const SCREENPLAY_ONLY_EXCLUDED = [
    'adapted screenplay',
    'adaptation'
  ];

  /**
   * HIDE ROLE COLUMN
   *
   * Role types where the "Role / Character" column should be HIDDEN.
   * These are metadata fields where the "role" column has no meaningful data.
   *
   * NOTE: Most role types (Directors, Producers, Cast, etc.) SHOULD show the role column
   * because they may contain additional details (e.g., "Co-Director", "Executive Producer",
   * character names, etc.)
   */
  const HIDE_ROLE_COLUMN = [
    'Runtime',
    'Countries',
    'Languages'
  ];

  /**
   * All known role types for reference.
   * Most of these SHOW the role column because the role field contains useful info:
   * - Cast: character names
   * - Directors: directing credits (e.g., "Co-Director", "Second Unit")
   * - Producers: producer type (e.g., "Executive Producer", "Co-Producer")
   * - Writers: writing credits (e.g., "Screenplay", "Story")
   * - Production Companies: company role
   * - Release Date: actual date value
   */
  const ALL_ROLE_TYPES = [
    'Cast',
    'Directors',
    'Producers',
    'Executive Producers',
    'Writers',
    'Writers Screenplay',
    'Creators',
    'Production Companies',
    'Runtime',
    'Countries',
    'Languages',
    'Release Date'
  ];

  /**
   * Check if the "Role / Character" column should be shown for a given role type
   *
   * @param {string} roleType - The role type to check (e.g., 'Directors', 'Cast')
   * @returns {boolean} - true if role column should be shown, false if hidden
   */
  function shouldShowRoleColumn(roleType) {
    // Only hide for specific metadata fields
    if (HIDE_ROLE_COLUMN.includes(roleType)) {
      return false;
    }

    // Default: show the column (most role types have useful role data)
    return true;
  }

  /**
   * Get the appropriate columns for a given role type
   *
   * @param {string} roleType - The role type to get columns for
   * @returns {string[]} - Array of column names to display
   */
  function getColumnsForRoleType(roleType) {
    if (shouldShowRoleColumn(roleType)) {
      return ['name', 'role'];
    } else {
      return ['name'];
    }
  }

  /**
   * Check if a Producer role contains ONLY generic producer titles
   * Only filters out when there are MULTIPLE producer titles (e.g., "producer / co-producer")
   * A single "Producer" role is kept (it's the default when no specific role is provided)
   *
   * @param {string} roleValue - The role value (e.g., "producer / co-producer")
   * @returns {boolean} - true if role contains only producer titles AND has multiple parts
   */
  function isProducerOnlyRole(roleValue) {
    if (!roleValue) return false;

    // Split by / and trim each part
    const parts = roleValue.split('/').map(part => part.trim().toLowerCase()).filter(part => part.length > 0);

    // Only filter if there are multiple parts (e.g., "producer / co-producer")
    // Single "Producer" entries should be kept
    if (parts.length <= 1) {
      return false;
    }

    // Check if ALL parts are producer-only titles
    return parts.every(part => {
      return PRODUCER_ONLY_TITLES.some(title => title.toLowerCase() === part);
    });
  }

  /**
   * Check if a Writers Screenplay role is ONLY an excluded screenplay title
   * Filters out single-role entries like "adapted screenplay" but keeps
   * combined roles like "screenplay / adapted screenplay"
   *
   * @param {string} roleValue - The role value (e.g., "adapted screenplay")
   * @returns {boolean} - true if role is a single excluded screenplay title
   */
  function isExcludedScreenplayOnlyRole(roleValue) {
    if (!roleValue) return false;

    // Split by / and trim each part
    const parts = roleValue.split('/').map(part => part.trim().toLowerCase()).filter(part => part.length > 0);

    // Only filter if there's a SINGLE role that matches excluded titles
    // Multiple roles (e.g., "screenplay / adapted screenplay") should be kept
    if (parts.length !== 1) {
      return false;
    }

    // Check if the single role matches an excluded screenplay title
    return SCREENPLAY_ONLY_EXCLUDED.some(title => title.toLowerCase() === parts[0]);
  }

  /**
   * Check if a specific role value should be excluded for a given role type
   *
   * @param {string} roleType - The role type (e.g., 'Directors')
   * @param {string} roleValue - The role value to check (e.g., 'ending sequence')
   * @returns {boolean} - true if this role should be excluded, false otherwise
   */
  function shouldExcludeRole(roleType, roleValue) {
    // Special handling for Producers: exclude if role contains only producer titles
    if (roleType === 'Producers' && isProducerOnlyRole(roleValue)) {
      return true;
    }

    // Special handling for Writers Screenplay: exclude single-role "adapted screenplay" entries
    if (roleType === 'Writers Screenplay' && isExcludedScreenplayOnlyRole(roleValue)) {
      return true;
    }

    const excludedPatterns = EXCLUDED_ROLES[roleType];
    if (!excludedPatterns || !roleValue) {
      return false;
    }

    const lowerRole = roleValue.toLowerCase();
    return excludedPatterns.some(pattern => lowerRole.includes(pattern.toLowerCase()));
  }

  /**
   * Filter an array of items, removing those with excluded roles
   *
   * @param {Array} items - Array of items with roleType and role properties
   * @returns {Array} - Filtered array with excluded roles removed
   */
  function filterExcludedRoles(items) {
    if (!Array.isArray(items)) {
      return items;
    }

    return items.filter(item => {
      return !shouldExcludeRole(item.roleType, item.role);
    });
  }

  // Export to global scope
  window.RoleFilters = {
    EXCLUDED_ROLES,
    PRODUCER_ONLY_TITLES,
    SCREENPLAY_ONLY_EXCLUDED,
    HIDE_ROLE_COLUMN,
    ALL_ROLE_TYPES,
    shouldShowRoleColumn,
    getColumnsForRoleType,
    isProducerOnlyRole,
    isExcludedScreenplayOnlyRole,
    shouldExcludeRole,
    filterExcludedRoles
  };

})();
