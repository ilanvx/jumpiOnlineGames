/*
  The Jumpi Discord server, as it should be. `npm run discord` reads the real server and writes a report
  (tools/discord/last-report.txt); `npm run discord:apply` makes the server match this file.
  - Channels and categories are matched by the letters of their name (emoji and ・ don't count), or by an old
    name in `was`, and renamed to the name here.
  - Only what's listed in `remove` is ever deleted. Nothing else is touched.
  - Messages posted by the bot are remembered in tools/discord/state.json and edited in place next time.
  - In message texts, {#chat} becomes a link to that channel.
  - The pictures are made in the studio (/studio: welcomeBanner, rulesBanner, safetyBanner, updatesBanner,
    contactBanner, tipSecret, tipStranger, tipGrownup, tipKind) and live in public/site/discord/.
    Discord keeps pictures by their address, so after changing one, raise ART.
*/
import { LAUNCH_AT } from "../../public/shared/launch.js";
import { WORD_LISTS } from "../../public/shared/profanity.js";

const SITE = "https://jumpigames.com", PLAY = `${SITE}/play`;
const ART = 1;   // raise after changing a picture
const pic = (name) => `${SITE}/site/discord/${name}.jpg?v=${ART}`;
const PIP = `${SITE}/site/discord/pip.png`;

// the game's own bad-word list, in Discord's AutoMod language: "word" = the whole word, "stem*" = words starting
// with it, "*word*" = anywhere. Hebrew words of 4+ letters also get "*word" (Hebrew glues ו/ה/ש/ב/ל to the front).
// (the game's list has final letters written plain, ם → מ, so the real final form is added too: שמוקים and שמוקימ)
const he = (w) => /[֐-׿]/.test(w);
const FINAL = { "מ": "ם", "נ": "ן", "צ": "ץ", "פ": "ף", "כ": "ך" };
const forms = (w) => (he(w) && FINAL[w.slice(-1)] ? [w, w.slice(0, -1) + FINAL[w.slice(-1)]] : [w]);
const BAD_WORDS = [...new Set([
  ...WORD_LISTS.exact.flatMap(forms).flatMap((w) => (he(w) && w.length >= 4 ? [w, `*${w}`] : [w])),
  ...WORD_LISTS.stems.flatMap(forms).map((w) => `${w}*`),
  ...WORD_LISTS.anywhere.flatMap(forms).map((w) => `*${w}*`),
])].filter((w) => w.replace(/\*/g, "").length >= 2 && w.length <= 60).slice(0, 1000);
const T = Math.floor(LAUNCH_AT / 1000);   // Discord shows <t:…> in everyone's own time zone

// buttons: { label, url } opens a page; { label, id } is a real button (handled by discord/interactions.js)
const link = (label, url, emoji) => ({ label, url, emoji });

