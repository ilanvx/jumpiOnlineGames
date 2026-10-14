// the autumn 2026 wardrobe: heads (added at the end of public/shared/outfits.js, in this order)
// how they look: public/world/wear-heads.js (HAT_STYLES, GLASSES_STYLES, NECK_STYLES); "cap", "cowboy", "shades" and
// "scarf" are the built-in shapes in public/index.html in new colours
const I = [];
const add = (slot, rarity, o) => I.push([slot, { rarity, ...o }]);
const mem = (slot, rarity, o) => add(slot, rarity, { ...o, member: true });

/* ---------------- hats (30, 8 for members) ---------------- */
add("hat", "common", { id: "boater", name: "Straw boater", he: "כובע קש ספורטיבי", price: 400, col: "#e9c77b", col2: "#1f3d8f" });
add("hat", "rare", { id: "sunhat", name: "Summer sun hat", he: "כובע קיץ רחב עם סרט", price: 650, col: "#fff3dc", col2: "#ff7fbf" });
add("hat", "common", { id: "strawhat", name: "Farmer straw hat", he: "כובע קש של חווה", price: 450, col: "#e6c169", col2: "#d8333a" });
add("hat", "rare", { id: "circus", name: "Circus tent hat", he: "כובע קרקס", price: 750, col: "#e8233a", col2: "#ffd23a" });
add("hat", "rare", { id: "furhat", name: "Fluffy pompom hat", he: "כובע פרווה עם פומפום", price: 700, col: "#8fb8ff", col2: "#ffffff" });
add("hat", "rare", { id: "books", name: "Book stack hat", he: "כובע ערימת ספרים", price: 800, col: "#2f7bff", cols: ["#2f7bff", "#2fbf62", "#ff8a1c"] });
add("hat", "common", { id: "wideband", name: "Wide headband", he: "סרט ראש רחב", price: 250, col: "#ff5fa8", col2: "#ffffff", keepHair: true });
add("hat", "common", { id: "butterflyband", name: "Butterfly headband", he: "קשת עם פרפר", price: 400, col: "#7fd3ff", col2: "#ff5fa8", keepHair: true });
add("hat", "common", { id: "bearears", name: "Bear ears", he: "אוזני דוב", price: 400, col: "#9a6340", col2: "#f0c39a", keepHair: true });
add("hat", "common", { id: "foxears", name: "Fox ears", he: "אוזני שועל", price: 400, col: "#ff8a2a", col2: "#fff6ec", keepHair: true });
add("hat", "common", { id: "mouseears", name: "Mouse ears", he: "אוזני עכבר", price: 400, col: "#9aa5b8", col2: "#ffb3d1", keepHair: true });
add("hat", "common", { id: "cap", name: "Backwards cap", he: "כובע מצחייה הפוך", price: 300, col: "#2fbf62", col2: "#ffffff", back: true });
add("hat", "common", { id: "pombeanie", name: "Double pompom beanie", he: "כובע גרב עם שני פומפומים", price: 400, col: "#9b5cff", col2: "#ffd6f0", col3: "#ff5fa8" });
add("hat", "rare", { id: "cowboy", name: "White cowboy hat", he: "כובע בוקרים לבן", price: 600, col: "#f6f2e8", col2: "#b8864a" });
add("hat", "common", { id: "paperhat", name: "Paper boat hat", he: "כובע ספינה מנייר", price: 300, col: "#f4f1e6" });
add("hat", "rare", { id: "bikehelmet", name: "Striped bike helmet", he: "קסדת אופניים עם פסים", price: 650, col: "#1fb6ff", col2: "#ffffff" });
add("hat", "epic", { id: "egghat", name: "Hatching chick hat", he: "כובע ביצה עם אפרוח", price: 1500, col: "#fffaf0", col2: "#ffd84a" });
add("hat", "rare", { id: "strawberry", name: "Strawberry hat", he: "כובע תות", price: 700, col: "#ff3b4f", col2: "#ffe27a" });
mem("hat", "legendary", { id: "cloudhat", name: "Happy little cloud", he: "ענן קטן מעל הראש", price: 3000, col: "#ffffff", keepHair: true });
mem("hat", "epic", { id: "icecrown", name: "Ice crown", he: "כתר קרח", price: 2000, col: "#8fe0ff" });
mem("hat", "legendary", { id: "suncrown", name: "Sparkling sun crown", he: "כתר שמש מנצנץ", price: 3500, col: "#ffc21a", col2: "#ff8a1c" });
mem("hat", "legendary", { id: "magichat", name: "Starry magic hat", he: "כובע קסם עם כוכבים", price: 4000, col: "#3b2a9e", col2: "#ffd23a", col3: "#160d3a" });
mem("hat", "epic", { id: "glowphones", name: "Glowing gold headphones", he: "אוזניות זהב זוהרות", price: 1800, col: "#ffc21a", col2: "#2a2d36", keepHair: true });
mem("hat", "legendary", { id: "astrohelmet", name: "Astronaut helmet", he: "קסדת אסטרונאוט", price: 5000, col: "#f4f6fa", col2: "#9aa5b8", hideHair: true });
mem("hat", "epic", { id: "dragonears", name: "Sparkly dragon ears", he: "אוזני דרקון מנצנצות", price: 2200, col: "#2fd3b0", col2: "#ffd23a", keepHair: true });
add("hat", "epic", { id: "magician", name: "Magician's hat", he: "מגבעת של קוסם", price: 1600, col: "#1d1d24", col2: "#d61f3a" });
add("hat", "common", { id: "sportvisor", name: "Clear sports visor", he: "כובע ספורט עם מצחייה שקופה", price: 350, col: "#ffffff", col2: "#2fd3a0", keepHair: true });
add("hat", "rare", { id: "boppers", name: "Wobbly heart boppers", he: "קשת עם קפיצים מתנדנדים", price: 600, col: "#ff5fa8", col2: "#ff3b6b", keepHair: true });
add("hat", "common", { id: "sideflower", name: "Big side flower", he: "פרח גדול בצד הראש", price: 350, col: "#ff6a8a", col2: "#ffd23a", keepHair: true });
mem("hat", "legendary", { id: "rainbowcrown", name: "Rainbow crystal crown", he: "כתר קריסטל קשת בענן", price: 4500, col: "#e8f0ff" });

