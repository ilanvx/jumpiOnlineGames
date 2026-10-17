/*
  Announcements from the team (realtime/plaza.js admin:announce, the admin panel in the game).
  STYLES: how an announcement looks. Moderators always send "mod" (blue); admins pick one of the others.
  TIPS: ready-made safety tips, sent by id so every player reads it in their own language.
*/
export const ANN_STYLES = ["game", "system", "admin", "critical", "tip"];
export const MOD_STYLE = "mod";

export const TIPS = [
  { id: "password", en: "Never give your password to anyone, not even a friend or someone who says they're from Jumpi. The Jumpi team will never ask for it.", he: "לעולם אל תמסרו את הסיסמה שלכם לאף אחד, גם לא לחבר או למישהו שאומר שהוא מצוות ג'אמפי. הצוות של ג'אמפי אף פעם לא יבקש אותה." },
  { id: "private", en: "Keep your real name, address, school and phone number to yourself. Friends in Jumpi don't need them.", he: "שמרו לעצמכם את השם האמיתי, הכתובת, בית הספר ומספר הטלפון. חברים בג'אמפי לא צריכים אותם." },
  { id: "coins", en: "Nobody can give you free coins for your password. That's always a trick!", he: "אף אחד לא יכול לתת לכם מטבעות בחינם תמורת הסיסמה. זה תמיד תרגיל!" },
  { id: "grownup", en: "Something online made you feel weird or scared? Tell a grown-up you trust. It's never your fault.", he: "משהו ברשת גרם לכם להרגיש מוזר או מפחיד? ספרו למבוגר שאתם סומכים עליו. זה אף פעם לא באשמתכם." },
  { id: "kind", en: "Be kind in the chat. Saw someone being mean? Tap their name and press Report.", he: "דברו יפה בצ'אט. ראיתם מישהו שמתנהג לא יפה? הקישו על השם שלו ולחצו דיווח." },
  { id: "apps", en: "Don't move to other apps or open links with people you met in a game.", he: "אל תעברו לאפליקציות אחרות ואל תפתחו קישורים עם אנשים שהכרתם במשחק." },
  { id: "break", en: "Time for a little break? Drink some water, stretch and rest your eyes.", he: "הגיע הזמן להפסקה קטנה? שתו מים, תתמתחו ותנו לעיניים לנוח." },
];
export const TIP_BY_ID = Object.fromEntries(TIPS.map((t) => [t.id, t]));
