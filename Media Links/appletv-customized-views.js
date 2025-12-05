// Apple TV+ Customized Views - Episode and Cast/Crew extraction
// Creates customized view data from Apple TV+ show pages

(function() {
  'use strict';

  // Only run on Apple TV+ pages
  if (!window.location.hostname.includes('tv.apple.com')) {
    return;
  }

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping Apple TV+ customized views');
    return;
  }

  /**
   * Extract show title from the page
   */
  function extractShowTitle() {
    // Try content-logo first
    const logoImg = document.querySelector('.content-logo img');
    if (logoImg && logoImg.alt) {
      return logoImg.alt;
    }

    // Try page title
    const pageTitle = document.querySelector('h1.title, .show-title, [data-testid="title"]');
    if (pageTitle) {
      return pageTitle.textContent.trim();
    }

    // Fallback to document title
    const docTitle = document.title;
    if (docTitle) {
      // Remove " - Apple TV+" suffix if present
      return docTitle.replace(/\s*[-–—]\s*Apple TV\+?\s*$/, '').trim();
    }

    return 'Unknown Show';
  }

  /**
   * Wait for a specified duration
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show a loading indicator overlay
   */
  function showLoadingIndicator(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.className = 'media-links-loading-overlay';
    overlay.innerHTML = `
      <div class="media-links-loading-content">
        <div class="media-links-spinner"></div>
        <div class="media-links-loading-text">${message}</div>
      </div>
    `;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      backdrop-filter: blur(4px);
    `;

    const content = overlay.querySelector('.media-links-loading-content');
    content.style.cssText = `
      text-align: center;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const spinner = overlay.querySelector('.media-links-spinner');
    spinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      margin: 0 auto 16px;
      animation: media-links-spin 1s linear infinite;
    `;

    const text = overlay.querySelector('.media-links-loading-text');
    text.style.cssText = `
      font-size: 16px;
      font-weight: 600;
    `;

    // Add keyframes for spinner animation
    if (!document.querySelector('#media-links-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'media-links-spinner-style';
      style.textContent = `
        @keyframes media-links-spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Hide the loading indicator
   */
  function hideLoadingIndicator(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
  }

  /**
   * Auto-load all items in a section by clicking the next page arrows
   * @param {Element} section - The section element to auto-load
   * @param {string} sectionName - Name for logging purposes
   * @returns {number} - Number of clicks made
   */
  async function autoLoadSection(section, sectionName) {
    if (!section) {
      console.log(`No ${sectionName} section provided`);
      return 0;
    }

    console.log(`Auto-loading ${sectionName}...`);

    let clickCount = 0;
    const maxClicks = 50; // Safety limit to prevent infinite loops

    while (clickCount < maxClicks) {
      // Find the right arrow button - try multiple selectors
      let rightArrow = section.querySelector('button.shelf-grid-nav__arrow--right');

      if (!rightArrow) {
        // Try finding in shelf-grid directly
        const shelfGrid = section.querySelector('.shelf-grid') || section;
        rightArrow = shelfGrid.querySelector('button.shelf-grid-nav__arrow--right');
      }

      if (!rightArrow) {
        // Try any right arrow within the section
        rightArrow = section.querySelector('button[class*="arrow--right"]');
      }

      if (!rightArrow) {
        console.log(`[${sectionName}] No right arrow found, stopping after ${clickCount} clicks`);
        break;
      }

      // Check if the button is disabled
      if (rightArrow.disabled || rightArrow.hasAttribute('disabled')) {
        console.log(`[${sectionName}] Right arrow is disabled, loaded all items after ${clickCount} clicks`);
        break;
      }

      // Check if button is hidden (but not opacity - Apple TV uses opacity:0 for hover effect)
      const style = window.getComputedStyle(rightArrow);
      if (style.display === 'none' || style.visibility === 'hidden') {
        console.log(`[${sectionName}] Right arrow is hidden, stopping`);
        break;
      }

      // Click the arrow
      rightArrow.click();
      clickCount++;
      console.log(`[${sectionName}] Clicked right arrow ${clickCount} times`);

      // Wait for content to load
      await wait(400);
    }

    // Extra wait for final content to render
    await wait(300);
    console.log(`[${sectionName}] Finished auto-loading after ${clickCount} clicks`);
    return clickCount;
  }

  /**
   * Find the Episodes section using multiple selectors
   */
  function findEpisodesSection() {
    // Try aria-label first
    let section = document.querySelector('[aria-label="Episodes"]');
    if (section) return section;

    // Try finding by section with season dropdown (indicates episodes section)
    const allSections = document.querySelectorAll('.section[data-testid="section-container"]');
    for (const s of allSections) {
      const seasonDropdown = s.querySelector('.select-wrapper select');
      if (seasonDropdown) {
        console.log('Found episodes section via season dropdown');
        return s;
      }
    }

    // Try finding any shelf-grid with episode lockups
    const shelfGrids = document.querySelectorAll('.shelf-grid');
    for (const grid of shelfGrids) {
      const hasEpisodeTag = grid.querySelector('.tag');
      if (hasEpisodeTag && hasEpisodeTag.textContent.includes('EPISODE')) {
        console.log('Found episodes section via EPISODE tag');
        return grid.closest('.section') || grid;
      }
    }

    return null;
  }

  /**
   * Find the Cast & Crew section using multiple selectors
   */
  function findCastCrewSection() {
    // Try aria-label first
    let section = document.querySelector('[aria-label="Cast & Crew"]');
    if (section) return section;

    // Try finding by header text
    const allSections = document.querySelectorAll('.section[data-testid="section-container"]');
    for (const s of allSections) {
      const header = s.querySelector('h2');
      if (header && (header.textContent.includes('Cast') || header.textContent.includes('Crew'))) {
        console.log('Found Cast & Crew section via header text');
        return s;
      }
    }

    // Try finding section with person lockups
    for (const s of allSections) {
      const hasPersonLockup = s.querySelector('.person-lockup, [data-testid="person-lockup"]');
      if (hasPersonLockup) {
        console.log('Found Cast & Crew section via person lockups');
        return s;
      }
    }

    return null;
  }

  /**
   * Auto-load all episodes by clicking the next page arrows
   * Returns when all episodes are loaded
   */
  async function autoLoadAllEpisodes() {
    console.log('autoLoadAllEpisodes() called');
    const section = findEpisodesSection();
    if (!section) {
      console.log('No episodes section found');
      return;
    }
    await autoLoadSection(section, 'Episodes');
  }

  /**
   * Auto-load all cast & crew by clicking the next page arrows
   * Returns when all cast are loaded
   */
  async function autoLoadAllCast() {
    console.log('autoLoadAllCast() called');
    const section = findCastCrewSection();
    if (!section) {
      console.log('No Cast & Crew section found');
      return;
    }
    await autoLoadSection(section, 'Cast & Crew');
  }

  /**
   * Auto-load all content (episodes + cast)
   */
  async function autoLoadAllContent() {
    console.log('Auto-loading all content...');
    await autoLoadAllEpisodes();
    await autoLoadAllCast();
    console.log('Finished auto-loading all content');
  }

  /**
   * Extract all episodes from the page
   */
  function extractEpisodes() {
    const episodes = [];

    // Find episode lockups in shelf-grid layout
    const episodeLockups = document.querySelectorAll('.shelf-grid__list .lockup[data-testid="lockup"]');

    episodeLockups.forEach(lockup => {
      const metadataContent = lockup.querySelector('.metadata .content');
      if (!metadataContent) return;

      const tagEl = metadataContent.querySelector('.tag');
      const titleEl = metadataContent.querySelector('.title');
      const descEl = metadataContent.querySelector('.description');
      const durationEl = lockup.querySelector('.duration');

      if (!tagEl) return;

      const episodeTag = tagEl.textContent.trim();
      const episodeMatch = episodeTag.match(/EPISODE\s*(\d+)/i);
      const episodeNum = episodeMatch ? episodeMatch[1] : episodeTag;

      episodes.push({
        number: episodeNum,
        title: titleEl ? titleEl.textContent.trim() : '',
        description: descEl ? descEl.textContent.trim() : '',
        duration: durationEl ? durationEl.textContent.trim() : '',
        roleType: 'Episodes'
      });
    });

    return episodes;
  }

  /**
   * Extract cast and crew from the page
   */
  function extractCastAndCrew() {
    const castCrew = [];

    // Find Cast & Crew section
    const castCrewSection = document.querySelector('[aria-label="Cast & Crew"]');
    if (!castCrewSection) {
      // Try alternate selectors
      const sections = document.querySelectorAll('.section[data-testid="section-container"]');
      for (const section of sections) {
        const header = section.querySelector('h2');
        if (header && header.textContent.includes('Cast')) {
          processPersonLockups(section, castCrew);
          break;
        }
      }
    } else {
      processPersonLockups(castCrewSection, castCrew);
    }

    return castCrew;
  }

  /**
   * Determine role type from the role text (similar to IMDB)
   */
  function determineRoleType(roleText) {
    if (!roleText) return 'Cast';

    const roleLower = roleText.toLowerCase();

    // Check for specific roles in order of priority
    // Creator must be checked early
    if (roleLower.includes('creator') || roleLower.includes('created by')) {
      return 'Creators';
    }

    // Director (but not "Director of Photography")
    if (roleLower.includes('director') && !roleLower.includes('director of photography')) {
      return 'Directors';
    }

    // Executive Producer must be checked before regular Producer
    if (roleLower.includes('executive producer')) {
      return 'Executive Producers';
    }

    // Regular Producer (but not executive)
    if (roleLower.includes('producer') && !roleLower.includes('executive')) {
      return 'Producers';
    }

    // Writers Screenplay - specifically screenplay writers
    if (roleLower.includes('screenplay') || roleLower.includes('teleplay')) {
      return 'Writers Screenplay';
    }

    // Writers - general writers
    if (roleLower.includes('writer') ||
        roleLower.includes('story by') ||
        roleLower.includes('written by')) {
      return 'Writers';
    }

    // Music/Composer
    if (roleLower.includes('composer') ||
        roleLower.includes('music by') ||
        roleLower.includes('original music')) {
      return 'Music';
    }

    // Cinematography
    if (roleLower.includes('cinematograph') ||
        roleLower.includes('director of photography') ||
        roleLower.includes('dop')) {
      return 'Cinematography';
    }

    // Editors
    if (roleLower.includes('editor') && !roleLower.includes('story editor')) {
      return 'Editors';
    }

    // Default to Cast (actors with character names)
    return 'Cast';
  }

  /**
   * Process person lockups within a container
   */
  function processPersonLockups(container, castCrew) {
    const personLockups = container.querySelectorAll('.person-lockup, [data-testid="person-lockup"]');

    personLockups.forEach(lockup => {
      const titleEl = lockup.querySelector('.title, [data-testid="person-title"]');
      const subtitleEl = lockup.querySelector('.subtitle, [data-testid="person-subtitle"]');

      if (!titleEl) return;

      const name = titleEl.textContent.trim();
      const role = subtitleEl ? subtitleEl.textContent.trim() : '';

      // Skip placeholder items
      if (!name) return;

      // Determine role type from the role text
      const roleType = determineRoleType(role);

      castCrew.push({
        name: name,
        role: role,
        roleType: roleType
      });
    });
  }

  /**
   * Extract additional metadata (genres, year, etc.)
   */
  function extractMetadata() {
    const metadata = {
      genres: [],
      year: '',
      rating: '',
      runtime: ''
    };

    // Find metadata list
    const metadataList = document.querySelector('.metadata .metadata-list');
    if (metadataList) {
      const spans = metadataList.querySelectorAll('span');
      spans.forEach(span => {
        const text = span.textContent.trim();
        if (!text || text === '·') return;

        // Try to categorize the metadata
        if (/^\d{4}$/.test(text)) {
          metadata.year = text;
        } else if (/^\d+\s*(hr?|min)/.test(text)) {
          metadata.runtime = text;
        } else if (/^(TV-|PG|R|NC|G|NR)/i.test(text)) {
          metadata.rating = text;
        } else {
          metadata.genres.push(text);
        }
      });
    }

    return metadata;
  }

  /**
   * Collect all data and send to background for customized view
   * @param {boolean} autoLoad - Whether to auto-load all episodes first
   */
  async function collectAndOpenCustomizedView(autoLoad = false) {
    // Auto-load all episodes if requested
    if (autoLoad) {
      await autoLoadAllEpisodes();
    }

    const showTitle = extractShowTitle();
    const episodes = extractEpisodes();
    const castCrew = extractCastAndCrew();
    const metadata = extractMetadata();

    // Combine all data
    const viewData = {
      title: showTitle,
      source: 'Apple TV+',
      url: window.location.href,
      metadata: metadata,
      items: []
    };

    // Add episodes
    episodes.forEach(ep => {
      viewData.items.push({
        name: `E${ep.number}: ${ep.title}`,
        role: ep.description,
        roleType: 'Episodes',
        duration: ep.duration
      });
    });

    // Add cast/crew (preserving their determined roleType)
    castCrew.forEach(person => {
      viewData.items.push({
        name: person.name,
        role: person.role,
        roleType: person.roleType || 'Cast'
      });
    });

    return viewData;
  }

  /**
   * Open the customized view page with collected data
   */
  async function openCustomizedViewPage() {
    try {
      // Content should already be auto-loaded, but load if not
      if (!hasAutoLoadedContent) {
        const loadingIndicator = showLoadingIndicator('Loading all content...');
        await autoLoadAllContent();
        hasAutoLoadedContent = true;
        hideLoadingIndicator(loadingIndicator);
      }

      // Collect data (no need to auto-load again)
      const viewData = await collectAndOpenCustomizedView(false);

      if (viewData.items.length === 0) {
        console.log('No data found to display');
        alert('No episodes or cast data found on this page.');
        return;
      }

      // Generate a unique ID for this view
      const viewId = 'appletv-' + Date.now();

      // Store the data
      await chrome.storage.local.set({
        [`customizedView_${viewId}`]: viewData
      });

      // Open the customized view page via background script
      // (content scripts cannot use chrome.tabs.create directly)
      const viewPageUrl = chrome.runtime.getURL(`appletv-view-page.html?id=${viewId}`);
      chrome.runtime.sendMessage({
        type: 'createTab',
        url: viewPageUrl,
        active: true
      });

    } catch (error) {
      console.error('Error opening customized view:', error);
      alert('Failed to open customized view. Please try again.');
    }
  }

  /**
   * Add "Open Customized View" button to the page
   */
  async function addCustomizedViewButton() {
    // Check if button already exists
    if (document.querySelector('.media-links-appletv-view-btn')) return;

    // Wait for theme colors
    let colors = {
      button: '#6366f1',
      buttonHover: '#4f46e5',
      buttonText: '#fff'
    };

    try {
      if (typeof ThemeManager !== 'undefined') {
        colors = ThemeManager.getThemeColors();
      }
    } catch (e) {
      // Use defaults
    }

    // Find the content title (show/movie name)
    const contentTitle = document.querySelector('.content-logo') ||
                         document.querySelector('.product-header h1') ||
                         document.querySelector('[data-testid="content-title"]');

    // Create the button
    const button = document.createElement('button');
    button.className = 'media-links-appletv-view-btn';
    button.innerHTML = '📊 Customized View';
    button.title = 'Open episodes and cast in a customized, filterable view';
    button.style.cssText = `
      margin-left: 12px;
      padding: 8px 16px;
      background: ${colors.button};
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: ${colors.buttonText};
      transition: all 0.2s;
      vertical-align: middle;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = colors.buttonHover;
      button.style.transform = 'scale(1.02)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = colors.button;
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCustomizedViewPage();
    });

    // Add beside the content title if available
    if (contentTitle) {
      contentTitle.style.display = 'inline-flex';
      contentTitle.style.alignItems = 'center';
      contentTitle.style.gap = '12px';
      contentTitle.appendChild(button);
    } else {
      // Create a floating button as fallback
      button.style.cssText += `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(button);
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getAppleTVData') {
      // Async handler - auto-load all episodes first
      collectAndOpenCustomizedView(true).then(data => {
        sendResponse({ success: true, data: data });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    }

    if (message.action === 'openAppleTVCustomizedView') {
      openCustomizedViewPage();
      sendResponse({ success: true });
      return true;
    }
  });

  // Track if we've already auto-loaded content
  let hasAutoLoadedContent = false;
  let isAutoLoading = false; // Prevent concurrent auto-loading
  let currentPageUrl = window.location.href; // Track current URL for navigation detection

  /**
   * Reset state when navigating to a new show
   */
  function resetStateForNewPage() {
    hasAutoLoadedContent = false;
    isAutoLoading = false;
    // Remove existing button so it can be re-added
    const existingBtn = document.querySelector('.media-links-appletv-view-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    console.log('Reset state for new page');
  }

  /**
   * Check if URL has changed (SPA navigation)
   */
  function checkUrlChange() {
    if (window.location.href !== currentPageUrl) {
      console.log('URL changed from', currentPageUrl, 'to', window.location.href);
      currentPageUrl = window.location.href;
      resetStateForNewPage();
      // Re-initialize for new page
      initializePageContent();
    }
  }

  /**
   * Initialize page content (auto-load and add button)
   */
  async function initializePageContent() {
    // Check if we're on a show/movie page
    const isShowPage = window.location.pathname.includes('/show/') ||
                       window.location.pathname.includes('/movie/');

    if (!isShowPage) return;

    // Wait for content to load
    setTimeout(async () => {
      const hasCastCrew = document.querySelector('[aria-label="Cast & Crew"]') ||
                          document.querySelector('.person-lockup');
      const hasEpisodesSection = document.querySelector('[aria-label="Episodes"]');

      // Auto-load all content (episodes + cast) on page load
      if ((hasEpisodesSection || hasCastCrew) && !hasAutoLoadedContent && !isAutoLoading) {
        isAutoLoading = true;
        console.log('Auto-loading all content (episodes + cast)...');
        await autoLoadAllContent();
        hasAutoLoadedContent = true;
        isAutoLoading = false;
        console.log('All content loaded');
      }

      if (hasCastCrew || hasEpisodesSection) {
        addCustomizedViewButton();
      }
    }, 2000);
  }

  // Initialize when page is ready
  function initialize() {
    // Initial page content setup
    initializePageContent();

    // Watch for dynamic content and URL changes
    const observer = new MutationObserver(async () => {
      // Check for URL change (SPA navigation)
      checkUrlChange();

      const hasCastCrew = document.querySelector('[aria-label="Cast & Crew"]');
      const hasEpisodesSection = document.querySelector('[aria-label="Episodes"]');

      // Auto-load content if we haven't already
      if ((hasEpisodesSection || hasCastCrew) && !hasAutoLoadedContent && !isAutoLoading) {
        isAutoLoading = true;
        console.log('Auto-loading all content (from observer)...');
        await autoLoadAllContent();
        hasAutoLoadedContent = true;
        isAutoLoading = false;
        console.log('All content loaded');
      }

      if ((hasCastCrew || hasEpisodesSection) && !document.querySelector('.media-links-appletv-view-btn')) {
        addCustomizedViewButton();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for popstate (browser back/forward)
    window.addEventListener('popstate', () => {
      checkUrlChange();
    });

    // Cleanup
    window.addEventListener('beforeunload', () => observer.disconnect());
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Export for use by other scripts
  window.AppleTVCustomizedViews = {
    extractShowTitle,
    extractEpisodes,
    extractCastAndCrew,
    extractMetadata,
    autoLoadAllEpisodes,
    autoLoadAllCast,
    autoLoadAllContent,
    collectAndOpenCustomizedView,
    openCustomizedViewPage
  };

})();
