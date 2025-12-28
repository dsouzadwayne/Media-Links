const createLink = (url, text) => {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = text;
  link.classList.add('sidebar-link');
  // Store the URL path in a data attribute for active link detection
  link.dataset.urlPath = url;
  link.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Validate URL starts with / to prevent XSS
      if (!url.startsWith('/')) {
        console.error('Invalid URL path:', url);
        return;
      }
      const currentUrl = new URL(tabs[0].url);
      // Construct safe URL using URL constructor
      const newUrl = new URL(url, `${currentUrl.protocol}//${currentUrl.hostname}`).href;
      chrome.tabs.update(tabs[0].id, { url: newUrl });
    });
  });
  return link;
};

const addLinks = (links) => {
  const sidebarContent = document.querySelector('.sidebar-content');
  // Clear content safely using textContent instead of innerHTML
  sidebarContent.textContent = '';

  if (Array.isArray(links)) {
    links.forEach(link => {
      const linkElement = createLink(link.url, link.text);
      sidebarContent.appendChild(linkElement);
    });
  } else {
    sidebarContent.appendChild(links);
  }
};

const getLinksForIMDb = (imdbId) => {
  return [
    { url: `/title/${imdbId}/`, text: 'Main' },
    { url: `/title/${imdbId}/fullcredits`, text: 'Cast' },
    { url: `/title/${imdbId}/companycredits`, text: 'Production' },
    { url: `/title/${imdbId}/awards`, text: 'Awards' },
    { url: `/title/${imdbId}/releaseinfo`, text: 'Release Info' },
    { url: `/title/${imdbId}/technical`, text: 'Technical' },
    { url: `/title/${imdbId}/plotsummary`, text: 'Plot' },
    { url: `/title/${imdbId}/parentalguide`, text: 'Parents Guide' },
    { url: `/title/${imdbId}/ratings`, text: 'Ratings' },
    { url: `/title/${imdbId}/episodes`, text: 'Episodes' },
  ];
};

const getLinksForLetterboxd = (filmName) => {
  return [
    { url: `/film/${filmName}/`, text: 'Main' },
    { url: `/film/${filmName}/crew/`, text: 'Crew' },
    { url: `/film/${filmName}/details/`, text: 'Details' },
    { url: `/film/${filmName}/genres/`, text: 'Genres' },
    { url: `/film/${filmName}/releases/`, text: 'Releases' }
  ];
};

const setActiveLink = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0].url;
    if (tabUrl) {
      try {
        const currentUrl = new URL(tabUrl);
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
          link.classList.remove('active');
          // Use data-url-path attribute instead of href for matching
          const urlPath = link.dataset.urlPath;
          if (urlPath && currentUrl.pathname.includes(urlPath)) {
            link.classList.add('active');
          }
        });
      } catch (error) {
        console.error('Invalid URL:', tabUrl);
      }
    }
  });
};

const updateLinks = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // CRITICAL FIX: Check that we have at least one tab
    if (!tabs || tabs.length === 0) {
      console.warn('No active tab found');
      return;
    }

    const tabUrl = tabs[0].url;
    const linksTab = document.querySelector('[data-tab="links"]');

    if (tabUrl) {
      try {
        const currentUrl = new URL(tabUrl);
        let links = [];
        let hasLinks = false;

        if (currentUrl.hostname === 'www.imdb.com') {
          // Check array bounds before accessing
          const pathParts = currentUrl.pathname.split('/');
          if (pathParts.length <= 2 || !pathParts[2]) {
            // Homepage or non-title page - no links to show (this is normal)
            hasLinks = false;
          } else {
            const imdbId = pathParts[2];
            // Additional validation: IMDb IDs should start with 'tt'
            if (!imdbId.match(/^tt\d+$/)) {
              // Not a title page (could be /name/, /list/, etc.)
              hasLinks = false;
            } else {
              links = getLinksForIMDb(imdbId);
              hasLinks = true;
            }
          }
        } else if (currentUrl.hostname === 'letterboxd.com') {
          // Check array bounds before accessing
          const pathParts = currentUrl.pathname.split('/');
          if (pathParts.length <= 2 || !pathParts[2]) {
            // Homepage or non-film page - no links to show (this is normal)
            hasLinks = false;
          } else {
            const filmName = pathParts[2];
            // Additional validation: Film name should not be empty
            if (filmName.trim() === '') {
              hasLinks = false;
            } else {
              links = getLinksForLetterboxd(filmName);
              hasLinks = true;
            }
          }
        }

        // Show/hide Links tab based on whether we have links
        if (linksTab) {
          if (hasLinks) {
            linksTab.style.display = '';
            addLinks(links);
            setActiveLink();
          } else {
            linksTab.style.display = 'none';
            // If Links tab was active, switch to Search button visually but don't click it
            if (linksTab.classList.contains('active')) {
              linksTab.classList.remove('active');
              const searchButton = document.getElementById('search-button');
              if (searchButton) {
                searchButton.classList.add('active');
              }
            }
          }
        }
      } catch (error) {
        console.error('Invalid URL:', tabUrl);
        if (linksTab) {
          linksTab.style.display = 'none';
        }
      }
    } else {
      if (linksTab) {
        linksTab.style.display = 'none';
      }
    }
  });
};

const init = async () => {
  try {
    // Initialize ThemeManager and load theme
    if (typeof ThemeManager !== 'undefined') {
      await ThemeManager.initialize();
      console.log('Sidebar: Theme initialized via ThemeManager');
    } else {
      console.warn('Sidebar: ThemeManager not available');
    }
  } catch (error) {
    console.error('Sidebar: Error initializing ThemeManager:', error);
  }

  // Initialize search button (opens in new tab)
  const searchButton = document.getElementById('search-button');
  if (searchButton) {
    searchButton.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('search.html') });
    });
  }

  // Initialize settings button (opens in new tab)
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
  }

  // Initialize close button
  const closeButton = document.getElementById('close-sidebar');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.close();
    });
  }

  // Listen for theme changes via ThemeManager or fallback to direct message handling
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'themeChanged' && message.theme) {
      if (typeof ThemeManager !== 'undefined') {
        ThemeManager.setTheme(message.theme);
      } else {
        // Fallback if ThemeManager not available
        document.body.setAttribute('data-theme', message.theme);
        document.documentElement.setAttribute('data-theme', message.theme);
      }
    }
  });

  updateLinks();
};

init();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateLinks();
  }
});
