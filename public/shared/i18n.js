/*
  Jumpi languages: English (the text written in the game) and Hebrew.

  How it works: the game is written in English. Every English text on screen that appears in the
  dictionary below is swapped for its translation automatically, also text that appears later
  (popups, messages). Chat messages and player names are never touched.
  In code:  I18N.T("Welcome back, {name}!", {name})  →  "ברוך שובך, Dana!"
  To translate more of the game, just add lines to HE: "English text": "תרגום".
*/
(function () {
  const HE = {
    // ---------- main page ----------
    "SHOP": "חנות", "NEW": "חדש", "Tags": "תגיות", "Inventory": "מלאי", "TUTORIAL": "מדריך", "LOGIN": "התחברות", "NEW HERE?": "חדשים כאן?",
    "PLAY": "שחקו", "Play": "שחקו", "Start": "התחלה", "Menu": "תפריט", "MENU": "תפריט", "Settings": "הגדרות", "Loading Jumpi": "ג'אמפי נטען",
    "Blobby, the blue character": "הדמות שלך", "LOG OUT": "התנתקות",
    "Language": "שפה", "English": "English", "עברית": "עברית", "Change language": "החלפת שפה",
    // settings
    "SETTINGS": "הגדרות", "Close settings": "סגירת ההגדרות", "Sound": "צלילים", "Zoom": "זום", "Zoom out": "התרחקות", "Zoom in": "התקרבות",
    "ACCOUNT": "החשבון שלי", "Player": "שחקן", "Account age": "ותק", "Membership": "מנוי", "Coins": "מטבעות", "Member": "מנוי", "Not a member": "בלי מנוי",
    "1 day": "יום אחד", "{n} days": "{n} ימים",
    // loading screen
    "LOADING {n}%": "טוען {n}%", "LOADING…": "טוען…", "TIP": "טיפ",
    "Warming up the Plaza…": "מחממים את הפלאזה…", "Filling the fountain…": "ממלאים את המזרקה…", "Teaching Jumpi to wave…": "מלמדים את ג'אמפי לנופף…",
    "Polishing the coins…": "מבריקים את המטבעות…", "Almost there!": "כמעט מוכן!",
    "Press Space to jump and do a flip!": "לחצו על רווח כדי לקפוץ ולעשות סלטה!",
    "Hold Shift or double-click the ground to run.": "החזיקו Shift או לחצו פעמיים על הרצפה כדי לרוץ.",
    "Drag with the right mouse button to turn the camera.": "גררו עם הכפתור הימני של העכבר כדי לסובב את המצלמה.",
    "Open your phone (press P) to chat with friends on JumpiChat.": "פתחו את הטלפון (מקש P) כדי לדבר עם חברים ב־JumpiChat.",
    "Play at the mini-game stands to earn coins.": "שחקו בדוכני המשחקים כדי להרוויח מטבעות.",
    "Come back every day for a free daily gift!": "חזרו כל יום בשביל מתנה יומית בחינם!",
    "Decorate your home with furniture from the shop.": "עצבו את הבית שלכם עם רהיטים מהחנות.",
    "At home you can sit on the sofa, sleep in bed or play the piano.": "בבית אפשר לשבת על הספה, לישון במיטה או לנגן בפסנתר.",
    "Tap another player to trade items or play a game for coins.": "לחצו על שחקן אחר כדי להחליף פריטים או לשחק על מטבעות.",
    "Unlock new emotes in the shop and show them off!": "פתחו אימוג'ים חדשים בחנות ותשוויצו בהם!",
    "Be kind in chat, and never share your password or where you live.": "היו נחמדים בצ'אט, ואף פעם אל תשתפו סיסמה או איפה אתם גרים.",
    // log in
    "Username": "שם משתמש", "Enter your username...": "הקלידו שם משתמש...", "Password": "סיסמה", "Enter your password...": "הקלידו סיסמה...",
    "Remember me": "זכור אותי", "Log In": "התחברות", "Logging in…": "מתחברים…", "Enter your username.": "הקלידו שם משתמש.", "Enter your password.": "הקלידו סיסמה.",
    "Welcome back, {name}!": "ברוכים השבים, {name}!", "Back to menu": "חזרה לתפריט",
    "Wrong username or password.": "שם המשתמש או הסיסמה לא נכונים.", "Enter your username and password.": "הקלידו שם משתמש וסיסמה.",
    "Too many attempts. Please wait a few minutes and try again.": "יותר מדי ניסיונות. חכו כמה דקות ונסו שוב.",
    "Can't reach the server. Is it running?": "אין חיבור לשרת. הוא פועל?", "Please log in first.": "צריך להתחבר קודם.",
    "This account is banned.": "החשבון הזה חסום.", "Please log in again to see other players.": "התחברו שוב כדי לראות שחקנים אחרים.",
    // sign up
    "CREATE ACCOUNT": "יצירת חשבון", "Pick a username...": "בחרו שם משתמש...", "Email": "אימייל", "At least 8 characters": "לפחות 8 תווים",
    "Confirm password": "אימות סיסמה", "Type it again": "הקלידו שוב", "EYE COLOR": "צבע עיניים", "Pick a colour, then confirm.": "בחרו צבע ואשרו.",
    "CUSTOMIZE": "עיצוב הדמות", "TERMS & CONSENT": "תנאים ואישור", "Please read and confirm both to continue.": "קראו ואשרו את שניהם כדי להמשיך.",
    "I have read and agree to Jumpi's": "קראתי ואני מסכים/ה עם", "Terms of Use": "תנאי השימוש", "and": "ועם", "Privacy Policy": "מדיניות הפרטיות",
    "I confirm that I am 18 or older, or, if I am under 18, that I have permission from a parent or legal guardian to use Jumpi and to agree to these terms.":
      "אני מאשר/ת שאני בן/בת 18 ומעלה, או שאם אני מתחת לגיל 18, יש לי אישור מהורה או מאפוטרופוס להשתמש בג'אמפי ולהסכים לתנאים האלה.",
    "Please tick both boxes to continue.": "סמנו את שתי התיבות כדי להמשיך.", "Please accept both statements to continue.": "אשרו את שני המשפטים כדי להמשיך.",
    "Checking…": "בודקים…", "Next": "הבא", "Back": "חזרה", "Let's play!": "יאללה לשחק!", "Creating account…": "יוצרים חשבון…",
    "Something went wrong. Please try again.": "משהו השתבש. נסו שוב.", "Something went wrong.": "משהו השתבש.",
    "Please pick a friendlier username.": "בחרו שם משתמש נחמד יותר.", "That username is taken.": "שם המשתמש הזה תפוס.",
    "That email already has an account.": "כבר יש חשבון עם האימייל הזה.", "Username: 3–16 letters, numbers or _": "שם משתמש: 3–16 אותיות באנגלית, מספרים או _",
    "Username must be 3–16 letters, numbers or _.": "שם המשתמש צריך 3–16 אותיות באנגלית, מספרים או _.",
    "Pick a username.": "בחרו שם משתמש.", "That email doesn't look right.": "האימייל לא נראה תקין.", "Enter your email.": "הקלידו אימייל.",
    "Password needs at least 8 characters.": "הסיסמה צריכה לפחות 8 תווים.", "Choose a password.": "בחרו סיסמה.", "Passwords don't match.": "הסיסמאות לא תואמות.",
    "Confirm your password.": "הקלידו את הסיסמה שוב.", "That password is too long.": "הסיסמה ארוכה מדי.",
    "Welcome!": "ברוכים הבאים!", "Hi": "היי", ", your Jumpi account is ready.": ", חשבון הג'אמפי שלך מוכן.", "friend": "חבר",
    "Character colour": "צבע הדמות", "Eye colour": "צבע עיניים", "Sign-up progress": "התקדמות ההרשמה",
    // log-in gate
    "LOG IN FIRST": "קודם מתחברים", "Log in": "התחברות", "New here?": "חדשים כאן?", "Close": "סגירה",
    "You need to log in to visit the shop.": "צריך להתחבר כדי להיכנס לחנות.", "You need to log in to see the tag shop.": "צריך להתחבר כדי לראות את התגיות.",
    "You need to log in to open your inventory.": "צריך להתחבר כדי לפתוח את המלאי.",
    // ---------- tutorial window ----------
    "Close tutorial": "סגירת המדריך", "Tutorial steps": "שלבי המדריך", "Step {n} of {m}": "שלב {n} מתוך {m}", "LET'S PLAY!": "יאללה לשחק!",
    "Try it live in the game with Pip": "נסו את זה בתוך המשחק עם פיפ", "OR": "או", "SPACE": "רווח",
    "Jump + flip!": "קפיצה + סלטה!", "Run": "ריצה", "Drag to turn": "גוררים כדי לסובב", "Scroll to zoom": "גלגלת לזום", "Open chat": "פותח צ'אט",
    "Open phone": "פותח טלפון", "🎁 Daily gift": "🎁 מתנה יומית", "🎮 Mini-game stands": "🎮 דוכני משחקים", "🏆 Win 1-on-1 games": "🏆 ניצחונות 1 על 1",
    "👕 Clothes & hair": "👕 בגדים ושיער", "😎 Emotes": "😎 אימוג'ים", "🛋️ Furniture": "🛋️ רהיטים",
    "🔒 Keep your password secret": "🔒 שומרים על הסיסמה בסוד", "🏠 Don't share where you live": "🏠 לא מספרים איפה גרים", "💛 Be kind": "💛 נחמדים לכולם",
    // ---------- live tutorial with Pip ----------
    "PIP": "פיפ", "WELCOME": "ברוכים הבאים", "STEP {n} OF {m}": "שלב {n} מתוך {m}", "Let's go!": "יאללה!", "Exit": "יציאה",
    "Great job!": "כל הכבוד!", "Awesome!": "מדהים!", "You got it!": "הצלחת!", "Super!": "סופר!", "Nice one!": "יפה מאוד!", "Perfect!": "מושלם!",
    "Tutorial complete": "סיימת את המדריך", "YOU DID IT!": "הצלחת!", "You know how to walk, run, jump, chat and use your phone. Now go and make some friends!":
      "עכשיו את/ה יודע/ת ללכת, לרוץ, לקפוץ, לדבר ולהשתמש בטלפון. יאללה, לכו להכיר חברים!",
    "Play for real!": "לשחק באמת!", "Back to the menu": "חזרה לתפריט", "Create my Jumpi!": "צרו את הג'אמפי שלי!", "I have an account": "יש לי כבר חשבון",
    // ---------- in the game: HUD, map, zones ----------
    "Daily gift": "מתנה יומית", "Open the map": "פתיחת המפה", "Close map": "סגירת המפה", "MAP": "מפה", "Click a spot to walk there": "לחצו על מקום כדי ללכת לשם",
    "You": "אני", "Players": "שחקנים", "Admins": "מנהלים", "Pip": "פיפ", "Travel to": "מעבר אל", "Go to Beach": "לחוף", "Go to Park": "לפארק", "Go to Desert": "למדבר", "Go to Plaza": "לפלאזה",
    "Walking there…": "הולכים לשם…", "You can't walk there.": "אי אפשר ללכת לשם.",
    "THE BEACH": "החוף", "THE PARK": "הפארק", "THE DESERT": "המדבר", "THE PLAZA": "הפלאזה", "PLAZA": "פלאזה", "BEACH": "חוף", "PARK": "פארק", "DESERT": "מדבר",
    "Hi {name}! Welcome to the Plaza!": "היי {name}! ברוכים הבאים לפלאזה!",
    "You opened Jumpi in another window.": "פתחת את ג'אמפי בחלון אחר.", "You were kicked from the Plaza by an admin.": "מנהל הוציא אותך מהפלאזה.",
    "This account was banned.": "החשבון הזה נחסם.", "LEAVING ALREADY?": "כבר הולכים?", "Are you sure you want to log out? Your Jumpi will miss you!": "בטוחים שאתם רוצים להתנתק? הג'אמפי שלכם יתגעגע!", "No, I'll stay!": "לא, אני נשאר/ת!", "Yes, log out": "כן, להתנתק", "Log out": "התנתקות", "Jumpi website": "האתר של ג'אמפי", "You're logged out.": "התנתקת.", "Announcement from an admin": "הודעה מהמנהלים",
    "Not connected to the Plaza server.": "אין חיבור לשרת הפלאזה.", "Working…": "עובדים על זה…", "Confirm": "אישור", "Delete": "מחיקה",
    // daily gift
    "DAILY GIFT": "מתנה יומית", "Collect": "לאסוף", "Collected": "נאסף", "Come back tomorrow": "חזרו מחר", "Come back every day for bigger gifts.": "חזרו כל יום בשביל מתנות גדולות יותר.",
    "Couldn't collect the gift. Try again.": "לא הצלחנו לאסוף את המתנה. נסו שוב.", "You already took today's gift. Come back tomorrow!": "כבר לקחתם את המתנה של היום. חזרו מחר!",
    // mini-games
    "ROUND OVER": "הסיבוב נגמר", "GAME": "משחק", "SCORE": "ניקוד", "SCORE:": "ניקוד:", "TIME": "זמן", "Mini-game": "משחקון", "HOW TO PLAY": "איך משחקים", "Play again": "עוד פעם",
    "Close the game": "סגירת המשחק", "FRUIT CATCH": "תופסים פירות", "SHELL SNAP": "ציד צדפים", "TREASURE DIG": "חופרים אוצרות", "SHOVELS": "אתים",
    "Move the basket to catch falling fruit. Golden apples are worth 3. Watch out for rotten apples!": "הזיזו את הסל כדי לתפוס פירות שנופלים. תפוחי זהב שווים 3. היזהרו מתפוחים רקובים!",
    "Mouse, finger or ← → keys": "עכבר, אצבע או מקשי ← →",
    "Tap shells before the waves wash them away. Pearls are worth 3. Don't tap the crabs, they pinch!": "לחצו על הצדפים לפני שהגלים שוטפים אותם. פנינים שוות 3. אל תלחצו על הסרטנים, הם צובטים!",
    "Click or tap": "לחיצה", "Click or tap a sand tile": "לחצו על משבצת חול",
    "You have 10 shovels. Dig the sand to find coins, gems and 2 treasure chests. Empty holes tell you how many steps away the nearest chest is.": "יש לכם 10 אתים. חפרו בחול כדי למצוא מטבעות, יהלומים ו־2 תיבות אוצר. בור ריק מראה כמה צעדים רחוקה התיבה הקרובה.",
    "Find the 2 treasure chests!": "מצאו את 2 תיבות האוצר!", "That's all the game coins for today. Come back tomorrow for more!": "זהו, נגמרו מטבעות המשחקים להיום. חזרו מחר בשביל עוד!",
    "Couldn't save this round.": "לא הצלחנו לשמור את הסיבוב.", "Couldn't start the game.": "לא הצלחנו להתחיל את המשחק.", "Couldn't dig there.": "אי אפשר לחפור שם.", "No shovels left.": "נגמרו האתים.",
    "Pick a spot in the sand.": "בחרו מקום בחול.", "You already dug there.": "כבר חפרתם שם.", "This round has ended. Start a new one.": "הסיבוב נגמר. התחילו חדש.", "Wrong game.": "משחק לא נכון.",
    "Take a little break and try again in a minute.": "קחו הפסקה קטנה ונסו שוב בעוד דקה.", "The server didn't answer. Try again.": "השרת לא ענה. נסו שוב.", "Something got in the way. Try again.": "משהו הפריע. נסו שוב.",
    "Something went wrong. Try again.": "משהו השתבש. נסו שוב.",
    // chat, emotes, words filter
    "Open chat and emotes": "פתיחת צ'אט ואימוג'ים", "Emotes": "אימוג'ים", "Emote": "אימוג'י", "Chat message": "הודעה בצ'אט", "Say something…": "כתבו משהו…", "Send message": "שליחה",
    "Close chat": "סגירת הצ'אט", "Send": "שליחה", "Message": "הודעה", "Slow down a little!": "לאט לאט!", "Slow down a little.": "לאט לאט.", "You can chat again.": "אפשר לדבר שוב.",
    "Let's keep Jumpi friendly! That word isn't allowed here.": "שומרים על ג'אמפי נחמד! המילה הזאת אסורה כאן.",
    "You used bad words too many times, so you're muted for 5 minutes.": "השתמשתם במילים גסות יותר מדי פעמים, אז אתם מושתקים ל־5 דקות.",
    "Unlock this emote in the shop first!": "קודם פתחו את האימוג'י הזה בחנות!", "Unlock it forever!": "פתחו אותו לתמיד!", "Buy emote": "קניית אימוג'י", "Couldn't buy it.": "הקנייה לא הצליחה.",
    "Happy": "שמח", "LOL": "צוחק", "Love": "אוהב", "Wow": "וואו", "Cool": "מגניב", "Wink": "קריצה", "Silly": "מצחיק", "Party": "מסיבה", "Shy": "ביישן", "Sad": "עצוב", "Angry": "כועס", "Sleepy": "ישנוני",
    // shop / inventory / wardrobe
    "TAGS": "תגיות", "INVENTORY": "מלאי", "MY LOOK": "המראה שלי", "Categories": "קטגוריות", "Items": "פריטים", "Pick an item": "בחרו פריט", "Pick an item to try it on": "בחרו פריט כדי למדוד",
    "Select": "בחירה", "Wear": "ללבוש", "Wearing": "לבוש", "Owned": "שלי", "Free": "חינם", "Take off": "להוריד", "Nothing on": "לא לבוש כלום", "None": "בלי", "Loading…": "טוען…", "Buy": "קנייה",
    "Place it in My Home": "מציבים בבית שלי", "Go to My Home in the Plaza and press Decorate": "היכנסו לבית שלי ולחצו על עיצוב", "Free for everyone": "חינם לכולם",
    "Use it from the chat bar": "משתמשים בו מסרגל הצ'אט", "Taken off.": "הורדתם.", "You already own this.": "כבר יש לכם את זה.", "That item doesn't exist.": "הפריט הזה לא קיים.",
    "Everyone already has this one!": "זה כבר יש לכולם!", "You don't own that yet.": "זה עוד לא שלכם.", "That isn't something you can wear.": "את זה אי אפשר ללבוש.",
    "You can't take that off.": "את זה אי אפשר להוריד.", "Slow down a little and try again.": "לאט לאט, נסו שוב.",
    "Hair": "שיער", "Shirts": "חולצות", "Shirt": "חולצה", "Pants": "מכנסיים", "Glasses": "משקפיים", "Eyes": "עיניים", "Body colour": "צבע גוף", "Name tags": "תגיות שם", "Name tag": "תגית שם", "Furniture": "רהיטים", "Auras": "הילות", "Aura": "הילה", "LEGENDARY": "אגדי",
    // player card, 1-on-1 games
    "Add friend": "הוספת חבר", "Trade items": "החלפת פריטים", "Visit home": "ביקור בבית", "PLAY · 100 COINS EACH · WINNER TAKES 200": "משחקים · 100 מטבעות לכל אחד · המנצח לוקח 200",
    "Tic-Tac-Toe": "איקס עיגול", "4 in a Row": "4 בשורה", "Four in a Row": "4 בשורה", "You need 100 coins to play": "צריך 100 מטבעות כדי לשחק", "Need 100 coins": "צריך 100 מטבעות",
    "Play!": "לשחק!", "No thanks": "לא תודה", "Give up": "לוותר", "VS": "נגד", "Your turn!": "התור שלך!", "Sure? You'll lose your 100": "בטוח? תפסידו את ה־100",
    "DRAW!": "תיקו!", "YOU WIN!": "ניצחת!", "YOU LOST": "הפסדת", "Great game!": "משחק מעולה!", "Nobody won this time.": "הפעם אף אחד לא ניצח.", "You ran out of time.": "נגמר לכם הזמן.",
    "You gave up.": "ויתרתם.", "You left the game.": "יצאתם מהמשחק.", "+100 back": "100+ חזרו", "Empty square": "משבצת ריקה", "Your mark": "הסימן שלך", "Their mark": "הסימן שלהם",
    "That column is full.": "הטור מלא.", "Pick an empty square.": "בחרו משבצת ריקה.", "It's not your turn.": "זה לא התור שלכם.", "That invite has expired.": "ההזמנה פגה.",
    "That game doesn't exist.": "המשחק הזה לא קיים.", "You can't play against yourself.": "אי אפשר לשחק נגד עצמכם.", "Couldn't start the game. Nobody paid anything.": "המשחק לא התחיל. אף אחד לא שילם.",
    "Finish what you're doing first.": "קודם תסיימו את מה שאתם עושים.", "One of you is busy right now.": "אחד מכם עסוק עכשיו.", "That player isn't here any more.": "השחקן כבר לא כאן.",
    "Slow down a little before asking again.": "חכו רגע לפני שמבקשים שוב.",
    // trading
    "Trade!": "להחליף!", "TRADE": "החלפה", "Cancel the trade": "ביטול ההחלפה", "YOUR OFFER": "ההצעה שלך", "THEIR OFFER": "ההצעה שלהם", "READY": "מוכן", "YOUR ITEMS · tap to offer": "הפריטים שלך · לחצו כדי להציע",
    "Ready": "מוכן", "Not ready": "לא מוכן", "Trading…": "מחליפים…", "Offer": "להציע", "Offered": "הוצע", "Tap to offer": "לחצו כדי להציע", "Tap to take one back": "לחצו כדי להחזיר",
    "You're wearing this. It comes off after the trade if you have no other copy.": "אתם לובשים את זה. זה יורד מכם אחרי ההחלפה אם אין לכם עוד אחד.",
    "You can offer up to 6 items.": "אפשר להציע עד 6 פריטים.", "Swapping items…": "מחליפים פריטים…", "TRADE COMPLETE!": "ההחלפה הצליחה!", "You got:": "קיבלתם:", "You gave your items away.": "נתתם את הפריטים שלכם.",
    "Put at least one item on the table.": "שימו לפחות פריט אחד על השולחן.", "That trade request has expired.": "בקשת ההחלפה פגה.", "You can't trade with yourself.": "אי אפשר להחליף עם עצמכם.",
    "One of the players is gone.": "אחד השחקנים יצא.", "This trade can't happen.": "ההחלפה הזאת לא יכולה לקרות.", "The trade didn't go through. Nothing was changed.": "ההחלפה לא הצליחה. שום דבר לא השתנה.",
    "Keep at least one body colour for yourself.": "השאירו לעצמכם לפחות צבע גוף אחד.", "Keep at least one pair of eyes for yourself.": "השאירו לעצמכם לפחות זוג עיניים אחד.",
    // home
    "My home": "הבית שלי", "MY HOME": "הבית שלי", "Decorate": "עיצוב", "Leave": "יציאה", "Walls": "קירות", "Floor": "רצפה", "Tap the floor to place it": "לחצו על הרצפה כדי להציב", "Picked one!": "נבחר!",
    "Turn": "סיבוב", "Move": "הזזה", "Put away": "להחזיר", "All of these are placed": "כולם כבר מוצבים", "Tap, then tap the floor to place it": "לחצו, ואז על הרצפה כדי להציב",
    "No furniture yet. Buy some in the": "עוד אין רהיטים. קנו כמה ב", "Shop": "חנות", "(Furniture tab)!": "(בלשונית רהיטים)!", "Saving…": "שומר…", "Saved ✓": "נשמר ✓", "Couldn't save": "השמירה נכשלה",
    "No room to turn it here.": "אין מקום לסובב כאן.", "There's already something there.": "כבר יש שם משהו.", "Keep the furniture inside the room.": "הרהיטים צריכים להיות בתוך החדר.",
    "Keep the door free so you can get out!": "השאירו את הדלת פנויה כדי שתוכלו לצאת!", "Some furniture was moved so nothing is stuck in a wall or another piece.": "הזזנו כמה רהיטים כדי ששום דבר לא יהיה תקוע בקיר או ברהיט אחר.",
    "Couldn't open that home.": "לא הצלחנו לפתוח את הבית.", "That home isn't there any more.": "הבית הזה כבר לא קיים.", "You're already here!": "אתם כבר כאן!",
    // special offers (Jumpi Store)
    "SPECIAL OFFERS": "הצעות מיוחדות", "Special offers": "הצעות מיוחדות", "Coin packs": "חבילות מטבעות", "Membership": "מנוי", "Owned": "כבר שלך", "You have this one!": "זה כבר שלך!",
    "Real-money purchases happen on the Jumpi website. Always ask a parent first!": "קניות בכסף אמיתי נעשות באתר של ג'אמפי. תמיד שואלים הורה קודם!",
    "The Jumpi Store opened in a new tab. Ask a grown-up to help you buy.": "החנות של ג'אמפי נפתחה בלשונית חדשה. בקשו ממבוגר לעזור בקנייה.",
    "Store bundle": "בחבילת חנות", "See it in Special Offers": "לראות בהצעות המיוחדות", "Get more coins": "עוד מטבעות", "Thank you for your purchase!": "תודה על הקנייה!",
    "Sakura Breeze": "סאקורה", "Crown of Stars": "כתר הכוכבים", "This one is only in the Jumpi Store bundles.": "את זה יש רק בחבילות של החנות.",
    // pets
    "PET CENTER": "מרכז חיות המחמד", "ENTER PET CENTER": "כניסה למרכז חיות המחמד", "ADOPT A PET": "אמצו חיית מחמד", "Adopt": "אימוץ", "Name your pet": "תנו שם לחיה",
    "Puppy": "כלבלב", "Kitten": "חתלתול", "Bunny": "ארנבון", "Hamster": "אוגר", "Panda": "פנדה", "Baby Dragon": "דרקון קטן",
    "ADOPT PUPPY": "לאמץ כלבלב", "ADOPT KITTEN": "לאמץ חתלתול", "ADOPT BUNNY": "לאמץ ארנבון", "ADOPT HAMSTER": "לאמץ אוגר", "ADOPT PANDA": "לאמץ פנדה", "ADOPT BABY DRAGON": "לאמץ דרקון קטן",
    "Pat": "ליטוף", "Send home": "לשלוח הביתה", "Walk with me": "בוא איתי", "Walk": "טיול", "Home": "בית", "Walking with you": "מטייל איתך", "No pets yet": "עוד אין חיות מחמד",
    "Your home is full of pets!": "הבית מלא בחיות מחמד!", "Pet Center": "מרכז חיות המחמד", "At the Pet Center": "במרכז חיות המחמד",
    "Welcome to the Pet Center! Walk up to a pet and press E to adopt it.": "ברוכים הבאים למרכז חיות המחמד! גשו לחיה ולחצו E כדי לאמץ אותה.",
    "Give your pet a name (at least 2 letters).": "תנו לחיה שם (לפחות 2 אותיות).", "That name is too long (12 letters at most).": "השם ארוך מדי (עד 12 אותיות).",
    "Use only letters and numbers.": "רק אותיות ומספרים.", "Too many numbers in that name.": "יותר מדי מספרים בשם.", "Let's keep Jumpi friendly! Try another name.": "שומרים על ג'אמפי נחמד! נסו שם אחר.",
    "Adopt more pets at the Pet Center at the end of the Park.": "אפשר לאמץ עוד חיות במרכז חיות המחמד בסוף הפארק.",
    "Type a name": "כתבו שם", "Pick a random name": "שם אקראי", "Adopting…": "מאמצים…", "Couldn't adopt right now. Try again!": "לא הצלחנו לאמץ עכשיו. נסו שוב!",
    "The Pet Center isn't open yet. Ask an adult to restart the game server.": "מרכז חיות המחמד עוד לא פתוח. בקשו ממבוגר להפעיל מחדש את השרת.",
    // needs
    "Hunger": "רעב", "Energy": "אנרגיה", "Stamina": "כוח", "Fun": "כיף", "Fill it up": "למלא", "It's full!": "מלא!", "How your Jumpi feels": "איך הג'אמפי שלך מרגיש",
    "Eat at the Restaurant, or grab a drink at the Dance Club.": "אכלו במסעדה, או קחו משקה במועדון הריקודים.",
    "Sleep in a bed: in your home, or try the one in the Furniture Shop.": "ישנו במיטה: בבית שלכם, או במיטה שבחנות הרהיטים.",
    "Sit down somewhere for a rest. Running uses it up faster.": "שבו לנוח קצת. ריצה מורידה את זה מהר יותר.",
    "Dance at the Dance Club, play the piano, or play a mini-game.": "רקדו במועדון, נגנו בפסנתר או שחקו במיני־משחק.",
    "Yum, all full!": "יאמי, שבעים!", "Wide awake again!": "ערים לגמרי!", "Full of energy, let's run!": "מלאי כוח, יאללה לרוץ!", "Yay, that was fun!": "יש, היה כיף!",
    "Phew, I need a rest! Sit down for a bit to get your stamina back.": "פיו, צריך לנוח! שבו קצת כדי להחזיר כוח.",
    // plaza shops
    "FURNITURE SHOP": "חנות רהיטים", "CLOTHES SHOP": "חנות בגדים", "DANCE CLUB": "מועדון ריקודים", "RESTAURANT": "מסעדה",
    "ENTER SHOP": "כניסה לחנות", "ENTER CLUB": "כניסה למועדון", "ENTER RESTAURANT": "כניסה למסעדה",
    "DANCE": "לרקוד", "BUY FURNITURE": "לקנות רהיטים", "BUY CLOTHES": "לקנות בגדים", "SEE OUTFITS": "לראות תלבושות", "DRESS UP": "להתלבש", "FITTING ROOM": "תא מדידה",
    "ORDER FOOD": "להזמין אוכל", "GET A DRINK": "לקחת שתייה", "SIT & EAT": "לשבת ולאכול", "SIT & DRINK": "לשבת ולשתות",
    "TODAY'S MENU": "התפריט של היום", "JUICE BAR": "בר מיצים", "Maybe later": "אולי אחר כך",
    "Everything is free! Pick a dish, then sit at a table.": "הכול בחינם! בחרו מנה ושבו ליד שולחן.", "Pick a drink, then grab a stool at the bar!": "בחרו משקה ושבו על כיסא בבר!",
    "Pizza": "פיצה", "Burger": "המבורגר", "Sushi": "סושי", "Ice cream": "גלידה", "Orange juice": "מיץ תפוזים", "Berry smoothie": "שייק פירות יער", "Lemon fizz": "לימונדה מוגזת", "Choc shake": "מילקשייק שוקולד",
    "Enjoy your meal!": "בתיאבון!", "Enjoy your drink!": "לחיים!", "Yum! That was delicious!": "יאמי! היה טעים!", "Slurp! That was so refreshing!": "סלארפ! איזה מרענן!",
    "Let's dance! Press E for a new move, move to stop.": "בואו נרקוד! E לתנועה חדשה, זזים כדי להפסיק.",
    "Welcome to the Furniture Shop! Try out the sofas and the bed.": "ברוכים הבאים לחנות הרהיטים! נסו את הספות ואת המיטה.",
    "Welcome to the Clothes Shop! Check out the new outfits.": "ברוכים הבאים לחנות הבגדים! בואו לראות את התלבושות החדשות.",
    "Welcome to the Dance Club! Step on the dance floor and press E.": "ברוכים הבאים למועדון! עלו על רחבת הריקודים ולחצו E.",
    "Welcome to the Restaurant! Order at the counter, then find a table.": "ברוכים הבאים למסעדה! הזמינו בדלפק ומצאו שולחן.",
    "At the Furniture Shop": "בחנות הרהיטים", "At the Clothes Shop": "בחנות הבגדים", "At the Dance Club": "במועדון הריקודים", "At the Restaurant": "במסעדה",
    "SIT": "לשבת", "SLEEP": "לישון", "PLAY PIANO": "לנגן בפסנתר", "Ahh, comfy! Move to get up.": "אהה, נוח! זוזו כדי לקום.", "Sweet dreams! Move to wake up.": "חלומות פז! זוזו כדי להתעורר.",
    "🎹 Playing the piano! Move to stop.": "🎹 מנגנים בפסנתר! זוזו כדי להפסיק.", "Unknown furniture.": "רהיט לא מוכר.", "Bad rotation.": "סיבוב לא תקין.", "Pick a wallpaper.": "בחרו טפט.",
    "Pick a floor.": "בחרו רצפה.", "That's too much furniture for one room.": "יותר מדי רהיטים לחדר אחד.", "You can only place furniture you own.": "אפשר להציב רק רהיטים שלכם.",
    "That player doesn't exist.": "השחקן הזה לא קיים.",
    "Cream": "קרם", "Sky stripes": "פסים תכלת", "Candy dots": "נקודות סוכרייה", "Mint": "מנטה", "Starry night": "לילה מכוכב", "Sunny stripes": "פסים שמשיים", "Lavender": "לבנדר", "Jungle": "ג'ונגל",
    "Light wood": "עץ בהיר", "Dark wood": "עץ כהה", "Tiles": "אריחים", "Blue carpet": "שטיח כחול", "Pink carpet": "שטיח ורוד", "Grass": "דשא",
    // the phone
    "Phone": "טלפון", "Put the phone away": "להחזיר את הטלפון", "Home screen": "מסך הבית", "Hi,": "היי,", "Friends": "חברים", "Online": "מחוברים", "Home": "בית", "Pets": "חיות", "Music": "מוזיקה", "My Look": "המראה שלי",
    "Add a friend by name": "הוספת חבר לפי שם", "Add": "הוספה", "Friend's name": "שם החבר", "Wants to be your friend!": "רוצה להיות חבר שלך!", "Accept": "אישור", "Decline": "דחייה",
    "My friends": "החברים שלי", "More": "עוד", "No friends yet": "עוד אין חברים", "Type a name above, or tap a player in the Plaza and press \"Add friend\".": "הקלידו שם למעלה, או לחצו על שחקן בפלאזה ואז על \"הוספת חבר\".",
    "Offline": "לא מחובר", "In the Plaza": "בפלאזה", "At home": "בבית", "At your home": "בבית שלך", "Remove": "להסיר", "Keep": "להשאיר", "Done!": "בוצע!",
    "Couldn't load your friends.": "לא הצלחנו לטעון את החברים.", "Accept friend request": "אישור בקשת חברות", "Playing now": "משחקים עכשיו", "Friend": "חבר", "Couldn't load the list.": "לא הצלחנו לטעון את הרשימה.",
    "There's no player with that name.": "אין שחקן עם השם הזה.", "You can't add yourself.": "אי אפשר להוסיף את עצמכם.", "That request isn't there any more.": "הבקשה כבר לא קיימת.",
    "Go to my home": "לבית שלי", "You're home!": "אתם בבית!", "Back to the Plaza": "חזרה לפלאזה", "Friends' homes": "הבתים של החברים", "Visit": "ביקור", "Add friends to visit their homes!": "הוסיפו חברים כדי לבקר אצלם!",
    "Pets are coming soon!": "חיות מחמד בקרוב!", "Soon you'll adopt a puppy, kitten or bunny that follows you everywhere. Get ready!": "בקרוב תוכלו לאמץ גור, חתלתול או ארנבון שילך איתכם לכל מקום. תתכוננו!",
    "Sound is off in Settings.": "הצלילים כבויים בהגדרות.", "Music is off in Settings.": "המוזיקה כבויה בהגדרות.", "Sounds": "צלילים", "Mute music": "השתקת מוזיקה", "Mute sounds": "השתקת צלילים", "Turn on": "להפעיל", "Songs": "שירים", "Playing": "מתנגן", "Previous song": "השיר הקודם", "Next song": "השיר הבא", "Pause": "השהיה",
    "Jumpi Bounce": "קפיצת ג'אמפי", "Piano Waltz": "ואלס לפסנתר", "Sunny Beach": "חוף שמשי", "Night Sky": "שמי לילה", "Plaza theme": "שיר הפלאזה", "Cozy home": "בית חמים", "Chill": "רגוע", "Dreamy": "חלומי",
    "No chats yet": "עוד אין שיחות", "Only friends can message each other. Add friends in the Friends app to start chatting!": "רק חברים יכולים לשלוח הודעות. הוסיפו חברים באפליקציית החברים כדי להתחיל!",
    "Online now · say hi!": "מחובר עכשיו · תגידו היי!", "Say hi!": "תגידו היי!", "Today": "היום", "Yesterday": "אתמול", "You:": "אני:", "Show earlier messages": "הודעות קודמות",
    "🔒 Only friends can message you. Never share your password or where you live.": "🔒 רק חברים יכולים לשלוח לך הודעות. אף פעם אל תשתפו סיסמה או איפה אתם גרים.",
    "You're not friends any more, so you can't send messages.": "אתם כבר לא חברים, אז אי אפשר לשלוח הודעות.", "Not sent": "לא נשלח", "Your message wasn't sent.": "ההודעה לא נשלחה.",
    "Couldn't load your chats.": "לא הצלחנו לטעון את השיחות.", "Couldn't open this chat.": "לא הצלחנו לפתוח את השיחה.", "offline": "לא מחובר", "Write a message first.": "כתבו הודעה קודם.",
    "You're muted right now, so you can't send messages.": "אתם מושתקים כרגע, אז אי אפשר לשלוח הודעות.",
    // away too long
    "Disconnected: no activity for 20 minutes": "נותקת: אין פעילות 20 דקות", "WE MISS YOU!": "מתגעגעים אליך!",
    "You were away for a while, so we disconnected you from the server. Your friends are waiting in Jumpi!": "לא היית פה כמה זמן, אז ניתקנו אותך מהשרת. החברים שלך מחכים בג'אמפי!",
    "Back to the game": "חזרה למשחק", "Still there? Move or click, or you'll be disconnected in a minute.": "עדיין כאן? תזוזו או תלחצו, אחרת תנותקו בעוד דקה.",
    "Welcome back! 🎉": "ברוכים השבים! 🎉", "See you soon! 👋": "להתראות! 👋",
    // admin panel
    "Admin panel": "פאנל ניהול", "Close admin panel": "סגירת פאנל הניהול", "Announcement": "הודעה", "ADMIN PANEL": "פאנל ניהול", "PLAYER": "שחקן", "Player username": "שם השחקן",
    "Players in the Plaza": "שחקנים בפלאזה", "MODERATION": "ניהול", "Kick": "הוצאה", "Ban length": "משך חסימה", "1 hour": "שעה", "7 days": "7 ימים", "30 days": "30 ימים", "Forever": "לתמיד",
    "Ban": "חסימה", "Unban": "ביטול חסימה", "Ban reason (optional)": "סיבת חסימה (לא חובה)", "Ban reason": "סיבת חסימה", "Mute length": "משך השתקה", "5 min": "5 דק'", "15 min": "15 דק'",
    "Mute chat": "השתקת צ'אט", "Unmute": "ביטול השתקה", "COINS": "מטבעות", "Coins to give": "מטבעות לתת", "Give coins": "לתת מטבעות", "ANNOUNCEMENT": "הודעה לכולם",
    "A message everyone in the Plaza will see": "הודעה שכולם בפלאזה יראו", "Send to everyone": "שליחה לכולם", "Only admins can do that.": "רק מנהלים יכולים לעשות את זה.", "Enter a username.": "הקלידו שם משתמש.",
    "Announcement sent to everyone in the Plaza.": "ההודעה נשלחה לכל מי שבפלאזה.", "Too many actions. Wait a few seconds.": "יותר מדי פעולות. חכו כמה שניות.",
    "You can't do that to yourself.": "אי אפשר לעשות את זה לעצמכם.", "You can't do that to another admin.": "אי אפשר לעשות את זה למנהל אחר.",
    // ---------- a few that show up everywhere ----------
    "Cancel": "ביטול", "Done": "סיום", "Yes": "כן", "No": "לא", "OK": "אישור", "Back to game": "חזרה למשחק",
    // ---------- the big world: districts, map, vehicles, new items ----------
    "Graphics": "גרפיקה", "Auto": "אוטומטי", "Fast": "מהיר", "Best": "הכי יפה", "Show where I am": "איפה אני",
    "Vehicles": "כלי רכב", "Vehicle": "כלי רכב", "Garage": "מוסך", "Call": "הזמנה", "Out": "בחוץ", "Find": "מצא", "Put away": "החזרה",
    "RIDE": "לנסיעה", "GET OFF": "לרדת", "BUY A VEHICLE": "לקנות כלי רכב", "Call it here": "הזמנה לכאן", "Open the Shop": "פתיחת החנות",
    "No vehicles yet": "עדיין אין כלי רכב", "Back in your garage!": "חזר למוסך!", "Get off your vehicle first.": "קודם רדו מכלי הרכב.",
    "Vehicles only work outside, in the open world.": "כלי רכב עובדים רק בחוץ, בעולם הפתוח.", "There's no room for a vehicle in here!": "אין פה מקום לכלי רכב!",
    "No room here! Walk to an open street and try again.": "אין פה מקום! לכו לרחוב פתוח ונסו שוב.", "Parked in the parking lot. It's safe here!": "חונה בחניון. כאן הוא בטוח!",
    "Common": "רגיל", "Rare": "נדיר", "Epic": "אפי", "Legendary": "אגדי", "COMMON": "רגיל", "RARE": "נדיר", "EPIC": "אפי", "LEGENDARY": "אגדי",
    "STAR ARCADE": "ארקייד הכוכבים", "Pick a game! Every round pays coins.": "בחרו משחק! כל סיבוב משלם מטבעות.", "Maybe later": "אולי אחר כך",
    "TREASURE!": "אוצר!", "Awesome!": "מדהים!", "WEAR MY CROWN": "לחבוש את הכתר", "OPEN THE CHEST": "לפתוח את התיבה", "PLAY GAMES": "לשחק",
    "You already found this treasure. The chest is empty now!": "כבר מצאתם את האוצר הזה. התיבה ריקה עכשיו!", "Walk up to the treasure chest first.": "קודם גשו לתיבת האוצר.",
    "SECRET CAVE": "המערה הסודית", "HARBOR & MARINA": "הנמל והמרינה", "WAREHOUSE DISTRICT": "אזור המחסנים", "JUMPI STATION": "תחנת ג'אמפי", "SHOPPING STREET": "רחוב הקניות",
    "MAPLE NEIGHBORHOOD": "שכונת האדר", "SUNNY HILLS SUBURBS": "פרברי הגבעות", "CENTRAL PARK": "הפארק המרכזי", "FOOD STREET": "רחוב האוכל", "FUN DISTRICT": "רובע הבילויים",
    "POLICE STATION": "תחנת המשטרה", "JUMPI SCHOOL": "בית הספר", "JUMPI HOSPITAL": "בית החולים", "JUMPI AIRPORT": "שדה התעופה", "THE BOARDWALK": "הטיילת",
    "WHISPER HILLS": "גבעות הלחישה", "PINE LAKE CAMP": "מחנה אגם האורנים",
  };

  const DICT = { he: HE };
  // sentences with names / numbers inside (also messages from the server). $1, $2… are the parts in ( )
  const T1 = (t) => (DICT.he[t] || t);
  const PATTERNS = [
    [/^You need (\d+) coins to adopt a (.+)\. You have ([\d,]+)\. Play mini-games to earn more!$/, "צריך $1 מטבעות כדי לאמץ. יש לכם $3. שחקו במיני־משחקים כדי להרוויח עוד!"],
    [/^Say hi to (.+)! Click your pet to pat it or send it home\.$/, "תגידו שלום ל$1! לחצו על החיה כדי ללטף או לשלוח הביתה."],
    [/^(.+) loves that!$/, "$1 אוהב את זה!"], [/^(.+) is coming with you!$/, "$1 בא איתך!"], [/^(.+) went home\.( See you there!)?$/, "$1 הלך הביתה."],
    [/^My pets · (\d+)\/(\d+)$/, "החיות שלי · $1/$2"],
    [/^You need (\d+) coins for that\. Play mini-games to earn more!$/, "צריך $1 מטבעות בשביל זה. שחקו במיני־משחקים כדי להרוויח עוד!"],
    [/^You need (\d+) coins for that\.$/, "צריך $1 מטבעות בשביל זה."],
    [/^(Hunger|Energy|Stamina|Fun) (\d+)%$/, (m, n, v) => ({ Hunger: "רעב", Energy: "אנרגיה", Stamina: "כוח", Fun: "כיף" })[n] + " " + v + "%"],
    [/^You've come (\d+) days in a row!$/, "הגעתם $1 ימים ברצף!"],
    [/^Streak: (\d+) days?\. Your next gift is ready tomorrow\.$/, "רצף: $1 ימים. המתנה הבאה מחכה מחר."],
    [/^DAY (\d+)$/, "יום $1"], [/^Day (\d+) gift collected$/, "המתנה של יום $1 נאספה"],
    [/^You can still win (\d+) game coins today\.$/, "אפשר לזכות היום עוד ב־$1 מטבעות משחק."],
    [/^You're muted for about (\d+) more hours?\.$/, "אתם מושתקים עוד בערך $1 שעות."], [/^You're muted for (\d+) more minutes?\.$/, "אתם מושתקים עוד $1 דקות."],
    [/^🚫 (.+?)( \(Too many tries = muted for 5 minutes\))?$/, (m, a, b) => "🚫 " + T1(a) + (b ? " (עוד ניסיונות = השתקה ל־5 דקות)" : "")],
    [/^You need ([\d,]+) more coins\.?$/, "חסרים לכם $1 מטבעות"], [/^You need (\d+) coins to play\.$/, "צריך $1 מטבעות כדי לשחק."],
    [/^🎉 You unlocked (.+)!$/, (m, a) => "🎉 פתחתם את " + T1(a) + "!"], [/^You unlocked (.+)! Find it in the chat bar\.$/, (m, a) => "פתחתם את " + T1(a) + "! הוא מחכה בסרגל הצ'אט."],
    [/^Buy ([\d,]+)$/, "קנייה $1"], [/^Buy another ([\d,]+)$/, "עוד אחד $1"],
    [/^Now wearing (.+)\.$/, "עכשיו לובשים: $1."], [/^You bought (.+)! Tap Wear to put it on\.$/, "קניתם את $1! לחצו על 'ללבוש'."], [/^You bought (.+)! Place it in My Home\.$/, "קניתם את $1! הציבו אותו בבית שלי."],
    [/^Your home is full! You can have up to (\d+) pieces of furniture\.$/, "הבית מלא! אפשר עד $1 רהיטים."],
    [/^(.+) challenges you to (.+)! 100 coins each, winner takes 200\.$/, (m, a, g) => a + " מזמין/ה אותך ל" + T1(g) + "! 100 מטבעות לכל אחד, המנצח לוקח 200."],
    [/^Challenge sent to (.+)\. Waiting for an answer…$/, "ההזמנה נשלחה ל־$1. מחכים לתשובה…"], [/^(.+) doesn't want to play right now\.$/, "$1 לא רוצה לשחק עכשיו."],
    [/^(.+)'s turn…$/, "התור של $1…"], [/^(.+) ran out of time\.$/, "ל־$1 נגמר הזמן."], [/^(.+) gave up\.$/, "$1 ויתר/ה."], [/^(.+) left the game\.$/, "$1 יצא/ה מהמשחק."],
    [/^(.+) got (three|four) in a row\.$/, (m, a, n) => a + " עשה/תה " + (n === "three" ? "שלוש" : "ארבע") + " בשורה."], [/^Column (\d+)$/, "טור $1"],
    [/^(.+) doesn't have (\d+) coins\.$/, "ל־$1 אין $2 מטבעות."], [/^(.+) is busy right now\.$/, "$1 עסוק/ה עכשיו."],
    [/^(.+) wants to trade with you!$/, "$1 רוצה להחליף איתך!"], [/^(.+)'S OFFER$/, "ההצעה של $1"], [/^Waiting for (.+)…$/, "מחכים ל־$1…"],
    [/^(.+) is ready\. Press Ready to trade!$/, "$1 מוכן/ה. לחצו 'מוכן' כדי להחליף!"], [/^Trade request sent to (.+)\.$/, "בקשת החלפה נשלחה ל־$1."],
    [/^(.+) doesn't want to trade right now\.$/, "$1 לא רוצה להחליף עכשיו."], [/^(.+) left, so the trade was cancelled\.$/, (m, a) => (a === "The other player" ? "השחקן השני" : a) + " יצא/ה, אז ההחלפה בוטלה."],
    [/^(.+) cancelled the trade\.$/, (m, a) => (a === "The other player" ? "השחקן השני" : a) + " ביטל/ה את ההחלפה."],
    [/^You only have (\d+) × (.+)\.$/, "יש לכם רק $1 × $2."], [/^You don't have (.+)\.$/, "אין לכם $1."],
    [/^(.+)'S HOME$/, "הבית של $1"], [/^(\d+) left$/, "נשארו $1"],
    [/^(\d+) friends?$/, "$1 חברים"], [/^(\d+) online$/, "$1 מחוברים"], [/^Friend requests · (\d+)$/, "בקשות חברות · $1"], [/^At (.+)'s home$/, "בבית של $1"],
    [/^Chat with (.+)$/, "צ'אט עם $1"], [/^Visit (.+)'s home$/, "ביקור בבית של $1"], [/^Add (.+) as a friend$/, "להוסיף את $1 כחבר"],
    [/^(.+) is no longer your friend\.$/, "$1 כבר לא חבר שלך."], [/^Friend request sent to (.+)!$/, "בקשת חברות נשלחה ל־$1!"],
    [/^You and (.+) are friends now!$/, "את/ה ו־$1 חברים עכשיו!"], [/^You and (.+) are already friends\.$/, "את/ה ו־$1 כבר חברים."],
    [/^You already asked (.+)\. Waiting for an answer!$/, "כבר ביקשת מ־$1. מחכים לתשובה!"], [/^You can have up to (\d+) friends\.$/, "אפשר עד $1 חברים."],
    [/^(.+) already has the most friends\.$/, "ל־$1 כבר יש הכי הרבה חברים."], [/^(.+) can't get more friend requests right now\.$/, "$1 לא יכול/ה לקבל עוד בקשות חברות כרגע."],
    [/^(.+) wants to be your friend! Open your phone 📱$/, "$1 רוצה להיות חבר שלך! פתחו את הטלפון 📱"], [/^🎉 (.+) is your friend now!$/, "🎉 $1 חבר שלך עכשיו!"],
    [/^You can only chat with friends\. Add (.+) as a friend first!$/, "אפשר לדבר רק עם חברים. קודם הוסיפו את $1 כחבר!"],
    [/^online · (.+)$/, (m, a) => "מחובר · " + T1(a)],
    [/^You got ([\d,]+) coins!$/, "קיבלת $1 מטבעות!"], [/^Announcement from (.+)$/, "הודעה מ־$1"],
    [/^Password needs at least (\d+) characters\.$/, "הסיסמה צריכה לפחות $1 תווים."], [/^No player called "(.+)"\.$/, "אין שחקן בשם \"$1\"."],
  ];

  // languages that are shown but switched off for now (Hebrew is coming soon)
  const LOCKED = new Set(["he"]);
  let lang = (function () {
    try { const s = localStorage.getItem("jumpi-lang"); if ((s === "he" || s === "en") && !LOCKED.has(s)) return s; } catch (e) {}
    return "en"; // English unless the player picked another language
  })();
  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s);
  function tr(en, l) {
    const d = DICT[l];
    if (!d) return null;
    if (d[en] !== undefined) return d[en];
    if (l === "he") for (const [re, rep] of PATTERNS) if (re.test(en)) return en.replace(re, rep);
    return null;
  }
  function T(en, vars) { return fill((lang !== "en" && tr(en, lang)) || en, vars); }
  const has = (en) => tr(en, "he") !== null;
  // is this text one of the translations of `en` (in any language)? then the game didn't change it
  const isOurs = (txt, en) => txt === en || Object.keys(DICT).some((l) => tr(en, l) === txt);

  // never translate what players wrote, or their names
  const SKIP = ".bubble,.pp-bubble,.ph-chat .last small,.ph-convo,.msg,#announceText,#pcName,.ph-who b,.ph-title .t,.zzz,.chat-log,script,style,textarea,[data-noi18n]";
  function trText(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    const cur = node.nodeValue;
    let en = node.__en;
    if (en !== undefined && !isOurs(cur.trim(), en)) en = undefined; // the game changed the text
    if (en === undefined) {
      const t = cur.trim();
      if (!t || !has(t)) return;
      en = t;
      const at = cur.indexOf(t);
      node.__en = t; node.__pre = cur.slice(0, at); node.__post = cur.slice(at + t.length);
    }
    const want = node.__pre + (lang === "en" ? en : T(en)) + node.__post;
    if (cur !== want) node.nodeValue = want;
  }
  const ATTRS = ["placeholder", "aria-label", "title"];
  function trAttrs(el) {
    if (el.closest && el.closest("[data-noi18n]")) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const key = "data-en-" + a, cur = el.getAttribute(a);
      let en = el.getAttribute(key);
      if (en === null || !isOurs(cur, en)) { if (!has(cur)) continue; en = cur; el.setAttribute(key, en); }
      const want = lang === "en" ? en : T(en);
      if (cur !== want) el.setAttribute(a, want);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return trText(root);
    if (root.nodeType !== 1) return;
    trAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeType === 3 ? trText(n) : trAttrs(n);
  }
  function applyAll() {
    document.documentElement.lang = lang;
    if (document.body) { document.body.classList.toggle("rtl", lang === "he"); walk(document.body); }
  }
  // translate new things as soon as they appear
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") trText(m.target);
      else if (m.type === "attributes") trAttrs(m.target);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener("DOMContentLoaded", applyAll);

  function setLang(l) {
    if (LOCKED.has(l)) return;
    if (l !== "he" && l !== "en") return;
    lang = l;
    try { localStorage.setItem("jumpi-lang", l); } catch (e) {}
    applyAll();
    window.dispatchEvent(new CustomEvent("langchange", { detail: l }));
  }
  window.I18N = { T, setLang, apply: applyAll, get lang() { return lang; }, has, locked: (l) => LOCKED.has(l) };
})();
