// Offscreen document that hosts the sandboxed iframe
// Communicates between background script and sandboxed page using postMessage

let pendingRequests = new Map();
let requestId = 0;
let sandboxReady = false;
let sandboxReadyPromise = null;
let sandboxReadyResolve = null;
let sandboxReadyReject = null;

// Helper to generate unique request ID
function getNextRequestId() {
  return ++requestId;
}

// Get reference to sandboxed iframe
const sandboxFrame = document.getElementById('sandbox');

/**
 * Initialize offscreen document with proper theme and event listeners
 */
const initializeOffscreen = async () => {
  try {
    console.log('Offscreen: Initializing...');

    // Initialize ThemeManager (loads theme from storage)
    if (typeof ThemeManager !== 'undefined') {
      await ThemeManager.initialize();
      console.log('Offscreen: Theme initialized:', ThemeManager.getTheme());
    } else {
      console.warn('Offscreen: ThemeManager not available');
    }

    // Set up message listeners
    setupMessageListeners();

    // Sandbox load listener is set up in waitForSandboxReady() to avoid duplicates

    console.log('Offscreen: Initialization complete');
  } catch (error) {
    console.error('Offscreen: Initialization error:', error);
    // Fallback to light theme if initialization fails
    document.body.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

/**
 * Set up message listeners
 */
const setupMessageListeners = () => {
  // Create sandbox ready promise
  sandboxReadyPromise = new Promise((resolve, reject) => {
    sandboxReadyResolve = resolve;
    sandboxReadyReject = reject;

    // Set timeout for sandbox initialization
    setTimeout(() => {
      if (!sandboxReady) {
        reject(new Error('Sandbox failed to initialize within 60 seconds'));
      }
    }, 60000); // 60 second timeout for initialization
  });

  // Listen for messages from sandboxed iframe
  window.addEventListener('message', (event) => {
    // HIGH SEVERITY FIX: Check type before calling includes()
    if (typeof event.origin !== 'string') {
      console.warn('Offscreen: Received message with invalid origin type:', typeof event.origin);
      return;
    }

    // Validate origin for security - accept only messages from this extension
    // Now it's safe to call includes()
    if (event.origin !== 'null' && !event.origin.includes('chrome-extension')) {
      console.warn('Offscreen: Rejected message from untrusted origin:', event.origin);
      return;
    }

    console.log('Offscreen: Received message from sandbox:', event.data);

    // Handle sandbox ready signal
    if (event.data?.type === 'sandboxReady') {
      if (event.data.success) {
        console.log('Offscreen: Sandbox is ready and Tesseract initialized');
        sandboxReady = true;
        if (sandboxReadyResolve) {
          sandboxReadyResolve();
        }
      } else {
        console.error('Offscreen: Sandbox initialization failed:', event.data.error);
        if (sandboxReadyReject) {
          sandboxReadyReject(new Error(event.data.error || 'Sandbox initialization failed'));
        }
      }
      return;
    }

    // Match response to pending request by request ID
    const responseRequestId = event.data?.requestId;
    if (responseRequestId && pendingRequests.has(responseRequestId)) {
      const request = pendingRequests.get(responseRequestId);
      try {
        // Clear timeout
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }

        // Resolve the promise with the response data
        if (request.resolve) {
          request.resolve(event.data);
          console.log('Offscreen: Promise resolved for request', responseRequestId);
        }
        // The sendResponse will be called in handleOCRRequest after await completes
      } catch (error) {
        console.error('Offscreen: Error processing response:', error);
        if (request.reject) {
          request.reject(error);
        }
      }
      pendingRequests.delete(responseRequestId);
    } else {
      console.warn('Offscreen: Received message with no matching request ID:', responseRequestId);
    }
  });

  // Listen for messages from background script
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle theme changes via ThemeManager
      if (message.type === 'themeChanged' && message.theme) {
        if (typeof ThemeManager !== 'undefined') {
          ThemeManager.setTheme(message.theme);
          console.log('Offscreen: Theme updated via ThemeManager:', message.theme);
        } else {
          // Fallback if ThemeManager not available
          document.body.setAttribute('data-theme', message.theme);
          document.documentElement.setAttribute('data-theme', message.theme);
        }
        return;
      }

      if (message.action === 'performOCR') {
        console.log('Offscreen: Received OCR request from background');

        // Handle OCR asynchronously
        handleOCRRequest(message, sendResponse);

        // Return true to indicate we'll send response asynchronously
        return true;
      }
    });
  } else {
    console.warn('Offscreen: chrome.runtime not available');
  }
};

/**
 * Wait for sandbox iframe to be ready
 */
const waitForSandboxReady = () => {
  return new Promise((resolve, reject) => {
    if (sandboxFrame.contentWindow) {
      resolve();
      return;
    }

    // Wait for iframe to load
    const timeout = setTimeout(() => {
      reject(new Error('Sandbox iframe failed to load within 10 seconds'));
    }, 10000);

    sandboxFrame.addEventListener('load', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });

    sandboxFrame.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Sandbox iframe failed to load'));
    }, { once: true });
  });
};

/**
 * Handle OCR request and send response
 */
const handleOCRRequest = async (message, sendResponse) => {
  try {
    // Wait for iframe to be ready
    try {
      await waitForSandboxReady();
    } catch (error) {
      console.error('Offscreen: Sandbox iframe not ready:', error);
      sendResponse({
        success: false,
        error: error.message || 'Sandbox iframe not loaded'
      });
      return;
    }

    // Wait for sandbox to finish initializing Tesseract
    if (!sandboxReady) {
      console.log('Offscreen: Waiting for sandbox Tesseract initialization...');
      try {
        await sandboxReadyPromise;
        console.log('Offscreen: Sandbox ready, proceeding with OCR');
      } catch (error) {
        console.error('Offscreen: Sandbox initialization failed:', error);
        sendResponse({
          success: false,
          error: error.message || 'Tesseract initialization failed'
        });
        return;
      }
    }

    // Generate unique request ID for this OCR request
    const id = getNextRequestId();

    // Create a promise that resolves when sandbox responds
    const ocrPromise = new Promise((resolve, reject) => {
      // Set timeout to prevent hanging (increased from 30s to 60s for slow connections)
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(id);
        const errorMsg = 'OCR request timeout - Tesseract may be taking too long to process the image. ' +
                        'This could be due to network issues loading Tesseract, a large image, or poor image quality. ' +
                        'Try reloading the page.';
        reject(new Error(errorMsg));
      }, 60000); // 60 second timeout

      // Store response handler with timeout
      pendingRequests.set(id, {
        sendResponse,
        timeoutId,
        resolve,
        reject
      });
    });

    console.log('Offscreen: Forwarding OCR request to sandbox iframe with ID', id);

    // Forward message to sandboxed iframe with request ID for tracking
    sandboxFrame.contentWindow.postMessage({
      action: 'performOCR',
      imageData: message.imageData,
      requestId: id  // Include request ID so sandbox can return it
    }, '*');

    // Wait for response
    try {
      const response = await ocrPromise;
      console.log('Offscreen: OCR completed, sending response');
      sendResponse(response);
    } catch (error) {
      console.error('Offscreen: OCR error:', error);
      sendResponse({
        success: false,
        error: error.message || 'OCR processing failed'
      });
    }
  } catch (error) {
    console.error('Offscreen: Unexpected error in OCR handler:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unexpected error'
    });
  }
};

// Initialize offscreen document when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOffscreen);
} else {
  initializeOffscreen();
}

console.log('Offscreen: Script loaded');
