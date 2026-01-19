// Settings Dates Module - Granular date format settings
(function() {
  const app = window.SettingsApp;
  const core = window.SettingsCore;

  // View keys for per-view date format settings
  const VIEW_KEYS = ['imdb', 'wikipedia', 'hotstar', 'consolidated', 'comparison'];

  // Apply date format settings to UI
  function applyDateSettings(settings) {
    // Global default (use new setting or fallback to legacy hotstarDateFormat)
    const globalDefault = settings.dateFormatDefault || settings.hotstarDateFormat || 'DD MMM YYYY';
    core.safeSetValue('date-format-default', globalDefault);

    // Per-view settings
    const byView = settings.dateFormatByView || {};
    VIEW_KEYS.forEach(view => {
      const value = byView[view] || '';
      core.safeSetValue(`date-format-${view}`, value);
    });

    // Per-field overrides
    renderFieldOverrides(settings.dateFormatByField || {});
  }

  // Render field override list
  function renderFieldOverrides(byField) {
    const container = document.getElementById('field-overrides-list');
    if (!container) return;

    container.innerHTML = '';

    const fields = Object.entries(byField);
    if (fields.length === 0) {
      container.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary); font-style: italic;">No field overrides configured.</p>';
      return;
    }

    fields.forEach(([fieldName, format]) => {
      const item = createFieldOverrideItem(fieldName, format);
      container.appendChild(item);
    });
  }

  // Create a single field override item
  function createFieldOverrideItem(fieldName, format) {
    const div = document.createElement('div');
    div.className = 'field-override-item';
    div.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: var(--surface-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 8px;
    `;
    div.dataset.fieldName = fieldName;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = fieldName;
    nameSpan.style.cssText = 'flex: 1; font-weight: 500;';

    const formatSelect = document.createElement('select');
    formatSelect.className = 'setting-input field-format-select';
    formatSelect.style.cssText = 'max-width: 180px;';
    formatSelect.dataset.fieldName = fieldName;

    const formats = [
      { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
      { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY' }
    ];

    formats.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      if (f.value === format) opt.selected = true;
      formatSelect.appendChild(opt);
    });

    formatSelect.addEventListener('change', () => {
      core.markUnsaved();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove override';
    removeBtn.style.cssText = `
      width: 28px;
      height: 28px;
      border: none;
      background: var(--danger-color, #ef4444);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    removeBtn.addEventListener('click', () => {
      div.remove();
      core.markUnsaved();
      // Check if list is now empty
      const container = document.getElementById('field-overrides-list');
      if (container && container.children.length === 0) {
        container.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary); font-style: italic;">No field overrides configured.</p>';
      }
    });

    div.appendChild(nameSpan);
    div.appendChild(formatSelect);
    div.appendChild(removeBtn);

    return div;
  }

  // Attach date format event listeners
  function attachDateListeners() {
    // Add field override button
    const addBtn = document.getElementById('add-field-override-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('new-field-name');
        const formatSelect = document.getElementById('new-field-format');

        if (!nameInput || !formatSelect) return;

        const fieldName = nameInput.value.trim();
        const format = formatSelect.value;

        if (!fieldName) {
          alert('Please enter a field name');
          return;
        }

        // Check for duplicates
        const container = document.getElementById('field-overrides-list');
        const existing = container.querySelector(`[data-field-name="${fieldName}"]`);
        if (existing) {
          alert(`An override for "${fieldName}" already exists. Remove it first to change the format.`);
          return;
        }

        // Remove empty state message if present
        const emptyMsg = container.querySelector('p');
        if (emptyMsg) emptyMsg.remove();

        // Add new item
        const item = createFieldOverrideItem(fieldName, format);
        container.appendChild(item);

        // Clear input
        nameInput.value = '';
        core.markUnsaved();
      });
    }

  }

  // Get date format settings for save
  function getDateSettings() {
    const globalDefault = core.getSafeValue('date-format-default') || 'DD MMM YYYY';

    // Collect per-view settings
    const byView = {};
    VIEW_KEYS.forEach(view => {
      const value = core.getSafeValue(`date-format-${view}`);
      if (value) {
        byView[view] = value;
      }
    });

    // Collect per-field overrides
    const byField = {};
    const container = document.getElementById('field-overrides-list');
    if (container) {
      const items = container.querySelectorAll('.field-override-item');
      items.forEach(item => {
        const fieldName = item.dataset.fieldName;
        const select = item.querySelector('.field-format-select');
        if (fieldName && select) {
          byField[fieldName] = select.value;
        }
      });
    }

    return {
      dateFormatDefault: globalDefault,
      dateFormatByView: byView,
      dateFormatByField: byField,
      // Keep legacy setting in sync for backward compatibility
      hotstarDateFormat: globalDefault
    };
  }

  // Register module
  app.modules.dates = {
    apply: applyDateSettings,
    attach: attachDateListeners,
    getSettings: getDateSettings
  };
})();
