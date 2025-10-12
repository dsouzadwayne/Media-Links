// Settings and patterns configuration
let profileSettings = {};
let currentProfile = 1;

// Load and apply theme
const loadTheme = () => {
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'light';
    document.body.setAttribute('data-theme', theme);
  });
};

// Load and apply default search engine
const loadDefaultSearchEngine = () => {
  chrome.storage.sync.get(['defaultSearchEngine'], (result) => {
    const defaultEngine = result.defaultSearchEngine || 'google';

    // Set search engine dropdown
    const engineSelect = document.getElementById('search-engine');
    if (engineSelect) {
      engineSelect.value = defaultEngine;
    }
  });
};

// Save default search engine
const saveDefaultSearchEngine = (engine) => {
  chrome.storage.sync.set({ defaultSearchEngine: engine }, () => {
    // Update the search engine dropdown to match
    const engineSelect = document.getElementById('search-engine');
    if (engineSelect) {
      engineSelect.value = engine;
    }
  });
};

loadTheme();
loadDefaultSearchEngine();

// Load search elements from URL parameters
const loadSearchFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);

  for (let i = 1; i <= 4; i++) {
    const param = urlParams.get(`e${i}`);
    const input = document.getElementById(`search${i}`);
    if (param && input) {
      input.value = param;
    }
  }
};

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
    'second-phrase': true,
    'full-phrase': true,
    'and': true,
    'or': true,
    'first-quoted': true,
    'second-quoted': true,
    'third-quoted': true,
    'first-two-quoted': true,
    'last-two-quoted': true
  },
  4: {
    'plain': true,
    'all-quoted': true,
    'paired': true,
    'full-phrase': true,
    'and': true,
    'or': true,
    'first-three-phrase': true,
    'last-three-phrase': true,
    'first-quoted': true,
    'second-quoted': true,
    'third-quoted': true,
    'fourth-quoted': true,
    'first-two-quoted': true,
    'last-two-quoted': true,
    'middle-pair': true
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
    'second-phrase': { template: '{0} "{1} {2}"', description: 'Second as phrase' },
    'full-phrase': { template: '"{0} {1} {2}"', description: 'Full phrase' },
    'and': { template: '"{0}" AND "{1}" AND "{2}"', description: 'AND operator' },
    'or': { template: '"{0}" OR "{1}" OR "{2}"', description: 'OR operator' },
    'first-quoted': { template: '"{0}" {1} {2}', description: 'First quoted' },
    'second-quoted': { template: '{0} "{1}" {2}', description: 'Second quoted' },
    'third-quoted': { template: '{0} {1} "{2}"', description: 'Third quoted' },
    'first-two-quoted': { template: '"{0}" "{1}" {2}', description: 'First two quoted' },
    'last-two-quoted': { template: '{0} "{1}" "{2}"', description: 'Last two quoted' }
  },
  4: {
    'plain': { template: '{0} {1} {2} {3}', description: 'Plain' },
    'all-quoted': { template: '"{0}" "{1}" "{2}" "{3}"', description: 'All quoted' },
    'paired': { template: '"{0} {1}" "{2} {3}"', description: 'Paired phrases' },
    'full-phrase': { template: '"{0} {1} {2} {3}"', description: 'Full phrase' },
    'and': { template: '"{0}" AND "{1}" AND "{2}" AND "{3}"', description: 'AND operator' },
    'or': { template: '"{0}" OR "{1}" OR "{2}" OR "{3}"', description: 'OR operator' },
    'first-three-phrase': { template: '"{0} {1} {2}" {3}', description: 'First three as phrase' },
    'last-three-phrase': { template: '{0} "{1} {2} {3}"', description: 'Last three as phrase' },
    'first-quoted': { template: '"{0}" {1} {2} {3}', description: 'First quoted' },
    'second-quoted': { template: '{0} "{1}" {2} {3}', description: 'Second quoted' },
    'third-quoted': { template: '{0} {1} "{2}" {3}', description: 'Third quoted' },
    'fourth-quoted': { template: '{0} {1} {2} "{3}"', description: 'Fourth quoted' },
    'first-two-quoted': { template: '"{0}" "{1}" {2} {3}', description: 'First two quoted' },
    'last-two-quoted': { template: '{0} {1} "{2}" "{3}"', description: 'Last two quoted' },
    'middle-pair': { template: '{0} "{1} {2}" {3}', description: 'Middle pair' }
  }
};

// Utility functions
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

const generateExampleQuery = (pattern, exampleElements, wordCount) => {
  const patternInfo = patternDescriptions[wordCount][pattern];
  if (!patternInfo) return '';
  
  let example = patternInfo.template;
  exampleElements.forEach((element, index) => {
    example = example.replace(`{${index}}`, element);
  });
  return example;
};

const getProfileSettings = (profileNum) => {
  const profileKey = `profile${profileNum}`;
  if (!profileSettings[profileKey]) {
    profileSettings[profileKey] = {};
    for (let wordCount = 1; wordCount <= profileNum; wordCount++) {
      profileSettings[profileKey][wordCount] = { ...defaultPatterns[wordCount] };
    }
  }
  return profileSettings[profileKey];
};

