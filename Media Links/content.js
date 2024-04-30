(function() {
  'use strict';

  const createSidebar = () => {
    const sidebar = document.createElement('div');
    sidebar.id = 'custom-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>Links</h3>
        <button class="sidebar-toggle" id="sidebarClose">&times;</button>
      </div>
      <div class="sidebar-content"></div>
    `;
    document.body.appendChild(sidebar);
    return sidebar;
  };

  const createLink = (url, text) => {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = text;
    link.classList.add('sidebar-link');
    return link;
  };

  const addLinks = (sidebar, links) => {
    const sidebarContent = sidebar.querySelector('.sidebar-content');
    links.forEach(link => {
      const linkElement = createLink(link.url, link.text);
      sidebarContent.appendChild(linkElement);
    });
  };

  const createToggleButton = () => {
    const toggleButton = document.createElement('button');
    toggleButton.id = 'sidebarToggle';
    toggleButton.title = 'Toggle Sidebar';
    toggleButton.innerHTML = '&#9776;';
    document.body.appendChild(toggleButton);
    return toggleButton;
  };

  const setupEventListeners = (sidebar, toggleButton) => {
    toggleButton.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    const closeButton = document.getElementById('sidebarClose');
    closeButton.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  };

  const getLinksForIMDb = () => {
    const imdbId = window.location.pathname.split('/')[2];
    return [
      { url: `/title/${imdbId}/`, text: 'Main' },
      { url: `/title/${imdbId}/fullcredits`, text: 'Cast' },
      { url: `/title/${imdbId}/companycredits`, text: 'Production Companies' },
      { url: `/title/${imdbId}/awards`, text: 'Awards' },
      { url: `/title/${imdbId}/releaseinfo`, text: 'Release Info' },
      { url: `/title/${imdbId}/technical`, text: 'Technical Info' },
      { url: `/title/${imdbId}/plotsummary`, text: 'Plot' },
      { url: `/title/${imdbId}/parentalguide`, text: 'Parents Guide' },
      { url: `/title/${imdbId}/ratings`, text: 'Ratings' }
    ];
  };

  const getLinksForLetterboxd = () => {
    const filmName = window.location.pathname.split('/')[2];
    return [
      { url: `/film/${filmName}/`, text: 'Main' },
      { url: `/film/${filmName}/crew/`, text: 'Crew' },
      { url: `/film/${filmName}/details/`, text: 'Details' },
      { url: `/film/${filmName}/genres/`, text: 'Genres' },
      { url: `/film/${filmName}/releases/`, text: 'Releases' }
    ];
  };

  const setActiveLink = (sidebar) => {
    const currentUrl = window.location.pathname;
    const sidebarLinks = sidebar.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
      if (link.textContent === 'Main') {
        if (currentUrl === link.getAttribute('href')) {
          link.classList.add('active');
        }
      } else {
        if (currentUrl.includes(link.getAttribute('href'))) {
          link.classList.add('active');
        }
      }
    });
  };

  const init = () => {
    const sidebar = createSidebar();
    const toggleButton = createToggleButton();
    setupEventListeners(sidebar, toggleButton);

    let links = [];
    if (window.location.hostname === 'www.imdb.com') {
      links = getLinksForIMDb();
    } else if (window.location.hostname === 'letterboxd.com') {
      links = getLinksForLetterboxd();
    }
    addLinks(sidebar, links);

    setActiveLink(sidebar);
  };

  init();
})();