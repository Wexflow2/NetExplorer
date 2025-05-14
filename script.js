document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const urlInput = document.getElementById('url-input');
    const goButton = document.getElementById('go-button');
    const searchButton = document.getElementById('search-button');
    const refreshButton = document.getElementById('refresh-button');
    const backButton = document.getElementById('back-button');
    const forwardButton = document.getElementById('forward-button');
    const homeButton = document.getElementById('home-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const urlForm = document.getElementById('url-form');
    const chromeTabs = document.getElementById('chrome-tabs');
    const newTabButton = document.getElementById('new-tab-button');
    const tabContents = document.getElementById('tab-contents');
    const windowControls = document.querySelectorAll('.chrome-control');
    const siteInfo = document.querySelector('.site-info');
    const bookmarks = document.querySelectorAll('.chrome-bookmark');
    const shortcuts = document.querySelectorAll('.chrome-shortcut');

    // Initialize browser history
    let browserHistory = [];
    let currentHistoryIndex = -1;
    
    // Update navigation buttons state
    function updateNavButtons() {
        if (!activeTabId || !tabsData[activeTabId]) return;
        const tabData = tabsData[activeTabId];
        backButton.disabled = tabData.currentIndex <= 0;
        forwardButton.disabled = tabData.currentIndex >= tabData.history.length - 1;
    }
    
    // Tab management variables
    let tabCounter = 1;
    let activeTabId = 'tab-1';
    let tabsData = {
        'tab-1': {
            history: [],
            currentIndex: -1,
            url: ''
        }
    };

    // Create a new tab
    function createNewTab() {
        tabCounter++;
        const newTabId = `tab-${tabCounter}`;
        
        // Create tab element
        const newTab = document.createElement('div');
        newTab.className = 'chrome-tab';
        newTab.dataset.tabId = newTabId;
        newTab.innerHTML = `
            <div class="chrome-tab-favicon">
                <img src="/static/images/net-ex-logo.svg" alt="Net-Ex Logo">
            </div>
            <div class="chrome-tab-title">New Tab</div>
            <div class="chrome-tab-close">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Insert before the new tab button
        chromeTabs.insertBefore(newTab, newTabButton);
        
        // Create tab content
        const newTabContent = document.createElement('div');
        newTabContent.className = 'tab-content';
        newTabContent.dataset.tabContentId = newTabId;
        newTabContent.innerHTML = `
            <div class="welcome-screen chrome-welcome">
                <div class="chrome-logo">
                    <img src="/static/images/net-ex-logo.svg" alt="Net-Ex Logo">
                </div>
                <div class="chrome-search-wrapper">
                    <form class="chrome-search-form" action="/search" method="get">
                        <div class="chrome-search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" name="q" placeholder="Search Google or type a URL" 
                                   onclick="this.select()" autofocus>
                            <button type="submit" class="chrome-search-button">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </form>
                </div>
                <div class="chrome-shortcuts">
                    <div class="shortcut-row">
                        <div class="chrome-shortcut" data-url="google.com">
                            <div class="shortcut-icon google">
                                <i class="fab fa-google"></i>
                            </div>
                            <span>Google</span>
                        </div>
                        <div class="chrome-shortcut" data-url="youtube.com">
                            <div class="shortcut-icon youtube">
                                <i class="fab fa-youtube"></i>
                            </div>
                            <span>YouTube</span>
                        </div>
                        <div class="chrome-shortcut" data-url="wikipedia.org">
                            <div class="shortcut-icon wikipedia">
                                <i class="fab fa-wikipedia-w"></i>
                            </div>
                            <span>Wikipedia</span>
                        </div>
                        <div class="chrome-shortcut" data-url="github.com">
                            <div class="shortcut-icon github">
                                <i class="fab fa-github"></i>
                            </div>
                            <span>GitHub</span>
                        </div>
                    </div>
                </div>
            </div>
            <iframe class="chrome-frame proxy-frame d-none" src=""></iframe>
        `;
        
        // Add to tab contents
        tabContents.appendChild(newTabContent);
        
        // Initialize tab data
        tabsData[newTabId] = {
            history: [],
            currentIndex: -1,
            url: ''
        };
        
        // Setup event listeners for the new tab
        setupTabEventListeners(newTab);
        setupTabContentEventListeners(newTabContent);
        
        // Switch to the new tab
        switchToTab(newTabId);
        
        return newTabId;
    }
    
    // Switch to a specific tab
    function switchToTab(tabId) {
        // Update active tab
        document.querySelectorAll('.chrome-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.chrome-tab[data-tab-id="${tabId}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.tab-content[data-tab-content-id="${tabId}"]`).classList.add('active');
        
        // Set active tab ID
        activeTabId = tabId;
        
        // Update navigation buttons state
        updateNavButtons();
        
        // Update URL input
        urlInput.value = tabsData[tabId].url || '';
        
        // Update site info
        if (tabsData[tabId].url) {
            updateTabInfo(tabsData[tabId].url);
        } else {
            // Reset site info for new tabs
            siteInfo.innerHTML = '<i class="fas fa-globe text-secondary"></i>';
        }
    }
    
    // Close a tab
    function closeTab(tabId) {
        // Don't close if it's the last tab
        if (Object.keys(tabsData).length <= 1) {
            return;
        }
        
        // Remove tab element
        const tabElement = document.querySelector(`.chrome-tab[data-tab-id="${tabId}"]`);
        tabElement.remove();
        
        // Remove tab content
        const contentElement = document.querySelector(`.tab-content[data-tab-content-id="${tabId}"]`);
        contentElement.remove();
        
        // Remove from tab data
        delete tabsData[tabId];
        
        // If the closed tab was active, switch to another tab
        if (activeTabId === tabId) {
            const remainingTabId = Object.keys(tabsData)[0];
            switchToTab(remainingTabId);
        }
    }
    
    // Set up event listeners for tab
    function setupTabEventListeners(tabElement) {
        // Tab click (switch tab)
        tabElement.addEventListener('click', function(e) {
            // Ignore if the close button was clicked
            if (!e.target.closest('.chrome-tab-close')) {
                switchToTab(tabElement.dataset.tabId);
            }
        });
        
        // Close button click
        const closeButton = tabElement.querySelector('.chrome-tab-close');
        closeButton.addEventListener('click', function(e) {
            e.stopPropagation();
            closeTab(tabElement.dataset.tabId);
        });
    }
    
    // Set up event listeners for tab content
    function setupTabContentEventListeners(contentElement) {
        // Set up shortcuts click
        contentElement.querySelectorAll('.chrome-shortcut').forEach(shortcut => {
            shortcut.addEventListener('click', function() {
                const url = this.dataset.url;
                if (url) {
                    loadUrl(url);
                }
            });
        });
        
        // Set up search form
        const searchForm = contentElement.querySelector('.chrome-search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const query = this.querySelector('input').value.trim();
                if (query) {
                    // Check if query looks like a URL
                    if (query.includes('.') && !query.includes(' ')) {
                        loadUrl(query);
                    } else {
                        // Treat as a search query
                        loadUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
                    }
                }
            });
        }
    }
    
    // Load URL in the active tab's iframe
    function loadUrl(url) {
        if (!url) return;
        
        // Format URL if needed
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/proxy')) {
            url = 'https://' + url;
        }
        
        // Get active tab content
        const activeTabContent = document.querySelector(`.tab-content[data-tab-content-id="${activeTabId}"]`);
        const welcomeScreen = activeTabContent.querySelector('.welcome-screen');
        const proxyFrame = activeTabContent.querySelector('.proxy-frame');
        
        // Show loading spinner and hide welcome screen
        loadingSpinner.classList.remove('d-none');
        welcomeScreen.classList.add('d-none');
        proxyFrame.classList.remove('d-none');
        
        // If it's not already a proxy URL, make it one
        if (!url.startsWith('/proxy')) {
            url = `/proxy?url=${encodeURIComponent(url)}`;
        }
        
        // Get tab history
        const tabData = tabsData[activeTabId];
        
        // Add to history if it's a new URL
        if (tabData.history[tabData.currentIndex] !== url) {
            // If we went back and then navigated to a new URL, truncate the forward history
            if (tabData.currentIndex < tabData.history.length - 1) {
                tabData.history = tabData.history.slice(0, tabData.currentIndex + 1);
            }
            
            tabData.history.push(url);
            tabData.currentIndex = tabData.history.length - 1;
        }
        
        // Update URL in the input field
        const displayUrl = url.startsWith('/proxy?url=') 
            ? decodeURIComponent(url.substring(11)) 
            : url;
        urlInput.value = displayUrl;
        tabData.url = displayUrl;
        
        // Update tab title and favicon
        updateTabInfo(displayUrl);
        
        // Load the URL in the iframe
        proxyFrame.src = url;
        
        // Update navigation buttons
        updateNavButtons();
    }
    
    // Update tab information based on the URL
    function updateTabInfo(url) {
        // Extract domain for tab title
        let domain = url;
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                domain = new URL(url).hostname;
            } else if (url.includes('/')) {
                domain = url.split('/')[0];
            }
        } catch (e) {
            // Use the URL as is if parsing fails
        }
        
        // Update tab title
        document.querySelector('.chrome-tab-title').textContent = domain;
        
        // Update site info icon (lock/info icon)
        if (url.startsWith('https://')) {
            siteInfo.innerHTML = '<i class="fas fa-lock text-success"></i>';
        } else if (url.startsWith('http://')) {
            siteInfo.innerHTML = '<i class="fas fa-info-circle text-warning"></i>';
        } else {
            siteInfo.innerHTML = '<i class="fas fa-globe text-secondary"></i>';
        }
    }
    
    // Handle form submission
    urlForm.addEventListener('submit', function(e) {
        e.preventDefault();
        loadUrl(urlInput.value.trim());
    });
    
    // Go button click
    goButton.addEventListener('click', function() {
        loadUrl(urlInput.value.trim());
    });
    
    // Back button click
    backButton.addEventListener('click', function() {
        const tabData = tabsData[activeTabId];
        if (tabData && tabData.currentIndex > 0) {
            tabData.currentIndex--;
            const url = tabData.history[tabData.currentIndex];
            
            // Get active tab's iframe
            const activeTabContent = document.querySelector(`.tab-content[data-tab-content-id="${activeTabId}"]`);
            const proxyFrame = activeTabContent.querySelector('.proxy-frame');
            
            loadingSpinner.classList.remove('d-none');
            proxyFrame.src = url;
            
            // Update URL in the input field
            const displayUrl = url.startsWith('/proxy?url=') 
                ? decodeURIComponent(url.substring(11)) 
                : url;
            urlInput.value = displayUrl;
            tabData.url = displayUrl;
            
            // Update tab info
            updateTabInfo(displayUrl);
            
            updateNavButtons();
        }
    });
    
    // Forward button click
    forwardButton.addEventListener('click', function() {
        const tabData = tabsData[activeTabId];
        if (tabData && tabData.currentIndex < tabData.history.length - 1) {
            tabData.currentIndex++;
            const url = tabData.history[tabData.currentIndex];
            
            // Get active tab's iframe
            const activeTabContent = document.querySelector(`.tab-content[data-tab-content-id="${activeTabId}"]`);
            const proxyFrame = activeTabContent.querySelector('.proxy-frame');
            
            loadingSpinner.classList.remove('d-none');
            proxyFrame.src = url;
            
            // Update URL in the input field
            const displayUrl = url.startsWith('/proxy?url=') 
                ? decodeURIComponent(url.substring(11)) 
                : url;
            urlInput.value = displayUrl;
            tabData.url = displayUrl;
            
            // Update tab info
            updateTabInfo(displayUrl);
            
            updateNavButtons();
        }
    });
    
    // New tab button click
    newTabButton.addEventListener('click', function() {
        createNewTab();
    });
    
    // Refresh button click
    refreshButton.addEventListener('click', function() {
        const activeTabContent = document.querySelector(`.tab-content[data-tab-content-id="${activeTabId}"]`);
        const proxyFrame = activeTabContent.querySelector('.proxy-frame');
        
        if (proxyFrame.src) {
            loadingSpinner.classList.remove('d-none');
            proxyFrame.src = proxyFrame.src;
        }
    });
    
    // Home button click
    homeButton.addEventListener('click', function() {
        const activeTabContent = document.querySelector(`.tab-content[data-tab-content-id="${activeTabId}"]`);
        const welcomeScreen = activeTabContent.querySelector('.welcome-screen');
        const proxyFrame = activeTabContent.querySelector('.proxy-frame');
        
        // Show welcome screen and hide iframe
        welcomeScreen.classList.remove('d-none');
        proxyFrame.classList.add('d-none');
        proxyFrame.src = '';
        
        // Reset tab data
        tabsData[activeTabId].url = '';
        urlInput.value = '';
        
        // Update tab title
        const tabElement = document.querySelector(`.chrome-tab[data-tab-id="${activeTabId}"]`);
        tabElement.querySelector('.chrome-tab-title').textContent = 'New Tab';
        
        // Update site info
        siteInfo.innerHTML = '<i class="fas fa-globe text-secondary"></i>';
    });
    
    // Search button click
    searchButton.addEventListener('click', function() {
        const query = urlInput.value.trim();
        if (query) {
            // If it looks like a URL, load it directly
            if (query.includes('.') && !query.includes(' ')) {
                loadUrl(query);
            } else {
                // Otherwise, treat as a search query
                loadUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            }
        }
    });
    
    // Chrome window controls simulation
    windowControls.forEach(control => {
        control.addEventListener('click', function() {
            if (control.classList.contains('minimize')) {
                // Simulate minimize
                document.body.classList.toggle('minimized');
            } else if (control.classList.contains('maximize')) {
                // Simulate maximize
                document.body.classList.toggle('maximized');
            } else if (control.classList.contains('close')) {
                // Simulate close by going to home
                window.location.href = '/';
            }
        });
    });
    
    // Bookmark click handlers
    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', function() {
            if (!this.classList.contains('more')) {
                const siteName = this.querySelector('span').textContent.toLowerCase();
                let domain;
                
                // Handle special cases
                switch (siteName) {
                    case 'google':
                        domain = 'google.com';
                        break;
                    case 'youtube':
                        domain = 'youtube.com';
                        break;
                    case 'github':
                        domain = 'github.com';
                        break;
                    case 'wikipedia':
                        domain = 'wikipedia.org';
                        break;
                    default:
                        domain = siteName + '.com';
                }
                
                loadUrl(domain);
            }
        });
    });
    
    // Set up event listeners for initial tabs
    const initialTab = document.querySelector('.chrome-tab');
    setupTabEventListeners(initialTab);
    
    const initialTabContent = document.querySelector('.tab-content');
    setupTabContentEventListeners(initialTabContent);
    
    // Set up global iframe load event handling
    document.addEventListener('DOMNodeInserted', function(e) {
        if (e.target.tagName === 'IFRAME' && e.target.classList.contains('proxy-frame')) {
            e.target.addEventListener('load', function() {
                loadingSpinner.classList.add('d-none');
                
                // Try to update tab title with page title from iframe
                try {
                    const frameTitle = this.contentDocument.title;
                    if (frameTitle) {
                        const tabElement = document.querySelector(`.chrome-tab[data-tab-id="${activeTabId}"]`);
                        tabElement.querySelector('.chrome-tab-title').textContent = frameTitle;
                    }
                } catch (e) {
                    // Silent fail on cross-origin issues
                }
            });
            
            e.target.addEventListener('error', function() {
                loadingSpinner.classList.add('d-none');
            });
        }
    });
    
    // Add load event handlers to existing iframes
    document.querySelectorAll('.proxy-frame').forEach(frame => {
        frame.addEventListener('load', function() {
            loadingSpinner.classList.add('d-none');
            
            // Try to update tab title with page title from iframe
            try {
                const frameTitle = this.contentDocument.title;
                if (frameTitle) {
                    const tabElement = document.querySelector(`.chrome-tab[data-tab-id="${activeTabId}"]`);
                    tabElement.querySelector('.chrome-tab-title').textContent = frameTitle;
                }
            } catch (e) {
                // Silent fail on cross-origin issues
            }
        });
        
        frame.addEventListener('error', function() {
            loadingSpinner.classList.add('d-none');
        });
    });
    
    // Focus on URL input when the page loads
    urlInput.focus();
    
    // Initialize buttons state
    updateNavButtons();
    
    // Fetch browsing history on startup
    fetchBrowsingHistory();
    
    // Fetch bookmarks on startup
    fetchBookmarks();
    
    // Add "active" class to URL bar on focus
    urlInput.addEventListener('focus', function() {
        document.querySelector('.chrome-url-bar').classList.add('active');
        // Select all text for easy replacement
        this.select();
    });
    
    urlInput.addEventListener('blur', function() {
        document.querySelector('.chrome-url-bar').classList.remove('active');
    });
    
    // Handle URL input changes to update the site info icon
    urlInput.addEventListener('input', function() {
        updateTabInfo(this.value);
    });
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+T to open a new tab
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            createNewTab();
        }
        
        // Ctrl+W to close current tab
        if (e.ctrlKey && e.key === 'w') {
            e.preventDefault();
            closeTab(activeTabId);
        }
        
        // Ctrl+H to show history
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            showHistory();
        }
        
        // Ctrl+D to add bookmark
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            addCurrentPageToBookmarks();
        }
        
        // Enter in URL bar to navigate (same as clicking Go button)
        if (e.key === 'Enter' && document.activeElement === urlInput) {
            e.preventDefault();
            loadUrl(urlInput.value.trim());
        }
    });
    
    // Initialize the first tab with the shortcuts event listeners
    shortcuts.forEach(shortcut => {
        shortcut.addEventListener('click', function() {
            const url = this.dataset.url;
            if (url) {
                loadUrl(url);
            }
        });
    });
    
    // Function to fetch browsing history
    function fetchBrowsingHistory() {
        fetch('/history')
            .then(response => response.json())
            .then(data => {
                console.log('History loaded:', data);
                // Store history data for later use
                browserHistory = data;
            })
            .catch(error => {
                console.error('Error fetching history:', error);
            });
    }
    
    // Function to fetch bookmarks
    function fetchBookmarks() {
        fetch('/bookmarks')
            .then(response => response.json())
            .then(data => {
                console.log('Bookmarks loaded:', data);
                // Update bookmarks UI
                updateBookmarksUI(data);
            })
            .catch(error => {
                console.error('Error fetching bookmarks:', error);
            });
    }
    
    // Function to update the bookmarks UI
    function updateBookmarksUI(bookmarks) {
        const bookmarksContainer = document.querySelector('.chrome-bookmarks');
        if (!bookmarksContainer) return;
        
        // Clear existing bookmarks
        bookmarksContainer.innerHTML = '';
        
        // Add bookmarks to the bar
        bookmarks.forEach(bookmark => {
            const bookmarkElement = document.createElement('div');
            bookmarkElement.className = 'chrome-bookmark';
            bookmarkElement.dataset.url = bookmark.url;
            
            // Create bookmark icon
            let icon = '';
            if (bookmark.favicon) {
                icon = `<img src="${bookmark.favicon}" alt="${bookmark.title}" class="bookmark-icon">`;
            } else {
                icon = '<i class="fas fa-bookmark"></i>';
            }
            
            bookmarkElement.innerHTML = `
                ${icon}
                <span>${bookmark.title}</span>
            `;
            
            // Add click event to load the bookmark
            bookmarkElement.addEventListener('click', function() {
                loadUrl(this.dataset.url);
            });
            
            bookmarksContainer.appendChild(bookmarkElement);
        });
    }
    
    // Function to add current page to bookmarks
    function addCurrentPageToBookmarks() {
        const tabData = tabsData[activeTabId];
        if (!tabData || !tabData.url) return;
        
        const url = tabData.url;
        const title = document.querySelector('.chrome-tab-title').textContent || url;
        
        // Create bookmark data
        const bookmarkData = {
            url: url,
            title: title,
            favicon: '',
            category: 'General'
        };
        
        // Send request to add bookmark
        fetch('/bookmarks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookmarkData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Bookmark added:', data);
            // Reload bookmarks
            fetchBookmarks();
        })
        .catch(error => {
            console.error('Error adding bookmark:', error);
        });
    }
    
    // Function to show history in a modal
    function showHistory() {
        // Create a modal to display history
        const historyModal = document.createElement('div');
        historyModal.className = 'chrome-modal';
        historyModal.innerHTML = `
            <div class="chrome-modal-content">
                <div class="chrome-modal-header">
                    <h2>Browsing History</h2>
                    <button class="chrome-modal-close">&times;</button>
                </div>
                <div class="chrome-modal-body">
                    <div class="chrome-history-list">
                        ${renderHistoryList()}
                    </div>
                </div>
            </div>
        `;
        
        // Add close button functionality
        document.body.appendChild(historyModal);
        historyModal.querySelector('.chrome-modal-close').addEventListener('click', function() {
            historyModal.remove();
        });
        
        // Add click events to history items
        historyModal.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', function() {
                loadUrl(this.dataset.url);
                historyModal.remove();
            });
        });
    }
    
    // Function to render the history list HTML
    function renderHistoryList() {
        if (!browserHistory || browserHistory.length === 0) {
            return '<div class="empty-history">No browsing history yet.</div>';
        }
        
        return browserHistory.map(entry => {
            const date = new Date(entry.visit_time);
            const formattedDate = date.toLocaleString();
            
            return `
                <div class="history-item" data-url="${entry.url}">
                    <div class="history-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <div class="history-details">
                        <div class="history-title">${entry.title}</div>
                        <div class="history-url">${entry.url}</div>
                        <div class="history-time">${formattedDate}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
});
