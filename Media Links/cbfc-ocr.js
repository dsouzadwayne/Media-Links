// CBFC OCR Auto-Fill
// This script uses Tesseract.js OCR to automatically read and fill text fields
// on the CBFC website for improved accessibility.

(function() {
  'use strict';

  // Convert image to base64 data URL with preprocessing
  function getImageDataUrl(imgElement) {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Use actual dimensions - scale up for better OCR
        const width = imgElement.naturalWidth || imgElement.width || 170;
        const height = imgElement.naturalHeight || imgElement.height || 50;

        // Scale up image for better OCR accuracy
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;

        console.log('CBFC OCR: Original dimensions:', width, 'x', height);
        console.log('CBFC OCR: Scaled dimensions:', canvas.width, 'x', canvas.height);
        console.log('CBFC OCR: Image src:', imgElement.src);
        console.log('CBFC OCR: Image complete:', imgElement.complete);

        // Enable image smoothing for better scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw scaled image
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        // Optional: Apply contrast enhancement
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
          // Increase contrast
          data[i] = Math.min(255, data[i] * 1.2);     // Red
          data[i + 1] = Math.min(255, data[i + 1] * 1.2); // Green
          data[i + 2] = Math.min(255, data[i + 2] * 1.2); // Blue
        }

        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');
        console.log('CBFC OCR: Data URL length:', dataUrl.length);

        resolve(dataUrl);
      } catch (error) {
        console.error('CBFC OCR: Error converting image:', error);
        reject(error);
      }
    });
  }

  // Request OCR from background script
  async function readImageText(imgElement) {
    try {
      console.log('CBFC OCR: Capturing image...');
      const imageDataUrl = await getImageDataUrl(imgElement);

      console.log('CBFC OCR: Sending to background script for OCR...');

      // Send message to background script to perform OCR
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'performOCR',
            imageData: imageDataUrl
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('CBFC OCR: chrome.runtime.lastError occurred');
              console.error('CBFC OCR: Error message:', chrome.runtime.lastError.message);
              console.error('CBFC OCR: Full error:', JSON.stringify(chrome.runtime.lastError));
              reject(chrome.runtime.lastError);
              return;
            }

            console.log('CBFC OCR: Received response:', response);

            if (response && response.success) {
              const cleanText = response.text.replace(/[^A-Za-z0-9]/g, '');
              console.log('CBFC OCR: Text recognized:', cleanText);
              console.log('CBFC OCR: Confidence:', response.confidence);
              resolve(cleanText);
            } else {
              console.error('CBFC OCR: OCR failed:', response?.error);
              reject(new Error(response?.error || 'OCR failed'));
            }
          }
        );
      });
    } catch (error) {
      console.error('CBFC OCR: Error reading image:', error);
      return null;
    }
  }

  // Auto-fill text field with OCR
  async function autoFillTextField() {
    const imageElement = document.getElementById('captcha_code');
    const textInput = document.getElementById('captcha');

    if (!imageElement || !textInput) {
      console.log('CBFC OCR: Elements not found, retrying...');
      setTimeout(autoFillTextField, 500);
      return;
    }

    console.log('CBFC OCR: Found elements');
    console.log('CBFC OCR: Image element:', imageElement);
    console.log('CBFC OCR: Input element:', textInput);

    // Wait for image to load with timeout
    if (!imageElement.complete) {
      console.log('CBFC OCR: Image not loaded yet, waiting...');

      const imageLoadPromise = new Promise((resolve, reject) => {
        imageElement.onload = () => {
          console.log('CBFC OCR: Image loaded successfully');
          resolve();
        };
        imageElement.onerror = (error) => {
          console.error('CBFC OCR: Image failed to load', error);
          reject(error);
        };

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Image load timeout')), 5000);
      });

      try {
        await imageLoadPromise;
      } catch (error) {
        console.error('CBFC OCR: Failed to load image:', error);
        textInput.style.backgroundColor = '#ffebee';
        return;
      }
    }

    console.log('CBFC OCR: Starting OCR auto-fill...');
    textInput.style.backgroundColor = '#fff9c4'; // Yellow = processing

    const recognizedText = await readImageText(imageElement);

    if (recognizedText && recognizedText.length > 0) {
      textInput.value = recognizedText;
      textInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('CBFC OCR: Field auto-filled with:', recognizedText);

      // Add visual indicator
      textInput.style.backgroundColor = '#e8f5e9'; // Green = success
    } else {
      console.log('CBFC OCR: Could not read text from image');
      textInput.style.backgroundColor = '#ffebee'; // Red = failed
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoFillTextField);
  } else {
    autoFillTextField();
  }
})();
