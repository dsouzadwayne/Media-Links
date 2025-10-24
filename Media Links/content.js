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

// Copy Webpage Button Functionality
let copyWebpageButton = null;

function createCopyWebpageButton() {
  if (copyWebpageButton) return; // Already exists

  const button = document.createElement('button');
  button.id = 'media-links-copy-webpage-btn';
  button.innerHTML = '📋';
  button.title = 'Copy entire webpage';

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
    padding: '0'
  });

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('click', async () => {
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

      // Copy the selected content (like Ctrl+C)
      document.execCommand('copy');

      // Restore the previous selection
      selection.removeAllRanges();
      savedRanges.forEach(range => selection.addRange(range));

      // Show success feedback
      const originalContent = button.innerHTML;
      button.innerHTML = '✓';
      button.style.backgroundColor = '#4caf50';
      button.style.borderColor = '#45a049';

      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.backgroundColor = '#ffffff';
        button.style.borderColor = '#4a90e2';
      }, 1500);
    } catch (error) {
      console.error('Failed to copy webpage:', error);

      // Show error feedback
      const originalContent = button.innerHTML;
      button.innerHTML = '✗';
      button.style.backgroundColor = '#f44336';
      button.style.borderColor = '#d32f2f';

      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.backgroundColor = '#ffffff';
        button.style.borderColor = '#4a90e2';
      }, 1500);
    }
  });

  document.body.appendChild(button);
  copyWebpageButton = button;
}

function removeCopyWebpageButton() {
  if (copyWebpageButton) {
    copyWebpageButton.remove();
    copyWebpageButton = null;
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
  chrome.storage.sync.get(['showCopyWebpageBtn'], (result) => {
    const shouldShow = result.showCopyWebpageBtn || false;
    updateCopyWebpageButton(shouldShow);
  });
}

// Listen for storage changes to update button visibility
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.showCopyWebpageBtn) {
    updateCopyWebpageButton(changes.showCopyWebpageBtn.newValue);
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCopyWebpageButton);
} else {
  initCopyWebpageButton();
}
