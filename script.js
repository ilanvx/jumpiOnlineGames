// Minimal placeholder for future interactions (e.g., search or filters)
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search input');
  if (searchInput) {
    searchInput.addEventListener('focus', () => {
      searchInput.parentElement?.classList.add('focus');
    });
    searchInput.addEventListener('blur', () => {
      searchInput.parentElement?.classList.remove('focus');
    });
  }
});

// Cursor-following tooltip for header icons
document.addEventListener('DOMContentLoaded', () => {
  const tooltip = document.getElementById('tooltip');
  const targets = document.querySelectorAll('.topbar [data-tip]');
  if (!tooltip || !targets.length) return;

  let active = null;
  const move = (e) => {
    tooltip.style.left = `${e.clientX}px`;
    tooltip.style.top = `${e.clientY}px`;
  };

  targets.forEach((el) => {
    el.addEventListener('mouseenter', (e) => {
      const text = el.getAttribute('data-tip') || '';
      tooltip.textContent = text;
      tooltip.classList.add('show');
      tooltip.setAttribute('aria-hidden', 'false');
      active = el;
    });
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', () => {
      tooltip.classList.remove('show');
      tooltip.setAttribute('aria-hidden', 'true');
      active = null;
    });
  });
});

// Navigate to dedicated game page from grid cards
document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.grid .card');
  if (!cards.length) return;

  cards.forEach((card) => {
    const link = card.querySelector('.card-link');
    const src = card.getAttribute('data-game-src');
    const title = card.getAttribute('data-title') || 'משחק';
    const promoImg = card.getAttribute('data-img');
    const videoSrc = card.getAttribute('data-video');
    
    if (link) {
      const gameSlug = card.getAttribute('data-game-slug');
      // Use clean URL with slug only if available
      if (gameSlug) {
        link.setAttribute('href', `/game/${encodeURIComponent(gameSlug)}`);
      } else if (src) {
        // Fallback to old URL format if no slug
        const url = new URL('game.html', window.location.href);
        url.searchParams.set('src', src);
        url.searchParams.set('title', title);
        if (promoImg) {
          url.searchParams.set('img', promoImg);
        }
        link.setAttribute('href', url.toString());
      }
    }

    // If data-img exists, use it as the card image
    if (promoImg && link) {
      const img = link.querySelector('img');
      if (img) {
        img.src = promoImg;
        img.alt = title;
      }
    }

    // Setup video hover effect
    if (videoSrc && link) {
      let video = link.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.preload = 'metadata';
        link.appendChild(video);
      }
      video.src = videoSrc;

      // Play video on hover, pause on leave
      card.addEventListener('mouseenter', () => {
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      });
      card.addEventListener('mouseleave', () => {
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
      });
    }
  });
});

// Check user authentication status and update header
document.addEventListener('DOMContentLoaded', async () => {
  const loginBtn = document.getElementById('loginBtn');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  const userDropdown = document.getElementById('userDropdown');
  const adminLink = document.getElementById('adminLink');

  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';

  try {
    const response = await fetch(`${API_URL}/api/user`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const user = await response.json();
      if (user) {
        // Check if user is logged in but not registered
        if (!user.registered || !user.username) {
          // Redirect to registration page
          window.location.href = '/login.html';
          return;
        }
        
        if (loginBtn) loginBtn.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userName) {
          userName.textContent = user.username || user.name || 'משתמש';
        }
        if (adminLink && user.role === 'admin') {
          adminLink.style.display = 'block';
        }
        // Show chat button for registered users
        const chatBtn = document.getElementById('chatBtn');
        if (chatBtn) {
          chatBtn.style.display = 'inline-flex';
        }
        
        // Update diamonds display
        updateDiamondsDisplay(user.diamonds || 0);
        
        // Load notifications
        loadNotifications();
        checkUnreadNotifications();
        
        // Check daily bonus status
        checkDailyBonusStatus();
        
        // Show tasks button
        const tasksBtn = document.getElementById('tasksBtn');
        if (tasksBtn) {
          tasksBtn.style.display = 'inline-flex';
        }
        
        localStorage.setItem('jumpiUser', JSON.stringify(user));
        return;
      }
    }
  } catch (error) {
    console.error('Error checking auth:', error);
    // Fallback to localStorage if API is not available
    const userData = localStorage.getItem('jumpiUser');
    if (userData) {
      const user = JSON.parse(userData);
      // Check if user is logged in but not registered
      if (!user.registered || !user.username) {
        // Redirect to registration page
        window.location.href = '/login.html';
        return;
      }
      
      if (loginBtn) loginBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'block';
      if (userName) {
        userName.textContent = user.username || user.name || 'משתמש';
      }
      if (adminLink && user.role === 'admin') {
        adminLink.style.display = 'block';
      }
      // Show chat button, favorites button, and tasks button for registered users
      const chatBtn = document.getElementById('chatBtn');
      if (chatBtn) {
        chatBtn.style.display = 'inline-flex';
      }
      const favoritesBtn = document.getElementById('favoritesBtn');
      if (favoritesBtn) {
        favoritesBtn.style.display = 'inline-flex';
      }
      const tasksBtn = document.getElementById('tasksBtn');
      if (tasksBtn) {
        tasksBtn.style.display = 'inline-flex';
      }
      
      // Update diamonds display
      updateDiamondsDisplay(user.diamonds || 0);
      
      // Load notifications
      loadNotifications();
      checkUnreadNotifications();
      
      // Check daily bonus status
      checkDailyBonusStatus();
      
      return;
    }
  }

  if (loginBtn) loginBtn.style.display = 'block';
  if (userMenu) userMenu.style.display = 'none';
});

// Global pagination state
let currentPage = 1;
let isLoadingGames = false;
let currentCategory = 'all';
let abortController = null; // For canceling previous requests
let loadGamesTimeout = null; // For debouncing
let lastRequestTime = 0; // Track last request time to prevent rate limiting
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests

// Category icon mapping
const categoryIcons = {
  'action': 'fa-solid fa-fire',
  'adventure': 'fa-solid fa-mountain',
  'arcade': 'fa-solid fa-gamepad',
  'board': 'fa-solid fa-chess',
  'card': 'fa-solid fa-cards',
  'casual': 'fa-regular fa-face-smile',
  'educational': 'fa-solid fa-graduation-cap',
  'puzzle': 'fa-solid fa-puzzle-piece',
  'racing': 'fa-solid fa-car',
  'rpg': 'fa-solid fa-dice-d20',
  'shooter': 'fa-solid fa-crosshairs',
  'simulation': 'fa-solid fa-building',
  'sports': 'fa-solid fa-futbol',
  'strategy': 'fa-solid fa-chess-king',
  'trivia': 'fa-solid fa-lightbulb',
  'word': 'fa-solid fa-font',
  'multiplayer': 'fa-solid fa-users',
  '2 player': 'fa-solid fa-user-group',
  '2 player games': 'fa-solid fa-user-group',
  'cooking': 'fa-solid fa-utensils',
  'girls': 'fa-solid fa-heart',
  'kids': 'fa-solid fa-child',
  'hypercasual': 'fa-solid fa-mobile-screen',
  'clicker': 'fa-solid fa-hand-pointer',
  'bejeweled': 'fa-solid fa-gem',
  'shooting': 'fa-solid fa-crosshairs',
  'default': 'fa-solid fa-gamepad'
};

