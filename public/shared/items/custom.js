/*
  Items made in the admin panel (Admin → Item studio), and position fixes for any item.
  This file on disk is empty on purpose: the server sends the real one from the database (routes/items.js),
  and the server itself applies the same data on start (applyCustom in outfits.js). Don't write items here.
*/
export const CUSTOM = { rev: 0, fixes: {}, items: {} };
