// Auto-click "View More" buttons on Hotstar

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        // Note: buttonSelectors is no longer used directly. Button finding is done via proper methods below.
        // Delay before clicking (in milliseconds)
        clickDelay: 100,
        // Interval to check for new buttons (in milliseconds)
        checkInterval: 2000,
        // Maximum number of clicks per session
        maxClicks: 100,
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
    // This prevents memory leaks and handles DOM reloads
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
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        isProcessing = false;
    }

    // Set up MutationObserver to watch for new content
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            // Debounce: only process after mutations stop for a bit
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // Process even in background if configured
                if (CONFIG.workInBackground || document.visibilityState === 'visible') {
                    processViewMoreButtons();
                }
            }, 500);
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

    // Get current theme colors
    function getThemeColors() {
        const root = getComputedStyle(document.documentElement);
        return {
            primaryBg: root.getPropertyValue('--primary-bg') || '#ffffff',
            secondaryBg: root.getPropertyValue('--secondary-bg') || '#f5f5f5',
            textPrimary: root.getPropertyValue('--text-primary') || '#333333',
            accent: root.getPropertyValue('--accent') || '#6366f1',
            accentHover: root.getPropertyValue('--accent-hover') || '#4f46e5',
            success: root.getPropertyValue('--success') || '#10b981',
            danger: root.getPropertyValue('--danger') || '#ef4444',
            border: root.getPropertyValue('--border') || '#e5e7eb'
        };
    }

    // Create pause/resume control button
    function createControlButton() {
        if (controlButton) return;

        const button = document.createElement('button');
        button.id = 'hotstar-auto-viewmore-control';
        button.title = 'Toggle Auto View More';

        // Styling for the button - uses theme colors
        Object.assign(button.style, {
            position: 'fixed',
            top: '80px',
            right: '20px',
            zIndex: '999999',
            minWidth: '60px',
            height: '36px',
            padding: '8px 16px',
            borderRadius: '18px',
            border: '2px solid',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        });

        updateButtonState(button);

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });

        button.addEventListener('click', () => {
            togglePause();
        });

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
                    log('Button updated for theme attribute change');
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

        // Create control button
        if (document.body) {
            createControlButton();
        } else {
            document.addEventListener('DOMContentLoaded', createControlButton);
        }

        // Initial check after page load
        setTimeout(() => {
            processViewMoreButtons();
        }, 2000);

        // Set up periodic checks (works in background too)
        setInterval(() => {
            if (clickCount < CONFIG.maxClicks) {
                // Process regardless of visibility state if workInBackground is true
                if (CONFIG.workInBackground || document.visibilityState === 'visible') {
                    processViewMoreButtons();
                }
            } else {
                log('Reached max clicks limit. Use window.hotstarAutoViewMore.start() to restart.');
            }
        }, CONFIG.checkInterval);

        // Set up observer for dynamic content
        if (document.body) {
            setupObserver();
        } else {
            document.addEventListener('DOMContentLoaded', setupObserver);
        }

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        log('Auto-clicker initialized and will work in background tabs');
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
        }
    };

    log('Use window.hotstarAutoViewMore to control the auto-clicker');
    log('Use window.hotstarAutoViewMore.findAllButtons() to see all buttons on page');
    log('Use window.hotstarAutoViewMore.searchByText("view more") to search for specific text');
})();
