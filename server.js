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

// Request Queue and Rate Limiting
const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
const MAX_QUEUE_SIZE = 100; // Maximum queue size
const MAX_CACHE_SIZE = 50; // Maximum cache entries

// Circuit Breaker Pattern
const circuitBreaker = {
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  successCount: 0,
  lastFailureTime: 0,
  failureThreshold: 5, // Open circuit after 5 failures
  successThreshold: 2, // Close circuit after 2 successes
  timeout: 60000, // 60 seconds timeout before trying again
  resetTimeout: 300000 // 5 minutes before resetting failure count
};

// Connection Pool
const activeRequests = new Map();
const MAX_CONCURRENT_REQUESTS = 3; // Maximum concurrent requests to API

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
// Ensure we always use 'jumpigames' database
let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jumpigames';

// Replace /jumpi with /jumpigames (common mistake) - handle both with and without query params
// Force replace /jumpi with /jumpigames (more aggressive - handles ? and end of string)
mongoUri = mongoUri.replace(/\/jumpi(\?|$|&)/g, '/jumpigames$1');

// Replace /test with /jumpigames if needed
mongoUri = mongoUri.replace(/\/test(\?|$|&)/g, '/jumpigames$1');

// If MONGODB_URI doesn't contain a database name, add /jumpigames
// Check if URI has /? or ends with / or has no database name before ?
if (mongoUri && !mongoUri.match(/\/jumpigames(\?|&|$)/) && !mongoUri.endsWith('/jumpigames')) {
  // Case 1: URI ends with /? (no database name)
  if (mongoUri.match(/\/\?/)) {
    mongoUri = mongoUri.replace(/\/\?/, '/jumpigames?');
  }
  // Case 2: URI ends with / (no database name, no query params)
  else if (mongoUri.endsWith('/')) {
    mongoUri = mongoUri + 'jumpigames';
  }
  // Case 3: URI has ? but no database name before it (e.g., host/?params)
  else if (mongoUri.includes('?') && !mongoUri.match(/\/[^\/\?]+\?/)) {
    const queryParams = mongoUri.match(/(\?.*)$/);
    if (queryParams) {
      mongoUri = mongoUri.replace(/\?.*$/, '') + '/jumpigames' + queryParams[0];
    }
  }
  // Case 4: URI has no database name and no query params
  else if (!mongoUri.match(/\/[^\/]+(\?|&|$)/)) {
    mongoUri = mongoUri + '/jumpigames';
  }
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  // Extract database name from URI for logging
  // Match pattern: /databaseName? or /databaseName at end
  const dbMatch = mongoUri.match(/\/([^\/\?]+)(\?|$)/);
  const dbName = dbMatch && dbMatch[1] ? dbMatch[1] : 'unknown';
  console.log(`✅ Connected to MongoDB database: ${dbName}`);
  console.log('MongoDB URI (sanitized):', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials in log
  
  // Verify it's jumpigames
  if (dbName !== 'jumpigames') {
    console.warn(`⚠️  WARNING: Connected to database "${dbName}" instead of "jumpigames"!`);
    console.warn(`⚠️  Please check your MONGODB_URI environment variable.`);
  }
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
  diamonds: { type: Number, default: 0 }, // יהלומים
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
  isOwner: { type: Boolean, default: false }, // Owner badge
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

// Daily Bonus Schema - tracks daily bonus claims
const dailyBonusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastClaimDate: Date, // Last date bonus was claimed
  currentStreakDay: { type: Number, default: 0 }, // Current day in streak (0 = no streak, 1-7 = day in week)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const DailyBonus = mongoose.model('DailyBonus', dailyBonusSchema);

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

// Notification Schema - התראות כלליות שנשלחות לכל המשתמשים
const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'success', 'error'], default: 'info' },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// UserNotification Schema - מעקב אחרי התראות שראה/קרא כל משתמש
const userNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', required: true },
  seen: { type: Boolean, default: false }, // נראתה
  read: { type: Boolean, default: false }, // נקראה
  seenAt: Date,
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
});

// Compound unique index - כל משתמש יכול להיות קשור להתראה פעם אחת בלבד
userNotificationSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

const UserNotification = mongoose.model('UserNotification', userNotificationSchema);

// Task Progress Schema - tracks user's task completion progress
const taskProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String, enum: ['daily', 'weekly'], required: true },
  taskId: { type: String, required: true }, // e.g., 'play_random_game', 'play_5_games'
  progress: { type: Number, default: 0 }, // Current progress (e.g., 3/5 games played)
  target: { type: Number, required: true }, // Target value (e.g., 5 games)
  completed: { type: Boolean, default: false },
  completedAt: Date,
  claimed: { type: Boolean, default: false }, // Whether reward was claimed
  claimedAt: Date,
  periodStart: { type: Date, required: true }, // Start date for daily/weekly period
  periodEnd: { type: Date, required: true }, // End date for daily/weekly period
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // Additional data (e.g., played games list)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound unique index - one task progress per user per task per period
taskProgressSchema.index({ userId: 1, taskType: 1, taskId: 1, periodStart: 1 }, { unique: true });

const TaskProgress = mongoose.model('TaskProgress', taskProgressSchema);

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

