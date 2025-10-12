const createLink = (url, text) => {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = text;
  link.classList.add('sidebar-link');
  link.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Validate URL starts with / to prevent XSS
      if (!url.startsWith('/')) {
        console.error('Invalid URL path:', url);
        return;
      }
      const currentUrl = new URL(tabs[0].url);
      // Construct safe URL using URL constructor
      const newUrl = `${currentUrl.protocol}//${currentUrl.hostname}${url}`;
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
          if (currentUrl.pathname.includes(link.getAttribute('href'))) {
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
    const tabUrl = tabs[0].url;
    const linksTab = document.querySelector('[data-tab="links"]');

    if (tabUrl) {
      try {
        const currentUrl = new URL(tabUrl);
        let links = [];
        let hasLinks = false;

        if (currentUrl.hostname === 'www.imdb.com') {
          const imdbId = currentUrl.pathname.split('/')[2];
          links = getLinksForIMDb(imdbId);
          hasLinks = true;
        } else if (currentUrl.hostname === 'letterboxd.com') {
          const filmName = currentUrl.pathname.split('/')[2];
          links = getLinksForLetterboxd(filmName);
          hasLinks = true;
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

const loadTheme = () => {
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'light';
    document.body.setAttribute('data-theme', theme);
  });
};

const init = () => {
  // Load saved theme
  loadTheme();

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

  // Listen for theme changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'themeChanged') {
      document.body.setAttribute('data-theme', message.theme);
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