// Initialize profile settings
const initializeProfileSettings = (profileNum) => {
  const container = document.querySelector(`.profile-settings[data-profile="${profileNum}"]`);
  if (!container) return;
  
  container.innerHTML = '';
  
  const exampleElements = ['example1', 'example2', 'example3', 'example4'].slice(0, profileNum);
  
  for (let wordCount = 1; wordCount <= profileNum; wordCount++) {
    const section = document.createElement('div');
    section.className = 'pattern-section';
    section.dataset.wordCount = wordCount;
    section.dataset.profileNum = profileNum;
    
    const profileSettings = getProfileSettings(profileNum);
    const settings = profileSettings[wordCount] || { ...defaultPatterns[wordCount] };
    
    const title = document.createElement('h4');
    const comboText = wordCount === 1 ?
      `Individual words` :
      `${wordCount}-word combinations`;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-title';
    titleSpan.textContent = comboText;

    const statusSpan = document.createElement('span');
    statusSpan.className = 'section-status';
    statusSpan.id = `status-${profileNum}-${wordCount}`;

    title.appendChild(titleSpan);
    title.appendChild(statusSpan);
    section.appendChild(title);
    
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
      const exampleCombo = exampleElements.slice(0, wordCount);
      const example = generateExampleQuery(pattern, exampleCombo, wordCount);
      const description = patternDescriptions[wordCount][pattern].description;

      const strong = document.createElement('strong');
      strong.textContent = description + ':';

      const code = document.createElement('code');
      code.textContent = example;

      span.appendChild(strong);
      span.appendChild(document.createTextNode(' '));
      span.appendChild(code);
      
      label.appendChild(checkbox);
      label.appendChild(span);
      section.appendChild(label);
    });
    
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
    
    container.appendChild(section);
    updateSectionStatus(profileNum, wordCount);
  }
};

const selectAllInSection = (profileNum, wordCount) => {
  document.querySelectorAll(`.pattern-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`).forEach(checkbox => {
    checkbox.checked = true;
  });
  updateSectionStatus(profileNum, wordCount);
};

const deselectAllInSection = (profileNum, wordCount) => {
  document.querySelectorAll(`.pattern-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`).forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSectionStatus(profileNum, wordCount);
};

const updateSectionStatus = (profileNum, wordCount) => {
  const checkboxes = document.querySelectorAll(`.pattern-section[data-word-count="${wordCount}"][data-profile-num="${profileNum}"] .query-setting`);
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  const total = checkboxes.length;
  const statusElement = document.getElementById(`status-${profileNum}-${wordCount}`);
  if (statusElement) {
    statusElement.textContent = `(${checked}/${total} active)`;
  }
};

// Storage functions
const loadSettings = () => {
  chrome.storage.sync.get(['profileSettings'], (result) => {
    profileSettings = result.profileSettings || {};
    for (let i = 1; i <= 4; i++) {
      initializeProfileSettings(i);
    }
  });
};

const saveCurrentProfileSettings = () => {
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
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
    const saveBtn = document.getElementById('save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.style.backgroundColor = '#4caf50';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
    }, 2000);
    
    updateSearchPreview();
  });
};

const resetCurrentProfileSettings = () => {
  const profileKey = `profile${currentProfile}`;
  profileSettings[profileKey] = {};
  for (let wordCount = 1; wordCount <= currentProfile; wordCount++) {
    profileSettings[profileKey][wordCount] = { ...defaultPatterns[wordCount] };
  }
  
  chrome.storage.sync.set({ profileSettings: profileSettings }, () => {
    initializeProfileSettings(currentProfile);
    const resetBtn = document.getElementById('reset-btn');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = 'Reset!';
    resetBtn.style.backgroundColor = '#4caf50';
    setTimeout(() => {
      resetBtn.textContent = originalText;
      resetBtn.style.backgroundColor = '';
    }, 2000);
    
    updateSearchPreview();
  });
};

const selectAllInCurrentProfile = () => {
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    checkbox.checked = true;
  });
  for (let i = 1; i <= currentProfile; i++) {
    updateSectionStatus(currentProfile, i);
  }
};

const deselectAllInCurrentProfile = () => {
  document.querySelectorAll(`#profile${currentProfile} .query-setting`).forEach(checkbox => {
    checkbox.checked = false;
  });
  for (let i = 1; i <= currentProfile; i++) {
    updateSectionStatus(currentProfile, i);
  }
};

// Search functions
const generateQueries = (elements) => {
  if (elements.length === 0) return [];
  
  const queries = [];
  const profileNum = elements.length;
  const profile = getProfileSettings(profileNum);
  
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
    case 'bing':
      return `https://www.bing.com/search?q=${encodedQuery}`;
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encodedQuery}`;
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
    previewList.textContent = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'preview-item';
    emptyDiv.textContent = 'Enter elements to see search combinations...';
    previewList.appendChild(emptyDiv);
    return;
  }

  previewList.textContent = '';
  queries.slice(0, 10).forEach((query, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.textContent = `${index + 1}. ${query}`;
    previewList.appendChild(previewItem);
  });

  if (queries.length > 10) {
    const moreItem = document.createElement('div');
    moreItem.className = 'preview-item';
    moreItem.textContent = `... and ${queries.length - 10} more combinations`;
    previewList.appendChild(moreItem);
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSearchFromUrl();
  loadSettings();

  // Settings button handler
  const appSettingsBtn = document.getElementById('app-settings-btn');
  if (appSettingsBtn) {
    appSettingsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
  }

  // Listen for theme changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'themeChanged') {
      document.body.setAttribute('data-theme', message.theme);
    }
  });

  const searchInputs = document.querySelectorAll('.search-element');
  const executeBtn = document.querySelector('.search-execute-btn');
  const engineSelector = document.getElementById('search-engine');

  searchInputs.forEach(input => {
    input.addEventListener('input', updateSearchPreview);
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
});
