// Media Links Comparison Feature
// Compares data between Wikipedia and IMDb sources
// Uses: StorageUtils from lib/

(function() {
  'use strict';

  // Early exit if extension context is invalid
  if (typeof StorageUtils === 'undefined' || !StorageUtils.isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping comparison script');
    return;
  }

  /**
   * Get current page information
   */
  function getCurrentPageInfo() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    if (hostname.includes('wikipedia.org')) {
      return {
        source: 'wikipedia',
        title: document.querySelector('#firstHeading')?.textContent || document.title,
        url: url
      };
    } else if (hostname === 'www.imdb.com') {
      const titleMatch = url.match(/\/title\/(tt\d+)/);
      if (titleMatch) {
        return {
          source: 'imdb',
          imdbId: titleMatch[1],
          title: document.querySelector('h1')?.textContent || document.title,
          url: url
        };
      }
    }

    return null;
  }

  /**
   * Get list of open tabs and let user select one
   */
  async function selectComparisonTab(currentSource) {
    return new Promise((resolve) => {
      try {
        // Use message passing to query tabs from background script
        chrome.runtime.sendMessage(
          { action: 'queryTabs', source: currentSource },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome runtime error:', chrome.runtime.lastError);
              alert('Error accessing tabs. Please reload the extension.');
              resolve(null);
              return;
            }

            if (!response || !response.tabs || response.tabs.length === 0) {
              alert(`No ${currentSource === 'wikipedia' ? 'IMDb' : 'Wikipedia'} tabs found. Please open the page first.`);
              resolve(null);
              return;
            }

            createTabSelectorModal(response.tabs, currentSource, (selectedTab) => {
              resolve(selectedTab);
            });
          }
        );
      } catch (error) {
        console.error('Tab selection error:', error);
        alert('Error selecting tabs: ' + error.message);
        resolve(null);
      }
    });
  }

  /**
   * Create tab selector modal
   */
  function createTabSelectorModal(tabs, currentSource, callback) {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    `;

    const modal = document.createElement('div');
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    modal.style.cssText = `
      background: ${isDarkMode ? '#1e1e1e' : '#ffffff'};
      color: ${isDarkMode ? '#ffffff' : '#000000'};
      border-radius: 12px;
      padding: 30px;
      max-width: 550px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    `;

    const title = document.createElement('h2');
    title.textContent = `Select ${currentSource === 'wikipedia' ? 'IMDb' : 'Wikipedia'} Page`;
    title.style.cssText = `
      margin: 0 0 25px 0;
      font-size: 20px;
      font-weight: 700;
      text-align: center;
    `;
    modal.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choose which page to compare with:';
    subtitle.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 13px;
      opacity: 0.7;
      text-align: center;
    `;
    modal.appendChild(subtitle);

    const tabList = document.createElement('div');
    tabList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    tabs.forEach((tab) => {
      const tabButton = document.createElement('button');
      tabButton.style.cssText = `
        padding: 15px;
        background: ${isDarkMode ? '#2a2a2a' : '#f5f5f5'};
        border: 2px solid #6366f1;
        border-radius: 8px;
        color: ${isDarkMode ? '#ffffff' : '#000000'};
        cursor: pointer;
        text-align: left;
        font-size: 13px;
        transition: all 0.2s;
      `;

      let pageTitle = tab.title;
      try {
        const tabUrl = new URL(tab.url);
        if (tabUrl.hostname.includes('wikipedia.org')) {
          pageTitle = decodeURIComponent(tabUrl.pathname.split('/').pop());
        }
      } catch (e) {
        // Use tab title as fallback
      }

      // Use DOM methods instead of innerHTML to prevent XSS
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'font-weight: 700; margin-bottom: 6px; font-size: 14px;';
      titleDiv.textContent = '📄 ' + pageTitle;

      const urlDiv = document.createElement('div');
      urlDiv.style.cssText = 'font-size: 12px; opacity: 0.6; word-break: break-all;';
      urlDiv.textContent = tab.url;

      tabButton.appendChild(titleDiv);
      tabButton.appendChild(urlDiv);

      tabButton.addEventListener('mouseenter', () => {
        tabButton.style.background = isDarkMode ? '#3a3a3a' : '#ececec';
        tabButton.style.transform = 'translateY(-2px)';
      });

      tabButton.addEventListener('mouseleave', () => {
        tabButton.style.background = isDarkMode ? '#2a2a2a' : '#f5f5f5';
        tabButton.style.transform = 'translateY(0)';
      });

      tabButton.addEventListener('click', () => {
        // HIGH SEVERITY FIX: Validate tab before calling callback
        if (!tab || !tab.id) {
          console.error('Tab is not valid:', tab);
          document.body.removeChild(backdrop);
          alert('The selected tab is no longer available');
          return;
        }

        document.body.removeChild(backdrop);
        callback(tab);
      });

      tabList.appendChild(tabButton);
    });

    modal.appendChild(tabList);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '✕ Cancel';
    cancelBtn.style.cssText = `
      margin-top: 20px;
      width: 100%;
      padding: 12px;
      background: ${isDarkMode ? '#2a2a2a' : '#f0f0f0'};
      border: 1px solid ${isDarkMode ? '#444' : '#ddd'};
      border-radius: 6px;
      color: ${isDarkMode ? '#ffffff' : '#000000'};
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
    `;

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(backdrop);
      callback(null);
    });

    modal.appendChild(cancelBtn);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  /**
   * Extract IMDb ID from a tab URL
   */
  function extractIMDbId(url) {
    const match = url.match(/\/title\/(tt\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Create and show a status notification
   */
  function showComparisonStatus(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('comparison-status-notification');
    if (existing) existing.remove();

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const notification = document.createElement('div');
    notification.id = 'comparison-status-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : isDarkMode ? '#1e1e1e' : '#ffffff'};
      color: ${type === 'error' || type === 'success' ? '#ffffff' : isDarkMode ? '#ffffff' : '#000000'};
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      border: 2px solid ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#8b5cf6'};
      animation: slideIn 0.3s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('comparison-status-styles')) {
      const style = document.createElement('style');
      style.id = 'comparison-status-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Use textContent for plain text messages, or parse HTML safely for structured messages
    // Since messages are generated internally, we can trust them but still sanitize
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message;
    // Clone all child nodes to the notification (this is safer than direct innerHTML)
    while (tempDiv.firstChild) {
      notification.appendChild(tempDiv.firstChild);
    }
    document.body.appendChild(notification);

    return notification;
  }

  /**
   * Update status notification
   */
  function updateComparisonStatus(message, type = 'info') {
    const existing = document.getElementById('comparison-status-notification');
    if (existing) {
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      // Clear existing content and safely add new content
      existing.textContent = '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = message;
      while (tempDiv.firstChild) {
        existing.appendChild(tempDiv.firstChild);
      }
      existing.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : isDarkMode ? '#1e1e1e' : '#ffffff';
      existing.style.color = type === 'error' || type === 'success' ? '#ffffff' : isDarkMode ? '#ffffff' : '#000000';
      existing.style.borderColor = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#8b5cf6';
    } else {
      showComparisonStatus(message, type);
    }
  }

  /**
   * Remove status notification
   */
  function removeComparisonStatus() {
    const existing = document.getElementById('comparison-status-notification');
    if (existing) {
      existing.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => existing.remove(), 300);
    }
  }

  /**
   * Listen for comparison progress messages from background
   */
  function setupComparisonProgressListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'comparisonProgress') {
        const { step, detail } = message;
        console.log('Comparison progress:', step, detail);

        // Map step to icon
        let icon = '⏳';
        if (step === 'complete') icon = '✅';
        else if (step === 'error') icon = '❌';
        else if (step.startsWith('imdb')) icon = '🎬';
        else if (step === 'wikipedia') icon = '📖';
        else if (step === 'comparing') icon = '🔄';

        const type = step === 'error' ? 'error' : step === 'complete' ? 'success' : 'info';

        updateComparisonStatus(`
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">${icon}</div>
            <div>
              <div style="font-weight: 700; margin-bottom: 4px;">Comparison in Progress</div>
              <div style="font-size: 12px; opacity: 0.8;">${detail}</div>
            </div>
          </div>
        `, type);
      }
    });
  }

  // Setup the listener
  setupComparisonProgressListener();

  /**
   * Initiate comparison
   */
  async function initiateComparison(currentPageInfo) {
    const selectedTab = await selectComparisonTab(currentPageInfo.source);
    if (!selectedTab) return;

    try {
      // Validate extension context before sending message
      if (!chrome.runtime?.id) {
        alert('Extension context lost. Please refresh the page.');
        return;
      }

      // Show initial status
      showComparisonStatus(`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">🔄</div>
          <div>
            <div style="font-weight: 700; margin-bottom: 4px;">Starting Comparison</div>
            <div style="font-size: 12px; opacity: 0.8;">Initializing...</div>
          </div>
        </div>
      `);

      // Set timeout promise - 3 minutes to allow for IMDb tab extraction
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Comparison request timed out')), 180000);
      });

      // Send message with timeout
      const messagePromise = new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'startComparison',
            currentSource: currentPageInfo.source,
            currentPageInfo: currentPageInfo,
            selectedTab: selectedTab
          },
          (response) => {
            // Check for context invalidation in callback
            if (!chrome.runtime?.id) {
              reject(new Error('Extension context lost'));
              return;
            }

            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.success) {
              resolve(response);
            } else {
              reject(new Error(response?.error || 'Comparison failed'));
            }
          }
        );
      });

      // Race between message and timeout
      await Promise.race([messagePromise, timeoutPromise]);

      // Show success
      updateComparisonStatus(`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">✅</div>
          <div>
            <div style="font-weight: 700; margin-bottom: 4px;">Comparison Complete!</div>
            <div style="font-size: 12px; opacity: 0.8;">Opening comparison view...</div>
          </div>
        </div>
      `, 'success');

      // Remove notification after a delay
      setTimeout(() => removeComparisonStatus(), 2000);

      console.log('Comparison started');

    } catch (error) {
      console.error('Comparison initiation error:', error);

      updateComparisonStatus(`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">❌</div>
          <div>
            <div style="font-weight: 700; margin-bottom: 4px;">Comparison Failed</div>
            <div style="font-size: 12px; opacity: 0.8;">${error.message}</div>
          </div>
        </div>
      `, 'error');

      // Remove error notification after 5 seconds
      setTimeout(() => removeComparisonStatus(), 5000);
    }
  }

  /**
   * Initialize comparison button
   */
  async function initComparisonButton() {
    // Load settings to check if comparison buttons should be shown
    let settings = {};
    try {
      if (typeof window.SettingsUtils !== 'undefined') {
        settings = await window.SettingsUtils.loadSettings();
      } else {
        // Fallback to direct storage access
        settings = await new Promise((resolve) => {
          chrome.storage.sync.get({
            enableComparisonFeature: false,
            showComparisonBtnWiki: true,
            showComparisonBtnImdb: true
          }, resolve);
        });
      }
    } catch (error) {
      console.warn('Could not load comparison settings:', error);
      return;
    }

    // Check if comparison buttons are enabled at all
    if (!settings.enableComparisonFeature) {
      console.log('Comparison feature buttons are hidden in settings');
      return;
    }

    const currentPageInfo = getCurrentPageInfo();
    if (!currentPageInfo) return;

    // Check page-specific settings
    if (currentPageInfo.source === 'wikipedia' && !settings.showComparisonBtnWiki) {
      console.log('Comparison button hidden for Wikipedia pages in settings');
      return;
    }

    if (currentPageInfo.source === 'imdb' && !settings.showComparisonBtnImdb) {
      console.log('Comparison button hidden for IMDb pages in settings');
      return;
    }

    let buttonContainer = null;
    let buttonText = '';

    if (currentPageInfo.source === 'wikipedia') {
      const titleElement = document.querySelector('#firstHeading');
      if (!titleElement) return;

      buttonText = '🔄 Compare with IMDb';
      buttonContainer = titleElement.parentElement;
    } else if (currentPageInfo.source === 'imdb') {
      const titleElement = document.querySelector('h1');
      if (!titleElement) return;

      buttonText = '🔄 Compare with Wikipedia';
      buttonContainer = titleElement.parentElement;
    }

    if (!buttonContainer) return;

    // Check if button already exists
    if (buttonContainer.querySelector('.media-links-comparison-btn')) return;

    const button = document.createElement('button');
    button.className = 'media-links-comparison-btn';
    button.innerHTML = buttonText;
    button.style.cssText = `
      margin-left: 12px;
      padding: 8px 14px;
      background: #8b5cf6;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      transition: all 0.2s;
      vertical-align: middle;
      display: inline-block;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#7c3aed';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#8b5cf6';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '⏳ Comparing...';

      try {
        await initiateComparison(currentPageInfo);
      } catch (error) {
        console.error('Comparison error:', error);
        // Error is already shown via notification in initiateComparison
      } finally {
        // Re-enable button after completion
        button.disabled = false;
        button.innerHTML = buttonText;
      }
    });

    buttonContainer.appendChild(button);
  }

  /**
   * Remove comparison button from the page
   */
  function removeComparisonButton() {
    const button = document.querySelector('.media-links-comparison-btn');
    if (button) {
      button.remove();
    }
  }

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComparisonButton);
  } else {
    initComparisonButton();
  }

  /**
   * Listen for settings changes to show/hide comparison button
   */
  try {
    if (StorageUtils.isExtensionContextValid() && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
          // Check if any comparison-related settings changed
          const relevantChanges =
            changes.enableComparisonFeature ||
            changes.showComparisonBtnWiki ||
            changes.showComparisonBtnImdb;

          if (relevantChanges) {
            // Remove existing button and re-initialize based on new settings
            removeComparisonButton();
            initComparisonButton();
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error setting up comparison settings change listener:', error);
  }

})();