/* ---------------- glasses (25 new shapes, 7 for members) ---------------- */
add("glasses", "common", { id: "nerd", name: "Big nerd glasses", he: "משקפי חנון גדולים", price: 300, frame: "#1d1d24", col2: "#ffffff" });
add("glasses", "rare", { id: "aviator", name: "Aviators", he: "משקפי טייסים", price: 700, frame: "#e0b84a", col2: "#2f6b4a" });
add("glasses", "common", { id: "swim", name: "Swim goggles", he: "משקפי שחייה", price: 350, frame: "#ff5fa8", col2: "#3fb8ff", col3: "#1fb6ff" });
add("glasses", "rare", { id: "kitty", name: "Kitty glasses", he: "משקפי חתול עם אוזניים", price: 600, frame: "#ff5fa8", col2: "#ffc2dc" });
add("glasses", "rare", { id: "flowerglasses", name: "Flower glasses", he: "משקפי פרחים", price: 650, frame: "#ff7fbf", col2: "#ffd23a" });
add("glasses", "rare", { id: "butterflyglasses", name: "Butterfly glasses", he: "משקפי פרפר", price: 700, frame: "#9b5cff", col2: "#ffd23a" });
add("glasses", "common", { id: "hexagon", name: "Hexagon glasses", he: "משקפי משושה", price: 350, frame: "#c9a24a" });
add("glasses", "common", { id: "clearframe", name: "Clear candy glasses", he: "משקפיים שקופים צבעוניים", price: 400, frame: "#2fd3c0" });
add("glasses", "rare", { id: "dotcat", name: "Polka-dot cat-eye", he: "משקפי עין חתול עם נקודות", price: 650, frame: "#e8233a", col2: "#ffffff" });
mem("glasses", "epic", { id: "mirror", name: "Mirror shades", he: "משקפי שמש מראה", price: 1400, frame: "#dfe7f5" });
add("glasses", "common", { id: "tinyround", name: "Tiny retro glasses", he: "משקפי רטרו קטנים", price: 300, frame: "#d9b24a", col2: "#ffb347" });
add("glasses", "rare", { id: "melon", name: "Watermelon glasses", he: "משקפי אבטיח", price: 600, frame: "#2f9a3a" });
add("glasses", "rare", { id: "bolt", name: "Lightning glasses", he: "משקפי ברק", price: 650, frame: "#ffd21a", col2: "#3a2a8a" });
add("glasses", "rare", { id: "cloudglasses", name: "Cloud glasses", he: "משקפי ענן", price: 600, frame: "#ffffff", col2: "#7fd3ff" });
add("glasses", "rare", { id: "moon", name: "Moon glasses", he: "משקפי ירח", price: 700, frame: "#ffe27a", col2: "#2a3a8a" });
add("glasses", "rare", { id: "pixel", name: "Pixel shades", he: "משקפי פיקסלים", price: 800, frame: "#141418" });
add("glasses", "common", { id: "browline", name: "Teacher glasses", he: "משקפי מורה", price: 350, frame: "#3a2416", col2: "#d9b24a" });
add("glasses", "epic", { id: "ski", name: "Sunset ski goggles", he: "משקפי סקי בצבעי שקיעה", price: 1400, frame: "#2a2d36", col2: "#ff5fa8", col3: "#ffd23a" });
add("glasses", "epic", { id: "divemask", name: "Diving mask", he: "מסכת צלילה עם בועות", price: 1600, frame: "#ffb31a", col2: "#1fb6ff", col3: "#ff6a1c" });
mem("glasses", "legendary", { id: "diamondglasses", name: "Diamond glasses", he: "משקפי יהלום", price: 3000, frame: "#eef4ff", col2: "#9feaff" });
mem("glasses", "epic", { id: "rainbowglasses", name: "Rainbow sparkle glasses", he: "משקפי קשת בענן מנצנצים", price: 1800, frame: "#ff5fa8" });
mem("glasses", "epic", { id: "crownglasses", name: "Gold crown glasses", he: "משקפי זהב עם כתר", price: 2000, frame: "#ffc21a", col2: "#ffe9a8" });
mem("glasses", "epic", { id: "starshift", name: "Colour-changing stars", he: "משקפי כוכבים מחליפי צבע", price: 1600, frame: "#ff5fa8" });
mem("glasses", "legendary", { id: "masquerade", name: "Sparkly masquerade mask", he: "מסכת נשף נוצצת", price: 3500, frame: "#5a22a8", col2: "#ff9ce0", col3: "#ffd23a" });
mem("glasses", "legendary", { id: "scanner", name: "Future light visor", he: "משקפי עתיד עם אור רץ", price: 4000, frame: "#1d2030", col2: "#3fe8ff" });
// hypnosis glasses: a spiral that keeps spinning in the lenses
[["Purple", "#9b5cff", "סגולים"], ["Red", "#e8233a", "אדומים"], ["Blue", "#1f6bff", "כחולים"], ["Green", "#1fbf4a", "ירוקים"], ["Pink", "#ff4fa8", "ורודים"], ["Orange", "#ff7a1a", "כתומים"], ["Black and white", "#1d1d24", "שחור-לבן"]]
  .forEach(([n, col2, h]) => add("glasses", "rare", { id: "hypno", name: `${n} hypno glasses`, he: `משקפי היפנוזה ${h}`, price: 800, frame: "#1d1d24", col2 }));