// Passport Google Strategy - Determine environment BEFORE session setup
// Determine if we're in production (Railway) or development
// Check for explicit PRODUCTION flag, or if callback URL contains jumpigames.com
const isProduction = process.env.PRODUCTION === 'true' || 
                     process.env.RAILWAY_ENVIRONMENT || 
                     process.env.RAILWAY_DOMAIN || 
                     process.env.RAILWAY_PUBLIC_DOMAIN || 
                     (process.env.GOOGLE_CALLBACK_URL && process.env.GOOGLE_CALLBACK_URL.includes('jumpigames.com')) ||
                     (process.env.NODE_ENV === 'production' && !process.env.LOCAL);
const BASE_URL = isProduction ? 'https://jumpigames.com' : 'http://localhost:3000';
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || `${BASE_URL}/auth/google/callback`;

// Determine if we should use secure cookies
const useSecureCookies = process.env.NODE_ENV === 'production' || isProduction || process.env.RAILWAY_ENVIRONMENT === 'production';

// Trust proxy - required for Railway to detect HTTPS correctly
if (isProduction || process.env.RAILWAY_ENVIRONMENT) {
  app.set('trust proxy', 1);
}

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
      'https://jumpigames.com',
      'https://www.jumpigames.com',
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

// Handle favicon request to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use(express.static(path.join(__dirname)));

