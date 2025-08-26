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

// Tab functionality
const initTabs = () => {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
};

// Search functionality
const generateQueries = (elements) => {
  if (elements.length === 0) return [];
  
  const queries = [];
  
  // Single element queries
  if (elements.length >= 1) {
    queries.push(elements[0]);
    queries.push(`"${elements[0]}"`);
    queries.push(`intitle:"${elements[0]}"`);
    queries.push(`allintitle:${elements[0]}`);
    queries.push(`intext:"${elements[0]}"`);
  }
  
  // Two element combinations
  if (elements.length >= 2) {
    queries.push(`${elements[0]} ${elements[1]}`);
    queries.push(`"${elements[0]}" ${elements[1]}`);
    queries.push(`${elements[0]} "${elements[1]}"`);
    queries.push(`"${elements[0]}" "${elements[1]}"`);
    queries.push(`"${elements[0]} ${elements[1]}"`);
    queries.push(`intitle:"${elements[0]}" ${elements[1]}`);
    queries.push(`"${elements[0]}" AND "${elements[1]}"`);
    queries.push(`"${elements[0]}" OR "${elements[1]}"`);
  }
  
  // Three element combinations
  if (elements.length >= 3) {
    queries.push(`${elements[0]} ${elements[1]} ${elements[2]}`);
    queries.push(`"${elements[0]}" "${elements[1]}" "${elements[2]}"`);
    queries.push(`"${elements[0]} ${elements[1]}" ${elements[2]}`);
    queries.push(`"${elements[0]} ${elements[1]} ${elements[2]}"`);
    queries.push(`"${elements[0]}" AND "${elements[1]}" AND "${elements[2]}"`);
  }
  
  // Four element combinations
  if (elements.length >= 4) {
    queries.push(`${elements[0]} ${elements[1]} ${elements[2]} ${elements[3]}`);
    queries.push(`"${elements[0]}" "${elements[1]}" "${elements[2]}" "${elements[3]}"`);
    queries.push(`"${elements[0]} ${elements[1]}" "${elements[2]} ${elements[3]}"`);
    queries.push(`"${elements[0]} ${elements[1]} ${elements[2]} ${elements[3]}"`);
    queries.push(`"${elements[0]}" AND "${elements[1]}" AND "${elements[2]}" AND "${elements[3]}"`);
  }
  
  return queries;
};

const initSearch = () => {
  const searchInputs = document.querySelectorAll('.search-element');
  const previewList = document.getElementById('preview-list');
  const executeBtn = document.querySelector('.search-execute-btn');
  
  const updatePreview = () => {
    const elements = [];
    searchInputs.forEach(input => {
      if (input.value.trim()) {
        elements.push(input.value.trim());
      }
    });
    
    const queries = generateQueries(elements);
    
    if (queries.length === 0) {
      previewList.innerHTML = '<div class="preview-item">Enter elements to see search combinations...</div>';
      return;
    }
    
    previewList.innerHTML = queries.slice(0, 10).map((query, index) => 
      `<div class="preview-item">${index + 1}. ${query}</div>`
    ).join('');
    
    if (queries.length > 10) {
      previewList.innerHTML += `<div class="preview-item">... and ${queries.length - 10} more combinations</div>`;
    }
  };
  
  searchInputs.forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  
  executeBtn.addEventListener('click', () => {
    const elements = [];
    searchInputs.forEach(input => {
      if (input.value.trim()) {
        elements.push(input.value.trim());
      }
    });
    
    if (elements.length === 0) {
      return;
    }
    
    const queries = generateQueries(elements);
    
    queries.forEach((query, index) => {
      setTimeout(() => {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        chrome.tabs.create({ url: url, active: false });
      }, index * 150);
    });
  });
  
  updatePreview();
};

// Track if static elements are initialized
let staticInitialized = false;

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

const init = () => {
  // Only initialize static elements once
  if (!staticInitialized) {
    initTabs();
    initSearch();
    staticInitialized = true;
  }
  
  // Always update links for current page
  updateLinks();
};

init();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 if (changeInfo.status === 'complete' && tab.active) {
   // Only update links, not reinitialize everything
   updateLinks();
 }
});
