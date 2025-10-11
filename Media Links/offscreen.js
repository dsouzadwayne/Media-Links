// Offscreen document that hosts the sandboxed iframe
// Communicates between background script and sandboxed page using postMessage

let pendingRequests = new Map();
let requestId = 0;

// Get reference to sandboxed iframe
const sandboxFrame = document.getElementById('sandbox');

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

console.log('Offscreen: Document loaded and ready');
