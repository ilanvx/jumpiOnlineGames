// the autumn 2026 wardrobe: hair (added at the end of public/shared/outfits.js, in this order)
// How they look: public/world/wear-hair.js (HAIR_STYLES[id]). Each regular style comes in natural colours
// (separate items, "Blonde Side Braid"...); the members-only styles come in one special colour each.
const NATURAL = [
  ["Blonde", "בלונד", ["#e3b85c", "#f6d98f"]],
  ["Light Brown", "חום בהיר", ["#9c6a3c", "#c4905a"]],
  ["Dark Brown", "חום כהה", ["#4a2c1a", "#6f4529"]],
  ["Black", "שחור", ["#1c1b21", "#3b3944"]],
  ["Ginger", "ג'ינג'י", ["#c8561f", "#f08a45"]],
];
// [id, English name, Hebrew name, price, rarity, colours (4 = no ginger)]
const STYLES = [
  // boys' styles (the ones Ilan asked for)
  ["curlytop", "Curly Top", "תלתלים למעלה וצדדים קצרים", 450, "rare", 4],
  ["pompadour", "Pompadour", "בלורית מסורקת למעלה", 400, "common", 5],
  ["fringe", "Straight Fringe", "פוני ישר", 350, "common", 5],
  ["sidepart", "Side Part", "שביל בצד", 350, "common", 5],
  ["undercut", "Undercut", "צדדים קצרים וארוך למעלה", 450, "rare", 4],
  ["messy", "Messy Hair", "שיער מבולגן", 350, "common", 5],
  ["tightcurls", "Tight Curls", "תלתלים קטנים צמודים", 400, "common", 4],
  ["flow", "Wavy Flow", "שיער גלי עד הצוואר", 400, "common", 5],
  // the hair list
  ["sidebraid", "Side Braid", "צמה ארוכה בצד", 450, "rare", 5],
  ["longbraids", "Two Long Braids", "שתי צמות ארוכות עם סרטים", 500, "rare", 5],
  ["hipony", "High Ponytail", "קוקו גבוה", 350, "common", 5],
  ["lowpony", "Low Ponytail", "קוקו נמוך עם סרט", 350, "common", 5],
  ["twinbuns", "Space Buns", "שתי פקעות", 400, "common", 5],
  ["bob", "Smooth Bob", "קארה חלק", 300, "common", 5],
  ["bobbangs", "Bob with Bangs", "קארה עם פוני", 350, "common", 5],
  ["longcurls", "Long Curls", "תלתלים ארוכים", 450, "rare", 5],
  ["shortcurls", "Short Curls", "תלתלים קצרים", 400, "common", 5],
  ["boxbraids", "Box Braids", "צמות קטנות (בריידס)", 500, "rare", 5],
  ["beachwaves", "Beach Waves", "שיער גלי של חוף", 400, "common", 5],
  ["halfup", "Half-Up Knot", "חצי אסוף למעלה", 400, "common", 5],
  ["slickback", "Slicked Back", "שיער מסורק לאחור", 300, "common", 5],
  ["flowerlong", "Long Hair with Flower", "שיער ארוך עם פרח", 450, "rare", 5],
  ["headbandpony", "Ponytail with Headband", "קוקו עם סרט רחב", 400, "common", 5],
  ["midpart", "Middle Part", "שביל באמצע", 300, "common", 5],
  ["beadbraids", "Beaded Braids", "צמות עם חרוזים צבעוניים", 500, "rare", 5],
  ["hornbuns", "Twist Buns", "פקעות מסולסלות למעלה", 450, "rare", 5],
  ["bubblepony", "Bubble Ponytail", "קוקו בועות", 450, "rare", 5],
  ["sideswept", "Swept to One Side", "שיער ארוך מסורק לצד", 400, "common", 5],
];
// members only: one special colour each
const MEMBERS = [
  ["springcurls", "Color-Changing Spring Curls", "תלתלי קפיץ שמשנים צבע", 1600, ["#ff5fa8", "#ffb3d9"]],
  ["sparkletips", "Gold Sparkle Tips", "שיער עם קצוות זהב מנצנצים", 1500, ["#2a1f2e", "#4a3a50"]],
  ["starbraid", "Starry Braid", "צמה ארוכה עם כוכבים", 1600, ["#b9a5ff", "#e6dcff"]],
  ["crystal", "Crystal Blue Hair", "שיער קריסטל תכלת", 1700, ["#7fd3ff", "#d8f6ff"]],
  ["rainbow", "Moving Rainbow Hair", "שיער קשת בענן שזז", 1800, ["#ffffff", "#ffffff"]],
  ["princesspony", "Princess Gold Ribbon Ponytail", "קוקו נסיכה עם סרט זהב", 1600, ["#f3dc9a", "#fff1c7"]],
  ["cloud", "Pastel Cloud Hair", "שיער עננים בצבעי פסטל", 1800, ["#ffd6ec", "#e2d6ff"]],
];

export const ITEMS = [];   // [slot, item] pairs
STYLES.forEach(([id, name, he, price, rarity, n]) =>
  NATURAL.slice(0, n).forEach(([c, ch, col]) => ITEMS.push(["hair", { id, name: `${c} ${name}`, he: `${he} - ${ch}`, price, rarity, col }])));
MEMBERS.forEach(([id, name, he, price, col]) => ITEMS.push(["hair", { id, name, he, price, rarity: "epic", member: true, col }]));
