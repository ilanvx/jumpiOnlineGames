# Jumpi Website - Installation Guide

## התקנה והפעלה

### 1. התקנת תלויות
```bash
npm install
```

### 2. הגדרת MongoDB ו-Email

צור קובץ `.env` בתיקיית הפרויקט עם התוכן הבא:

```
PORT=3000
MONGODB_URI=mongodb+srv://ilanvx:huyhucuruckuex123@jumpi.bvrlmrh.mongodb.net/jumpi?retryWrites=true&w=majority&appName=Jumpi
SESSION_SECRET=your-secret-key-here-change-in-production

# Email configuration using Resend (FREE - 3,000 emails/month)
# 1. הירשם ב: https://resend.com/signup
# 2. קבל API key מ: https://resend.com/api-keys
# 3. הוסף את ה-API key כאן:
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=Jumpi <noreply@yourdomain.com>
# הערה: אם אין לך domain, תוכל להשתמש ב-onboarding@resend.dev לבדיקות
```

**הערות:**
- `SESSION_SECRET` - מפתח סודי ל-sessions (שנה בפרודקשן)
- `EMAIL_USER` - כתובת האימייל שלך
- `EMAIL_PASS` - App Password מ-Gmail (לא הסיסמה הרגילה)
  - עבור ל: Google Account > Security > 2-Step Verification > App passwords
  - צור App Password חדש ושימוש בו כאן

### 3. הפעלת השרת

#### פיתוח (עם auto-reload):
```bash
npm run dev
```

#### ייצור:
```bash
npm start
```

השרת יעבוד על פורט 3000 (או הפורט שהוגדר ב-.env)

### 4. גישה לאתר

- עמוד ראשי: http://localhost:3000
- פאנל ניהול: http://localhost:3000/admin.html
  - **קוד גישה:** 3281 (מוגדר בשרת, מאובטח)

## מבנה הפרויקט

- `server.js` - שרת Express עם MongoDB
- `index.html` - עמוד הראשי עם טופס הרשמה
- `admin.html` - פאנל ניהול
- `package.json` - תלויות הפרויקט

## API Endpoints

### POST /api/newsletter/subscribe
הרשמה לניוזלטר
```json
{
  "fullName": "שם מלא",
  "email": "email@example.com",
  "parentGroup": "parent" או null,
  "playerGroup": "player" או null,
  "agree": true
}
```

### GET /api/admin/subscribers
קבלת רשימת כל הנרשמים (לפאנל ניהול)

### GET /api/admin/stats
קבלת סטטיסטיקה (מספר נרשמים כולל והיום)

### POST /api/admin/send-update
שליחת עדכון לכל הנרשמים
```json
{
  "subject": "נושא ההודעה",
  "message": "תוכן ההודעה"
}
```

## אבטחה

- קוד הגישה לפאנל (3281) מאוחסן רק בשרת ולא נגיש מ-frontend
- השימוש ב-sessions לאבטחת API endpoints
- כל בקשות ה-admin דורשות אימות

## הערות

- ודא שיש לך MongoDB Atlas account וה-connection string נכון
- הקובץ `.env` לא נכלל ב-git (מופיע ב-.gitignore)
- לשליחת אימיילים: השתמש ב-App Password של Gmail, לא בסיסמה הרגילה
- בפרודקשן, שנה את `SESSION_SECRET` למפתח חזק וייחודי

