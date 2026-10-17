// THE FUTURE CITY collection (sold only in the Sky Mall shops of the Future City, for players who opened it).
// Added at the end of public/shared/outfits.js in this order: never reorder, only append.
// How they look: public/world/wear-future.js (shirt / pants prints and 3D glow, hats, glasses, neckwear);
// the hair uses the normal hairstyles in neon colours. Prices 1,000 to 6,000 coins.
const F = (slot, rarity, price, o) => [slot, { ...o, rarity, price, world: "future" }];
const I = [];
const C4 = (list, fn) => list.forEach((c, k) => I.push(fn(c, k)));

/* ---------------- shirts: 8 designs x 4 colours ---------------- */
C4([["Cyan", "#0d1430", "#59e0ff", "ציאן"], ["Pink", "#1a0b2e", "#ff4fd8", "ורוד"], ["Lime", "#0c1f16", "#7dff9b", "ליים"], ["Gold", "#1f1508", "#ffd65a", "זהב"]],
  ([n, fill, acc, he]) => F("shirt", "epic", 3800, { id: "neonsuit", name: `${n} neon suit`, he: `חליפת ניאון ${he}`, fill, hem: "#05070f", acc }));
C4([["Aurora", "#9fe8ff", "#ff9ce6", "זוהר צפוני"], ["Sunset", "#ffb27a", "#c58bff", "שקיעה"], ["Mint", "#a8ffe0", "#7fa8ff", "מנטה"], ["Rose", "#ffc2e6", "#ffe49a", "ורדרד"]],
  ([n, fill, acc, he]) => F("shirt", "rare", 2600, { id: "holo", name: `${n} hologram shirt`, he: `חולצת הולוגרמה ${he}`, fill, hem: acc, acc }));
C4([["White", "#eef3fb", "#2f7bff", "לבנה"], ["Orange", "#ff8a3c", "#1d2433", "כתומה"], ["Silver", "#c9d2e3", "#ff4f6d", "כסופה"], ["Black", "#2a3042", "#59e0ff", "שחורה"]],
  ([n, fill, acc, he]) => F("shirt", "epic", 4500, { id: "spacesuit", name: `${n} space suit`, he: `חליפת חלל ${he}`, fill, hem: "#9aa6c2", acc }));
C4([["Blue", "#1f2b6e", "#59e0ff", "כחול"], ["Purple", "#3a1d6e", "#ff4fd8", "סגול"], ["Black", "#16181f", "#7dff9b", "שחור"], ["Red", "#5a0f1f", "#ffd65a", "אדום"]],
  ([n, fill, acc, he]) => F("shirt", "rare", 2400, { id: "cyberhood", name: `${n} cyber hoodie`, he: `קפוצ'ון סייבר ${he}`, fill, hem: "#0a0c14", acc }));
C4([["Green", "#0b2a1c", "#7dff9b", "ירוקה"], ["Blue", "#0b1a33", "#59e0ff", "כחולה"], ["Orange", "#2a1508", "#ff9a3c", "כתומה"], ["Violet", "#1e0f33", "#c58bff", "סגולה"]],
  ([n, fill, acc, he]) => F("shirt", "rare", 2000, { id: "circuit", name: `${n} circuit tee`, he: `חולצת מעגלים ${he}`, fill, hem: "#05070f", acc }));
C4([["Navy", "#1d2b4f", "#ffd65a", "כחול כהה"], ["Olive", "#4a5a2a", "#ffcf6a", "זית"], ["Sky", "#4f9fd6", "#ffffff", "תכלת"], ["Maroon", "#6e1f2f", "#ffd65a", "בורדו"]],
  ([n, fill, acc, he]) => F("shirt", "rare", 3000, { id: "pilot", name: `${n} sky pilot jacket`, he: `ז'קט טייס שמיים ${he}`, fill, hem: "#11161f", acc }));
C4([["Rainbow", "#14162a", "#ff4fd8", "קשת"], ["Ice", "#0f1d33", "#9fe8ff", "קרח"], ["Fire", "#220b0b", "#ff8a3c", "אש"], ["Toxic", "#0d1f0f", "#9dff3a", "רעלני"]],
  ([n, fill, acc, he]) => F("shirt", "common", 1500, { id: "glowstripe", name: `${n} glow stripes`, he: `פסים זוהרים ${he}`, fill, hem: "#05070f", acc }));
