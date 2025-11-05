require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const https = require('https');

// Cache for GameMonetize API responses
const gamesCache = new Map();
const categoriesCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const CATEGORIES_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache for categories

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jumpigames', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  picture: String,
  username: { type: String, lowercase: true, trim: true }, // Make username case-insensitive
  age: Number,
  howDidYouHear: String, // איך שמע עלינו
  registered: { type: Boolean, default: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

// Create unique index on username (case-insensitive)
userSchema.index({ username: 1 }, { 
  unique: true, 
  sparse: true, // Allow null values (users who haven't registered yet)
  collation: { locale: 'en', strength: 2 } // Case-insensitive
});

const User = mongoose.model('User', userSchema);

// Game Schema - GameMonetize format
const gameSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // GameMonetize ID
  title: { type: String, required: true },
  description: String,
  instructions: String,
  url: { type: String, required: true }, // GameMonetize URL (was embedUrl)
  embedUrl: String, // Keep for backward compatibility
  gameSlug: String, // Folder name in /Games directory (e.g., "Elytra_Flight")
  category: String,
  tags: String, // Comma-separated tags
  thumb: String, // Thumbnail URL
  width: { type: String, default: '800' },
  height: { type: String, default: '600' },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);

// Game Progress Schema - stores user progress for each game
const gameProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameSlug: { type: String, required: true }, // e.g., "Elytra_Flight"
  progress: { type: mongoose.Schema.Types.Mixed, default: {} }, // Flexible JSON data for any game-specific progress
  lastPlayed: { type: Date, default: Date.now },
  playTime: { type: Number, default: 0 }, // Total play time in seconds
  highScore: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  achievements: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create compound unique index to ensure one progress record per user per game
gameProgressSchema.index({ userId: 1, gameSlug: 1 }, { unique: true });

const GameProgress = mongoose.model('GameProgress', gameProgressSchema);

// Chat Room Schema
const chatRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  adminOnly: { type: Boolean, default: false }, // Only admins can send messages
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// Chat Message Schema
const chatMessageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  userPicture: String,
  isAdmin: { type: Boolean, default: false }, // Admin badge
  message: { type: String, required: true },
  edited: { type: Boolean, default: false },
  editedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// User Ban/Mute Schema
const userModerationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  banned: { type: Boolean, default: false },
  bannedUntil: Date,
  muted: { type: Boolean, default: false },
  mutedUntil: Date,
  reason: String,
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const UserModeration = mongoose.model('UserModeration', userModerationSchema);

// Favorites Schema - supports both MongoDB games (gameId) and GameMonetize games (gameIdString)
const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' }, // For MongoDB games
  gameIdString: { type: String }, // For GameMonetize games (using game.id as string)
  gameData: { type: mongoose.Schema.Types.Mixed }, // Store game data for GameMonetize games
  createdAt: { type: Date, default: Date.now }
});

// Compound index to prevent duplicates (for MongoDB games)
favoriteSchema.index({ userId: 1, gameId: 1 }, { unique: true, sparse: true });
// Compound index to prevent duplicates (for GameMonetize games)
favoriteSchema.index({ userId: 1, gameIdString: 1 }, { unique: true, sparse: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);

// Set admin user and create default chat room on startup
mongoose.connection.once('open', async () => {
  try {
    const adminEmail = 'ilanvx@gmail.com';
    await User.findOneAndUpdate(
      { email: adminEmail },
      { role: 'admin' },
      { upsert: false, new: true }
    );
    console.log(`✅ Admin user set: ${adminEmail}`);
    
    // Create default chat rooms if they don't exist
    const generalRoom = await ChatRoom.findOne({ name: 'כללי' });
    if (!generalRoom) {
      const room = new ChatRoom({
        name: 'כללי',
        description: 'חדר צ\'אט כללי לכל המשתמשים',
        type: 'public',
        adminOnly: false
      });
      await room.save();
      console.log('✅ Default chat room created');
    }
    
    const updatesRoom = await ChatRoom.findOne({ name: 'עדכונים' });
    if (!updatesRoom) {
      const room = new ChatRoom({
        name: 'עדכונים',
        description: 'עדכונים מהצוות - רק מנהלים יכולים לכתוב',
        type: 'public',
        adminOnly: true
      });
      await room.save();
      console.log('✅ Updates chat room created');
    }
  } catch (error) {
    console.error('Error setting up startup data:', error);
  }
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for development
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(session({
  secret: process.env.SESSION_SECRET || 'jumpigames-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      // Update existing user
      const email = profile.emails[0].value;
      user.name = profile.displayName;
      user.email = email;
      user.picture = profile.photos[0]?.value;
      
      // Set admin if email matches
      if (email === 'ilanvx@gmail.com') {
        user.role = 'admin';
      }
      
      await user.save();
      return done(null, user);
    } else {
      // Create new user
      const email = profile.emails[0].value;
      const isAdminEmail = email === 'ilanvx@gmail.com';
      
      user = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: email,
        picture: profile.photos[0]?.value,
        registered: false,
        role: isAdminEmail ? 'admin' : 'user'
      });
      await user.save();
      return done(null, user);
    }
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Routes
app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=oauth_failed' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/login.html?success=1');
  }
);

