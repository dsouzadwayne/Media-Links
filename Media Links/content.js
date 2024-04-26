(function() {
  'use strict';

  const createSidebar = () => {
    const sidebar = document.createElement('div');
    sidebar.id = 'custom-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>Links</h3>
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

  const init = () => {
    const sidebar = createSidebar();

    if (window.location.hostname === 'www.imdb.com') {
      const imdbId = window.location.pathname.split('/')[2];
      const links = [
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
      addLinks(sidebar, links);
    } else if (window.location.hostname === 'letterboxd.com') {
      const filmName = window.location.pathname.split('/')[2];
      const links = [
        { url: `/film/${filmName}/`, text: 'Main' },
        { url: `/film/${filmName}/crew/`, text: 'Crew' },
        { url: `/film/${filmName}/details/`, text: 'Details' },
        { url: `/film/${filmName}/genres/`, text: 'Genres' },
        { url: `/film/${filmName}/releases/`, text: 'Releases' }
      ];
      addLinks(sidebar, links);
    }

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

  init();
})();
