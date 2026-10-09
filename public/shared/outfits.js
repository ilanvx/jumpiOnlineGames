/*
  Every piece of clothing in Jumpi: hair, shirts, pants, glasses, hats, necklaces.
  Used by the game (to build them in 3D) and by the server (catalog.js, prices).
  The position in each list is the item number ("hair:12"), so ONLY ADD AT THE END of a list.
  The first 4 hair / shirts / pants / glasses are the free sign-up choices.
*/
const out = { hair: [], shirt: [], pants: [], glasses: [], hat: [], neck: [] };
const add = (slot, o) => out[slot].push(o);

/* ---------- the original 8 of each (don't change their order) ---------- */
[
  ["spiky", "Spiky (boy)", 150], ["quiff", "Quiff (boy)", 150], ["pigtails", "Pigtails (girl)", 150], ["longbow", "Long with bow (girl)", 150],
].forEach(([id, name, price]) => add("hair", { id, name, price, starter: true }));
add("hair", { id: "spiky", name: "Electric Spiky", price: 450, col: ["#1f6bff", "#59a0ff"] });
add("hair", { id: "quiff", name: "Platinum Quiff", price: 450, col: ["#e9dfc4", "#fffaf0"] });
add("hair", { id: "pigtails", name: "Pink Pigtails", price: 450, col: ["#ff5fa8", "#ff9ccc"] });
add("hair", { id: "longbow", name: "Violet Waves", price: 500, col: ["#7b3fe4", "#a77bff"] });

[["red", "Red tee", 120], ["sailor", "Sailor stripes", 120], ["hoodie", "Green hoodie", 120], ["star", "Star tee", 120]].forEach(([id, name, price]) => add("shirt", { id, name, price, starter: true }));
[["jumpi", "Jumpi tee", 350], ["tiedye", "Tie-dye", 500], ["galaxy", "Galaxy", 650], ["tux", "Tuxedo", 800]].forEach(([id, name, price]) => add("shirt", { id, name, price }));

[["denim", "Jeans", 120], ["black", "Black joggers", 120], ["khaki", "Khaki shorts", 120], ["plaid", "Red plaid", 120]].forEach(([id, name, price]) => add("pants", { id, name, price, starter: true }));
[["pink", "Pink jeans", 350], ["camo", "Camo", 450], ["rainbow", "Rainbow", 600], ["gold", "Gold shorts", 750]].forEach(([id, name, price]) => add("pants", { id, name, price }));

[["round", "Round", 100], ["square", "Square", 100], ["star", "Star party", 100], ["shades", "Sunglasses", 100]].forEach(([id, name, price]) => add("glasses", { id, name, price, starter: true }));
[["heart", "Heart", 350], ["neon", "Neon shades", 450], ["goldround", "Gold round", 600], ["monocle", "Monocle", 700]].forEach(([id, name, price]) => add("glasses", { id, name, price }));

/* ---------- new: lots of colours ---------- */
const HAIR_COLS = {
  Golden: ["#e8b730", "#ffd866"], Ginger: ["#d9561e", "#ff8a3c"], "Jet black": ["#16161e", "#34343f"], Silver: ["#b9c0cc", "#eef1f6"],
  Mint: ["#22c39a", "#7deccb"], Cherry: ["#d61f3a", "#ff5c6e"], Ocean: ["#1f6bff", "#59a0ff"], Candy: ["#ff5fa8", "#ff9ccc"], Violet: ["#7b3fe4", "#a77bff"],
};
const SHAPE_NAME = { spiky: "Spiky", quiff: "Quiff", pigtails: "Pigtails", longbow: "Long hair", buzz: "Buzz cut", afro: "Afro", mohawk: "Mohawk", bun: "Top bun" };
// the original 4 styles in every other colour
const already = { spiky: "Ocean", quiff: "Silver", pigtails: "Candy", longbow: "Violet" };
["spiky", "quiff", "pigtails", "longbow"].forEach((id) =>
  Object.entries(HAIR_COLS).forEach(([c, col]) => { if (c !== already[id]) add("hair", { id, name: `${c} ${SHAPE_NAME[id]}`, price: 300, col }); }));