app.use(session({
  secret: process.env.SESSION_SECRET || 'jumpigames-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: useSecureCookies,
    httpOnly: true,
    sameSite: useSecureCookies ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Log for debugging
console.log('🔍 Environment detection:', {
  isProduction,
  BASE_URL,
  CALLBACK_URL,
  NODE_ENV: process.env.NODE_ENV,
  PRODUCTION: process.env.PRODUCTION,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
});

// Check if Google OAuth credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
} else {
  console.warn('⚠️  Warning: Google OAuth credentials not configured. Google login will not be available.');
  console.warn('Please set the following environment variables in Railway:');
  console.warn('  - GOOGLE_CLIENT_ID');
  console.warn('  - GOOGLE_CLIENT_SECRET');
  console.warn('  - GOOGLE_CALLBACK_URL (optional, defaults to https://jumpigames.com/auth/google/callback)');
}

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
// Google OAuth routes - only available if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${BASE_URL}/login.html?error=oauth_failed` }),
    async (req, res) => {
      try {
        // Log for debugging
        console.log('OAuth callback - req.user:', req.user ? { id: req.user._id, email: req.user.email, registered: req.user.registered } : 'null');
        
        // If req.user is not available, try to get it from session
        if (!req.user && req.session && req.session.passport && req.session.passport.user) {
          try {
            req.user = await User.findById(req.session.passport.user);
            console.log('Loaded user from session:', req.user ? { id: req.user._id, email: req.user.email, registered: req.user.registered } : 'null');
          } catch (error) {
            console.error('Error loading user from session:', error);
          }
        }
        
        // Check if user is registered
        if (!req.user) {
          console.error('No user found in OAuth callback');
          const host = req.get('host') || '';
          // Check x-forwarded-proto first (Railway proxy), then req.protocol
          const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
          const isProductionRequest = host.includes('jumpigames.com') || 
                                       host.includes('.railway.app') || 
                                       isProduction;
          const loginUrl = isProductionRequest 
            ? 'https://jumpigames.com/login.html?error=oauth_failed' 
            : 'http://localhost:3000/login.html?error=oauth_failed';
          return res.redirect(loginUrl);
        }
        
        if (!req.user.registered) {
          // User is not registered - redirect to login page to complete registration
          // Save session explicitly before redirect
          req.session.save((err) => {
            if (err) {
              console.error('Error saving session:', err);
            }
            
            const host = req.get('host') || '';
            // Check x-forwarded-proto first (Railway proxy), then req.protocol
            const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
            const isProductionRequest = host.includes('jumpigames.com') || 
                                         host.includes('.railway.app') || 
                                         isProduction;
            
            const loginUrl = isProductionRequest 
              ? 'https://jumpigames.com/login.html?success=1' 
              : 'http://localhost:3000/login.html?success=1';
            console.log('OAuth callback redirect (not registered):', { userId: req.user._id, email: req.user.email, host, protocol, isProductionRequest, loginUrl });
            res.redirect(loginUrl);
          });
          return;
        }
        
        // User is registered - redirect to home page
        // Save session explicitly before redirect
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
          }
          
          const host = req.get('host') || '';
          // Check x-forwarded-proto first (Railway proxy), then req.protocol
          const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
          const isProductionRequest = host.includes('jumpigames.com') || 
                                       host.includes('.railway.app') || 
                                       isProduction;
          
          const redirectUrl = isProductionRequest ? 'https://jumpigames.com/' : 'http://localhost:3000/';
          console.log('OAuth callback redirect (registered):', { userId: req.user._id, email: req.user.email, host, protocol, isProductionRequest, redirectUrl });
          res.redirect(redirectUrl);
        });
        return;
      } catch (error) {
        console.error('Error in OAuth callback:', error);
        const host = req.get('host') || '';
        // Check x-forwarded-proto first (Railway proxy), then req.protocol
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const isProductionRequest = host.includes('jumpigames.com') || 
                                     host.includes('.railway.app') || 
                                     isProduction;
        const loginUrl = isProductionRequest 
          ? 'https://jumpigames.com/login.html?error=oauth_failed' 
          : 'http://localhost:3000/login.html?error=oauth_failed';
        res.redirect(loginUrl);
      }
    }
  );
} else {
  // Fallback routes if Google OAuth is not configured
  app.get('/auth/google', (req, res) => {
    const errorMessage = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google OAuth לא מוגדר</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #1a1a2e; color: #fff; }
          .error-box { background: rgba(255,77,79,.1); border: 2px solid #ff4d4f; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; }
          h1 { color: #ff4d4f; margin-bottom: 20px; }
          code { background: rgba(0,0,0,.3); padding: 8px; border-radius: 6px; display: block; margin: 10px 0; }
          ol { text-align: right; margin: 20px 0; }
          li { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="error-box">
          <h1>⚠️ Google OAuth לא מוגדר</h1>
          <p>יש להוסיף משתני סביבה ב-Railway:</p>
          <ol>
            <li>פתח את הפרויקט ב-Railway</li>
            <li>לך ל-Variables (או Settings > Variables)</li>
            <li>הוסף את המשתנים הבאים:</li>
          </ol>
          <code>GOOGLE_CLIENT_ID = [הכנס את ה-Client ID שלך מ-Google Cloud Console]</code>
          <code>GOOGLE_CLIENT_SECRET = [הכנס את ה-Client Secret שלך מ-Google Cloud Console]</code>
          <code>GOOGLE_CALLBACK_URL = https://jumpigames.com/auth/google/callback</code>
          <p style="margin-top: 20px;">אחרי הוספת המשתנים, השרת יתחיל מחדש אוטומטית.</p>
        </div>
      </body>
      </html>
    `;
    res.status(503).send(errorMessage);
  });

  app.get('/auth/google/callback', (req, res) => {
    const errorMessage = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google OAuth לא מוגדר</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #1a1a2e; color: #fff; }
          .error-box { background: rgba(255,77,79,.1); border: 2px solid #ff4d4f; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; }
          h1 { color: #ff4d4f; margin-bottom: 20px; }
          code { background: rgba(0,0,0,.3); padding: 8px; border-radius: 6px; display: block; margin: 10px 0; }
          ol { text-align: right; margin: 20px 0; }
          li { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="error-box">
          <h1>⚠️ Google OAuth לא מוגדר</h1>
          <p>יש להוסיף משתני סביבה ב-Railway:</p>
          <ol>
            <li>פתח את הפרויקט ב-Railway</li>
            <li>לך ל-Variables (או Settings > Variables)</li>
            <li>הוסף את המשתנים הבאים:</li>
          </ol>
          <code>GOOGLE_CLIENT_ID = [הכנס את ה-Client ID שלך מ-Google Cloud Console]</code>
          <code>GOOGLE_CLIENT_SECRET = [הכנס את ה-Client Secret שלך מ-Google Cloud Console]</code>
          <code>GOOGLE_CALLBACK_URL = https://jumpigames.com/auth/google/callback</code>
          <p style="margin-top: 20px;">אחרי הוספת המשתנים, השרת יתחיל מחדש אוטומטית.</p>
        </div>
      </body>
      </html>
    `;
    res.status(503).send(errorMessage);
  });
}

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
      role: req.user.role,
      diamonds: req.user.diamonds || 0
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
  // Allow access for admin role or owner email
  const isOwner = req.user.email === 'ilanvx@gmail.com';
  if (req.user.role !== 'admin' && !isOwner) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

// Circuit Breaker Management
function updateCircuitBreaker(success) {
  const now = Date.now();
  
  if (success) {
    circuitBreaker.successCount++;
    circuitBreaker.failureCount = 0;
    
    if (circuitBreaker.state === 'HALF_OPEN' && circuitBreaker.successCount >= circuitBreaker.successThreshold) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.successCount = 0;
      console.log('✅ Circuit breaker CLOSED - API is healthy');
    }
  } else {
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = now;
    
    if (circuitBreaker.state === 'CLOSED' && circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
      circuitBreaker.state = 'OPEN';
      console.warn('⚠️ Circuit breaker OPENED - API is failing');
    } else if (circuitBreaker.state === 'HALF_OPEN') {
      circuitBreaker.state = 'OPEN';
      console.warn('⚠️ Circuit breaker OPENED again - API still failing');
    }
  }
  
  // Reset failure count after timeout
  if (circuitBreaker.state === 'OPEN' && now - circuitBreaker.lastFailureTime > circuitBreaker.resetTimeout) {
    circuitBreaker.failureCount = 0;
  }
  
  // Try to move from OPEN to HALF_OPEN after timeout
  if (circuitBreaker.state === 'OPEN' && now - circuitBreaker.lastFailureTime > circuitBreaker.timeout) {
    circuitBreaker.state = 'HALF_OPEN';
    circuitBreaker.successCount = 0;
    console.log('🔄 Circuit breaker HALF_OPEN - testing API');
  }
}

// Cache Management - Limit cache size
function manageCacheSize() {
  if (gamesCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries
    const entries = Array.from(gamesCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => gamesCache.delete(key));
    console.log(`🧹 Cleaned ${toRemove.length} old cache entries`);
  }
}

// Process Request Queue
async function processRequestQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }
  
  // Check circuit breaker
  if (circuitBreaker.state === 'OPEN') {
    const now = Date.now();
    if (now - circuitBreaker.lastFailureTime < circuitBreaker.timeout) {
      // Reject all queued requests
      while (requestQueue.length > 0) {
        const { reject } = requestQueue.shift();
        reject(new Error('Circuit breaker is OPEN - API is temporarily unavailable'));
      }
      return;
    }
  }
  
  // Check concurrent requests limit
  if (activeRequests.size >= MAX_CONCURRENT_REQUESTS) {
    return;
  }
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0 && activeRequests.size < MAX_CONCURRENT_REQUESTS) {
    const { page, resolve, reject } = requestQueue.shift();
    
    // Rate limiting - ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      setTimeout(() => {
        requestQueue.unshift({ page, resolve, reject });
        isProcessingQueue = false;
        processRequestQueue();
      }, delay);
      return;
    }
    
    // Execute request
    executeRequest(page, resolve, reject);
  }
  
  isProcessingQueue = false;
}

