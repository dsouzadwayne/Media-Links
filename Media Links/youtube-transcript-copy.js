// YouTube Transcript Copy Functionality
// Uses YouTube's InnerTube API to fetch transcripts (similar to youtube-caption-extractor)

(function() {
  'use strict';

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Early exit if extension context is invalid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping YouTube transcript functionality');
    return;
  }

  // InnerTube API configuration
  const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  const INNERTUBE_CLIENT_VERSION = '2.20240101.00.00';

  function isYouTubeVideoPage() {
    return window.location.hostname === 'www.youtube.com' &&
           window.location.pathname === '/watch';
  }

  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  function getVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
                         document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                         document.querySelector('#title h1 yt-formatted-string') ||
                         document.querySelector('h1.title') ||
                         document.querySelector('meta[name="title"]');

    if (titleElement) {
      return titleElement.content || titleElement.textContent.trim();
    }
    return document.title.replace(' - YouTube', '').trim() || 'YouTube Video';
  }

  function getThemeColors() {
    return new Promise((resolve) => {
      try {
        if (typeof ThemeManager !== 'undefined') {
          const colors = ThemeManager.getThemeColors();
          resolve(colors);
        } else {
          resolve({
            button: '#ff0000',
            buttonHover: '#cc0000',
            buttonText: '#fff'
          });
        }
      } catch (error) {
        resolve({
          button: '#ff0000',
          buttonHover: '#cc0000',
          buttonText: '#fff'
        });
      }
    });
  }

  function getCopyButtonSettings() {
    return new Promise((resolve) => {
      const defaults = { showYouTubeTranscript: true };
      try {
        if (!isExtensionContextValid()) {
          resolve(defaults);
          return;
        }
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get(['showYouTubeTranscript'], (result) => {
            if (chrome.runtime.lastError) {
              resolve(defaults);
            } else {
              resolve({
                showYouTubeTranscript: result.showYouTubeTranscript !== undefined ? result.showYouTubeTranscript : true
              });
            }
          });
        } else {
          resolve(defaults);
        }
      } catch (error) {
        resolve(defaults);
      }
    });
  }

  let isProcessing = false;
  let buttonAdded = false;

  async function addTranscriptButton() {
    if (!isYouTubeVideoPage()) return;
    if (isProcessing || buttonAdded) return;

    isProcessing = true;

    try {
      const settings = await getCopyButtonSettings();
      if (!settings.showYouTubeTranscript) {
        isProcessing = false;
        return;
      }

      if (document.querySelector('.media-links-youtube-transcript-btn')) {
        buttonAdded = true;
        isProcessing = false;
        return;
      }

      const colors = await getThemeColors();

      const targetArea = await waitForElement('#actions-inner #menu #top-level-buttons-computed', 5000) ||
                         await waitForElement('#above-the-fold #top-level-buttons-computed', 5000) ||
                         await waitForElement('ytd-menu-renderer #top-level-buttons-computed', 5000);

      if (!targetArea) {
        isProcessing = false;
        return;
      }

      const button = document.createElement('button');
      button.className = 'media-links-youtube-transcript-btn';
      button.innerHTML = '📜 Transcript';
      button.title = 'Extract and view video transcript';
      button.style.cssText = `
        margin-left: 8px;
        padding: 10px 16px;
        background: ${colors.button};
        border: none;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: ${colors.buttonText};
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: 'Roboto', 'Arial', sans-serif;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.background = colors.buttonHover;
        button.style.transform = 'scale(1.02)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = colors.button;
        button.style.transform = 'scale(1)';
      });

      button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await extractTranscript();
      });

      targetArea.appendChild(button);
      buttonAdded = true;
      console.log('YouTube transcript button added');

    } catch (error) {
      console.error('Error adding transcript button:', error);
    } finally {
      isProcessing = false;
    }
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Decode HTML entities
   */
  function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Strip HTML tags from text
   */
  function stripTags(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }

  /**
   * Format seconds to timestamp
   */
  function formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get YouTube player response from page
   */
  function getYtInitialPlayerResponse() {
    // Try to find in page scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.includes('ytInitialPlayerResponse')) {
        const match = text.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {
            // Try alternative parsing
          }
        }
      }
    }

    // Try window object
    try {
      if (window.ytInitialPlayerResponse) {
        return window.ytInitialPlayerResponse;
      }
    } catch (e) {}

    return null;
  }

  /**
   * Fetch transcript using InnerTube API
   */
  async function fetchTranscriptInnerTube(videoId) {
    try {
      // First, get the player response to find caption tracks
      const playerResponse = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: INNERTUBE_CLIENT_VERSION,
                hl: 'en',
                gl: 'US',
              },
            },
            videoId: videoId,
          }),
        }
      );

      const playerData = await playerResponse.json();

      // Check for captions
      const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (captions && captions.length > 0) {
        // Try to get transcript from caption tracks
        return await fetchFromCaptionTracks(captions);
      }

      // Fallback: Try to get transcript from engagement panel
      return await fetchTranscriptFromNextEndpoint(videoId);

    } catch (error) {
      console.error('InnerTube API error:', error);
      // Fallback to page scraping method
      return await fetchTranscriptFromPage(videoId);
    }
  }

  /**
   * Fetch transcript from caption tracks
   */
  async function fetchFromCaptionTracks(captionTracks) {
    // Prefer English manual captions, then English auto, then any
    let selectedTrack =
      captionTracks.find(t => t.languageCode === 'en' && !t.kind) ||
      captionTracks.find(t => t.languageCode === 'en') ||
      captionTracks.find(t => t.kind === 'asr') ||
      captionTracks[0];

    if (!selectedTrack || !selectedTrack.baseUrl) {
      throw new Error('No valid caption track found');
    }

    // Fetch the XML captions
    const response = await fetch(selectedTrack.baseUrl);
    const xmlText = await response.text();

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = xmlDoc.querySelectorAll('text');

    const transcript = [];
    textElements.forEach((element) => {
      const start = parseFloat(element.getAttribute('start')) || 0;
      const duration = parseFloat(element.getAttribute('dur')) || 0;
      let text = element.textContent || '';

      // Decode HTML entities and clean up
      text = decodeHTMLEntities(text);
      text = stripTags(text);
      text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      if (text) {
        transcript.push({
          timestamp: formatTimestamp(start),
          startSeconds: start,
          duration: duration,
          text: text
        });
      }
    });

    return transcript;
  }

  /**
   * Fetch transcript from /next endpoint (engagement panel)
   */
  async function fetchTranscriptFromNextEndpoint(videoId) {
    try {
      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/next?key=${INNERTUBE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: INNERTUBE_CLIENT_VERSION,
                hl: 'en',
                gl: 'US',
              },
            },
            videoId: videoId,
          }),
        }
      );

      const data = await response.json();

      // Find transcript panel in engagement panels
      const engagementPanels = data?.engagementPanels || [];

      for (const panel of engagementPanels) {
        const panelId = panel?.engagementPanelSectionListRenderer?.panelIdentifier;
        if (panelId === 'engagement-panel-searchable-transcript') {
          // Found transcript panel, now get the continuation token
          const content = panel?.engagementPanelSectionListRenderer?.content;
          const continuationToken = findContinuationToken(content);

          if (continuationToken) {
            return await fetchTranscriptWithToken(continuationToken);
          }
        }
      }

      throw new Error('No transcript panel found');
    } catch (error) {
      console.error('Next endpoint error:', error);
      throw error;
    }
  }

  /**
   * Find continuation token in panel content
   */
  function findContinuationToken(content) {
    try {
      // Try different paths where the token might be
      const paths = [
        content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params,
        content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params,
      ];

      for (const token of paths) {
        if (token) return token;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Fetch transcript using continuation token
   */
  async function fetchTranscriptWithToken(token) {
    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/get_transcript?key=${INNERTUBE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: INNERTUBE_CLIENT_VERSION,
              hl: 'en',
              gl: 'US',
            },
          },
          params: token,
        }),
      }
    );

    const data = await response.json();

    // Parse transcript from response
    const transcriptBody = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer;

    if (!transcriptBody) {
      throw new Error('No transcript body found');
    }

    const cueGroups = transcriptBody?.cueGroups || [];
    const transcript = [];

    for (const group of cueGroups) {
      const cue = group?.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer;
      if (cue) {
        const startMs = parseInt(cue.startOffsetMs) || 0;
        const durationMs = parseInt(cue.durationMs) || 0;
        const text = cue.cue?.simpleText ||
                    cue.cue?.runs?.map(r => r.text).join('') || '';

        if (text.trim()) {
          transcript.push({
            timestamp: formatTimestamp(startMs / 1000),
            startSeconds: startMs / 1000,
            duration: durationMs / 1000,
            text: text.trim()
          });
        }
      }
    }

    return transcript;
  }

  /**
   * Fallback: Fetch transcript from page HTML
   */
  async function fetchTranscriptFromPage(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        credentials: 'include'
      });
      const html = await response.text();

      // Extract ytInitialPlayerResponse
      const playerMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
      if (!playerMatch) {
        throw new Error('Could not find player response');
      }

      let playerResponse;
      try {
        playerResponse = JSON.parse(playerMatch[1]);
      } catch (e) {
        throw new Error('Failed to parse player response');
      }

      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captions || captions.length === 0) {
        throw new Error('No captions available for this video');
      }

      return await fetchFromCaptionTracks(captions);
    } catch (error) {
      console.error('Page fetch error:', error);
      throw error;
    }
  }

  /**
   * Main transcript extraction function
   */
  async function extractTranscript() {
    const button = document.querySelector('.media-links-youtube-transcript-btn');
    if (button) {
      button.innerHTML = '⏳ Extracting...';
      button.disabled = true;
    }

    try {
      const videoId = getVideoId();
      if (!videoId) {
        showNotification('Could not find video ID', true);
        resetButton();
        return;
      }

      // Try InnerTube API first
      let transcript;
      try {
        transcript = await fetchTranscriptInnerTube(videoId);
      } catch (e) {
        console.warn('InnerTube failed, trying page scrape:', e.message);
        transcript = await fetchTranscriptFromPage(videoId);
      }

      if (!transcript || transcript.length === 0) {
        showNotification('No transcript available for this video', true);
        resetButton();
        return;
      }

      // Get video info
      const videoTitle = getVideoTitle();
      const videoUrl = window.location.href;

      // Store transcript data
      const transcriptData = {
        videoId,
        videoTitle,
        videoUrl,
        transcript,
        extractedAt: new Date().toISOString()
      };

      // Save to storage and open view page
      chrome.storage.local.set({ 'youtube-transcript-data': transcriptData }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving transcript:', chrome.runtime.lastError);
          showNotification('Failed to save transcript', true);
          resetButton();
          return;
        }

        // Open transcript view page in new tab
        const viewPageUrl = chrome.runtime.getURL('youtube-transcript-view.html');
        chrome.runtime.sendMessage({
          action: 'openTranscriptView',
          url: viewPageUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            window.open(viewPageUrl, '_blank');
          }
        });

        showNotification(`Extracted ${transcript.length} transcript segments!`);
        resetButton();
      });

    } catch (error) {
      console.error('Error extracting transcript:', error);
      showNotification(error.message || 'Error extracting transcript', true);
      resetButton();
    }
  }

  function resetButton() {
    const button = document.querySelector('.media-links-youtube-transcript-btn');
    if (button) {
      button.innerHTML = '📜 Transcript';
      button.disabled = false;
    }
  }

  function showNotification(message, isError = false) {
    // Remove existing notification
    const existing = document.querySelector('.media-links-yt-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'media-links-yt-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${isError ? '#f44336' : '#4caf50'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10001;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: 'Roboto', 'Arial', sans-serif;
      animation: slideInRight 0.3s ease;
    `;

    // Add animation style if not exists
    if (!document.querySelector('#media-links-yt-anim-style')) {
      const style = document.createElement('style');
      style.id = 'media-links-yt-anim-style';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  // Initialize
  function initialize() {
    if (!isYouTubeVideoPage()) return;

    getCopyButtonSettings().then(settings => {
      if (!settings.showYouTubeTranscript) {
        return;
      }

      setTimeout(addTranscriptButton, 2000);

      // Handle SPA navigation
      let lastUrl = window.location.href;
      const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          buttonAdded = false;
          if (isYouTubeVideoPage()) {
            setTimeout(addTranscriptButton, 2000);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      window.addEventListener('popstate', () => {
        buttonAdded = false;
        if (isYouTubeVideoPage()) {
          setTimeout(addTranscriptButton, 2000);
        }
      });

      document.addEventListener('yt-navigate-finish', () => {
        buttonAdded = false;
        if (isYouTubeVideoPage()) {
          setTimeout(addTranscriptButton, 2000);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
