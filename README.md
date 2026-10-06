# Jumpi — מסך פתיחה עם התחברות והרשמה (MongoDB)

## מה יש בפרויקט

```
jumpi/
├── server.js          השרת: מתחבר ל-MongoDB ומגיש את המשחק
├── routes/auth.js     הרשמה, התחברות, התנתקות, בדיקת שם משתמש/אימייל
├── models/User.js     מבנה המשתמש במסד הנתונים
├── public/
│   ├── index.html     מסך המשחק (הדמות, התפריטים, ההתחברות וההרשמה)
│   └── blobby.glb     המודל התלת-ממדי של הדמות
├── .env.example       תבנית להגדרות הסודיות
└── package.json
```

## הכנה ב-MongoDB Atlas (פעם אחת)

1. ב-Atlas, בתפריט **Database Access**: צור משתמש מסד נתונים (שם + סיסמה). שמור את הסיסמה.
2. בתפריט **Network Access**: לחץ **Add IP Address** ← **Add Current IP Address**.
   בלי זה השרת לא יצליח להתחבר.
3. בתפריט **Database** לחץ **Connect** ← **Drivers** והעתק את מחרוזת החיבור.
   היא נראית כך: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/...`

## הפעלה במחשב

צריך Node.js בגרסה 18 ומעלה (בדיקה: `node -v`).

```bash
cd jumpi
npm install
cp .env.example .env        # ב-Windows:  copy .env.example .env
```

פתח את הקובץ `.env` ומלא:

- `MONGODB_URI` – מחרוזת החיבור מ-Atlas, עם שם המשתמש והסיסמה של משתמש מסד הנתונים במקום `<username>` ו-`<password>`.
- `JWT_SECRET` – מחרוזת אקראית ארוכה. אפשר ליצור אחת כך:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

ואז:

```bash
npm start
```

אם הכל תקין יופיע:

```
✓ Connected to MongoDB (database "jumpi")
✓ Jumpi is running: website http://localhost:3000  ·  game http://localhost:3000/play
```

פתח בדפדפן את **http://localhost:3000** (האתר) או ישר את **http://localhost:3000/play** (המשחק).

> חשוב: את הקובץ `.env` אסור לשתף או להעלות ל-GitHub. הוא כבר מופיע ב-`.gitignore`.

## מה עובד

- **הרשמה (NEW HERE?)**
  - שלב 1: בודק מול השרת שהשם והאימייל פנויים.
  - שלב 3: יוצר את החשבון ושומר במסד הנתונים את צבע הדמות, צבע העיניים, השיער, החולצה, המכנסיים והמשקפיים.
  - אחרי ההרשמה המשתמש כבר מחובר.
- **התחברות (LOGIN)**
  - מקבלת שם משתמש או אימייל.
  - "Remember me" משאיר את המשתמש מחובר 30 יום. בלי הסימון ההתחברות נגמרת כשסוגרים את הדפדפן.
- **אחרי התחברות**
  - הדמות במסך הראשי מופיעה עם המראה שנבחר בהרשמה.
  - למעלה משמאל מופיע שם המשתמש וכפתור Log out.

## אבטחה

- הסיסמאות נשמרות רק כ-hash עם bcrypt, אף פעם לא כטקסט.
- ההתחברות נשמרת בעוגייה מסוג httpOnly, כך שקוד בדף לא יכול לקרוא אותה.
- יש הגבלה על מספר הניסיונות:
  - 10 ניסיונות התחברות ב-15 דקות לכל כתובת IP.
  - 20 הרשמות בשעה לכל כתובת IP.
- הודעת השגיאה בהתחברות זהה אם השם לא קיים או אם הסיסמה שגויה, כדי שאי אפשר יהיה לגלות אילו שמות רשומים.

## נתיבי ה-API

| נתיב | מה עושה |
|---|---|
| `POST /api/auth/check` | `{username, email}` ← האם תפוסים |
| `POST /api/auth/register` | יוצר משתמש ומחבר אותו |
| `POST /api/auth/login` | `{username, password, remember}` |
| `GET  /api/auth/me` | המשתמש המחובר (או 401) |
| `POST /api/auth/logout` | התנתקות |