// Get icon for category
function getCategoryIcon(category) {
  if (!category) return categoryIcons.default;
  const categoryLower = category.toLowerCase();
  
  // Check exact match first
  if (categoryIcons[categoryLower]) {
    return categoryIcons[categoryLower];
  }
  
  // Check partial matches
  if (categoryLower.includes('action')) return categoryIcons.action;
  if (categoryLower.includes('adventure')) return categoryIcons.adventure;
  if (categoryLower.includes('arcade')) return categoryIcons.arcade;
  if (categoryLower.includes('board')) return categoryIcons.board;
  if (categoryLower.includes('card')) return categoryIcons.card;
  if (categoryLower.includes('casual')) return categoryIcons.casual;
  if (categoryLower.includes('education')) return categoryIcons.educational;
  if (categoryLower.includes('puzzle')) return categoryIcons.puzzle;
  if (categoryLower.includes('race') || categoryLower.includes('drive')) return categoryIcons.racing;
  if (categoryLower.includes('rpg')) return categoryIcons.rpg;
  if (categoryLower.includes('shoot')) return categoryIcons.shooter;
  if (categoryLower.includes('simulat')) return categoryIcons.simulation;
  if (categoryLower.includes('sport')) return categoryIcons.sports;
  if (categoryLower.includes('strateg')) return categoryIcons.strategy;
  if (categoryLower.includes('trivia')) return categoryIcons.trivia;
  if (categoryLower.includes('word')) return categoryIcons.word;
  if (categoryLower.includes('multiplayer')) return categoryIcons.multiplayer;
  if (categoryLower.includes('2 player') || categoryLower.includes('two player')) return categoryIcons['2 player'];
  if (categoryLower.includes('cooking')) return categoryIcons.cooking;
  if (categoryLower.includes('girl')) return categoryIcons.girls;
  if (categoryLower.includes('kid')) return categoryIcons.kids;
  if (categoryLower.includes('hypercasual')) return categoryIcons.hypercasual;
  if (categoryLower.includes('clicker')) return categoryIcons.clicker;
  if (categoryLower.includes('bejeweled')) return categoryIcons.bejeweled;
  
  return categoryIcons.default;
}

// Load games from GameMonetize API with pagination
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize breadcrumb
  updateBreadcrumb([
    { label: 'עמוד הבית', href: '/' }
  ]);
  
  // Get page and category from URL params
  const urlParams = new URLSearchParams(window.location.search);
  currentPage = parseInt(urlParams.get('page')) || 1;
  currentCategory = urlParams.get('category') || 'all';
  
  // Load categories first
  await loadCategories();
  
  // Then load games
  await loadGames(currentPage, currentCategory);
});

// Load categories and populate sidebar
async function loadCategories() {
  const sidebar = document.getElementById('categoriesSidebar');
  if (!sidebar) return;

  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';

  try {
    const response = await fetch(`${API_URL}/api/categories`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      let categories = await response.json();
      
      // Add special categories that might not be in the API response
      const specialCategories = ['Multiplayer', '2 Player Games'];
      specialCategories.forEach(cat => {
        if (!categories.includes(cat)) {
          categories.push(cat);
        }
      });
      
      // Sort categories alphabetically
      categories.sort();
      
      // Clear existing category buttons (except "all")
      const existingButtons = sidebar.querySelectorAll('.side-btn[data-category]:not([data-category="all"])');
      existingButtons.forEach(btn => btn.remove());
      
      // Add category buttons
      categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'side-btn';
        btn.setAttribute('data-category', category);
        btn.setAttribute('title', category);
        
        const icon = document.createElement('i');
        icon.className = getCategoryIcon(category);
        btn.appendChild(icon);
        
        const label = document.createElement('span');
        label.className = 'side-btn-label';
        label.textContent = category;
        btn.appendChild(label);
        
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectCategory(category);
          // Keep sidebar expanded after click
          sidebar.classList.add('expanded');
        });
        
        // Insert after "all" button
        const allBtn = sidebar.querySelector('[data-category="all"]');
        if (allBtn && allBtn.nextSibling) {
          sidebar.insertBefore(btn, allBtn.nextSibling);
        } else {
          sidebar.appendChild(btn);
        }
      });
      
      // Add click handler to "all" button
      const allBtn = sidebar.querySelector('[data-category="all"]');
      if (allBtn) {
        allBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectCategory('all');
          // Keep sidebar expanded after click
          sidebar.classList.add('expanded');
        });
      }
      
      // Click outside to close expanded sidebar
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('expanded')) {
          sidebar.classList.remove('expanded');
        }
      });
      
      // Set active category
      updateActiveCategory();
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