// Execute actual HTTP request
function executeRequest(page, resolve, reject) {
  const requestId = `${page}_${Date.now()}`;
  activeRequests.set(requestId, { page, startTime: Date.now() });
  lastRequestTime = Date.now();
  
  const url = `https://gamemonetize.com/feed.php?format=0&page=${page}`;
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*'
    },
    timeout: 10000 // 10 second timeout
  };
  
  const req = https.get(url, options, (res) => {
    // Handle rate limiting (429)
    if (res.statusCode === 429) {
      activeRequests.delete(requestId);
      updateCircuitBreaker(false);
      return reject(new Error(`HTTP 429: Too Many Requests - Rate limited by GameMonetize`));
    }
    
    // Check for redirects
    if (res.statusCode === 301 || res.statusCode === 302) {
      activeRequests.delete(requestId);
      updateCircuitBreaker(false);
      return reject(new Error(`Redirected: ${res.headers.location || 'unknown'}`));
    }
    
    if (res.statusCode !== 200) {
      activeRequests.delete(requestId);
      updateCircuitBreaker(false);
      return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
    }
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
      // Prevent memory issues with large responses
      if (data.length > 10 * 1024 * 1024) { // 10MB limit
        res.destroy();
        activeRequests.delete(requestId);
        updateCircuitBreaker(false);
        return reject(new Error('Response too large'));
      }
    });
    
    res.on('end', () => {
      activeRequests.delete(requestId);
      
      try {
        if (!data || data.trim().length === 0) {
          updateCircuitBreaker(false);
          return reject(new Error('Empty response from GameMonetize API'));
        }
        
        // Check if response is an error message
        const dataTrimmed = data.trim();
        if (dataTrimmed.toLowerCase().includes('error') || dataTrimmed.toLowerCase().includes('1015')) {
          console.error('GameMonetize API error response:', dataTrimmed.substring(0, 200));
          updateCircuitBreaker(false);
          return reject(new Error(`GameMonetize API error: ${dataTrimmed.substring(0, 100)}`));
        }
        
        // Try to parse JSON
        let games;
        try {
          games = JSON.parse(data);
        } catch (parseError) {
          console.error('JSON parse error:', parseError.message);
          updateCircuitBreaker(false);
          return reject(new Error(`Failed to parse JSON response`));
        }
        
        // Check if games is an array
        if (!Array.isArray(games)) {
          console.error('Unexpected response format:', typeof games);
          updateCircuitBreaker(false);
          return reject(new Error('Invalid response format from GameMonetize API - expected array'));
        }
        
        // Cache the result
        const cacheKey = `page_${page}`;
        gamesCache.set(cacheKey, { data: games, timestamp: Date.now() });
        manageCacheSize();
        
        updateCircuitBreaker(true);
        resolve(games);
      } catch (error) {
        updateCircuitBreaker(false);
        reject(error);
      }
    });
  });
  
  req.on('error', (error) => {
    activeRequests.delete(requestId);
    updateCircuitBreaker(false);
    console.error('HTTPS request error:', error.message);
    reject(error);
  });
  
  req.on('timeout', () => {
    req.destroy();
    activeRequests.delete(requestId);
    updateCircuitBreaker(false);
    reject(new Error('Request timeout'));
  });
  
  req.setTimeout(options.timeout);
}

// Helper function to fetch from GameMonetize API with queue and circuit breaker
function fetchGameMonetizeFeed(page = 1) {
  return new Promise((resolve, reject) => {
    // Check cache first
    const cacheKey = `page_${page}`;
    const cached = gamesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return resolve(cached.data);
    }
    
    // Check queue size
    if (requestQueue.length >= MAX_QUEUE_SIZE) {
      return reject(new Error('Request queue is full - too many pending requests'));
    }
    
    // Add to queue
    requestQueue.push({ page, resolve, reject });
    
    // Process queue
    processRequestQueue();
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
    
    // Always try to return cached data if available (graceful degradation)
    const cacheKey = `page_${page}`;
    const cached = gamesCache.get(cacheKey);
    if (cached && cached.data) {
      console.log('API error, returning cached data as fallback');
      let cachedGames = cached.data;
      
      // Format cached games
      let formattedGames = cachedGames.map(game => {
        if (!game || typeof game !== 'object') {
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
      }).filter(game => game !== null);
      
      // Filter by category if needed
      if (category) {
        formattedGames = formattedGames.filter(game => {
          const gameCategory = game.category || '';
          const gameTags = (game.tags || '').toLowerCase();
          
          if (category.toLowerCase() === 'multiplayer') {
            return gameTags.includes('multiplayer') || gameTags.includes('online') || gameCategory.toLowerCase().includes('multiplayer');
          }
          if (category.toLowerCase() === '2 player games' || category.toLowerCase() === '2 player') {
            return gameTags.includes('2 player') || gameTags.includes('two player') || gameCategory.toLowerCase().includes('2 player');
          }
          
          return gameCategory && gameCategory.toLowerCase() === category.toLowerCase();
        });
      }
      
      // Return cached data with warning header
      res.set('X-Cache-Status', 'stale');
      res.set('X-API-Status', 'unavailable');
      return res.json(formattedGames);
    }
    
    // No cached data available - return error
    const errorMessage = error.message || 'Failed to fetch games from GameMonetize';
    
    // Check for specific error types
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return res.status(503).json({ 
        error: 'GameMonetize API is temporarily unavailable (rate limited). Please try again in a few minutes.',
        cached: false
      });
    }
    
    if (errorMessage.includes('1015') || errorMessage.includes('Cloudflare')) {
      return res.status(503).json({ 
        error: 'GameMonetize API is temporarily unavailable (blocked by Cloudflare). Please try again later.',
        cached: false
      });
    }
    
    if (errorMessage.includes('Circuit breaker') || errorMessage.includes('OPEN')) {
      return res.status(503).json({ 
        error: 'GameMonetize API is temporarily unavailable. Please try again in a few minutes.',
        cached: false
      });
    }
    
    // Generic error
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch games from GameMonetize',
      message: errorMessage,
      cached: false
    });
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