// 4 brand new hairstyles, natural + 4 colours each
[["buzz", ["#3b2416", "#5c3a22"]], ["afro", ["#2a1a14", "#4a2e22"]], ["mohawk", ["#16161e", "#34343f"]], ["bun", ["#7a3b1c", "#a2582e"]]].forEach(([id, natural]) => {
  add("hair", { id, name: SHAPE_NAME[id], price: 400, col: natural });
  ["Golden", "Mint", "Cherry", "Candy"].forEach((c) => add("hair", { id, name: `${c} ${SHAPE_NAME[id]}`, price: 500, col: HAIR_COLS[c] }));
});

// shirts
[["Blue", "#2f7bff", "#1d4fb0"], ["Green", "#2fbf62", "#1d8a43"], ["Yellow", "#ffd23a", "#d9a400"], ["Purple", "#9b5cff", "#6a2fd6"], ["Pink", "#ff7fbf", "#d64f95"],
  ["Black", "#2a2d36", "#111318"], ["White", "#ffffff", "#c9d3e3"], ["Orange", "#ff8a1c", "#c75e00"], ["Mint", "#5fe0c0", "#2aa585"]]
  .forEach(([n, fill, hem]) => add("shirt", { id: "tee", name: `${n} tee`, price: 200, fill, hem }));
[["Blue", "#2f7bff", "#1d4fb0"], ["Pink", "#ff7fbf", "#d64f95"], ["Black", "#2a2d36", "#111318"], ["Yellow", "#ffd23a", "#d9a400"], ["Purple", "#9b5cff", "#6a2fd6"], ["Red", "#e8423b", "#a8231e"]]
  .forEach(([n, fill, hem]) => add("shirt", { id: "hoodie", name: `${n} hoodie`, price: 400, fill, hem }));
[["Red", "#d8333a"], ["Pink", "#ff5fa8"], ["Black", "#1d1d24"]].forEach(([n, acc]) => add("shirt", { id: "sailor", name: `${n} stripes`, price: 300, fill: "#ffffff", hem: acc, acc }));
[["Navy", "#1d2b4f", "#11192f", "#ffd23a"], ["Pink", "#ff7fbf", "#d64f95", "#ffffff"], ["Black", "#2a2d36", "#111318", "#ff3b3b"], ["Mint", "#5fe0c0", "#2aa585", "#7b3fe4"]]
  .forEach(([n, fill, hem, acc]) => add("shirt", { id: "star", name: `${n} star tee`, price: 300, fill, hem, acc }));
[["White", "#ffffff", "#c9d3e3", "#ff3b5c"], ["Pink", "#ff7fbf", "#d64f95", "#ffffff"], ["Purple", "#9b5cff", "#6a2fd6", "#ff9ccc"]]
  .forEach(([n, fill, hem, acc]) => add("shirt", { id: "heart", name: `${n} heart tee`, price: 350, fill, hem, acc }));
[["Red", "#e8423b", "#ffffff"], ["Blue", "#2f7bff", "#ffffff"], ["Green", "#2fbf62", "#ffffff"], ["Yellow", "#ffd23a", "#1d2b4f"]]
  .forEach(([n, fill, acc]) => add("shirt", { id: "jersey", name: `${n} jersey`, price: 450, fill, hem: acc, acc }));
[["Red", "#d8333a", "#2b1a1a"], ["Blue", "#2f6fd6", "#0f1f3d"], ["Green", "#2f9a43", "#123018"]]
  .forEach(([n, fill, acc]) => add("shirt", { id: "flannel", name: `${n} flannel`, price: 450, fill, hem: acc, acc }));
[["Candy", ["#ff5fa8", "#ffffff", "#ffd23a", "#9b5cff"]], ["Ocean", ["#1f6bff", "#ffffff", "#2fd3a0", "#1d2b4f"]]]
  .forEach(([n, stripes]) => add("shirt", { id: "stripes", name: `${n} stripes shirt`, price: 400, fill: stripes[0], hem: stripes[3], stripes }));

