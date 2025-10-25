// Offscreen document that hosts the sandboxed iframe
// Communicates between background script and sandboxed page using postMessage

let pendingRequests = new Map();
let requestId = 0;

// Load and apply theme
const loadTheme = () => {
  try {
    // Check if chrome and chrome.storage are available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['theme'], (result) => {
        const theme = result.theme || 'light';
        document.body.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      });
    } else {
      // Fallback if chrome.storage is not available
      document.body.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (error) {
    console.warn('Offscreen: Could not load theme:', error);
    document.body.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

// Get reference to sandboxed iframe
const sandboxFrame = document.getElementById('sandbox');

// Load theme on script load
loadTheme();

// Wait for sandbox to load
sandboxFrame.addEventListener('load', () => {
  console.log('Offscreen: Sandbox iframe loaded');
});

// Listen for messages from sandboxed iframe
window.addEventListener('message', (event) => {
  console.log('Offscreen: Received message from sandbox:', event.data);

  // Find the pending request that matches this response
  for (const [id, request] of pendingRequests.entries()) {
    try {
      // Send response back to background script
      request.sendResponse(event.data);
      console.log('Offscreen: Response sent to background script');
    } catch (error) {
      console.error('Offscreen: Error sending response:', error);
    }
    pendingRequests.delete(id);
    break; // Only handle one request at a time for simplicity
  }
});

// Listen for messages from background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle theme changes
    if (message.type === 'themeChanged') {
      document.body.setAttribute('data-theme', message.theme);
      document.documentElement.setAttribute('data-theme', message.theme);
      return;
    }

    if (message.action === 'performOCR') {
      console.log('Offscreen: Received OCR request from background');

      // Wait for iframe to be ready
      if (!sandboxFrame.contentWindow) {
        console.error('Offscreen: Sandbox iframe not ready');
        sendResponse({
          success: false,
          error: 'Sandbox iframe not loaded'
        });
        return false;
      }

      // Store the sendResponse callback
      const id = requestId++;
      pendingRequests.set(id, { sendResponse });

      console.log('Offscreen: Forwarding OCR request to sandbox iframe');

      // Forward message to sandboxed iframe
      sandboxFrame.contentWindow.postMessage({
        action: 'performOCR',
        imageData: message.imageData
      }, '*');

      // Return true to indicate async response
      return true;
    }
  });
} else {
  console.warn('Offscreen: chrome.runtime not available');
}

console.log('Offscreen: Document loaded and ready');
