/**
 * Scheduler Storage Utilities
 * Handles storage operations for custom bookmarklets and scheduled tasks
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'customBookmarklets';
  const SCHEDULED_TASKS_KEY = 'scheduledTasks';

  /**
   * Check if extension context is valid
   */
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generate a unique bookmarklet ID
   */
  function generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `bm_${timestamp}_${random}`;
  }

  /**
   * Get all bookmarklets from storage
   * @returns {Promise<Object>} Map of bookmarklet IDs to bookmarklet objects
   */
  async function getAllBookmarklets() {
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalid');
      return {};
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading bookmarklets:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result[STORAGE_KEY] || {});
      });
    });
  }

  /**
   * Get a single bookmarklet by ID
   * @param {string} id - Bookmarklet ID
   * @returns {Promise<Object|null>} Bookmarklet object or null
   */
  async function getBookmarklet(id) {
    const bookmarklets = await getAllBookmarklets();
    return bookmarklets[id] || null;
  }

  /**
   * Save a bookmarklet (create or update)
   * @param {Object} bookmarklet - Bookmarklet object
   * @returns {Promise<Object>} Saved bookmarklet with ID
   */
  async function saveBookmarklet(bookmarklet) {
    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalid');
    }

    const bookmarklets = await getAllBookmarklets();
    const now = Date.now();

    // Generate ID for new bookmarklets
    if (!bookmarklet.id) {
      bookmarklet.id = generateId();
      bookmarklet.createdAt = now;
      bookmarklet.executionCount = 0;
      bookmarklet.lastExecuted = null;
    }

    // Update timestamp
    bookmarklet.updatedAt = now;

    // Ensure defaults
    bookmarklet.enabled = bookmarklet.enabled !== false;
    bookmarklet.autoRun = bookmarklet.autoRun === true;
    bookmarklet.schedule = bookmarklet.schedule || { type: 'none', config: {} };

    // Save to storage
    bookmarklets[bookmarklet.id] = bookmarklet;

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: bookmarklets }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(bookmarklet);
      });
    });
  }

  /**
   * Delete a bookmarklet by ID
   * @param {string} id - Bookmarklet ID
   * @returns {Promise<boolean>} Success status
   */
  async function deleteBookmarklet(id) {
    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalid');
    }

    const bookmarklets = await getAllBookmarklets();

    if (!bookmarklets[id]) {
      return false;
    }

    delete bookmarklets[id];

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: bookmarklets }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(true);
      });
    });
  }

  /**
   * Update bookmarklet execution statistics
   * @param {string} id - Bookmarklet ID
   * @returns {Promise<void>}
   */
  async function updateBookmarkletStats(id) {
    const bookmarklet = await getBookmarklet(id);
    if (!bookmarklet) return;

    bookmarklet.lastExecuted = Date.now();
    bookmarklet.executionCount = (bookmarklet.executionCount || 0) + 1;

    await saveBookmarklet(bookmarklet);
  }

  /**
   * Get all scheduled tasks
   * @returns {Promise<Object>} Map of alarm names to task info
   */
  async function getScheduledTasks() {
    if (!isExtensionContextValid()) {
      return {};
    }

    return new Promise((resolve) => {
      chrome.storage.local.get([SCHEDULED_TASKS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading scheduled tasks:', chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(result[SCHEDULED_TASKS_KEY] || {});
      });
    });
  }

  /**
   * Save a scheduled task
   * @param {string} alarmName - Chrome alarm name
   * @param {string} bookmarkletId - Associated bookmarklet ID
   * @param {number} nextRun - Next run timestamp
   * @returns {Promise<void>}
   */
  async function saveScheduledTask(alarmName, bookmarkletId, nextRun) {
    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalid');
    }

    const tasks = await getScheduledTasks();

    tasks[alarmName] = {
      bookmarkletId,
      alarmName,
      nextRun,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [SCHEDULED_TASKS_KEY]: tasks }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Remove a scheduled task
   * @param {string} alarmName - Chrome alarm name
   * @returns {Promise<void>}
   */
  async function removeScheduledTask(alarmName) {
    if (!isExtensionContextValid()) {
      return;
    }

    const tasks = await getScheduledTasks();

    if (!tasks[alarmName]) {
      return;
    }

    delete tasks[alarmName];

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [SCHEDULED_TASKS_KEY]: tasks }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get scheduled tasks for a specific bookmarklet
   * @param {string} bookmarkletId - Bookmarklet ID
   * @returns {Promise<Array>} Array of task objects
   */
  async function getTasksForBookmarklet(bookmarkletId) {
    const tasks = await getScheduledTasks();
    return Object.values(tasks).filter(task => task.bookmarkletId === bookmarkletId);
  }

  /**
   * Remove all scheduled tasks for a bookmarklet
   * @param {string} bookmarkletId - Bookmarklet ID
   * @returns {Promise<void>}
   */
  async function removeTasksForBookmarklet(bookmarkletId) {
    const tasks = await getScheduledTasks();
    const updatedTasks = {};

    for (const [alarmName, task] of Object.entries(tasks)) {
      if (task.bookmarkletId !== bookmarkletId) {
        updatedTasks[alarmName] = task;
      }
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [SCHEDULED_TASKS_KEY]: updatedTasks }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Import bookmarklets from browser bookmarks
   * @param {Array} bookmarks - Array of browser bookmark objects with url and title
   * @returns {Promise<Array>} Array of created bookmarklet objects
   */
  async function importFromBrowserBookmarks(bookmarks) {
    const imported = [];

    for (const bookmark of bookmarks) {
      if (!bookmark.url || !bookmark.url.startsWith('javascript:')) {
        continue;
      }

      // Parse the javascript: URL
      let code = bookmark.url.slice(11); // Remove 'javascript:'

      // Decode URI components (bookmarklets are often encoded)
      try {
        // Try decoding up to 3 times for triple-encoded bookmarklets
        for (let i = 0; i < 3; i++) {
          const decoded = decodeURIComponent(code);
          if (decoded === code) break;
          code = decoded;
        }
      } catch (e) {
        // Keep original if decoding fails
      }

      const newBookmarklet = {
        name: bookmark.title || 'Imported Bookmarklet',
        description: `Imported from browser bookmarks`,
        code: code,
        schedule: { type: 'none', config: {} },
        autoRun: false,
        enabled: true
      };

      const saved = await saveBookmarklet(newBookmarklet);
      imported.push(saved);
    }

    return imported;
  }

  /**
   * Export bookmarklets as JSON
   * @returns {Promise<string>} JSON string of all bookmarklets
   */
  async function exportBookmarklets() {
    const bookmarklets = await getAllBookmarklets();
    return JSON.stringify(bookmarklets, null, 2);
  }

  /**
   * Import bookmarklets from JSON
   * @param {string} json - JSON string of bookmarklets
   * @returns {Promise<number>} Number of imported bookmarklets
   */
  async function importBookmarklets(json) {
    const data = JSON.parse(json);
    let count = 0;

    for (const bookmarklet of Object.values(data)) {
      // Remove ID to create new entries
      delete bookmarklet.id;
      delete bookmarklet.createdAt;
      delete bookmarklet.updatedAt;

      await saveBookmarklet(bookmarklet);
      count++;
    }

    return count;
  }

  // Expose API
  window.BookmarkletStorage = {
    generateId,
    getAllBookmarklets,
    getBookmarklet,
    saveBookmarklet,
    deleteBookmarklet,
    updateBookmarkletStats,
    getScheduledTasks,
    saveScheduledTask,
    removeScheduledTask,
    getTasksForBookmarklet,
    removeTasksForBookmarklet,
    importFromBrowserBookmarks,
    exportBookmarklets,
    importBookmarklets,
    isExtensionContextValid
  };

})();
