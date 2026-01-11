/**
 * Bookmarklet Scheduler
 * Handles chrome.alarms for scheduled bookmarklet execution
 * This file is loaded by the background script
 */

const BookmarkletScheduler = {
  ALARM_PREFIX: 'bm_',

  /**
   * Schedule a bookmarklet based on its schedule configuration
   * @param {Object} bookmarklet - Bookmarklet object with schedule
   * @returns {Promise<void>}
   */
  async scheduleBookmarklet(bookmarklet) {
    if (!bookmarklet || !bookmarklet.id || !bookmarklet.schedule) {
      return;
    }

    // Clear any existing alarms for this bookmarklet
    await this.cancelSchedule(bookmarklet.id);

    // Don't schedule if disabled
    if (!bookmarklet.enabled) {
      return;
    }

    const { type, config } = bookmarklet.schedule;

    switch (type) {
      case 'one-time':
        await this.scheduleOneTime(bookmarklet.id, config.datetime);
        break;

      case 'recurring':
        await this.scheduleRecurring(bookmarklet.id, config);
        break;

      case 'interval':
        await this.scheduleInterval(bookmarklet.id, config.intervalMinutes);
        break;

      case 'domain':
        // Domain triggers are handled by domain-trigger.js content script
        // No alarm needed here
        break;
    }
  },

  /**
   * Schedule a one-time alarm
   * @param {string} bookmarkletId - Bookmarklet ID
   * @param {number} datetime - Unix timestamp when to execute
   * @returns {Promise<string>} Alarm name
   */
  async scheduleOneTime(bookmarkletId, datetime) {
    if (!datetime || datetime <= Date.now()) {
      console.log('One-time schedule datetime is in the past, skipping');
      return null;
    }

    const alarmName = `${this.ALARM_PREFIX}onetime_${bookmarkletId}`;

    await chrome.alarms.create(alarmName, { when: datetime });

    // Save to storage for reference
    await this.saveScheduledTask(alarmName, bookmarkletId, datetime);

    console.log(`Scheduled one-time alarm: ${alarmName} at ${new Date(datetime).toISOString()}`);
    return alarmName;
  },

  /**
   * Schedule a recurring alarm (daily or weekly)
   * @param {string} bookmarkletId - Bookmarklet ID
   * @param {Object} config - Recurring config {frequency, time, days}
   * @returns {Promise<string>} Alarm name
   */
  async scheduleRecurring(bookmarkletId, config) {
    const alarmName = `${this.ALARM_PREFIX}recurring_${bookmarkletId}`;
    const nextRun = this.calculateNextRun(config);

    if (!nextRun) {
      console.log('Could not calculate next run time for recurring schedule');
      return null;
    }

    if (config.frequency === 'daily') {
      // Daily: use periodInMinutes
      await chrome.alarms.create(alarmName, {
        when: nextRun,
        periodInMinutes: 24 * 60 // 24 hours
      });
    } else {
      // Weekly: create single alarm, will be recreated after each fire
      await chrome.alarms.create(alarmName, { when: nextRun });
    }

    await this.saveScheduledTask(alarmName, bookmarkletId, nextRun);

    console.log(`Scheduled recurring alarm: ${alarmName}, next run at ${new Date(nextRun).toISOString()}`);
    return alarmName;
  },

  /**
   * Schedule an interval-based alarm
   * @param {string} bookmarkletId - Bookmarklet ID
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Promise<string>} Alarm name
   */
  async scheduleInterval(bookmarkletId, intervalMinutes) {
    if (!intervalMinutes || intervalMinutes < 1) {
      console.log('Invalid interval minutes');
      return null;
    }

    const alarmName = `${this.ALARM_PREFIX}interval_${bookmarkletId}`;

    // Chrome requires minimum 1 minute for alarms
    const safeInterval = Math.max(1, intervalMinutes);

    await chrome.alarms.create(alarmName, {
      delayInMinutes: safeInterval,
      periodInMinutes: safeInterval
    });

    const nextRun = Date.now() + (safeInterval * 60 * 1000);
    await this.saveScheduledTask(alarmName, bookmarkletId, nextRun);

    console.log(`Scheduled interval alarm: ${alarmName}, every ${safeInterval} minutes`);
    return alarmName;
  },

  /**
   * Cancel all scheduled alarms for a bookmarklet
   * @param {string} bookmarkletId - Bookmarklet ID
   * @returns {Promise<void>}
   */
  async cancelSchedule(bookmarkletId) {
    const alarmNames = [
      `${this.ALARM_PREFIX}onetime_${bookmarkletId}`,
      `${this.ALARM_PREFIX}recurring_${bookmarkletId}`,
      `${this.ALARM_PREFIX}interval_${bookmarkletId}`
    ];

    for (const name of alarmNames) {
      try {
        await chrome.alarms.clear(name);
        await this.removeScheduledTask(name);
      } catch (e) {
        // Ignore errors for non-existent alarms
      }
    }

    console.log(`Cancelled schedules for bookmarklet: ${bookmarkletId}`);
  },

  /**
   * Calculate next run time for recurring schedules
   * @param {Object} config - {frequency, time, days}
   * @returns {number} Unix timestamp of next run
   */
  calculateNextRun(config) {
    if (!config.time) return null;

    const [hours, minutes] = config.time.split(':').map(Number);
    const now = new Date();

    let target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    // If time has passed today, start from tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    // For weekly, find next valid day
    if (config.frequency === 'weekly' && config.days && config.days.length > 0) {
      let attempts = 0;
      while (!config.days.includes(target.getDay()) && attempts < 7) {
        target.setDate(target.getDate() + 1);
        attempts++;
      }

      if (attempts >= 7) {
        console.log('No valid days found for weekly schedule');
        return null;
      }
    }

    return target.getTime();
  },

  /**
   * Handle an alarm firing
   * @param {chrome.alarms.Alarm} alarm - Chrome alarm object
   * @returns {Promise<void>}
   */
  async handleAlarm(alarm) {
    if (!alarm.name.startsWith(this.ALARM_PREFIX)) {
      return; // Not our alarm
    }

    console.log('Bookmarklet alarm fired:', alarm.name);

    // Extract bookmarklet ID from alarm name
    const parts = alarm.name.split('_');
    // Format: bm_type_id (e.g., bm_onetime_bm_1234567890_abc)
    const bookmarkletId = parts.slice(2).join('_');

    // Load bookmarklet data
    const data = await chrome.storage.local.get(['customBookmarklets']);
    const bookmarklet = data.customBookmarklets?.[bookmarkletId];

    if (!bookmarklet) {
      console.log('Bookmarklet not found:', bookmarkletId);
      await this.cancelSchedule(bookmarkletId);
      return;
    }

    if (!bookmarklet.enabled) {
      console.log('Bookmarklet is disabled:', bookmarkletId);
      return;
    }

    // Check domain filter if present
    const config = bookmarklet.schedule?.config || {};
    if (config.domains && config.domains.length > 0) {
      const shouldExecute = await this.checkDomainFilter(config.domains, config.onlyWhenActive);
      if (!shouldExecute) {
        console.log('Domain filter not matched, skipping execution');
        return;
      }
    }

    // Check if interval requires active tab
    if (bookmarklet.schedule?.type === 'interval' && config.onlyWhenActive) {
      const activeTab = await this.getActiveTab();
      if (!activeTab) {
        console.log('No active tab, skipping interval execution');
        return;
      }
    }

    // Execute the bookmarklet
    await this.executeBookmarklet(bookmarklet);

    // For weekly recurring, reschedule next occurrence
    if (alarm.name.includes('recurring') && config.frequency === 'weekly') {
      const nextRun = this.calculateNextRun(config);
      if (nextRun) {
        await chrome.alarms.create(alarm.name, { when: nextRun });
        await this.saveScheduledTask(alarm.name, bookmarkletId, nextRun);
        console.log(`Rescheduled weekly alarm for ${new Date(nextRun).toISOString()}`);
      }
    }

    // For one-time, clean up
    if (alarm.name.includes('onetime')) {
      await this.removeScheduledTask(alarm.name);
      // Update bookmarklet to clear schedule
      bookmarklet.schedule = { type: 'none', config: {} };
      const allBookmarklets = data.customBookmarklets || {};
      allBookmarklets[bookmarkletId] = bookmarklet;
      await chrome.storage.local.set({ customBookmarklets: allBookmarklets });
    }
  },

  /**
   * Execute a bookmarklet in the active tab
   * @param {Object} bookmarklet - Bookmarklet object
   * @returns {Promise<void>}
   */
  async executeBookmarklet(bookmarklet) {
    const activeTab = await this.getActiveTab();

    if (!activeTab) {
      console.log('No active tab found for bookmarklet execution');
      return;
    }

    // Skip chrome:// and edge:// URLs
    if (activeTab.url?.startsWith('chrome://') ||
        activeTab.url?.startsWith('edge://') ||
        activeTab.url?.startsWith('chrome-extension://')) {
      console.log('Cannot execute on browser internal pages');
      return;
    }

    if (bookmarklet.autoRun) {
      // Execute immediately
      await this.executeInTab(activeTab.id, bookmarklet.code, bookmarklet.name);

      // Update stats
      await this.updateBookmarkletStats(bookmarklet.id);
    } else {
      // Show confirmation in the tab
      await this.showConfirmationDialog(activeTab.id, bookmarklet);
    }
  },

  /**
   * Execute code in a tab
   * @param {number} tabId - Tab ID
   * @param {string} code - JavaScript code
   * @param {string} title - Bookmarklet title
   * @returns {Promise<Object>} Execution result
   */
  async executeInTab(tabId, code, title) {
    try {
      // Use the existing executeBookmarkletInTab function from background.js
      // This is called from within background.js context
      if (typeof executeBookmarkletInTab === 'function') {
        return await executeBookmarkletInTab(tabId, code, title);
      }

      // Fallback: direct scripting
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: (jsCode) => {
          try {
            const fn = new Function(jsCode);
            fn();
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
        args: [code],
        world: 'MAIN'
      });

      return result[0]?.result || { success: false, error: 'No result' };
    } catch (error) {
      console.error('Error executing bookmarklet in tab:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Show confirmation dialog in a tab
   * @param {number} tabId - Tab ID
   * @param {Object} bookmarklet - Bookmarklet object
   * @returns {Promise<void>}
   */
  async showConfirmationDialog(tabId, bookmarklet) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (bm) => {
          // Remove existing dialog
          const existing = document.getElementById('ml-bm-confirm-dialog');
          if (existing) existing.remove();

          // Create dialog
          const dialog = document.createElement('div');
          dialog.id = 'ml-bm-confirm-dialog';
          dialog.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2147483647;
            background: #1f2937;
            color: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            max-width: 350px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          `;

          dialog.innerHTML = `
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">
              Run Scheduled Bookmarklet?
            </div>
            <div style="font-size: 14px; margin-bottom: 4px;">
              ${bm.name}
            </div>
            <div style="font-size: 12px; color: #9ca3af; margin-bottom: 16px;">
              ${bm.description || 'No description'}
            </div>
            <div style="display: flex; gap: 10px;">
              <button id="ml-bm-run" style="flex: 1; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Run
              </button>
              <button id="ml-bm-cancel" style="flex: 1; padding: 10px; background: transparent; color: #f9fafb; border: 1px solid #374151; border-radius: 6px; cursor: pointer;">
                Cancel
              </button>
            </div>
          `;

          document.body.appendChild(dialog);

          // Handle buttons
          document.getElementById('ml-bm-run').addEventListener('click', () => {
            dialog.remove();
            // Send message to background to execute
            chrome.runtime.sendMessage({
              type: 'executeConfirmedBookmarklet',
              bookmarkletId: bm.id,
              code: bm.code,
              title: bm.name
            });
          });

          document.getElementById('ml-bm-cancel').addEventListener('click', () => {
            dialog.remove();
          });

          // Auto-dismiss after 30 seconds
          setTimeout(() => {
            if (document.getElementById('ml-bm-confirm-dialog')) {
              dialog.remove();
            }
          }, 30000);
        },
        args: [{
          id: bookmarklet.id,
          name: bookmarklet.name,
          description: bookmarklet.description,
          code: bookmarklet.code
        }]
      });
    } catch (error) {
      console.error('Error showing confirmation dialog:', error);
    }
  },

  /**
   * Check if current active tab matches domain filter
   * @param {Array} domains - Domain patterns to match
   * @param {boolean} onlyWhenActive - Only check active tab
   * @returns {Promise<boolean>}
   */
  async checkDomainFilter(domains, onlyWhenActive = true) {
    const activeTab = await this.getActiveTab();

    if (!activeTab || !activeTab.url) {
      return false;
    }

    try {
      const url = new URL(activeTab.url);
      const hostname = url.hostname.toLowerCase();
      const fullUrl = activeTab.url.toLowerCase();

      return domains.some(pattern => {
        const p = pattern.toLowerCase();

        // Check if pattern includes path
        const isUrlPattern = p.includes('/') && !p.startsWith('*://');
        const matchTarget = isUrlPattern ? fullUrl : hostname;

        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
          // *keyword* pattern
          const keyword = p.slice(1, -1);
          return matchTarget.includes(keyword);
        } else if (p.startsWith('*')) {
          // *.example.com pattern
          const suffix = p.slice(1);
          return matchTarget.endsWith(suffix);
        } else if (p.endsWith('*')) {
          // example.* pattern
          const prefix = p.slice(0, -1);
          return matchTarget.startsWith(prefix);
        } else {
          // Exact match or subdomain
          return hostname === p || hostname.endsWith('.' + p);
        }
      });
    } catch (e) {
      return false;
    }
  },

  /**
   * Get the currently active tab
   * @returns {Promise<chrome.tabs.Tab|null>}
   */
  async getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Update bookmarklet execution statistics
   * @param {string} bookmarkletId - Bookmarklet ID
   * @returns {Promise<void>}
   */
  async updateBookmarkletStats(bookmarkletId) {
    try {
      const data = await chrome.storage.local.get(['customBookmarklets']);
      const bookmarklets = data.customBookmarklets || {};
      const bookmarklet = bookmarklets[bookmarkletId];

      if (bookmarklet) {
        bookmarklet.lastExecuted = Date.now();
        bookmarklet.executionCount = (bookmarklet.executionCount || 0) + 1;
        await chrome.storage.local.set({ customBookmarklets: bookmarklets });
      }
    } catch (e) {
      console.error('Error updating bookmarklet stats:', e);
    }
  },

  /**
   * Save scheduled task to storage
   * @param {string} alarmName - Chrome alarm name
   * @param {string} bookmarkletId - Bookmarklet ID
   * @param {number} nextRun - Next run timestamp
   * @returns {Promise<void>}
   */
  async saveScheduledTask(alarmName, bookmarkletId, nextRun) {
    try {
      const data = await chrome.storage.local.get(['scheduledTasks']);
      const tasks = data.scheduledTasks || {};

      tasks[alarmName] = {
        bookmarkletId,
        alarmName,
        nextRun,
        createdAt: Date.now()
      };

      await chrome.storage.local.set({ scheduledTasks: tasks });
    } catch (e) {
      console.error('Error saving scheduled task:', e);
    }
  },

  /**
   * Remove scheduled task from storage
   * @param {string} alarmName - Chrome alarm name
   * @returns {Promise<void>}
   */
  async removeScheduledTask(alarmName) {
    try {
      const data = await chrome.storage.local.get(['scheduledTasks']);
      const tasks = data.scheduledTasks || {};

      if (tasks[alarmName]) {
        delete tasks[alarmName];
        await chrome.storage.local.set({ scheduledTasks: tasks });
      }
    } catch (e) {
      console.error('Error removing scheduled task:', e);
    }
  },

  /**
   * Initialize all schedules from storage
   * Called when extension starts/restarts
   * @returns {Promise<void>}
   */
  async initializeSchedules() {
    try {
      const data = await chrome.storage.local.get(['customBookmarklets']);
      const bookmarklets = data.customBookmarklets || {};

      for (const bookmarklet of Object.values(bookmarklets)) {
        if (bookmarklet.enabled && bookmarklet.schedule?.type !== 'none') {
          await this.scheduleBookmarklet(bookmarklet);
        }
      }

      console.log('Initialized bookmarklet schedules');
    } catch (e) {
      console.error('Error initializing schedules:', e);
    }
  }
};

// Export for use in background.js
if (typeof self !== 'undefined') {
  self.BookmarkletScheduler = BookmarkletScheduler;
}
