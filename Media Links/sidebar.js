const createLink = (url, text) => {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = text;
    link.classList.add('sidebar-link');
    link.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.update(tabs[0].id, { url: `https://${new URL(tabs[0].url).hostname}${url}` });
      });
    });
    return link;
  };
  
  const addLinks = (links) => {
    const sidebarContent = document.querySelector('.sidebar-content');
    sidebarContent.innerHTML = '';
    links.forEach(link => {
      const linkElement = createLink(link.url, link.text);
      sidebarContent.appendChild(linkElement);
    });
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
      { url: `/title/${imdbId}/ratings`, text: 'Ratings' }
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
  
  const init = () => {
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
          }
          addLinks(links);
          setActiveLink();
        } catch (error) {
          console.error('Invalid URL:', tabUrl);
        }
      }
    });
  };
  
  init();
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      init();
    }
  });