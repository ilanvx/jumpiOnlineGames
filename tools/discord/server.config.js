/*
  The Jumpi Discord server: what Pip does when you run `npm run discord:apply`.
  `npm run discord` only checks and writes tools/discord/last-report.txt.

  RIGHT NOW Pip does ONE thing only: he posts the rules as normal messages in #rules-en and #rules-he.
  He does not make, rename, move or delete channels or categories, and doesn't touch roles, permissions,
  server settings, AutoMod or emojis. Those parts were taken out of this file on purpose, so nothing that was
  deleted from the server comes back. (The old full setup is in the git history of this file.)

  - Channels are found by the letters of their name: "rules-en" also finds "📜・rules-en".
    If the channel isn't there, Pip only reports it and does nothing.
  - A message is posted once and then edited in place (tools/discord/state.json). Change the text here and run
    apply again to edit it. One message can be up to 2,000 characters.
*/

const RULES_EN = "# 📜 Jumpi Games – Server Rules\n\nWelcome to the official **Jumpi Games** community! 🎉\nTo keep this a fun and safe place for everyone, please follow these rules:\n\n**1. 🔞 Ages 13+ only**\nDiscord requires every member to be at least 13 years old.\n\n**2. 🤝 Be kind and respectful**\nNo bullying, insults, hate speech or harassment. Treat others the way you want to be treated.\n\n**3. 🧒 Keep it clean**\nJumpi is a game for kids. No inappropriate, violent, scary or adult content, including names, avatars and links.\n\n**4. 🔒 Protect your privacy**\nNever share personal details: full name, address, phone number, school or photos. Not yours, and not anyone else's.\n\n**5. 🔑 Never share your password**\nThe Jumpi team will **never** ask for your password. Anyone who asks is trying to steal your account.\n\n**6. 🚫 No spam or advertising**\nNo flooding, chain messages or promoting other servers without permission from the team.\n\n**7. 🪙 No scams or real-money trading**\nDon't buy, sell or trade accounts, coins or items. \"Free coins\" offers are always a scam.\n\n**8. 💬 Use the right channels**\nKeep each topic in its own channel, and please write in English or Hebrew.\n\n**9. 🛡️ Listen to the moderators**\nSaw something wrong? Report it to a moderator instead of arguing. Staff decisions are final.\n\n**10. 📘 Follow Discord's rules**\nDiscord's Terms of Service and Community Guidelines apply here too.\n\n> ⚠️ Breaking the rules can lead to a warning, a mute or a ban, depending on how serious it is.\n> **The team may also kick or ban you from the Jumpi game itself, even if the problem happened here on the server.**\n\n📄 **By using this server, you agree to the Jumpi Games Terms of Use and to these rules.**\nTerms of Use: https://jumpigames.com/terms\n\nHave fun, and see you in Jumpi! 💙\n🔗 **Invite your friends:** https://discord.gg/dgwsBJgzZS";

const RULES_HE = "# 📜 ג'אמפי גיימס – חוקי השרת\n\nברוכים הבאים לקהילה הרשמית של **ג'אמפי גיימס**! 🎉\nכדי שהמקום הזה יישאר כיפי ובטוח לכולם, חשוב לשמור על החוקים:\n\n**1. 🔞 מגיל 13 ומעלה בלבד**\nדיסקורד מחייב שכל חבר בשרת יהיה בן 13 לפחות.\n\n**2. 🤝 מדברים יפה ובכבוד**\nבלי בריונות, עלבונות, שנאה או הטרדות. מתנהגים לאחרים כמו שהייתם רוצים שיתנהגו אליכם.\n\n**3. 🧒 שומרים על תוכן נקי**\nג'אמפי הוא משחק לילדים. בלי תוכן לא הולם, אלים, מפחיד או למבוגרים, כולל שמות, תמונות פרופיל וקישורים.\n\n**4. 🔒 שומרים על הפרטיות**\nלא משתפים פרטים אישיים: שם מלא, כתובת, מספר טלפון, בית ספר או תמונות. לא שלכם, ולא של אף אחד אחר.\n\n**5. 🔑 לא משתפים את הסיסמה**\nצוות ג'אמפי **לעולם** לא יבקש מכם את הסיסמה. מי שמבקש, מנסה לגנוב לכם את החשבון.\n\n**6. 🚫 בלי ספאם ופרסומות**\nבלי הצפות, שרשראות או פרסום של שרתים אחרים בלי אישור מהצוות.\n\n**7. 🪙 בלי עקיצות ובלי מסחר בכסף אמיתי**\nלא קונים, מוכרים או מחליפים חשבונות, מטבעות או פריטים. הצעות של \"מטבעות בחינם\" הן תמיד עקיצה.\n\n**8. 💬 כותבים בערוץ המתאים**\nכל נושא בערוץ שלו, וכותבים בעברית או באנגלית.\n\n**9. 🛡️ מקשיבים למנהלים**\nראיתם משהו לא בסדר? מדווחים למנהל במקום להתווכח. החלטות הצוות הן סופיות.\n\n**10. 📘 שומרים על חוקי דיסקורד**\nתנאי השימוש וכללי הקהילה של דיסקורד חלים גם כאן.\n\n> ⚠️ הפרת החוקים יכולה להוביל לאזהרה, השתקה או הרחקה מהשרת, לפי חומרת המקרה.\n> **להנהלה שמורה הזכות גם להוציא (קיק) או להרחיק מהמשחק עצמו, גם אם הבעיה הייתה בשרת.**\n\n📄 **כל שימוש בשרת מהווה הסכמה לתנאי השימוש של ג'אמפי גיימס ולחוקי השרת.**\nתנאי השימוש: https://jumpigames.com/terms\n\nתהנו, ונתראה בג'אמפי! 💙\n🔗 **הזמינו את החברים שלכם:** https://discord.gg/dgwsBJgzZS";

export default {
  // the bot's own messages. `channel` = the letters of the channel's name. `content` = a normal message
  // (Discord markdown: # title, **bold**, > quote). `noPreview` hides the link previews under it.
  messages: [
    { key: "rules-en", channel: "rules-en", content: RULES_EN, noPreview: true },
    { key: "rules-he", channel: "rules-he", content: RULES_HE, noPreview: true },
  ],
};
