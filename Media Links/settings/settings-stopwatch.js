// Settings Stopwatch Module - Stopwatch feature with domain configuration
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // ==========================================
  // Toggle Functions
  // ==========================================

  function toggleStopwatchSettings(enabled) {
    const subsection = document.getElementById('stopwatch-options');
    if (subsection) {
      if (enabled) {
        subsection.style.opacity = '1';
        subsection.style.pointerEvents = 'auto';
        subsection.setAttribute('aria-disabled', 'false');
        const inputs = subsection.querySelectorAll('input, select');
        inputs.forEach(input => {
          if (input.id === 'stopwatch-notification-minutes') {
            const notifEnabled = document.getElementById('stopwatch-notification-enabled');
            input.disabled = !(notifEnabled && notifEnabled.checked);
          } else {
            input.disabled = false;
          }
        });
      } else {
        subsection.style.opacity = '0.5';
        subsection.style.pointerEvents = 'none';
        subsection.setAttribute('aria-disabled', 'true');
        const inputs = subsection.querySelectorAll('input, select');
        inputs.forEach(input => {
          input.disabled = true;
        });
      }
    }
  }

  function toggleNotificationMinutes(enabled) {
    const container = document.getElementById('notification-minutes-container');
    if (container) {
      if (enabled) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        const input = container.querySelector('input');
        if (input) input.disabled = false;
      } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        const input = container.querySelector('input');
        if (input) input.disabled = true;
      }
    }

    const silentContainer = document.getElementById('silent-mode-container');
    if (silentContainer) {
      if (enabled) {
        silentContainer.style.opacity = '1';
        silentContainer.style.pointerEvents = 'auto';
        const input = silentContainer.querySelector('input');
        if (input) input.disabled = false;
      } else {
        silentContainer.style.opacity = '0.5';
        silentContainer.style.pointerEvents = 'none';
        const input = silentContainer.querySelector('input');
        if (input) input.disabled = true;
      }
    }

    const delayContainer = document.getElementById('bookmarklet-delay-container');
    if (delayContainer) {
      if (enabled) {
        delayContainer.style.opacity = '1';
        delayContainer.style.pointerEvents = 'auto';
        const input = delayContainer.querySelector('input');
        if (input) input.disabled = false;
      } else {
        delayContainer.style.opacity = '0.5';
        delayContainer.style.pointerEvents = 'none';
        const input = delayContainer.querySelector('input');
        if (input) input.disabled = true;
      }
    }

    const randomToggleContainer = document.getElementById('random-time-toggle-container');
    if (randomToggleContainer) {
      if (enabled) {
        randomToggleContainer.style.opacity = '1';
        randomToggleContainer.style.pointerEvents = 'auto';
        const input = randomToggleContainer.querySelector('input');
        if (input) input.disabled = false;
      } else {
        randomToggleContainer.style.opacity = '0.5';
        randomToggleContainer.style.pointerEvents = 'none';
        const input = randomToggleContainer.querySelector('input');
        if (input) input.disabled = true;
      }
    }
  }

  function toggleRandomTimeRange(enabled) {
    const notifEnabled = document.getElementById('stopwatch-notification-enabled');
    const notificationsOn = notifEnabled && notifEnabled.checked;

    const fixedContainer = document.getElementById('notification-minutes-container');
    if (fixedContainer) {
      if (enabled && notificationsOn) {
        fixedContainer.style.display = 'none';
      } else {
        fixedContainer.style.display = 'block';
      }
    }

    const randomRangeContainer = document.getElementById('random-time-range-container');
    if (randomRangeContainer) {
      if (enabled && notificationsOn) {
        randomRangeContainer.style.display = 'block';
        randomRangeContainer.style.opacity = '1';
        randomRangeContainer.style.pointerEvents = 'auto';
        const inputs = randomRangeContainer.querySelectorAll('input');
        inputs.forEach(input => input.disabled = false);
      } else {
        randomRangeContainer.style.display = 'none';
        randomRangeContainer.style.opacity = '0.5';
        randomRangeContainer.style.pointerEvents = 'none';
        const inputs = randomRangeContainer.querySelectorAll('input');
        inputs.forEach(input => input.disabled = true);
      }
    }
  }

  function toggleBookmarkSettings(enabled) {
    const container = document.getElementById('open-bookmarks-container');
    if (container) {
      if (enabled) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        const input = container.querySelector('input');
        if (input) input.disabled = false;
      } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        const input = container.querySelector('input');
        if (input) input.disabled = true;
        toggleBookmarkSelector(false);
      }
    }
  }

  function toggleBookmarkSelector(enabled) {
    const container = document.getElementById('bookmark-selector-container');
    if (container) {
      const notifEnabled = document.getElementById('stopwatch-notification-enabled');
      const actuallyEnabled = enabled && notifEnabled && notifEnabled.checked;

      if (actuallyEnabled) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
        const btn = container.querySelector('button');
        if (btn) btn.disabled = false;
      } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
        const btn = container.querySelector('button');
        if (btn) btn.disabled = true;
      }
    }

    toggleCustomBookmarkletsContainer();
  }

  function toggleCustomBookmarkletsContainer() {
    const container = document.getElementById('custom-bookmarklets-container');
    if (container) {
      const notifEnabled = document.getElementById('stopwatch-notification-enabled');
      const isEnabled = notifEnabled && notifEnabled.checked;

      if (isEnabled) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
      } else {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
      }
    }
  }

  // ==========================================
  // Parse Functions
  // ==========================================

  function parseBookmarksByDomain(value) {
    if (!value || value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse bookmarks by domain:', e);
      return {};
    }
  }

  function parseNotificationTimeByDomain(value) {
    if (!value || value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse notification time by domain:', e);
      return {};
    }
  }

  function parseSilentModeByDomain(value) {
    if (!value || value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse silent mode by domain:', e);
      return {};
    }
  }

  function parseDelayByDomain(value) {
    if (!value || value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse delay by domain:', e);
      return {};
    }
  }

  function parseRandomTimeRangeByDomain(value) {
    if (!value || value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      console.warn('Failed to parse random time range by domain:', e);
      return {};
    }
  }

  // ==========================================
  // Time Format Functions
  // ==========================================

  function formatSecondsToMMSS(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined || typeof totalSeconds !== 'number' || totalSeconds < 0) {
      return '';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function parseMMSSToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const trimmed = timeStr.trim();
    if (!trimmed) return null;

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length !== 2) return null;

      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);

      if (isNaN(minutes) || isNaN(seconds)) return null;
      if (minutes < 0 || seconds < 0 || seconds >= 60) return null;

      return (minutes * 60) + seconds;
    } else {
      const minutes = parseInt(trimmed, 10);
      if (isNaN(minutes) || minutes < 0) return null;
      return minutes * 60;
    }
  }

  // ==========================================
  // Domain List Functions
  // ==========================================

  function renderDomainList() {
    const listContainer = document.getElementById('stopwatch-domain-list');
    const hiddenInput = document.getElementById('stopwatch-included-domains');
    const bookmarksInput = document.getElementById('stopwatch-bookmarks-by-domain');
    const notificationTimeInput = document.getElementById('stopwatch-notification-time-by-domain');
    const silentModeInput = document.getElementById('stopwatch-silent-mode-by-domain');
    const delayInput = document.getElementById('stopwatch-delay-by-domain');

    if (!listContainer || !hiddenInput) return;

    listContainer.innerHTML = '';

    const domainsStr = hiddenInput.value || '';
    const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const bookmarksByDomain = parseBookmarksByDomain(bookmarksInput ? bookmarksInput.value : '');
    const notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeInput ? notificationTimeInput.value : '');
    const silentModeByDomain = parseSilentModeByDomain(silentModeInput ? silentModeInput.value : '');
    const delayByDomain = parseDelayByDomain(delayInput ? delayInput.value : '');

    const randomRangeInput = document.getElementById('stopwatch-random-time-range-by-domain');
    const randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeInput ? randomRangeInput.value : '');

    if (domains.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color: var(--text-secondary); font-size: 12px; padding: 8px 0;';
      emptyMsg.textContent = 'No domains added. Stopwatch will appear on all sites.';
      listContainer.appendChild(emptyMsg);
      return;
    }

    domains.forEach(domain => {
      const bookmarks = bookmarksByDomain[domain] || [];
      const notificationTime = notificationTimeByDomain[domain];
      const silentMode = silentModeByDomain[domain];
      const domainDelay = delayByDomain[domain];
      const randomRange = randomRangeByDomain[domain];
      const item = createDomainListItem(domain, bookmarks, notificationTime, silentMode, domainDelay, randomRange);
      listContainer.appendChild(item);
    });
  }

  function createDomainListItem(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange) {
    const item = document.createElement('div');
    item.className = 'domain-list-item';
    item.style.cssText = 'display: flex; flex-direction: column; padding: 12px; margin: 6px 0; background: var(--surface-bg); border-radius: 8px; gap: 8px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'domain-name';
    nameSpan.textContent = domain;
    nameSpan.style.cssText = 'font-weight: 600; color: var(--text-primary); flex: 1;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    const configBtn = document.createElement('button');
    configBtn.type = 'button';
    configBtn.className = 'secondary-button';
    configBtn.style.cssText = 'padding: 4px 10px; font-size: 12px;';
    configBtn.textContent = 'Configure';
    configBtn.addEventListener('click', () => openSiteBookmarkModal(domain, bookmarks, notificationTimeSeconds, silentMode, domainDelay, randomTimeRange));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-domain';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Remove ' + domain;
    removeBtn.style.cssText = 'background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 0 4px;';
    removeBtn.addEventListener('click', () => removeDomain(domain));
    removeBtn.addEventListener('mouseenter', () => removeBtn.style.color = 'var(--danger)');
    removeBtn.addEventListener('mouseleave', () => removeBtn.style.color = 'var(--text-secondary)');

    actions.appendChild(configBtn);
    actions.appendChild(removeBtn);

    topRow.appendChild(nameSpan);
    topRow.appendChild(actions);

    item.appendChild(topRow);

    const infoRow = document.createElement('div');
    infoRow.style.cssText = 'font-size: 12px; color: var(--text-secondary); padding-left: 4px; display: flex; flex-wrap: wrap; gap: 12px;';

    if (notificationTimeSeconds && notificationTimeSeconds > 0) {
      const timeInfo = document.createElement('span');
      timeInfo.textContent = `⏰ ${formatSecondsToMMSS(notificationTimeSeconds)}`;
      timeInfo.title = 'Notification time (MM:SS)';
      infoRow.appendChild(timeInfo);
    }

    if (silentMode === true) {
      const silentInfo = document.createElement('span');
      silentInfo.textContent = '🔇 Silent';
      silentInfo.title = 'Silent mode enabled - no popup notification';
      infoRow.appendChild(silentInfo);
    }

    if (randomTimeRange && randomTimeRange.enabled) {
      const randomInfo = document.createElement('span');
      const minStr = randomTimeRange.minSeconds > 0 ? formatSecondsToMMSS(randomTimeRange.minSeconds) : '0:00';
      const maxStr = randomTimeRange.maxSeconds > 0 ? formatSecondsToMMSS(randomTimeRange.maxSeconds) : '0:00';
      randomInfo.textContent = `🎲 ${minStr}-${maxStr}`;
      randomInfo.title = 'Random notification time range (hidden until triggered)';
      infoRow.appendChild(randomInfo);
    }

    if (bookmarks.length > 0) {
      const bookmarkInfo = document.createElement('span');
      const bookmarkNames = bookmarks.map(b => b.title || 'Untitled').join(', ');
      bookmarkInfo.textContent = `📚 ${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}`;
      bookmarkInfo.title = bookmarkNames;
      bookmarkInfo.style.cssText = 'cursor: help;';
      infoRow.appendChild(bookmarkInfo);
    }

    if (infoRow.children.length > 0) {
      item.appendChild(infoRow);
    }

    return item;
  }

  const renderDomainTags = renderDomainList;

  function isValidDomainPattern(domain) {
    if (!domain || typeof domain !== 'string') return false;

    const basePattern = domain.replace(/^\*+|\*+$/g, '');
    if (!basePattern) return false;

    const validPattern = /^[\w\-.*/:]+$/;
    if (!validPattern.test(domain)) return false;

    if (domain.includes('..')) return false;
    if (/^[.*]+$/.test(domain)) return false;

    return true;
  }

  function addDomain(domain) {
    const hiddenInput = document.getElementById('stopwatch-included-domains');
    if (!hiddenInput) return;

    domain = domain.trim().toLowerCase();
    if (!domain) return;

    if (!isValidDomainPattern(domain)) {
      core.showStatus('Invalid domain format', 'error');
      return;
    }

    const domainsStr = hiddenInput.value || '';
    const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

    if (domains.includes(domain)) {
      core.showStatus('Domain already exists', 'warning');
      return;
    }

    domains.push(domain);
    hiddenInput.value = domains.join(', ');

    renderDomainTags();
    core.markUnsaved();
  }

  function removeDomain(domain) {
    const hiddenInput = document.getElementById('stopwatch-included-domains');
    const bookmarksInput = document.getElementById('stopwatch-bookmarks-by-domain');
    const notificationTimeInput = document.getElementById('stopwatch-notification-time-by-domain');
    if (!hiddenInput) return;

    const domainsStr = hiddenInput.value || '';
    const domains = domainsStr.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const index = domains.indexOf(domain);
    if (index > -1) {
      domains.splice(index, 1);
    }

    hiddenInput.value = domains.join(', ');

    if (bookmarksInput) {
      let bookmarksByDomain = parseBookmarksByDomain(bookmarksInput.value);
      delete bookmarksByDomain[domain];
      bookmarksInput.value = JSON.stringify(bookmarksByDomain);
    }

    if (notificationTimeInput) {
      let notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeInput.value);
      delete notificationTimeByDomain[domain];
      notificationTimeInput.value = JSON.stringify(notificationTimeByDomain);
    }

    const silentModeInput = document.getElementById('stopwatch-silent-mode-by-domain');
    if (silentModeInput) {
      let silentModeByDomain = parseSilentModeByDomain(silentModeInput.value);
      delete silentModeByDomain[domain];
      silentModeInput.value = JSON.stringify(silentModeByDomain);
    }

    const delayInput = document.getElementById('stopwatch-delay-by-domain');
    if (delayInput) {
      let delayByDomain = parseDelayByDomain(delayInput.value);
      delete delayByDomain[domain];
      delayInput.value = JSON.stringify(delayByDomain);
    }

    const randomRangeInput = document.getElementById('stopwatch-random-time-range-by-domain');
    if (randomRangeInput) {
      let randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeInput.value);
      delete randomRangeByDomain[domain];
      randomRangeInput.value = JSON.stringify(randomRangeByDomain);
    }

    renderDomainTags();
    core.markUnsaved();
  }

  function initializeDomainTagListeners() {
    const addBtn = document.getElementById('stopwatch-add-domain-btn');
    const domainInput = document.getElementById('stopwatch-domain-input');

    if (addBtn && domainInput) {
      addBtn.addEventListener('click', () => {
        addDomain(domainInput.value);
        domainInput.value = '';
        domainInput.focus();
      });

      domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addDomain(domainInput.value);
          domainInput.value = '';
        }
      });
    }
  }

  // ==========================================
  // Global Bookmarklets
  // ==========================================

  async function loadGlobalBookmarkletsList() {
    const container = document.getElementById('global-bookmarklets-list');
    if (!container) return;

    try {
      const data = await new Promise(resolve => {
        chrome.storage.local.get(['customBookmarklets'], resolve);
      });

      const bookmarklets = data.customBookmarklets || {};
      const sortedBookmarklets = Object.values(bookmarklets)
        .filter(bm => bm.enabled !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const selectedGlobal = app.currentSettings.stopwatchGlobalBookmarklets || [];
      const selectedIds = new Set(selectedGlobal);

      container.innerHTML = '';

      if (sortedBookmarklets.length === 0) {
        container.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--text-muted); font-style: italic;">No bookmarklets saved. Create some in the Editor.</p>';
        return;
      }

      sortedBookmarklets.forEach(bm => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px; margin: 2px 0;';
        label.addEventListener('mouseenter', () => label.style.background = 'var(--hover-color)');
        label.addEventListener('mouseleave', () => label.style.background = 'transparent');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedIds.has(bm.id);
        checkbox.dataset.bookmarkletId = bm.id;
        checkbox.className = 'global-bookmarklet-checkbox';
        checkbox.style.cssText = 'margin-right: 8px; cursor: pointer; accent-color: var(--accent);';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = bm.name || 'Untitled';
        nameSpan.style.cssText = 'font-size: 13px; color: var(--text-primary);';

        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        container.appendChild(label);
      });
    } catch (error) {
      console.error('Error loading bookmarklets:', error);
      container.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--danger);">Error loading bookmarklets</p>';
    }
  }

  function getSelectedGlobalBookmarklets() {
    const checkboxes = document.querySelectorAll('.global-bookmarklet-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.bookmarkletId).filter(Boolean);
  }

  // ==========================================
  // Accordion Panel Helper
  // ==========================================

  function createAccordionPanel(title, content, defaultExpanded = false) {
    const panel = document.createElement('div');
    panel.style.cssText = 'border: 1px solid var(--border); border-radius: 8px; margin: 8px 16px; overflow: hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; padding: 12px 16px; cursor: pointer; background: var(--surface-bg); gap: 10px; user-select: none;';

    const chevron = document.createElement('span');
    chevron.textContent = '\u25BC';
    chevron.style.cssText = 'font-size: 10px; color: var(--text-secondary); transition: transform 0.2s ease;';
    chevron.style.transform = defaultExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleSpan.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary);';

    header.appendChild(chevron);
    header.appendChild(titleSpan);

    const body = document.createElement('div');
    body.style.cssText = 'overflow: hidden; transition: max-height 0.3s ease;';
    body.style.maxHeight = defaultExpanded ? 'none' : '0';

    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = 'border-top: 1px solid var(--border);';

    if (Array.isArray(content)) {
      content.forEach(el => {
        el.style.borderBottom = 'none';
        el.style.margin = '0';
        contentWrapper.appendChild(el);
      });
    } else {
      content.style.borderBottom = 'none';
      contentWrapper.appendChild(content);
    }
    body.appendChild(contentWrapper);

    header.addEventListener('click', () => {
      const isCollapsed = body.style.maxHeight === '0px' || body.style.maxHeight === '0';
      if (isCollapsed) {
        body.style.maxHeight = body.scrollHeight + 'px';
        chevron.style.transform = 'rotate(0deg)';
        setTimeout(() => body.style.maxHeight = 'none', 300);
      } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        body.offsetHeight;
        body.style.maxHeight = '0';
        chevron.style.transform = 'rotate(-90deg)';
      }
    });

    if (defaultExpanded) {
      setTimeout(() => body.style.maxHeight = 'none', 300);
    }

    panel.appendChild(header);
    panel.appendChild(body);
    return {
      panel,
      body,
      expandPanel: () => {
        body.style.maxHeight = body.scrollHeight + 'px';
        chevron.style.transform = 'rotate(0deg)';
        setTimeout(() => body.style.maxHeight = 'none', 300);
      }
    };
  }

  // ==========================================
  // Site Bookmark Modal
  // ==========================================

  function openSiteBookmarkModal(domain, existingBookmarks, existingNotificationTime, existingSilentMode, existingDomainDelay, existingRandomTimeRange) {
    const existingModal = document.getElementById('bookmark-selector-modal');
    if (existingModal) existingModal.remove();

    let selectedBookmarks = [...existingBookmarks].map(bm => ({
      ...bm,
      delayAfter: typeof bm.delayAfter === 'number' ? bm.delayAfter : 0
    }));
    let selectedIds = new Set(selectedBookmarks.map(b => b.id));

    let currentNotificationTime = existingNotificationTime || 0;
    let currentSilentMode = existingSilentMode === true;
    let currentDomainDelay = typeof existingDomainDelay === 'number' ? existingDomainDelay : 0;
    let currentRandomTimeRange = existingRandomTimeRange || { enabled: false, minSeconds: 0, maxSeconds: 0 };

    let draggedItem = null;

    const modal = document.createElement('div');
    modal.id = 'bookmark-selector-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

    const modalContent = document.createElement('div');
    modalContent.style.cssText = 'background: var(--primary-bg); border-radius: 12px; width: 95%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: var(--text-primary); margin: 10px;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;';

    const headerTitle = document.createElement('h3');
    headerTitle.textContent = `Configure ${domain}`;
    headerTitle.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary); word-break: break-word;';

    const savedBodyOverflow = document.body.style.overflow;
    const closeModal = () => {
      document.body.style.overflow = savedBodyOverflow;
      modal.remove();
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); padding: 0;';
    closeBtn.addEventListener('click', closeModal);

    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Notification Time Section
    const notificationSection = document.createElement('div');
    notificationSection.style.cssText = 'padding: 12px 16px; background: var(--surface-bg); flex-shrink: 0;';

    const notificationLabel = document.createElement('label');
    notificationLabel.style.cssText = 'display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;';
    notificationLabel.textContent = 'Notification Time for this domain';

    const notificationInputRow = document.createElement('div');
    notificationInputRow.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

    const notificationTimeInput = document.createElement('input');
    notificationTimeInput.type = 'text';
    notificationTimeInput.id = 'modal-notification-time';
    notificationTimeInput.placeholder = 'MM:SS (e.g., 11:11)';
    notificationTimeInput.value = currentNotificationTime > 0 ? formatSecondsToMMSS(currentNotificationTime) : '';
    notificationTimeInput.style.cssText = 'width: 120px; min-width: 100px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); font-size: 14px;';

    const notificationHint = document.createElement('span');
    notificationHint.style.cssText = 'font-size: 12px; color: var(--text-secondary); flex: 1; min-width: 150px;';
    notificationHint.textContent = 'Leave empty to use default time';

    notificationInputRow.appendChild(notificationTimeInput);
    notificationInputRow.appendChild(notificationHint);

    notificationSection.appendChild(notificationLabel);
    notificationSection.appendChild(notificationInputRow);

    // Silent Mode Section
    const silentSection = document.createElement('div');
    silentSection.style.cssText = 'padding: 12px 16px; background: var(--surface-bg); flex-shrink: 0;';

    const silentRow = document.createElement('div');
    silentRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const silentCheckbox = document.createElement('input');
    silentCheckbox.type = 'checkbox';
    silentCheckbox.id = 'modal-silent-mode';
    silentCheckbox.checked = currentSilentMode;
    silentCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
    silentCheckbox.addEventListener('change', () => {
      currentSilentMode = silentCheckbox.checked;
    });

    const silentLabel = document.createElement('label');
    silentLabel.htmlFor = 'modal-silent-mode';
    silentLabel.style.cssText = 'font-size: 13px; color: var(--text-primary); cursor: pointer;';
    silentLabel.textContent = 'Silent Mode - run bookmarklets without popup notification';

    silentRow.appendChild(silentCheckbox);
    silentRow.appendChild(silentLabel);
    silentSection.appendChild(silentRow);

    // Domain Delay Section
    const delaySection = document.createElement('div');
    delaySection.className = 'domain-delay-section';
    delaySection.style.cssText = 'padding: 12px 16px; background: var(--surface-bg); flex-shrink: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';

    const delayLabel = document.createElement('label');
    delayLabel.htmlFor = 'modal-domain-delay';
    delayLabel.style.cssText = 'font-size: 13px; color: var(--text-primary);';
    delayLabel.textContent = 'Default Delay:';

    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.id = 'modal-domain-delay';
    delayInput.min = '0';
    delayInput.max = '60000';
    delayInput.value = currentDomainDelay;
    delayInput.style.cssText = 'width: 80px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--text-primary); font-size: 13px; text-align: right;';
    delayInput.addEventListener('change', () => {
      currentDomainDelay = parseInt(delayInput.value, 10) || 0;
    });

    const delayUnit = document.createElement('span');
    delayUnit.style.cssText = 'font-size: 12px; color: var(--text-secondary);';
    delayUnit.textContent = 'ms';

    const delayHint = document.createElement('span');
    delayHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-left: auto;';
    delayHint.textContent = '0 = use global default';

    delaySection.appendChild(delayLabel);
    delaySection.appendChild(delayInput);
    delaySection.appendChild(delayUnit);
    delaySection.appendChild(delayHint);

    // Random Time Range Section
    const randomRangeSection = document.createElement('div');
    randomRangeSection.style.cssText = 'padding: 12px 16px; background: var(--surface-bg); flex-shrink: 0;';

    const randomToggleRow = document.createElement('div');
    randomToggleRow.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px;';

    const randomCheckbox = document.createElement('input');
    randomCheckbox.type = 'checkbox';
    randomCheckbox.id = 'modal-random-time-enabled';
    randomCheckbox.checked = currentRandomTimeRange.enabled === true;
    randomCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';

    const randomToggleLabel = document.createElement('label');
    randomToggleLabel.htmlFor = 'modal-random-time-enabled';
    randomToggleLabel.style.cssText = 'font-size: 13px; color: var(--text-primary); cursor: pointer;';
    randomToggleLabel.textContent = 'Use Random Time Range';

    randomToggleRow.appendChild(randomCheckbox);
    randomToggleRow.appendChild(randomToggleLabel);

    const randomRangeInputRow = document.createElement('div');
    randomRangeInputRow.id = 'modal-random-range-inputs';
    randomRangeInputRow.style.cssText = 'display: none; align-items: center; gap: 10px; flex-wrap: wrap;';

    const randomMinInput = document.createElement('input');
    randomMinInput.type = 'text';
    randomMinInput.id = 'modal-random-min';
    randomMinInput.placeholder = 'MM:SS';
    randomMinInput.value = currentRandomTimeRange.minSeconds > 0 ? formatSecondsToMMSS(currentRandomTimeRange.minSeconds) : '';
    randomMinInput.style.cssText = 'width: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);';

    const toLabel = document.createElement('span');
    toLabel.textContent = 'to';
    toLabel.style.cssText = 'font-size: 13px; color: var(--text-secondary);';

    const randomMaxInput = document.createElement('input');
    randomMaxInput.type = 'text';
    randomMaxInput.id = 'modal-random-max';
    randomMaxInput.placeholder = 'MM:SS';
    randomMaxInput.value = currentRandomTimeRange.maxSeconds > 0 ? formatSecondsToMMSS(currentRandomTimeRange.maxSeconds) : '';
    randomMaxInput.style.cssText = 'width: 80px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary);';

    const randomHint = document.createElement('span');
    randomHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-left: auto;';
    randomHint.textContent = 'Leave empty to use global range';

    randomRangeInputRow.appendChild(randomMinInput);
    randomRangeInputRow.appendChild(toLabel);
    randomRangeInputRow.appendChild(randomMaxInput);
    randomRangeInputRow.appendChild(randomHint);

    function updateRandomRangeVisibility() {
      randomRangeInputRow.style.display = randomCheckbox.checked ? 'flex' : 'none';
    }
    randomCheckbox.addEventListener('change', updateRandomRangeVisibility);
    updateRandomRangeVisibility();

    randomRangeSection.appendChild(randomToggleRow);
    randomRangeSection.appendChild(randomRangeInputRow);

    // Sortable Bookmarklet List Section
    const sortableSection = document.createElement('div');
    sortableSection.style.cssText = 'padding: 12px 16px; flex-shrink: 0;';

    const sortableHeader = document.createElement('div');
    sortableHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

    const sortableLabel = document.createElement('div');
    sortableLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary);';
    sortableLabel.textContent = 'Bookmarklets to Run';

    const sortableHint = document.createElement('div');
    sortableHint.style.cssText = 'font-size: 11px; color: var(--text-secondary);';
    sortableHint.innerHTML = 'Drag ☰ to reorder';

    sortableHeader.appendChild(sortableLabel);
    sortableHeader.appendChild(sortableHint);

    const sortableList = document.createElement('div');
    sortableList.className = 'sortable-bookmark-list';
    sortableList.id = 'modal-sortable-list';

    function renderSortableList() {
      sortableList.innerHTML = '';

      if (selectedBookmarks.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'sortable-list-empty';
        emptyMsg.textContent = 'No bookmarklets selected. Add some from below.';
        sortableList.appendChild(emptyMsg);
        return;
      }

      selectedBookmarks.forEach((bm, index) => {
        const item = document.createElement('div');
        item.className = 'sortable-bookmark-item';
        item.draggable = true;
        item.dataset.index = index;

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '☰';

        const order = document.createElement('span');
        order.className = 'bookmark-order';
        order.textContent = `${index + 1}.`;

        const title = document.createElement('span');
        title.className = 'bookmark-title';
        const isCode = bm.isCustomCode || (bm.url && bm.url.startsWith('javascript:'));
        const isEditorBookmarklet = bm.isEditorBookmarklet;
        let prefix = '';
        if (isEditorBookmarklet) prefix = '📜 ';
        else if (isCode) prefix = '</> ';
        title.textContent = `${prefix}${bm.title || 'Untitled'}`;
        title.title = bm.title || bm.url || 'Untitled';

        const delayInputItem = document.createElement('input');
        delayInputItem.type = 'number';
        delayInputItem.className = 'delay-input';
        delayInputItem.min = '0';
        delayInputItem.max = '60000';
        delayInputItem.value = bm.delayAfter || 0;
        delayInputItem.placeholder = '0';
        delayInputItem.title = 'Delay after this bookmarklet (ms)';
        delayInputItem.addEventListener('change', () => {
          selectedBookmarks[index].delayAfter = parseInt(delayInputItem.value, 10) || 0;
        });

        const delayUnitItem = document.createElement('span');
        delayUnitItem.className = 'delay-unit';
        delayUnitItem.textContent = 'ms';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-bookmark-btn';
        removeBtn.textContent = '🗑';
        removeBtn.title = 'Remove';
        removeBtn.addEventListener('click', () => {
          selectedIds.delete(bm.id);
          selectedBookmarks.splice(index, 1);
          renderSortableList();
          updateBookmarkCheckboxes();
        });

        item.addEventListener('dragstart', (e) => {
          draggedItem = item;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          document.querySelectorAll('.sortable-bookmark-item.drag-over').forEach(el => el.classList.remove('drag-over'));
          draggedItem = null;
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (draggedItem && draggedItem !== item) {
            item.classList.add('drag-over');
          }
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');

          if (draggedItem && draggedItem !== item) {
            const fromIndex = parseInt(draggedItem.dataset.index, 10);
            const toIndex = parseInt(item.dataset.index, 10);

            const [movedItem] = selectedBookmarks.splice(fromIndex, 1);
            selectedBookmarks.splice(toIndex, 0, movedItem);

            renderSortableList();
          }
        });

        item.appendChild(handle);
        item.appendChild(order);
        item.appendChild(title);
        item.appendChild(delayInputItem);
        item.appendChild(delayUnitItem);
        item.appendChild(removeBtn);

        sortableList.appendChild(item);
      });
    }

    // Search section for bookmarks
    const searchSection = document.createElement('div');
    searchSection.style.cssText = 'padding: 10px 16px; flex-shrink: 0;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search bookmarks...';
    searchInput.style.cssText = 'width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text-primary); font-size: 14px;';

    // Bookmark tree container
    const treeContainer = document.createElement('div');
    treeContainer.style.cssText = 'max-height: 300px; overflow-y: auto; padding: 12px 16px;';

    const loading = document.createElement('div');
    loading.textContent = 'Loading bookmarks...';
    loading.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
    treeContainer.appendChild(loading);

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const bookmarkItems = treeContainer.querySelectorAll('[data-bookmark-title]');
      const folderItems = treeContainer.querySelectorAll('[data-folder]');

      if (!query) {
        bookmarkItems.forEach(item => {
          item.style.display = 'flex';
        });
        folderItems.forEach(folder => {
          folder.style.display = 'block';
          const childrenContainer = folder.querySelector('[data-folder-children]');
          if (childrenContainer) {
            childrenContainer.style.display = 'block';
          }
        });
        return;
      }

      folderItems.forEach(folder => {
        folder.style.display = 'none';
      });

      bookmarkItems.forEach(item => {
        const title = (item.getAttribute('data-bookmark-title') || '').toLowerCase();
        const url = (item.getAttribute('data-bookmark-url') || '').toLowerCase();
        const matches = title.includes(query) || url.includes(query);
        item.style.display = matches ? 'flex' : 'none';

        if (matches) {
          let parent = item.parentElement;
          while (parent && parent !== treeContainer) {
            if (parent.hasAttribute('data-folder')) {
              parent.style.display = 'block';
              const childrenContainer = parent.querySelector('[data-folder-children]');
              if (childrenContainer) {
                childrenContainer.style.display = 'block';
              }
            }
            if (parent.hasAttribute('data-folder-children')) {
              parent.style.display = 'block';
            }
            parent = parent.parentElement;
          }
        }
      });
    });

    searchSection.appendChild(searchInput);

    function updateBookmarkCheckboxes() {
      const treeCheckboxes = treeContainer.querySelectorAll('input[type="checkbox"]');
      treeCheckboxes.forEach(cb => {
        const bookmarkItem = cb.closest('[data-bookmark-title]');
        if (bookmarkItem) {
          const bookmarkId = bookmarkItem.getAttribute('data-bookmark-id');
          cb.checked = selectedIds.has(bookmarkId);
        }
      });

      const editorCheckboxes = savedBookmarkletsList.querySelectorAll('input[type="checkbox"]');
      editorCheckboxes.forEach(cb => {
        const editorId = cb.getAttribute('data-editor-id');
        if (editorId) {
          const isSelected = selectedBookmarks.some(sb => sb.editorBookmarkletId === editorId);
          cb.checked = isSelected;
        }
      });
    }

    renderSortableList();

    sortableSection.appendChild(sortableHeader);
    sortableSection.appendChild(sortableList);

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = 'padding: 10px 16px; background: var(--surface-bg); font-size: 12px; color: var(--text-secondary); flex-shrink: 0;';
    instructions.innerHTML = 'Add bookmarks or <strong>custom code</strong> to run when notification is dismissed.';

    // Add Custom Code section
    const customCodeSection = document.createElement('div');
    customCodeSection.style.cssText = 'padding: 10px 16px; flex-shrink: 0;';

    const addCodeBtn = document.createElement('button');
    addCodeBtn.textContent = '+ Add Custom Code';
    addCodeBtn.className = 'secondary-button';
    addCodeBtn.style.cssText = 'font-size: 13px; padding: 8px 16px;';

    const codeInputContainer = document.createElement('div');
    codeInputContainer.style.cssText = 'display: none; margin-top: 12px;';

    const codeNameInput = document.createElement('input');
    codeNameInput.type = 'text';
    codeNameInput.placeholder = 'Name (e.g., "Check all boxes")';
    codeNameInput.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; background: var(--input-bg); color: var(--text-primary);';

    const codeTextarea = document.createElement('textarea');
    codeTextarea.placeholder = 'Paste JavaScript code here...\n\nExamples:\n• document.querySelectorAll(\'input[type="checkbox"]\').forEach(c => c.checked = true);\n• document.querySelector(\'#myButton\').click();';
    codeTextarea.style.cssText = 'width: 100%; height: 120px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-family: monospace; font-size: 12px; resize: vertical; background: var(--input-bg); color: var(--text-primary);';

    const codeHint = document.createElement('div');
    codeHint.style.cssText = 'font-size: 11px; color: var(--text-secondary); margin-top: 6px; margin-bottom: 10px;';
    codeHint.innerHTML = '<strong>Note:</strong> Code runs in isolated world (DOM access only). Cannot call page JavaScript functions.';

    const codeButtonsRow = document.createElement('div');
    codeButtonsRow.style.cssText = 'display: flex; gap: 8px;';

    const addCodeConfirmBtn = document.createElement('button');
    addCodeConfirmBtn.textContent = 'Add Code';
    addCodeConfirmBtn.className = 'primary-button';
    addCodeConfirmBtn.style.cssText = 'font-size: 12px; padding: 6px 14px;';

    const cancelCodeBtn = document.createElement('button');
    cancelCodeBtn.textContent = 'Cancel';
    cancelCodeBtn.className = 'secondary-button';
    cancelCodeBtn.style.cssText = 'font-size: 12px; padding: 6px 14px;';

    addCodeBtn.addEventListener('click', () => {
      codeInputContainer.style.display = 'block';
      addCodeBtn.style.display = 'none';
      codeNameInput.focus();
    });

    cancelCodeBtn.addEventListener('click', () => {
      codeInputContainer.style.display = 'none';
      addCodeBtn.style.display = 'inline-block';
      codeNameInput.value = '';
      codeTextarea.value = '';
    });

    addCodeConfirmBtn.addEventListener('click', () => {
      const name = codeNameInput.value.trim() || 'Custom Code';
      let code = codeTextarea.value.trim();

      if (!code) {
        alert('Please enter some code');
        return;
      }

      if (!code.startsWith('javascript:')) {
        code = 'javascript:' + encodeURIComponent(code);
      }

      const customBookmark = {
        id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        title: name,
        url: code,
        isCustomCode: true,
        delayAfter: 0
      };

      selectedBookmarks.push(customBookmark);
      selectedIds.add(customBookmark.id);
      renderSortableList();

      codeInputContainer.style.display = 'none';
      addCodeBtn.style.display = 'inline-block';
      codeNameInput.value = '';
      codeTextarea.value = '';
    });

    codeButtonsRow.appendChild(addCodeConfirmBtn);
    codeButtonsRow.appendChild(cancelCodeBtn);

    codeInputContainer.appendChild(codeNameInput);
    codeInputContainer.appendChild(codeTextarea);
    codeInputContainer.appendChild(codeHint);
    codeInputContainer.appendChild(codeButtonsRow);

    customCodeSection.appendChild(addCodeBtn);
    customCodeSection.appendChild(codeInputContainer);

    // Saved Bookmarklets Section (from bookmarklet editor)
    const savedBookmarkletsSection = document.createElement('div');
    savedBookmarkletsSection.style.cssText = 'padding: 10px 16px; flex-shrink: 0;';

    const savedBookmarkletsLabel = document.createElement('div');
    savedBookmarkletsLabel.style.cssText = 'font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;';
    savedBookmarkletsLabel.innerHTML = '<span style="font-size: 14px;">📜</span> Saved Bookmarklets';

    const savedBookmarkletsList = document.createElement('div');
    savedBookmarkletsList.style.cssText = 'background: var(--surface-bg); border-radius: 6px; padding: 6px; border: 1px solid var(--border);';
    savedBookmarkletsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px; padding: 8px; text-align: center;">Loading...</div>';

    savedBookmarkletsSection.appendChild(savedBookmarkletsLabel);
    savedBookmarkletsSection.appendChild(savedBookmarkletsList);

    // Load saved bookmarklets from storage
    chrome.storage.local.get(['customBookmarklets'], (data) => {
      const bookmarklets = data.customBookmarklets || {};
      const sortedBookmarklets = Object.values(bookmarklets)
        .filter(bm => bm.enabled !== false && bm.code)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      savedBookmarkletsList.innerHTML = '';

      if (sortedBookmarklets.length === 0) {
        savedBookmarkletsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px; padding: 8px; text-align: center; font-style: italic;">No saved bookmarklets. Create some in the Editor.</div>';
        return;
      }

      sortedBookmarklets.forEach(bm => {
        const isAlreadySelected = selectedBookmarks.some(sb => sb.editorBookmarkletId === bm.id);

        const item = document.createElement('label');
        item.style.cssText = 'display: flex; align-items: center; padding: 6px 8px; cursor: pointer; border-radius: 4px; margin: 2px 0; gap: 8px;';
        item.addEventListener('mouseenter', () => item.style.background = 'var(--hover-color)');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isAlreadySelected;
        checkbox.setAttribute('data-editor-id', bm.id);
        checkbox.style.cssText = 'cursor: pointer; accent-color: var(--accent); flex-shrink: 0;';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = bm.name || 'Untitled';
        nameSpan.style.cssText = 'font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            const editorBookmark = {
              id: 'editor_' + bm.id,
              editorBookmarkletId: bm.id,
              title: bm.name || 'Untitled Bookmarklet',
              isEditorBookmarklet: true,
              delayAfter: 0
            };
            selectedBookmarks.push(editorBookmark);
            selectedIds.add(editorBookmark.id);
          } else {
            const idx = selectedBookmarks.findIndex(sb => sb.editorBookmarkletId === bm.id);
            if (idx !== -1) {
              selectedIds.delete(selectedBookmarks[idx].id);
              selectedBookmarks.splice(idx, 1);
            }
          }
          renderSortableList();
        });

        item.appendChild(checkbox);
        item.appendChild(nameSpan);
        savedBookmarkletsList.appendChild(item);
      });
    });

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 12px 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0; flex-wrap: wrap;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'secondary-button';
    cancelBtn.addEventListener('click', closeModal);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'primary-button';
    saveBtn.addEventListener('click', () => {
      const bookmarksHiddenInput = document.getElementById('stopwatch-bookmarks-by-domain');
      const notificationTimeHiddenInput = document.getElementById('stopwatch-notification-time-by-domain');
      const silentModeHiddenInput = document.getElementById('stopwatch-silent-mode-by-domain');

      if (!bookmarksHiddenInput) return;

      // Save bookmarks
      let bookmarksByDomain = parseBookmarksByDomain(bookmarksHiddenInput.value);
      bookmarksByDomain[domain] = selectedBookmarks;
      bookmarksHiddenInput.value = JSON.stringify(bookmarksByDomain);

      // Save notification time
      if (notificationTimeHiddenInput) {
        let notificationTimeByDomain = parseNotificationTimeByDomain(notificationTimeHiddenInput.value);
        const timeInputValue = notificationTimeInput.value.trim();

        if (timeInputValue) {
          const parsedSeconds = parseMMSSToSeconds(timeInputValue);
          if (parsedSeconds === null) {
            alert('Invalid time format. Use MM:SS (e.g., 11:11 for 11 minutes 11 seconds)');
            return;
          } else if (parsedSeconds > 0) {
            notificationTimeByDomain[domain] = parsedSeconds;
          } else {
            delete notificationTimeByDomain[domain];
          }
        } else {
          delete notificationTimeByDomain[domain];
        }

        notificationTimeHiddenInput.value = JSON.stringify(notificationTimeByDomain);
      }

      // Save silent mode
      if (silentModeHiddenInput) {
        let silentModeByDomain = parseSilentModeByDomain(silentModeHiddenInput.value);
        if (currentSilentMode) {
          silentModeByDomain[domain] = true;
        } else {
          delete silentModeByDomain[domain];
        }
        silentModeHiddenInput.value = JSON.stringify(silentModeByDomain);
      }

      // Save domain delay
      const delayHiddenInput = document.getElementById('stopwatch-delay-by-domain');
      if (delayHiddenInput) {
        let delayByDomain = parseDelayByDomain(delayHiddenInput.value);
        if (currentDomainDelay > 0) {
          delayByDomain[domain] = currentDomainDelay;
        } else {
          delete delayByDomain[domain];
        }
        delayHiddenInput.value = JSON.stringify(delayByDomain);
      }

      // Save random time range
      const randomRangeHiddenInput = document.getElementById('stopwatch-random-time-range-by-domain');
      if (randomRangeHiddenInput) {
        let randomRangeByDomain = parseRandomTimeRangeByDomain(randomRangeHiddenInput.value);
        const randomEnabled = randomCheckbox.checked;
        const minValue = randomMinInput.value.trim();
        const maxValue = randomMaxInput.value.trim();

        if (randomEnabled) {
          const minSeconds = minValue ? parseMMSSToSeconds(minValue) : 0;
          const maxSeconds = maxValue ? parseMMSSToSeconds(maxValue) : 0;

          if (minValue && minSeconds === null) {
            alert('Invalid min time format. Use MM:SS (e.g., 11:00 for 11 minutes)');
            return;
          }
          if (maxValue && maxSeconds === null) {
            alert('Invalid max time format. Use MM:SS (e.g., 15:00 for 15 minutes)');
            return;
          }

          randomRangeByDomain[domain] = {
            enabled: true,
            minSeconds: minSeconds || 0,
            maxSeconds: maxSeconds || 0
          };
        } else {
          delete randomRangeByDomain[domain];
        }
        randomRangeHiddenInput.value = JSON.stringify(randomRangeByDomain);
      }

      renderDomainList();
      core.markUnsaved();
      closeModal();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    // Create scrollable body container
    const bodyContainer = document.createElement('div');
    bodyContainer.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 0;';

    // Create accordion panels
    const timingPanel = createAccordionPanel('\u2699\uFE0F Timing Settings', [
      notificationSection, silentSection, delaySection, randomRangeSection
    ], false);

    const selectedPanel = createAccordionPanel('\uD83D\uDCCB Selected Bookmarklets',
      sortableSection, true);

    const addPanel = createAccordionPanel('\u2795 Add Bookmarklets', [
      instructions, customCodeSection, savedBookmarkletsSection
    ], false);

    const browseContent = document.createElement('div');
    browseContent.appendChild(searchSection);
    browseContent.appendChild(treeContainer);
    const browsePanel = createAccordionPanel('\uD83D\uDCC1 Browse Bookmarks', browseContent, true);

    bodyContainer.appendChild(timingPanel.panel);
    bodyContainer.appendChild(selectedPanel.panel);
    bodyContainer.appendChild(addPanel.panel);
    bodyContainer.appendChild(browsePanel.panel);

    modalContent.appendChild(header);
    modalContent.appendChild(bodyContainer);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Load bookmarks into tree
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      treeContainer.innerHTML = '';

      if (!bookmarkTreeNodes || bookmarkTreeNodes.length === 0) {
        treeContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">No bookmarks found</div>';
        return;
      }

      bookmarkTreeNodes.forEach(node => {
        renderBookmarkNodeForSite(treeContainer, node, selectedIds, selectedBookmarks, 0, renderSortableList);
      });
    });
  }

  function renderBookmarkNodeForSite(container, node, selectedIds, selectedBookmarks, depth, onSelectionChange) {
    if (!node.title && node.children) {
      node.children.forEach(child => {
        renderBookmarkNodeForSite(container, child, selectedIds, selectedBookmarks, depth, onSelectionChange);
      });
      return;
    }

    const item = document.createElement('div');
    item.style.cssText = `padding-left: ${depth * 20}px;`;

    if (node.children) {
      item.setAttribute('data-folder', 'true');

      const folderHeader = document.createElement('div');
      folderHeader.style.cssText = 'display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 6px; margin: 2px 0;';
      folderHeader.addEventListener('mouseenter', () => folderHeader.style.background = 'var(--hover-color)');
      folderHeader.addEventListener('mouseleave', () => folderHeader.style.background = 'transparent');

      folderHeader.innerHTML = `<span style="margin-right: 8px;">📁</span><span style="font-weight: 500; color: var(--text-primary);">${node.title || 'Bookmarks'}</span><span style="margin-left: auto; font-size: 10px; color: var(--text-secondary);">▼</span>`;

      const childrenContainer = document.createElement('div');
      childrenContainer.style.cssText = 'display: block;';
      childrenContainer.setAttribute('data-folder-children', 'true');

      node.children.forEach(child => {
        renderBookmarkNodeForSite(childrenContainer, child, selectedIds, selectedBookmarks, depth + 1, onSelectionChange);
      });

      folderHeader.addEventListener('click', () => {
        const isCollapsed = childrenContainer.style.display === 'none';
        childrenContainer.style.display = isCollapsed ? 'block' : 'none';
        folderHeader.querySelector('span:last-child').style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
      });

      item.appendChild(folderHeader);
      item.appendChild(childrenContainer);
    } else if (node.url) {
      const bookmarkItem = document.createElement('div');
      const isSelected = selectedIds.has(node.id);
      bookmarkItem.style.cssText = `display: flex; align-items: center; padding: 8px 12px; cursor: pointer; border-radius: 6px; margin: 2px 0; border: 2px solid ${isSelected ? 'var(--accent)' : 'transparent'}; background: ${isSelected ? 'var(--accent-glow)' : 'transparent'};`;

      bookmarkItem.setAttribute('data-bookmark-title', node.title || '');
      bookmarkItem.setAttribute('data-bookmark-url', node.url || '');
      bookmarkItem.setAttribute('data-bookmark-id', node.id);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.style.cssText = 'margin-right: 10px; cursor: pointer; accent-color: var(--accent);';

      bookmarkItem.innerHTML = `<span style="margin-right: 8px;">🔖</span><div style="flex: 1; min-width: 0; overflow: hidden;"><div style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${node.title || 'Untitled'}</div><div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${node.url}</div></div>`;
      bookmarkItem.prepend(checkbox);

      const toggleSelection = () => {
        const existingIndex = selectedBookmarks.findIndex(b => b.id === node.id);

        if (existingIndex >= 0) {
          selectedBookmarks.splice(existingIndex, 1);
          selectedIds.delete(node.id);
          checkbox.checked = false;
          bookmarkItem.style.border = '2px solid transparent';
          bookmarkItem.style.background = 'transparent';
        } else {
          selectedBookmarks.push({ id: node.id, title: node.title, url: node.url, delayAfter: 0 });
          selectedIds.add(node.id);
          checkbox.checked = true;
          bookmarkItem.style.border = '2px solid var(--accent)';
          bookmarkItem.style.background = 'var(--accent-glow)';
        }

        onSelectionChange();
      };

      bookmarkItem.addEventListener('click', toggleSelection);
      bookmarkItem.addEventListener('mouseenter', () => {
        if (!selectedIds.has(node.id)) bookmarkItem.style.background = 'var(--hover-color)';
      });
      bookmarkItem.addEventListener('mouseleave', () => {
        if (!selectedIds.has(node.id)) bookmarkItem.style.background = 'transparent';
      });

      item.appendChild(bookmarkItem);
    }

    container.appendChild(item);
  }

  // ==========================================
  // Module Functions
  // ==========================================

  function applyStopwatchSettings(settings) {
    core.safeSetChecked('stopwatch-enabled', settings.stopwatchEnabled === true);
    core.safeSetValue('stopwatch-position', settings.stopwatchPosition || 'bottom-right');
    core.safeSetChecked('stopwatch-minimized-default', settings.stopwatchMinimizedByDefault === true);
    core.safeSetChecked('stopwatch-notification-enabled', settings.stopwatchNotificationEnabled === true);
    core.safeSetValue('stopwatch-notification-minutes', settings.stopwatchNotificationMinutes || 30);
    core.safeSetValue('stopwatch-included-domains', settings.stopwatchIncludedDomains || '');

    // Load bookmarks by domain BEFORE rendering domain list
    const bookmarksByDomain = settings.stopwatchBookmarksByDomain || {};
    const bookmarksHiddenInput = document.getElementById('stopwatch-bookmarks-by-domain');
    if (bookmarksHiddenInput) {
      bookmarksHiddenInput.value = JSON.stringify(bookmarksByDomain);
    }

    // Load notification times by domain
    const notificationTimeByDomain = settings.stopwatchNotificationTimeByDomain || {};
    const notificationTimeHiddenInput = document.getElementById('stopwatch-notification-time-by-domain');
    if (notificationTimeHiddenInput) {
      notificationTimeHiddenInput.value = JSON.stringify(notificationTimeByDomain);
    }

    // Load silent mode by domain
    const silentModeByDomain = settings.stopwatchSilentModeByDomain || {};
    const silentModeHiddenInput = document.getElementById('stopwatch-silent-mode-by-domain');
    if (silentModeHiddenInput) {
      silentModeHiddenInput.value = JSON.stringify(silentModeByDomain);
    }

    // Load delay by domain
    const delayByDomainSettings = settings.stopwatchDelayByDomain || {};
    const delayByDomainHiddenInput = document.getElementById('stopwatch-delay-by-domain');
    if (delayByDomainHiddenInput) {
      delayByDomainHiddenInput.value = JSON.stringify(delayByDomainSettings);
    }

    // Load global silent mode and bookmarklet delay settings
    core.safeSetChecked('stopwatch-notification-silent', settings.stopwatchNotificationSilent === true);
    core.safeSetValue('stopwatch-bookmarklet-delay', settings.stopwatchBookmarkletDelay || 0);

    // Load random time settings
    core.safeSetChecked('stopwatch-use-random-time', settings.stopwatchUseRandomTime === true);
    core.safeSetValue('stopwatch-random-min-minutes', settings.stopwatchRandomTimeMinMinutes || 10);
    core.safeSetValue('stopwatch-random-max-minutes', settings.stopwatchRandomTimeMaxMinutes || 30);

    // Load random time range by domain
    const randomTimeRangeByDomain = settings.stopwatchRandomTimeRangeByDomain || {};
    const randomTimeRangeHiddenInput = document.getElementById('stopwatch-random-time-range-by-domain');
    if (randomTimeRangeHiddenInput) {
      randomTimeRangeHiddenInput.value = JSON.stringify(randomTimeRangeByDomain);
    }

    // Render domain tags
    renderDomainTags();

    // Toggle stopwatch options subsection based on enable state
    toggleStopwatchSettings(settings.stopwatchEnabled === true);
    toggleNotificationMinutes(settings.stopwatchNotificationEnabled === true);
    toggleRandomTimeRange(settings.stopwatchUseRandomTime === true);

    // Bookmark settings
    core.safeSetChecked('stopwatch-open-bookmarks', settings.stopwatchOpenBookmarksOnNotification === true);
    toggleBookmarkSettings(settings.stopwatchNotificationEnabled === true);
    toggleBookmarkSelector(settings.stopwatchOpenBookmarksOnNotification === true);

    // Load global bookmarklets list
    loadGlobalBookmarkletsList();
  }

  function attachStopwatchListeners() {
    // Stopwatch feature toggle
    core.safeAddListener('stopwatch-enabled', 'change', (e) => {
      toggleStopwatchSettings(e.target.checked);
      core.markUnsaved();
    });

    // Stopwatch notification toggle
    core.safeAddListener('stopwatch-notification-enabled', 'change', (e) => {
      toggleNotificationMinutes(e.target.checked);
      toggleBookmarkSettings(e.target.checked);
      toggleCustomBookmarkletsContainer();
      const useRandomTime = document.getElementById('stopwatch-use-random-time');
      toggleRandomTimeRange(useRandomTime && useRandomTime.checked);
      core.markUnsaved();
    });

    // Stopwatch open bookmarks toggle
    core.safeAddListener('stopwatch-open-bookmarks', 'change', (e) => {
      toggleBookmarkSelector(e.target.checked);
      core.markUnsaved();
    });

    // Stopwatch random time toggle
    core.safeAddListener('stopwatch-use-random-time', 'change', (e) => {
      toggleRandomTimeRange(e.target.checked);
      core.markUnsaved();
    });

    // Stopwatch reset position button
    core.safeAddListener('stopwatch-reset-position', 'click', () => {
      chrome.storage.sync.set({ stopwatchCustomPosition: null }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error resetting stopwatch position:', chrome.runtime.lastError);
        } else {
          core.showStatus('Stopwatch position reset to default (bottom-right)', 'success');
        }
      });
    });

    // Initialize domain tag listeners
    initializeDomainTagListeners();
  }

  function getStopwatchSettings() {
    return {
      stopwatchEnabled: core.getSafeValue('stopwatch-enabled', 'checked'),
      stopwatchPosition: core.getSafeValue('stopwatch-position'),
      stopwatchMinimizedByDefault: core.getSafeValue('stopwatch-minimized-default', 'checked'),
      stopwatchNotificationEnabled: core.getSafeValue('stopwatch-notification-enabled', 'checked'),
      stopwatchNotificationMinutes: core.validateNumericInput(core.getSafeValue('stopwatch-notification-minutes'), 1, 1440, 30),
      stopwatchIncludedDomains: core.getSafeValue('stopwatch-included-domains'),
      stopwatchOpenBookmarksOnNotification: core.getSafeValue('stopwatch-open-bookmarks', 'checked'),
      stopwatchBookmarksByDomain: parseBookmarksByDomain(core.getSafeValue('stopwatch-bookmarks-by-domain')),
      stopwatchNotificationTimeByDomain: parseNotificationTimeByDomain(core.getSafeValue('stopwatch-notification-time-by-domain')),
      stopwatchGlobalBookmarklets: getSelectedGlobalBookmarklets(),
      stopwatchNotificationSilent: core.getSafeValue('stopwatch-notification-silent', 'checked'),
      stopwatchSilentModeByDomain: parseSilentModeByDomain(core.getSafeValue('stopwatch-silent-mode-by-domain')),
      stopwatchDelayByDomain: parseDelayByDomain(core.getSafeValue('stopwatch-delay-by-domain')),
      stopwatchBookmarkletDelay: core.validateNumericInput(core.getSafeValue('stopwatch-bookmarklet-delay'), 0, 60000, 0),
      stopwatchUseRandomTime: core.getSafeValue('stopwatch-use-random-time', 'checked'),
      stopwatchRandomTimeMinMinutes: core.validateNumericInput(core.getSafeValue('stopwatch-random-min-minutes'), 1, 1440, 10),
      stopwatchRandomTimeMaxMinutes: core.validateNumericInput(core.getSafeValue('stopwatch-random-max-minutes'), 1, 1440, 30),
      stopwatchRandomTimeRangeByDomain: parseRandomTimeRangeByDomain(core.getSafeValue('stopwatch-random-time-range-by-domain'))
    };
  }

  // Register module
  app.modules.stopwatch = {
    apply: applyStopwatchSettings,
    attach: attachStopwatchListeners,
    getSettings: getStopwatchSettings
  };
})();
