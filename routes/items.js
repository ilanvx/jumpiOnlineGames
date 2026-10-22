import express from "express";
import { ItemDef } from "../models/ItemDef.js";
import { OUTFITS, OUTFIT_SLOTS, CUSTOM_FROM, CUSTOM_MAX, applyCustom } from "../public/shared/outfits.js";
import { syncCustomCatalog } from "../catalog.js";
import { AdminLog, logQuietly } from "../models/Logs.js";
import { cleanRecipe } from "../public/shared/recipe-spec.js";

/*
  The Item studio (admin panel → Item studio): fix where any item sits on the character, and make new items from the
  looks that already exist (their own colours, name, price, and where they're sold).
  Everything lives in the ItemDef collection. On start and after every change it is applied to the shared catalog
  (applyCustom in public/shared/outfits.js + syncCustomCatalog in catalog.js), and the game gets the same data from
  /shared/items/custom.js (made here, with a version that changes with every change: routes/fresh.js).
  Players who are already playing see a change the next time they open the game.
*/
const EMPTY = { rev: 0, fixes: {}, items: {} };
let JS = `export const CUSTOM = ${JSON.stringify(EMPTY)};\n`, REV = "0";
export const customRev = () => REV;

export async function loadCustom() {
  const rows = await ItemDef.find({}).lean();
  const C = { rev: 0, fixes: {}, items: {} };
  for (const r of rows) {
    C.rev = Math.max(C.rev, +new Date(r.updatedAt || 0));
    if (r.fix) C.fixes[r.key] = r.fix;
    if (r.item && r.index >= CUSTOM_FROM) (C.items[r.slot] ||= {})[r.index] = r.item;
  }
  applyCustom(C);
  syncCustomCatalog();
  REV = C.rev.toString(36) + "x" + rows.length.toString(36);
  JS = `export const CUSTOM = ${JSON.stringify(C)};\n`;
}

// GET /shared/items/custom.js (server.js, before the static files)
export function customJs(req, res) {
  res.type("text/javascript");
  res.set("Cache-Control", req.query.v === REV ? "public, max-age=31536000, immutable" : "no-cache");
  res.send(JS);
}

/* ---------- checking what the panel sends ---------- */
const HEX = /^#[0-9a-f]{6}$/i;
const isColor = (v) => (typeof v === "string" && HEX.test(v)) || (Array.isArray(v) && v.length > 0 && v.length <= 6 && v.every((x) => typeof x === "string" && HEX.test(x)));
// the colours an item has: its top-level fields that are a colour or a list of colours
const colorsOf = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => !["name", "he"].includes(k) && isColor(v)));
const RARITY = ["common", "rare", "epic", "legendary"], SALE = ["shop", "future", "members", "none"];
const OWN = ["name", "he", "price", "starter", "gift", "event", "world", "member", "costume", "custom", "fix", "fixPanel", "rarity", "sale", "base", "placeholder"];
const txt = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
const r4 = (n) => Math.round(n * 10000) / 10000;
// a fix: the whole item (p, r, s) and its parts on their own (parts: {"<child number>": {p, r, s}}: a jetpack's tanks without its straps)
function readFix(f, part = false) {
  if (f == null || typeof f !== "object") return null;
  const v3 = (a, lim) => (Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(+x) && Math.abs(+x) <= lim) ? a.map((x) => r4(+x)) : null);
  const p = v3(f.p, 3), r = v3(f.r, 7), s = Number.isFinite(+f.s) && +f.s >= .2 && +f.s <= 5 ? r4(+f.s) : 1;
  if ((f.p && !p) || (f.r && !r)) throw new Error("That position is out of range.");
  const out = {};
  if (p && p.some((x) => x !== 0)) out.p = p;
  if (r && r.some((x) => x !== 0)) out.r = r;
  if (s !== 1) out.s = s;
  if (!part && f.parts && typeof f.parts === "object") {
    const parts = {};
    for (const [k, v] of Object.entries(f.parts).slice(0, 80)) { if (!/^\d{1,3}$/.test(k)) continue; const one = readFix(v, true); if (one) parts[k] = one; }
    if (Object.keys(parts).length) out.parts = parts;
  }
  return Object.keys(out).length ? out : null;
}
function readDetails(d, colorKeys) {
  const name = txt(d.name, 40), he = txt(d.he, 40), price = Math.round(+d.price);
  if (!name) throw new Error("Give it an English name.");
  if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error("The price should be 0 to 100,000 coins.");
  if (!RARITY.includes(d.rarity)) throw new Error("Pick a rarity.");
  if (!SALE.includes(d.sale)) throw new Error("Pick where it's sold.");
  const colors = {};
  for (const [k, v] of Object.entries(d.colors || {})) {
    if (!colorKeys.includes(k)) continue;
    if (!isColor(v)) throw new Error(`"${k}" isn't a colour.`);
    colors[k] = Array.isArray(v) ? v.map((x) => x.toLowerCase()) : v.toLowerCase();
  }
  return { name, ...(he ? { he } : {}), price, rarity: d.rarity, sale: d.sale, ...colors };
}
const slotOk = (s) => OUTFIT_SLOTS.includes(s);
const log = (req, action, details) => logQuietly(AdminLog, { adminId: req.admin._id, admin: req.admin.username, action, details: String(details).slice(0, 300), via: "panel", ip: req.ip || "" });

