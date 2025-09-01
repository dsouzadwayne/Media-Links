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
      
      // Update settings when settings tab is clicked
      if (targetTab === 'settings') {
        updateDynamicSettings();
      }
    });
  });
};

// Settings functionality
let profileSettings = {};
let currentElements = [];

const defaultPatterns = {
  1: {
    'plain': true,
    'quoted': true,
    'intitle': true,
    'allintitle': true,
    'intext': true
  },
  2: {
    'plain': true,
    'first-quoted': true,
    'second-quoted': true,
    'both-quoted': true,
    'phrase': true,
    'intitle': true,
    'and': true,
    'or': true
  },
  3: {
    'plain': true,
    'all-quoted': true,
    'first-phrase': true,
    'full-phrase': true,
    'and': true
  },
  4: {
    'plain': true,
    'all-quoted': true,
    'paired': true,
    'full-phrase': true,
    'and': true
  }
};

const patternDescriptions = {
  1: {
    'plain': { template: '{0}', description: 'Plain text' },
    'quoted': { template: '"{0}"', description: 'Quoted' },
    'intitle': { template: 'intitle:"{0}"', description: 'In title' },
    'allintitle': { template: 'allintitle:{0}', description: 'All in title' },
    'intext': { template: 'intext:"{0}"', description: 'In text' }
  },
  2: {
    'plain': { template: '{0} {1}', description: 'Plain' },
    'first-quoted': { template: '"{0}" {1}', description: 'First quoted' },
    'second-quoted': { template: '{0} "{1}"', description: 'Second quoted' },
    'both-quoted': { template: '"{0}" "{1}"', description: 'Both quoted' },
    'phrase': { template: '"{0} {1}"', description: 'As phrase' },
    'intitle': { template: 'intitle:"{0}" {1}', description: 'Title search' },
    'and': { template: '"{0}" AND "{1}"', description: 'AND operator' },
    'or': { template: '"{0}" OR "{1}"', description: 'OR operator' }
  },
  3: {
    'plain': { template: '{0} {1} {2}', description: 'Plain' },
    'all-quoted': { template: '"{0}" "{1}" "{2}"', description: 'All quoted' },
    'first-phrase': { template: '"{0} {1}" {2}', description: 'First as phrase' },
    'full-phrase': { template: '"{0} {1} {2}"', description: 'Full phrase' },
    'and': { template: '"{0}" AND "{1}" AND "{2}"', description: 'AND operator' }
  },
  4: {
    'plain': { template: '{0} {1} {2} {3}', description: 'Plain' },
    'all-quoted': { template: '"{0}" "{1}" "{2}" "{3}"', description: 'All quoted' },
    'paired': { template: '"{0} {1}" "{2} {3}"', description: 'Paired phrases' },
    'full-phrase': { template: '"{0} {1} {2} {3}"', description: 'Full phrase' },
    'and': { template: '"{0}" AND "{1}" AND "{2}" AND "{3}"', description: 'AND operator' }
  }
};

