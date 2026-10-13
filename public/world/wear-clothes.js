/*
  The autumn 2026 wardrobe: how the new shirts and pants look (items listed in public/shared/items/clothes.js).
  Used by public/index.html: shirtTex / sleeveTex / pantsTex call these painters by item id, and the shirt / pants
  builders add any 3D extras returned by shirt3D / pants3D. H = WEAR_H() in index.html (the shared helpers).
  Canvas layout: shirts span the whole way round (front centre at u = .25, back centre at u = .75), 1024 x 256;
  sleeves 256 x 128; pants 512 x 256 (waistband = top 30 px, painted afterwards).
*/
export const SHIRT_PRINTS = {};    // id -> (ctx, w, h, item, H)
export const SLEEVE_PRINTS = {};   // id -> (ctx, w, h, item, H)
export const PANTS_PRINTS = {};    // id -> (ctx, w, h, item, H)
// extra 3D parts for a shirt (collar, hood, fur trim...): return an Object3D, an array of them, or null.
// Parts are added to the body; set userData.arm = "L" / "R" to hang one on an arm instead.
export function shirt3D(item, H) { return null; }
// extra 3D parts for pants (skirts, straps...): mat = the pants' own cloth material
export function pants3D(item, mat, H) { return null; }