/* ---------- the panel's API: /api/admin/itemdefs (inside routes/admin.js, so it is guarded and unlocked like the rest) ---------- */
export const itemAdmin = express.Router();

// every item, by list: what the panel shows
itemAdmin.get("/", (req, res) => {
  const slots = {};
  for (const slot of OUTFIT_SLOTS)
    slots[slot] = OUTFITS[slot].map((o, i) => (!o || o.placeholder ? null : {
      i, id: o.id, name: o.name, he: o.he || "", price: o.price || 0, rarity: o.rarity || "", custom: !!o.custom, base: o.base || "",
      sale: o.custom ? o.sale || "shop" : o.gift ? "prize" : o.costume ? "store" : o.member ? "members" : o.world === "future" ? "future" : o.event ? "event" : "shop",
      fix: o.fix || null, colors: colorsOf(o), starter: !!o.starter, design: !!o.recipe,
    })).filter(Boolean);
  res.json({ from: CUSTOM_FROM, max: CUSTOM_MAX, rarities: RARITY, slots });
});

// where an item sits on the character (any item). fix: null = back to how it was made
itemAdmin.post("/fix", async (req, res, next) => {
  try {
    const { slot } = req.body, i = Math.trunc(+req.body.i);
    if (!slotOk(slot) || !OUTFITS[slot][i] || OUTFITS[slot][i].placeholder) return res.status(404).json({ error: "No such item." });
    let fix;
    try { fix = readFix(req.body.fix); } catch (e) { return res.status(400).json({ error: e.message }); }
    const key = `${slot}:${i}`, row = await ItemDef.findOne({ key });
    if (!fix && row && !row.item) await row.deleteOne();
    else if (row) { row.fix = fix; row.by = req.admin.username; row.markModified("fix"); await row.save(); }
    else if (fix) await ItemDef.create({ key, slot, index: i, fix, by: req.admin.username });
    await loadCustom();
    log(req, "item-fix", `${key} ${OUTFITS[slot][i].name}: ${fix ? JSON.stringify(fix) : "reset"}`);
    res.json({ ok: true, fix: OUTFITS[slot][i].fix || null });
  } catch (err) { next(err); }
});

