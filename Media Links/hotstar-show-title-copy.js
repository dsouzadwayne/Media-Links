// Copy buttons for Hotstar show title and description

(function() {
    'use strict';

    const CONFIG = {
        debug: true,
        toastDuration: 2000
    };

    // Theme colors mapping
    const THEME_COLORS = {
        light: {
            primary: '#6366f1',
            success: '#10b981',
            error: '#ef4444',
            textPrimary: '#333333'
        },
        dark: {
            primary: '#818cf8',
            success: '#34d399',
            error: '#f87171',
            textPrimary: '#f3f4f6'
        },
        'catppuccin-mocha': {
            primary: '#89b4fa',
            success: '#a6e3a1',
            error: '#f38ba8',
            textPrimary: '#cdd6f4'
        },
        cats: {
            primary: '#9d84b7',
            success: '#8eb3e6',
            error: '#d97171',
            textPrimary: '#e5d4ed'
        },
        'cat-night': {
            primary: '#be95c4',
            success: '#7ed321',
            error: '#ff6b6b',
            textPrimary: '#e5d4ed'
        }
    };

    function log(...args) {
        if (CONFIG.debug) {
            console.log('[Hotstar Show Copy]', ...args);
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

        const theme = getCurrentTheme();
        return theme[colorType] || THEME_COLORS.light[colorType];
    }

    // Create and show a toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'hotstar-show-copy-toast';
        toast.textContent = message;

        const successColor = getThemeColor('success');
        const errorColor = getThemeColor('error');
        const primaryColor = getThemeColor('primary');

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

    // Create a copy button with a specific type (title or description)
    function createCopyButton(type = 'title') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `hotstar-show-copy-btn hotstar-show-copy-btn-${type}`;
        button.dataset.copyType = type;

        const primaryColor = getThemeColor('primary');
        const label = type === 'title' ? 'T' : 'D';
        const title = type === 'title' ? 'Copy show title' : 'Copy show description';

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
            marginLeft: '4px'
        });

        button.innerHTML = `<span>${label}</span>`;
        button.title = title;

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
                copyShowTitle(button);
            } else {
                copyShowDescription(button);
            }
        });

        return button;
    }

    // Extract show title with multiple fallbacks
    function extractShowTitle() {
        // Try h2 element first (primary location)
        const titleElement = document.querySelector('h2');
        if (titleElement) {
            // Method 1: Get text node directly
            const textNode = Array.from(titleElement.childNodes).find(
                node => node.nodeType === 3 && node.textContent.trim()
            );
            if (textNode) {
                return textNode.textContent.trim();
            }

            // Method 2: Try img alt attribute
            const img = titleElement.querySelector('img');
            if (img && img.alt) {
                return img.alt.trim();
            }
        }

        // Fallback selectors
        const fallbackSelectors = [
            '[data-testid="titleHeading"]',
            '.show-title',
            '[aria-label*="show"]',
            'h1'
        ];

        for (const selector of fallbackSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.textContent.trim();
                if (text && text.length > 0) {
                    return text;
                }
            }
        }

        return '';
    }

    // Extract show description with multiple fallbacks and cleaning
    function extractShowDescription() {
        let description = '';

        // Method 1: Look for p tag with BODY3_REGULAR class (Hotstar standard)
        let descElement = document.querySelector('p.BODY3_REGULAR');

        // Method 2: If not found, look for description in common locations
        if (!descElement) {
            // Search for paragraphs that are longer (likely the description)
            const paragraphs = Array.from(document.querySelectorAll('p')).filter(p => {
                const text = p.textContent.trim();
                return text.length > 50; // Description should be reasonably long
            });

            if (paragraphs.length > 0) {
                // Prefer the first substantial paragraph
                descElement = paragraphs[0];
            }
        }

        // Method 3: Look for description in data attributes or aria-labels
        if (!descElement) {
            const descAttr = document.querySelector('[data-testid*="description"]');
            if (descAttr) {
                descElement = descAttr;
            }
        }

        if (descElement) {
            description = descElement.textContent.trim();
        }

        // Clean up the description
        if (description) {
            // Remove extra whitespace and newlines
            description = description.replace(/\s+/g, ' ').trim();

            // Remove common HTML artifacts
            description = description.replace(/[\u200B-\u200D\uFEFF]/g, '');

            // Ensure it doesn't contain unwanted characters
            if (description.length > 0) {
                return description;
            }
        }

        return '';
    }

    // Copy show title to clipboard
    function copyShowTitle(button) {
        try {
            const title = extractShowTitle();

            if (!title) {
                showToast('No title found', 'error');
                log('No show title found on page');
                return;
            }

            const primaryColor = getThemeColor('primary');
            const successColor = getThemeColor('success');

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
            log('Error in copyShowTitle:', error);
            showToast('Error copying title', 'error');
        }
    }

    // Copy show description to clipboard
    function copyShowDescription(button) {
        try {
            const description = extractShowDescription();

            if (!description) {
                showToast('No description found', 'error');
                log('No show description found on page');
                return;
            }

            const primaryColor = getThemeColor('primary');
            const successColor = getThemeColor('success');

            navigator.clipboard.writeText(description).then(() => {
                log('Copied description:', description.substring(0, 100));
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
            log('Error in copyShowDescription:', error);
            showToast('Error copying description', 'error');
        }
    }

    // Add copy buttons to show details
    function addCopyButtons() {
        const titleElement = document.querySelector('h2');

        if (!titleElement) {
            log('Show title element not found');
            return;
        }

        // Check if buttons wrapper already exists (prevents duplicates)
        if (titleElement.querySelector('.hotstar-show-copy-buttons-wrapper')) {
            log('Copy buttons already exist');
            return;
        }

        // Create a wrapper for the buttons
        const wrapper = document.createElement('div');
        wrapper.className = 'hotstar-show-copy-buttons-wrapper';
        Object.assign(wrapper.style, {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0px',
            marginLeft: '8px'
        });

        // Add title copy button
        const titleButton = createCopyButton('title');
        wrapper.appendChild(titleButton);

        // Add description copy button
        const descButton = createCopyButton('description');
        wrapper.appendChild(descButton);

        // Append wrapper to title element
        titleElement.appendChild(wrapper);
        log('Added copy buttons for title and description');
    }

    // Update button colors when theme changes
    function updateButtonColorsForTheme() {
        const primaryColor = getThemeColor('primary');
        const buttons = document.querySelectorAll('.hotstar-show-copy-btn');

        buttons.forEach(button => {
            button.style.borderColor = primaryColor;
            button.style.color = primaryColor;
        });

        log('Updated button colors for theme');
    }

    // Set up theme change listener
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

    // Initialize
    function init() {
        log('Initializing show copy feature (title + description)');

        setupThemeListener();
        setupRuntimeMessageListener();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    addCopyButtons();
                }, 500);
            });
        } else {
            setTimeout(() => {
                addCopyButtons();
            }, 500);
        }
    }

    init();

    // Expose control to window for debugging
    window.hotstarShowCopy = {
        refreshButtons: addCopyButtons,
        updateThemeColors: updateButtonColorsForTheme,
        getCurrentTheme: getCurrentTheme,
        extractTitle: extractShowTitle,
        extractDescription: extractShowDescription,
        enableDebug: () => { CONFIG.debug = true; log('Debug enabled'); },
        disableDebug: () => { CONFIG.debug = false; }
    };

    log('Show copy feature initialized');
})();