add("glasses", "epic", { id: "hypno", name: "Rainbow hypno glasses", he: "משקפי היפנוזה בצבעי הקשת", price: 1500, frame: "#ffffff", col2: "#ff4f5f", rainbow: true });
// reading glasses: thin half-moon frames
[["Black", "#1d1d24", "שחורים"], ["White", "#f4f5f8", "לבנים"], ["Gold", "#e0b84a", "זהב", true], ["Silver", "#c9d3e3", "כסף", true], ["Red", "#d8233a", "אדומים"], ["Blue", "#1f6bff", "כחולים"], ["Pink", "#ff5fa8", "ורודים"], ["Purple", "#8a4dff", "סגולים"]]
  .forEach(([n, frame, h, metal]) => add("glasses", "common", { id: "reading", name: `${n} reading glasses`, he: `משקפי קריאה ${h}`, price: 250, frame, ...(metal ? { metal: true } : {}) }));
add("glasses", "common", { id: "reading", name: "Tortoise reading glasses", he: "משקפי קריאה בדוגמת צב", price: 300, frame: "#6b3a17", tortoise: true });
// more sunglasses colours (the built-in shades)
[["Yellow", "#ffd23a", "צהובים"], ["Orange", "#ff8a1c", "כתומים"], ["Purple", "#9b5cff", "סגולים"], ["Green", "#2fbf62", "ירוקים"], ["Silver", "#c9d3e3", "כסופים"], ["Brown", "#7a4a2a", "חומים"]]
  .forEach(([n, frame, h]) => add("glasses", "common", { id: "shades", name: `${n} sunglasses`, he: `משקפי שמש ${h}`, price: 400, frame }));