// Check if a specific game is favorited (GET endpoint)
app.get('/api/favorites/:gameId', requireAuth, async (req, res) => {
  try {
    // Decode the gameId to handle encoded characters like colons
    const gameId = decodeURIComponent(req.params.gameId);
    
    // Check if it's a MongoDB ObjectId or GameMonetize string ID
    const isMongoId = mongoose.Types.ObjectId.isValid(gameId) && gameId.length === 24;
    
    let favorite;
    if (isMongoId) {
      favorite = await Favorite.findOne({ userId: req.user._id, gameId });
    } else {
      favorite = await Favorite.findOne({ userId: req.user._id, gameIdString: gameId });
    }
    
    res.json({ isFavorite: !!favorite, favorite: favorite || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/favorites/:gameId', requireAuth, async (req, res) => {
  try {
    // Decode the gameId to handle encoded characters like colons
    const gameId = decodeURIComponent(req.params.gameId);
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
    // Decode the gameId to handle encoded characters like colons
    const gameId = decodeURIComponent(req.params.gameId);
    
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

// Notifications API - Get user notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    // Get all active notifications
    const notifications = await Notification.find({ active: true })
      .populate('createdBy', 'username name')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get user's notification status for each notification
    const userNotifications = await UserNotification.find({ userId: req.user._id }).lean();
    const userNotificationMap = new Map();
    userNotifications.forEach(un => {
      userNotificationMap.set(un.notificationId.toString(), un);
    });
    
    // Add user status to each notification
    const notificationsWithStatus = notifications.map(notif => {
      const userNotif = userNotificationMap.get(notif._id.toString());
      return {
        ...notif,
        seen: userNotif ? userNotif.seen : false,
        read: userNotif ? userNotif.read : false
      };
    });
    
    res.json(notificationsWithStatus);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Get unread count
app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    // Get all active notifications
    const notifications = await Notification.find({ active: true }).select('_id').lean();
    const notificationIds = notifications.map(n => n._id);
    
    // Count notifications that user hasn't seen or read
    const userNotifications = await UserNotification.find({ 
      userId: req.user._id,
      notificationId: { $in: notificationIds }
    }).lean();
    
    const userNotificationMap = new Map();
    userNotifications.forEach(un => {
      userNotificationMap.set(un.notificationId.toString(), un);
    });
    
    let unreadCount = 0;
    notifications.forEach(notif => {
      const userNotif = userNotificationMap.get(notif._id.toString());
      if (!userNotif || !userNotif.seen || !userNotif.read) {
        unreadCount++;
      }
    });
    
    res.json({ count: unreadCount });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Mark as seen
app.post('/api/notifications/:notificationId/seen', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const userNotification = await UserNotification.findOneAndUpdate(
      { userId: req.user._id, notificationId },
      { seen: true, seenAt: new Date() },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, userNotification });
  } catch (error) {
    console.error('Error marking notification as seen:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Mark as read
app.post('/api/notifications/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const userNotification = await UserNotification.findOneAndUpdate(
      { userId: req.user._id, notificationId },
      { 
        seen: true, 
        read: true, 
        seenAt: new Date(),
        readAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, userNotification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Admin: Get all notifications
app.get('/api/admin/notifications', isAdmin, async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('createdBy', 'username name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Admin: Create notification
app.post('/api/admin/notifications', isAdmin, async (req, res) => {
  try {
    const { title, message, type } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    const notification = new Notification({
      title,
      message,
      type: type || 'info',
      active: true,
      createdBy: req.user._id
    });
    
    await notification.save();
    
    // When a new notification is created, it should be available to all users
    // We don't need to create UserNotification records - they will be created on-demand when users check notifications
    
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Admin: Update notification
app.put('/api/admin/notifications/:id', isAdmin, async (req, res) => {
  try {
    const { title, message, type, active } = req.body;
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (type !== undefined) updateData.type = type;
    if (active !== undefined) updateData.active = active;
    
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('createdBy', 'username name email');
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notifications API - Admin: Delete notification
app.delete('/api/admin/notifications/:id', isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Also delete all user notification records for this notification
    await UserNotification.deleteMany({ notificationId: req.params.id });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Diamonds API - Update diamonds
app.put('/api/user/diamonds', requireAuth, async (req, res) => {
  try {
    const { diamonds } = req.body;
    
    if (typeof diamonds !== 'number' || diamonds < 0) {
      return res.status(400).json({ error: 'Invalid diamonds value' });
    }
    
    req.user.diamonds = diamonds;
    await req.user.save();
    
    res.json({ success: true, diamonds: req.user.diamonds });
  } catch (error) {
    console.error('Error updating diamonds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to add diamonds to user
async function addDiamondsToUser(userId, amount) {
  try {
    const user = await User.findById(userId);
    if (user) {
      user.diamonds = (user.diamonds || 0) + amount;
      await user.save();
      return user.diamonds;
    }
    return null;
  } catch (error) {
    console.error('Error adding diamonds:', error);
    return null;
  }
}

// Helper function to get week start (Monday) and end (Sunday)
function getWeekStartEnd() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(now.setDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// Task Definitions
const DAILY_TASKS = [
  {
    id: 'play_random_game',
    title: 'שחק במשחק הבא: משחק רנדומלי',
    description: 'שחק במשחק רנדומלי',
    target: 1,
    reward: 15, // diamonds
    icon: 'fa-dice'
  },
  {
    id: 'play_5_games',
    title: 'שחק ב-5 משחקים שונים',
    description: 'שחק ב-5 משחקים שונים היום',
    target: 5,
    reward: 50, // diamonds
    icon: 'fa-gamepad'
  },
  {
    id: 'play_3_games',
    title: 'שחק ב-3 משחקים שונים',
    description: 'שחק ב-3 משחקים שונים היום',
    target: 3,
    reward: 30, // diamonds
    icon: 'fa-gamepad'
  },
  {
    id: 'play_1_game',
    title: 'שחק במשחק אחד',
    description: 'שחק במשחק אחד היום',
    target: 1,
    reward: 10, // diamonds
    icon: 'fa-play'
  }
];

const WEEKLY_TASKS = [
  {
    id: 'play_10_games',
    title: 'שחק ב-10 משחקים שונים',
    description: 'שחק ב-10 משחקים שונים השבוע',
    target: 10,
    reward: 100, // diamonds
    icon: 'fa-gamepad'
  },
  {
    id: 'play_20_games',
    title: 'שחק ב-20 משחקים שונים',
    description: 'שחק ב-20 משחקים שונים השבוע',
    target: 20,
    reward: 200, // diamonds
    icon: 'fa-trophy'
  },
  {
    id: 'play_5_days',
    title: 'שחק 5 ימים בשבוע',
    description: 'שחק לפחות משחק אחד ב-5 ימים שונים השבוע',
    target: 5,
    reward: 150, // diamonds
    icon: 'fa-calendar-days'
  }
];

// Tasks API - Get user tasks
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const today = getTodayMidnight();
    const { start: weekStart, end: weekEnd } = getWeekStartEnd();
    
    // Get all task progress for user
    const taskProgress = await TaskProgress.find({
      userId: req.user._id,
      $or: [
        { taskType: 'daily', periodStart: today },
        { taskType: 'weekly', periodStart: weekStart }
      ]
    }).lean();
    
    // Create a map of task progress
    const progressMap = new Map();
    taskProgress.forEach(tp => {
      const key = `${tp.taskType}_${tp.taskId}_${tp.periodStart.toISOString()}`;
      progressMap.set(key, tp);
    });
    
    // Build daily tasks with progress
    const dailyTasks = DAILY_TASKS.map(task => {
      const key = `daily_${task.id}_${today.toISOString()}`;
      const progress = progressMap.get(key);
      return {
        ...task,
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false,
        claimed: progress ? progress.claimed : false,
        progressId: progress ? progress._id.toString() : null
      };
    });
    
    // Build weekly tasks with progress
    const weeklyTasks = WEEKLY_TASKS.map(task => {
      const key = `weekly_${task.id}_${weekStart.toISOString()}`;
      const progress = progressMap.get(key);
      return {
        ...task,
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false,
        claimed: progress ? progress.claimed : false,
        progressId: progress ? progress._id.toString() : null
      };
    });
    
    res.json({
      daily: dailyTasks,
      weekly: weeklyTasks,
      periodStart: today.toISOString(),
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString()
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tasks API - Claim task reward
app.post('/api/tasks/:taskType/:taskId/claim', requireAuth, async (req, res) => {
  try {
    const { taskType, taskId } = req.params;
    const today = getTodayMidnight();
    const { start: weekStart, end: weekEnd } = getWeekStartEnd();
    
    const periodStart = taskType === 'daily' ? today : weekStart;
    const periodEnd = taskType === 'daily' ? today : weekEnd;
    
    // Find task progress
    const taskProgress = await TaskProgress.findOne({
      userId: req.user._id,
      taskType,
      taskId,
      periodStart
    });
    
    if (!taskProgress) {
      return res.status(404).json({ error: 'Task progress not found' });
    }
    
    if (!taskProgress.completed) {
      return res.status(400).json({ error: 'Task not completed yet' });
    }
    
    if (taskProgress.claimed) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }
    
    // Get task definition to get reward amount
    const taskDef = taskType === 'daily' 
      ? DAILY_TASKS.find(t => t.id === taskId)
      : WEEKLY_TASKS.find(t => t.id === taskId);
    
    if (!taskDef) {
      return res.status(404).json({ error: 'Task definition not found' });
    }
    
    // Add diamonds to user
    const newDiamondsTotal = await addDiamondsToUser(req.user._id, taskDef.reward);
    
    // Mark as claimed
    taskProgress.claimed = true;
    taskProgress.claimedAt = new Date();
    taskProgress.updatedAt = new Date();
    await taskProgress.save();
    
    res.json({
      success: true,
      reward: taskDef.reward,
      newDiamondsTotal,
      taskProgress
    });
  } catch (error) {
    console.error('Error claiming task reward:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to check and update task progress when game is played
async function checkTaskProgress(userId, gameSlug) {
  try {
    const today = getTodayMidnight();
    const { start: weekStart, end: weekEnd } = getWeekStartEnd();
    
    // Get all active tasks
    const allTasks = [
      ...DAILY_TASKS.map(t => ({ ...t, type: 'daily' })),
      ...WEEKLY_TASKS.map(t => ({ ...t, type: 'weekly' }))
    ];
    
    for (const task of allTasks) {
      const periodStart = task.type === 'daily' ? today : weekStart;
      const periodEnd = task.type === 'daily' ? today : weekEnd;
      
      // Find or create task progress
      let taskProgress = await TaskProgress.findOne({
        userId,
        taskType: task.type,
        taskId: task.id,
        periodStart
      });
      
      if (!taskProgress) {
        taskProgress = new TaskProgress({
          userId,
          taskType: task.type,
          taskId: task.id,
          target: task.target,
          periodStart,
          periodEnd,
          metadata: { playedGames: [] }
        });
      }
      
      // Skip if already completed
      if (taskProgress.completed) {
        continue;
      }
      
      // Update progress based on task type
      let updated = false;
      
      if (task.id === 'play_random_game' || task.id === 'play_1_game') {
        // Random game task or play 1 game - just mark as completed
        if (!taskProgress.completed) {
          taskProgress.progress = 1;
          taskProgress.completed = true;
          taskProgress.completedAt = new Date();
          updated = true;
        }
      } else if (task.id.includes('play_') && task.id.includes('_games')) {
        // Play N games task
        const playedGames = taskProgress.metadata?.playedGames || [];
        if (!playedGames.includes(gameSlug)) {
          playedGames.push(gameSlug);
          taskProgress.progress = playedGames.length;
          taskProgress.metadata = { ...taskProgress.metadata, playedGames };
          
          if (taskProgress.progress >= task.target) {
            taskProgress.completed = true;
            taskProgress.completedAt = new Date();
          }
          updated = true;
        }
      } else if (task.id === 'play_5_days') {
        // Play 5 days task - check if this is a new day
        const playedDays = taskProgress.metadata?.playedDays || [];
        const todayStr = today.toISOString().split('T')[0];
        if (!playedDays.includes(todayStr)) {
          playedDays.push(todayStr);
          taskProgress.progress = playedDays.length;
          taskProgress.metadata = { ...taskProgress.metadata, playedDays };
          
          if (taskProgress.progress >= task.target) {
            taskProgress.completed = true;
            taskProgress.completedAt = new Date();
          }
          updated = true;
        }
      }
      
      if (updated) {
        taskProgress.updatedAt = new Date();
        await taskProgress.save();
      }
    }
  } catch (error) {
    console.error('Error checking task progress:', error);
  }
}

// Helper function to get today's date at midnight (UTC)
function getTodayMidnight() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

// Helper function to check if two dates are the same day
function isSameDay(date1, date2) {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate();
}

// Daily bonus rewards - progressive rewards for consecutive days (cycles every 7 days)
const DAILY_BONUS_REWARDS = [
  10,  // Day 1: 10 diamonds
  20,  // Day 2: 20 diamonds
  30,  // Day 3: 30 diamonds
  50,  // Day 4: 50 diamonds
  75,  // Day 5: 75 diamonds
  100, // Day 6: 100 diamonds
  150  // Day 7: 150 diamonds (bonus day)
];

// Daily Bonus API - Get status
app.get('/api/daily-bonus/status', requireAuth, async (req, res) => {
  try {
    const today = getTodayMidnight();
    
    // Find or create daily bonus record
    let dailyBonus = await DailyBonus.findOne({ userId: req.user._id });
    
    if (!dailyBonus) {
      // First time - create new record
      return res.json({
        canClaim: true,
        currentStreakDay: 0,
        nextReward: DAILY_BONUS_REWARDS[0],
        lastClaimDate: null
      });
    }
    
    // Check if already claimed today
    const lastClaimDate = dailyBonus.lastClaimDate ? new Date(dailyBonus.lastClaimDate) : null;
    const canClaim = !lastClaimDate || !isSameDay(lastClaimDate, today);
    
    // Calculate next reward day (if not claimed today, stay on current streak day)
    let nextRewardDay = dailyBonus.currentStreakDay;
    if (canClaim) {
      // If can claim and it's the next day, increment streak
      if (lastClaimDate) {
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        if (isSameDay(lastClaimDate, yesterday)) {
          // Consecutive day - increment streak
          nextRewardDay = (dailyBonus.currentStreakDay + 1) % 7;
        } else {
          // Missed days - reset to day 1 (but keep it on the cycle)
          // Actually, as requested: "הרצף לא יהרס אם לא יתחברו ויפספסו ימים. אבל פשוט זה ישאר על הפרס הבא."
          // So we keep the current streak day, just allow claiming
          nextRewardDay = dailyBonus.currentStreakDay;
        }
      } else {
        // First claim ever
        nextRewardDay = 0;
      }
    }
    
    res.json({
      canClaim,
      currentStreakDay: dailyBonus.currentStreakDay,
      nextReward: DAILY_BONUS_REWARDS[nextRewardDay],
      lastClaimDate: lastClaimDate ? lastClaimDate.toISOString() : null
    });
  } catch (error) {
    console.error('Error checking daily bonus status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Daily Bonus API - Claim bonus
app.post('/api/daily-bonus/claim', requireAuth, async (req, res) => {
  try {
    const today = getTodayMidnight();
    
    // Find or create daily bonus record
    let dailyBonus = await DailyBonus.findOne({ userId: req.user._id });
    
    if (!dailyBonus) {
      dailyBonus = new DailyBonus({
        userId: req.user._id,
        currentStreakDay: 0,
        lastClaimDate: today
      });
    } else {
      // Check if already claimed today
      const lastClaimDate = dailyBonus.lastClaimDate ? new Date(dailyBonus.lastClaimDate) : null;
      if (lastClaimDate && isSameDay(lastClaimDate, today)) {
        return res.status(400).json({ error: 'Bonus already claimed today' });
      }
      
      // Calculate new streak day
      if (lastClaimDate) {
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        if (isSameDay(lastClaimDate, yesterday)) {
          // Consecutive day - increment streak
          dailyBonus.currentStreakDay = (dailyBonus.currentStreakDay + 1) % 7;
        }
        // If missed days, keep current streak day (as requested)
      } else {
        // First claim ever
        dailyBonus.currentStreakDay = 0;
      }
      
      dailyBonus.lastClaimDate = today;
    }
    
    // Get reward for current streak day
    const reward = DAILY_BONUS_REWARDS[dailyBonus.currentStreakDay];
    
    // Add diamonds to user
    req.user.diamonds = (req.user.diamonds || 0) + reward;
    await req.user.save();
    
    // Save daily bonus record
    dailyBonus.updatedAt = new Date();
    await dailyBonus.save();
    
    // Calculate next reward day for response
    const nextRewardDay = (dailyBonus.currentStreakDay + 1) % 7;
    
    res.json({
      success: true,
      reward,
      newDiamondsTotal: req.user.diamonds,
      currentStreakDay: dailyBonus.currentStreakDay,
      nextReward: DAILY_BONUS_REWARDS[nextRewardDay],
      nextRewardDay: nextRewardDay
    });
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
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

    const isNewGame = !gameProgress;

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
    
    // Check task progress when game is played (asynchronously, don't wait for it)
    checkTaskProgress(req.user._id, gameSlug).catch(err => {
      console.error('Error checking task progress:', err);
    });
    
    res.json({ success: true, progress: gameProgress });
  } catch (error) {
    console.error('Error saving game progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Game Play API - Track when a game is played/opened (for tasks)
app.post('/api/game-play/:gameSlug', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { gameSlug } = req.params;
    
    // Check task progress when game is played (asynchronously, don't wait for it)
    checkTaskProgress(req.user._id, gameSlug).catch(err => {
      console.error('Error checking task progress:', err);
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking game play:', error);
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
        .populate('userId', 'username picture role email')
        .lean();
      
      // Add isAdmin and isOwner flags
      messages.forEach(msg => {
        if (msg.userId && msg.userId.role === 'admin') {
          msg.isAdmin = true;
        }
        if (msg.userId && msg.userId.email === 'ilanvx@gmail.com') {
          msg.isOwner = true;
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
      const isOwner = user.email === 'ilanvx@gmail.com'; // Owner badge for specific email
      
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
      if (room && room.adminOnly && !isAdmin && !isOwner) {
        socket.emit('error', { message: 'רק מנהלים יכולים לשלוח הודעות בחדר זה' });
        return;
      }
      
      const chatMessage = new ChatMessage({
        roomId,
        userId,
        username,
        userPicture,
        isAdmin: isAdmin || false,
        isOwner: isOwner || false,
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
        isOwner: chatMessage.isOwner,
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

app.post('/api/chat/rooms', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Allow only admin or owner to create rooms
  const isOwner = req.user.email === 'ilanvx@gmail.com';
  if (req.user.role !== 'admin' && !isOwner) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
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
      .populate('userId', 'username picture role email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    // Add isAdmin and isOwner flags
    messages.forEach(msg => {
      if (msg.userId && msg.userId.role === 'admin') {
        msg.isAdmin = true;
      }
      if (msg.userId && msg.userId.email === 'ilanvx@gmail.com') {
        msg.isOwner = true;
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

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    api: {
      circuitBreaker: circuitBreaker.state,
      queueSize: requestQueue.length,
      activeRequests: activeRequests.size,
      cacheSize: gamesCache.size
    },
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  
  res.json(health);
});

// Cleanup stale requests periodically
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 30000; // 30 seconds
  
  for (const [requestId, request] of activeRequests.entries()) {
    if (now - request.startTime > staleTimeout) {
      console.warn(`🧹 Cleaning up stale request: ${requestId}`);
      activeRequests.delete(requestId);
    }
  }
}, 10000); // Check every 10 seconds

server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📋 IMPORTANT: Add this callback URL to Google Cloud Console:`);
  console.log(`   ${CALLBACK_URL}\n`);
  console.log(`   1. Go to: https://console.cloud.google.com/apis/credentials`);
  console.log(`   2. Select your Client ID: 223913843113-k5fuv4u35rm0oq9g9o548iboekia1hll`);
  console.log(`   3. Add "${CALLBACK_URL}" to "Authorized redirect URIs"`);
  console.log(`   4. Click SAVE\n`);
});

