# JumpiGames Online

פלטפורמת משחקים אונליין עם התחברות Google OAuth ו-MongoDB.

## התקנה

### 1. התקן את ה-dependencies:

```bash
npm install
```

### 2. ודא ש-MongoDB רץ:

**אם MongoDB מותקן מקומית:**
```bash
mongod
```

**או השתמש ב-MongoDB Atlas (חינמי):**
- צור חשבון ב-[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- קבל את ה-connection string
- עדכן את `server.js` עם ה-connection string שלך

### 3. עדכן את Google OAuth callback URL:

ב-[Google Cloud Console](https://console.cloud.google.com/apis/credentials):
- בחר את ה-Client ID שלך
- ב-"Authorized redirect URIs" הוסף:
  - `http://localhost:3000/auth/google/callback`

### 4. הפעל את השרת:

```bash
npm start
```

או למצב פיתוח (עם auto-reload):
```bash
npm run dev
```

השרת יפעל על `http://localhost:3000`

### 5. פתח את האתר:

פתח את `index.html` בדפדפן (או דרך Live Server)

**הערה:** אם אתה משתמש ב-Live Server, ודא שהוא רץ על פורט אחר (למשל 5500) כדי לא להפריע לשרת.

## מבנה הפרויקט

- `server.js` - Backend עם Express, Passport, MongoDB
- `package.json` - Dependencies
- `index.html` - עמוד הבית
- `login.html` - עמוד התחברות
- `game.html` - עמוד משחק
- `styles.css` - עיצוב
- `script.js` - JavaScript צד לקוח

## API Endpoints

- `GET /auth/google` - התחברות עם Google
- `GET /auth/google/callback` - Callback מ-Google
- `GET /api/user` - קבלת משתמש נוכחי
- `POST /api/user/register` - השלמת הרשמה
- `POST /api/logout` - התנתקות

## משתני סביבה (אופציונלי)

תוכל ליצור קובץ `.env` עם:

```
MONGODB_URI=mongodb://localhost:27017/jumpigames
PORT=3000
SESSION_SECRET=your-secret-key-here
FRONTEND_URL=http://localhost:5500
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

ואז להשתמש ב-`dotenv` package.

