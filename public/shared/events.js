/*
  Holiday events (shared by the game and the server). An admin switches one on in the admin panel
  (/admin → Events); the server keeps it (models/Setting.js, realtime/events.js) and tells every game.
  While an event is on:
    - the game decorates the world for it (EVENT block in public/index.html)
    - its shop is open (the items with event: "<id>" in outfits.js / catalog.js) and the server sells them
  When it is switched off the decorations and the shop go away and the server refuses to sell its items.
  Items people already bought stay theirs (they can wear and trade them all year).
  To add a new event: add it here, give its items `event: "<id>"` and add its decorations in index.html.
*/
export const EVENTS = {
  halloween: {
    id: "halloween",
    name: "Halloween",
    shop: "SPOOKY SHOP",
    about: "Pumpkins, bats and ghosts all over Jumpi, a spooky sky and the Spooky Shop in the Plaza.",
    colors: ["#ff8a1c", "#7b3fe4", "#1d1033"],
    hello: "Happy Halloween! The Spooky Shop is open in the Plaza 🎃",
  },
};
export const EVENT_IDS = Object.keys(EVENTS);
export const isEvent = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(EVENTS, id);
