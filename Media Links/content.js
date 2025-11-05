// Helper function to safely send message to background script
const sendSelectionUpdate = (text, fromContextMenu = false) => {
  try {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'selectionChanged',
        text: text,
        fromContextMenu: fromContextMenu
      });
    }
  } catch (error) {
    // Extension context might be invalidated, ignore silently
    console.debug('Failed to send selection update:', error);
  }
};

// Listen for text selection and notify background script
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    sendSelectionUpdate(selectedText);
  }
});

// Also listen for keyboard-based selection
document.addEventListener('keyup', (e) => {
  // Only check on Shift key releases (used for selection)
  if (e.key === 'Shift') {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      sendSelectionUpdate(selectedText);
    }
  }
});

// Listen for right-click to ensure menu has current selection
// Priority: true ensures this runs before the browser's context menu
document.addEventListener('contextmenu', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    sendSelectionUpdate(selectedText, true);  // true = from context menu
  }
}, true);

// Listen for selection changes (catches double-click selection)
// This fires whenever the selection changes, regardless of how it was made
document.addEventListener('selectionchange', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    sendSelectionUpdate(selectedText);
  }
});

// Copy Webpage Button Functionality
let copyWebpageButton = null;
let copyModal = null;

// Message handler for copying current page content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'copyPageContent') {
    try {
      // Save the current selection
      const selection = window.getSelection();
      const savedRanges = [];
      for (let i = 0; i < selection.rangeCount; i++) {
        savedRanges.push(selection.getRangeAt(i).cloneRange());
      }

      // Select all content (like Ctrl+A)
      const range = document.createRange();
      range.selectNodeContents(document.body);
      selection.removeAllRanges();
      selection.addRange(range);

      // Get the text content (like what Ctrl+C would copy)
      const textContent = selection.toString();

      // Restore the previous selection
      selection.removeAllRanges();
      savedRanges.forEach(range => selection.addRange(range));

      sendResponse({
        success: true,
        content: textContent,
        title: document.title,
        url: window.location.href
      });
    } catch (error) {
      console.error('Failed to get page content:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
});

// Create the tab selection modal
function createCopyModal() {
  // Remove existing modal if any
  if (copyModal) {
    copyModal.remove();
    copyModal = null;
  }

  const modal = document.createElement('div');
  modal.id = 'media-links-copy-modal';
  Object.assign(modal.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '1000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none'
  });

  const modalContent = document.createElement('div');
  Object.assign(modalContent.style, {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    maxHeight: '80vh',
    overflowY: 'auto',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none'
  });

  modalContent.innerHTML = `
    <h3 style="margin: 0 0 16px 0; font-size: 20px; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      Select Tabs to Copy
    </h3>
    <div id="tabs-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; min-height: 100px;">
      <div style="text-align: center; padding: 40px; color: #999;">Loading tabs...</div>
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="copy-confirm-btn" style="flex: 1; padding: 12px; background-color: #4a90e2; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;">
        Copy Selected Tabs
      </button>
      <button id="copy-cancel-btn" style="flex: 1; padding: 12px; background-color: #e0e0e0; color: #333; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;">
        Cancel
      </button>
    </div>
  `;

  modal.appendChild(modalContent);

  // Add hover effects for buttons
  const confirmBtn = modalContent.querySelector('#copy-confirm-btn');
  const cancelBtn = modalContent.querySelector('#copy-cancel-btn');

  confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.backgroundColor = '#357abd');
  confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.backgroundColor = '#4a90e2');
  cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.backgroundColor = '#d0d0d0');
  cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.backgroundColor = '#e0e0e0');

  // Request tabs from background script
  chrome.runtime.sendMessage({ type: 'getTabs' }, (response) => {
    const tabsList = modalContent.querySelector('#tabs-list');
    tabsList.innerHTML = '';

    if (response && response.tabs && response.tabs.length > 0) {
      response.tabs.forEach((tab, index) => {
        const tabItem = document.createElement('label');
        Object.assign(tabItem.style, {
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '10px',
          borderRadius: '6px',
          transition: 'background-color 0.2s',
          border: '1px solid #e0e0e0'
        });

        tabItem.addEventListener('mouseenter', () => tabItem.style.backgroundColor = '#f5f5f5');
        tabItem.addEventListener('mouseleave', () => tabItem.style.backgroundColor = 'transparent');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'tab-checkbox';
        checkbox.dataset.tabId = tab.id;
        checkbox.checked = tab.active; // Pre-select current tab
        Object.assign(checkbox.style, {
          marginRight: '10px',
          width: '18px',
          height: '18px',
          cursor: 'pointer'
        });

        const favicon = document.createElement('img');
        favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ddd"/></svg>';
        Object.assign(favicon.style, {
          width: '16px',
          height: '16px',
          marginRight: '10px'
        });

        const textDiv = document.createElement('div');
        textDiv.style.flex = '1';

        // Create title div safely
        const titleDiv = document.createElement('div');
        titleDiv.textContent = tab.title;
        titleDiv.style.cssText = 'font-weight: 500; color: #333; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        // Create URL div safely
        const urlDiv = document.createElement('div');
        urlDiv.textContent = tab.url;
        urlDiv.style.cssText = 'font-size: 11px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        textDiv.appendChild(titleDiv);
        textDiv.appendChild(urlDiv);

        tabItem.appendChild(checkbox);
        tabItem.appendChild(favicon);
        tabItem.appendChild(textDiv);
        tabsList.appendChild(tabItem);
      });
    } else {
      tabsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No tabs found</div>';
    }
  });

  // Handle confirm button
  confirmBtn.addEventListener('click', () => {
    const checkboxes = modalContent.querySelectorAll('.tab-checkbox:checked');
    const selectedTabIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.tabId));

    if (selectedTabIds.length > 0) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Copying...';
      confirmBtn.style.backgroundColor = '#999';

      // Request copy from background script
      chrome.runtime.sendMessage({
        type: 'copyMultipleTabs',
        tabIds: selectedTabIds
      }, async (response) => {
        if (response && response.success && response.combinedText) {
          try {
            // Copy the combined text to clipboard
            await navigator.clipboard.writeText(response.combinedText);
            showCopyFeedback(true);
          } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            showCopyFeedback(false);
          }
        } else {
          showCopyFeedback(false);
        }
        modal.remove();
        copyModal = null;
      });
    } else {
      modal.remove();
      copyModal = null;
    }
  });

  // Handle cancel button
  cancelBtn.addEventListener('click', () => {
    modal.remove();
    copyModal = null;
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      copyModal = null;
    }
  });

  document.body.appendChild(modal);
  copyModal = modal;
  return modal;
}