// Select category with debouncing and rate limiting protection
function selectCategory(category) {
  // Cancel any pending loadGames calls
  if (loadGamesTimeout) {
    clearTimeout(loadGamesTimeout);
    loadGamesTimeout = null;
  }
  
  // Cancel any ongoing requests immediately
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  // Set loading state to prevent new requests
  isLoadingGames = true;
  
  currentCategory = category;
  currentPage = 1; // Reset to first page when changing category
  
  // Update URL
  const url = new URL(window.location.href);
  if (category === 'all') {
    url.searchParams.delete('category');
  } else {
    url.searchParams.set('category', category);
  }
  url.searchParams.set('page', '1');
  window.history.pushState({ page: 1, category }, '', url);
  
  // Update active button immediately (visual feedback)
  updateActiveCategory();
  
  // Calculate delay based on last request time
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  const delay = Math.max(600, MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  
  // Debounce loadGames - wait at least 600ms before loading
  loadGamesTimeout = setTimeout(() => {
    loadGames(currentPage, currentCategory);
    loadGamesTimeout = null;
  }, delay);
}

// Update active category button
function updateActiveCategory() {
  const sidebar = document.getElementById('categoriesSidebar');
  if (!sidebar) return;
  
  const buttons = sidebar.querySelectorAll('.side-btn[data-category]');
  buttons.forEach(btn => {
    const btnCategory = btn.getAttribute('data-category');
    if (btnCategory === currentCategory) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Function to load games with pagination and category filter
async function loadGames(page = 1, category = 'all') {
  const gamesGrid = document.getElementById('gamesGrid');
  if (!gamesGrid) {
    isLoadingGames = false;
    return;
  }
  
  // Check rate limiting - don't make requests too frequently
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && lastRequestTime > 0) {
    // Wait a bit before making the request
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  // Cancel any previous request IMMEDIATELY
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  
  // Create new AbortController for this request
  abortController = new AbortController();
  const signal = abortController.signal;
  
  // Update last request time
  lastRequestTime = Date.now();
  
  isLoadingGames = true;
  currentPage = page;
  currentCategory = category;
  
  // Update URL without reload
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);
  if (category && category !== 'all') {
    url.searchParams.set('category', category);
  } else {
    url.searchParams.delete('category');
  }
  window.history.pushState({ page, category }, '', url);
  
  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';
  
  // Show loading state
  gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">טוען משחקים...</div>';

  try {
    // Check if request was aborted BEFORE making any requests
    if (signal.aborted) {
      isLoadingGames = false;
      return;
    }
    
    // Fetch directly from GameMonetize API (CORS should allow this)
    let apiUrl = `https://gamemonetize.com/feed.php?format=0&page=${page}`;
    
    // Try to fetch directly from GameMonetize first
    let games = [];
    let useServer = false;
    
    try {
      const directResponse = await fetch(apiUrl, { 
        signal,
        cache: 'no-cache' // Prevent caching issues
      });
      
      // Check if aborted after fetch
      if (signal.aborted) {
        isLoadingGames = false;
        return;
      }
      
      if (directResponse.ok) {
        games = await directResponse.json();
      } else if (directResponse.status === 429) {
        // Rate limited - wait and try server
        console.log('Rate limited on direct fetch, waiting...');
        useServer = true;
      }
    } catch (directError) {
      // Check if aborted
      if (signal.aborted || directError.name === 'AbortError') {
        isLoadingGames = false;
        return;
      }
      // If it's a network error, try server
      if (directError.name !== 'AbortError') {
        console.log('Direct fetch failed, trying through server:', directError.message);
        useServer = true;
      }
    }
    
    // If we need to use server or got rate limited
    if (useServer || (games.length === 0 && !signal.aborted)) {
      // Wait a bit before trying server to avoid rate limiting
      if (useServer) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Check again if aborted
      if (signal.aborted) {
        isLoadingGames = false;
        return;
      }
      
      apiUrl = `${API_URL}/api/games?page=${page}`;
      if (category && category !== 'all') {
        apiUrl += `&category=${encodeURIComponent(category)}`;
      }
      
      try {
        const response = await fetch(apiUrl, {
          credentials: 'include',
          signal,
          cache: 'no-cache'
        });
        
        if (signal.aborted) {
          isLoadingGames = false;
          return;
        }
        
        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - show message and wait
            gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">יותר מדי בקשות, נא להמתין רגע...</div>';
            isLoadingGames = false;
            // Retry after 2 seconds
            setTimeout(() => {
              if (!signal.aborted) {
                loadGames(page, category);
              }
            }, 2000);
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        games = await response.json();
      } catch (serverError) {
        if (signal.aborted || serverError.name === 'AbortError') {
          isLoadingGames = false;
          return;
        }
        throw serverError;
      }
    }
    
    // Final check if request was aborted after all fetches
    if (signal.aborted) {
      isLoadingGames = false;
      return;
    }
    
    // If we got games from direct fetch, filter by category if needed
    if (category && category !== 'all' && games.length > 0) {
      games = games.filter(game => {
        const gameCategory = game.category || game.Category || '';
        const gameTags = (game.tags || game.Tags || '').toLowerCase();
        
        // Special handling for Multiplayer and 2 Player Games
        if (category.toLowerCase() === 'multiplayer') {
          return gameTags.includes('multiplayer') || gameTags.includes('online') || gameCategory.toLowerCase().includes('multiplayer');
        }
        if (category.toLowerCase() === '2 player games' || category.toLowerCase() === '2 player') {
          return gameTags.includes('2 player') || gameTags.includes('two player') || gameCategory.toLowerCase().includes('2 player');
        }
        
        // Regular category matching
        return gameCategory && gameCategory.toLowerCase() === category.toLowerCase();
      });
    }
    
    // Format games for display
    if (games && games.length > 0) {
      games = games.map(game => {
        if (!game || typeof game !== 'object') {
          return null;
        }
        
        return {
          id: game.id || game.game_id || game.ID || '',
          title: game.title || game.Title || '',
          description: game.description || game.Description || '',
          instructions: game.instructions || game.Instructions || '',
          url: game.url || game.game_url || game.URL || game.link || '',
          embedUrl: game.url || game.game_url || game.URL || game.link || '',
          gameSlug: (game.id || game.game_id || game.ID || game.title || game.Title || '').toString(),
          category: game.category || game.Category || '',
          tags: game.tags || game.Tags || '',
          thumb: game.thumb || game.thumbnail || game.Thumb || game.image || '',
          width: game.width || game.Width || '800',
          height: game.height || game.Height || '600',
          featured: false,
          order: 0,
          active: true,
          isFavorite: game.isFavorite || false // Preserve isFavorite if already set
        };
      }).filter(game => game !== null);
    }
    
    // Check if user is logged in and load favorites to mark games
    const userData = localStorage.getItem('jumpiUser');
    if (userData && games && games.length > 0) {
      try {
        const favoritesResponse = await fetch(`${API_URL}/api/favorites`, {
          credentials: 'include'
        });
        if (favoritesResponse.ok) {
          const favorites = await favoritesResponse.json();
          // Create a set of all favorite IDs (both MongoDB _id and GameMonetize id)
          const favoriteIds = new Set();
          favorites.forEach(fav => {
            if (fav.id) favoriteIds.add(fav.id.toString());
            if (fav._id) favoriteIds.add(fav._id.toString());
          });
          // Mark games as favorites - check both id and _id
          games.forEach(game => {
            const gameId = (game.id || game._id || '').toString();
            if (gameId && favoriteIds.has(gameId)) {
              game.isFavorite = true;
            }
          });
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
        // Continue even if favorites fail to load
      }
    }
    
    if (games && games.length > 0) {
      allGames = games; // Store for favorites toggle
      gamesGrid.innerHTML = '';

      games.forEach((game, index) => {
        const card = document.createElement('article');
        card.className = 'card';
        if (game.featured) {
          card.classList.add('featured');
        }
        
        // Use url if available, otherwise fallback to embedUrl for backward compatibility
        const gameUrl = game.url || game.embedUrl || '';
        card.setAttribute('data-game-src', gameUrl);
        card.setAttribute('data-title', game.title);
        const gameSlug = game.gameSlug || game.id || '';
        card.setAttribute('data-game-slug', gameSlug);

        const link = document.createElement('a');
        link.className = 'card-link';
        
        // Set link href based on gameSlug
        if (gameSlug) {
          link.href = `/game/${encodeURIComponent(gameSlug)}`;
        } else {
        link.href = '#';
        }

        // Use thumbnail from GameMonetize
        const thumbnail = game.thumb || game.thumbnail || '';
        
        if (thumbnail) {
          // Use GameMonetize thumbnail
          const img = document.createElement('img');
          img.src = thumbnail;
          img.alt = game.title;
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease;';
          img.onerror = () => {
            // Use data URI as fallback since via.placeholder.com might not be available
            img.src = createPlaceholderImage(400, 300, game.title);
          };
          link.appendChild(img);
        } else if (game.gameSlug) {
          // Fallback to local images if available (for backward compatibility with old games)
          const imgContainer = document.createElement('div');
          imgContainer.className = 'img-carousel';
          imgContainer.style.cssText = 'position: relative; width: 100%; height: 100%;';
          
            const img = document.createElement('img');
          img.src = `/Games/${game.gameSlug}/image1.jpg`;
          img.alt = game.title;
            img.className = 'carousel-img';
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            img.onerror = () => {
              // Use data URI as fallback since via.placeholder.com might not be available
              img.src = createPlaceholderImage(400, 300, game.title);
            };
            imgContainer.appendChild(img);
          link.appendChild(imgContainer);
        } else {
          // Fallback placeholder using data URI
          const img = document.createElement('img');
          img.src = createPlaceholderImage(400, 300, game.title);
          img.alt = game.title;
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
          link.appendChild(img);
        }

        // Add Play Now overlay button
        const playOverlay = document.createElement('div');
        playOverlay.className = 'play-overlay';
        playOverlay.innerHTML = '<div class="play-button"><i class="fa-solid fa-play"></i> Play Now</div>';
        playOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 5;
          pointer-events: none;
        `;
        
        const playButton = playOverlay.querySelector('.play-button');
        playButton.style.cssText = `
          background: linear-gradient(180deg, var(--pill-1), var(--pill-2));
          color: #2b1b5f;
          padding: 14px 28px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          transform: scale(0.9);
          transition: transform 0.3s ease;
        `;
        
        card.addEventListener('mouseenter', () => {
          playOverlay.style.opacity = '1';
          playButton.style.transform = 'scale(1)';
          // Scale image on hover
          const img = link.querySelector('img');
          if (img) {
            img.style.transform = 'scale(1.08)';
          }
        });
        
        card.addEventListener('mouseleave', () => {
          playOverlay.style.opacity = '0';
          playButton.style.transform = 'scale(0.9)';
          // Reset image scale
          const img = link.querySelector('img');
          if (img) {
            img.style.transform = 'scale(1)';
          }
        });
        
        card.appendChild(playOverlay);

        // Add favorite button for logged in users
        const userData = localStorage.getItem('jumpiUser');
        if (userData) {
          const favoriteBtn = document.createElement('button');
          favoriteBtn.className = 'favorite-btn';
          if (game.isFavorite) {
            favoriteBtn.classList.add('active');
            favoriteBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
          } else {
            favoriteBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
          }
          // Use game.id for GameMonetize games, game._id for MongoDB games
          const gameId = game.id || game._id || '';
          favoriteBtn.setAttribute('data-game-id', gameId);
          favoriteBtn.setAttribute('aria-label', 'הוסף למועדפים');
          favoriteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const gameImage = game.thumb || game.thumbnail || createPlaceholderImage(300, 200, game.title);
            const wasFavorite = favoriteBtn.classList.contains('active');
            // Pass game data for GameMonetize games
            const gameDataForFavorite = game.id ? {
              id: game.id,
              title: game.title,
              description: game.description,
              instructions: game.instructions,
              url: game.url,
              embedUrl: game.embedUrl,
              gameSlug: game.gameSlug,
              category: game.category,
              tags: game.tags,
              thumb: game.thumb,
              width: game.width,
              height: game.height
            } : null;
            await toggleFavorite(gameId, favoriteBtn, game.title, gameImage, gameDataForFavorite);
          });
          card.appendChild(favoriteBtn);
        }

        if (game.featured) {
          const badge = document.createElement('span');
          badge.className = 'badge hot';
          badge.innerHTML = '<i class="fa-solid fa-fire"></i> Hot';
          card.appendChild(badge);
        }

        card.appendChild(link);
        gamesGrid.appendChild(card);
      });

      // Add pagination controls
      addPaginationControls(gamesGrid, page);
      
      // Scroll to top of content area smoothly
      const contentArea = document.querySelector('.content');
      if (contentArea) {
        contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      isLoadingGames = false;
    } else {
      gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">אין משחקים זמינים כרגע</div>';
      isLoadingGames = false;
    }
    
    return; // Exit early if we got games
  } catch (error) {
    // Don't show error if request was aborted
    if (error.name === 'AbortError' || abortController?.signal.aborted) {
      isLoadingGames = false;
      return;
    }
    console.error('Error loading games:', error);
    gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">שגיאה בטעינת המשחקים</div>';
    isLoadingGames = false;
  } finally {
    // Reset abort controller if this was the last request
    if (!signal.aborted) {
      abortController = null;
    }
  }
}

// Add pagination controls
function addPaginationControls(container, currentPageNum) {
  // Remove existing pagination if any
  const existingPagination = container.querySelector('.pagination-container');
  if (existingPagination) {
    existingPagination.remove();
  }
  
  const paginationContainer = document.createElement('div');
  paginationContainer.className = 'pagination-container';
  paginationContainer.style.cssText = `
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 30px 20px;
    margin-top: 20px;
  `;
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn pill-blue pagination-btn';
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i> הקודם';
  prevBtn.disabled = currentPageNum <= 1;
  prevBtn.style.cssText = `
    padding: 12px 24px;
    border-radius: 999px;
    border: 0;
    cursor: pointer;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  `;
  
  if (prevBtn.disabled) {
    prevBtn.style.opacity = '0.5';
    prevBtn.style.cursor = 'not-allowed';
  }
  
  const pageInfo = document.createElement('span');
  pageInfo.className = 'pagination-info';
  pageInfo.textContent = `עמוד ${currentPageNum}`;
  pageInfo.style.cssText = `
    color: var(--text);
    font-weight: 700;
    font-size: 16px;
    padding: 0 20px;
  `;
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn pill-blue pagination-btn';
  nextBtn.innerHTML = 'הבא <i class="fa-solid fa-chevron-left"></i>';
  nextBtn.style.cssText = `
    padding: 12px 24px;
    border-radius: 999px;
    border: 0;
    cursor: pointer;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  `;
  
  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentPageNum > 1 && !prevBtn.disabled && !isLoadingGames) {
      // Cancel any pending requests
      if (abortController) {
        abortController.abort();
      }
      if (loadGamesTimeout) {
        clearTimeout(loadGamesTimeout);
        loadGamesTimeout = null;
      }
      loadGames(currentPageNum - 1, currentCategory);
    }
  });
  
  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoadingGames) {
      // Cancel any pending requests
      if (abortController) {
        abortController.abort();
      }
      if (loadGamesTimeout) {
        clearTimeout(loadGamesTimeout);
        loadGamesTimeout = null;
      }
      loadGames(currentPageNum + 1, currentCategory);
    }
  });
  
  // Add hover effects
  prevBtn.addEventListener('mouseenter', () => {
    if (!prevBtn.disabled) {
      prevBtn.style.transform = 'translateX(-2px)';
    }
  });
  prevBtn.addEventListener('mouseleave', () => {
    prevBtn.style.transform = 'translateX(0)';
  });
  
  nextBtn.addEventListener('mouseenter', () => {
    nextBtn.style.transform = 'translateX(2px)';
  });
  nextBtn.addEventListener('mouseleave', () => {
    nextBtn.style.transform = 'translateX(0)';
  });
  
  paginationContainer.appendChild(prevBtn);
  paginationContainer.appendChild(pageInfo);
  paginationContainer.appendChild(nextBtn);
  
  container.appendChild(paginationContainer);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get('page')) || 1;
  const category = urlParams.get('category') || 'all';
  
  currentPage = page;
  currentCategory = category;
  updateActiveCategory();
  
  if (event.state && event.state.page) {
    loadGames(event.state.page, event.state.category || 'all');
  } else {
    loadGames(page, category);
  }
});

// Toggle user menu dropdown
function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  }
}

// Utility function for escaping HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Create a data URI placeholder image
function createPlaceholderImage(width = 400, height = 300, text = '') {
  // Create an SVG with the text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1a1a2e"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#fff" text-anchor="middle" dominant-baseline="middle">
        ${escapeHtml(text || 'Game')}
      </text>
    </svg>
  `.trim();
  
  // Convert to data URI
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Toggle favorite
// Show confirmation modal for removing favorite
function showRemoveFavoriteConfirm(gameTitle, gameImage, onConfirm) {
  const existing = document.getElementById('confirmModal');
  if (existing) {
    existing.remove();
  }
  
  // Generate fallback placeholder URL
  const fallbackImage = createPlaceholderImage(300, 200, gameTitle);
  
  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.className = 'alert-modal';
  modal.innerHTML = `
    <div class="alert-modal-content" style="max-width: 500px;">
      <div class="alert-modal-icon warning">⚠</div>
      <div style="margin: 16px 0;">
        <img src="${gameImage}" alt="${escapeHtml(gameTitle)}" style="width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 12px; margin: 0 auto; display: block;" onerror="this.src='${fallbackImage}'" />
      </div>
      <div class="alert-modal-title">האם אתה בטוח?</div>
      <div class="alert-modal-message">האם אתה בטוח שברצונך להסיר את <strong>${escapeHtml(gameTitle)}</strong> מתוך רשימת המועדפים?</div>
      <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: center;">
        <button class="alert-modal-button" onclick="closeConfirmModal()" style="background: var(--panel-2); color: var(--text);">ביטול</button>
        <button class="alert-modal-button error" onclick="confirmRemoveFavorite()" style="background: #ff6b7a; color: white;">הסר</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Store confirm callback
  window._pendingFavoriteConfirm = onConfirm;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeConfirmModal();
    }
  });
  
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      modal.remove();
    }, 200);
  }
  window._pendingFavoriteConfirm = null;
}

function confirmRemoveFavorite() {
  if (window._pendingFavoriteConfirm) {
    window._pendingFavoriteConfirm();
    closeConfirmModal();
  }
}

// Show success modal for adding favorite
function showFavoriteSuccess(gameTitle, gameImage) {
  const existing = document.getElementById('successModal');
  if (existing) {
    existing.remove();
  }
  
  // Generate fallback placeholder URL
  const fallbackImage = createPlaceholderImage(300, 200, gameTitle);
  
  const modal = document.createElement('div');
  modal.id = 'successModal';
  modal.className = 'alert-modal';
  modal.innerHTML = `
    <div class="alert-modal-content" style="max-width: 500px;">
      <div class="alert-modal-icon success">✓</div>
      <div style="margin: 16px 0;">
        <img src="${gameImage}" alt="${escapeHtml(gameTitle)}" style="width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 12px; margin: 0 auto; display: block;" onerror="this.src='${fallbackImage}'" />
      </div>
      <div class="alert-modal-title">המשחק נוסף למועדפים בהצלחה!</div>
      <div class="alert-modal-message"><strong>${escapeHtml(gameTitle)}</strong> נוסף לרשימת המועדפים שלך</div>
      <button class="alert-modal-button success" onclick="closeSuccessModal()" style="background: #4caf50; color: white; margin-top: 20px;">אישור</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSuccessModal();
    }
  });
  
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeSuccessModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Auto close after 3 seconds
  setTimeout(() => {
    closeSuccessModal();
  }, 3000);
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      modal.remove();
    }, 200);
  }
}

async function toggleFavorite(gameId, buttonElement, gameTitle, gameImage, gameData = null) {
  if (!buttonElement || !gameId) {
    console.warn('toggleFavorite: Missing buttonElement or gameId', { buttonElement, gameId });
    return;
  }
  
  // Disable button during request to prevent double-clicks
  const wasDisabled = buttonElement.disabled;
  buttonElement.disabled = true;
  
  const isFavorite = buttonElement.classList.contains('active');
  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';
  
  try {
    if (isFavorite) {
      // Re-enable button before showing modal (modal is async)
      buttonElement.disabled = wasDisabled;
      
      // Show confirmation modal for removal
      showRemoveFavoriteConfirm(gameTitle, gameImage, async () => {
        // Disable button during deletion
        buttonElement.disabled = true;
        
        try {
          const response = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(gameId)}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          
          if (response.ok) {
            buttonElement.classList.remove('active');
            buttonElement.innerHTML = '<i class="fa-regular fa-heart"></i>';
            buttonElement.setAttribute('aria-label', 'הוסף למועדפים');
            
            // Update the game's isFavorite status in allGames array
            if (allGames && allGames.length > 0) {
              const gameToUpdate = allGames.find(g => (g.id || g._id || '').toString() === gameId.toString());
              if (gameToUpdate) {
                gameToUpdate.isFavorite = false;
              }
            }
          } else {
            console.error('Failed to remove favorite:', response.status);
          }
        } catch (error) {
          console.error('Error removing favorite:', error);
        } finally {
          // Re-enable button
          buttonElement.disabled = wasDisabled;
        }
      });
      
      // Return early since we're showing a modal
      return;
    } else {
      // Add to favorites
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      };
      
      // For GameMonetize games, include game data
      if (gameData) {
        options.body = JSON.stringify({ gameData });
      }
      
      const response = await fetch(`${API_URL}/api/favorites/${encodeURIComponent(gameId)}`, options);
      
      if (response.ok) {
        // Update button state immediately
        buttonElement.classList.add('active');
        buttonElement.innerHTML = '<i class="fa-solid fa-heart"></i>';
        buttonElement.setAttribute('aria-label', 'הסר ממועדפים');
        
        // Update the game's isFavorite status in allGames array
        if (allGames && allGames.length > 0) {
          const gameToUpdate = allGames.find(g => {
            const gId = (g.id || g._id || '').toString();
            return gId === gameId.toString();
          });
          if (gameToUpdate) {
            gameToUpdate.isFavorite = true;
          }
        }
        
        showFavoriteSuccess(gameTitle, gameImage);
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to add favorite:', response.status, errorData);
        
        // Don't update button state on error
        if (response.status === 401) {
          showModalAlert('התחברות נדרשת', 'אתה צריך להתחבר כדי להוסיף מועדפים', 'warning');
        } else if (response.status === 400) {
          // Might be duplicate - check if already favorited
          console.log('Game might already be favorited');
        }
      }
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    // Don't update button state on error
  } finally {
    // Re-enable button
    buttonElement.disabled = wasDisabled;
  }
}

// Update breadcrumb
function updateBreadcrumb(items) {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;
  
  breadcrumb.innerHTML = '';
  
  items.forEach((item, index) => {
    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '>';
      breadcrumb.appendChild(separator);
    }
    
    const breadcrumbItem = document.createElement(item.href ? 'a' : 'span');
    breadcrumbItem.className = 'breadcrumb-item';
    breadcrumbItem.textContent = item.label;
    
    if (item.href) {
      breadcrumbItem.href = item.href;
      breadcrumbItem.addEventListener('click', (e) => {
        if (item.onClick) {
          e.preventDefault();
          item.onClick();
        }
      });
    } else {
      breadcrumbItem.classList.add('active');
    }
    
    breadcrumb.appendChild(breadcrumbItem);
  });
}

// Show favorites
let showingFavorites = false;
let allGames = [];

async function showFavorites() {
  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';
  const gamesGrid = document.getElementById('gamesGrid');
  const titleEl = document.querySelector('.title');
  const favoritesBtn = document.getElementById('favoritesBtn');
  
  if (!gamesGrid) return;
  
  // Check if user is logged in
  const userData = localStorage.getItem('jumpiUser');
  if (!userData) {
    showModalAlert('התחברות נדרשת', 'אתה צריך להתחבר כדי לראות את המועדפים שלך', 'warning');
    return;
  }
  
  if (showingFavorites) {
    // Show all games
    showingFavorites = false;
    updateBreadcrumb([
      { label: 'עמוד הבית', href: '/' }
    ]);
    
    if (titleEl) {
      titleEl.textContent = 'Kids Games';
    }
    if (favoritesBtn) {
      favoritesBtn.classList.remove('active');
    }
    if (allGames && allGames.length > 0) {
      renderGames(allGames);
    } else {
      // Reload page to get all games
      window.location.reload();
    }
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/favorites`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const games = await response.json();
      showingFavorites = true;
      
      // Update breadcrumb
      updateBreadcrumb([
        { label: 'עמוד הבית', href: '/', onClick: () => {
          showingFavorites = false;
          if (titleEl) titleEl.textContent = 'Kids Games';
          if (favoritesBtn) favoritesBtn.classList.remove('active');
          if (allGames && allGames.length > 0) {
            renderGames(allGames);
            updateBreadcrumb([{ label: 'עמוד הבית', href: '/' }]);
          } else {
            window.location.reload();
          }
        }},
        { label: 'מועדפים' }
      ]);
      
      if (favoritesBtn) {
        favoritesBtn.classList.add('active');
      }
      
      if (titleEl) {
        titleEl.textContent = 'מועדפים';
      }
      
      if (games.length === 0) {
        gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">אין משחקים במועדפים</div>';
        return;
      }
      
      renderGames(games);
    } else if (response.status === 401) {
      showModalAlert('התחברות נדרשת', 'אתה צריך להתחבר כדי לראות את המועדפים שלך', 'warning');
    } else {
      gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">שגיאה בטעינת המועדפים</div>';
    }
  } catch (error) {
    console.error('Error loading favorites:', error);
    gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">שגיאה בטעינת המועדפים</div>';
  }
}

// Extract game rendering logic - reuse the same code from DOMContentLoaded
function renderGames(games) {
  const gamesGrid = document.getElementById('gamesGrid');
  if (!gamesGrid) return;
  
  gamesGrid.innerHTML = '';
  
  if (games.length === 0) {
    const emptyMessage = showingFavorites 
      ? 'אין משחקים במועדפים'
      : 'אין משחקים זמינים';
    gamesGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">${emptyMessage}</div>`;
    return;
  }
  
  // Use the same rendering logic as the main games loading
  games.forEach((game, index) => {
    const card = document.createElement('article');
    card.className = 'card';
    if (game.featured) {
      card.classList.add('featured');
    }
    
    // Handle both MongoDB games (embedUrl) and GameMonetize games (url)
    const gameUrl = game.url || game.embedUrl || '';
    card.setAttribute('data-game-src', gameUrl);
    card.setAttribute('data-title', game.title || 'Game');
    card.setAttribute('data-game-slug', game.gameSlug || game.id || '');

    const link = document.createElement('a');
    link.className = 'card-link';
    // Use gameSlug or id for GameMonetize games
    const gameSlug = game.gameSlug || game.id || '';
    link.href = gameSlug ? `/game/${encodeURIComponent(gameSlug)}` : '#';

    // Handle images - prioritize GameMonetize thumbnails, then local gameSlug, then placeholder
    const thumbnail = game.thumb || game.thumbnail || '';
    
    if (thumbnail) {
      // Use GameMonetize thumbnail (most common for favorites)
      const img = document.createElement('img');
      img.src = thumbnail;
      img.alt = game.title || 'Game';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease;';
      img.onerror = () => {
        // Fallback to placeholder if thumbnail fails to load
        img.src = createPlaceholderImage(400, 300, game.title || 'Game');
      };
      link.appendChild(img);
    } else if (game.gameSlug) {
      // Use local game images if gameSlug exists
      const imgContainer = document.createElement('div');
      imgContainer.className = 'img-carousel';
      imgContainer.style.cssText = 'position: relative; width: 100%; height: 100%;';
      
      const img = document.createElement('img');
      img.src = `/Games/${game.gameSlug}/image1.jpg`;
      img.alt = game.title || 'Game';
      img.className = 'carousel-img loaded';
      img.style.opacity = '1';
      img.onerror = () => {
        // Use data URI as fallback
        img.src = createPlaceholderImage(400, 300, game.title || 'Game');
      };
      
      imgContainer.appendChild(img);
      link.appendChild(imgContainer);
      
      // Add video element if available
      const video = document.createElement('video');
      video.src = `/Games/${game.gameSlug}/video.mp4`;
      video.muted = true;
      video.loop = true;
      video.preload = 'metadata';
      video.className = 'card-video';
      video.onerror = () => {
        video.style.display = 'none';
      };
      link.appendChild(video);
      
      // Video hover
      card.addEventListener('mouseenter', () => {
        if (video && video.style.display !== 'none') {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      });
      card.addEventListener('mouseleave', () => {
        if (video && video.style.display !== 'none') {
          video.pause();
          video.currentTime = 0;
        }
      });
    } else {
      // Fallback placeholder using data URI
      const img = document.createElement('img');
      img.src = createPlaceholderImage(400, 300, game.title || 'Game');
      img.alt = game.title || 'Game';
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
      link.appendChild(img);
    }

    // Add favorite button (always show for favorites view, or if user is logged in)
    const userData = localStorage.getItem('jumpiUser');
    if (userData || showingFavorites) {
      const favoriteBtn = document.createElement('button');
      favoriteBtn.className = 'favorite-btn';
      // Only mark as active if actually favorited (not just because we're in favorites view)
      if (game.isFavorite) {
        favoriteBtn.classList.add('active');
        favoriteBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      }
      // Use game._id for MongoDB games or game.id for GameMonetize games
      const gameId = game._id || game.id || '';
      if (!gameId) {
        console.warn('Game missing ID:', game);
        return; // Skip favorite button if no ID
      }
      
      favoriteBtn.setAttribute('data-game-id', gameId);
      favoriteBtn.setAttribute('aria-label', 'הוסף למועדפים');
      favoriteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // Get image for favorite modal - use thumbnail, local image, or placeholder
          const gameImage = game.thumb || game.thumbnail || 
                           (game.gameSlug ? `/Games/${game.gameSlug}/image1.jpg` : '') || 
                           createPlaceholderImage(300, 200, game.title || 'Game');
          const wasFavorite = favoriteBtn.classList.contains('active');
          // Prepare game data for GameMonetize games
          const gameDataForFavorite = game.id && !game._id ? {
            id: game.id,
            title: game.title || 'Game',
            description: game.description || '',
            url: game.url || game.embedUrl || '',
            thumb: game.thumb || game.thumbnail || '',
            category: game.category || '',
            tags: game.tags || ''
          } : null;
          await toggleFavorite(gameId, favoriteBtn, game.title || 'Game', gameImage, gameDataForFavorite);
          
          if (showingFavorites && wasFavorite) {
            // Wait a bit for the confirmation to show
            setTimeout(() => {
              if (!favoriteBtn.classList.contains('active')) {
                card.remove();
                if (gamesGrid.children.length === 0) {
                  gamesGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">אין משחקים במועדפים</div>';
                }
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error toggling favorite:', error);
        }
      });
      card.appendChild(favoriteBtn);
    }

    if (game.featured) {
      const badge = document.createElement('span');
      badge.className = 'badge hot';
      badge.innerHTML = '<i class="fa-solid fa-fire"></i> Hot';
      card.appendChild(badge);
    }

    card.appendChild(link);
    gamesGrid.appendChild(card);
  });
  
  // Initialize card links after rendering
  setTimeout(() => {
    const cards = document.querySelectorAll('.grid .card');
    cards.forEach((card) => {
      const link = card.querySelector('.card-link');
      const gameSlug = card.getAttribute('data-game-slug');
      if (link && gameSlug) {
        link.setAttribute('href', `/game/${encodeURIComponent(gameSlug)}`);
      }
    });
  }, 100);
}

// Show modal alert (for favorites and other features)
function showModalAlert(title, message, type = 'info') {
  const existing = document.getElementById('alertModal');
  if (existing) {
    existing.remove();
  }
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  const modal = document.createElement('div');
  modal.id = 'alertModal';
  modal.className = 'alert-modal';
  modal.innerHTML = `
    <div class="alert-modal-content">
      <div class="alert-modal-icon ${type}">${icons[type] || icons.info}</div>
      <div class="alert-modal-title">${escapeHtml(title)}</div>
      <div class="alert-modal-message">${escapeHtml(message)}</div>
      <button class="alert-modal-button ${type === 'error' ? 'error' : ''}" onclick="closeModalAlert()">אישור</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModalAlert();
    }
  });
  
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModalAlert();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeModalAlert() {
  const modal = document.getElementById('alertModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      modal.remove();
    }, 200);
  }
}

// Handle logout
async function handleLogout() {
  // Determine API URL based on current host
  const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
    ? 'https://jumpigames.com' 
    : 'http://localhost:3000';
  try {
    await fetch(`${API_URL}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Error logging out:', error);
  }
  localStorage.removeItem('jumpiUser');
  window.location.reload();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const userMenu = document.getElementById('userMenu');
  const dropdown = document.getElementById('userDropdown');
  if (userMenu && dropdown && !userMenu.contains(e.target)) {
    dropdown.style.display = 'none';
  }
  
  // Close notifications modal when clicking outside
  const notificationsModal = document.getElementById('notificationsModal');
  if (notificationsModal && e.target === notificationsModal) {
    closeNotifications();
  }
});

// Notifications functions
function updateDiamondsDisplay(diamonds) {
  const diamondsDisplay = document.getElementById('diamondsDisplay');
  const diamondsCount = document.getElementById('diamondsCount');
  
  if (diamondsDisplay && diamondsCount) {
    diamondsDisplay.style.display = 'flex';
    diamondsCount.textContent = diamonds || 0;
  }
}

async function checkUnreadNotifications() {
  try {
    const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        if (data.count > 0) {
          badge.textContent = data.count > 9 ? '9+' : data.count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Error checking unread notifications:', error);
  }
}

async function loadNotifications() {
  try {
    const response = await fetch(`${API_URL}/api/notifications`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const notifications = await response.json();
      return notifications;
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    return [];
  }
}

async function toggleNotifications() {
  const modal = document.getElementById('notificationsModal');
  const list = document.getElementById('notificationsList');
  
  if (!modal || !list) return;
  
  if (modal.style.display === 'none' || !modal.style.display) {
    // Show modal and load notifications
    modal.style.display = 'flex';
    list.innerHTML = '<div class="notification-loading" style="text-align: center; padding: 20px; color: var(--muted);">טוען התראות...</div>';
    
    const notifications = await loadNotifications();
    
    if (notifications.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">אין התראות</div>';
    } else {
      list.innerHTML = notifications.map(notif => {
        const isUnread = !notif.seen || !notif.read;
        const date = new Date(notif.createdAt).toLocaleDateString('he-IL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        return `
          <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="markNotificationAsRead('${notif._id}')">
            <div class="notification-header">
              <h4 class="notification-title">${notif.title}</h4>
              <span class="notification-type ${notif.type || 'info'}">${notif.type || 'info'}</span>
            </div>
            <p class="notification-message">${notif.message}</p>
            <div class="notification-date">${date}</div>
          </div>
        `;
      }).join('');
    }
    
    // Mark all notifications as seen when opening modal
    notifications.forEach(notif => {
      if (!notif.seen) {
        markNotificationAsSeen(notif._id);
      }
    });
    
    // Update badge
    checkUnreadNotifications();
  } else {
    closeNotifications();
  }
}

function closeNotifications() {
  const modal = document.getElementById('notificationsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function markNotificationAsSeen(notificationId) {
  try {
    await fetch(`${API_URL}/api/notifications/${notificationId}/seen`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Error marking notification as seen:', error);
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'POST',
      credentials: 'include'
    });
    
    // Reload notifications to update UI
    const notifications = await loadNotifications();
    const list = document.getElementById('notificationsList');
    const modal = document.getElementById('notificationsModal');
    
    if (list && modal && modal.style.display !== 'none') {
      if (notifications.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">אין התראות</div>';
      } else {
        list.innerHTML = notifications.map(notif => {
          const isUnread = !notif.seen || !notif.read;
          const date = new Date(notif.createdAt).toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          return `
            <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="markNotificationAsRead('${notif._id}')">
              <div class="notification-header">
                <h4 class="notification-title">${notif.title}</h4>
                <span class="notification-type ${notif.type || 'info'}">${notif.type || 'info'}</span>
              </div>
              <p class="notification-message">${notif.message}</p>
              <div class="notification-date">${date}</div>
            </div>
          `;
        }).join('');
      }
    }
    
    // Update badge
    checkUnreadNotifications();
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Check unread notifications periodically
setInterval(checkUnreadNotifications, 60000); // Every minute

// Daily Bonus Functions
const DAILY_BONUS_REWARDS = [10, 20, 30, 50, 75, 100, 150]; // Day 1-7 rewards
let dailyBonusModalShown = false; // Flag to prevent multiple auto-shows

// Determine API URL based on current host
const API_URL = window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com' 
  ? 'https://jumpigames.com' 
  : 'http://localhost:3000';

async function checkDailyBonusStatus(autoShow = true) {
  try {
    const userData = localStorage.getItem('jumpiUser');
    if (!userData) {
      // Hide bonus elements if user not logged in
      const bonusDisplay = document.getElementById('dailyBonusDisplay');
      const bonusBtn = document.getElementById('dailyBonusBtn');
      if (bonusDisplay) bonusDisplay.style.display = 'none';
      if (bonusBtn) bonusBtn.style.display = 'none';
      return;
    }

    const response = await fetch(`${API_URL}/api/daily-bonus/status`, {
      credentials: 'include'
    });

    if (response.ok) {
      const status = await response.json();
      updateDailyBonusUI(status);
      
      // Show bonus button if user can claim
      const bonusBtn = document.getElementById('dailyBonusBtn');
      const bonusDisplay = document.getElementById('dailyBonusDisplay');
      if (bonusBtn) {
        bonusBtn.style.display = status.canClaim ? 'inline-flex' : 'none';
      }
      if (bonusDisplay) {
        bonusDisplay.style.display = status.canClaim ? 'flex' : 'none';
      }
      
      // Auto-show modal if bonus can be claimed (on page load)
      if (status.canClaim && autoShow && !dailyBonusModalShown) {
        dailyBonusModalShown = true;
        // Wait a bit before showing to let page load
        setTimeout(() => {
          showDailyBonusModal(status);
        }, 1000);
      }
    } else if (response.status === 401) {
      // User not authenticated - hide bonus elements
      const bonusDisplay = document.getElementById('dailyBonusDisplay');
      const bonusBtn = document.getElementById('dailyBonusBtn');
      if (bonusDisplay) bonusDisplay.style.display = 'none';
      if (bonusBtn) bonusBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking daily bonus status:', error);
  }
}

function updateDailyBonusUI(status) {
  const bonusAmount = document.getElementById('dailyBonusAmount');
  if (bonusAmount) {
    bonusAmount.textContent = status.nextReward || 0;
  }
}

async function checkAndShowDailyBonus() {
  try {
    const response = await fetch(`${API_URL}/api/daily-bonus/status`, {
      credentials: 'include'
    });

    if (response.ok) {
      const status = await response.json();
      if (status.canClaim) {
        showDailyBonusModal(status);
      } else {
        // Already claimed today
        showModalAlert('בונוס יומי', 'כבר קיבלת את הבונוס היומי היום! חזור מחר לקבל עוד.', 'info');
      }
    } else if (response.status === 401) {
      showModalAlert('התחברות נדרשת', 'אתה צריך להתחבר כדי לקבל בונוס יומי', 'warning');
    }
  } catch (error) {
    console.error('Error checking daily bonus:', error);
    showModalAlert('שגיאה', 'אירעה שגיאה בבדיקת הבונוס היומי', 'error');
  }
}

function showDailyBonusModal(status) {
  const modal = document.getElementById('dailyBonusModal');
  const rewardAmount = document.getElementById('dailyBonusRewardAmount');
  const message = document.getElementById('dailyBonusMessage');
  const streakContainer = document.getElementById('dailyBonusStreak');
  const nextBonusInfo = document.getElementById('nextBonusInfo');
  const claimBtn = document.getElementById('claimBonusBtn');

  if (!modal) return;

  // Update reward amount
  if (rewardAmount) {
    rewardAmount.textContent = status.nextReward || 0;
  }

  // Update message
  if (message) {
    const dayNumber = status.currentStreakDay + 1;
    if (status.currentStreakDay === 0 && !status.lastClaimDate) {
      message.textContent = 'התחל את הרצף שלך! התחבר מדי יום כדי לקבל פרסים גדולים יותר!';
    } else {
      message.textContent = `יום ${dayNumber} ברצף! המשך להתחבר מדי יום כדי לקבל פרסים גדולים יותר!`;
    }
  }

  // Show streak days
  if (streakContainer) {
    streakContainer.innerHTML = '';
    const nextDay = status.currentStreakDay;
    
    for (let i = 0; i < 7; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.style.cssText = `
        width: 50px;
        height: 50px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 14px;
        position: relative;
        ${i === nextDay ? 'background: linear-gradient(180deg, var(--pill-1), var(--pill-2)); color: #2b1b5f; border: 3px solid #4CAF50;' : 'background: var(--panel-2); color: var(--muted);'}
      `;
      
      if (i === nextDay) {
        dayDiv.innerHTML = `<i class="fa-regular fa-gem" style="font-size: 20px;"></i>`;
        dayDiv.title = `יום ${i + 1} - ${DAILY_BONUS_REWARDS[i]} יהלומים`;
      } else {
        dayDiv.textContent = DAILY_BONUS_REWARDS[i];
        dayDiv.title = `יום ${i + 1} - ${DAILY_BONUS_REWARDS[i]} יהלומים`;
      }
      
      streakContainer.appendChild(dayDiv);
    }
  }

  // Update next bonus info
  if (nextBonusInfo) {
    const nextDay = (status.currentStreakDay + 1) % 7;
    nextBonusInfo.textContent = `הפרס הבא: ${DAILY_BONUS_REWARDS[nextDay]} יהלומים (יום ${nextDay + 1})`;
  }

  // Enable claim button
  if (claimBtn) {
    claimBtn.disabled = false;
    claimBtn.textContent = 'קבל בונוס';
  }

  // Show modal
  modal.style.display = 'flex';

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeDailyBonusModal();
    }
  });

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeDailyBonusModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeDailyBonusModal() {
  const modal = document.getElementById('dailyBonusModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function claimDailyBonus() {
  const claimBtn = document.getElementById('claimBonusBtn');
  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = 'מעבד...';
  }

  try {
    const response = await fetch(`${API_URL}/api/daily-bonus/claim`, {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      const result = await response.json();
      
      // Update UI with claimed reward
      const rewardAmount = document.getElementById('dailyBonusRewardAmount');
      const message = document.getElementById('dailyBonusMessage');
      const claimBtn = document.getElementById('claimBonusBtn');
      
      if (rewardAmount) {
        rewardAmount.textContent = result.reward;
      }
      
      if (message) {
        message.textContent = `קיבלת ${result.reward} יהלומים! המשך להתחבר מדי יום כדי לקבל פרסים גדולים יותר!`;
      }
      
      if (claimBtn) {
        claimBtn.textContent = '✓ קיבלת!';
        claimBtn.style.background = '#4CAF50';
        claimBtn.disabled = true;
      }
      
      // Update diamonds display
      updateDiamondsDisplay(result.newDiamondsTotal);
      
      // Update user in localStorage
      const userData = localStorage.getItem('jumpiUser');
      if (userData) {
        const user = JSON.parse(userData);
        user.diamonds = result.newDiamondsTotal;
        localStorage.setItem('jumpiUser', JSON.stringify(user));
      }
      
      // Hide bonus button and display
      const bonusBtn = document.getElementById('dailyBonusBtn');
      const bonusDisplay = document.getElementById('dailyBonusDisplay');
      if (bonusBtn) bonusBtn.style.display = 'none';
      if (bonusDisplay) bonusDisplay.style.display = 'none';
      
      // Auto close modal after 3 seconds
      setTimeout(() => {
        closeDailyBonusModal();
        // Refresh status (don't auto-show modal again)
        checkDailyBonusStatus(false);
      }, 3000);
    } else {
      const errorData = await response.json().catch(() => ({}));
      showModalAlert('שגיאה', errorData.error || 'אירעה שגיאה בקבלת הבונוס', 'error');
      
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.textContent = 'קבל בונוס';
      }
    }
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
    showModalAlert('שגיאה', 'אירעה שגיאה בקבלת הבונוס', 'error');
    
    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.textContent = 'קבל בונוס';
    }
  }
}

// Tasks functions
let currentTaskTab = 'daily';

async function toggleTasksModal() {
  const modal = document.getElementById('tasksModal');
  if (!modal) return;
  
  if (modal.style.display === 'none' || !modal.style.display) {
    modal.style.display = 'flex';
    await loadTasks();
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTasksModal();
      }
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeTasksModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  } else {
    closeTasksModal();
  }
}

function closeTasksModal() {
  const modal = document.getElementById('tasksModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function switchTaskTab(tab) {
  currentTaskTab = tab;
  const dailyContainer = document.getElementById('dailyTasksContainer');
  const weeklyContainer = document.getElementById('weeklyTasksContainer');
  const dailyTabBtn = document.getElementById('dailyTabBtn');
  const weeklyTabBtn = document.getElementById('weeklyTabBtn');
  
  if (tab === 'daily') {
    if (dailyContainer) dailyContainer.style.display = 'block';
    if (weeklyContainer) weeklyContainer.style.display = 'none';
    if (dailyTabBtn) dailyTabBtn.classList.add('active');
    if (weeklyTabBtn) weeklyTabBtn.classList.remove('active');
  } else {
    if (dailyContainer) dailyContainer.style.display = 'none';
    if (weeklyContainer) weeklyContainer.style.display = 'block';
    if (dailyTabBtn) dailyTabBtn.classList.remove('active');
    if (weeklyTabBtn) weeklyTabBtn.classList.add('active');
  }
}

async function loadTasks() {
  const dailyContainer = document.getElementById('dailyTasksContainer');
  const weeklyContainer = document.getElementById('weeklyTasksContainer');
  
  try {
    const response = await fetch(`${API_URL}/api/tasks`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Render daily tasks
      if (dailyContainer) {
        dailyContainer.innerHTML = '';
        if (data.daily && data.daily.length > 0) {
          data.daily.forEach(task => {
            dailyContainer.appendChild(createTaskCard(task, 'daily'));
          });
        } else {
          dailyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">אין משימות יומיות</div>';
        }
      }
      
      // Render weekly tasks
      if (weeklyContainer) {
        weeklyContainer.innerHTML = '';
        if (data.weekly && data.weekly.length > 0) {
          data.weekly.forEach(task => {
            weeklyContainer.appendChild(createTaskCard(task, 'weekly'));
          });
        } else {
          weeklyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted);">אין משימות שבועיות</div>';
        }
      }
    } else {
      if (dailyContainer) {
        dailyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">שגיאה בטעינת משימות</div>';
      }
      if (weeklyContainer) {
        weeklyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">שגיאה בטעינת משימות</div>';
      }
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    if (dailyContainer) {
      dailyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">שגיאה בטעינת משימות</div>';
    }
    if (weeklyContainer) {
      weeklyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">שגיאה בטעינת משימות</div>';
    }
  }
}

function createTaskCard(task, type) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.style.cssText = `
    background: var(--panel);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    border: 2px solid ${task.completed ? '#4CAF50' : 'var(--panel-2)'};
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.2s ease;
  `;
  
  const progress = task.progress || 0;
  const target = task.target || 1;
  const percentage = Math.min((progress / target) * 100, 100);
  
  // Icon
  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: ${task.completed ? 'linear-gradient(180deg, var(--pill-1), var(--pill-2))' : 'var(--panel-2)'};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: ${task.completed ? '#2b1b5f' : 'var(--muted)'};
    flex-shrink: 0;
  `;
  icon.innerHTML = `<i class="fa-solid ${task.icon || 'fa-check'}"></i>`;
  card.appendChild(icon);
  
  // Content
  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; min-width: 0;';
  
  const title = document.createElement('h4');
  title.style.cssText = 'margin: 0 0 8px 0; color: var(--text); font-size: 16px; font-weight: 600;';
  title.textContent = task.title;
  content.appendChild(title);
  
  const description = document.createElement('p');
  description.style.cssText = 'margin: 0 0 8px 0; color: var(--muted); font-size: 14px;';
  description.textContent = task.description;
  content.appendChild(description);
  
  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 100%;
    height: 8px;
    background: var(--panel-2);
    border-radius: 4px;
    overflow: hidden;
    margin-top: 8px;
  `;
  const progressFill = document.createElement('div');
  progressFill.style.cssText = `
    height: 100%;
    width: ${percentage}%;
    background: ${task.completed ? 'linear-gradient(90deg, #4CAF50, #45a049)' : 'linear-gradient(90deg, var(--brand-blue-1), var(--brand-blue-2))'};
    transition: width 0.3s ease;
    border-radius: 4px;
  `;
  progressBar.appendChild(progressFill);
  content.appendChild(progressBar);
  
  const progressText = document.createElement('div');
  progressText.style.cssText = 'margin-top: 4px; color: var(--muted); font-size: 12px;';
  progressText.textContent = `${progress}/${target}`;
  content.appendChild(progressText);
  
  card.appendChild(content);
  
  // Reward button
  const rewardBtn = document.createElement('button');
  rewardBtn.style.cssText = `
    padding: 12px 20px;
    border-radius: 12px;
    border: none;
    cursor: ${task.completed && !task.claimed ? 'pointer' : 'not-allowed'};
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.2s ease;
  `;
  
  if (task.claimed) {
    rewardBtn.style.background = '#4CAF50';
    rewardBtn.style.color = '#fff';
    rewardBtn.innerHTML = '<i class="fa-solid fa-check"></i> קיבלת';
    rewardBtn.disabled = true;
  } else if (task.completed) {
    rewardBtn.style.background = 'linear-gradient(180deg, var(--pill-1), var(--pill-2))';
    rewardBtn.style.color = '#2b1b5f';
    rewardBtn.innerHTML = `<i class="fa-regular fa-gem"></i> ${task.reward}`;
    rewardBtn.onclick = () => claimTaskReward(task.id, type);
  } else {
    rewardBtn.style.background = 'var(--panel-2)';
    rewardBtn.style.color = 'var(--muted)';
    rewardBtn.innerHTML = `<i class="fa-regular fa-gem"></i> ${task.reward}`;
    rewardBtn.disabled = true;
  }
  
  card.appendChild(rewardBtn);
  
  return card;
}

async function claimTaskReward(taskId, taskType) {
  try {
    const response = await fetch(`${API_URL}/api/tasks/${taskType}/${taskId}/claim`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Update diamonds display
      updateDiamondsDisplay(result.newDiamondsTotal);
      
      // Update user in localStorage
      const userData = localStorage.getItem('jumpiUser');
      if (userData) {
        const user = JSON.parse(userData);
        user.diamonds = result.newDiamondsTotal;
        localStorage.setItem('jumpiUser', JSON.stringify(user));
      }
      
      // Show success message
      showModalAlert('הצלחה!', `קיבלת ${result.reward} יהלומים!`, 'success');
      
      // Reload tasks to update UI
      await loadTasks();
    } else {
      const errorData = await response.json().catch(() => ({}));
      showModalAlert('שגיאה', errorData.error || 'אירעה שגיאה בקבלת הפרס', 'error');
    }
  } catch (error) {
    console.error('Error claiming task reward:', error);
    showModalAlert('שגיאה', 'אירעה שגיאה בקבלת הפרס', 'error');
  }
}

// Fallback for toggleChat if chat.js hasn't loaded yet
if (typeof window !== 'undefined' && typeof window.toggleChat === 'undefined') {
  window.toggleChat = function() {
    console.warn('Chat functionality not loaded yet. Please wait...');
    // Try to initialize chat if chat.js is loaded but not initialized
    if (typeof initChat === 'function') {
      initChat();
    }
  };
}