C4([["Silver", "#d9e0ea", "#59e0ff", "כסופה"], ["Yellow", "#ffd65a", "#1d2433", "צהובה"], ["Teal", "#2fb6c4", "#ffffff", "טורקיז"], ["Pink", "#ff9ce6", "#3a1d6e", "ורודה"]],
  ([n, fill, acc, he]) => F("shirt", "common", 1200, { id: "robotee", name: `${n} robot tee`, he: `חולצת רובוט ${he}`, fill, hem: acc, acc }));

/* ---------------- pants: 4 designs x 4 colours ---------------- */
C4([["Cyan", "#0d1430", "#59e0ff", "ציאן"], ["Pink", "#1a0b2e", "#ff4fd8", "ורוד"], ["Lime", "#0c1f16", "#7dff9b", "ליים"], ["Gold", "#1f1508", "#ffd65a", "זהב"]],
  ([n, base, acc, he]) => F("pants", "rare", 2600, { id: "neonpants", name: `${n} neon pants`, he: `מכנסי ניאון ${he}`, base, waist: "#05070f", acc }));
C4([["White", "#eef3fb", "#2f7bff", "לבנים"], ["Orange", "#ff8a3c", "#1d2433", "כתומים"], ["Silver", "#c9d2e3", "#ff4f6d", "כסופים"], ["Black", "#2a3042", "#59e0ff", "שחורים"]],
  ([n, base, acc, he]) => F("pants", "rare", 3200, { id: "spacepants", name: `${n} space pants`, he: `מכנסי חלל ${he}`, base, waist: "#9aa6c2", acc }));
C4([["Green", "#0b2a1c", "#7dff9b", "ירוקים"], ["Blue", "#0b1a33", "#59e0ff", "כחולים"], ["Orange", "#2a1508", "#ff9a3c", "כתומים"], ["Violet", "#1e0f33", "#c58bff", "סגולים"]],
  ([n, base, acc, he]) => F("pants", "common", 1600, { id: "circuitpants", name: `${n} circuit pants`, he: `מכנסי מעגלים ${he}`, base, waist: "#05070f", acc }));
C4([["Aurora", "#9fe8ff", "#ff9ce6", "זוהר צפוני"], ["Sunset", "#ffb27a", "#c58bff", "שקיעה"], ["Mint", "#a8ffe0", "#7fa8ff", "מנטה"], ["Rose", "#ffc2e6", "#ffe49a", "ורדרד"]],
  ([n, base, acc, he]) => F("pants", "rare", 2200, { id: "holopants", name: `${n} hologram pants`, he: `מכנסי הולוגרמה ${he}`, base, waist: acc, acc }));

/* ---------------- hair: the hairstyles in neon colours ---------------- */
const NEON = [["Neon cyan", ["#00c8ff", "#8ff6ff"], "ציאן ניאון"], ["Neon pink", ["#ff2fb4", "#ff9ce6"], "ורוד ניאון"], ["Cyber lime", ["#7dff3a", "#e2ff9a"], "ליים סייבר"], ["Hologram", ["#9b6bff", "#7ff6ff"], "הולוגרמה"]];
const SHAPES = [["spiky", "spikes", "קוצים"], ["quiff", "quiff", "בלורית"], ["pigtails", "pigtails", "קוקיות"], ["longbow", "waves", "גלים"], ["buzz", "buzz cut", "קצוץ"], ["afro", "afro", "אפרו"], ["mohawk", "mohawk", "מוהוק"], ["bun", "top bun", "פקעת"]];
SHAPES.forEach(([id, n, he], k) => [NEON[k % 4], NEON[(k + 2) % 4]].forEach(([cn, col, che]) => I.push(F("hair", k % 3 === 2 ? "epic" : "rare", k % 3 === 2 ? 3500 : 2000, { id, name: `${cn} ${n}`, he: `${he} ${che}`, col, glow: col[0] }))));

/* ---------------- hats: 6 styles x 3 colours (earbuds, headphones and antennas leave the hair on) ---------------- */
const H3 = (list, fn) => list.forEach((c) => I.push(fn(c)));
H3([["Blue", "#59e0ff", "#2f7bff", "כחולה"], ["Pink", "#ff4fd8", "#ffffff", "ורודה"], ["Gold", "#ffd65a", "#ff8a3c", "זהב"]],
  ([n, col, col2, he]) => F("hat", "legendary", 5800, { id: "spacehelmet", name: `${n} space helmet`, he: `קסדת חלל ${he}`, col, col2 }));