// a new item, made from an existing one (its look); or changes to an item made here before
itemAdmin.post("/item", async (req, res, next) => {
  try {
    const { slot } = req.body;
    if (!slotOk(slot)) return res.status(400).json({ error: "Pick a list." });
    const d = req.body.data || {};
    if (req.body.i == null) {   // new
      const from = Math.trunc(+req.body.from), t = OUTFITS[slot][from];
      if (!t || t.placeholder) return res.status(404).json({ error: "Pick the item to start from." });
      let det;
      try { det = readDetails(d, Object.keys(colorsOf(t))); } catch (e) { return res.status(400).json({ error: e.message }); }
      const shape = Object.fromEntries(Object.entries(t).filter(([k]) => !OWN.includes(k)));
      const used = await ItemDef.find({ slot, index: { $gte: CUSTOM_FROM } }, { index: 1 }).lean();
      const index = Math.max(CUSTOM_FROM - 1, ...used.map((u) => u.index)) + 1;
      if (index >= CUSTOM_FROM + CUSTOM_MAX) return res.status(409).json({ error: "This list is full." });
      let fix = null;
      try { fix = readFix(req.body.fix ?? t.fix ?? null); } catch (e) { return res.status(400).json({ error: e.message }); }
      const item = { ...shape, ...det, base: `${slot}:${from}` }, key = `${slot}:${index}`;
      await ItemDef.create({ key, slot, index, item, fix, by: req.admin.username });
      await loadCustom();
      log(req, "item-new", `${key} "${item.name}" from ${slot}:${from} (${t.name}), ${item.price} coins, ${item.sale}`);
      return res.json({ ok: true, i: index });
    }
    const i = Math.trunc(+req.body.i), key = `${slot}:${i}`, row = await ItemDef.findOne({ key });
    if (!row || !row.item) return res.status(404).json({ error: "Only items made here can be changed here." });
    let det;
    try { det = readDetails(d, Object.keys(colorsOf(row.item))); } catch (e) { return res.status(400).json({ error: e.message }); }
    row.item = { ...row.item, ...det };
    if (!det.he) delete row.item.he;
    row.by = req.admin.username; row.markModified("item"); await row.save();
    await loadCustom();
    log(req, "item-edit", `${key} "${det.name}", ${det.price} coins, ${det.sale}`);
    res.json({ ok: true, i });
  } catch (err) { next(err); }
});

// the Item designer (public/world/item-design.js): save a design as a new item, or save over a design made before.
// A new design starts as "not sold": its price and shop are set in the Item studio. The item's colours c1..c3 are the
// design's colour slots, so "a new item from this" in the Item studio makes colour versions.
const DESIGN_SLOTS = ["hair", "hat", "glasses", "neck", "beard"];
itemAdmin.post("/design", async (req, res, next) => {
  try {
    const { slot } = req.body;
    if (!DESIGN_SLOTS.includes(slot)) return res.status(400).json({ error: "Pick where it is worn." });
    let recipe;
    try { recipe = cleanRecipe(req.body.recipe); } catch (e) { return res.status(400).json({ error: e.message }); }
    const d = req.body.data || {}, name = txt(d.name, 40), he = txt(d.he, 40);
    if (!name) return res.status(400).json({ error: "Give it an English name." });
    const look = { id: "recipe", recipe, ...recipe.colors, name, ...(he ? { he } : {}), ...(slot === "hat" && d.hideHair ? { hideHair: true } : {}) };
    if (req.body.i == null) {
      const used = await ItemDef.find({ slot, index: { $gte: CUSTOM_FROM } }, { index: 1 }).lean();
      const index = Math.max(CUSTOM_FROM - 1, ...used.map((u) => u.index)) + 1;
      if (index >= CUSTOM_FROM + CUSTOM_MAX) return res.status(409).json({ error: "This list is full." });
      const key = `${slot}:${index}`;
      await ItemDef.create({ key, slot, index, item: { ...look, price: 500, rarity: "rare", sale: "none" }, by: req.admin.username });
      await loadCustom();
      log(req, "item-design-new", `${key} "${name}" (${recipe.parts.length} shapes)`);
      return res.json({ ok: true, i: index });
    }
    const i = Math.trunc(+req.body.i), key = `${slot}:${i}`, row = await ItemDef.findOne({ key });
    if (!row || !row.item || !row.item.recipe) return res.status(404).json({ error: "That design isn't here any more." });
    const keep = { price: row.item.price, rarity: row.item.rarity, sale: row.item.sale };
    row.item = { ...look, ...keep }; row.by = req.admin.username; row.markModified("item"); await row.save();
    await loadCustom();
    log(req, "item-design", `${key} "${name}" (${recipe.parts.length} shapes)`);
    res.json({ ok: true, i });
  } catch (err) { next(err); }
});
