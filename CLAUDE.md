# Jumpi Games: notes for Claude

## Design rules (from Ilan)
- **No small "label" chips or kicker tags above or near headings.** No pills like "NEW", "Coming soon", "What's inside", "Weekly poll", "For parents", "Log out" sitting on top of a title. They look AI-made. Use the heading alone, with plain text under it if needed.
- Keep the look of the game: chunky rounded buttons with a darker bottom edge, Lilita One headings, Fredoka body text, bright game colours, and panels styled like the in-game windows.
- Prefer real 3D (the Jumpi character from `/blobby.glb`, three.js) or in-game art over generic emoji/icon illustrations.
- Avoid generic "AI" layouts (rows of identical cards with emoji icons). Design something that feels like part of the game.

## Practical
- Website lives in `public/site/` and is the home page (`/`, plus `/terms`, `/privacy`, `/contact`); the game is `public/index.html` at `/play`. Old `/site/...` links redirect.
- Hebrew is switched off in the game for now (`LOCKED` in `public/shared/i18n.js`); the default language is English.
- Contact: support@jumpigames.com · Business: Jumpi Games, exempt dealer (עוסק פטור) 328170832 · no address on the site.
- Plaza shops you can walk into (E at the door): furniture, clothes, dance club, restaurant; plus the Pet Center at the end of the Park. They are "places" built in `VENUE_BUILD` (index.html) and rooms `place:<id>` on the server.
- Needs (hunger/energy/stamina/fun) are counted on the server (`realtime/needs.js`); a full refill costs 25 coins.
- Pets: kinds and prices in `public/shared/pets.js` (shared by page and server); routes in `routes/pets.js`.
- Never start CSS class names or ids with "ad-", "ads", "banner", "sponsor" etc.: ad blockers hide those elements (this hid half of the pet adoption window).