export default {
  // server settings (kids' safety): members need a verified email + 5 minutes on Discord, every image is scanned,
  // and only @mentions notify by default
  guild: { verification_level: 2, explicit_content_filter: 2, default_message_notifications: 1 },
  icon: "icon.png",
  // the game's emojis: every PNG in tools/discord/emojis (128×128, made in the studio: __studio.emoji(name)) is added
  // as :name:. A server without boosts has room for 50. In messages, {:jumpi_hi} shows that emoji.
  emojis: "emojis",   // the server picture (the Wink Icon from the studio); set again only when the file changes
  // what everyone may do by default (no @everyone pings, no nickname changes, no files except in #media)
  everyone: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ADD_REACTIONS", "USE_EXTERNAL_EMOJIS",
    "CREATE_INSTANT_INVITE", "USE_APPLICATION_COMMANDS", "CONNECT", "SPEAK"],

  // roles, top to bottom (the bot's own role must stay ABOVE these in Server Settings → Roles).
  // "Jumpi Friend" = agreed to the rules (the ✅ in #rules); without it you only see #welcome and #rules.
  roles: [
    { name: "Jumpi Team", color: "#ff4545", hoist: true, perms: ["ADMINISTRATOR"] },
    { name: "Moderator", color: "#3d9bff", hoist: true, mentionable: true,
      perms: ["KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS", "MANAGE_MESSAGES", "MANAGE_NICKNAMES", "VIEW_AUDIT_LOG", "MANAGE_THREADS"] },
    { name: "Jumpi Friend", color: "#000000", perms: [] },
  ],
  friendRole: "Jumpi Friend",

  // channel modes: "open" = everyone sees it, nobody writes (#welcome, #rules);
  // "read" = friends see it, only the team writes; "chat" = friends talk (no files); "media" = friends talk + pictures;
  // "staff" = team + moderators only; "stat" = a live counter (voice channel nobody can join, `match` = how its name starts)
  categories: [
    { name: "📊 JUMPI LIVE", channels: [
      { name: "🎮 Playing now: 0", mode: "stat", match: "playing now" },
      { name: "👥 Members: 0", mode: "stat", match: "members" },
    ] },
    { name: "✨ START HERE", was: ["👋 WELCOME"], channels: [
      { name: "👋・welcome", mode: "open", topic: "Welcome to Jumpi Games! Start here 👋" },
      { name: "📜・rules", mode: "open", topic: "Read the rules and press ✅ at the bottom to open the whole server!" },
      { name: "🛟・safety", mode: "read", topic: "How to stay safe online. Read it, it's important! 🛟" },
      { name: "📣・updates", mode: "read", was: ["announcements"], topic: "News, events and free gift codes 🎁" },
      { name: "📬・contact", mode: "read", topic: "Need help? Contact the Jumpi team 📬" },
    ] },
    { name: "💬 HANG OUT", was: ["💬 COMMUNITY"], channels: [
      { name: "💬・chat", mode: "chat", was: ["general-chat"], topic: "Talk about Jumpi! Be kind, and never share personal info 💛", slow: 5 },
      { name: "📸・media", mode: "media", was: ["screenshots"], topic: "Show your best Jumpi moments: screenshots, homes, pets, outfits 📸", slow: 10 },
    ] },
    { name: "🛡️ STAFF", channels: [
      { name: "staff-chat", mode: "staff", topic: "Team + moderators only." },
      { name: "mod-log", mode: "staff", topic: "Moderation notes: who, what, why. Pip writes here by himself." },
    ] },
  ],
  // the old layout: deleted by `npm run discord:apply` (only these names, nothing else)
  remove: {
    channels: ["gift-codes", "home-tours", "pets", "trading", "mini-games", "help", "ideas", "bug-reports", "announcements", "עכג"],
    categories: ["🆘 HELP"],
  },

  // the bot's own messages (edited in place, never posted twice). `channel` = the letters of the channel's name.
  messages: [
    { key: "welcome", channel: "welcome", embeds: [
      { color: "#2fd36b", image: pic("welcome") },
      { color: "#2fd36b", title: "👋 Hi! I'm Pip, welcome to Jumpi!", thumbnail: PIP,
        description: "{:pip_hi} Jumpi is a big 3D world where you make your own Jumpi and play with friends! {:jumpi_heart}\n\n" +
          "🏝️ Explore the **Plaza**, the **Beach** and the **Water Park**\n🎮 Play **mini-games** and win coins\n🏠 Decorate **your own home**\n🐶 Adopt a **pet**\n👮 Work fun **jobs**: waiter, police, pizza delivery\n🎁 Spin the **Lucky Wheel** and fill your **Season Pass**\n\n" +
          "**👉 First, read {#rules} and press ✅ at the bottom to open all the channels!** {:jumpi_wink}" },
      { color: "#1fb6ff", title: "👋 היי! אני פיפ, ברוכים הבאים לג'אמפי!",
        description: "{:jumpi_hi} ג'אמפי הוא עולם תלת־ממדי גדול שבו יוצרים ג'אמפי משלכם ומשחקים עם חברים!\n\n🏝️ פלאזה, חוף ופארק מים · 🎮 משחקונים · 🏠 בית משלכם · 🐶 חיות · 👮 עבודות · 🎁 גלגל המזל\n\n**👉 קודם קוראים את {#rules} ולוחצים ✅ למטה, וכל החדרים נפתחים!**" },
    ], buttons: [[link("Play Jumpi", PLAY, "🎮"), link("Website", SITE, "🌐"), link("Watch the trailer", `${SITE}/trailer`, "🎬")]] },

    { key: "rules", channel: "rules", embeds: [
      { color: "#7b5cff", image: pic("rules") },
      { color: "#ff8a1c", title: "📜 The Jumpi Discord rules",
        description: "{:jumpi_heart} Jumpi is a friendly place for everyone. Read these, then press **✅ I agree** at the bottom to open the whole server! {:jumpi_party}",
        fields: [
          { name: "💛 1 · Be kind", value: "No bullying, mean jokes, threats or hate. Treat everyone the way you want to be treated." },
          { name: "🧼 2 · Keep it clean", value: "No bad words, scary or grown-up stuff, rude names or pictures." },
          { name: "🔒 3 · Keep your secrets", value: "Never share your phone number, address, school, email, last name, password or photos of yourself, and never ask anyone for theirs." },
          { name: "🪙 4 · No real-money deals", value: "Accounts, coins and items are never sold for money. Trades happen only inside the game." },
          { name: "📢 5 · No spam or ads", value: "No flooding, chain messages, or links to other servers." },
          { name: "📍 6 · Right channel, right language", value: "Talk in {#chat}, pictures go in {#media}. English or Hebrew, so the moderators can help." },
          { name: "🛡️ 7 · Listen to the team", value: "Do what the @Moderator and Jumpi Team ask. Something bothering you? Tell a moderator, or use {#contact}." },
          { name: "🎂 8 · Discord is 13+", value: "That's Discord's own rule. Younger players are welcome in the game, with a grown-up." },
        ],
        footer: "🔒 The Jumpi team will NEVER ask for your password · Breaking the rules = warning, timeout or ban" },
      { color: "#1fb6ff", title: "📜 החוקים בדיסקורד של ג'אמפי",
        description: "ג'אמפי הוא מקום כיפי ונחמד לכולם. קראו את החוקים ולחצו **✅ אני מסכים/ה** למטה כדי לפתוח את כל השרת 💛",
        fields: [
          { name: "💛 1 · נחמדים לכולם", value: "בלי בריונות, קללות, איומים או שנאה." },
          { name: "🧼 2 · שפה נקייה", value: "בלי מילים גסות, תוכן מפחיד או לא מתאים לילדים." },
          { name: "🔒 3 · שומרים על סודות", value: "אף פעם לא משתפים טלפון, כתובת, בית ספר, אימייל, שם משפחה, סיסמה או תמונות של עצמכם, ולא מבקשים מאחרים." },
          { name: "🪙 4 · בלי כסף אמיתי", value: "חשבונות, מטבעות ופריטים לא נמכרים בכסף. החלפות רק בתוך המשחק." },
          { name: "📢 5 · בלי ספאם ופרסומות", value: "בלי הצפות, שרשראות או קישורים לשרתים אחרים." },
          { name: "📍 6 · הערוץ הנכון", value: "מדברים ב־{#chat}, תמונות ב־{#media}. באנגלית או בעברית." },
          { name: "🛡️ 7 · מקשיבים לצוות", value: "משהו מפריע? פנו ל־@Moderator או ל־{#contact}." },
          { name: "🎂 8 · דיסקורד מגיל 13", value: "זה חוק של דיסקורד עצמו. במשחק אפשר לשחק בכל גיל, עם מבוגר." },
        ],
        footer: "🔒 צוות ג'אמפי לעולם לא יבקש את הסיסמה שלכם" },
    ], buttons: [
      [{ label: "I agree to the rules · אני מסכים/ה לחוקים", id: "jumpi:agree", emoji: "✅", style: 3 }],
      [link("Terms of Use", `${SITE}/terms`, "📄"), link("Privacy", `${SITE}/privacy`, "🔒"), link("Contact us", `${SITE}/contact`, "📬")],
    ] },

    { key: "safety", channel: "safety", embeds: [
      { color: "#1f8fff", image: pic("safety") },
      { color: "#1f8fff", title: "🛟 Stay safe online · בטיחות ברשת",
        description: "The internet is awesome, and a few simple habits keep it that way. Read these four, they really matter! 💙\nהאינטרנט מדהים, וכמה הרגלים פשוטים שומרים שהוא יישאר ככה. ארבעה דברים חשובים:" },
      { color: "#7b5cff", title: "🔒 1 · Keep it secret!", image: pic("tip-secret"),
        description: "{:jumpi_lock} Your **password, phone number, address, school and real name** stay with you. Not even best friends online need them. The Jumpi team will **never** ask for your password.\n🇮🇱 סיסמה, טלפון, כתובת ובית ספר נשארים אצלכם. אף אחד מהצוות לא יבקש את הסיסמה." },
      { color: "#1fb6ff", title: "🤔 2 · Not everyone is who they say", image: pic("tip-stranger"),
        description: "{:jumpi_think} Someone online can say they're 10 and be a grown-up. **Never meet someone you only know from the internet**, and never send photos of yourself.\n🇮🇱 לא כל מי שכותב לכם הוא מי שהוא אומר. לא נפגשים עם אנשים מהאינטרנט ולא שולחים תמונות." },
      { color: "#ff9a1c", title: "🗣️ 3 · Tell a grown-up", image: pic("tip-grownup"),
        description: "{:jumpi_wow} If something makes you feel weird, scared or uncomfortable, **stop and tell a parent or a grown-up you trust**. You're never in trouble for telling!\n🇮🇱 משהו מרגיש לא בסדר? עוצרים ומספרים להורים או למבוגר שסומכים עליו. אף פעם לא מסתבכים כשמספרים!" },
      { color: "#ff4f8b", title: "💛 4 · Be kind online", image: pic("tip-kind"),
        description: "{:jumpi_heart} Behind every Jumpi is a real kid with real feelings. Talk the way you'd want others to talk to you.\n🇮🇱 מאחורי כל ג'אמפי יש ילד אמיתי. מדברים יפה, כמו שהיינו רוצים שידברו אלינו." },
      { color: "#2fd36b", title: "🆘 Need help right now?",
        description: "• Tell a parent, a teacher, or a **@Moderator** here\n• Write to the Jumpi team: {#contact}\n• 🇮🇱 In Israel: call **105**, the national hotline for kids' safety online (free call)\n🇮🇱 בישראל: חייגו **105**, המוקד הלאומי להגנה על ילדים ברשת (שיחה חינם)" },
    ], buttons: [[link("Contact the Jumpi team", `${SITE}/contact`, "📬"), link("Privacy", `${SITE}/privacy`, "🔒")]] },

    { key: "updates", channel: "updates", embeds: [
      { color: "#ff8a1c", image: pic("updates") },
      { color: "#ff8a1c", title: "📣 News & updates", thumbnail: PIP,
        description: "{:jumpi_party} Everything new in Jumpi shows up here first: **new places, events, seasons** and **free gift codes** 🎁\n\n" +
          "{:jumpi_gift} **How to use a gift code:** open Jumpi → on the start screen press **Codes** → type the code on my sign → **REDEEM**!\n\n" +
          "🇮🇱 כאן מתפרסם כל מה שחדש בג'אמפי: מקומות חדשים, אירועים, עונות וקודים למטבעות חינם! במסך הפתיחה לוחצים **Codes**, מקלידים ולוחצים **REDEEM**." },
    ], buttons: [[link("Play Jumpi", PLAY, "🎮")]] },
    { key: "opening", channel: "updates", embeds: [
      { color: "#ffb21f", title: "🎉 Jumpi opens on Sunday!", thumbnail: PIP,
        description: `{:jumpi_party} The doors open on <t:${T}:F>, that's **<t:${T}:R>**!\n\nCome jump into the Plaza, the Beach and the Water Park on day one. New players get a full tour with me, Pip, and **250 coins** for finishing it!\n\n🇮🇱 ג'אמפי נפתח ביום ראשון ב־17:00! 🎉`,
        footer: "See you in the Plaza!" },
    ], buttons: [[link("Play Jumpi", PLAY, "🎮"), link("Watch the trailer", `${SITE}/trailer`, "🎬")]] },

    { key: "contact", channel: "contact", embeds: [
      { color: "#ff4f8b", image: pic("contact") },
      { color: "#ff4f8b", title: "📬 Need help? We're here!",
        description: "{:jumpi_hi} Problem with your account? Found a bug? Something bothering you? Write to the Jumpi team and we'll answer by email 💌\n\n" +
          "🔑 **Forgot your password?** Use the button below.\n🛡️ **Someone being mean in the game or here?** Tell a **@Moderator** or write to us.\n\n" +
          "🇮🇱 בעיה בחשבון, באג או משהו שמפריע? כתבו לנו ונענה במייל. שכחתם סיסמה? יש כפתור למטה." },
    ], buttons: [[link("Contact us", `${SITE}/contact`, "📬"), link("Forgot password", `${SITE}/forgot-password`, "🔑"), link("Terms of Use", `${SITE}/terms`, "📄")]] },
  ],

  // AutoMod: Discord blocks these messages before anyone sees them (same idea as the game's chat filter)
  automod: [
    { name: "Jumpi: personal info", type: "keyword", regex: [
      // A number must not touch other digits or : @ # & before it and > after it, so Discord's own codes pass:
      // custom emojis <:jumpi_hi:1234…>, mentions <@1234…>, channels <#1234…>, roles <@&1234…> (long id numbers).
      "(?:^|[^\\d:@#&!])(?:\\+?972|0)[\\s\\-.]?(?:5\\d|[2-9])[\\s\\-.]?\\d{3}[\\s\\-.]?\\d{3,4}(?:$|[^\\d>])",   // Israeli phone numbers
      "(?:^|[^\\d:@#&!])\\d{3}[\\s\\-.]\\d{3}[\\s\\-.]\\d{4}(?:$|[^\\d>])",                                  // 555-123-4567
      "(?:^|[^\\d:@#&!])(?:\\d[\\s\\-.]?){8,13}\\d(?:$|[^\\d>])",                                               // 9 to 14 digits, even with spaces
      "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}",                                       // emails
      "(?:רחוב|רח'|שדרות|שד')\\s*\\S+\\s+\\d{1,4}",                                     // רחוב הרצל 12
      "\\d{1,5}\\s+\\w+\\s+(?:street|st|road|rd|avenue|ave|lane|blvd)\\b",             // 12 Main Street
    ], words: ["*my address*", "*i live at*", "*my phone number*", "*הכתובת שלי*", "*אני גר ברחוב*", "*אני גרה ברחוב*", "*מספר הטלפון שלי*", "*הטלפון שלי*", "*whatsapp*", "*ווטסאפ*", "*וואטסאפ*"],
      message: "Never share personal info (phone, address, email) here! · אסור לשתף פרטים אישיים!" },
    { name: "Jumpi: bad words", type: "keyword", words: BAD_WORDS, allow: WORD_LISTS.allow.slice(0, 100),
      message: "Let's keep Jumpi friendly! That word isn't allowed. · שומרים על שפה נקייה!" },
    { name: "Jumpi: invite links", type: "keyword", regex: ["(?:discord\\.gg|discord(?:app)?\\.com/invite|dsc\\.gg)/\\S+"],
      message: "Links to other Discord servers aren't allowed here. · אסור לפרסם שרתים אחרים." },
    { name: "Jumpi: Discord bad words list", type: "preset", presets: [1, 2, 3], message: "Let's keep Jumpi friendly! · שומרים על שפה נקייה!" },
    { name: "Jumpi: spam", type: "spam" },
    { name: "Jumpi: mention spam", type: "mentions", limit: 5 },
  ],
};