H3([["White", "#f2f6ff", "#59e0ff", "לבנות"], ["Black", "#1d2433", "#ff4fd8", "שחורות"], ["Mint", "#a8ffe0", "#7dff9b", "מנטה"]],
  ([n, col, col2, he]) => F("hat", "common", 1000, { id: "earbuds", name: `${n} wireless earbuds`, he: `אוזניות אלחוטיות ${he}`, col, col2, keepHair: true }));
H3([["Cyan", "#2a3042", "#59e0ff", "ציאן"], ["Pink", "#f2f6ff", "#ff4fd8", "ורודות"], ["Gold", "#1d2433", "#ffd65a", "זהב"]],
  ([n, col, col2, he]) => F("hat", "rare", 2200, { id: "cyberphones", name: `${n} cyber headphones`, he: `אוזניות סייבר ${he}`, col, col2, keepHair: true }));
H3([["Lime", "#c9d2e3", "#7dff9b", "ליים"], ["Pink", "#c9d2e3", "#ff4fd8", "ורודות"], ["Yellow", "#2a3042", "#ffd65a", "צהובות"]],
  ([n, col, col2, he]) => F("hat", "common", 1300, { id: "antenna", name: `${n} robot antennas`, he: `אנטנות רובוט ${he}`, col, col2, keepHair: true }));
H3([["Cyan", "#59e0ff", "#ffffff", "ציאן"], ["Violet", "#c58bff", "#ff9ce6", "סגול"], ["Gold", "#ffd65a", "#ffffff", "זהב"]],
  ([n, col, col2, he]) => F("hat", "legendary", 6000, { id: "holocrown", name: `${n} hologram crown`, he: `כתר הולוגרמה ${he}`, col, col2, keepHair: true }));
H3([["Black", "#1d2433", "#59e0ff", "שחור"], ["White", "#eef3fb", "#ff4fd8", "לבן"], ["Red", "#c8253a", "#ffd65a", "אדום"]],
  ([n, col, col2, he]) => F("hat", "rare", 1800, { id: "visorcap", name: `${n} visor cap`, he: `כובע מצחייה זוהרת ${he}`, col, col2 }));

/* ---------------- glasses ---------------- */
H3([["Cyan", "#59e0ff", "ציאן"], ["Pink", "#ff4fd8", "ורוד"], ["Lime", "#7dff9b", "ליים"], ["Gold", "#ffd65a", "זהב"]],
  ([n, frame, he]) => F("glasses", "epic", 3600, { id: "cybervisor", name: `${n} cyber visor`, he: `מגן עיניים סייבר ${he}`, frame, glow: frame }));
H3([["Silver", "#c9d2e3", "#59e0ff", "כסוף"], ["Gold", "#ffd65a", "#ff9ce6", "זהב"], ["Black", "#1d2433", "#7dff9b", "שחור"]],
  ([n, frame, col2, he]) => F("glasses", "rare", 2400, { id: "hudglasses", name: `${n} smart glasses`, he: `משקפיים חכמים ${he}`, frame, col2 }));
H3([["Rainbow", "#ff4fd8", "קשת"], ["Blue", "#59e0ff", "כחול"], ["Red", "#ff4f6d", "אדום"]],
  ([n, col2, he]) => F("glasses", "rare", 2000, { id: "ledshades", name: `${n} LED shades`, he: `משקפי לד ${he}`, frame: "#14161f", col2 }));

/* ---------------- neckwear ---------------- */
H3([["Cyan", "#59e0ff", "ציאן"], ["Pink", "#ff4fd8", "ורוד"], ["Lime", "#7dff9b", "ליים"]],
  ([n, col, he]) => F("neck", "common", 1100, { id: "glowcollar", name: `${n} glow collar`, he: `צווארון זוהר ${he}`, col, col2: col }));
H3([["Crystal", "#c9d2e3", "#9fe8ff", "קריסטל"], ["Ruby", "#ffd65a", "#ff4f6d", "רובי"], ["Amethyst", "#c9d2e3", "#c58bff", "אמטיסט"]],
  ([n, col, col2, he]) => F("neck", "epic", 3200, { id: "holopendant", name: `${n} floating pendant`, he: `תליון מרחף ${he}`, col, col2, metal: true }));
H3([["Silver", "#c9d2e3", "#59e0ff", "כסוף"], ["Red", "#e8423b", "#ffd65a", "אדום"], ["Black", "#2a3042", "#ff4fd8", "שחור"], ["Gold", "#ffc21a", "#ff8a3c", "זהב"]],
  ([n, col, col2, he]) => F("neck", "legendary", 5500, { id: "jetpack", name: `${n} jetpack`, he: `תרמיל סילון ${he}`, col, col2 }));

export const ITEMS = I;