// pants
[["Light jeans", "#7fb2f0", "#5a8fd6"], ["Black jeans", "#2a2c34", "#16181e"], ["White jeans", "#eef1f6", "#c9d3e3"]]
  .forEach(([name, base, waist]) => add("pants", { id: "denim", name, price: 300, base, waist }));
[["Grey", "#8a93a3", "#5e6676"], ["Navy", "#1d2b4f", "#11192f"], ["Red", "#d8333a", "#8f1d22"], ["Green", "#2f9a43", "#1d6a2c"], ["Pink", "#ff7fbf", "#d94f95"], ["Purple", "#9b5cff", "#6a2fd6"]]
  .forEach(([n, base, waist]) => add("pants", { id: "black", name: `${n} joggers`, price: 250, base, waist }));
[["Blue", "#2f7bff", "#1d4fb0"], ["Red", "#e8423b", "#a8231e"], ["Green", "#2fbf62", "#1d8a43"], ["Pink", "#ff7fbf", "#d64f95"], ["Purple", "#9b5cff", "#6a2fd6"], ["Black", "#2a2d36", "#111318"]]
  .forEach(([n, base, waist]) => add("pants", { id: "khaki", name: `${n} shorts`, price: 250, base, waist }));
[["Blue plaid", "#2f6fd6", "#173c80"], ["Green plaid", "#2f9a43", "#1d6a2c"], ["Purple plaid", "#8a4dff", "#5a22d6"]]
  .forEach(([name, base, waist]) => add("pants", { id: "plaid", name, price: 350, base, waist }));
add("pants", { id: "stars", name: "Starry pants", price: 450, base: "#1d2b4f", waist: "#11192f", acc: "#ffd23a" });
add("pants", { id: "hearts", name: "Heart pants", price: 450, base: "#ff9ccc", waist: "#d64f95", acc: "#ff3b5c" });
add("pants", { id: "zebra", name: "Zebra pants", price: 500, base: "#ffffff", waist: "#1d1d24", acc: "#1d1d24" });
add("pants", { id: "galaxy", name: "Galaxy pants", price: 650, base: "#24165c", waist: "#0d0824" });

// glasses (frame colours)
[["Red", "#e23b3b"], ["Blue", "#1f6bff"], ["Pink", "#ff5fa8"], ["White", "#ffffff"], ["Mint", "#2fd3a0"]].forEach(([n, frame]) => add("glasses", { id: "round", name: `${n} round`, price: 250, frame }));
[["Black", "#1d1d24"], ["Blue", "#1f6bff"], ["Green", "#2fbf62"], ["Purple", "#9b5cff"]].forEach(([n, frame]) => add("glasses", { id: "square", name: `${n} square`, price: 250, frame }));
[["Red", "#e23b3b"], ["Purple", "#9b5cff"], ["Gold", "#f2c230"]].forEach(([n, frame]) => add("glasses", { id: "heart", name: `${n} hearts`, price: 400, frame }));
[["Pink", "#ff5fa8"], ["Blue", "#1fb6ff"], ["Silver", "#c9d3e3"]].forEach(([n, frame]) => add("glasses", { id: "star", name: `${n} stars`, price: 300, frame }));
[["White", "#ffffff"], ["Pink", "#ff5fa8"], ["Gold", "#f2c230"]].forEach(([n, frame]) => add("glasses", { id: "shades", name: `${n} sunglasses`, price: 400, frame }));
[["Pink", "#ff2fa0"], ["Blue", "#1fb6ff"], ["Orange", "#ff8a1c"]].forEach(([n, frame]) => add("glasses", { id: "neon", name: `${n} neon shades`, price: 500, frame, glow: frame }));

// more shirts
[["Blue", "#2f7bff", "#1d4fb0", "#ffd23a"], ["Mint", "#5fe0c0", "#2aa585", "#ff5fa8"], ["Yellow", "#ffd23a", "#d9a400", "#e8423b"]]
  .forEach(([n, fill, hem, acc]) => add("shirt", { id: "heart", name: `${n} heart tee`, price: 350, fill, hem, acc }));
