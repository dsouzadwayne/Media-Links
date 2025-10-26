// Customized View Page Script
// Handles loading and displaying the customized view in a dedicated page

(function() {
    'use strict';

    /**
     * Download file helper
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    /**
     * Load and display the customized view
     */
    function loadAndDisplayView() {
        // Get data from Chrome storage
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            const contentDiv = document.getElementById('view-content');
            contentDiv.innerHTML = `
                <div class="error-message">
                    ⚠️ Chrome storage API not available.
                </div>
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h2>Storage Error</h2>
                    <p>The extension cannot access storage. Please reload the extension and try again.</p>
                </div>
            `;
            return;
        }

        chrome.storage.local.get(['customized-view-temp'], function(result) {
            const viewDataObj = result['customized-view-temp'];

            if (!viewDataObj) {
                const contentDiv = document.getElementById('view-content');
                contentDiv.innerHTML = `
                    <div class="error-message">
                        ⚠️ No data found. Please open a customized view from an IMDb page.
                    </div>
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <h2>No Cast & Crew Data</h2>
                        <p>Navigate to an IMDb fullcredits page and click "View Cast & Crew in New Tab".</p>
                    </div>
                `;
                return;
            }

            try {
                const data = viewDataObj.data;
                const options = {
                    title: viewDataObj.title,
                    columns: viewDataObj.columns,
                    pagePath: viewDataObj.pagePath,
                    pageSource: viewDataObj.pageSource
                };

                // Update page title and source info
                document.title = `${options.title} - Media Links`;
                const sourceInfo = document.getElementById('source-info');
                if (options.pageSource) {
                    sourceInfo.textContent = `From: ${options.pageSource}`;
                }

                // Create and render customized view
                if (typeof CustomizedView !== 'undefined') {
                    const view = new CustomizedView({
                        containerId: 'customized-view-full',
                        data: data,
                        title: options.title,
                        columns: options.columns || ['name', 'role', 'roleType'],
                        pagePath: options.pagePath
                    });

                    // Load preferences
                    view.loadPreferences().then((prefs) => {
                        view.applyPreferences(prefs);

                        const contentDiv = document.getElementById('view-content');
                        contentDiv.innerHTML = '';
                        view.render().then(viewElement => {
                            contentDiv.appendChild(viewElement);
                        });
                    });
                } else {
                    throw new Error('CustomizedView not available');
                }

                // Export to CSV
                document.getElementById('export-csv-btn').addEventListener('click', () => {
                    const headers = options.columns || ['name', 'role', 'roleType'];
                    const csvContent = [
                        headers.join(','),
                        ...data.map(row =>
                            headers.map(col =>
                                `"${(row[col] || '').toString().replace(/"/g, '""')}"`
                            ).join(',')
                        )
                    ].join('\n');

                    downloadFile(csvContent, 'cast-and-crew.csv', 'text/csv');
                });

                // Export to JSON
                document.getElementById('export-json-btn').addEventListener('click', () => {
                    const jsonContent = JSON.stringify(data, null, 2);
                    downloadFile(jsonContent, 'cast-and-crew.json', 'application/json');
                });

                // Go back button
                document.getElementById('go-back-btn').addEventListener('click', () => {
                    window.history.back();
                });

            } catch (error) {
                console.error('Error loading view data:', error);
                const contentDiv = document.getElementById('view-content');
                contentDiv.innerHTML = `
                    <div class="error-message">
                        ⚠️ Error loading data: ${error.message}
                    </div>
                `;
            }
        });
    }

    // Load view when page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAndDisplayView);
    } else {
        loadAndDisplayView();
    }
})();
