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
