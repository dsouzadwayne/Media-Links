// Copy buttons for Hotstar episode descriptions

(function() {
    'use strict';

    const CONFIG = {
        debug: true,
        copyDelay: 100,
        toastDuration: 2000
    };

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
            console.log('[Hotstar Episode Copy]', ...args);
        }
    }

    // Get current theme
    function getCurrentTheme() {
        const htmlElement = document.documentElement;
        const dataTheme = htmlElement.getAttribute('data-theme');
        const bodyTheme = document.body.getAttribute('data-theme');
        const theme = dataTheme || bodyTheme || 'light';
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
        return theme[colorType] || THEME_COLORS.light[colorType];
    }

    // Create and show a toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'hotstar-episode-copy-toast';
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

    // Create a copy button for an episode card
    function createCopyButton(episodeCard, type = 'description') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hotstar-episode-copy-btn';
        button.dataset.buttonType = type;

        // Get theme colors
        const primaryColor = getThemeColor('primary');
        const successColor = getThemeColor('success');

        // Button styling - compact size, uses theme colors
        // Important: setting zIndex and position to ensure visibility
        Object.assign(button.style, {
            position: 'relative',
            padding: '6px 12px',
            border: `1px solid ${primaryColor}`,
            borderRadius: '16px',
            backgroundColor: 'transparent',
            color: primaryColor,
            cursor: 'pointer',
            fontSize: '11px',
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
            zIndex: '10',
            outline: 'none'
        });

        if (type === 'title') {
            button.innerHTML = '<span>T</span>';
            button.title = 'Copy episode title';
        } else {
            button.innerHTML = '<span>D</span>';
            button.title = 'Copy episode description';
        }

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = primaryColor;
            button.style.color = '#ffffff';
            button.style.transform = 'scale(1.08)';
            button.style.boxShadow = `0 2px 6px ${primaryColor}4d`;
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'transparent';
            button.style.color = primaryColor;
            button.style.transform = 'scale(1)';
            button.style.boxShadow = 'none';
        });

        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (type === 'title') {
                copyEpisodeTitle(episodeCard, button, successColor);
            } else {
                copyEpisodeDescription(episodeCard, button, successColor);
            }
        });

        return button;
    }

    // Update button colors when theme changes
    function updateButtonColorsForTheme() {
        const primaryColor = getThemeColor('primary');
        const successColor = getThemeColor('success');
        const buttons = document.querySelectorAll('.hotstar-episode-copy-btn');

        buttons.forEach(button => {
            button.style.borderColor = primaryColor;
            button.style.color = primaryColor;

            // Update hover state colors
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = primaryColor;
                button.style.boxShadow = `0 2px 6px ${primaryColor}4d`;
            });
        });

        log('Updated button colors for theme');
    }

    // Extract and copy episode title
    function copyEpisodeTitle(episodeCard, button, successColor) {
        try {
            const titleElement = episodeCard.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : '';
            const primaryColor = getThemeColor('primary');

            if (!title) {
                showToast('No title found', 'error');
                log('No title found for episode');
                return;
            }

            // Copy to clipboard
            navigator.clipboard.writeText(title).then(() => {
                log('Copied title:', title);
                showToast(`Copied: ${title}`, 'success');

                // Visual feedback
                const originalHTML = button.innerHTML;
                button.innerHTML = '<span>✓</span>';
                button.style.borderColor = successColor;
                button.style.color = successColor;

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.borderColor = primaryColor;
                    button.style.color = primaryColor;
                }, 1500);
            }).catch((error) => {
                log('Error copying to clipboard:', error);
                showToast('Failed to copy', 'error');
            });
        } catch (error) {
            log('Error in copyEpisodeTitle:', error);
            showToast('Error copying title', 'error');
        }
    }

    // Extract and copy episode description
    function copyEpisodeDescription(episodeCard, button, successColor) {
        try {
            // Find episode title (for logging and toast message only)
            const titleElement = episodeCard.querySelector('h3');
            const title = titleElement ? titleElement.textContent.trim() : 'Unknown Episode';
            const primaryColor = getThemeColor('primary');

            // Find episode description (look for p tag with BODY3_REGULAR class)
            const descElement = episodeCard.querySelector('p.BODY3_REGULAR');
            const description = descElement ? descElement.textContent.trim() : '';

            if (!description) {
                showToast('No description found', 'error');
                log('No description found for episode:', title);
                return;
            }

            // Copy ONLY the description text (not the title)
            const textToCopy = description;

            // Copy to clipboard
            navigator.clipboard.writeText(textToCopy).then(() => {
                log('Copied description for:', title);
                showToast('Description copied', 'success');

                // Visual feedback
                const originalHTML = button.innerHTML;
                button.innerHTML = '<span>✓</span>';
                button.style.borderColor = successColor;
                button.style.color = successColor;

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.borderColor = primaryColor;
                    button.style.color = primaryColor;
                }, 1500);
            }).catch((error) => {
                log('Error copying to clipboard:', error);
                showToast('Failed to copy', 'error');
            });
        } catch (error) {
            log('Error in copyEpisodeDescription:', error);
            showToast('Error copying description', 'error');
        }
    }

    // Add copy buttons beside episode cards
    function addCopyButtons() {
        const episodeCards = document.querySelectorAll('li[data-testid="episode-card"]');
        log(`Found ${episodeCards.length} episode card(s)`);

        let successCount = 0;
        let failureCount = 0;

        episodeCards.forEach((card, index) => {
            // Check if copy buttons already exist in the card
            if (card.querySelector('.hotstar-episode-copy-wrapper')) {
                return; // Already has copy buttons
            }

            try {
                // Find the description element - primary method
                let descElement = card.querySelector('p.BODY3_REGULAR');

                // Fallback: look for any p tag with class containing "BODY"
                if (!descElement) {
                    descElement = card.querySelector('p[class*="BODY"]');
                }

                // Last fallback: just find the last p tag
                if (!descElement) {
                    const allP = card.querySelectorAll('p');
                    if (allP.length > 0) {
                        descElement = allP[allP.length - 1];
                    }
                }

                if (!descElement) {
                    log(`Episode ${index + 1}: No description element found`);
                    failureCount++;
                    return;
                }

                // Create wrapper for the copy buttons
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'hotstar-episode-copy-wrapper';

                Object.assign(buttonWrapper.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    flexWrap: 'wrap',
                    padding: '4px 0',
                    zIndex: '10'
                });

                // Create title copy button
                const titleButton = createCopyButton(card, 'title');
                buttonWrapper.appendChild(titleButton);

                // Create description copy button
                const descButton = createCopyButton(card, 'description');
                buttonWrapper.appendChild(descButton);

                // Insert buttons right after the description element
                // This is the most reliable approach that works with all DOM variations
                descElement.insertAdjacentElement('afterend', buttonWrapper);
                successCount++;
                log(`Episode ${index + 1}: Added copy buttons after description`);

            } catch (error) {
                log(`Error adding buttons to episode ${index + 1}:`, error);
                failureCount++;
            }
        });

        if (successCount > 0) {
            log(`Successfully added buttons to ${successCount} episode(s)`);
        }
        if (failureCount > 0) {
            log(`Failed to add buttons to ${failureCount} episode(s)`);
        }
    }

    // Set up MutationObserver to watch for new episodes (when scrolling loads more)
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let hasNewCards = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const hasEpisodeCards = addedNodes.some(node => {
                        return node.nodeType === 1 && (
                            node.matches('li[data-testid="episode-card"]') ||
                            node.querySelector('li[data-testid="episode-card"]')
                        );
                    });

                    if (hasEpisodeCards) {
                        hasNewCards = true;
                    }
                }
            });

            if (hasNewCards) {
                // Debounce: wait a bit before adding buttons to new cards
                clearTimeout(observer.timeout);
                observer.timeout = setTimeout(() => {
                    addCopyButtons();
                }, 500);
            }
        });

        // Find the episode list container using robust selectors
        // Method 1: Find the ul that contains episode cards (most reliable)
        let episodeList = null;
        const allUls = document.querySelectorAll('ul');
        episodeList = Array.from(allUls).find(ul => {
            return ul.querySelector('li[data-testid="episode-card"]');
        });

        // Method 2: If no ul with episode cards found, observe the body to catch dynamic content
        // This is more robust than relying on specific class names that may change
        const observeTarget = episodeList || document.body;

        if (observeTarget) {
            observer.observe(observeTarget, {
                childList: true,
                subtree: true
            });
            if (episodeList) {
                log('MutationObserver set up for episode list container');
            } else {
                log('MutationObserver set up for document body (episode list not found yet)');
            }
        } else {
            log('Could not set up MutationObserver');
        }
    }

    // Set up theme change listener via MutationObserver
    function setupThemeListener() {
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

        log('Theme listener set up');
    }

    // Listen for runtime messages about theme changes
    function setupRuntimeMessageListener() {
        try {
            chrome.runtime.onMessage.addListener((message) => {
                if (message.type === 'themeChanged') {
                    log('Received theme change message:', message.theme);
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
        const maxRetries = 5;
        const retryInterval = 1000; // 1 second

        const retryTimer = setInterval(() => {
            retryCount++;
            const currentCards = document.querySelectorAll('li[data-testid="episode-card"]');
            const cardsWithButtons = document.querySelectorAll('.hotstar-episode-copy-wrapper');

            if (currentCards.length > cardsWithButtons.length) {
                log(`Retry ${retryCount}: Found ${currentCards.length} cards but only ${cardsWithButtons.length} have buttons. Adding missing buttons...`);
                addCopyButtons();
            }

            if (retryCount >= maxRetries || currentCards.length === cardsWithButtons.length) {
                clearInterval(retryTimer);
                if (currentCards.length > 0) {
                    log(`Retry mechanism complete. All ${currentCards.length} episode(s) have copy buttons.`);
                }
            }
        }, retryInterval);
    }

    // Initialize
    function init() {
        log('Initializing episode description copy feature');

        // Set up theme listeners
        setupThemeListener();
        setupRuntimeMessageListener();

        // Wait a bit for the page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    addCopyButtons();
                    setupObserver();
                    startRetryMechanism();
                }, 500);
            });
        } else {
            setTimeout(() => {
                addCopyButtons();
                setupObserver();
                startRetryMechanism();
            }, 500);
        }
    }

    // Start
    init();

    // Expose control to window for debugging
    window.hotstarEpisodeCopy = {
        refreshButtons: addCopyButtons,
        updateThemeColors: updateButtonColorsForTheme,
        getCurrentTheme: getCurrentTheme,
        enableDebug: () => { CONFIG.debug = true; log('Debug enabled'); },
        disableDebug: () => { CONFIG.debug = false; }
    };

    log('Episode copy feature initialized');
})();
