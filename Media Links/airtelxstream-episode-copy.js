// Copy buttons for Airtel Xstream episode descriptions

(function() {
    'use strict';

    const CONFIG = {
        debug: true,
        copyDelay: 100,
        toastDuration: 2000,
        theme: 'light' // Will be updated from storage
    };

    // Configurable timing constants
    const TIMING = {
        initialLoadDelay: 500,
        retryInterval: 1000,
        maxRetries: 15,
        navigationDelay: 500
    };

    // Observer tracking
    const OBSERVERS = {
        mutation: null,
        theme: null
    };

    let historyWrapped = false;

    // Check if Chrome storage API is available
    function isChromeStorageAvailable() {
        try {
            return typeof chrome !== 'undefined' &&
                   typeof chrome.storage !== 'undefined' &&
                   typeof chrome.storage.sync !== 'undefined';
        } catch (error) {
            log('Chrome storage check error:', error);
            return false;
        }
    }

    // Theme colors mapping
    const THEME_COLORS = {
        light: {
            primary: '#6366f1',
            primaryHover: '#4f46e5',
            success: '#10b981',
            error: '#ef4444',
            textPrimary: '#333333',
            bg: '#ffffff'
        },
        dark: {
            primary: '#818cf8',
            primaryHover: '#a5b4fc',
            success: '#34d399',
            error: '#f87171',
            textPrimary: '#f3f4f6',
            bg: '#1f2937'
        },
        'catppuccin-mocha': {
            primary: '#89b4fa',
            primaryHover: '#a6e3a1',
            success: '#a6e3a1',
            error: '#f38ba8',
            textPrimary: '#cdd6f4',
            bg: '#1e1e2e'
        },
        cats: {
            primary: '#9d84b7',
            primaryHover: '#bca9d9',
            success: '#8eb3e6',
            error: '#d97171',
            textPrimary: '#e5d4ed',
            bg: '#2a2837'
        },
        'cat-night': {
            primary: '#be95c4',
            primaryHover: '#d4a5d4',
            success: '#7ed321',
            error: '#ff6b6b',
            textPrimary: '#e5d4ed',
            bg: '#1a1625'
        }
    };

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[Airtel Xstream Episode Copy]', ...args);
        }
    }

    // Get current theme - checks DOM first (most up-to-date), then config
    function getCurrentTheme() {
        // First priority: Check DOM attributes (most up-to-date source)
        const htmlElement = document.documentElement;
        const dataTheme = htmlElement.getAttribute('data-theme');
        const bodyTheme = document.body.getAttribute('data-theme');
        const classTheme = document.body.classList.toString();

        let theme = dataTheme || bodyTheme || null;

        // Try to extract theme from class names if not found in attributes
        if (!theme) {
            for (const themeKey of Object.keys(THEME_COLORS)) {
                if (classTheme.includes(themeKey)) {
                    theme = themeKey;
                    break;
                }
            }
        }

        // Finally, use CONFIG.theme if DOM detection found nothing
        theme = theme || CONFIG.theme || 'light';
        return THEME_COLORS[theme] || THEME_COLORS.light;
    }

    // Get CSS variable value with fallback
    function getCSSVariable(varName) {
        const root = getComputedStyle(document.documentElement);
        return root.getPropertyValue(varName).trim() || '';
    }

    // Get theme color (prefer CSS variables, fallback to theme map)
    function getThemeColor(colorType) {
        // Try to get from CSS variables first
        if (colorType === 'primary') {
            const cssColor = getCSSVariable('--accent') || getCSSVariable('--primary');
            if (cssColor) return cssColor;
        } else if (colorType === 'success') {
            const cssColor = getCSSVariable('--success');
            if (cssColor) return cssColor;
        } else if (colorType === 'error') {
            const cssColor = getCSSVariable('--danger') || getCSSVariable('--error');
            if (cssColor) return cssColor;
        }

        // Fallback to theme map
        const theme = getCurrentTheme();
        const color = theme[colorType] || THEME_COLORS.light[colorType];
        return color;
    }

    // Create and show a toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'airtelxstream-episode-copy-toast';
        toast.textContent = message;

        const successColor = getThemeColor('success');
        const errorColor = getThemeColor('error');
        const primaryColor = getThemeColor('primary');

        // Styling
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '999999',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            transition: 'opacity 0.3s ease',
            opacity: '1',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#ffffff'
        });

        if (type === 'success') {
            toast.style.backgroundColor = successColor;
        } else if (type === 'error') {
            toast.style.backgroundColor = errorColor;
        } else {
            toast.style.backgroundColor = primaryColor;
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, CONFIG.toastDuration);
    }

    // Create a copy button for an episode tile
    function createCopyButton(episodeTile, type = 'description') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'airtelxstream-episode-copy-btn';
        button.dataset.buttonType = type;

        // Store button type for later reference
        button.dataset.type = type;

        // Button styling - compact size, uses theme colors, positioned for overlay on tile
        Object.assign(button.style, {
            position: 'absolute',
            padding: '8px 14px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'all 0.3s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            zIndex: '100',
            outline: 'none',
            opacity: '0',
            pointerEvents: 'none'
        });

        if (type === 'title') {
            button.innerHTML = '<span>COPY TITLE</span>';
            button.title = 'Copy episode title';
            button.style.top = '10px';
            button.style.right = '140px';
        } else {
            button.innerHTML = '<span>COPY DESC</span>';
            button.title = 'Copy episode description';
            button.style.top = '10px';
            button.style.right = '10px';
        }

        // Apply current theme colors
        applyThemeToButton(button);

        // Hover effects - use a function reference so we can update it later
        button.addEventListener('mouseenter', function() {
            const primaryColor = getThemeColor('primary');
            button.style.backgroundColor = primaryColor;
            button.style.color = '#ffffff';
            button.style.transform = 'scale(1.08)';
        });

        button.addEventListener('mouseleave', function() {
            const primaryColor = getThemeColor('primary');
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            button.style.color = primaryColor;
            button.style.transform = 'scale(1)';
        });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (type === 'title') {
                copyEpisodeTitle(episodeTile, button);
            } else {
                copyEpisodeDescription(episodeTile, button);
            }
        });

        return button;
    }

    // Apply theme colors to a button
    function applyThemeToButton(button) {
        const primaryColor = getThemeColor('primary');
        button.style.border = `2px solid ${primaryColor}`;
        button.style.color = primaryColor;
        button.style.boxShadow = `0 2px 8px ${primaryColor}4d`;
    }

    // Update button colors when theme changes
    function updateButtonColorsForTheme() {
        const buttons = document.querySelectorAll('.airtelxstream-episode-copy-btn');

        buttons.forEach(button => {
            // Apply theme colors using the helper function
            applyThemeToButton(button);

            // Reset button to default state
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
            button.style.transform = 'scale(1)';

            // Update button text color to match new theme
            const primaryColor = getThemeColor('primary');
            button.style.color = primaryColor;
        });

        log('Updated button colors for theme');
    }

    // Extract and copy episode title
    function copyEpisodeTitle(episodeTile, button) {
        try {
            // Find title in the tile - look for .name class which contains episode name
            const nameElement = episodeTile.querySelector('.name-time-area .name');
            const title = nameElement ? nameElement.textContent.trim() : '';

            // Get current theme colors
            const primaryColor = getThemeColor('primary');
            const successColor = getThemeColor('success');

            if (!title) {
                showToast('No title found', 'error');
                log('No title found for episode');
                return;
            }

            // Extract just the episode name (remove "Free" tag if present)
            const cleanTitle = title.replace(/Free/g, '').trim();

            // Check if clipboard API is available
            if (!navigator.clipboard) {
                showToast('Clipboard not available in this context (HTTPS required)', 'error');
                log('Clipboard API not available');
                return;
            }

            // Copy to clipboard
            navigator.clipboard.writeText(cleanTitle).then(() => {
                log('Copied title:', cleanTitle);
                showToast(`Copied: ${cleanTitle}`, 'success');

                // Visual feedback
                const originalHTML = button.innerHTML;
                button.innerHTML = '<span>✓</span>';
                button.style.borderColor = successColor;
                button.style.backgroundColor = successColor;
                button.style.color = '#ffffff';

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.borderColor = primaryColor;
                    button.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                    button.style.color = primaryColor;
                }, 1500);
            }).catch((error) => {
                log('Error copying to clipboard:', error);
                showToast('Failed to copy: ' + (error.message || 'Unknown error'), 'error');
            });
        } catch (error) {
            log('Error in copyEpisodeTitle:', error);
            showToast('Error copying title', 'error');
        }
    }

    // Extract and copy episode description
    function copyEpisodeDescription(episodeTile, button) {
        try {
            // Find title for logging
            const nameElement = episodeTile.querySelector('.name-time-area .name');
            const title = nameElement ? nameElement.textContent.trim() : 'Unknown Episode';

            // Get current theme colors
            const primaryColor = getThemeColor('primary');
            const successColor = getThemeColor('success');

            // Find episode description - look for p tag in tile-details > progress-area
            const descElement = episodeTile.querySelector('.tile-details .progress-area p');
            const description = descElement ? descElement.textContent.trim() : '';

            if (!description) {
                showToast('No description found', 'error');
                log('No description found for episode:', title);
                return;
            }

            // Check if clipboard API is available
            if (!navigator.clipboard) {
                showToast('Clipboard not available in this context (HTTPS required)', 'error');
                log('Clipboard API not available');
                return;
            }

            // Copy the description
            navigator.clipboard.writeText(description).then(() => {
                log('Copied description for:', title);
                showToast('Description copied', 'success');

                // Visual feedback
                const originalHTML = button.innerHTML;
                button.innerHTML = '<span>✓</span>';
                button.style.borderColor = successColor;
                button.style.backgroundColor = successColor;
                button.style.color = '#ffffff';

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.borderColor = primaryColor;
                    button.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                    button.style.color = primaryColor;
                }, 1500);
            }).catch((error) => {
                log('Error copying to clipboard:', error);
                showToast('Failed to copy: ' + (error.message || 'Unknown error'), 'error');
            });
        } catch (error) {
            log('Error in copyEpisodeDescription:', error);
            showToast('Error copying description', 'error');
        }
    }

    // Add hover effects to episode tiles with copy buttons
    function addCopyButtonsToTiles() {
        const episodeTiles = document.querySelectorAll('.cdp-tile');
        log(`Found ${episodeTiles.length} episode tile(s)`);

        let successCount = 0;
        let failureCount = 0;

        episodeTiles.forEach((tile, index) => {
            // Check if copy buttons already exist in the tile
            if (tile.querySelector('.airtelxstream-episode-copy-wrapper')) {
                return; // Already has copy buttons
            }

            try {
                // Make tile position relative for absolute positioning of buttons
                if (tile.style.position !== 'relative' && tile.style.position !== 'absolute' && tile.style.position !== 'fixed') {
                    tile.style.position = 'relative';
                }

                // Create wrapper for the copy buttons
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'airtelxstream-episode-copy-wrapper';

                Object.assign(buttonWrapper.style, {
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    bottom: '0',
                    left: '0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    padding: '8px',
                    pointerEvents: 'none',
                    zIndex: '50'
                });

                // Create title copy button
                const titleButton = createCopyButton(tile, 'title');
                buttonWrapper.appendChild(titleButton);

                // Create description copy button
                const descButton = createCopyButton(tile, 'description');
                buttonWrapper.appendChild(descButton);

                // Add hover effects to show/hide buttons
                tile.addEventListener('mouseenter', () => {
                    titleButton.style.opacity = '1';
                    titleButton.style.pointerEvents = 'auto';
                    descButton.style.opacity = '1';
                    descButton.style.pointerEvents = 'auto';
                });

                tile.addEventListener('mouseleave', () => {
                    titleButton.style.opacity = '0';
                    titleButton.style.pointerEvents = 'none';
                    descButton.style.opacity = '0';
                    descButton.style.pointerEvents = 'none';
                });

                // Insert the button wrapper into the tile
                tile.appendChild(buttonWrapper);
                successCount++;
                log(`Tile ${index + 1}: Added copy buttons`);

            } catch (error) {
                log(`Error adding buttons to tile ${index + 1}:`, error);
                failureCount++;
            }
        });

        if (successCount > 0) {
            log(`Successfully added buttons to ${successCount} tile(s)`);
        }
        if (failureCount > 0) {
            log(`Failed to add buttons to ${failureCount} tile(s)`);
        }
    }

    // Set up MutationObserver to watch for new episodes (when scrolling loads more or navigating)
    function setupObserver() {
        // Disconnect any existing observer first
        if (OBSERVERS.mutation) {
            OBSERVERS.mutation.disconnect();
        }

        let debounceTimeout = null;

        const observer = new MutationObserver((mutations) => {
            let hasNewTiles = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const hasTiles = addedNodes.some(node => {
                        return node.nodeType === 1 && (
                            node.matches('.cdp-tile') ||
                            node.querySelector('.cdp-tile')
                        );
                    });

                    if (hasTiles) {
                        hasNewTiles = true;
                    }
                }
            });

            if (hasNewTiles) {
                // Debounce: wait a bit before adding buttons to new tiles
                clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    log('New tiles detected, adding copy buttons');
                    addCopyButtonsToTiles();
                }, TIMING.navigationDelay);
            }
        });

        // Observe the entire body to catch all DOM changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        OBSERVERS.mutation = observer;
        log('MutationObserver set up for entire document body');

        return observer;
    }

    // Set up theme change listener via MutationObserver
    function setupThemeListener() {
        // Disconnect any existing observer first
        if (OBSERVERS.theme) {
            OBSERVERS.theme.disconnect();
        }

        const htmlElement = document.documentElement;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    log('Theme changed, updating button colors');
                    updateButtonColorsForTheme();
                }
            });
        });

        observer.observe(htmlElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        // Also listen to body element
        if (document.body) {
            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }

        OBSERVERS.theme = observer;
        log('Theme listener set up');
    }

    // Load theme from storage - returns a promise
    function loadThemeFromStorage() {
        return new Promise((resolve) => {
            if (!isChromeStorageAvailable()) {
                log('Chrome storage not available, using default theme');
                CONFIG.theme = 'light';
                resolve(CONFIG.theme);
                return;
            }

            try {
                chrome.storage.sync.get(['theme'], (result) => {
                    if (chrome.runtime.lastError) {
                        log('Storage error:', chrome.runtime.lastError);
                        CONFIG.theme = 'light';
                    } else if (result && result.theme) {
                        CONFIG.theme = result.theme;
                        log('✓ Loaded theme from storage:', CONFIG.theme);
                    } else {
                        log('⚠ No theme in storage, using default: light');
                        CONFIG.theme = 'light';
                    }
                    log('CONFIG.theme is now:', CONFIG.theme);
                    resolve(CONFIG.theme);
                });
            } catch (error) {
                log('✗ Could not access chrome storage:', error);
                CONFIG.theme = 'light';
                resolve(CONFIG.theme);
            }
        });
    }

    // Listen for storage changes (when settings are updated)
    function setupStorageListener() {
        try {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'sync' && changes.theme) {
                    CONFIG.theme = changes.theme.newValue;
                    log('Theme changed via storage listener:', CONFIG.theme);
                    updateButtonColorsForTheme();
                }
            });
            log('Storage listener set up');
        } catch (error) {
            log('Could not set up storage listener:', error);
        }
    }

    // Listen for runtime messages about theme changes
    function setupRuntimeMessageListener() {
        try {
            chrome.runtime.onMessage.addListener((message) => {
                if (message.type === 'themeChanged') {
                    CONFIG.theme = message.theme;
                    log('Received theme change message:', CONFIG.theme);
                    updateButtonColorsForTheme();
                }
            });
        } catch (error) {
            log('Chrome runtime not available (this is normal for content scripts)');
        }
    }

    // Retry adding buttons at intervals if they weren't found
    function startRetryMechanism() {
        let retryCount = 0;
        const maxRetries = TIMING.maxRetries;
        const retryInterval = TIMING.retryInterval;

        const retryTimer = setInterval(() => {
            retryCount++;
            const currentTiles = document.querySelectorAll('.cdp-tile');
            const tilesWithButtons = document.querySelectorAll('.airtelxstream-episode-copy-wrapper');

            log(`Retry ${retryCount}/${maxRetries}: Found ${currentTiles.length} tiles, ${tilesWithButtons.length} have buttons`);

            // Only add buttons if there are tiles without buttons
            if (currentTiles.length > tilesWithButtons.length) {
                log(`Adding missing buttons (${currentTiles.length - tilesWithButtons.length} tiles)`);
                addCopyButtonsToTiles();
            }

            // Stop retrying if:
            // 1. All tiles have buttons, OR
            // 2. Max retries reached, OR
            // 3. No tiles found and we've waited long enough
            const allButtonsAdded = currentTiles.length > 0 && currentTiles.length === tilesWithButtons.length;
            const maxRetriesReached = retryCount >= maxRetries;
            const noTilesAndWaitedLong = currentTiles.length === 0 && retryCount >= 5;

            if (allButtonsAdded || maxRetriesReached || noTilesAndWaitedLong) {
                clearInterval(retryTimer);
                if (currentTiles.length > 0) {
                    log(`Retry mechanism complete. All ${currentTiles.length} tile(s) have copy buttons.`);
                } else {
                    log('No tiles found, stopping retry mechanism');
                }
            }
        }, retryInterval);
    }

    // Listen for navigation changes (single-page app navigation)
    function setupNavigationListener() {
        // Listen for history changes (when clicking on different shows)
        window.addEventListener('popstate', () => {
            log('Navigation detected via popstate, refreshing buttons');
            setTimeout(() => {
                addCopyButtonsToTiles();
            }, TIMING.navigationDelay);
        });

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            log('Navigation detected via hashchange, refreshing buttons');
            setTimeout(() => {
                addCopyButtonsToTiles();
            }, TIMING.navigationDelay);
        });

        // Intercept History API calls - only do this once
        if (historyWrapped) {
            log('History API already wrapped, skipping');
            return;
        }

        // Save original methods to window object
        if (!window.airtelxstreamOriginalMethods) {
            window.airtelxstreamOriginalMethods = {
                pushState: history.pushState,
                replaceState: history.replaceState
            };
        }

        history.pushState = function(...args) {
            window.airtelxstreamOriginalMethods.pushState.apply(history, args);
            log('Navigation detected via pushState, refreshing buttons');
            setTimeout(() => {
                addCopyButtonsToTiles();
            }, TIMING.navigationDelay);
        };

        history.replaceState = function(...args) {
            window.airtelxstreamOriginalMethods.replaceState.apply(history, args);
            log('Navigation detected via replaceState, refreshing buttons');
            setTimeout(() => {
                addCopyButtonsToTiles();
            }, TIMING.navigationDelay);
        };

        historyWrapped = true;
        log('Navigation listener set up');
    }

    // Cleanup function for when script needs to be disabled
    function cleanupNavigationListener() {
        if (historyWrapped && window.airtelxstreamOriginalMethods) {
            history.pushState = window.airtelxstreamOriginalMethods.pushState;
            history.replaceState = window.airtelxstreamOriginalMethods.replaceState;
            historyWrapped = false;
            log('Navigation listeners cleaned up');
        }
    }

    // Cleanup all observers
    function cleanupObservers() {
        if (OBSERVERS.mutation) {
            OBSERVERS.mutation.disconnect();
            OBSERVERS.mutation = null;
            log('Mutation observer disconnected');
        }
        if (OBSERVERS.theme) {
            OBSERVERS.theme.disconnect();
            OBSERVERS.theme = null;
            log('Theme observer disconnected');
        }
    }

    // Initialize
    async function init() {
        log('Initializing Airtel Xstream episode copy feature');

        // Load theme from storage first (highest priority) - WAIT for this to complete
        await loadThemeFromStorage();

        // Log theme detection at startup
        const detectedTheme = getCurrentTheme();
        log('Theme detected at startup:', detectedTheme);
        log('CONFIG.theme is set to:', CONFIG.theme);

        // Set up all theme listeners
        setupThemeListener();
        setupStorageListener();
        setupRuntimeMessageListener();

        // Set up navigation listeners for single-page app
        setupNavigationListener();

        // Wait a bit for the page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    log('Creating buttons with theme:', CONFIG.theme);
                    addCopyButtonsToTiles();
                    setupObserver();
                    startRetryMechanism();

                    // Update any existing buttons with correct theme (in case they were created before theme loaded)
                    setTimeout(() => {
                        log('Updating existing buttons to use theme:', CONFIG.theme);
                        updateButtonColorsForTheme();
                    }, TIMING.initialLoadDelay * 2);
                }, TIMING.initialLoadDelay);
            });
        } else {
            setTimeout(() => {
                log('Creating buttons with theme:', CONFIG.theme);
                addCopyButtonsToTiles();
                setupObserver();
                startRetryMechanism();

                // Update any existing buttons with correct theme (in case they were created before theme loaded)
                setTimeout(() => {
                    log('Updating existing buttons to use theme:', CONFIG.theme);
                    updateButtonColorsForTheme();
                }, TIMING.initialLoadDelay * 2);
            }, TIMING.initialLoadDelay);
        }
    }

    // Start
    init();

    // Expose control to window for debugging
    window.airtelxstreamEpisodeCopy = {
        refreshButtons: addCopyButtonsToTiles,
        updateThemeColors: updateButtonColorsForTheme,
        getCurrentTheme: getCurrentTheme,
        enableDebug: () => { CONFIG.debug = true; log('Debug enabled'); },
        disableDebug: () => { CONFIG.debug = false; },
        cleanup: () => {
            cleanupNavigationListener();
            cleanupObservers();
            log('All listeners cleaned up');
        }
    };

    log('Episode copy feature initialized');
})();