// Generate all combinations of elements for a given size
const getCombinations = (elements, size) => {
  if (size === 1) {
    return elements.map(el => [el]);
  }
  
  const combinations = [];
  
  function combine(start, combo) {
    if (combo.length === size) {
      combinations.push([...combo]);
      return;
    }
    
    for (let i = start; i < elements.length; i++) {
      combo.push(elements[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  
  combine(0, []);
  return combinations;
};

const getCurrentElements = () => {
  const elements = [];
  document.querySelectorAll('.search-element').forEach(input => {
    if (input.value.trim()) {
      elements.push(input.value.trim());
    }
  });
  return elements;
};

const generateExampleQuery = (pattern, elements, wordCount) => {
  const patternInfo = patternDescriptions[wordCount][pattern];
  if (!patternInfo) return '';
  
  let example = patternInfo.template;
  elements.forEach((element, index) => {
    example = example.replace(`{${index}}`, element);
  });
  return example;
};

const getProfileSettings = (profileNum) => {
  const profileKey = `profile${profileNum}`;
  if (!profileSettings[profileKey]) {
    profileSettings[profileKey] = {};
    // Initialize with defaults for each word count
    for (let wordCount = 1; wordCount <= profileNum; wordCount++) {
      profileSettings[profileKey][wordCount] = { ...defaultPatterns[wordCount] };
    }
  }
  return profileSettings[profileKey];
};

const updateDynamicSettings = () => {
  const elements = getCurrentElements();
  currentElements = elements;
  const container = document.getElementById('dynamic-settings');
  
  if (elements.length === 0) {
    container.innerHTML = `
      <div class="no-elements-message">
        <p>Enter search elements in the Search tab to see available pattern options</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  const profileNum = elements.length;
  const profileTitle = document.createElement('div');
  profileTitle.className = 'profile-title';
  profileTitle.innerHTML = `<h5>Profile: ${profileNum} Element${profileNum > 1 ? 's' : ''}</h5>`;
  container.appendChild(profileTitle);
  
  // Create settings sections for each word count
  for (let wordCount = 1; wordCount <= Math.min(elements.length, 4); wordCount++) {
    const section = createSettingsSection(wordCount, elements, profileNum);
    container.appendChild(section);
  }
};

const createSettingsSection = (wordCount, elements, profileNum) => {
  const section = document.createElement('div');
  section.className = 'settings-section';
  section.dataset.wordCount = wordCount;
  section.dataset.profileNum = profileNum;
  
  const profileSettings = getProfileSettings(profileNum);
  const settings = profileSettings[wordCount] || { ...defaultPatterns[wordCount] };
  
  const title = document.createElement('h5');
  const combinations = getCombinations(elements, wordCount);
  const comboText = wordCount === 1 ? 
    `Individual words (${combinations.length} searches)` :
    `${wordCount}-word combinations (${combinations.length} searches)`;
  
  title.innerHTML = `
    <span class="section-title">${comboText}</span>
    <span class="section-status" id="status-${profileNum}-${wordCount}"></span>
  `;
  section.appendChild(title);
  
  // Show some example combinations
  const examplesDiv = document.createElement('div');
  examplesDiv.className = 'combination-examples';
  const exampleCombos = combinations.slice(0, 3);
  const exampleText = exampleCombos.map(combo => combo.join(' + ')).join(', ');
  if (combinations.length > 3) {
    examplesDiv.innerHTML = `<small>Examples: ${exampleText}, ...</small>`;
  } else {
    examplesDiv.innerHTML = `<small>Combinations: ${exampleText}</small>`;
  }
  section.appendChild(examplesDiv);
  
  const patterns = Object.keys(patternDescriptions[wordCount] || {});
  
  patterns.forEach(pattern => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'query-setting';
    checkbox.dataset.pattern = pattern;
    checkbox.dataset.wordCount = wordCount;
    checkbox.dataset.profileNum = profileNum;
    checkbox.checked = settings[pattern] !== false;
    
    const span = document.createElement('span');
    // Use first combination as example
    const exampleCombo = combinations[0] || [];
    const example = generateExampleQuery(pattern, exampleCombo, wordCount);
    const description = patternDescriptions[wordCount][pattern].description;
    span.innerHTML = `<strong>${description}:</strong> <code>${example}</code>`;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    section.appendChild(label);
  });
  
  // Add section-specific actions
  const sectionActions = document.createElement('div');
  sectionActions.className = 'section-actions';
  
  const selectAllBtn = document.createElement('button');
  selectAllBtn.textContent = 'Select All';
  selectAllBtn.className = 'section-select-all-btn';
  selectAllBtn.onclick = () => selectAllInSection(profileNum, wordCount);
  
  const deselectAllBtn = document.createElement('button');
  deselectAllBtn.textContent = 'Deselect All';
  deselectAllBtn.className = 'section-deselect-all-btn';
  deselectAllBtn.onclick = () => deselectAllInSection(profileNum, wordCount);
  
  sectionActions.appendChild(selectAllBtn);
  sectionActions.appendChild(deselectAllBtn);
  section.appendChild(sectionActions);
  
  updateSectionStatus(profileNum, wordCount);
  
  return section;
};

const selectAllInSection = (profileNum, wordCount) => {
  document.querySelectorAll(`.settings-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`).forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSectionStatus(profileNum, wordCount);
};

const deselectAllInSection = (profileNum, wordCount) => {
  document.querySelectorAll(`.settings-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`).forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSectionStatus(profileNum, wordCount);
};

const updateSectionStatus = (profileNum, wordCount) => {
  const checkboxes = document.querySelectorAll(`.settings-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`);
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  const total = checkboxes.length;
  const statusElement = document.getElementById(`status-${profileNum}-${wordCount}`);
  if (statusElement) {
    statusElement.textContent = `(${checked}/${total} active)`;
  }
};

const loadSettings = () => {
  chrome.storage.sync.get(['profileSettings'], (result) => {
    profileSettings = result.profileSettings || {};
  });
};

const saveSettings = () => {
  // Save current visible settings
  document.querySelectorAll('.query-setting').forEach(checkbox => {
    const profileNum = parseInt(checkbox.dataset.profileNum);
    const wordCount = parseInt(checkbox.dataset.wordCount);
    const pattern = checkbox.dataset.pattern;
    
    const profileKey = `profile${profileNum}`;
    if (!profileSettings[profileKey]) {
      profileSettings[profileKey] = {};
    }
    if (!profileSettings[profileKey][wordCount]) {
      profileSettings[profileKey][wordCount] = {};
    }
    
    profileSettings[profileKey][wordCount][pattern] = checkbox.checked;
  });
  
  chrome.storage.sync.set({ profileSettings: profileSettings }, () => {
    // Show save confirmation
    const saveBtn = document.querySelector('.settings-save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.style.backgroundColor = '#4caf50';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
    }, 2000);
    
    // Update preview
    updateSearchPreview();
  });
};

const resetSettings = () => {
  // Reset current profile to defaults
  const elements = getCurrentElements();
  const profileNum = elements.length;
  const profileKey = `profile${profileNum}`;
  
  profileSettings[profileKey] = {};
  for (let wordCount = 1; wordCount <= profileNum; wordCount++) {
    profileSettings[profileKey][wordCount] = { ...defaultPatterns[wordCount] };
  }
  
  chrome.storage.sync.set({ profileSettings: profileSettings }, () => {
    updateDynamicSettings();
    // Show reset confirmation
    const resetBtn = document.querySelector('.settings-reset-btn');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = 'Reset!';
    resetBtn.style.backgroundColor = '#4caf50';
    setTimeout(() => {
      resetBtn.textContent = originalText;
      resetBtn.style.backgroundColor = '';
    }, 2000);
    
    // Update preview
    updateSearchPreview();
  });
};

const selectAllSettings = () => {
  document.querySelectorAll('.query-setting').forEach(checkbox => {
    checkbox.checked = true;
  });
  // Update all section statuses
  const elements = getCurrentElements();
  const profileNum = elements.length;
  for (let i = 1; i <= profileNum; i++) {
    updateSectionStatus(profileNum, i);
  }
};

const deselectAllSettings = () => {
  document.querySelectorAll('.query-setting').forEach(checkbox => {
    checkbox.checked = false;
  });
  // Update all section statuses
  const elements = getCurrentElements();
  const profileNum = elements.length;
  for (let i = 1; i <= profileNum; i++) {
    updateSectionStatus(profileNum, i);
  }
};

const initSettings = () => {
  loadSettings();
  
  document.querySelector('.settings-save-btn').addEventListener('click', saveSettings);
  document.querySelector('.settings-reset-btn').addEventListener('click', resetSettings);
  document.querySelector('.settings-select-all-btn').addEventListener('click', selectAllSettings);
  document.querySelector('.settings-deselect-all-btn').addEventListener('click', deselectAllSettings);
  
  // Add event listener for checkbox changes to update section status
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('query-setting')) {
      const profileNum = parseInt(e.target.dataset.profileNum);
      const wordCount = parseInt(e.target.dataset.wordCount);
      updateSectionStatus(profileNum, wordCount);
    }
  });
};

// Search functionality with settings integration
const generateQueries = (elements) => {
  if (elements.length === 0) return [];
  
  const queries = [];
  const profileNum = elements.length;
  const profile = getProfileSettings(profileNum);
  
  // Generate queries for each word count
  for (let wordCount = 1; wordCount <= Math.min(elements.length, 4); wordCount++) {
    const settings = profile[wordCount] || defaultPatterns[wordCount];
    const patterns = patternDescriptions[wordCount];
    const combinations = getCombinations(elements, wordCount);
    
    combinations.forEach(combo => {
      Object.keys(patterns).forEach(pattern => {
        if (settings[pattern] !== false) {
          let query = patterns[pattern].template;
          combo.forEach((element, index) => {
            query = query.replace(`{${index}}`, element);
          });
          queries.push(query);
        }
      });
    });
  }
  
  return queries;
};

const getSearchUrl = (query, engine) => {
  const encodedQuery = encodeURIComponent(query);
  switch(engine) {
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${encodedQuery}`;
    case 'google-ai':
      return `https://www.google.com/search?q=${encodedQuery}&udm=50&aep=11`;
    case 'google':
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
};

const updateSearchPreview = () => {
  const previewList = document.getElementById('preview-list');
  if (!previewList) return;
  
  const elements = getCurrentElements();
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

const initSearch = () => {
  const searchInputs = document.querySelectorAll('.search-element');
  const executeBtn = document.querySelector('.search-execute-btn');
  const engineSelector = document.getElementById('search-engine');
  
  searchInputs.forEach(input => {
    input.addEventListener('input', () => {
      updateSearchPreview();
      // Update settings if settings tab is active
      const settingsTab = document.getElementById('settings-tab');
      if (settingsTab && settingsTab.classList.contains('active')) {
        updateDynamicSettings();
      }
    });
  });
  
  executeBtn.addEventListener('click', () => {
    const elements = getCurrentElements();
    
    if (elements.length === 0) {
      return;
    }
    
    const queries = generateQueries(elements);
    const selectedEngine = engineSelector.value;
    
    queries.forEach((query, index) => {
      setTimeout(() => {
        const url = getSearchUrl(query, selectedEngine);
        chrome.tabs.create({ url: url, active: false });
      }, index * 150);
    });
  });
  
  updateSearchPreview();
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
    initSettings();
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