// Get current user
app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json({
      id: req.user._id,
      googleId: req.user.googleId,
      name: req.user.name,
      email: req.user.email,
      picture: req.user.picture,
      username: req.user.username,
      age: req.user.age,
      registered: req.user.registered,
      role: req.user.role
    });
  } else {
    res.json(null);
  }
});

// Admin middleware
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

// Helper function to fetch from GameMonetize API with retry logic
function fetchGameMonetizeFeed(page = 1, retries = 2) {
  return new Promise((resolve, reject) => {
    // Check cache first
    const cacheKey = `page_${page}`;
    const cached = gamesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached data for page ${page}`);
      return resolve(cached.data);
    }
    
    const url = `https://gamemonetize.com/feed.php?format=0&page=${page}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    };
    
    const attemptRequest = (attemptNum) => {
      https.get(url, options, (res) => {
        // Handle rate limiting (429)
        if (res.statusCode === 429) {
          if (attemptNum < retries) {
            const delay = Math.pow(2, attemptNum) * 1000; // Exponential backoff
            console.log(`Rate limited, retrying in ${delay}ms (attempt ${attemptNum + 1}/${retries})`);
            return setTimeout(() => attemptRequest(attemptNum + 1), delay);
          }
          return reject(new Error(`HTTP 429: Too Many Requests - Rate limited by GameMonetize`));
        }
        
        // Check for redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          return reject(new Error(`Redirected: ${res.headers.location}`));
        }
        
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            if (!data || data.trim().length === 0) {
              return reject(new Error('Empty response from GameMonetize API'));
            }
            
            // Check if response is an error message
            const dataTrimmed = data.trim();
            if (dataTrimmed.toLowerCase().includes('error') || dataTrimmed.toLowerCase().includes('1015')) {
              console.error('GameMonetize API error response:', dataTrimmed);
              return reject(new Error(`GameMonetize API error: ${dataTrimmed}`));
            }
            
            // Try to parse JSON
            let games;
            try {
              games = JSON.parse(data);
            } catch (parseError) {
              console.error('JSON parse error:', parseError.message);
              console.error('Response data (first 500 chars):', data.substring(0, 500));
              return reject(new Error(`Failed to parse JSON response. Server returned: ${dataTrimmed.substring(0, 100)}`));
            }
            
            // Check if games is an array
            if (!Array.isArray(games)) {
              console.error('Unexpected response format:', typeof games);
              console.error('Response data (first 200 chars):', data.substring(0, 200));
              return reject(new Error('Invalid response format from GameMonetize API - expected array'));
            }
            
            // Cache the result
            gamesCache.set(cacheKey, { data: games, timestamp: Date.now() });
            resolve(games);
          } catch (error) {
            console.error('Unexpected error in response handler:', error.message);
            reject(error);
          }
        });
      }).on('error', (error) => {
        if (attemptNum < retries) {
          const delay = Math.pow(2, attemptNum) * 1000;
          console.log(`Request error, retrying in ${delay}ms (attempt ${attemptNum + 1}/${retries})`);
          return setTimeout(() => attemptRequest(attemptNum + 1), delay);
        }
        console.error('HTTPS request error:', error.message);
        reject(error);
      });
    };
    
    // Start first attempt
    attemptRequest(0);
  });
}

