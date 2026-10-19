/* A Jumpi Club blog post, as data (not HTML): blocks of text runs. The server checks every post with cleanDoc
   (routes/blog.js) and the Club draws it with the DOM (club.js renderDoc), so a post can never hold a script or a
   strange tag: only the styles below. Shared by the server and the Club.
   doc = { v: 1, blocks: [ { t: "p" | "h2" | "h3" | "quote" | "ul" | "ol", a?: "center" | "end", runs: [run], items?: [[run]] } ] }
   run = { x: "text", b?, i?, u?, s?: true, c?: "#rrggbb", h?: "#rrggbb" (highlight), z?: "s" | "l" | "xl", f?: font }  or  { e: "<Jumpi emoji>" } */
export const EMOJI = ["jumpi_hi", "pip_hi", "jumpi_wink", "jumpi_love", "jumpi_cool", "jumpi_party", "jumpi_king", "jumpi_kitty", "jumpi_bunny", "jumpi_fancy", "jumpi_lol",
  "jumpi_cry", "jumpi_sleep", "jumpi_wow", "jumpi_think", "jumpi_pink", "jumpi_blue", "jumpi_purple", "jumpi_police", "jumpi_waiter", "jumpi_pizza", "jumpi_mod",
  "pet_puppy", "pet_kitten", "pet_bunny", "pet_hamster", "pet_panda", "pet_dragon", "food_pizza", "food_burger", "food_icecream", "food_hotdog", "food_slushie",
  "food_bubbletea", "food_cottoncandy", "jumpi_coin", "jumpi_gift", "jumpi_heart", "jumpi_star", "jumpi_lock", "lucky_wheel", "surfboard", "jumpi_gg", "jumpi_lol_text",
  "jumpi_wow_text", "jumpi_hi_text", "jumpi_omg"];
const EMO = new Set(EMOJI);
// the fonts a post can use (all of them have Hebrew and English, except Lilita One: English only)
export const FONTS = {
  body: ["Normal", "רגיל", '"HeeboHe","Fredoka",sans-serif'],
  display: ["Big & bold", "כותרת", '"HeeboDisplay","Lilita One",sans-serif'],
  fredoka: ["Fredoka", "Fredoka", '"Fredoka",sans-serif'],
  rubik: ["Rubik", "Rubik", '"Rubik",sans-serif'],
  secular: ["Secular One", "Secular One", '"Secular One",sans-serif'],
  varela: ["Varela Round", "Varela Round", '"Varela Round",sans-serif'],
  lilita: ["Lilita One", "Lilita One", '"Lilita One",sans-serif'],
};
export const SIZES = { s: ["Small", "קטן", ".85em"], l: ["Big", "גדול", "1.35em"], xl: ["Huge", "ענק", "1.85em"] };
const BLOCKS = ["p", "h2", "h3", "quote", "ul", "ol"], ALIGN = ["center", "end"];
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 20000;

function cleanRun(r, left) {
  if (!r || typeof r !== "object") return null;
  if (typeof r.e === "string") return EMO.has(r.e) ? { e: r.e } : null;
  const x = String(r.x ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").slice(0, Math.max(0, left.n));
  if (!x) return null;
  left.n -= x.length;
  const o = { x };
  for (const k of ["b", "i", "u", "s"]) if (r[k] === true) o[k] = true;
  if (HEX.test(r.c || "")) o.c = r.c.toLowerCase();
  if (HEX.test(r.h || "")) o.h = r.h.toLowerCase();
  if (r.z in SIZES) o.z = r.z;
  if (r.f in FONTS && r.f !== "body") o.f = r.f;
  return o;
}
const runsOf = (list, left) => (Array.isArray(list) ? list.slice(0, 600).map((r) => cleanRun(r, left)).filter(Boolean) : []);
// a clean copy of the post (or null when there's nothing in it)
export function cleanDoc(doc) {
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.blocks)) return null;
  const left = { n: MAX_TEXT }, blocks = [];
  for (const b of doc.blocks.slice(0, 500)) {
    if (!b || !BLOCKS.includes(b.t)) continue;
    const o = { t: b.t };
    if (ALIGN.includes(b.a)) o.a = b.a;
    if (b.t === "ul" || b.t === "ol") { o.items = (Array.isArray(b.items) ? b.items.slice(0, 100) : []).map((it) => runsOf(it, left)).filter((it) => it.length); if (!o.items.length) continue; }
    else { o.runs = runsOf(b.runs, left); if (!o.runs.length) continue; }
    blocks.push(o);
  }
  return blocks.length ? { v: 1, blocks } : null;
}
// the post as plain text (the list's short preview, the search)
export function docText(doc) {
  const run = (r) => (r.e ? "" : r.x);
  return (doc?.blocks || []).map((b) => (b.items ? b.items.map((it) => it.map(run).join("")).join("\n") : b.runs.map(run).join(""))).join("\n\n").trim();
}
// an old post (plain text): paragraphs
export const textDoc = (text) => ({ v: 1, blocks: String(text || "").split(/\n\s*\n/).filter((p) => p.trim()).map((p) => ({ t: "p", runs: [{ x: p.trim() }] })) });
// a comment's Jumpi emojis are written :jumpi_hi: in the text
export const EMOJI_CODE = /:([a-z_]{3,24}):/g;
export const isEmoji = (name) => EMO.has(name);