// Show success/error feedback on the button
function showCopyFeedback(success) {
  if (!copyWebpageButton) return;

  const originalContent = copyWebpageButton.innerHTML;

  if (success) {
    copyWebpageButton.innerHTML = '✓';
    copyWebpageButton.style.backgroundColor = '#4caf50';
    copyWebpageButton.style.borderColor = '#45a049';
  } else {
    copyWebpageButton.innerHTML = '✗';
    copyWebpageButton.style.backgroundColor = '#f44336';
    copyWebpageButton.style.borderColor = '#d32f2f';
  }

  setTimeout(() => {
    copyWebpageButton.innerHTML = originalContent;
    copyWebpageButton.style.backgroundColor = '#ffffff';
    copyWebpageButton.style.borderColor = '#4a90e2';
  }, 1500);
}

function createCopyWebpageButton() {
  if (copyWebpageButton) return; // Already exists

  const button = document.createElement('button');
  button.id = 'media-links-copy-webpage-btn';
  button.innerHTML = '📋';
  button.title = 'Copy content from multiple tabs';

  // Styling for the button
  Object.assign(button.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '999999',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: '2px solid #4a90e2',
    backgroundColor: '#ffffff',
    color: '#333',
    fontSize: '24px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none'
  });

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('click', () => {
    createCopyModal();
  });

  document.body.appendChild(button);
  copyWebpageButton = button;
}

function removeCopyWebpageButton() {
  if (copyWebpageButton) {
    copyWebpageButton.remove();
    copyWebpageButton = null;
  }
  if (copyModal) {
    copyModal.remove();
    copyModal = null;
  }
}

function updateCopyWebpageButton(shouldShow) {
  if (shouldShow) {
    createCopyWebpageButton();
  } else {
    removeCopyWebpageButton();
  }
}

// Initialize the button based on settings
function initCopyWebpageButton() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      return;
    }
    chrome.storage.sync.get(['showCopyWebpageBtn'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading copy webpage button setting:', chrome.runtime.lastError);
        return;
      }
      // Explicitly check for true to show the button
      const shouldShow = result.showCopyWebpageBtn === true;
      console.log('Copy webpage button setting:', result.showCopyWebpageBtn, 'shouldShow:', shouldShow);
      updateCopyWebpageButton(shouldShow);
    });
  } catch (error) {
    console.warn('Error initializing copy webpage button:', error);
  }
}

// Listen for storage changes to update button visibility
try {
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.showCopyWebpageBtn) {
        // Validate that newValue is a boolean, default to false if not
        const newValue = changes.showCopyWebpageBtn.newValue;
        const shouldShow = typeof newValue === 'boolean' ? newValue : false;
        updateCopyWebpageButton(shouldShow);
      }
    });
  }
} catch (error) {
  console.warn('Error setting up storage change listener:', error);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCopyWebpageButton);
} else {
  initCopyWebpageButton();
}
