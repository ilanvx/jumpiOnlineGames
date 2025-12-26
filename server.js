const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Admin code - stored securely on server only
const ADMIN_CODE = '3281';

// Email setup - Using Resend (free tier: 3,000 emails/month)
// Get your API key from: https://resend.com/api-keys
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Trust proxy (required for Railway/Heroku)
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = [
  'https://jumpigames.com',
  'http://localhost:3000',
  'http://localhost'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development, restrict in production if needed
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware for authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'jumpi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static('.'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ilanvx:huyhucuruckuex123@jumpi.bvrlmrh.mongodb.net/jumpi?retryWrites=true&w=majority&appName=Jumpi';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB Atlas successfully');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.error('Please check your connection string and network access');
  process.exit(1);
});

// Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['parent', 'player'],
    required: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  agreedToTerms: {
    type: Boolean,
    required: true
  }
});

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'אימות נדרש' });
}

// Routes

// Login endpoint
app.post('/api/admin/login', (req, res) => {
  const { code } = req.body;
  
  if (code === ADMIN_CODE) {
    req.session.authenticated = true;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'שגיאה באימות' });
      }
      res.json({ success: true, message: 'אימות הצליח' });
    });
  } else {
    res.status(401).json({ error: 'קוד שגוי' });
  }
});

// Check authentication status
app.get('/api/admin/check-auth', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// Logout endpoint
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'שגיאה ביציאה' });
    }
    res.json({ success: true, message: 'יצאת בהצלחה' });
  });
});

// Newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { fullName, email, parentGroup, playerGroup, agree } = req.body;

    // Validation
    if (!fullName || !email || !agree) {
      return res.status(400).json({ error: 'נא למלא את כל השדות הנדרשים' });
    }

    if (!parentGroup && !playerGroup) {
      return res.status(400).json({ error: 'נא לבחור אם אתה הורה או שחקן' });
    }

    const type = parentGroup ? 'parent' : 'player';

    // Check if email already exists
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      return res.status(400).json({ error: 'אימייל זה כבר רשום במערכת' });
    }

    // Create new subscriber
    const subscriber = new Subscriber({
      name: fullName,
      email: email,
      type: type,
      agreedToTerms: agree === 'on' || agree === true
    });

    await subscriber.save();

    res.json({ 
      success: true, 
      message: 'נרשמת בהצלחה! תודה שנרשמת לקבלת עדכונים על ג\'אמפי.' 
    });
  } catch (error) {
    console.error('Subscription error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'אימייל זה כבר רשום במערכת' });
    }
    res.status(500).json({ error: 'שגיאה בהרשמה. נסה שוב מאוחר יותר.' });
  }
});

// Get all subscribers (for admin)
app.get('/api/admin/subscribers', requireAuth, async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });
    
    const formattedSubscribers = subscribers.map(sub => ({
      id: sub._id,
      name: sub.name,
      email: sub.email,
      type: sub.type,
      date: sub.subscribedAt.toISOString().split('T')[0]
    }));

    res.json(formattedSubscribers);
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הרשימה' });
  }
});

// Get subscriber statistics
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  try {
    const total = await Subscriber.countDocuments();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Subscriber.countDocuments({
      subscribedAt: { $gte: today }
    });

    res.json({
      total,
      today: todayCount
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסטטיסטיקה' });
  }
});

// Send update to all subscribers
app.post('/api/admin/send-update', requireAuth, async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'נא למלא נושא ותוכן ההודעה' });
    }

    // Check if Resend is configured
    if (!resend) {
      return res.status(500).json({ error: 'שליחת אימיילים לא מוגדרת. אנא הגדר RESEND_API_KEY בקובץ .env. הירשם ב-resend.com (חינמי - 3,000 מיילים/חודש)' });
    }

    // Get all subscribers
    const subscribers = await Subscriber.find({}, 'email name');

    if (subscribers.length === 0) {
      return res.json({ 
        success: true, 
        message: 'אין נרשמים לשלוח אליהם',
        sentTo: 0
      });
    }

    // Send email to each subscriber using Resend
    let successCount = 0;
    let failCount = 0;

    for (const subscriber of subscribers) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html dir="rtl" lang="he">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Heebo', Arial, sans-serif;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td dir="rtl" style="background: linear-gradient(135deg, #66d030 0%, #a1df70 100%); padding: 40px 30px; text-align: center; direction: rtl;">
                        <img src="https://jumpigames.com/logo.png" alt="ג'אמפי" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
                      </td>
                    </tr>
                    <!-- Greeting -->
                    <tr>
                      <td style="padding: 30px 30px 20px 30px;">
                        <h2 style="color: #0f3059; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">שלום ${subscriber.name},</h2>
                      </td>
                    </tr>
                    <!-- Update Title -->
                    <tr>
                      <td style="padding: 0 30px 20px 30px;">
                        <h3 style="color: #66d030; margin: 0; font-size: 20px; font-weight: 600; border-bottom: 2px solid #a1df70; padding-bottom: 10px;">${subject}</h3>
                      </td>
                    </tr>
                    <!-- Message Content -->
                    <tr>
                      <td style="padding: 0 30px 30px 30px;">
                        <div style="color: #333; font-size: 16px; line-height: 1.8; text-align: justify;">
                          ${message.replace(/\n/g, '<br>')}
                        </div>
                      </td>
                    </tr>
                    <!-- Social Media Section -->
                    <tr>
                      <td style="padding: 30px; background: linear-gradient(to bottom, #f0f9e8 0%, #ffffff 100%); border-top: 2px solid #e8f5d8;">
                        <div style="text-align: center; margin-bottom: 20px;">
                          <p style="color: #0f3059; font-size: 18px; font-weight: 600; margin: 0 0 25px 0;">עקבו אחרינו ברשתות החברתיות והתעדכנו בכל מה שחדש!</p>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                            <tr>
                              <td style="padding: 0 12px; text-align: center;">
                                <a href="https://www.youtube.com/@jumpiworld" style="text-decoration: none; display: inline-block;">
                                  <img src="https://jumpigames.com/icons/youtube.png" width="50" height="50" alt="YouTube" style="display: block; border: 0; outline: none; text-decoration: none;">
                                </a>
                              </td>
                              <td style="padding: 0 12px; text-align: center;">
                                <a href="https://www.instagram.com/jumpi.world/" style="text-decoration: none; display: inline-block;">
                                  <img src="https://jumpigames.com/icons/instagram.png" width="50" height="50" alt="Instagram" style="display: block; border: 0; outline: none; text-decoration: none;">
                                </a>
                              </td>
                              <td style="padding: 0 12px; text-align: center;">
                                <a href="https://discord.gg/vDpRYQkSq5" style="text-decoration: none; display: inline-block;">
                                  <img src="https://jumpigames.com/icons/discord.png" width="50" height="50" alt="Discord" style="display: block; border: 0; outline: none; text-decoration: none;">
                                </a>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <p style="color: #999; font-size: 12px; text-align: center; margin: 20px 0 0 0; padding-top: 15px; border-top: 1px solid #e0e0e0;">*אין אפשרות להשיב למייל זה.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Jumpi <onboarding@resend.dev>',
          to: subscriber.email,
          subject: subject,
          html: emailHtml
        });
        
        successCount++;
      } catch (emailError) {
        console.error(`Error sending email to ${subscriber.email}:`, emailError);
        failCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `העדכון נשלח בהצלחה ל-${successCount} נרשמים${failCount > 0 ? ` (${failCount} נכשלו)` : ''}`,
      sentTo: successCount,
      failed: failCount
    });
  } catch (error) {
    console.error('Send update error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת העדכון' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