/* ---------------- round the neck (20, 5 for members) ---------------- */
add("neck", "rare", { id: "nameplate", name: "Jumpi name necklace", he: "שרשרת שם JUMPI", price: 700, col: "#ffc21a", col2: "#a8361f", metal: true });
add("neck", "common", { id: "halfheart", name: "Best friends half heart", he: "שרשרת חברות (חצי לב)", price: 400, col: "#d9e0ea", col2: "#ff5fa8", metal: true });
add("neck", "common", { id: "shells", name: "Seashell necklace", he: "שרשרת צדפים", price: 450, col: "#c9a46a", col2: "#5fe0c0" });
add("neck", "common", { id: "keynecklace", name: "Little key necklace", he: "שרשרת מפתח קטן", price: 400, col: "#ffc21a", col2: "#ffc21a", metal: true });
add("neck", "common", { id: "paw", name: "Paw print necklace", he: "שרשרת כף רגל של חיה", price: 400, col: "#d9e0ea", col2: "#ff7fbf", metal: true });
add("neck", "rare", { id: "rainbownecklace", name: "Rainbow necklace", he: "שרשרת קשת בענן", price: 650, col: "#d9e0ea", metal: true });
add("neck", "rare", { id: "moonstar", name: "Moon and star necklace", he: "שרשרת ירח וכוכב", price: 600, col: "#ffc21a", col2: "#ffc21a", metal: true });
add("neck", "common", { id: "sunflower", name: "Sunflower necklace", he: "שרשרת חמנייה", price: 450, col: "#ffd21a", col2: "#6b3f1f" });
add("neck", "rare", { id: "turtle", name: "Sea turtle necklace", he: "שרשרת צב ים", price: 650, col: "#2fbf62", col2: "#9be07a" });
add("neck", "common", { id: "woodbeads", name: "Wooden bead necklace", he: "שרשרת חרוזי עץ", price: 300, col: "#b07a45" });
add("neck", "common", { id: "candy", name: "Candy necklace", he: "שרשרת סוכריות", price: 350, col: "#ffb3d1" });
add("neck", "common", { id: "dotbowtie", name: "Polka-dot bow tie", he: "עניבת פרפר עם נקודות", price: 300, col: "#e8233a", col2: "#ffffff" });
add("neck", "rare", { id: "knitscarf", name: "Chunky winter scarf", he: "צעיף חורף עבה", price: 700, col: "#d8333a", cols: ["#d8333a", "#f4f1e8"], chunky: true });
add("neck", "rare", { id: "camera", name: "Little camera", he: "מצלמה קטנה על הצוואר", price: 800, col: "#5fe0c0", col2: "#ff5f5f" });
add("neck", "common", { id: "musicnote", name: "Music note necklace", he: "שרשרת תו מוזיקה", price: 400, col: "#ffc21a", col2: "#ffc21a", metal: true });
mem("neck", "epic", { id: "moonstone", name: "Sparkling moonstone", he: "שרשרת אבן ירח מנצנצת", price: 1500, col: "#e8eef8", col2: "#cfe8ff", metal: true });
mem("neck", "epic", { id: "huecrystal", name: "Colour-changing crystal", he: "שרשרת קריסטל שמשנה צבע", price: 2000, col: "#e8eef8", metal: true });
mem("neck", "rare", { id: "whistle", name: "Gold crown whistle", he: "משרוקית זהב עם כתר", price: 900, col: "#ffc21a", col2: "#ff3b6b", metal: true });
mem("neck", "epic", { id: "comet", name: "Blazing comet necklace", he: "שרשרת כוכב שביט", price: 1800, col: "#ffd23a", col2: "#5fe0ff", col3: "#ff9ce0", metal: true });
mem("neck", "legendary", { id: "sparklewings", name: "Sparkly butterfly wings", he: "כנפי פרפר מנצנצות", price: 4000, col: "#3fa8ff", col2: "#ff9ce0", col3: "#7b3fe4" });
// scarves in every colour (the built-in scarf; col2 = the bobbles on the ends) and two striped ones
[["Black", "#24262d", "#ffffff", "שחור"], ["White", "#f6f7fa", "#8fd0ff", "לבן"], ["Yellow", "#ffd23a", "#ff8a1c", "צהוב"], ["Orange", "#ff8a1c", "#ffd23a", "כתום"],
 ["Grey", "#9aa5b8", "#ffffff", "אפור"], ["Navy", "#1f2f6b", "#ffd23a", "כחול כהה"], ["Mint", "#5fe0c0", "#ffffff", "מנטה"], ["Brown", "#7a4a2a", "#f2ead6", "חום"]]
  .forEach(([n, col, col2, h]) => add("neck", "common", { id: "scarf", name: `${n} scarf`, he: `צעיף ${h}`, price: 350, col, col2 }));
add("neck", "common", { id: "knitscarf", name: "Red and white striped scarf", he: "צעיף פסים אדום-לבן", price: 400, col: "#e8233a", cols: ["#e8233a", "#ffffff"] });
add("neck", "rare", { id: "knitscarf", name: "Rainbow striped scarf", he: "צעיף פסים בצבעי הקשת", price: 600, col: "#ff4f5f", cols: ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#9a5cff"] });

export const ITEMS = I;