// Helper function to create slug from game title or ID
function createGameSlug(game) {
  // Use ID if available, otherwise create slug from title
  if (game.id) {
    return game.id.toString();
  }
  if (game.title) {
    return game.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  return 'game-' + Math.random().toString(36).substr(2, 9);
}

// Games API - Public (Now fetches from GameMonetize)
app.get('/api/games', async (req, res) => {
  // Define variables outside try block so they're available in catch
  const page = parseInt(req.query.page) || 1;
  const category = req.query.category || '';
  
  try {
    console.log(`Fetching games from GameMonetize - Page: ${page}, Category: ${category || 'all'}`);
    
    const games = await fetchGameMonetizeFeed(page);
    
    if (!games || !Array.isArray(games)) {
      console.error('Invalid games data received:', typeof games);
      return res.status(500).json({ error: 'Invalid data format from GameMonetize API' });
    }
    
    console.log(`Successfully fetched ${games.length} games from GameMonetize`);
    
    // Format games and add slug
    let formattedGames = games.map(game => {
      if (!game || typeof game !== 'object') {
        console.warn('Invalid game object:', game);
        return null;
      }
      
      return {
        id: game.id || game.game_id || game.ID || '',
        title: game.title || game.Title || '',
        description: game.description || game.Description || '',
        instructions: game.instructions || game.Instructions || '',
        url: game.url || game.game_url || game.URL || game.link || '',
        embedUrl: game.url || game.game_url || game.URL || game.link || game.embedUrl || '',
        gameSlug: createGameSlug(game),
        category: game.category || game.Category || '',
        tags: game.tags || game.Tags || '',
        thumb: game.thumb || game.thumbnail || game.Thumb || game.image || '',
        width: game.width || game.Width || '800',
        height: game.height || game.Height || '600',
        featured: false,
        order: 0,
        active: true
      };
    }).filter(game => game !== null); // Remove null entries
    
    // Filter by category if provided
    if (category) {
      formattedGames = formattedGames.filter(game => {
        const gameCategory = game.category || '';
        const gameTags = (game.tags || '').toLowerCase();
        
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
    
    console.log(`Returning ${formattedGames.length} formatted games`);
    res.json(formattedGames);
  } catch (error) {
    console.error('Error fetching GameMonetize games:', error.message);
    
    // Check if it's a rate limiting error (429)
    if (error.message.includes('429')) {
      // Try to return cached data if available
      const cacheKey = `page_${page}`;
      const cached = gamesCache.get(cacheKey);
      if (cached) {
        console.log('Rate limited, returning cached data');
        let cachedGames = cached.data;
        
        // Filter by category if needed
        if (category) {
          cachedGames = cachedGames.filter(game => 
            game.category && game.category.toLowerCase() === category.toLowerCase()
          );
        }
        
        return res.json(cachedGames);
      }
      
      return res.status(503).json({ 
        error: 'GameMonetize API is temporarily unavailable (rate limited). Please try again in a few minutes.' 
      });
    }
    
    // Check if it's a Cloudflare blocking error (1015)
    if (error.message.includes('1015')) {
      // Try to return cached data if available
      const cacheKey = `page_${page}`;
      const cached = gamesCache.get(cacheKey);
      if (cached) {
        console.log('Cloudflare blocked, returning cached data');
        let cachedGames = cached.data;
        
        // Filter by category if needed
        if (category) {
          cachedGames = cachedGames.filter(game => 
            game.category && game.category.toLowerCase() === category.toLowerCase()
          );
        }
        
        return res.json(cachedGames);
      }
      
      return res.status(503).json({ 
        error: 'GameMonetize API is temporarily unavailable (blocked by Cloudflare). Please try again later.' 
      });
    }
    
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to fetch games from GameMonetize' });
  }
});

// Categories API - Get all unique categories from GameMonetize
app.get('/api/categories', async (req, res) => {
  try {
    // Check cache first
    if (categoriesCache.data && Date.now() - categoriesCache.timestamp < CATEGORIES_CACHE_DURATION) {
      console.log('Using cached categories');
      return res.json(categoriesCache.data);
    }
    
    // Fetch from multiple pages to get all categories
    const categoriesSet = new Set();
    const pagesToCheck = 2; // Check first 2 pages only (reduced to avoid rate limiting)
    
    for (let page = 1; page <= pagesToCheck; page++) {
      try {
        const games = await fetchGameMonetizeFeed(page);
        if (games && Array.isArray(games) && games.length > 0) {
          games.forEach(game => {
            if (game && typeof game === 'object') {
              const category = game.category || game.Category;
              if (category) {
                categoriesSet.add(category);
              }
            }
          });
        }
        
        // Longer delay to avoid rate limiting
        if (page < pagesToCheck) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay
        }
      } catch (error) {
        // Only log if it's not a rate limit error
        if (!error.message.includes('429') && !error.message.includes('1015') && !error.message.includes('rate limit')) {
          console.error(`Error fetching page ${page} for categories:`, error.message);
        }
        // If rate limited, stop trying more pages
        if (error.message.includes('429')) {
          console.warn('Rate limited while fetching categories, stopping');
          break;
        }
        // Continue to next page even if one fails
      }
    }
    
    let categories = Array.from(categoriesSet);
    
    // Add special categories that might not be in the API response
    const specialCategories = ['Multiplayer', '2 Player Games'];
    specialCategories.forEach(cat => {
      if (!categories.includes(cat)) {
        categories.push(cat);
      }
    });
    
    // Sort categories alphabetically
    categories.sort();
    
    // If no categories found, return default categories
    if (categories.length === 0) {
      console.warn('No categories found from API, using default categories');
      const defaultCategories = ['Action', 'Adventure', 'Arcade', 'Puzzle', 'Racing', 'Sports', 'Strategy', 'Multiplayer', '2 Player Games'];
      // Cache default categories too
      categoriesCache.data = defaultCategories;
      categoriesCache.timestamp = Date.now();
      return res.json(defaultCategories);
    }
    
    // Cache the categories
    categoriesCache.data = categories;
    categoriesCache.timestamp = Date.now();
    
    console.log(`Found ${categories.length} unique categories`);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    // Return default categories as fallback
    const defaultCategories = ['Action', 'Adventure', 'Arcade', 'Puzzle', 'Racing', 'Sports', 'Strategy', 'Multiplayer', '2 Player Games'];
    res.json(defaultCategories);
  }
});

// Get single game by slug/ID (for GameMonetize games)
app.get('/api/games/:slug', async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    console.log(`Fetching game by slug: ${slug}`);
    
    // Try to find game by searching through pages
    // Check cache first
    let foundGame = null;
    let page = 1;
    const maxPages = 5; // Limit search to first 5 pages for performance
    
    // Check cache for games we've already loaded
    for (let p = 1; p <= maxPages; p++) {
      const cacheKey = `page_${p}`;
      const cached = gamesCache.get(cacheKey);
      if (cached && cached.data) {
        foundGame = cached.data.find(g => {
          const gameSlug = createGameSlug(g);
          return gameSlug === slug || 
                 (g.id && g.id.toString() === slug) || 
                 (g.game_id && g.game_id.toString() === slug) ||
                 (g.ID && g.ID.toString() === slug);
        });
        if (foundGame) {
          console.log(`Found game in cache at page ${p}`);
          break;
        }
      }
    }
    
    // If not found in cache, search through pages
    while (page <= maxPages && !foundGame) {
      try {
        const games = await fetchGameMonetizeFeed(page);
        foundGame = games.find(g => {
          const gameSlug = createGameSlug(g);
          return gameSlug === slug || 
                 (g.id && g.id.toString() === slug) || 
                 (g.game_id && g.game_id.toString() === slug) ||
                 (g.ID && g.ID.toString() === slug);
        });
        if (foundGame) {
          console.log(`Found game at page ${page}`);
          break;
        }
        page++;
        // Small delay to avoid rate limiting
        if (page <= maxPages) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        // If rate limited, try to return cached data
        if (error.message.includes('429') || error.message.includes('1015')) {
          break;
        }
        page++;
      }
    }
    
    if (foundGame) {
      const formattedGame = {
        id: foundGame.id || foundGame.game_id || foundGame.ID || '',
        title: foundGame.title || foundGame.Title || '',
        description: foundGame.description || foundGame.Description || '',
        instructions: foundGame.instructions || foundGame.Instructions || '',
        url: foundGame.url || foundGame.game_url || foundGame.URL || foundGame.link || '',
        embedUrl: foundGame.url || foundGame.game_url || foundGame.URL || foundGame.link || '',
        gameSlug: createGameSlug(foundGame),
        category: foundGame.category || foundGame.Category || '',
        tags: foundGame.tags || foundGame.Tags || '',
        thumb: foundGame.thumb || foundGame.thumbnail || foundGame.Thumb || foundGame.image || '',
        width: foundGame.width || foundGame.Width || '800',
        height: foundGame.height || foundGame.Height || '600',
        featured: false,
        order: 0,
        active: true
      };
      res.json(formattedGame);
    } else {
      console.log(`Game not found with slug: ${slug}`);
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper middleware for authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Favorites API endpoints
app.get('/api/favorites', requireAuth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .populate('gameId')
      .sort({ createdAt: -1 })
      .lean();
    
    const result = [];
    
    for (const fav of favorites) {
      if (fav.gameId) {
        // MongoDB game
        if (fav.gameId.active) {
          result.push({
            ...fav.gameId,
            isFavorite: true,
            favoritedAt: fav.createdAt
          });
        }
      } else if (fav.gameIdString && fav.gameData) {
        // GameMonetize game
        result.push({
          ...fav.gameData,
          isFavorite: true,
          favoritedAt: fav.createdAt
        });
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites/:gameId', requireAuth, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const gameData = req.body.gameData; // Optional: game data for GameMonetize games
    
    // Check if it's a MongoDB ObjectId or GameMonetize string ID
    const isMongoId = mongoose.Types.ObjectId.isValid(gameId) && gameId.length === 24;
    
    if (isMongoId) {
      // MongoDB game
      const game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      // Check if already favorited
      const existing = await Favorite.findOne({ userId: req.user._id, gameId });
      if (existing) {
        return res.json({ success: true, message: 'Already favorited' });
      }
      
      // Add to favorites
      const favorite = new Favorite({
        userId: req.user._id,
        gameId
      });
      
      await favorite.save();
      res.json({ success: true, favorite });
    } else {
      // GameMonetize game (string ID)
      if (!gameData) {
        return res.status(400).json({ error: 'Game data required for GameMonetize games' });
      }
      
      // Check if already favorited
      const existing = await Favorite.findOne({ userId: req.user._id, gameIdString: gameId });
      if (existing) {
        return res.json({ success: true, message: 'Already favorited' });
      }
      
      // Add to favorites
      const favorite = new Favorite({
        userId: req.user._id,
        gameIdString: gameId,
        gameData: gameData
      });
      
      await favorite.save();
      res.json({ success: true, favorite });
    }
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res.json({ success: true, message: 'Already favorited' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/favorites/:gameId', requireAuth, async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
    // Check if it's a MongoDB ObjectId or GameMonetize string ID
    const isMongoId = mongoose.Types.ObjectId.isValid(gameId) && gameId.length === 24;
    
    let result;
    if (isMongoId) {
      result = await Favorite.findOneAndDelete({
        userId: req.user._id,
        gameId
      });
    } else {
      result = await Favorite.findOneAndDelete({
        userId: req.user._id,
        gameIdString: gameId
      });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Games API - Admin
app.get('/api/admin/games', isAdmin, async (req, res) => {
  try {
    const games = await Game.find().sort({ order: 1, createdAt: -1 });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/games', isAdmin, async (req, res) => {
  try {
    const { id, title, url, embedUrl, gameSlug, description, instructions, category, tags, thumb, width, height, featured, order } = req.body;
    
    // Use url if provided, otherwise fallback to embedUrl for backward compatibility
    const gameUrl = url || embedUrl;
    
    if (!title || !gameUrl) {
      return res.status(400).json({ error: 'Title and url are required' });
    }

    const game = new Game({
      id: id || '',
      title,
      url: gameUrl,
      embedUrl: embedUrl || gameUrl, // Keep for backward compatibility
      gameSlug: gameSlug || '',
      description: description || '',
      instructions: instructions || '',
      category: category || '',
      tags: tags || '',
      thumb: thumb || '',
      width: width || '800',
      height: height || '600',
      featured: featured || false,
      order: order || 0
    });

    await game.save();
    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/games/:id', isAdmin, async (req, res) => {
  try {
    const { id, title, url, embedUrl, gameSlug, description, instructions, category, tags, thumb, width, height, featured, order, active } = req.body;
    
    // Use url if provided, otherwise fallback to embedUrl for backward compatibility
    const gameUrl = url || embedUrl;
    
    const updateData = {
      title,
      url: gameUrl,
      embedUrl: embedUrl || gameUrl, // Keep for backward compatibility
      gameSlug,
      description,
      instructions,
      category,
      tags,
      thumb,
      width,
      height,
      featured,
      order,
      active,
      updatedAt: Date.now()
    };
    
    // Only update id if provided
    if (id !== undefined) {
      updateData.id = id;
    }
    
    const game = await Game.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/games/:id', isAdmin, async (req, res) => {
  try {
    const game = await Game.findByIdAndDelete(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users API - Admin
app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-googleId');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/users/:id/role', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-googleId');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bad words list (Hebrew)
const badWords = ['זין', 'כוס', 'מזדיין', 'מחורבן', 'מטומטם', 'אידיוט', 'מטופש', 'דביל', 'מפגר', 'משוגע', 'מטורף', 'מטומטמת', 'מחורבנת', 'זונה', 'כלבה', 'מסריח', 'מגעיל', 'חמור', 'בהמה'];

// Validate username
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'שם המשתמש הוא חובה' };
  }
  
  if (username.length < 4) {
    return { valid: false, error: 'שם המשתמש חייב להיות לפחות 4 תווים' };
  }
  
  if (username.length > 15) {
    return { valid: false, error: 'שם המשתמש חייב להיות לכל היותר 15 תווים' };
  }
  
  // Allow Hebrew, English, numbers, and some special characters
  if (!/^[א-תa-zA-Z0-9_\-]+$/.test(username)) {
    return { valid: false, error: 'שם המשתמש יכול להכיל רק אותיות, מספרים, מקף ותחתית' };
  }
  
  // Check for bad words
  const lowerUsername = username.toLowerCase();
  if (badWords.some(word => lowerUsername.includes(word.toLowerCase()))) {
    return { valid: false, error: 'שם המשתמש מכיל מילים לא הולמות' };
  }
  
  return { valid: true };
}

// Check username availability
app.get('/api/user/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.json({ available: false });
    }
    
    // Validate format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }
    
    // Normalize username (lowercase, trim)
    const normalizedUsername = username.toLowerCase().trim();
    
    // Check if username exists (excluding current user) - case-insensitive
    const existingUser = await User.findOne({ 
      username: normalizedUsername,
      _id: { $ne: req.user?._id } // Exclude current user if logged in
    });
    
    res.json({ available: !existingUser });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'שגיאה בבדיקת שם המשתמש' });
  }
});

// Complete registration
app.post('/api/user/register', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { username, howDidYouHear } = req.body;
    
    // Validate username
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Normalize username (lowercase, trim)
    const normalizedUsername = username.toLowerCase().trim();
    
    // Check if username already exists - case-insensitive
    const existingUser = await User.findOne({ 
      username: normalizedUsername,
      _id: { $ne: req.user._id }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'שם המשתמש כבר תפוס' });
    }
    
    req.user.username = normalizedUsername;
    req.user.howDidYouHear = howDidYouHear;
    req.user.registered = true;
    
    try {
    await req.user.save();
    } catch (error) {
      // Handle duplicate key error (in case of race condition)
      if (error.code === 11000 || error.name === 'MongoServerError') {
        return res.status(400).json({ error: 'שם המשתמש כבר תפוס' });
      }
      throw error;
    }
    
    res.json({
      success: true,
      user: {
        id: req.user._id,
        googleId: req.user.googleId,
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture,
        username: req.user.username,
        howDidYouHear: req.user.howDidYouHear,
        registered: req.user.registered
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Game Progress API - Save progress
app.post('/api/game-progress/:gameSlug', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { gameSlug } = req.params;
    const { progress, highScore, level, achievements, playTime } = req.body;

    // Find or create progress record
    let gameProgress = await GameProgress.findOne({ 
      userId: req.user._id, 
      gameSlug: gameSlug 
    });

    if (gameProgress) {
      // Update existing progress
      if (progress !== undefined) gameProgress.progress = progress;
      if (highScore !== undefined) gameProgress.highScore = Math.max(gameProgress.highScore, highScore || 0);
      if (level !== undefined) gameProgress.level = Math.max(gameProgress.level, level || 0);
      if (achievements !== undefined) {
        // Merge achievements, avoiding duplicates
        const existingAchievements = new Set(gameProgress.achievements);
        achievements.forEach(achievement => existingAchievements.add(achievement));
        gameProgress.achievements = Array.from(existingAchievements);
      }
      if (playTime !== undefined) gameProgress.playTime = (gameProgress.playTime || 0) + (playTime || 0);
      gameProgress.lastPlayed = Date.now();
      gameProgress.updatedAt = Date.now();
    } else {
      // Create new progress record
      gameProgress = new GameProgress({
        userId: req.user._id,
        gameSlug: gameSlug,
        progress: progress || {},
        highScore: highScore || 0,
        level: level || 0,
        achievements: achievements || [],
        playTime: playTime || 0,
        lastPlayed: Date.now()
      });
    }

    await gameProgress.save();
    res.json({ success: true, progress: gameProgress });
  } catch (error) {
    console.error('Error saving game progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Progress API - Get progress
app.get('/api/game-progress/:gameSlug', async (req, res) => {
  if (!req.user) {
    return res.json(null); // Return null if not authenticated (game can still work)
  }

  try {
    const { gameSlug } = req.params;
    const gameProgress = await GameProgress.findOne({ 
      userId: req.user._id, 
      gameSlug: gameSlug 
    });

    if (gameProgress) {
      res.json({
        progress: gameProgress.progress,
        highScore: gameProgress.highScore,
        level: gameProgress.level,
        achievements: gameProgress.achievements,
        playTime: gameProgress.playTime,
        lastPlayed: gameProgress.lastPlayed
      });
    } else {
      res.json(null); // No progress found
    }
  } catch (error) {
    console.error('Error loading game progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Progress API - Get all progress for user
app.get('/api/game-progress', async (req, res) => {
  if (!req.user) {
    return res.json([]);
  }

  try {
    const allProgress = await GameProgress.find({ userId: req.user._id }).sort({ lastPlayed: -1 });
    res.json(allProgress);
  } catch (error) {
    console.error('Error loading all game progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game route - clean URL with slug only (supports both MongoDB games and GameMonetize games)
app.get('/game/:slug', (req, res) => {
  // Always serve game.html - it will handle loading the game via API
  // This allows both MongoDB games and GameMonetize games to work
  res.sendFile(path.join(__dirname, 'game.html'));
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.IO connection handling
io.use(async (socket, next) => {
  // Authentication will be handled via query params or handshake
  next();
});

// Typing users tracking (shared across all sockets)
const typingUsersMap = new Map(); // socket.id -> { userId, username, roomId }

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Send recent messages
    try {
      const messages = await ChatMessage.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('userId', 'username picture role')
        .lean();
      
      // Add isAdmin flag based on user role
      messages.forEach(msg => {
        if (msg.userId && msg.userId.role === 'admin') {
          msg.isAdmin = true;
        }
      });
      
      socket.emit('room-messages', messages.reverse());
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  });

  // Leave room
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { roomId, userId, username, userPicture, message, isAdmin: clientIsAdmin } = data;
      
      // Get user from database to verify admin status
      const user = await User.findById(userId);
      if (!user) {
        socket.emit('error', { message: 'משתמש לא נמצא' });
        return;
      }
      
      const isAdmin = user.role === 'admin';
      
      // Check if user is banned or muted
      const moderation = await UserModeration.findOne({ userId });
      if (moderation) {
        if (moderation.banned) {
          if (moderation.bannedUntil && moderation.bannedUntil > new Date()) {
            socket.emit('error', { message: `אתה חסום עד ${moderation.bannedUntil.toLocaleString('he-IL')}` });
            return;
          } else if (!moderation.bannedUntil) {
            socket.emit('error', { message: 'אתה חסום מהאתר' });
            // Emit ban notice to user
            io.to(socket.id).emit('user-banned', { 
              reason: moderation.reason || 'הורחק על ידי מנהל',
              permanent: true
            });
            return;
          } else {
            // Ban expired, remove it
            moderation.banned = false;
            moderation.bannedUntil = null;
            await moderation.save();
          }
        }
        
        if (moderation.muted) {
          if (moderation.mutedUntil && moderation.mutedUntil > new Date()) {
            socket.emit('error', { message: `אתה מושתק עד ${moderation.mutedUntil.toLocaleString('he-IL')}` });
            return;
          } else if (!moderation.mutedUntil) {
            socket.emit('error', { message: 'אתה מושתק' });
            return;
          } else {
            // Mute expired, remove it
            moderation.muted = false;
            moderation.mutedUntil = null;
            await moderation.save();
          }
        }
      }
      
      // Check if room is admin-only
      const room = await ChatRoom.findById(roomId);
      if (room && room.adminOnly && !isAdmin) {
        socket.emit('error', { message: 'רק מנהלים יכולים לשלוח הודעות בחדר זה' });
        return;
      }
      
      const chatMessage = new ChatMessage({
        roomId,
        userId,
        username,
        userPicture,
        isAdmin: isAdmin || false,
        message
      });
      
      await chatMessage.save();
      
      // Broadcast to all users in the room
      io.to(roomId).emit('new-message', {
        _id: chatMessage._id,
        roomId: chatMessage.roomId,
        userId: chatMessage.userId,
        username: chatMessage.username,
        userPicture: chatMessage.userPicture,
        isAdmin: chatMessage.isAdmin,
        message: chatMessage.message,
        createdAt: chatMessage.createdAt
      });
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing-start', (data) => {
    const { roomId, userId, username } = data;
    typingUsersMap.set(socket.id, { userId, username, roomId });
    socket.to(roomId).emit('user-typing', { userId, username, roomId, typing: true });
  });
  
  socket.on('typing-stop', (data) => {
    const { roomId } = data;
    const userInfo = typingUsersMap.get(socket.id);
    if (userInfo) {
      typingUsersMap.delete(socket.id);
      socket.to(roomId).emit('user-typing', { 
        userId: userInfo.userId, 
        username: userInfo.username, 
        roomId: userInfo.roomId, 
        typing: false 
      });
    }
  });

  socket.on('disconnect', () => {
    // Clean up typing indicator on disconnect
    const userInfo = typingUsersMap.get(socket.id);
    if (userInfo) {
      typingUsersMap.delete(socket.id);
      socket.to(userInfo.roomId).emit('user-typing', { 
        userId: userInfo.userId, 
        username: userInfo.username, 
        roomId: userInfo.roomId, 
        typing: false 
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

// Chat API endpoints
app.get('/api/chat/rooms', async (req, res) => {
  try {
    const rooms = await ChatRoom.find({ type: 'public' })
      .populate('createdBy', 'username picture')
      .sort({ createdAt: -1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/rooms', isAdmin, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { name, description } = req.body;
    const room = new ChatRoom({
      name,
      description,
      createdBy: req.user._id,
      members: [req.user._id]
    });
    await room.save();
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat/rooms/:roomId/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ roomId: req.params.roomId })
      .populate('userId', 'username picture role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    // Add isAdmin flag based on user role
    messages.forEach(msg => {
      if (msg.userId && msg.userId.role === 'admin') {
        msg.isAdmin = true;
      }
    });
    
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin moderation endpoints
app.post('/api/admin/chat/ban', isAdmin, async (req, res) => {
  try {
    const { userId, reason, duration } = req.body; // duration in hours, null for permanent
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Convert userId string to ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    let bannedUntil = null;
    if (duration) {
      bannedUntil = new Date();
      bannedUntil.setHours(bannedUntil.getHours() + duration);
    }
    
    const moderation = await UserModeration.findOneAndUpdate(
      { userId: userObjectId },
      {
        banned: true,
        bannedUntil,
        reason: reason || 'הורחק על ידי מנהל',
        bannedBy: req.user._id
      },
      { upsert: true, new: true }
    );
    
    // Emit ban notice to user
    io.emit('user-banned', {
      userId: userObjectId.toString(),
      reason: moderation.reason,
      permanent: !bannedUntil
    });
    
    res.json({ success: true, moderation });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/chat/unban', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Convert userId string to ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const moderation = await UserModeration.findOneAndUpdate(
      { userId: userObjectId },
      { banned: false, bannedUntil: null },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/chat/mute', isAdmin, async (req, res) => {
  try {
    const { userId, duration } = req.body; // duration in hours
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    if (!duration || duration < 1) {
      return res.status(400).json({ error: 'duration must be at least 1 hour' });
    }
    
    // Convert userId string to ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    let mutedUntil = null;
    if (duration) {
      mutedUntil = new Date();
      mutedUntil.setHours(mutedUntil.getHours() + duration);
    }
    
    const moderation = await UserModeration.findOneAndUpdate(
      { userId: userObjectId },
      {
        muted: true,
        mutedUntil
      },
      { upsert: true, new: true }
    );
    
    // Emit mute notice to user
    io.emit('user-muted', {
      userId: userObjectId.toString(),
      until: mutedUntil
    });
    
    res.json({ success: true, moderation });
  } catch (error) {
    console.error('Error muting user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/chat/unmute', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Convert userId string to ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
    
    const moderation = await UserModeration.findOneAndUpdate(
      { userId: userObjectId },
      { muted: false, mutedUntil: null },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error unmuting user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/chat/messages/:messageId', isAdmin, async (req, res) => {
  try {
    const message = await ChatMessage.findByIdAndDelete(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Broadcast deletion to all users
    io.emit('message-deleted', { messageId: req.params.messageId });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/chat/messages/:messageId', isAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const updatedMessage = await ChatMessage.findByIdAndUpdate(
      req.params.messageId,
      { message, edited: true, editedAt: new Date() },
      { new: true }
    ).populate('userId', 'username picture role');
    
    if (!updatedMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Add isAdmin flag
    const isAdmin = updatedMessage.userId && updatedMessage.userId.role === 'admin';
    const messageData = updatedMessage.toObject();
    messageData.isAdmin = isAdmin;
    
    // Broadcast edit to all users
    io.emit('message-edited', {
      messageId: req.params.messageId,
      message: updatedMessage.message,
      edited: true,
      editedAt: updatedMessage.editedAt
    });
    
    res.json({ success: true, message: messageData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📋 IMPORTANT: Add this callback URL to Google Cloud Console:`);
  console.log(`   ${CALLBACK_URL}\n`);
  console.log(`   1. Go to: https://console.cloud.google.com/apis/credentials`);
  console.log(`   2. Select your Client ID: 223913843113-k5fuv4u35rm0oq9g9o548iboekia1hll`);
  console.log(`   3. Add "${CALLBACK_URL}" to "Authorized redirect URIs"`);
  console.log(`   4. Click SAVE\n`);
});

