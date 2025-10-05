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

const getLinksForCBFC = () => {
  const container = document.createElement('div');
  container.classList.add('cbfc-form');
  
  const label = document.createElement('label');
  label.textContent = 'Film Name: ';
  label.setAttribute('for', 'film-name-input');
  
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'film-name-input';
  input.classList.add('form-control');
  
  const button = document.createElement('button');
  button.textContent = 'Apply';
  button.classList.add('apply-button');
  button.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0].url;
      // Only execute on CBFC domain for security
      if (!currentUrl || !currentUrl.startsWith('https://www.cbfcindia.gov.in/')) {
        console.error('Script injection only allowed on CBFC domain');
        return;
      }

      // Sanitize input to prevent script injection
      const sanitizedFilmName = input.value.replace(/[<>"']/g, '');

      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: (filmName) => {
          const filmInput = document.querySelector('#film-title');
          if (filmInput) {
            filmInput.value = filmName;
          }
        },
        args: [sanitizedFilmName]
      });
    });
  });
  
  container.appendChild(label);
  container.appendChild(input);
  container.appendChild(button);
  
  return container;
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
    if (tabUrl) {
      try {
        const currentUrl = new URL(tabUrl);
        let links = [];
        if (currentUrl.hostname === 'www.imdb.com') {
          const imdbId = currentUrl.pathname.split('/')[2];
          links = getLinksForIMDb(imdbId);
        } else if (currentUrl.hostname === 'letterboxd.com') {
          const filmName = currentUrl.pathname.split('/')[2];
          links = getLinksForLetterboxd(filmName);
        } else if (currentUrl.hostname === 'www.cbfcindia.gov.in') {
          links = getLinksForCBFC();
        }
        addLinks(links);
        setActiveLink();
      } catch (error) {
        console.error('Invalid URL:', tabUrl);
      }
    }
  });
};

const loadTheme = () => {
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'catppuccin-mocha';
    document.body.setAttribute('data-theme', theme);
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = theme;
    }
  });
};

const saveTheme = (theme) => {
  chrome.storage.sync.set({ theme: theme }, () => {
    document.body.setAttribute('data-theme', theme);
  });
};

const switchTab = (tabName) => {
  // Remove active class from all tabs and panels
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

  // Add active class to selected tab and panel
  const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
  const selectedPanel = document.getElementById(`${tabName}-tab`);

  if (selectedButton) selectedButton.classList.add('active');
  if (selectedPanel) selectedPanel.classList.add('active');
};

const init = () => {
  // Load saved settings
  loadTheme();

  // Initialize tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.target.getAttribute('data-tab');
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  // Initialize theme selector
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      saveTheme(e.target.value);
    });
  }

  // Initialize search button (opens in new tab)
  const searchButton = document.getElementById('search-button');
  if (searchButton) {
    searchButton.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('search.html') });
    });
  }

  updateLinks();
};

init();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateLinks();
  }
});
