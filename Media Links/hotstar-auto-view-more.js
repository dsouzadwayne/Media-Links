// Auto-click "View More" buttons on Hotstar

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        // Note: buttonSelectors is no longer used directly. Button finding is done via proper methods below.
        // Delay before clicking (in milliseconds)
        clickDelay: 50,
        // Interval to check for new buttons (in milliseconds)
        checkInterval: 1000,
        // Maximum number of clicks per session (10000 = effectively unlimited for most shows)
        maxClicks: 10000,
        // Enable debug logging (set to false for silent operation)
        debug: true,
        // Work in background tabs
        workInBackground: true
    };

    let clickCount = 0;
    let isProcessing = false;
    let processedButtons = new Set();
    let isPaused = false;
    let controlButton = null;
    let observerTimeout = null;
    let episodePanel = null;
    let episodePanelVisible = true;

    // Track intervals for cleanup on page unload
    let checkIntervalId = null;
    let updateEpisodeIntervalId = null;

    // Track event listeners attached to episode buttons to prevent memory leaks
    let episodeButtonListeners = new Map();

    // Debug logging
    function log(...args) {
        if (CONFIG.debug) {
            console.log('[Hotstar Auto View More]', ...args);
        }
    }

    // Find all "View More" buttons on the page
    // Only looks for the specific Hotstar button with data-testid="pill-View More"
    function findViewMoreButtons() {
        const buttons = [];

        // Look for the exact button structure: button[data-testid="pill-View More"]
        const viewMoreButtons = document.querySelectorAll('button[data-testid="pill-View More"]');
        viewMoreButtons.forEach(element => {
            if (!processedButtons.has(element)) {
                log('Found View More button');
                buttons.push(element);
            }
        });

        if (buttons.length > 0) {
            log(`Found ${buttons.length} View More button(s)`);
        }

        return buttons;
    }

    // Click a button with a delay
    function clickButton(button) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    // Mark as processed before clicking to avoid double-clicking
                    processedButtons.add(button);

                    // Click the button
                    if (typeof button.click === 'function') {
                        button.click();
                        clickCount++;
                        log(`Clicked button #${clickCount}`);
                    } else {
                        log('Error: button.click is not available');
                    }

                    resolve();
                } catch (error) {
                    log('Error clicking button:', error);
                    resolve();
                }
            }, CONFIG.clickDelay);
        });
    }

    // Clean up stale button references that are no longer in the DOM
    // This prevents memory leaks from holding references to removed DOM nodes
    function cleanupStaleButtonReferences() {
        const staleCount = processedButtons.size;
        const iterator = processedButtons.values();

        for (const button of iterator) {
            // Check if button is still in the DOM
            if (!document.body.contains(button)) {
                processedButtons.delete(button);
            }
        }

        const newCount = processedButtons.size;
        if (staleCount !== newCount) {
            log(`Cleaned up ${staleCount - newCount} stale button reference(s)`);
        }
    }

    // Process all "View More" buttons
    async function processViewMoreButtons() {
        // Don't process if paused
        if (isPaused) {
            log('Auto-clicker is paused');
            return;
        }

        if (isProcessing || clickCount >= CONFIG.maxClicks) {
            return;
        }

        // Clean up stale references periodically to prevent memory leaks
        cleanupStaleButtonReferences();

        isProcessing = true;
        const buttons = findViewMoreButtons();

        if (buttons.length > 0) {
            log(`Found ${buttons.length} new "View More" button(s)`);

            for (const button of buttons) {
                // Check if paused during processing
                if (isPaused) {
                    log('Auto-clicker paused during processing');
                    break;
                }

                if (clickCount >= CONFIG.maxClicks) {
                    log(`Reached maximum clicks limit (${CONFIG.maxClicks})`);
                    break;
                }

                await clickButton(button);

                // Reduced wait time between clicks to be faster and less noticeable
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }

        isProcessing = false;
    }

    // Set up MutationObserver to watch for new content
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            // Check if new episode cards were added
            let hasNewEpisodes = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    hasNewEpisodes = addedNodes.some(node => {
                        return node.nodeType === 1 && (
                            node.matches('li[data-testid="episode-card"]') ||
                            node.querySelector('li[data-testid="episode-card"]')
                        );
                    });
                }
            });

            // Debounce: only process after mutations stop for a bit
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // Process even in background if configured
                if (CONFIG.workInBackground || document.visibilityState === 'visible') {
                    processViewMoreButtons();
                }

                // Update episode list if new episodes were detected
                if (hasNewEpisodes) {
                    updateEpisodeList();
                }
            }, 200);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false, // Don't watch attributes for better performance
            characterData: false
        });

        log('MutationObserver set up (works in background: ' + CONFIG.workInBackground + ')');
    }

    // Handle visibility changes
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            log('Tab became visible, processing buttons...');
            processViewMoreButtons();
        } else {
            log('Tab moved to background, continuing to monitor...');
        }
    }

    // Get current theme colors from Hotstar's actual styles including Catppuccin
    function getThemeColors() {
        const root = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        const htmlElement = document.documentElement;

        // Detect Catppuccin theme from data-theme or class
        const dataTheme = htmlElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') || '';
        const htmlClass = htmlElement.className || '';
        const bodyClass = document.body.className || '';
        const allClasses = `${htmlClass} ${bodyClass} ${dataTheme}`.toLowerCase();

        // Catppuccin color palettes
        const catppuccinThemes = {
            latte: {
                name: 'Catppuccin Latte',
                base: '#eff1f5',
                mantle: '#e6e9ef',
                crust: '#dce0e8',
                text: '#4c4f69',
                subtext: '#6c6f85',
                surface0: '#ccd0dd',
                surface1: '#bcc0cc',
                surface2: '#acb0be',
                rosewater: '#f2d5cf',
                flamingo: '#eebebe',
                pink: '#f4b8e4',
                mauve: '#ca9ee6',
                red: '#e64553',
                peach: '#fe640b',
                yellow: '#df8e1d',
                green: '#40a02b',
                teal: '#179299',
                blue: '#1e66f5',
                sapphire: '#04a5e5',
                sky: '#04b5e5',
                lavender: '#7287fd'
            },
            frappe: {
                name: 'Catppuccin Frappé',
                base: '#303446',
                mantle: '#292c3c',
                crust: '#232634',
                text: '#c6d0f5',
                subtext: '#949cbb',
                surface0: '#414559',
                surface1: '#51576d',
                surface2: '#626880',
                rosewater: '#f2d5cf',
                flamingo: '#eebebe',
                pink: '#f4b8e4',
                mauve: '#ca9ee6',
                red: '#e64545',
                peach: '#ef9f76',
                yellow: '#e5c890',
                green: '#a6d189',
                teal: '#81c8be',
                blue: '#8caaee',
                sapphire: '#85c1dc',
                sky: '#99d1db',
                lavender: '#babbf1'
            },
            macchiato: {
                name: 'Catppuccin Macchiato',
                base: '#24273a',
                mantle: '#1e2030',
                crust: '#181926',
                text: '#cad1f5',
                subtext: '#b8c0e0',
                surface0: '#363a4f',
                surface1: '#494d64',
                surface2: '#5b6078',
                rosewater: '#f4dbd6',
                flamingo: '#f0c6c6',
                pink: '#f5bde6',
                mauve: '#c6a0f6',
                red: '#ed8796',
                peach: '#f5a97f',
                yellow: '#eed49f',
                green: '#a6da95',
                teal: '#8bd5ca',
                blue: '#8aadf4',
                sapphire: '#7dc4e4',
                sky: '#91d7e3',
                lavender: '#b7bdf8'
            },
            mocha: {
                name: 'Catppuccin Mocha',
                base: '#1e1e2e',
                mantle: '#181825',
                crust: '#11111b',
                text: '#cdd6f4',
                subtext: '#bac2de',
                surface0: '#313244',
                surface1: '#45475a',
                surface2: '#585b70',
                rosewater: '#f5e0dc',
                flamingo: '#f2cdcd',
                pink: '#f5c2e7',
                mauve: '#cba6f7',
                red: '#f38ba8',
                peach: '#fab387',
                yellow: '#f9e2af',
                green: '#a6e3a1',
                teal: '#94e2d5',
                blue: '#89b4fa',
                sapphire: '#74c7ec',
                sky: '#89dceb',
                lavender: '#b4befe'
            }
        };

        // Detect which Catppuccin theme is active
        let activeCatppuccin = null;
        for (const [key, theme] of Object.entries(catppuccinThemes)) {
            if (allClasses.includes(key)) {
                activeCatppuccin = theme;
                log(`Detected Catppuccin ${key} theme`);
                break;
            }
        }

        // Try to get colors from CSS variables first
        let primaryBg = root.getPropertyValue('--primary-bg').trim() || root.getPropertyValue('--bg-primary').trim();
        let textPrimary = root.getPropertyValue('--text-primary').trim() || root.getPropertyValue('--fg-primary').trim();
        let secondaryBg = root.getPropertyValue('--secondary-bg').trim() || root.getPropertyValue('--bg-secondary').trim();
        let border = root.getPropertyValue('--border').trim() || root.getPropertyValue('--border-color').trim();

        // Check for Catppuccin CSS variables
        if (!primaryBg) {
            primaryBg = root.getPropertyValue('--ctp-base').trim() || root.getPropertyValue('--catppuccin-base').trim();
        }
        if (!textPrimary) {
            textPrimary = root.getPropertyValue('--ctp-text').trim() || root.getPropertyValue('--catppuccin-text').trim();
        }

        // If no CSS variables, extract from body element
        if (!primaryBg) {
            primaryBg = body.backgroundColor;
        }
        if (!textPrimary) {
            textPrimary = body.color;
        }

        // Determine if using Catppuccin theme
        const isCatppuccin = !!activeCatppuccin;
        const isDark = isCatppuccin || !primaryBg || primaryBg === 'rgba(0, 0, 0, 0)' ||
                       (primaryBg && (primaryBg.includes('0, 0, 0') || primaryBg.includes('1a1a1a') || primaryBg.includes('121212') || primaryBg.includes('1e1e')));

        // Return Catppuccin theme if detected
        if (activeCatppuccin) {
            return {
                primaryBg: activeCatppuccin.base,
                secondaryBg: activeCatppuccin.surface0,
                textPrimary: activeCatppuccin.text,
                accent: activeCatppuccin.blue,
                accentHover: activeCatppuccin.sapphire,
                success: activeCatppuccin.green,
                danger: activeCatppuccin.red,
                border: activeCatppuccin.surface2,
                isDark: true,
                isCatppuccin: true,
                themeName: activeCatppuccin.name
            };
        }

        return {
            primaryBg: primaryBg || (isDark ? '#121212' : '#ffffff'),
            secondaryBg: secondaryBg || (isDark ? '#1e1e1e' : '#f5f5f5'),
            textPrimary: textPrimary || (isDark ? '#ffffff' : '#000000'),
            accent: root.getPropertyValue('--accent').trim() || '#6366f1',
            accentHover: root.getPropertyValue('--accent-hover').trim() || '#4f46e5',
            success: root.getPropertyValue('--success').trim() || '#10b981',
            danger: root.getPropertyValue('--danger').trim() || '#ef4444',
            border: border || (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
            isDark: isDark,
            isCatppuccin: false,
            themeName: isDark ? 'Dark' : 'Light'
        };
    }

    // Create pause/resume control button
    function createControlButton() {
        if (controlButton) return;

        const button = document.createElement('button');
        button.id = 'hotstar-auto-viewmore-control';
        button.title = 'Toggle Auto View More (Press Ctrl+Shift+V)';

        // Styling for the button - uses theme colors - MADE MORE VISIBLE
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '20px', // Changed to bottom instead of top
            right: '20px',
            zIndex: '10001',
            minWidth: '100px',
            height: '50px',
            padding: '12px 24px',
            borderRadius: '25px',
            border: '3px solid',
            cursor: 'pointer !important',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            opacity: '1',
            pointerEvents: 'auto'
        });

        updateButtonState(button);

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            // Ensure button state is properly reset
            updateButtonState(button);
        });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePause();
            log('Button clicked - toggling pause state');
        });

        // Also add mousedown listener as backup
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Ensure button stays clickable
        button.style.pointerEvents = 'auto';

        document.body.appendChild(button);
        controlButton = button;
    }

    function updateButtonState(button = controlButton) {
        if (!button) return;

        const colors = getThemeColors();

        if (isPaused) {
            button.innerHTML = 'OFF';
            button.style.backgroundColor = colors.danger;
            button.style.borderColor = colors.danger;
            button.style.color = '#ffffff';
            button.title = 'Click to Enable Auto View More (Currently Disabled)';
        } else {
            button.innerHTML = 'ON';
            button.style.backgroundColor = colors.success;
            button.style.borderColor = colors.success;
            button.style.color = '#ffffff';
            button.title = 'Click to Disable Auto View More (Currently Enabled)';
        }
    }

    // Update scrollbar styles when theme changes
    function updateScrollbarTheme() {
        const colors = getThemeColors();
        const isDark = colors.isDark;
        const isCatppuccin = colors.isCatppuccin;

        let styleContent;

        if (isCatppuccin) {
            // Use Catppuccin colors for scrollbar
            const track = colors.surface0;
            const thumb = colors.accent;
            const thumbHover = colors.accentHover;

            styleContent = `
                #hotstar-episode-list::-webkit-scrollbar {
                    width: 6px;
                }
                #hotstar-episode-list::-webkit-scrollbar-track {
                    background: ${track};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb {
                    background: ${thumb};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb:hover {
                    background: ${thumbHover};
                }
            `;
        } else {
            // Standard dark/light theme colors
            const scrollbarTrack = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
            const scrollbarThumb = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';
            const scrollbarThumbHover = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';

            styleContent = `
                #hotstar-episode-list::-webkit-scrollbar {
                    width: 6px;
                }
                #hotstar-episode-list::-webkit-scrollbar-track {
                    background: ${scrollbarTrack};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb {
                    background: ${scrollbarThumb};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb:hover {
                    background: ${scrollbarThumbHover};
                }
            `;
        }

        // Find and update existing style element, or create new one
        let styleElement = document.getElementById('hotstar-scrollbar-style');
        if (styleElement) {
            styleElement.textContent = styleContent;
        } else {
            styleElement = document.createElement('style');
            styleElement.id = 'hotstar-scrollbar-style';
            styleElement.textContent = styleContent;
            document.head.appendChild(styleElement);
        }

        log('Scrollbar theme updated');
    }

    // Update episode panel colors when theme changes
    function updateEpisodePanelTheme() {
        if (!episodePanel) return;

        const colors = getThemeColors();
        const isDark = colors.isDark;
        const panel = episodePanel;
        const episodeList = document.getElementById('hotstar-episode-list');
        const header = panel.querySelector('div:first-child');
        const title = header ? header.querySelector('div:first-child') : null;
        const toggleBtn = header ? header.querySelector('button') : null;
        const searchInput = document.getElementById('hotstar-episode-search');

        // Update theme attribute
        panel.setAttribute('data-theme', isDark ? 'dark' : 'light');

        // Set colors based on theme
        const panelBg = isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        const textColor = isDark ? '#ffffff' : '#000000';
        const borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
        const headerBorderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        const buttonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        const buttonBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
        const searchBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
        const searchBorder = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';

        // Update panel background and border
        panel.style.backgroundColor = panelBg;
        panel.style.borderColor = borderColor;
        panel.style.color = textColor;
        panel.style.boxShadow = isDark ? '0 8px 32px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.1)';

        // Update header
        if (header) {
            header.style.borderColor = headerBorderColor;
        }

        // Update title
        if (title) {
            title.style.color = textColor;
        }

        // Update toggle button
        if (toggleBtn) {
            toggleBtn.style.color = textColor;
        }

        // Update search input
        if (searchInput) {
            searchInput.style.backgroundColor = searchBg;
            searchInput.style.borderColor = searchBorder;
            searchInput.style.color = textColor;
        }

        // Update all episode buttons
        const episodeButtons = episodeList ? episodeList.querySelectorAll('button[data-episode-number]') : [];
        episodeButtons.forEach(btn => {
            btn.style.backgroundColor = buttonBg;
            btn.style.borderColor = buttonBorder;
            btn.style.color = textColor;
        });

        // Update scrollbar theme colors
        updateScrollbarTheme();

        log('Episode panel theme updated');
    }

    function togglePause() {
        isPaused = !isPaused;
        updateButtonState();

        // Save state to storage
        try {
            chrome.storage.sync.set({ 'hotstarAutoViewMorePaused': isPaused }, () => {
                log(`Auto-clicker ${isPaused ? 'paused' : 'resumed'}`);
            });
        } catch (error) {
            log('Error saving pause state:', error);
        }

        // If resumed, immediately check for buttons
        if (!isPaused) {
            processViewMoreButtons();
        }
    }

    function removeControlButton() {
        if (controlButton) {
            controlButton.remove();
            controlButton = null;
        }
    }

    // Load initial pause state from storage
    function loadPauseState() {
        try {
            chrome.storage.sync.get(['hotstarAutoViewMorePaused'], (result) => {
                isPaused = result.hotstarAutoViewMorePaused === true;
                updateButtonState();
                log('Loaded pause state:', isPaused ? 'paused' : 'active');
            });
        } catch (error) {
            log('Error loading pause state:', error);
        }
    }

    // Listen for storage changes (from settings page)
    function listenForStorageChanges() {
        try {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'sync' && changes.hotstarAutoViewMorePaused) {
                    isPaused = changes.hotstarAutoViewMorePaused.newValue === true;
                    updateButtonState();
                    log('Pause state updated from settings:', isPaused ? 'paused' : 'active');
                }
                // Update button colors when theme changes
                if (namespace === 'sync' && changes.theme) {
                    updateButtonState();
                    log('Button updated for theme change');
                }
            });
        } catch (error) {
            log('Error setting up storage listener:', error);
        }
    }

    // Listen for theme changes via MutationObserver on data-theme attribute
    function listenForThemeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    updateButtonState();
                    updateEpisodePanelTheme();
                    log('Button and panel updated for theme attribute change');
                }
            });
        });

        // Observe the document.body for theme changes
        if (document.body) {
            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }

        // Also observe html element in case theme is set there
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    // Add keyboard shortcut listener (Ctrl+Shift+V to toggle)
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+V or Cmd+Shift+V on Mac
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                togglePause();

                // Show visual feedback
                if (controlButton) {
                    controlButton.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        controlButton.style.transform = 'scale(1)';
                    }, 200);
                }

                // Show notification
                showNotification(isPaused ? 'Auto View More: OFF' : 'Auto View More: ON');
                log(`Toggled via keyboard shortcut: ${isPaused ? 'paused' : 'active'}`);
            }
        });
        log('Keyboard shortcut registered: Ctrl+Shift+V');
    }

    // Show temporary notification with theme-aware colors
    function showNotification(message) {
        const colors = getThemeColors();
        const notification = document.createElement('div');
        notification.textContent = message;

        // Determine notification colors based on theme
        let notificationBg, notificationText, notificationShadow;

        if (colors.isCatppuccin) {
            // Use Catppuccin colors
            notificationBg = colors.primaryBg;
            notificationText = colors.textPrimary;
            notificationShadow = colors.isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(0, 0, 0, 0.2)';
        } else {
            // Standard dark/light theme colors
            if (colors.isDark) {
                notificationBg = 'rgba(0, 0, 0, 0.9)';
                notificationText = '#ffffff';
                notificationShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            } else {
                notificationBg = 'rgba(255, 255, 255, 0.95)';
                notificationText = '#000000';
                notificationShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }
        }

        Object.assign(notification.style, {
            position: 'fixed',
            bottom: '80px', // Above the button
            right: '20px',
            zIndex: '2147483647',
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: notificationBg,
            color: notificationText,
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: notificationShadow,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none'
        });

        document.body.appendChild(notification);

        // Fade out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Create episode navigation panel
    function createEpisodePanel() {
        if (episodePanel) return;

        const colors = getThemeColors();
        const isDark = colors.isDark;
        const isCatppuccin = colors.isCatppuccin;
        const panel = document.createElement('div');
        panel.id = 'hotstar-episode-panel';
        panel.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (isCatppuccin) {
            panel.setAttribute('data-catppuccin', 'true');
        }

        // Use contrasting colors based on theme
        let panelBg, textColor, borderColor, buttonBg;

        if (isCatppuccin) {
            // Catppuccin theme colors - use actual color values
            panelBg = colors.primaryBg;
            textColor = colors.textPrimary;
            borderColor = colors.border;
            buttonBg = colors.secondaryBg;
        } else {
            // Standard dark/light theme
            panelBg = isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)';
            textColor = isDark ? '#ffffff' : '#000000';
            borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
            buttonBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        }

        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            zIndex: '10000',
            width: '200px',
            maxHeight: '90vh',
            minHeight: '300px',
            backgroundColor: panelBg,
            borderRadius: '12px',
            padding: '12px',
            boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            backdropFilter: 'blur(10px)',
            border: `2px solid ${borderColor}`,
            overflow: 'hidden',
            color: textColor,
            boxSizing: 'border-box'
        });

        // Episode list container (scrollable with grid layout) - DECLARE FIRST
        const episodeList = document.createElement('div');
        episodeList.id = 'hotstar-episode-list';
        Object.assign(episodeList.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridAutoRows: 'max-content',
            gap: '6px',
            overflowY: 'auto',
            overflowX: 'hidden',
            overflow: 'auto',
            flex: '1 1 auto',
            minHeight: '0',
            paddingRight: '6px',
            paddingBottom: '8px',
            WebkitOverflowScrolling: 'touch',
            transition: 'max-height 0.2s ease, opacity 0.2s ease',
            maxHeight: 'calc(100% - 88px)',
            opacity: '1',
            visibility: 'visible',
            pointerEvents: 'auto'
        });

        // Header
        const headerBorderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 2px solid ${headerBorderColor};
            margin-bottom: 4px;
            flex-shrink: 0;
        `;

        const title = document.createElement('div');
        title.textContent = 'Episodes';
        title.style.cssText = `
            color: ${textColor};
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;

        // BUG FIX: Create searchInput early so it's available in toggleBtn click handler
        const searchInput = document.createElement('input');
        searchInput.id = 'hotstar-episode-search';
        searchInput.type = 'text';
        searchInput.placeholder = 'Find episode';
        searchInput.title = 'Search episodes - type to filter, press Enter to navigate';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '−';
        toggleBtn.title = 'Toggle episode list';
        const toggleHoverColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
        toggleBtn.style.cssText = `
            background: transparent;
            border: none;
            color: ${textColor};
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            pointer-events: auto;
            z-index: 10;
        `;

        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.backgroundColor = toggleHoverColor;
        });

        toggleBtn.addEventListener('mouseleave', () => {
            toggleBtn.style.backgroundColor = 'transparent';
        });

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            episodePanelVisible = !episodePanelVisible;

            if (episodePanelVisible) {
                // Show: make visible and expand
                episodeList.style.visibility = 'visible';
                episodeList.style.pointerEvents = 'auto';
                searchInput.style.visibility = 'visible';
                searchInput.style.pointerEvents = 'auto';
                // Force reflow to ensure transition takes effect
                void episodeList.offsetHeight;
                episodeList.style.maxHeight = 'calc(100% - 88px)';
                episodeList.style.opacity = '1';
                episodeList.style.overflow = 'auto';
                toggleBtn.textContent = '−';
                log('Episode panel expanded');
            } else {
                // Hide: collapse then hide
                episodeList.style.maxHeight = '0';
                episodeList.style.opacity = '0';
                episodeList.style.overflow = 'hidden';
                searchInput.style.visibility = 'hidden';
                searchInput.style.pointerEvents = 'none';

                // Delay visibility change until animation completes (200ms)
                setTimeout(() => {
                    episodeList.style.visibility = 'hidden';
                    episodeList.style.pointerEvents = 'none';
                }, 200);
                toggleBtn.textContent = '+';
                log('Episode panel collapsed');
            }
        });

        header.appendChild(title);
        header.appendChild(toggleBtn);
        panel.appendChild(header);

        // Style the search input (searchInput was declared at line 879 above)
        const searchBorder = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        const searchBg = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)';
        const searchFocusBorder = colors.accent || '#6366f1';

        searchInput.style.cssText = `
            width: calc(100% - 4px);
            padding: 8px;
            margin-bottom: 8px;
            border: 1px solid ${searchBorder};
            border-radius: 4px;
            background-color: ${searchBg};
            color: ${textColor};
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
            transition: all 200ms ease;
            outline: none;
        `;

        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = searchFocusBorder;
            searchInput.style.boxShadow = `0 0 0 2px ${searchFocusBorder}33`;
        });

        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = searchBorder;
            searchInput.style.boxShadow = 'none';
        });

        panel.appendChild(searchInput);
        panel.appendChild(episodeList);

        // Custom scrollbar with theme-aware colors
        const scrollbarTrack = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const scrollbarThumb = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';
        const scrollbarThumbHover = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';

        // Create or update scrollbar style element (avoid duplicates)
        let scrollbarStyle = document.getElementById('hotstar-scrollbar-style');
        if (!scrollbarStyle) {
            scrollbarStyle = document.createElement('style');
            scrollbarStyle.id = 'hotstar-scrollbar-style';
            document.head.appendChild(scrollbarStyle);
        }

        // Set scrollbar colors based on theme
        if (isCatppuccin) {
            // Use Catppuccin colors for scrollbar
            const catppuccinTrack = colors.surface0;
            const catppuccinThumb = colors.accent;
            const catppuccinThumbHover = colors.accentHover;

            scrollbarStyle.textContent = `
                #hotstar-episode-list::-webkit-scrollbar {
                    width: 6px;
                }
                #hotstar-episode-list::-webkit-scrollbar-track {
                    background: ${catppuccinTrack};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb {
                    background: ${catppuccinThumb};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb:hover {
                    background: ${catppuccinThumbHover};
                }
            `;
        } else {
            scrollbarStyle.textContent = `
                #hotstar-episode-list::-webkit-scrollbar {
                    width: 6px;
                }
                #hotstar-episode-list::-webkit-scrollbar-track {
                    background: ${scrollbarTrack};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb {
                    background: ${scrollbarThumb};
                    border-radius: 3px;
                }
                #hotstar-episode-list::-webkit-scrollbar-thumb:hover {
                    background: ${scrollbarThumbHover};
                }
            `;
        }

        document.body.appendChild(panel);
        episodePanel = panel;

        log('Episode panel created');
    }

    // Update episode list in the panel
    function updateEpisodeList() {
        if (!episodePanel) {
            log('ERROR: Episode panel not initialized');
            return;
        }

        const episodeList = document.getElementById('hotstar-episode-list');
        if (!episodeList) {
            log('ERROR: Episode list element not found');
            return;
        }

        const colors = getThemeColors();

        // Find all episode cards
        const episodeCards = document.querySelectorAll('li[data-testid="episode-card"]');

        if (episodeCards.length === 0) {
            // Only show empty message if list is completely empty
            if (episodeList.children.length === 0) {
                const isDarkPanel = colors.isDark;
                const emptyMsg = document.createElement('div');
                emptyMsg.id = 'hotstar-episode-empty-message';
                emptyMsg.textContent = 'No episodes loaded';
                emptyMsg.style.cssText = `
                    color: ${isDarkPanel ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'};
                    font-size: 12px;
                    text-align: center;
                    padding: 20px 10px;
                `;
                episodeList.appendChild(emptyMsg);
            }
            return;
        }

        // Remove empty message if present
        const existingMsg = document.getElementById('hotstar-episode-empty-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        // Track existing episode buttons to avoid duplicates
        // Also clear old buttons to prevent memory leaks from accumulating listeners
        const existingEpisodes = new Set();
        const existingButtons = episodeList.querySelectorAll('button[data-episode-number]');
        existingButtons.forEach(btn => {
            existingEpisodes.add(parseInt(btn.dataset.episodeNumber));
        });

        // Add episode buttons for ALL episodes (no limit) - only add new ones
        let addedCount = 0;
        episodeCards.forEach((card, index) => {
            // Try to extract actual episode number from the card
            let episodeNum = index + 1;
            const episodeTag = card.querySelector('span[data-testid="textTag"] span');
            if (episodeTag) {
                const episodeText = episodeTag.textContent.trim();
                // Match pattern like "S1 E1838" or "E1838"
                const match = episodeText.match(/E(\d+)/);
                if (match) {
                    episodeNum = parseInt(match[1]);
                }
            }

            // Skip if already exists
            if (existingEpisodes.has(episodeNum)) {
                return;
            }

            addedCount++;

            // Try to find episode title for tooltip
            const titleElement = card.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : `Episode ${episodeNum}`;

            const episodeBtn = document.createElement('button');
            episodeBtn.textContent = `E${episodeNum}`;
            episodeBtn.title = title;
            // Generate a unique identifier for this episode card to handle dynamic DOM changes
            const cardId = `episode-card-${episodeNum}-${Date.now()}-${index}`;
            card.dataset.mediaLinksCardId = cardId;

            episodeBtn.dataset.episodeCardId = cardId;
            episodeBtn.dataset.episodeNumber = episodeNum;

            const isDarkPanel = colors.isDark;
            const isCatppuccin = colors.isCatppuccin;

            let buttonBg, buttonBorder, buttonText, buttonHoverBg;

            if (isCatppuccin) {
                // Use Catppuccin colors
                buttonBg = colors.secondaryBg;
                buttonBorder = colors.border;
                buttonText = colors.textPrimary;
                buttonHoverBg = colors.accent;
            } else {
                // Standard dark/light colors
                buttonBg = isDarkPanel ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                buttonBorder = isDarkPanel ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
                buttonText = isDarkPanel ? '#ffffff' : '#000000';
                buttonHoverBg = isDarkPanel ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
            }

            episodeBtn.style.cssText = `
                background: ${buttonBg};
                border: 1px solid ${buttonBorder};
                color: ${buttonText};
                padding: 8px 6px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: background-color 0.2s ease, opacity 0.2s ease;
                text-align: center;
                width: 100%;
                min-height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
                box-sizing: border-box;
                pointer-events: auto;
            `;

            // Create named handlers for proper cleanup
            const mouseEnterHandler = () => {
                episodeBtn.style.backgroundColor = buttonHoverBg;
                episodeBtn.style.opacity = '1';
            };

            const mouseLeaveHandler = () => {
                episodeBtn.style.backgroundColor = buttonBg;
                episodeBtn.style.opacity = '0.9';
            };

            const clickHandler = (e) => {
                e.stopPropagation();
                scrollToEpisode(card, episodeNum);

                // Visual feedback with theme-aware colors
                const successColor = colors.success;
                episodeBtn.style.backgroundColor = successColor + '4d'; // 30% opacity
                episodeBtn.style.borderColor = successColor + '99'; // 60% opacity
                setTimeout(() => {
                    episodeBtn.style.backgroundColor = buttonBg;
                    episodeBtn.style.borderColor = buttonBorder;
                }, 500);
            };

            episodeBtn.addEventListener('mouseenter', mouseEnterHandler);
            episodeBtn.addEventListener('mouseleave', mouseLeaveHandler);
            episodeBtn.addEventListener('click', clickHandler);

            // Track listeners for cleanup to prevent memory leaks
            episodeButtonListeners.set(episodeBtn, [
                { type: 'mouseenter', handler: mouseEnterHandler },
                { type: 'mouseleave', handler: mouseLeaveHandler },
                { type: 'click', handler: clickHandler }
            ]);

            episodeList.appendChild(episodeBtn);
        });

        if (addedCount > 0) {
            log(`Added ${addedCount} new episode(s), total: ${episodeCards.length}`);
        }

        // Re-apply current search filter after updating episode list
        const searchInput = document.getElementById('hotstar-episode-search');
        if (searchInput && searchInput.value) {
            filterEpisodesBySearch(searchInput.value);
        }
    }

    // Scroll to a specific episode
    function scrollToEpisode(episodeCard, episodeNum) {
        if (!episodeCard) return;

        episodeCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });

        // Get theme colors for highlight
        const colors = getThemeColors();
        const highlightColor = colors.success;
        const highlightGlow = colors.isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)';

        // Highlight the episode briefly with theme-aware colors
        const originalBorder = episodeCard.style.border;
        const originalBoxShadow = episodeCard.style.boxShadow;

        episodeCard.style.border = `3px solid ${highlightColor}`;
        episodeCard.style.boxShadow = `0 0 20px ${highlightColor}66`;
        episodeCard.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            episodeCard.style.border = originalBorder;
            episodeCard.style.boxShadow = originalBoxShadow;
        }, 2000);

        showNotification(`Jumped to Episode ${episodeNum}`);
        log(`Scrolled to episode ${episodeNum}`);
    }

    // Filter episodes by search term
    function filterEpisodesBySearch(searchTerm) {
        const episodeList = document.getElementById('hotstar-episode-list');
        if (!episodeList) return;

        const episodeButtons = episodeList.querySelectorAll('button[data-episode-number]');
        const cleanSearch = searchTerm.trim().toLowerCase();

        if (!cleanSearch) {
            // Show all episodes if search is empty
            episodeButtons.forEach(btn => {
                btn.classList.remove('hotstar-episode-hidden');
                btn.style.display = '';
                btn.style.opacity = '0.9';
            });
            log(`Cleared search filter, showing all ${episodeButtons.length} episodes`);
            return;
        }

        let visibleCount = 0;
        let exactMatch = null;

        episodeButtons.forEach(btn => {
            const episodeNum = btn.dataset.episodeNumber;
            const episodeText = `E${episodeNum}`;

            // Check if episode number contains the search term
            if (episodeText.toLowerCase().includes(cleanSearch) || episodeNum.toLowerCase().includes(cleanSearch)) {
                btn.classList.remove('hotstar-episode-hidden');
                btn.style.display = '';
                btn.style.opacity = '0.9';
                visibleCount++;

                // Track exact match (for Enter key)
                if (episodeNum === cleanSearch || episodeText.toLowerCase() === `e${cleanSearch}`) {
                    exactMatch = btn;
                }
            } else {
                // Hide non-matching episodes
                btn.classList.add('hotstar-episode-hidden');
                btn.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            log(`No episodes found matching "${cleanSearch}"`);
            showNotification(`No episodes found for "${cleanSearch}"`);
        } else {
            log(`Found ${visibleCount} episode(s) matching "${cleanSearch}"`);
        }
    }

    // Cleanup episode button event listeners to prevent memory leaks
    function cleanupEpisodeButtonListeners() {
        episodeButtonListeners.forEach((listeners, button) => {
            listeners.forEach(({ type, handler }) => {
                button.removeEventListener(type, handler);
            });
        });
        episodeButtonListeners.clear();
        log('Episode button listeners cleaned up');
    }

    // Cleanup episode panel and related resources
    function cleanupEpisodePanel() {
        // Clean up button listeners first
        cleanupEpisodeButtonListeners();

        if (episodePanel) {
            episodePanel.remove();
            episodePanel = null;
        }
        const scrollbarStyle = document.getElementById('hotstar-scrollbar-style');
        if (scrollbarStyle) {
            scrollbarStyle.remove();
        }
        log('Episode panel cleaned up');
    }

    // BUG FIX: Comprehensive cleanup function for all resources
    function cleanupAllResources() {
        // Clear all intervals to prevent memory leaks
        if (checkIntervalId) {
            clearInterval(checkIntervalId);
            checkIntervalId = null;
            log('Cleared check interval');
        }
        if (updateEpisodeIntervalId) {
            clearInterval(updateEpisodeIntervalId);
            updateEpisodeIntervalId = null;
            log('Cleared episode update interval');
        }
        if (observerTimeout) {
            clearTimeout(observerTimeout);
            observerTimeout = null;
        }

        // Clear processedButtons to free memory
        processedButtons.clear();
        log('Cleared processedButtons set');

        // Cleanup UI elements
        cleanupEpisodePanel();
        removeControlButton();

        log('All resources cleaned up');
    }

    // Setup event listeners for search input
    function setupSearchEventListeners() {
        const searchInput = document.getElementById('hotstar-episode-search');
        if (!searchInput) {
            log('Search input element not found, retrying...');
            setTimeout(setupSearchEventListeners, 100);
            return;
        }

        // Real-time filtering as user types
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            filterEpisodesBySearch(searchTerm);
        });

        // Enter key: navigate to exact episode match
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchTerm = searchInput.value.trim();

                if (!searchTerm) {
                    showNotification('Please enter an episode number');
                    return;
                }

                const cleanSearch = searchTerm.toLowerCase().replace(/^e/, '');
                const episodeList = document.getElementById('hotstar-episode-list');

                // Find button with exact match
                const buttons = episodeList.querySelectorAll('button[data-episode-number]');
                let foundButton = null;
                let foundCard = null;

                buttons.forEach(btn => {
                    if (btn.dataset.episodeNumber === cleanSearch) {
                        foundButton = btn;
                    }
                });

                if (foundButton) {
                    // Find the corresponding episode card using stored card ID
                    const cardId = foundButton.dataset.episodeCardId;
                    foundCard = document.querySelector(`li[data-media-links-card-id="${cardId}"]`);

                    if (foundCard) {
                        scrollToEpisode(foundCard, cleanSearch);
                        searchInput.blur();
                        log(`Navigated to exact episode ${cleanSearch}`);
                    } else {
                        // Fallback: try to find by episode number in the current DOM
                        const episodeCards = document.querySelectorAll('li[data-testid="episode-card"]');
                        for (const card of episodeCards) {
                            const episodeTag = card.querySelector('span[data-testid="textTag"] span');
                            if (episodeTag) {
                                const match = episodeTag.textContent.match(/E(\d+)/);
                                if (match && match[1] === cleanSearch) {
                                    scrollToEpisode(card, cleanSearch);
                                    searchInput.blur();
                                    log(`Navigated to episode ${cleanSearch} via fallback`);
                                    return;
                                }
                            }
                        }
                        log(`ERROR: Episode card with ID ${cardId} no longer in DOM`);
                        showNotification(`Episode ${cleanSearch} card no longer available`);
                    }
                } else {
                    showNotification(`Episode ${cleanSearch} not found`);
                    log(`Episode ${cleanSearch} not found in loaded episodes`);
                }
            }
        });

        log('Search event listeners set up');
    }

    // Initialize
    function init() {
        log('Initializing auto View More clicker for Hotstar');
        log('Background mode enabled:', CONFIG.workInBackground);

        // Load pause state from storage
        loadPauseState();

        // Listen for storage changes
        listenForStorageChanges();

        // Listen for theme changes
        listenForThemeChanges();

        // Setup keyboard shortcut
        setupKeyboardShortcut();

        // Create control button
        if (document.body) {
            createControlButton();
            createEpisodePanel();
            setupSearchEventListeners();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                createControlButton();
                createEpisodePanel();
                setupSearchEventListeners();
            });
        }

        // Show initial notification
        setTimeout(() => {
            showNotification('Auto View More is ACTIVE. Press Ctrl+Shift+V to toggle.');
        }, 1000);

        // Initial episode list update - try multiple times to catch loaded episodes
        setTimeout(() => {
            updateEpisodeList();
            log('First episode list update attempt');
        }, 2000);

        setTimeout(() => {
            updateEpisodeList();
            log('Second episode list update attempt');
        }, 4000);

        setTimeout(() => {
            updateEpisodeList();
            log('Third episode list update attempt');
        }, 6000);

        // Initial check after page load
        setTimeout(() => {
            processViewMoreButtons();
        }, 2000);

        // BUG FIX: Store interval IDs for cleanup on page unload
        // Set up periodic checks (works in background too)
        checkIntervalId = setInterval(() => {
            if (clickCount < CONFIG.maxClicks) {
                // Process regardless of visibility state if workInBackground is true
                // Also check if not paused
                if (!isPaused && (CONFIG.workInBackground || document.visibilityState === 'visible')) {
                    processViewMoreButtons();
                }
            } else {
                log(`Reached max clicks limit (${CONFIG.maxClicks}). Manual clicking still works. Reset via console: window.hotstarAutoViewMore.reset()`);
            }
        }, CONFIG.checkInterval);

        // Update episode list every 1000ms to catch newly loaded episodes
        // Note: MutationObserver also updates on DOM changes, so this is a fallback
        updateEpisodeIntervalId = setInterval(() => {
            updateEpisodeList();
        }, 1000);

        // Set up observer for dynamic content
        if (document.body) {
            setupObserver();
        } else {
            document.addEventListener('DOMContentLoaded', setupObserver);
        }

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // BUG FIX: Clean up ALL resources on page navigation (not just panel)
        window.addEventListener('beforeunload', cleanupAllResources);
        document.addEventListener('pagehide', cleanupAllResources);
        // Also listen for visibilitychange to hidden as a fallback
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Don't cleanup on tab switch, only on actual navigation
                // But do clean up processedButtons periodically
                cleanupStaleButtonReferences();
            }
        });

        log('='.repeat(60));
        log('Auto-clicker initialized and will work in background tabs');
        log('KEYBOARD SHORTCUT: Press Ctrl+Shift+V to toggle ON/OFF');
        log('Look for the control button in the top-right corner');
        log('='.repeat(60));
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose controls to window for manual control via console
    window.hotstarAutoViewMore = {
        clickCount: () => clickCount,
        isPaused: () => isPaused,
        pause: () => {
            if (!isPaused) {
                togglePause();
            }
        },
        resume: () => {
            if (isPaused) {
                togglePause();
            }
        },
        toggle: togglePause,
        reset: () => {
            clickCount = 0;
            processedButtons.clear();
            log('Reset click count and processed buttons');
        },
        stop: () => {
            clickCount = CONFIG.maxClicks;
            log('Stopped auto-clicking');
        },
        start: () => {
            clickCount = 0;
            processedButtons.clear();
            if (isPaused) {
                togglePause();
            }
            processViewMoreButtons();
            log('Restarted auto-clicking');
        },
        refreshEpisodeList: () => {
            updateEpisodeList();
            log('Episode list refreshed manually');
        },
        debugEpisodes: () => {
            const episodeCards = document.querySelectorAll('li[data-testid="episode-card"]');
            console.log(`[DEBUG] Found ${episodeCards.length} episode cards`);
            episodeCards.forEach((card, index) => {
                const episodeTag = card.querySelector('span[data-testid="textTag"] span');
                const titleElement = card.querySelector('h3');
                console.log(`Episode ${index}:`, {
                    episodeText: episodeTag ? episodeTag.textContent : 'NOT FOUND',
                    title: titleElement ? titleElement.textContent : 'NOT FOUND',
                    card: card
                });
            });
            return episodeCards;
        },
        toggleEpisodePanel: () => {
            if (episodePanel) {
                episodePanelVisible = !episodePanelVisible;
                episodePanel.style.display = episodePanelVisible ? 'flex' : 'none';
                log(`Episode panel ${episodePanelVisible ? 'shown' : 'hidden'}`);
            }
        },
        setMaxClicks: (num) => {
            CONFIG.maxClicks = num;
            log(`Set max clicks to ${num}`);
        },
        setBackgroundMode: (enabled) => {
            CONFIG.workInBackground = enabled;
            log(`Background mode ${enabled ? 'enabled' : 'disabled'}`);
        },
        enableDebug: () => {
            CONFIG.debug = true;
            log('Debug mode enabled');
        },
        disableDebug: () => {
            CONFIG.debug = false;
            console.log('[Hotstar Auto View More] Debug mode disabled');
        },
        getConfig: () => {
            return {...CONFIG};
        },
        processNow: () => {
            processViewMoreButtons();
        },
        // Debug helper: find all buttons on page
        findAllButtons: () => {
            const allButtons = document.querySelectorAll('button, a[role="button"], div[role="button"], span[role="button"]');
            console.log(`Found ${allButtons.length} total buttons on page:`);
            allButtons.forEach((btn, index) => {
                console.log(`Button ${index + 1}:`, {
                    tag: btn.tagName,
                    text: btn.textContent.trim().substring(0, 100),
                    class: btn.className,
                    'data-testid': btn.getAttribute('data-testid'),
                    'aria-label': btn.getAttribute('aria-label'),
                    element: btn
                });
            });
            return allButtons;
        },
        // Debug helper: search for text
        searchByText: (searchText) => {
            const allElements = document.querySelectorAll('*');
            const matches = [];
            allElements.forEach(el => {
                const text = (el.textContent || '').toLowerCase();
                if (text.includes(searchText.toLowerCase()) && el.children.length === 0) {
                    matches.push(el);
                    console.log('Found element:', {
                        tag: el.tagName,
                        text: el.textContent.trim(),
                        class: el.className,
                        parent: el.parentElement,
                        element: el
                    });
                }
            });
            console.log(`Found ${matches.length} elements containing "${searchText}"`);
            return matches;
        },
        // Episode search functions
        filterEpisodes: (searchTerm) => {
            filterEpisodesBySearch(searchTerm);
        },
        clearSearch: () => {
            const searchInput = document.getElementById('hotstar-episode-search');
            if (searchInput) {
                searchInput.value = '';
                filterEpisodesBySearch('');
                log('Search cleared');
            }
        },
        searchEpisode: (episodeNumber) => {
            const searchInput = document.getElementById('hotstar-episode-search');
            if (searchInput) {
                searchInput.value = episodeNumber.toString();
                filterEpisodesBySearch(episodeNumber.toString());
            }
        }
    };

    log('Use window.hotstarAutoViewMore to control the auto-clicker');
    log('Use window.hotstarAutoViewMore.findAllButtons() to see all buttons on page');
    log('Use window.hotstarAutoViewMore.searchByText("view more") to search for specific text');
    log('Use window.hotstarAutoViewMore.refreshEpisodeList() to manually refresh episode list');
    log('Use window.hotstarAutoViewMore.filterEpisodes(term) to search episodes by number');
    log('Use window.hotstarAutoViewMore.clearSearch() to clear the episode search');
    log('Episode navigation panel is on the right side - type to search, press Enter to navigate!');
})();
