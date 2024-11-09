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
 
 if (Array.isArray(links)) {
   // Handle regular links
   links.forEach(link => {
     const linkElement = createLink(link.url, link.text);
     sidebarContent.appendChild(linkElement);
   });
 } else {
   // Handle custom elements (like CBFC form)
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
 
 // Create label and input
 const label = document.createElement('label');
 label.textContent = 'Film Name: ';
 label.setAttribute('for', 'film-name-input');
 
 const input = document.createElement('input');
 input.type = 'text';
 input.id = 'film-name-input';
 input.classList.add('form-control');
 
 // Create Apply button
 const button = document.createElement('button');
 button.textContent = 'Apply';
 button.classList.add('apply-button');
 button.addEventListener('click', () => {
   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
     // Execute script to update the film title input on the page
     chrome.scripting.executeScript({
       target: { tabId: tabs[0].id },
       function: (filmName) => {
         const filmInput = document.querySelector('#film-title');
         if (filmInput) {
           filmInput.value = filmName;
         }
       },
       args: [input.value]
     });
   });
 });
 
 // Add elements to container
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

init();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 if (changeInfo.status === 'complete' && tab.active) {
   init();
 }
});
