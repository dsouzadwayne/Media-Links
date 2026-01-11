/**
 * Bookmarklet Editor
 * Main editor UI logic for creating, editing, and scheduling bookmarklets
 */

(function() {
  'use strict';

  // State
  let currentBookmarklet = null;
  let bookmarklets = {};
  let isDirty = false;

  // DOM Elements
  const elements = {
    // Sidebar
    searchInput: null,
    bookmarkletList: null,
    sidebarEmpty: null,

    // Editor
    emptyState: null,
    editorForm: null,

    // Form fields
    nameInput: null,
    descriptionInput: null,
    enabledToggle: null,
    autoRunToggle: null,
    codeEditor: null,
    scheduleType: null,
    charCount: null,
    codeStatus: null,

    // Schedule configs
    scheduleOneTime: null,
    scheduleRecurring: null,
    scheduleDomain: null,
    scheduleInterval: null,
    oneTimeDatetime: null,
    recurringFrequency: null,
    recurringTime: null,
    weeklyDaysContainer: null,
    recurringDomains: null,
    domainPatterns: null,
    domainTrigger: null,
    intervalMinutes: null,
    intervalDomains: null,
    intervalOnlyActive: null,

    // Stats
    statsSection: null,
    statCreated: null,
    statModified: null,
    statExecuted: null,
    statCount: null,

    // Buttons
    newBtn: null,
    importBtn: null,
    backBtn: null,
    saveBtn: null,
    deleteBtn: null,
    runNowBtn: null,
    duplicateBtn: null,
    formatCodeBtn: null,
    wrapIifeBtn: null,
    testCodeBtn: null,
    templateSelect: null,
    parseMetadataBtn: null,

    // Modals
    importModal: null,
    deleteModal: null,
    bookmarkTree: null,
    importSearch: null,

    // Toast
    toast: null
  };

  /**
   * Initialize the editor
   */
  async function init() {
    cacheElements();
    attachEventListeners();
    await loadBookmarklets();
    renderBookmarkletList();
    populateTemplates();

    // Apply theme
    if (typeof ThemeManager !== 'undefined') {
      try {
        await ThemeManager.whenReady();
        ThemeManager.subscribe(() => {
          // Theme changed, CSS variables update automatically
        });
      } catch (e) {
        console.warn('ThemeManager not available');
      }
    }
  }

  /**
   * Cache DOM elements
   */
  function cacheElements() {
    elements.searchInput = document.getElementById('search-bookmarklets');
    elements.bookmarkletList = document.getElementById('bookmarklet-list');
    elements.sidebarEmpty = document.getElementById('sidebar-empty');
    elements.emptyState = document.getElementById('empty-state');
    elements.editorForm = document.getElementById('editor-form');

    elements.nameInput = document.getElementById('bm-name');
    elements.descriptionInput = document.getElementById('bm-description');
    elements.enabledToggle = document.getElementById('bm-enabled');
    elements.autoRunToggle = document.getElementById('bm-autorun');
    elements.codeEditor = document.getElementById('bm-code');
    elements.scheduleType = document.getElementById('schedule-type');
    elements.charCount = document.getElementById('char-count');
    elements.codeStatus = document.getElementById('code-status');

    elements.scheduleOneTime = document.getElementById('schedule-one-time');
    elements.scheduleRecurring = document.getElementById('schedule-recurring');
    elements.scheduleDomain = document.getElementById('schedule-domain');
    elements.scheduleInterval = document.getElementById('schedule-interval');
    elements.oneTimeDatetime = document.getElementById('one-time-datetime');
    elements.recurringFrequency = document.getElementById('recurring-frequency');
    elements.recurringTime = document.getElementById('recurring-time');
    elements.weeklyDaysContainer = document.getElementById('weekly-days-container');
    elements.recurringDomains = document.getElementById('recurring-domains');
    elements.domainPatterns = document.getElementById('domain-patterns');
    elements.domainTrigger = document.getElementById('domain-trigger');
    elements.intervalMinutes = document.getElementById('interval-minutes');
    elements.intervalDomains = document.getElementById('interval-domains');
    elements.intervalOnlyActive = document.getElementById('interval-only-active');

    elements.statsSection = document.getElementById('stats-section');
    elements.statCreated = document.getElementById('stat-created');
    elements.statModified = document.getElementById('stat-modified');
    elements.statExecuted = document.getElementById('stat-executed');
    elements.statCount = document.getElementById('stat-count');

    elements.newBtn = document.getElementById('new-bookmarklet-btn');
    elements.emptyNewBtn = document.getElementById('empty-new-btn');
    elements.importBtn = document.getElementById('import-btn');
    elements.backBtn = document.getElementById('back-btn');
    elements.saveBtn = document.getElementById('save-btn');
    elements.deleteBtn = document.getElementById('delete-btn');
    elements.runNowBtn = document.getElementById('run-now-btn');
    elements.duplicateBtn = document.getElementById('duplicate-btn');
    elements.formatCodeBtn = document.getElementById('format-code-btn');
    elements.wrapIifeBtn = document.getElementById('wrap-iife-btn');
    elements.testCodeBtn = document.getElementById('test-code-btn');
    elements.templateSelect = document.getElementById('template-select');
    elements.parseMetadataBtn = document.getElementById('parse-metadata-btn');

    elements.importModal = document.getElementById('import-modal');
    elements.deleteModal = document.getElementById('delete-modal');
    elements.bookmarkTree = document.getElementById('bookmark-tree');
    elements.importSearch = document.getElementById('import-search');

    elements.toast = document.getElementById('toast');
  }

  /**
   * Attach event listeners
   */
  function attachEventListeners() {
    // Header buttons
    elements.newBtn?.addEventListener('click', createNewBookmarklet);
    elements.emptyNewBtn?.addEventListener('click', createNewBookmarklet);
    elements.importBtn?.addEventListener('click', openImportModal);
    elements.backBtn?.addEventListener('click', goBack);

    // Form buttons
    elements.saveBtn?.addEventListener('click', saveCurrentBookmarklet);
    elements.deleteBtn?.addEventListener('click', confirmDelete);
    elements.runNowBtn?.addEventListener('click', runCurrentBookmarklet);
    elements.duplicateBtn?.addEventListener('click', duplicateCurrentBookmarklet);

    // Code toolbar
    elements.formatCodeBtn?.addEventListener('click', formatCode);
    elements.wrapIifeBtn?.addEventListener('click', wrapInIife);
    elements.testCodeBtn?.addEventListener('click', testCodeSyntax);
    elements.templateSelect?.addEventListener('change', loadTemplate);
    elements.parseMetadataBtn?.addEventListener('click', parseMetadataFromCode);

    // Code editor events
    elements.codeEditor?.addEventListener('input', handleCodeInput);
    elements.codeEditor?.addEventListener('keydown', handleCodeKeydown);

    // Schedule type change
    elements.scheduleType?.addEventListener('change', handleScheduleTypeChange);
    elements.recurringFrequency?.addEventListener('change', handleFrequencyChange);

    // Search
    elements.searchInput?.addEventListener('input', handleSearch);

    // Form changes mark dirty
    elements.nameInput?.addEventListener('input', markDirty);
    elements.descriptionInput?.addEventListener('input', markDirty);
    elements.enabledToggle?.addEventListener('change', markDirty);
    elements.autoRunToggle?.addEventListener('change', markDirty);
    elements.codeEditor?.addEventListener('input', markDirty);

    // Import modal
    document.getElementById('import-modal-close')?.addEventListener('click', closeImportModal);
    document.getElementById('import-cancel-btn')?.addEventListener('click', closeImportModal);
    document.getElementById('import-confirm-btn')?.addEventListener('click', importSelectedBookmarks);
    elements.importSearch?.addEventListener('input', handleImportSearch);
    elements.importModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeImportModal);

    // Delete modal
    document.getElementById('delete-cancel-btn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('delete-confirm-btn')?.addEventListener('click', deleteCurrentBookmarklet);
    elements.deleteModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeDeleteModal);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  /**
   * Load bookmarklets from storage
   */
  async function loadBookmarklets() {
    if (window.BookmarkletStorage) {
      bookmarklets = await BookmarkletStorage.getAllBookmarklets();
    }
  }

  /**
   * Render the bookmarklet list in sidebar
   */
  function renderBookmarkletList(filter = '') {
    if (!elements.bookmarkletList) return;

    const filterLower = filter.toLowerCase();
    const filteredBookmarklets = Object.values(bookmarklets).filter(bm => {
      if (!filter) return true;
      return bm.name.toLowerCase().includes(filterLower) ||
             (bm.description && bm.description.toLowerCase().includes(filterLower));
    });

    // Sort by name
    filteredBookmarklets.sort((a, b) => a.name.localeCompare(b.name));

    elements.bookmarkletList.innerHTML = '';

    if (filteredBookmarklets.length === 0) {
      elements.sidebarEmpty.style.display = 'block';
      elements.bookmarkletList.style.display = 'none';
      return;
    }

    elements.sidebarEmpty.style.display = 'none';
    elements.bookmarkletList.style.display = 'block';

    filteredBookmarklets.forEach(bm => {
      const item = createBookmarkletListItem(bm);
      elements.bookmarkletList.appendChild(item);
    });
  }

  /**
   * Create a bookmarklet list item element
   */
  function createBookmarkletListItem(bookmarklet) {
    const item = document.createElement('div');
    item.className = 'bookmarklet-item';
    if (currentBookmarklet && currentBookmarklet.id === bookmarklet.id) {
      item.classList.add('active');
    }
    if (!bookmarklet.enabled) {
      item.classList.add('disabled');
    }
    item.dataset.id = bookmarklet.id;

    const icon = document.createElement('div');
    icon.className = 'bookmarklet-icon';
    icon.textContent = 'JS';

    const info = document.createElement('div');
    info.className = 'bookmarklet-info';

    const name = document.createElement('div');
    name.className = 'bookmarklet-name';
    name.textContent = bookmarklet.name;

    const schedule = document.createElement('div');
    schedule.className = 'bookmarklet-schedule';

    if (bookmarklet.schedule && bookmarklet.schedule.type !== 'none') {
      const badge = document.createElement('span');
      badge.className = `schedule-badge ${bookmarklet.schedule.type}`;
      badge.textContent = getScheduleLabel(bookmarklet.schedule.type);
      schedule.appendChild(badge);
    }

    info.appendChild(name);
    info.appendChild(schedule);

    item.appendChild(icon);
    item.appendChild(info);

    item.addEventListener('click', () => selectBookmarklet(bookmarklet.id));

    return item;
  }

  /**
   * Get human-readable schedule type label
   */
  function getScheduleLabel(type) {
    const labels = {
      'none': 'Manual',
      'one-time': 'One-time',
      'recurring': 'Recurring',
      'domain': 'Domain',
      'interval': 'Interval'
    };
    return labels[type] || type;
  }

  /**
   * Select a bookmarklet for editing
   */
  async function selectBookmarklet(id) {
    if (isDirty) {
      const confirmed = confirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }

    currentBookmarklet = bookmarklets[id] || null;
    isDirty = false;

    if (currentBookmarklet) {
      showEditor();
      populateForm(currentBookmarklet);
    } else {
      showEmptyState();
    }

    // Update active state in list
    document.querySelectorAll('.bookmarklet-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === id);
    });
  }

  /**
   * Show the editor form
   */
  function showEditor() {
    elements.emptyState.style.display = 'none';
    elements.editorForm.style.display = 'block';
  }

  /**
   * Show the empty state
   */
  function showEmptyState() {
    elements.emptyState.style.display = 'flex';
    elements.editorForm.style.display = 'none';
  }

  /**
   * Populate form with bookmarklet data
   */
  function populateForm(bookmarklet) {
    elements.nameInput.value = bookmarklet.name || '';
    elements.descriptionInput.value = bookmarklet.description || '';
    elements.enabledToggle.checked = bookmarklet.enabled !== false;
    elements.autoRunToggle.checked = bookmarklet.autoRun === true;
    elements.codeEditor.value = bookmarklet.code || '';
    updateCharCount();

    // Schedule
    const schedule = bookmarklet.schedule || { type: 'none', config: {} };
    elements.scheduleType.value = schedule.type;
    handleScheduleTypeChange();

    // Populate schedule config
    switch (schedule.type) {
      case 'one-time':
        if (schedule.config.datetime) {
          const date = new Date(schedule.config.datetime);
          elements.oneTimeDatetime.value = formatDatetimeLocal(date);
        }
        break;

      case 'recurring':
        elements.recurringFrequency.value = schedule.config.frequency || 'daily';
        elements.recurringTime.value = schedule.config.time || '09:00';
        elements.recurringDomains.value = (schedule.config.domains || []).join(', ');
        handleFrequencyChange();
        if (schedule.config.days) {
          document.querySelectorAll('#weekly-days-container input').forEach(cb => {
            cb.checked = schedule.config.days.includes(parseInt(cb.value));
          });
        }
        break;

      case 'domain':
        elements.domainPatterns.value = (schedule.config.domains || []).join(', ');
        elements.domainTrigger.value = schedule.config.trigger || 'pageload';
        break;

      case 'interval':
        elements.intervalMinutes.value = schedule.config.intervalMinutes || 30;
        elements.intervalDomains.value = (schedule.config.domains || []).join(', ');
        elements.intervalOnlyActive.checked = schedule.config.onlyWhenActive !== false;
        break;
    }

    // Stats
    if (bookmarklet.createdAt) {
      elements.statsSection.style.display = 'block';
      elements.statCreated.textContent = formatDate(bookmarklet.createdAt);
      elements.statModified.textContent = formatDate(bookmarklet.updatedAt);
      elements.statExecuted.textContent = bookmarklet.lastExecuted ? formatDate(bookmarklet.lastExecuted) : 'Never';
      elements.statCount.textContent = bookmarklet.executionCount || 0;
    } else {
      elements.statsSection.style.display = 'none';
    }

    // Update button states
    elements.deleteBtn.style.display = bookmarklet.id ? 'inline-flex' : 'none';
    elements.duplicateBtn.style.display = bookmarklet.id ? 'inline-flex' : 'none';
  }

  /**
   * Create a new bookmarklet
   */
  function createNewBookmarklet() {
    if (isDirty) {
      const confirmed = confirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }

    currentBookmarklet = {
      name: '',
      description: '',
      code: '',
      enabled: true,
      autoRun: false,
      schedule: { type: 'none', config: {} }
    };

    isDirty = false;
    showEditor();
    populateForm(currentBookmarklet);
    elements.nameInput.focus();

    // Clear active state in list
    document.querySelectorAll('.bookmarklet-item').forEach(item => {
      item.classList.remove('active');
    });
  }

  /**
   * Save the current bookmarklet
   */
  async function saveCurrentBookmarklet() {
    if (!currentBookmarklet) return;

    // Validate
    const name = elements.nameInput.value.trim();
    if (!name) {
      showToast('Name is required', 'error');
      elements.nameInput.focus();
      return;
    }

    const code = elements.codeEditor.value.trim();
    if (!code) {
      showToast('Code is required', 'error');
      elements.codeEditor.focus();
      return;
    }

    // Validate domain patterns for domain trigger
    const scheduleType = elements.scheduleType.value;
    if (scheduleType === 'domain') {
      const patterns = elements.domainPatterns.value.trim();
      if (!patterns) {
        showToast('Domain patterns are required for domain trigger', 'error');
        elements.domainPatterns.focus();
        return;
      }
    }

    // Build bookmarklet object
    currentBookmarklet.name = name;
    currentBookmarklet.description = elements.descriptionInput.value.trim();
    currentBookmarklet.code = code;
    currentBookmarklet.enabled = elements.enabledToggle.checked;
    currentBookmarklet.autoRun = elements.autoRunToggle.checked;
    currentBookmarklet.schedule = buildScheduleConfig();

    try {
      const saved = await BookmarkletStorage.saveBookmarklet(currentBookmarklet);
      currentBookmarklet = saved;
      bookmarklets[saved.id] = saved;

      // Update schedule if needed
      await updateSchedule(saved);

      isDirty = false;
      renderBookmarkletList(elements.searchInput.value);
      populateForm(saved);
      showToast('Bookmarklet saved', 'success');
    } catch (error) {
      console.error('Error saving bookmarklet:', error);
      showToast('Failed to save: ' + error.message, 'error');
    }
  }

  /**
   * Build schedule configuration from form
   */
  function buildScheduleConfig() {
    const type = elements.scheduleType.value;
    const config = {};

    switch (type) {
      case 'one-time':
        const datetime = elements.oneTimeDatetime.value;
        if (datetime) {
          config.datetime = new Date(datetime).getTime();
        }
        break;

      case 'recurring':
        config.frequency = elements.recurringFrequency.value;
        config.time = elements.recurringTime.value;
        if (config.frequency === 'weekly') {
          config.days = [];
          document.querySelectorAll('#weekly-days-container input:checked').forEach(cb => {
            config.days.push(parseInt(cb.value));
          });
        }
        const recurringDomains = elements.recurringDomains.value.trim();
        if (recurringDomains) {
          config.domains = recurringDomains.split(',').map(d => d.trim()).filter(d => d);
        }
        break;

      case 'domain':
        const patterns = elements.domainPatterns.value.trim();
        config.domains = patterns.split(',').map(d => d.trim()).filter(d => d);
        config.trigger = elements.domainTrigger.value;
        break;

      case 'interval':
        config.intervalMinutes = parseInt(elements.intervalMinutes.value) || 30;
        const intervalDomains = elements.intervalDomains.value.trim();
        if (intervalDomains) {
          config.domains = intervalDomains.split(',').map(d => d.trim()).filter(d => d);
        }
        config.onlyWhenActive = elements.intervalOnlyActive.checked;
        break;
    }

    return { type, config };
  }

  /**
   * Update schedule via background script
   */
  async function updateSchedule(bookmarklet) {
    if (!chrome.runtime?.id) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'updateBookmarkletSchedule',
        bookmarklet: bookmarklet
      });
    } catch (error) {
      console.warn('Failed to update schedule:', error);
    }
  }

  /**
   * Delete the current bookmarklet
   */
  async function deleteCurrentBookmarklet() {
    if (!currentBookmarklet || !currentBookmarklet.id) return;

    try {
      // Cancel any scheduled alarms
      await chrome.runtime.sendMessage({
        type: 'cancelBookmarkletSchedule',
        bookmarkletId: currentBookmarklet.id
      });

      await BookmarkletStorage.deleteBookmarklet(currentBookmarklet.id);
      delete bookmarklets[currentBookmarklet.id];

      currentBookmarklet = null;
      isDirty = false;

      closeDeleteModal();
      renderBookmarkletList(elements.searchInput.value);
      showEmptyState();
      showToast('Bookmarklet deleted', 'success');
    } catch (error) {
      console.error('Error deleting bookmarklet:', error);
      showToast('Failed to delete: ' + error.message, 'error');
    }
  }

  /**
   * Duplicate the current bookmarklet
   */
  async function duplicateCurrentBookmarklet() {
    if (!currentBookmarklet) return;

    const duplicate = {
      name: currentBookmarklet.name + ' (Copy)',
      description: currentBookmarklet.description,
      code: currentBookmarklet.code,
      enabled: currentBookmarklet.enabled,
      autoRun: currentBookmarklet.autoRun,
      schedule: { type: 'none', config: {} } // Don't duplicate schedule
    };

    try {
      const saved = await BookmarkletStorage.saveBookmarklet(duplicate);
      bookmarklets[saved.id] = saved;
      renderBookmarkletList(elements.searchInput.value);
      selectBookmarklet(saved.id);
      showToast('Bookmarklet duplicated', 'success');
    } catch (error) {
      console.error('Error duplicating bookmarklet:', error);
      showToast('Failed to duplicate: ' + error.message, 'error');
    }
  }

  /**
   * Run the current bookmarklet
   */
  async function runCurrentBookmarklet() {
    if (!currentBookmarklet) return;

    const code = elements.codeEditor.value.trim();
    if (!code) {
      showToast('No code to run', 'error');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'runBookmarkletInActiveTab',
        code: code,
        title: elements.nameInput.value || 'Untitled'
      });

      if (response?.success) {
        showToast('Bookmarklet executed', 'success');
        // Update stats if saved
        if (currentBookmarklet.id) {
          await BookmarkletStorage.updateBookmarkletStats(currentBookmarklet.id);
          currentBookmarklet = await BookmarkletStorage.getBookmarklet(currentBookmarklet.id);
          bookmarklets[currentBookmarklet.id] = currentBookmarklet;
          populateForm(currentBookmarklet);
        }
      } else {
        showToast('Execution failed: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error running bookmarklet:', error);
      showToast('Failed to run: ' + error.message, 'error');
    }
  }

  /**
   * Confirm delete action
   */
  function confirmDelete() {
    if (!currentBookmarklet) return;

    document.getElementById('delete-name').textContent = currentBookmarklet.name || 'Untitled';
    elements.deleteModal.style.display = 'flex';
  }

  /**
   * Close delete modal
   */
  function closeDeleteModal() {
    elements.deleteModal.style.display = 'none';
  }

  /**
   * Handle schedule type change
   */
  function handleScheduleTypeChange() {
    const type = elements.scheduleType.value;

    // Hide all configs
    elements.scheduleOneTime.style.display = 'none';
    elements.scheduleRecurring.style.display = 'none';
    elements.scheduleDomain.style.display = 'none';
    elements.scheduleInterval.style.display = 'none';

    // Show selected config
    switch (type) {
      case 'one-time':
        elements.scheduleOneTime.style.display = 'block';
        // Set default to tomorrow
        if (!elements.oneTimeDatetime.value) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          elements.oneTimeDatetime.value = formatDatetimeLocal(tomorrow);
        }
        break;
      case 'recurring':
        elements.scheduleRecurring.style.display = 'block';
        handleFrequencyChange();
        break;
      case 'domain':
        elements.scheduleDomain.style.display = 'block';
        break;
      case 'interval':
        elements.scheduleInterval.style.display = 'block';
        break;
    }

    markDirty();
  }

  /**
   * Handle recurring frequency change
   */
  function handleFrequencyChange() {
    const frequency = elements.recurringFrequency.value;
    elements.weeklyDaysContainer.style.display = frequency === 'weekly' ? 'block' : 'none';
  }

  /**
   * Handle search input
   */
  function handleSearch() {
    const filter = elements.searchInput.value;
    renderBookmarkletList(filter);
  }

  /**
   * Handle code input
   */
  function handleCodeInput() {
    updateCharCount();
    clearCodeStatus();
  }

  /**
   * Update character count
   */
  function updateCharCount() {
    const count = elements.codeEditor.value.length;
    elements.charCount.textContent = `${count} characters`;
  }

  /**
   * Clear code status
   */
  function clearCodeStatus() {
    elements.codeStatus.textContent = '';
    elements.codeStatus.className = 'code-status';
  }

  /**
   * Handle code editor keydown for tab support
   */
  function handleCodeKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = elements.codeEditor.selectionStart;
      const end = elements.codeEditor.selectionEnd;
      const value = elements.codeEditor.value;

      elements.codeEditor.value = value.substring(0, start) + '  ' + value.substring(end);
      elements.codeEditor.selectionStart = elements.codeEditor.selectionEnd = start + 2;
      markDirty();
    }
  }

  /**
   * Format code (basic formatting)
   */
  function formatCode() {
    let code = elements.codeEditor.value;

    // Basic formatting: add newlines after semicolons and braces
    code = code.replace(/;\s*/g, ';\n');
    code = code.replace(/\{\s*/g, '{\n  ');
    code = code.replace(/\}\s*/g, '\n}\n');
    code = code.trim();

    elements.codeEditor.value = code;
    updateCharCount();
    markDirty();
    showToast('Code formatted', 'info');
  }

  /**
   * Wrap code in IIFE
   */
  function wrapInIife() {
    let code = elements.codeEditor.value.trim();

    // Check if already wrapped
    if (code.startsWith('(function()') || code.startsWith('(() =>')) {
      showToast('Code is already wrapped', 'info');
      return;
    }

    code = `(function() {\n  ${code.split('\n').join('\n  ')}\n})();`;

    elements.codeEditor.value = code;
    updateCharCount();
    markDirty();
    showToast('Wrapped in IIFE', 'success');
  }

  /**
   * Test code syntax
   */
  function testCodeSyntax() {
    const code = elements.codeEditor.value;

    try {
      new Function(code);
      elements.codeStatus.textContent = 'Syntax OK';
      elements.codeStatus.className = 'code-status success';
    } catch (error) {
      elements.codeStatus.textContent = error.message;
      elements.codeStatus.className = 'code-status error';
    }
  }

  /**
   * Load template from dropdown
   */
  function loadTemplate() {
    const selectedIndex = parseInt(elements.templateSelect.value);
    if (isNaN(selectedIndex) || selectedIndex < 0) return;

    if (typeof BookmarkletParser === 'undefined') {
      showToast('Template system not available', 'error');
      return;
    }

    const templates = BookmarkletParser.getTemplates();
    if (selectedIndex >= templates.length) return;

    const template = templates[selectedIndex];

    if (isDirty) {
      const confirmed = confirm('Loading a template will replace your current code. Continue?');
      if (!confirmed) {
        elements.templateSelect.value = '';
        return;
      }
    }

    // Parse the template to extract metadata and code
    const { code, options } = BookmarkletParser.parseMetadataBlock(template.code);

    // Populate form fields
    if (options.name && !elements.nameInput.value) {
      elements.nameInput.value = options.name;
    }
    if (options.description && !elements.descriptionInput.value) {
      elements.descriptionInput.value = options.description;
    }

    // Set code (keep the full template with metadata for reference)
    elements.codeEditor.value = template.code;
    updateCharCount();
    markDirty();

    // Reset dropdown
    elements.templateSelect.value = '';

    showToast(`Loaded "${template.name}" template`, 'success');
  }

  /**
   * Parse metadata block from code and populate form fields
   */
  function parseMetadataFromCode() {
    if (typeof BookmarkletParser === 'undefined') {
      showToast('Parser not available', 'error');
      return;
    }

    const code = elements.codeEditor.value;
    if (!code.includes('==Bookmarklet==')) {
      showToast('No metadata block found in code', 'info');
      return;
    }

    const { code: cleanCode, options, errors } = BookmarkletParser.parseMetadataBlock(code);

    if (errors && errors.length > 0) {
      showToast(`Parsing errors: ${errors.join(', ')}`, 'error');
      return;
    }

    // Populate form fields from metadata
    if (options.name) {
      elements.nameInput.value = options.name;
    }
    if (options.description) {
      elements.descriptionInput.value = options.description;
    }

    // Replace code with clean version (metadata stripped)
    elements.codeEditor.value = cleanCode;
    updateCharCount();
    markDirty();

    // Show what was extracted
    const extractedFields = [];
    if (options.name) extractedFields.push('name');
    if (options.description) extractedFields.push('description');
    if (options.script) extractedFields.push(`${options.script.length} script(s)`);
    if (options.style) extractedFields.push(`${options.style.length} style(s)`);

    if (extractedFields.length > 0) {
      showToast(`Extracted: ${extractedFields.join(', ')}`, 'success');
    } else {
      showToast('No metadata fields found', 'info');
    }
  }

  /**
   * Populate template dropdown with available templates
   */
  function populateTemplates() {
    if (!elements.templateSelect) return;
    if (typeof BookmarkletParser === 'undefined') return;

    const templates = BookmarkletParser.getTemplates();

    // Clear existing options (except first placeholder)
    while (elements.templateSelect.options.length > 1) {
      elements.templateSelect.remove(1);
    }

    // Add templates
    templates.forEach((template, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = template.name;
      option.title = template.description;
      elements.templateSelect.appendChild(option);
    });
  }

  /**
   * Mark form as dirty (unsaved changes)
   */
  function markDirty() {
    isDirty = true;
  }

  /**
   * Go back to settings
   */
  function goBack() {
    if (isDirty) {
      const confirmed = confirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }

    // Try to close tab or go back
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  }

  /**
   * Handle global keyboard shortcuts
   */
  function handleGlobalKeydown(e) {
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentBookmarklet();
    }

    // Ctrl/Cmd + N = New
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewBookmarklet();
    }

    // Escape = Close modals
    if (e.key === 'Escape') {
      if (elements.importModal.style.display !== 'none') {
        closeImportModal();
      }
      if (elements.deleteModal.style.display !== 'none') {
        closeDeleteModal();
      }
    }
  }

  // ============ Import Modal ============

  /**
   * Open import modal
   */
  async function openImportModal() {
    elements.importModal.style.display = 'flex';
    elements.importSearch.value = '';

    try {
      const tree = await chrome.bookmarks.getTree();
      renderBookmarkTree(tree[0]);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      elements.bookmarkTree.innerHTML = '<p style="color: var(--text-secondary);">Failed to load bookmarks</p>';
    }
  }

  /**
   * Close import modal
   */
  function closeImportModal() {
    elements.importModal.style.display = 'none';
  }

  /**
   * Render bookmark tree
   */
  function renderBookmarkTree(node, container = elements.bookmarkTree) {
    container.innerHTML = '';
    renderBookmarkNode(node, container);
  }

  /**
   * Render a bookmark node recursively
   */
  function renderBookmarkNode(node, container, depth = 0) {
    if (node.children) {
      // Folder
      if (node.title) {
        const folder = document.createElement('div');
        folder.className = 'bookmark-folder';

        const header = document.createElement('div');
        header.className = 'folder-header';
        header.innerHTML = `<span class="folder-icon">&#9660;</span> ${escapeHtml(node.title)}`;
        header.addEventListener('click', () => {
          header.classList.toggle('collapsed');
        });

        const children = document.createElement('div');
        children.className = 'folder-children';

        folder.appendChild(header);
        folder.appendChild(children);
        container.appendChild(folder);

        node.children.forEach(child => renderBookmarkNode(child, children, depth + 1));
      } else {
        // Root node
        node.children.forEach(child => renderBookmarkNode(child, container, depth));
      }
    } else if (node.url) {
      // Bookmark
      const item = document.createElement('label');
      item.className = 'bookmark-item-import';

      const isBookmarklet = node.url.startsWith('javascript:');
      if (!isBookmarklet) {
        item.classList.add('not-bookmarklet');
      }

      item.innerHTML = `
        <input type="checkbox" value="${node.id}" ${isBookmarklet ? '' : 'disabled'}>
        <span class="bookmark-title">${escapeHtml(node.title || 'Untitled')}</span>
      `;

      item.dataset.title = (node.title || '').toLowerCase();
      item.dataset.url = node.url;

      container.appendChild(item);
    }
  }

  /**
   * Handle import search
   */
  function handleImportSearch() {
    const filter = elements.importSearch.value.toLowerCase();

    document.querySelectorAll('.bookmark-item-import').forEach(item => {
      const title = item.dataset.title || '';
      const matches = !filter || title.includes(filter);
      item.style.display = matches ? 'flex' : 'none';
    });
  }

  /**
   * Import selected bookmarks
   */
  async function importSelectedBookmarks() {
    const selected = [];

    document.querySelectorAll('.bookmark-item-import input:checked').forEach(cb => {
      const item = cb.closest('.bookmark-item-import');
      selected.push({
        title: item.querySelector('.bookmark-title').textContent,
        url: item.dataset.url
      });
    });

    if (selected.length === 0) {
      showToast('No bookmarklets selected', 'error');
      return;
    }

    try {
      const imported = await BookmarkletStorage.importFromBrowserBookmarks(selected);
      imported.forEach(bm => {
        bookmarklets[bm.id] = bm;
      });

      closeImportModal();
      renderBookmarkletList(elements.searchInput.value);
      showToast(`Imported ${imported.length} bookmarklet(s)`, 'success');

      if (imported.length > 0) {
        selectBookmarklet(imported[0].id);
      }
    } catch (error) {
      console.error('Error importing bookmarks:', error);
      showToast('Failed to import: ' + error.message, 'error');
    }
  }

  // ============ Utilities ============

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;

    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  /**
   * Format date for display
   */
  function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Format date for datetime-local input
   */
  function formatDatetimeLocal(date) {
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
