// Listen for text selection and notify background script
document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    chrome.runtime.sendMessage({
      type: 'selectionChanged',
      text: selectedText
    });
  }
});

// Also listen for keyboard-based selection
document.addEventListener('keyup', (e) => {
  // Only check on Shift key releases (used for selection)
  if (e.key === 'Shift') {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: 'selectionChanged',
        text: selectedText
      });
    }
  }
});
