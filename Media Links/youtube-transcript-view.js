// YouTube Transcript View Page Script
// Displays extracted transcript with timestamp toggle

(function() {
  'use strict';

  let transcriptData = null;
  let showTimestamps = true;
  let searchTerm = '';

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /**
   * Format seconds to timestamp string (MM:SS or HH:MM:SS)
   */
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Count words in text
   */
  function countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Escape HTML characters
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Highlight search terms in text
   */
  function highlightText(text, term) {
    if (!term) return escapeHtml(text);

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
  }

  /**
   * Load transcript data from storage
   */
  async function loadTranscriptData() {
    return new Promise((resolve) => {
      try {
        console.log('Loading transcript data from storage...');
        chrome.storage.local.get(['youtube-transcript-data'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Storage error:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          console.log('Storage result:', result);
          if (result['youtube-transcript-data']) {
            transcriptData = result['youtube-transcript-data'];
            console.log('Transcript loaded:', transcriptData.transcript?.length, 'segments');
            resolve(true);
          } else {
            console.log('No transcript data found in storage');
            resolve(false);
          }
        });
      } catch (error) {
        console.error('Error loading transcript:', error);
        resolve(false);
      }
    });
  }

  /**
   * Generate transcript text for copying
   */
  function generateTranscriptText(withTimestamps) {
    if (!transcriptData || !transcriptData.transcript) return '';

    return transcriptData.transcript.map(segment => {
      if (withTimestamps && segment.timestamp) {
        return `[${segment.timestamp}] ${segment.text}`;
      }
      return segment.text;
    }).join('\n');
  }

  /**
   * Generate plain text (all segments joined)
   */
  function generatePlainText() {
    if (!transcriptData || !transcriptData.transcript) return '';
    return transcriptData.transcript.map(s => s.text).join(' ');
  }

  /**
   * Render the transcript view
   */
  async function renderTranscript() {
    const loaded = await loadTranscriptData();

    if (!loaded || !transcriptData) {
      document.getElementById('video-title').textContent = 'No Transcript Found';
      document.getElementById('transcript-segments').innerHTML = `
        <div class="no-transcript">
          <div class="no-transcript-icon">📜</div>
          <p>No transcript data found.</p>
          <p style="margin-top: 10px; font-size: 14px; opacity: 0.7;">
            Go to a YouTube video and click the Transcript button to extract one.
          </p>
        </div>
      `;
      document.getElementById('stats-section').style.display = 'none';
      document.getElementById('search-box').style.display = 'none';
      return;
    }

    // Update header
    document.getElementById('video-title').textContent = transcriptData.videoTitle || 'YouTube Video';

    const videoLinkEl = document.getElementById('video-link');
    if (transcriptData.videoUrl) {
      videoLinkEl.innerHTML = `<a href="${transcriptData.videoUrl}" target="_blank">Open Video</a> | `;
    }

    const extractedTimeEl = document.getElementById('extracted-time');
    if (transcriptData.extractedAt) {
      const date = new Date(transcriptData.extractedAt);
      extractedTimeEl.textContent = `Extracted: ${date.toLocaleString()}`;
    }

    // Update stats
    const transcript = transcriptData.transcript;
    document.getElementById('segment-count').textContent = transcript.length;

    const totalText = transcript.map(s => s.text).join(' ');
    document.getElementById('word-count').textContent = countWords(totalText);

    // Calculate duration from last segment
    if (transcript.length > 0) {
      const lastSegment = transcript[transcript.length - 1];
      const duration = lastSegment.startSeconds || 0;
      document.getElementById('duration').textContent = formatTime(duration);
    }

    // Render segments
    renderSegments();

    // Generate plain text view
    document.getElementById('transcript-plain-text').textContent = generatePlainText();
  }

  /**
   * Render transcript segments
   */
  function renderSegments() {
    if (!transcriptData || !transcriptData.transcript) return;

    const container = document.getElementById('transcript-segments');
    const transcript = transcriptData.transcript;

    // Filter by search term
    let filteredTranscript = transcript;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filteredTranscript = transcript.filter(segment =>
        segment.text.toLowerCase().includes(lowerSearch)
      );
    }

    if (filteredTranscript.length === 0) {
      container.innerHTML = `
        <div class="no-transcript" style="padding: 30px;">
          <p>No matches found for "${escapeHtml(searchTerm)}"</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredTranscript.map(segment => {
      const timestampHtml = showTimestamps && segment.timestamp
        ? `<span class="segment-timestamp" data-time="${segment.startSeconds}" title="Click to copy timestamp">${segment.timestamp}</span>`
        : '';

      return `
        <div class="transcript-segment">
          ${timestampHtml}
          <span class="segment-text">${highlightText(segment.text, searchTerm)}</span>
        </div>
      `;
    }).join('');

    // Add click handlers to timestamps
    container.querySelectorAll('.segment-timestamp').forEach(el => {
      el.addEventListener('click', () => {
        const timestamp = el.textContent;
        navigator.clipboard.writeText(timestamp).then(() => {
          showToast(`Copied: ${timestamp}`);
        });
      });
    });
  }

  /**
   * Copy transcript to clipboard
   */
  function copyTranscript() {
    const text = generateTranscriptText(showTimestamps);
    if (!text) {
      showToast('No transcript to copy', 'error');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const mode = showTimestamps ? 'with timestamps' : 'without timestamps';
      showToast(`Transcript copied ${mode}!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy transcript', 'error');
    });
  }

  /**
   * Download transcript as text file
   */
  function downloadTranscript() {
    const text = generateTranscriptText(showTimestamps);
    if (!text) {
      showToast('No transcript to download', 'error');
      return;
    }

    const filename = (transcriptData.videoTitle || 'transcript')
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50) + '.txt';

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Transcript downloaded!');
  }

  /**
   * Toggle timestamps visibility
   */
  function toggleTimestamps() {
    showTimestamps = !showTimestamps;

    const toggle = document.getElementById('timestamp-toggle');
    toggle.classList.toggle('active', showTimestamps);

    renderSegments();
  }

  /**
   * Handle search input
   */
  function handleSearch(e) {
    searchTerm = e.target.value.trim();
    renderSegments();
  }

  /**
   * Initialize event listeners
   */
  function initializeEventListeners() {
    // Timestamp toggle
    document.getElementById('timestamp-toggle').addEventListener('click', toggleTimestamps);

    // Copy button
    document.getElementById('copy-btn').addEventListener('click', copyTranscript);

    // Download button
    document.getElementById('download-btn').addEventListener('click', downloadTranscript);

    // Search box
    const searchBox = document.getElementById('search-box');
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => handleSearch(e), 300);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + C when not in input
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        copyTranscript();
      }

      // Ctrl/Cmd + S to download
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        downloadTranscript();
      }

      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchBox.focus();
      }
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('YouTube Transcript View: Initializing...');

    try {
      // Apply theme
      if (typeof ThemeManager !== 'undefined' && ThemeManager.initialize) {
        await ThemeManager.initialize();
      }

      initializeEventListeners();
      await renderTranscript();
      console.log('YouTube Transcript View: Initialization complete');
    } catch (error) {
      console.error('YouTube Transcript View: Initialization error:', error);
      document.getElementById('video-title').textContent = 'Error Loading Transcript';
      document.getElementById('transcript-segments').innerHTML = `
        <div class="no-transcript">
          <div class="no-transcript-icon">❌</div>
          <p>Error: ${error.message}</p>
        </div>
      `;
    }
  });

})();
