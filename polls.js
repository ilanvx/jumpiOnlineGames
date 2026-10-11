/*
  The weekly poll on the website (home page, routes/poll.js). A new question every Sunday (Israel time), by itself:
  the questions come in a mixed order that changes every round, and no question comes back before all the others had
  their week. Every question and answer is in English and Hebrew: [english, hebrew].
  To run a special poll on a certain week, put it in SPECIAL with the week key, e.g. "2026-W42": { id, question, options }.
  Votes are kept for a few weeks only (models/PollVote.js); the admin panel shows the poll of this week.
*/
export const POLLS = [
  { id: "vacation", question: ["What do I love doing most on vacation?", "מה אני הכי אוהב לעשות בחופשים?"],
    options: [["Playing Jumpi", "לשחק ג'אמפי"], ["Going out with friends", "לצאת עם חברים"], ["Going to the beach", "ללכת לים"], ["Sleeping late", "לישון עד מאוחר"], ["Trips with my family", "טיולים עם המשפחה"]] },
  { id: "resident", question: ["Who is my favourite Jumpi resident?", "מי התושב האהוב עליי בג'אמפי?"],
    options: [["Grandpa Ziggy", "סבא זיגי"], ["Grandma Rosa", "סבתא רוזה"], ["Luna", "לונה"], ["Captain Max", "קפטן מקס"], ["Mia", "מיה"], ["Kai", "קאי"], ["Aunt Stella", "דודה סטלה"], ["Uncle Bolt", "דוד בולט"]] },
  { id: "wish", question: ["What would I want most in Jumpi?", "מה הכי הייתי רוצה בג'אמפי?"],
    options: [["A snowy mountain", "הר מושלג"], ["Racing cars", "מכוניות מרוץ"], ["An amusement park", "לונה פארק"], ["A trip to space", "טיול לחלל"], ["An underwater city", "עיר מתחת למים"]] },
  { id: "job", question: ["What's my favourite job in Jumpi?", "מה העבודה האהובה עליי בג'אמפי?"],
    options: [["Waiter", "מלצר"], ["Pizza delivery", "שליח פיצה"], ["Police officer", "שוטר"], ["I'd rather play mini-games", "אני מעדיף מיני-משחקים"]] },
  { id: "pet", question: ["Which pet would I adopt?", "איזו חיה הייתי מאמץ?"],
    options: [["A puppy", "כלבלב"], ["A kitten", "חתלתול"], ["A bunny", "ארנבון"], ["A hamster", "אוגר"], ["A panda", "פנדה"], ["A baby dragon", "דרקון קטן"]] },
  { id: "place", question: ["What's the best place in Jumpi?", "מה המקום הכי טוב בג'אמפי?"],
    options: [["The Beach", "החוף"], ["The Water Park", "פארק המים"], ["The Dance Club", "מועדון הריקודים"], ["My home", "הבית שלי"], ["The big city", "העיר הגדולה"]] },
  { id: "coins", question: ["What do I spend my coins on first?", "על מה אני מוציא מטבעות קודם?"],
    options: [["Clothes", "בגדים"], ["Furniture", "רהיטים"], ["Pets", "חיות"], ["I save them for something big", "אני חוסך לדבר גדול"]] },
  { id: "minigame", question: ["What's my favourite mini-game?", "מה המיני-משחק האהוב עליי?"],
    options: [["Fruit Catch", "Fruit Catch"], ["Shell Snap", "Shell Snap"], ["Treasure Dig", "Treasure Dig"], ["Jumpi Flap", "Jumpi Flap"], ["Tic-Tac-Toe with friends", "איקס עיגול עם חברים"]] },
  { id: "time", question: ["What's my favourite time of day?", "מה השעה האהובה עליי ביום?"],
    options: [["Morning", "בוקר"], ["Afternoon", "צהריים"], ["Sunset", "שקיעה"], ["Night", "לילה"]] },
  { id: "power", question: ["If I could have one superpower, it would be…", "אם הייתה לי כוח-על אחד, הוא היה…"],
    options: [["Flying", "לעוף"], ["Being invisible", "להיות בלתי נראה"], ["Super speed", "מהירות על"], ["Talking to animals", "לדבר עם חיות"]] },
  { id: "food", question: ["What's the best food at the Jumpi Restaurant?", "מה האוכל הכי טוב במסעדה של ג'אמפי?"],
    options: [["Pizza", "פיצה"], ["Burger", "המבורגר"], ["Sushi", "סושי"], ["Ice cream", "גלידה"]] },
  { id: "event", question: ["Which party should Jumpi have next?", "איזו מסיבה הכי כדאי שתהיה בג'אמפי?"],
    options: [["A snow festival", "פסטיבל שלג"], ["A spring flower party", "מסיבת פרחים באביב"], ["A summer beach party", "מסיבת חוף בקיץ"], ["A space week", "שבוע החלל"]] },
  { id: "subject", question: ["What's my favourite subject at school?", "מה המקצוע האהוב עליי בבית הספר?"],
    options: [["Sports", "ספורט"], ["Art", "אמנות"], ["Math", "חשבון"], ["Science", "מדעים"], ["English", "אנגלית"], ["Recess!", "ההפסקה!"]] },
  { id: "together", question: ["How do I like to play best?", "איך אני הכי אוהב לשחק?"],
    options: [["On my own", "לבד"], ["With my best friend", "עם החבר הכי טוב"], ["With a big group", "עם הרבה חברים"], ["With my family", "עם המשפחה"]] },
  { id: "look", question: ["What's the most important part of my Jumpi's look?", "מה הכי חשוב במראה של הג'אמפי שלי?"],
    options: [["The hair", "השיער"], ["The hat", "הכובע"], ["The shirt", "החולצה"], ["The aura", "ההילה"], ["My pet next to me", "החיה שלידי"]] },
];
export const SPECIAL = {};

// ISO week key in Israel time, plus when this week's poll ends
export function weekInfo(date = new Date()) {
  const il = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const offset = il.getTime() - date.getTime();
  // weeks start on Sunday in Israel
  const day = il.getDay();
  const start = new Date(il.getFullYear(), il.getMonth(), il.getDate() - day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const jan1 = new Date(start.getFullYear(), 0, 1);
  const n = Math.floor((start - jan1) / 864e5 / 7) + 1;
  const index = Math.round((start.getTime() - new Date(2026, 9, 4).getTime()) / (7 * 864e5));   // 0 = the week the website opened
  return { key: `${start.getFullYear()}-W${String(n).padStart(2, "0")}`, index, endsAt: Math.floor((end.getTime() - offset) / 60000) * 60000 };
}

// a mixed order of all the questions for one round (the same for everyone; a new mix every round)
function roundOrder(round) {
  const order = POLLS.map((_, i) => i);
  let seed = (round * 2654435761 + 97) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

export function pollFor(info = weekInfo()) {
  if (SPECIAL[info.key]) return SPECIAL[info.key];
  const n = POLLS.length, i = ((info.index % n) + n) % n, round = Math.floor(info.index / n);
  let order = roundOrder(round);
  // never the same question two weeks in a row across rounds
  if (round > 0 && order[0] === roundOrder(round - 1)[n - 1]) order = [order[1], order[0], ...order.slice(2)];
  if (round === 0) { const v = order.indexOf(0); [order[1], order[v]] = [order[v], order[1]]; }   // the first new-style week (Oct 11, 2026) asks about vacations
  return POLLS[order[i]];
}

// the votes of a week + question (a new question in the same week starts from zero)
export const voteKey = (info, poll) => `${info.key}:${poll.id}`;
