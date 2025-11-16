// Airtel Xstream Cast Copy Functionality
// Adds click-to-copy functionality for cast names and a copy button for formatted cast list

(function() {
    'use strict';

    const CONFIG = {
        debug: true,
        toastDuration: 2000,
        theme: 'light' // Will be updated from storage
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
            console.log('[Airtel Xstream Cast Copy]', ...args);
        }
    }

    // Get current theme
    function getCurrentTheme() {
        if (CONFIG.theme && CONFIG.theme !== 'light') {
            return THEME_COLORS[CONFIG.theme] || THEME_COLORS.light;
        }

        const htmlElement = document.documentElement;
        const dataTheme = htmlElement.getAttribute('data-theme');
        const bodyTheme = document.body.getAttribute('data-theme');
        const classTheme = document.body.classList.toString();

        let theme = dataTheme || bodyTheme || null;

        if (!theme) {
            for (const themeKey of Object.keys(THEME_COLORS)) {
                if (classTheme.includes(themeKey)) {
                    theme = themeKey;
                    break;
                }
            }
        }

        theme = theme || 'light';
        return THEME_COLORS[theme] || THEME_COLORS.light;
    }

    // Get theme color
    function getThemeColor(colorType) {
        const theme = getCurrentTheme();
        return theme[colorType] || THEME_COLORS.light[colorType];
    }

    // Show toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'airtelxstream-cast-copy-toast';
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
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.toastDuration);
    }

    // Copy text to clipboard
    function copyToClipboard(text, successMessage) {
        navigator.clipboard.writeText(text).then(() => {
            log('Copied to clipboard:', text);
            showToast(successMessage || 'Copied to clipboard', 'success');
        }).catch((error) => {
            log('Error copying to clipboard:', error);
            showToast('Failed to copy', 'error');
        });
    }

    // Find the cast section using multiple selectors
    function findCastSection() {
        // Try multiple selectors for different page layouts
        const selectors = [
            '.staring-rail-wrapper',  // Original structure from your HTML
            '.starring-rail-wrapper',  // Possible typo correction
            '[class*="starring"]',     // Any class containing "starring"
            '[class*="cast"]',         // Any class containing "cast"
            '.cast-section',           // From WebFetch
            '[class*="artist"]',       // Artist related
            '.cdp-cast-section',       // Common pattern
            '.rail-wrapper'            // Generic rail
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                log(`Found cast section using selector: ${selector}`);
                return element;
            }
        }

        log('Cast section not found with any known selector');
        return null;
    }

    // Extract cast data from the starring section
    function extractCastData() {
        const castSection = findCastSection();
        if (!castSection) {
            log('Cast section not found');
            return [];
        }

        const castTiles = castSection.querySelectorAll('.staring-tile, .starring-tile, [class*="tile"], section[role="link"]');
        const castData = [];

        castTiles.forEach((tile, index) => {
            try {
                // Get cast name - try multiple methods
                let name = '';

                // Method 1: From the nested p tag inside .cast-name
                const castNameContainer = tile.querySelector('p.cast-name');
                if (castNameContainer) {
                    const nameParagraph = castNameContainer.querySelector('p');
                    if (nameParagraph) {
                        name = nameParagraph.textContent.trim();
                    }
                }

                // Method 2: Fallback to alt text from image
                if (!name) {
                    const altText = tile.querySelector('.tv-episode-alt');
                    if (altText) {
                        name = altText.textContent.trim();
                    }
                }

                // Method 3: Fallback to image alt attribute
                if (!name) {
                    const img = tile.querySelector('img[alt]');
                    if (img) {
                        name = img.getAttribute('alt').trim();
                    }
                }

                // Get role type (Actor, Director, etc.)
                const roleTypeElem = tile.querySelector('.role-type');
                const roleType = roleTypeElem ? roleTypeElem.textContent.trim() : '';

                if (name) {
                    castData.push({
                        name: name,
                        roleType: roleType,
                        index: index
                    });
                    log(`Found cast member ${index + 1}: ${name} (${roleType})`);
                }
            } catch (error) {
                log(`Error extracting data from tile ${index}:`, error);
            }
        });

        return castData;
    }

    // Format cast data for copying (similar to IMDb format)
    function formatCastData(castData) {
        // Group by role type
        const grouped = {};
        castData.forEach(member => {
            const roleType = member.roleType || 'Cast';
            if (!grouped[roleType]) {
                grouped[roleType] = [];
            }
            grouped[roleType].push(member.name);
        });

        // Format as text
        let formatted = '';
        for (const [roleType, names] of Object.entries(grouped)) {
            formatted += `${roleType}:\n${names.join('\n')}\n\n`;
        }

        return formatted.trim();
    }

    // Get dialog colors based on current theme
    function getDialogColors() {
        const theme = getCurrentTheme();
        const isDark = theme.bg !== '#ffffff';

        if (isDark) {
            return {
                background: '#1a1a2e',
                text: '#e0e7ff',
                border: '#2d2d44',
                inputBg: '#252540',
                inputBorder: '#3d3d5c',
                cancelBg: '#2d2d44',
                cancelHover: '#3d3d5c',
                cancelText: '#c7d2fe'
            };
        } else {
            return {
                background: '#ffffff',
                text: '#1a1a1a',
                border: '#e0e0e0',
                inputBg: '#f8f8f8',
                inputBorder: '#d0d0d0',
                cancelBg: '#e5e5e5',
                cancelHover: '#d5d5d5',
                cancelText: '#333333'
            };
        }
    }

    // Get default copy settings from storage
    function getDefaultSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(['defaultAirtelCastCount', 'defaultAirtelContentFormat', 'defaultAirtelOutputFormat'], (result) => {
                    if (chrome.runtime.lastError) {
                        log('Error getting default settings:', chrome.runtime.lastError);
                        resolve({ count: 5, content: 'name-role', output: 'newline' });
                    } else {
                        resolve({
                            count: result.defaultAirtelCastCount || 5,
                            content: result.defaultAirtelContentFormat || 'name-role',
                            output: result.defaultAirtelOutputFormat || 'newline'
                        });
                    }
                });
            } catch (error) {
                log('Could not access chrome storage for defaults:', error);
                resolve({ count: 5, content: 'name-role', output: 'newline' });
            }
        });
    }

    // Show copy dialog with format options
    async function showCopyDialog() {
        const castData = extractCastData();
        if (castData.length === 0) {
            showToast('No cast data found', 'error');
            return;
        }

        const colors = getCurrentTheme();
        const dialogColors = getDialogColors();
        const defaults = await getDefaultSettings();

        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = `
            @keyframes airtelFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes airtelSlideIn {
                from { transform: translate(-50%, -45%); opacity: 0; }
                to { transform: translate(-50%, -50%); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'airtelxstream-dialog-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 999998;
            backdrop-filter: blur(4px);
            animation: airtelFadeIn 0.2s ease-out;
        `;

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'airtelxstream-copy-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${dialogColors.background};
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4);
            z-index: 999999;
            min-width: 400px;
            max-width: 500px;
            border: 1px solid ${dialogColors.border};
            animation: airtelSlideIn 0.3s ease-out;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: ${dialogColors.text}; font-size: 20px; font-weight: 700; border-bottom: 2px solid ${colors.primary}; padding-bottom: 10px;">
                📋 Copy Cast
            </h3>
            <div style="margin-bottom: 18px;">
                <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Number of cast members:</label>
                <input type="number" id="airtel-cast-count" min="1" max="${castData.length}" value="${Math.min(defaults.count, castData.length)}"
                    style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
                    background: ${dialogColors.inputBg}; color: ${dialogColors.text}; transition: all 0.2s;"
                    onfocus="this.style.borderColor='${colors.primary}'; this.style.boxShadow='0 0 0 3px ${colors.primary}33'"
                    onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
            </div>
            <div style="margin-bottom: 18px;">
                <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Content:</label>
                <select id="airtel-copy-content"
                    style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
                    background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
                    onfocus="this.style.borderColor='${colors.primary}'; this.style.boxShadow='0 0 0 3px ${colors.primary}33'"
                    onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
                    <option value="name-role" ${defaults.content === 'name-role' ? 'selected' : ''}>Name + Role Type</option>
                    <option value="name-only" ${defaults.content === 'name-only' ? 'selected' : ''}>Name Only</option>
                    <option value="role-only" ${defaults.content === 'role-only' ? 'selected' : ''}>Role Type Only</option>
                </select>
            </div>
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; color: ${dialogColors.text}; font-weight: 600; font-size: 13px;">Output Format:</label>
                <select id="airtel-output-format"
                    style="width: 100%; padding: 10px 12px; border: 2px solid ${dialogColors.inputBorder}; border-radius: 6px; font-size: 14px;
                    background: ${dialogColors.inputBg}; color: ${dialogColors.text}; cursor: pointer; transition: all 0.2s;"
                    onfocus="this.style.borderColor='${colors.primary}'; this.style.boxShadow='0 0 0 3px ${colors.primary}33'"
                    onblur="this.style.borderColor='${dialogColors.inputBorder}'; this.style.boxShadow='none'">
                    <option value="newline" ${defaults.output === 'newline' ? 'selected' : ''}>Line by line (Name - Role)</option>
                    <option value="comma" ${defaults.output === 'comma' ? 'selected' : ''}>Comma separated (Name:Role,Name:Role)</option>
                    <option value="csv" ${defaults.output === 'csv' ? 'selected' : ''}>CSV (Name,Role per line)</option>
                    <option value="json" ${defaults.output === 'json' ? 'selected' : ''}>JSON Array</option>
                    <option value="table" ${defaults.output === 'table' ? 'selected' : ''}>Markdown Table</option>
                </select>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="airtel-copy-btn"
                    style="flex: 1; padding: 14px; background: ${colors.primary}; border: none; border-radius: 8px; cursor: pointer;
                    font-weight: 700; font-size: 15px; color: #ffffff; transition: all 0.2s; box-shadow: 0 2px 8px ${colors.primary}44;"
                    onmouseover="this.style.background='${colors.primaryHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px ${colors.primary}66'"
                    onmouseout="this.style.background='${colors.primary}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px ${colors.primary}44'">
                    Copy
                </button>
                <button id="airtel-cancel-btn"
                    style="flex: 1; padding: 14px; background: ${dialogColors.cancelBg}; border: none; border-radius: 8px; cursor: pointer;
                    font-weight: 600; font-size: 15px; color: ${dialogColors.cancelText}; transition: all 0.2s;"
                    onmouseover="this.style.background='${dialogColors.cancelHover}'; this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.background='${dialogColors.cancelBg}'; this.style.transform='translateY(0)'">
                    Cancel
                </button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);

        // Helper function to safely remove dialog
        const closeDialog = () => {
            if (dialog && dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        };

        // Close on backdrop click
        backdrop.addEventListener('click', closeDialog);

        // Handle copy
        dialog.querySelector('#airtel-copy-btn').addEventListener('click', () => {
            const count = parseInt(dialog.querySelector('#airtel-cast-count').value);
            const content = dialog.querySelector('#airtel-copy-content').value;
            const outputFormat = dialog.querySelector('#airtel-output-format').value;
            copyCastDataWithFormat(castData, count, content, outputFormat);
            closeDialog();
        });

        // Handle cancel
        dialog.querySelector('#airtel-cancel-btn').addEventListener('click', closeDialog);

        // Handle Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Copy cast data with specified format
    function copyCastDataWithFormat(castData, count, content, outputFormat) {
        const limitedCast = castData.slice(0, count);

        if (limitedCast.length === 0) {
            showToast('No cast members found', 'error');
            return;
        }

        let text = '';

        switch(outputFormat) {
            case 'newline':
                // Line by line: Name - Role
                text = limitedCast.map(member => {
                    if (content === 'name-only') return member.name;
                    if (content === 'role-only') return member.roleType || '(No role info)';
                    return member.roleType ? `${member.name} - ${member.roleType}` : member.name;
                }).join('\n');
                break;

            case 'comma':
                // Comma separated: Name:Role,Name:Role
                text = limitedCast.map(member => {
                    if (content === 'name-only') return member.name;
                    if (content === 'role-only') return member.roleType || '(No role info)';
                    return member.roleType ? `${member.name}:${member.roleType}` : member.name;
                }).join(',');
                break;

            case 'csv':
                // CSV format: Name,Role per line
                if (content === 'name-role') {
                    text = 'Name,Role\n' + limitedCast.map(member =>
                        `"${member.name}","${member.roleType || ''}"`
                    ).join('\n');
                } else if (content === 'name-only') {
                    text = 'Name\n' + limitedCast.map(member => `"${member.name}"`).join('\n');
                } else {
                    text = 'Role\n' + limitedCast.map(member => `"${member.roleType || ''}"`).join('\n');
                }
                break;

            case 'json':
                // JSON array
                if (content === 'name-only') {
                    text = JSON.stringify(limitedCast.map(m => m.name), null, 2);
                } else if (content === 'role-only') {
                    text = JSON.stringify(limitedCast.map(m => m.roleType || ''), null, 2);
                } else {
                    text = JSON.stringify(limitedCast.map(m => ({
                        name: m.name,
                        roleType: m.roleType || ''
                    })), null, 2);
                }
                break;

            case 'table':
                // Markdown table
                if (content === 'name-role') {
                    text = '| Name | Role |\n|------|------|\n' +
                           limitedCast.map(member => `| ${member.name} | ${member.roleType || ''} |`).join('\n');
                } else if (content === 'name-only') {
                    text = '| Name |\n|------|\n' +
                           limitedCast.map(member => `| ${member.name} |`).join('\n');
                } else {
                    text = '| Role |\n|------|\n' +
                           limitedCast.map(member => `| ${member.roleType || ''} |`).join('\n');
                }
                break;
        }

        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Copied ${limitedCast.length} cast member(s)`, 'success');
            log('Copied cast data:', text);
        }).catch(err => {
            log('Failed to copy:', err);
            showToast('Failed to copy to clipboard', 'error');
        });
    }

    // Helper function to create individual copy button for cast members
    function createIndividualCopyButton(name) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'airtelxstream-individual-copy-btn';
        copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon">
                <path d="M12.668 10.667C12.668 9.95614 12.668 9.46258 12.6367 9.0791C12.6137 8.79732 12.5758 8.60761 12.5244 8.46387L12.4688 8.33399C12.3148 8.03193 12.0803 7.77885 11.793 7.60254L11.666 7.53125C11.508 7.45087 11.2963 7.39395 10.9209 7.36328C10.5374 7.33197 10.0439 7.33203 9.33301 7.33203H6.5C5.78896 7.33203 5.29563 7.33195 4.91211 7.36328C4.63016 7.38632 4.44065 7.42413 4.29688 7.47559L4.16699 7.53125C3.86488 7.68518 3.61186 7.9196 3.43555 8.20703L3.36524 8.33399C3.28478 8.49198 3.22795 8.70352 3.19727 9.0791C3.16595 9.46259 3.16504 9.95611 3.16504 10.667V13.5C3.16504 14.211 3.16593 14.7044 3.19727 15.0879C3.22797 15.4636 3.28473 15.675 3.36524 15.833L3.43555 15.959C3.61186 16.2466 3.86474 16.4807 4.16699 16.6348L4.29688 16.6914C4.44063 16.7428 4.63025 16.7797 4.91211 16.8027C5.29563 16.8341 5.78896 16.835 6.5 16.835H9.33301C10.0439 16.835 10.5374 16.8341 10.9209 16.8027C11.2965 16.772 11.508 16.7152 11.666 16.6348L11.793 16.5645C12.0804 16.3881 12.3148 16.1351 12.4688 15.833L12.5244 15.7031C12.5759 15.5594 12.6137 15.3698 12.6367 15.0879C12.6681 14.7044 12.668 14.211 12.668 13.5V10.667ZM13.998 12.665C14.4528 12.6634 14.8011 12.6602 15.0879 12.6367C15.4635 12.606 15.675 12.5492 15.833 12.4688L15.959 12.3975C16.2466 12.2211 16.4808 11.9682 16.6348 11.666L16.6914 11.5361C16.7428 11.3924 16.7797 11.2026 16.8027 10.9209C16.8341 10.5374 16.835 10.0439 16.835 9.33301V6.5C16.835 5.78896 16.8341 5.29563 16.8027 4.91211C16.7797 4.63025 16.7428 4.44063 16.6914 4.29688L16.6348 4.16699C16.4807 3.86474 16.2466 3.61186 15.959 3.43555L15.833 3.36524C15.675 3.28473 15.4636 3.22797 15.0879 3.19727C14.7044 3.16593 14.211 3.16504 13.5 3.16504H10.667C9.9561 3.16504 9.46259 3.16595 9.0791 3.19727C8.79739 3.22028 8.6076 3.2572 8.46387 3.30859L8.33399 3.36524C8.03176 3.51923 7.77886 3.75343 7.60254 4.04102L7.53125 4.16699C7.4508 4.32498 7.39397 4.53655 7.36328 4.91211C7.33985 5.19893 7.33562 5.54719 7.33399 6.00195H9.33301C10.022 6.00195 10.5791 6.00131 11.0293 6.03809C11.4873 6.07551 11.8937 6.15471 12.2705 6.34668L12.4883 6.46875C12.984 6.7728 13.3878 7.20854 13.6533 7.72949L13.7197 7.87207C13.8642 8.20859 13.9292 8.56974 13.9619 8.9707C13.9987 9.42092 13.998 9.97799 13.998 10.667V12.665ZM18.165 9.33301C18.165 10.022 18.1657 10.5791 18.1289 11.0293C18.0961 11.4302 18.0311 11.7914 17.8867 12.1279L17.8203 12.2705C17.5549 12.7914 17.1509 13.2272 16.6553 13.5313L16.4365 13.6533C16.0599 13.8452 15.6541 13.9245 15.1963 13.9619C14.8593 13.9895 14.4624 13.9935 13.9951 13.9951C13.9935 14.4624 13.9895 14.8593 13.9619 15.1963C13.9292 15.597 13.864 15.9576 13.7197 16.2939L13.6533 16.4365C13.3878 16.9576 12.9841 17.3941 12.4883 17.6982L12.2705 17.8203C11.8937 18.0123 11.4873 18.0915 11.0293 18.1289C10.5791 18.1657 10.022 18.165 9.33301 18.165H6.5C5.81091 18.165 5.25395 18.1657 4.80371 18.1289C4.40306 18.0962 4.04235 18.031 3.70606 17.8867L3.56348 17.8203C3.04244 17.5548 2.60585 17.151 2.30176 16.6553L2.17969 16.4365C1.98788 16.0599 1.90851 15.6541 1.87109 15.1963C1.83431 14.746 1.83496 14.1891 1.83496 13.5V10.667C1.83496 9.978 1.83432 9.42091 1.87109 8.9707C1.90851 8.5127 1.98772 8.10625 2.17969 7.72949L2.30176 7.51172C2.60586 7.0159 3.04236 6.6122 3.56348 6.34668L3.70606 6.28027C4.04237 6.136 4.40303 6.07083 4.80371 6.03809C5.14051 6.01057 5.53708 6.00551 6.00391 6.00391C6.00551 5.53708 6.01057 5.14051 6.03809 4.80371C6.0755 4.34588 6.15483 3.94012 6.34668 3.56348L6.46875 3.34473C6.77282 2.84912 7.20856 2.44514 7.72949 2.17969L7.87207 2.11328C8.20855 1.96886 8.56979 1.90385 8.9707 1.87109C9.42091 1.83432 9.978 1.83496 10.667 1.83496H13.5C14.1891 1.83496 14.746 1.83431 15.1963 1.87109C15.6541 1.90851 16.0599 1.98788 16.4365 2.17969L16.6553 2.30176C17.151 2.60585 17.5548 3.04244 17.8203 3.56348L17.8867 3.70606C18.031 4.04235 18.0962 4.40306 18.1289 4.80371C18.1657 5.25395 18.165 5.81091 18.165 6.5V9.33301Z"></path>
            </svg>
        `;
        copyBtn.title = 'Copy name';
        copyBtn.style.cssText = `
            padding: 3px;
            background: transparent;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            opacity: 0.4;
            transition: all 0.15s ease;
            vertical-align: middle;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: currentColor;
            margin-left: 4px;
        `;

        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.opacity = '1';
            copyBtn.style.background = 'rgba(128, 128, 128, 0.15)';
            copyBtn.style.transform = 'scale(1.15)';
        });

        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.opacity = '0.4';
            copyBtn.style.background = 'transparent';
            copyBtn.style.transform = 'scale(1)';
        });

        const copyIconSVG = copyBtn.innerHTML;

        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            navigator.clipboard.writeText(name).then(() => {
                // Visual feedback - show checkmark
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M16.6668 5L7.50016 14.1667L3.3335 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                `;
                copyBtn.style.color = '#4caf50';
                copyBtn.style.opacity = '1';

                setTimeout(() => {
                    copyBtn.innerHTML = copyIconSVG;
                    copyBtn.style.color = 'currentColor';
                    copyBtn.style.opacity = '0.4';
                }, 1000);
            }).catch(err => {
                log('Failed to copy:', err);
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                    </svg>
                `;
                copyBtn.style.color = '#f44336';
                copyBtn.style.opacity = '1';

                setTimeout(() => {
                    copyBtn.innerHTML = copyIconSVG;
                    copyBtn.style.color = 'currentColor';
                    copyBtn.style.opacity = '0.4';
                }, 1000);
            });
        });

        return copyBtn;
    }

    // Add individual copy button to a cast tile
    function addIndividualCopyButton(tile, name) {
        // Find where to insert the button - next to the name
        // Method 1: Try to find the nested p tag inside .cast-name
        const castNameContainer = tile.querySelector('p.cast-name');
        if (castNameContainer) {
            const nameParagraph = castNameContainer.querySelector('p');
            if (nameParagraph) {
                const copyBtn = createIndividualCopyButton(name);
                nameParagraph.style.display = 'inline-flex';
                nameParagraph.style.alignItems = 'center';
                nameParagraph.appendChild(copyBtn);
                log(`Added individual copy button for: ${name}`);
                return;
            }
        }

        // Method 2: Try to find .tv-episode-alt
        const altText = tile.querySelector('.tv-episode-alt');
        if (altText) {
            const copyBtn = createIndividualCopyButton(name);
            altText.style.display = 'inline-flex';
            altText.style.alignItems = 'center';
            altText.appendChild(copyBtn);
            log(`Added individual copy button (alt method) for: ${name}`);
            return;
        }

        log(`Could not find suitable location for copy button for: ${name}`);
    }

    // Add click-to-copy functionality to cast names
    function addClickToCopyToCastNames() {
        const castSection = findCastSection();
        if (!castSection) {
            log('Cast section not found for click-to-copy');
            return;
        }

        const castTiles = castSection.querySelectorAll('.staring-tile, .starring-tile, section[role="link"]');
        let addedCount = 0;

        castTiles.forEach((tile, index) => {
            // Skip if already processed
            if (tile.dataset.castCopyEnabled) {
                return;
            }

            try {
                // Get cast name using the same method as extractCastData
                let name = '';

                // Method 1: From the nested p tag inside .cast-name
                const castNameContainer = tile.querySelector('p.cast-name');
                if (castNameContainer) {
                    const nameParagraph = castNameContainer.querySelector('p');
                    if (nameParagraph) {
                        name = nameParagraph.textContent.trim();
                    }
                }

                // Method 2: Fallback to alt text
                if (!name) {
                    const altText = tile.querySelector('.tv-episode-alt');
                    if (altText) {
                        name = altText.textContent.trim();
                    }
                }

                // Method 3: Fallback to image alt
                if (!name) {
                    const img = tile.querySelector('img[alt]');
                    if (img) {
                        name = img.getAttribute('alt').trim();
                    }
                }

                if (!name) {
                    log(`No name found for tile ${index}`);
                    return;
                }

                // Mark as processed
                tile.dataset.castCopyEnabled = 'true';

                // Make the entire tile clickable (without visual hover effects to avoid UX interference)
                tile.style.cursor = 'pointer';

                // Add click handler to copy name (when clicking on tile, not on buttons/links)
                tile.addEventListener('click', (e) => {
                    // Don't copy if clicking on a link or our copy button
                    if (e.target.tagName === 'A' ||
                        e.target.closest('a') ||
                        e.target.closest('.airtelxstream-individual-copy-btn')) {
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(name, `Copied: ${name}`);
                });

                // Add individual copy button next to the name
                addIndividualCopyButton(tile, name);

                addedCount++;
                log(`Added click-to-copy to: ${name}`);
            } catch (error) {
                log(`Error adding click-to-copy to tile ${index}:`, error);
            }
        });

        if (addedCount > 0) {
            log(`Added click-to-copy functionality to ${addedCount} cast member(s)`);
        }
    }

    // Add copy button to the cast section header
    function addCopyButton() {
        const castSection = findCastSection();
        if (!castSection) {
            log('Cast section not found for copy button');
            return;
        }

        // Check if button already exists
        if (castSection.querySelector('.airtelxstream-cast-copy-btn')) {
            log('Copy button already exists');
            return;
        }

        // Find the title holder - try multiple selectors
        const titleHolder = castSection.querySelector('.title-holder') ||
                           castSection.querySelector('h2')?.parentElement ||
                           castSection.querySelector('[class*="title"]');

        if (!titleHolder) {
            log('Title holder not found');
            return;
        }

        // Create copy button
        const button = document.createElement('button');
        button.className = 'airtelxstream-cast-copy-btn';
        button.innerHTML = '📋 Copy Cast';
        button.title = 'Copy all cast members in formatted list';

        const primaryColor = getThemeColor('primary');
        const primaryHover = getThemeColor('primaryHover');

        Object.assign(button.style, {
            marginLeft: '12px',
            padding: '6px 14px',
            backgroundColor: primaryColor,
            border: 'none',
            borderRadius: '4px',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        });

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = primaryHover;
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = primaryColor;
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        });

        // Click handler - show dialog instead of direct copy
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showCopyDialog();
        });

        // Add button next to the title
        const h2Title = titleHolder.querySelector('h2.title');
        if (h2Title) {
            h2Title.style.display = 'inline-flex';
            h2Title.style.alignItems = 'center';
            h2Title.parentNode.style.display = 'inline-flex';
            h2Title.parentNode.style.alignItems = 'center';
            titleHolder.appendChild(button);
            log('Copy button added successfully');
        }
    }

    // Update button colors when theme changes
    function updateButtonColorsForTheme() {
        const button = document.querySelector('.airtelxstream-cast-copy-btn');
        if (button) {
            const primaryColor = getThemeColor('primary');
            button.style.backgroundColor = primaryColor;
            button.style.borderColor = primaryColor;
        }
        log('Updated button colors for theme');
    }

    // Load theme from storage
    function loadThemeFromStorage() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get(['theme'], (result) => {
                    if (result && result.theme) {
                        CONFIG.theme = result.theme;
                        log('Loaded theme from storage:', CONFIG.theme);
                    } else {
                        CONFIG.theme = 'light';
                    }
                    resolve(CONFIG.theme);
                });
            } catch (error) {
                log('Could not access chrome storage:', error);
                resolve(CONFIG.theme);
            }
        });
    }

    // Setup theme listener
    function setupThemeListener() {
        const htmlElement = document.documentElement;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    log('Theme changed, updating colors');
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

    // Setup storage listener
    function setupStorageListener() {
        try {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'sync' && changes.theme) {
                    CONFIG.theme = changes.theme.newValue;
                    log('Theme changed via storage:', CONFIG.theme);
                    updateButtonColorsForTheme();
                }
            });
            log('Storage listener set up');
        } catch (error) {
            log('Could not set up storage listener:', error);
        }
    }

    // Setup MutationObserver to detect when cast section loads
    function setupObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const hasCastSection = addedNodes.some(node => {
                        return node.nodeType === 1 && (
                            node.matches('.staring-rail-wrapper, .starring-rail-wrapper') ||
                            node.querySelector('.staring-rail-wrapper, .starring-rail-wrapper') ||
                            node.matches('.staring-tile, .starring-tile') ||
                            node.querySelector('.staring-tile, .starring-tile') ||
                            node.matches('#layoutSectionElement') ||
                            node.querySelector('#layoutSectionElement') ||
                            node.matches('[class*="cast"]') ||
                            node.querySelector('[class*="cast"]')
                        );
                    });

                    if (hasCastSection) {
                        shouldCheck = true;
                    }
                }
            });

            if (shouldCheck) {
                clearTimeout(observer.timeout);
                observer.timeout = setTimeout(() => {
                    log('New cast section detected, adding functionality');
                    const castSection = findCastSection();
                    if (castSection) {
                        addCopyButton();
                        addClickToCopyToCastNames();
                    } else {
                        log('Cast section still not found after mutation');
                    }
                }, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('MutationObserver set up for cast section detection');
        return observer;
    }

    // Check if we're on a page that has cast information
    function isValidPage() {
        // Check if URL contains common patterns for show/movie pages
        const url = window.location.href;
        const isValidUrl = url.includes('/movies/') ||
                          url.includes('/shows/') ||
                          url.includes('/tv-shows/') ||
                          url.includes('/tvshow/') ||
                          url.includes('/livetv/');

        log('URL validation:', url, '- Valid:', isValidUrl);
        return isValidUrl;
    }

    // Check if we're on the "Cast & more" tab
    function isCastTabActive() {
        const castTab = document.querySelector('#cdp-tab-2');
        if (!castTab) return false;
        return castTab.classList.contains('active');
    }

    // Setup observer for the error page retry button
    function setupErrorRetryObserver() {
        const bottomTileHolder = document.querySelector('#bottom-tile-holder, .bottom-tile-area');
        if (!bottomTileHolder) {
            log('Bottom tile holder not found');
            return;
        }

        // Observer to watch for error page and retry button
        const errorObserver = new MutationObserver((mutations) => {
            // Check if error page is shown
            const errorPage = document.querySelector('.error-page-wrapper');
            const retryButton = document.querySelector('.back-home-error');

            if (errorPage && retryButton && !retryButton.dataset.listenerAdded) {
                log('Error page detected, adding listener to retry button');
                retryButton.dataset.listenerAdded = 'true';

                retryButton.addEventListener('click', () => {
                    log('Retry button clicked, waiting for cast section to load');
                    setTimeout(() => {
                        const castSection = findCastSection();
                        if (castSection) {
                            log('Cast section loaded after retry, adding functionality');
                            addCopyButton();
                            addClickToCopyToCastNames();
                        }
                    }, 2000);
                });
            }
        });

        errorObserver.observe(bottomTileHolder, {
            childList: true,
            subtree: true
        });

        log('Error retry observer set up');
    }

    // Setup tab observer to detect when Cast & more tab is clicked
    function setupTabObserver() {
        const tabsHolder = document.querySelector('#tabs-holder, .tab-holder-area');
        if (!tabsHolder) {
            log('Tabs holder not found, will retry in 500ms');
            setTimeout(setupTabObserver, 500);
            return;
        }

        const castTab = document.querySelector('#cdp-tab-2');
        if (!castTab) {
            log('Cast & more tab not found, will retry in 500ms');
            setTimeout(setupTabObserver, 500);
            return;
        }

        log('Setting up tab observer for Cast & more tab');

        // Create observer for tab class changes
        const tabObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.id === 'cdp-tab-2' && target.classList.contains('active')) {
                        log('Cast & more tab activated, waiting for content to load');
                        // Wait a bit for content to load, then add buttons
                        setTimeout(() => {
                            const castSection = findCastSection();
                            if (castSection) {
                                log('Cast section loaded, adding functionality');
                                addCopyButton();
                                addClickToCopyToCastNames();
                            } else {
                                log('Cast section not loaded yet (may show error page), waiting for retry or DOM changes');
                                // Setup error retry observer
                                setupErrorRetryObserver();
                            }
                        }, 1500);
                    }
                }
            });
        });

        tabObserver.observe(castTab, {
            attributes: true,
            attributeFilter: ['class']
        });

        log('Tab observer set up successfully');

        // Also add click listener to the cast tab
        castTab.addEventListener('click', () => {
            log('Cast & more tab clicked, waiting for content');
            setTimeout(() => {
                const castSection = findCastSection();
                if (castSection) {
                    addCopyButton();
                    addClickToCopyToCastNames();
                } else {
                    log('Content not loaded, setting up error retry observer');
                    setupErrorRetryObserver();
                }
            }, 1500);
        });
    }

    // Initialize
    async function init() {
        if (!isValidPage()) {
            log('Not on a valid page with cast information');
            return;
        }

        log('Initializing Airtel Xstream cast copy feature');

        // Load theme from storage
        await loadThemeFromStorage();

        // Setup theme listeners
        setupThemeListener();
        setupStorageListener();

        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    // Setup tab observer to detect when Cast & more tab is clicked
                    setupTabObserver();

                    // Check if cast section is already visible (tab already active)
                    if (isCastTabActive() && document.querySelector('.staring-rail-wrapper')) {
                        log('Cast section already visible on page load');
                        addCopyButton();
                        addClickToCopyToCastNames();
                    }

                    // Setup general observer for dynamic content
                    setupObserver();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                // Setup tab observer to detect when Cast & more tab is clicked
                setupTabObserver();

                // Check if cast section is already visible (tab already active)
                if (isCastTabActive() && document.querySelector('.staring-rail-wrapper')) {
                    log('Cast section already visible on page load');
                    addCopyButton();
                    addClickToCopyToCastNames();
                }

                // Setup general observer for dynamic content
                setupObserver();
            }, 1000);
        }
    }

    // Start
    init();

    // Test function to verify cast section exists
    function testCastSection() {
        console.log('=== Airtel Xstream Cast Copy Debug ===');

        // Check for tabs
        const tabsHolder = document.querySelector('#tabs-holder, .tab-holder-area');
        console.log('Tabs holder found:', !!tabsHolder);

        const castTab = document.querySelector('#cdp-tab-2');
        console.log('Cast & more tab found:', !!castTab);

        if (castTab) {
            console.log('Cast & more tab active:', castTab.classList.contains('active'));
            console.log('Cast tab text:', castTab.textContent.trim());
        }

        const castSection = findCastSection();
        console.log('\nCast section found:', !!castSection);

        if (castSection) {
            const castTiles = castSection.querySelectorAll('.staring-tile, .starring-tile, section[role="link"]');
            console.log('Number of cast tiles:', castTiles.length);

            castTiles.forEach((tile, index) => {
                console.log(`\nTile ${index + 1}:`);

                // Check for cast name
                const castNameContainer = tile.querySelector('p.cast-name');
                console.log('  - p.cast-name found:', !!castNameContainer);

                if (castNameContainer) {
                    const nameParagraph = castNameContainer.querySelector('p');
                    console.log('  - nested p found:', !!nameParagraph);
                    if (nameParagraph) {
                        console.log('  - Name:', nameParagraph.textContent.trim());
                    }
                }

                // Check for alt text
                const altText = tile.querySelector('.tv-episode-alt');
                console.log('  - .tv-episode-alt found:', !!altText);
                if (altText) {
                    console.log('  - Alt text:', altText.textContent.trim());
                }

                // Check for role type
                const roleType = tile.querySelector('.role-type');
                console.log('  - .role-type found:', !!roleType);
                if (roleType) {
                    console.log('  - Role:', roleType.textContent.trim());
                }

                // Check if already processed
                console.log('  - Already processed:', tile.dataset.castCopyEnabled === 'true');
            });

            console.log('\n=== Extracted Data ===');
            const extractedData = extractCastData();
            console.log('Extracted cast members:', extractedData);
        }

        console.log('\n=== Copy Button ===');
        const copyButton = document.querySelector('.airtelxstream-cast-copy-btn');
        console.log('Copy button exists:', !!copyButton);

        console.log('=== End Debug ===');
    }

    // Expose control to window for debugging
    window.airtelxstreamCastCopy = {
        refresh: () => {
            addCopyButton();
            addClickToCopyToCastNames();
        },
        extract: extractCastData,
        format: formatCastData,
        test: testCastSection,
        enableDebug: () => { CONFIG.debug = true; log('Debug enabled'); },
        disableDebug: () => { CONFIG.debug = false; }
    };

    log('Cast copy feature initialized');
})();
