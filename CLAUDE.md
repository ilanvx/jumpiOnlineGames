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
- Jumpi Store (real money): products in `public/shared/store.js` (shared), page `/store` (`public/site/store.html`, `store-page.js`, `store3d.js`), server `routes/store.js` + `models/Order.js`. HYP card payments are NOT connected yet (`payments/hyp.js`, `ready()` returns false). To try purchases before that, set `STORE_TEST=1` in .env: admins get a "pretend to pay" button. Memberships never renew (User.memberUntil). Store-only auras: aura 8 (Sakura Breeze) and 9 (Crown of Stars), `exclusive` in catalog.js. **The store is closed for now** (`STORE_OPEN = false` in `public/shared/store.js`): `/store` shows the "under renovation" page (`public/site/store-soon.html/.css/.js`, two builder Jumpis in 3D), the game hides the offers button and checkout is refused. Set it to `true` to open the store again.
- Clothes (hair, shirts, pants, glasses, hats, necklaces) and their colours are listed once in `public/shared/outfits.js` (used by the game and by `catalog.js`). The place in the list is the item number, so only add new items at the end of a list.
- Any address that does not exist shows `public/site/404.html` ("Oops! Jumpi got lost", 3D lost Jumpi on a floating island, `404.css`/`404.js`); the catch-all is `notFound` at the end of server.js (files and scripts get a short "Not found" text instead).