[["Purple", "#9b5cff", "#ffffff"], ["Black", "#2a2d36", "#ffd23a"], ["Pink", "#ff5fa8", "#ffffff"], ["Orange", "#ff8a1c", "#1d2b4f"]]
  .forEach(([n, fill, acc]) => add("shirt", { id: "jersey", name: `${n} jersey`, price: 450, fill, hem: acc, acc }));
[["Purple", "#8a4dff", "#2a1450"], ["Pink", "#ff6fae", "#5a1638"], ["Yellow", "#e8b730", "#4a3608"]]
  .forEach(([n, fill, acc]) => add("shirt", { id: "flannel", name: `${n} flannel`, price: 450, fill, hem: acc, acc }));
[["Sunset", ["#ff8a1c", "#ffd23a", "#ff4f8b", "#7a2f9e"]], ["Forest", ["#2f9a43", "#e9f5d0", "#1d6a2c", "#123018"]], ["Bee", ["#ffd23a", "#1d1d24", "#ffd23a", "#1d1d24"]],
  ["Rainbow", ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#9a5cff"]], ["Mono", ["#ffffff", "#1d1d24", "#ffffff", "#1d1d24"]]]
  .forEach(([n, stripes]) => add("shirt", { id: "stripes", name: `${n} stripes shirt`, price: 400, fill: stripes[0], hem: stripes[stripes.length - 1], stripes }));
[["Red", "#e8423b", "#a8231e"], ["Teal", "#1fb6c9", "#127d8a"], ["Lilac", "#c9a6ff", "#8a63d6"]]
  .forEach(([n, fill, hem]) => add("shirt", { id: "hoodie", name: `${n} hoodie`, price: 400, fill, hem }));
[["Red", "#e8423b", "#a8231e"], ["Teal", "#1fb6c9", "#127d8a"], ["Lilac", "#c9a6ff", "#8a63d6"], ["Brown", "#8a5a3c", "#5c3a22"]]
  .forEach(([n, fill, hem]) => add("shirt", { id: "tee", name: `${n} tee`, price: 200, fill, hem }));

// more pants
[["Blue starry", "#1f4fb0", "#123070", "#ffffff"], ["Pink starry", "#ff7fbf", "#d64f95", "#ffe94a"], ["Black starry", "#1d1d24", "#000000", "#ff5fa8"]]
  .forEach(([name, base, waist, acc]) => add("pants", { id: "stars", name, price: 450, base, waist, acc }));
[["Purple hearts", "#c9a6ff", "#8a63d6", "#ff3b9a"], ["White hearts", "#ffffff", "#c9d3e3", "#ff3b5c"]]
  .forEach(([name, base, waist, acc]) => add("pants", { id: "hearts", name, price: 450, base, waist, acc }));
[["Pink zebra", "#ffd0e6", "#ff5fa8", "#ff5fa8"], ["Tiger", "#ff9a1f", "#1d1d24", "#1d1d24"], ["Purple zebra", "#e6d6ff", "#5a22d6", "#5a22d6"]]
  .forEach(([name, base, waist, acc]) => add("pants", { id: "zebra", name, price: 500, base, waist, acc }));
[["Pink jeans shorts", "#ff7fbf", "#d64f95"], ["Light jean shorts", "#7fb2f0", "#5a8fd6"], ["Yellow shorts", "#ffd23a", "#d9a400"], ["Mint shorts", "#5fe0c0", "#2aa585"], ["White shorts", "#f2f4f8", "#c9d3e3"]]
  .forEach(([name, base, waist]) => add("pants", { id: "khaki", name, price: 250, base, waist }));
[["Yellow joggers", "#ffd23a", "#d9a400"], ["Sky joggers", "#7fc8ff", "#3f93d6"], ["White joggers", "#f2f4f8", "#c9d3e3"]]
  .forEach(([name, base, waist]) => add("pants", { id: "black", name, price: 250, base, waist }));
[["Desert camo", "#c9a46a", "#8a6a3a", ["#a8854a", "#e2c89a", "#7a5a2a", "#d8b67a"]], ["Pink camo", "#ff9ccc", "#d64f95", ["#ff5fa8", "#ffd0e6", "#d64f95", "#ffb3d9"]],
  ["Snow camo", "#eef1f6", "#9aa5b8", ["#c9d3e3", "#ffffff", "#8a93a3", "#dde3ec"]], ["Blue camo", "#3f6fd6", "#1d3d8f", ["#1d3d8f", "#7fb2f0", "#123070", "#5a8fd6"]]]
  .forEach(([name, base, waist, camo]) => add("pants", { id: "camo", name, price: 450, base, waist, camo }));
add("pants", { id: "gold", name: "Silver shorts", price: 750, metal: ["#e9eef5", "#9aa5b8"], waist: "#6b7586" });
add("pants", { id: "gold", name: "Rose gold shorts", price: 750, metal: ["#ffd0c2", "#d98a7a"], waist: "#a35a4a" });

// more glasses
[["Silver", "#d9e0ea"], ["Rose", "#ffb3a6"]].forEach(([n, frame]) => add("glasses", { id: "goldround", name: `${n} round`, price: 600, frame }));
[["Silver", "#d9e0ea"], ["Pink", "#ff9ccc"]].forEach(([n, frame]) => add("glasses", { id: "monocle", name: `${n} monocle`, price: 700, frame }));
[["Green", "#39ff14"], ["Purple", "#b44dff"], ["Yellow", "#ffe94a"]].forEach(([n, frame]) => add("glasses", { id: "neon", name: `${n} neon shades`, price: 500, frame, glow: frame }));
[["Blue", "#1f6bff"], ["Red", "#e23b3b"], ["Mint", "#2fd3a0"]].forEach(([n, frame]) => add("glasses", { id: "shades", name: `${n} sunglasses`, price: 400, frame }));
[["Mint", "#2fd3a0"], ["Orange", "#ff8a1c"]].forEach(([n, frame]) => add("glasses", { id: "star", name: `${n} stars`, price: 300, frame }));
[["Blue", "#1f6bff"], ["Mint", "#2fd3a0"]].forEach(([n, frame]) => add("glasses", { id: "heart", name: `${n} hearts`, price: 400, frame }));
[["Pink", "#ff5fa8"], ["Orange", "#ff8a1c"], ["White", "#ffffff"]].forEach(([n, frame]) => add("glasses", { id: "square", name: `${n} square`, price: 250, frame }));

/* ---------- hats (a hat covers the hair, except the ear headbands) ---------- */
[["Red", "#e8423b"], ["Blue", "#2f7bff"], ["Black", "#2a2d36"], ["Pink", "#ff7fbf"], ["Green", "#2fbf62"], ["Yellow", "#ffd23a"]]
  .forEach(([n, col]) => add("hat", { id: "cap", name: `${n} cap`, price: 300, col, col2: "#ffffff" }));
[["Red", "#e8423b"], ["Blue", "#2f7bff"], ["Pink", "#ff7fbf"], ["Purple", "#9b5cff"], ["Mint", "#5fe0c0"]]
  .forEach(([n, col]) => add("hat", { id: "beanie", name: `${n} beanie`, price: 300, col, col2: "#ffffff" }));
[["Black", "#1d1d24", "#d61f3a"], ["Purple", "#5a22d6", "#ffd23a"], ["White", "#f2f4f8", "#1d1d24"]]
  .forEach(([n, col, col2]) => add("hat", { id: "tophat", name: `${n} top hat`, price: 600, col, col2 }));
[["Brown", "#a0602f", "#5c3a22"], ["Black", "#2a2d36", "#c9d3e3"], ["Pink", "#ff7fbf", "#ffffff"]]
  .forEach(([n, col, col2]) => add("hat", { id: "cowboy", name: `${n} cowboy hat`, price: 500, col, col2 }));
[["Pink", "#ff5fa8", "#ffd23a"], ["Blue", "#1fb6ff", "#ff5fa8"], ["Yellow", "#ffd23a", "#9b5cff"]]
  .forEach(([n, col, col2]) => add("hat", { id: "party", name: `${n} party hat`, price: 250, col, col2 }));
[["Gold", "#ffc21a", "#ff3b6b", 1500], ["Silver", "#d9e0ea", "#1f9bff", 1200], ["Rose gold", "#ffb3a6", "#9b5cff", 1200]]
  .forEach(([n, col, col2, price]) => add("hat", { id: "crown", name: `${n} crown`, price, col, col2 }));
[["Yellow", "#ffd23a"], ["Blue", "#2f7bff"], ["Mint", "#5fe0c0"]].forEach(([n, col]) => add("hat", { id: "bucket", name: `${n} bucket hat`, price: 350, col }));
[["Red", "#d8333a"], ["Black", "#2a2d36"], ["Purple", "#9b5cff"]].forEach(([n, col]) => add("hat", { id: "beret", name: `${n} beret`, price: 350, col }));
[["Black", "#2a2d36"], ["White", "#f2f4f8"], ["Orange", "#ff8a1c"]].forEach(([n, col]) => add("hat", { id: "catears", name: `${n} cat ears`, price: 400, col, col2: "#ff9ccc", keepHair: true }));
[["White", "#f2f4f8"], ["Pink", "#ff9ccc"], ["Grey", "#9aa5b8"]].forEach(([n, col]) => add("hat", { id: "bunnyears", name: `${n} bunny ears`, price: 400, col, col2: "#ff9ccc", keepHair: true }));

/* ---------- necklaces & neckwear ---------- */
[["Gold", "#ffc21a"], ["Silver", "#d9e0ea"]].forEach(([n, col]) => add("neck", { id: "chain", name: `${n} chain`, price: 350, col, metal: true }));
[["White", "#f6f2ea"], ["Pink", "#ffc2dc"], ["Black", "#2a2d36"]].forEach(([n, col]) => add("neck", { id: "pearls", name: `${n} pearls`, price: 450, col }));
[["Rainbow", ["#ff4f5f", "#ff9a1f", "#ffe94a", "#4fe07a", "#3fb8ff", "#9a5cff"]], ["Candy", ["#ff5fa8", "#ffffff", "#9b5cff"]], ["Ocean", ["#1f6bff", "#5fe0c0", "#ffffff"]]]
  .forEach(([n, cols]) => add("neck", { id: "beads", name: `${n} beads`, price: 250, col: cols[0], cols }));
[["Gold", "#ffc21a", "#ffc21a"], ["Silver", "#d9e0ea", "#ff3b6b"], ["Pink", "#ffc21a", "#ff5fa8"]]
  .forEach(([n, col, col2]) => add("neck", { id: "heart", name: `${n} heart necklace`, price: 400, col, col2, metal: true }));
[["Gold", "#ffc21a", "#ffc21a"], ["Blue", "#d9e0ea", "#1fb6ff"]].forEach(([n, col, col2]) => add("neck", { id: "star", name: `${n} star necklace`, price: 400, col, col2, metal: true }));
[["Ruby", "#ff2f55"], ["Sapphire", "#1f6bff"], ["Emerald", "#1fd37a"], ["Amethyst", "#a24dff"]]
  .forEach(([n, col2]) => add("neck", { id: "gem", name: `${n} necklace`, price: 550, col: "#ffc21a", col2, metal: true }));
[["Gold", "#ffc21a", "#e8423b"], ["Silver", "#d9e0ea", "#2f7bff"]].forEach(([n, col, col2]) => add("neck", { id: "medal", name: `${n} medal`, price: 500, col, col2 }));
[["Pink", "#ff7fbf", "#ffd23a"], ["Rainbow", "#ff4f5f", "#ffffff"], ["Yellow", "#ffd23a", "#ff8a1c"]]
  .forEach(([n, col, col2]) => add("neck", { id: "lei", name: `${n} flower lei`, price: 350, col, col2, rainbow: n === "Rainbow" }));
[["Red", "#e8423b", "#ffffff"], ["Blue", "#2f7bff", "#ffd23a"], ["Pink", "#ff7fbf", "#ffffff"], ["Green", "#2fbf62", "#ffd23a"], ["Purple", "#9b5cff", "#5fe0c0"]]
  .forEach(([n, col, col2]) => add("neck", { id: "scarf", name: `${n} scarf`, price: 350, col, col2 }));
[["Red", "#d61f3a"], ["Blue", "#1f6bff"], ["Black", "#1d1d24"], ["Pink", "#ff5fa8"]].forEach(([n, col]) => add("neck", { id: "bowtie", name: `${n} bow tie`, price: 250, col }));

/* ---------- work uniforms: gifts for reaching the top level of a job (never sold, never traded) ---------- */
add("shirt", { id: "police", name: "Police shirt", price: 0, gift: "police" });
add("pants", { id: "police", name: "Police pants", price: 0, gift: "police" });
add("hat", { id: "police", name: "Police cap", price: 0, gift: "police", col: "#1c3c86", col2: "#ffd23a" });
add("shirt", { id: "waiter", name: "Waiter vest & bow tie", price: 0, gift: "waiter" });
add("pants", { id: "waiter", name: "Waiter pants", price: 0, gift: "waiter" });
add("neck", { id: "apron", name: "Waiter apron", price: 0, gift: "waiter", col: "#ffffff", col2: "#e8423b" });

/* ---------- season-only clothes (public/shared/season.js): prizes on the season track, never sold or traded ---------- */
// Galaxy Season (s1)
add("glasses", { id: "neon", name: "Nebula shades", price: 0, gift: "season:s1", tier: 5, frame: "#5fe0ff", glow: "#5fe0ff" });
add("neck", { id: "star", name: "Comet necklace", price: 0, gift: "season:s1", tier: 10, col: "#e8e8ff", col2: "#9b5cff", metal: true });
add("hair", { id: "spiky", name: "Nebula spikes", price: 0, gift: "season:s1", tier: 15, col: ["#7b3fe4", "#5fe0ff"] });
add("pants", { id: "gold", name: "Cosmic pants", price: 0, gift: "season:s1", tier: 20, metal: ["#e6d6ff", "#7b3fe4"] });
add("shirt", { id: "star", name: "Starlight tee", price: 0, gift: "season:s1", tier: 25, fill: "#1b1446", hem: "#9b5cff", acc: "#ffd23a" });
add("hat", { id: "crown", name: "Galaxy crown", price: 0, gift: "season:s1", tier: 30, col: "#c9b6ff", col2: "#5fe0ff" });
/* ---------- the Lucky Wheel's rare prize ---------- */
add("hat", { id: "party", name: "Lucky hat", price: 0, gift: "wheel", col: "#ffd23a", col2: "#2fd36b" });

// pizza delivery uniform (jobs.js "delivery"): red jersey, red cap, black shorts
add("shirt", { id: "jersey", name: "Delivery shirt", price: 0, gift: "delivery", fill: "#e8423b", hem: "#ffffff", acc: "#ffffff" });
add("pants", { id: "khaki", name: "Delivery shorts", price: 0, gift: "delivery", base: "#26262e", waist: "#15151a" });
add("hat", { id: "cap", name: "Delivery cap", price: 0, gift: "delivery", col: "#e8423b", col2: "#ffffff" });

// birthday present (public/shared/birthday.js): only given on your birthday, never sold or traded
add("hat", { id: "party", name: "Birthday hat", price: 0, gift: "birthday", col: "#ff5fa8", col2: "#ffd23a" });
export const OUTFITS = out;

/* ---------- moderators: worn only by players with the moderator role (never sold, never traded) ---------- */
add("shirt", { id: "mod", name: "Moderator shirt", price: 0, gift: "mod", fill: "#1f5fe0", hem: "#123a99" });
add("pants", { id: "black", name: "Moderator pants", price: 0, gift: "mod", base: "#173f9e", waist: "#0d2766" });
add("hat", { id: "cap", name: "Moderator cap", price: 0, gift: "mod", col: "#1f5fe0", col2: "#ffffff" });

/* ---------- HALLOWEEN (public/shared/events.js): sold only while the Halloween event is on (the Spooky Shop).
   Players keep them all year; they can wear and trade them. ---------- */
const H = (slot, o) => add(slot, { ...o, event: "halloween" });
H("hair", { id: "spiky", name: "Pumpkin spikes", price: 900, col: ["#ff7a12", "#ffb347"] });
H("hair", { id: "longbow", name: "Witchy waves", price: 1000, col: ["#2fbf62", "#7b3fe4"] });
H("hair", { id: "mohawk", name: "Bat mohawk", price: 1100, col: ["#2a1640", "#9b5cff"] });
H("shirt", { id: "skeleton", name: "Skeleton tee", price: 1300, fill: "#1b1b24", hem: "#0d0d14" });
H("shirt", { id: "pumpkin", name: "Pumpkin tee", price: 900, fill: "#ff8a1c", hem: "#c75e00" });
H("shirt", { id: "vampire", name: "Vampire suit", price: 1700, fill: "#15121c", hem: "#0a0810" });
H("shirt", { id: "mummy", name: "Mummy wraps", price: 1300, fill: "#efe6cf", hem: "#cbbd99" });
H("shirt", { id: "ghost", name: "Ghost party tee", price: 900, fill: "#6a3fd0", hem: "#3f1f8f" });
H("shirt", { id: "web", name: "Spider web tee", price: 1000, fill: "#24202c", hem: "#ff8a1c" });
H("shirt", { id: "stripes", name: "Candy corn stripes", price: 800, fill: "#ffffff", hem: "#ff8a1c", stripes: ["#ffffff", "#ffd23a", "#ff8a1c", "#ffd23a"] });
H("pants", { id: "skeleton", name: "Skeleton pants", price: 1100, base: "#1b1b24", waist: "#0d0d14" });
H("pants", { id: "mummy", name: "Mummy pants", price: 1100, base: "#efe6cf", waist: "#cbbd99" });
H("pants", { id: "hstripes", name: "Witch stripes", price: 900, base: "#2a1640", waist: "#1a0d2a", acc: "#9b5cff" });
H("pants", { id: "khaki", name: "Pumpkin shorts", price: 600, base: "#ff8a1c", waist: "#2a1640" });
H("pants", { id: "black", name: "Slime joggers", price: 700, base: "#6bdc2a", waist: "#3a8a12" });
H("glasses", { id: "batmask", name: "Bat mask", price: 1000, frame: "#1d1d24" });
H("glasses", { id: "batmask", name: "Midnight bat mask", price: 1200, frame: "#7b3fe4", glow: "#b48cff" });
H("glasses", { id: "pumpkin", name: "Pumpkin glasses", price: 800, frame: "#ff8a1c" });
H("hat", { id: "witch", name: "Witch hat", price: 1400, col: "#1d1d24", col2: "#7b3fe4" });
H("hat", { id: "witch", name: "Purple witch hat", price: 1400, col: "#5a22d6", col2: "#6bdc2a" });
H("hat", { id: "pumpkinhead", name: "Pumpkin head", price: 3500, col: "#ff8a1c", col2: "#ffd23a" });
H("hat", { id: "horns", name: "Devil horns", price: 900, col: "#e8172f", col2: "#ff6a5a", keepHair: true });
H("hat", { id: "horns", name: "Glow horns", price: 1600, col: "#9b5cff", col2: "#e0ccff", glow: true, keepHair: true });
H("hat", { id: "batband", name: "Bat headband", price: 1100, col: "#1d1d24", col2: "#7b3fe4", keepHair: true });
H("neck", { id: "cape", name: "Vampire cape", price: 2500, col: "#141018", col2: "#c8102e" });
H("neck", { id: "cape", name: "Witch cape", price: 2500, col: "#2a1640", col2: "#6bdc2a" });
H("neck", { id: "beads", name: "Candy corn beads", price: 600, col: "#ff8a1c", cols: ["#ff8a1c", "#ffd23a", "#ffffff"] });
H("neck", { id: "spider", name: "Spider necklace", price: 1000, col: "#d9e0ea", col2: "#1d1d24", metal: true });

export const OUTFIT_SLOTS = Object.keys(out);
