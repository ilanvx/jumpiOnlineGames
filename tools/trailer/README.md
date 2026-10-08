# Making the trailer video again

The trailer is played by the game itself: `/play?trailer` (live, in a loop) or `/play?trailer&render`
(the normal loop stops and `window.__trailer.frame(t)` draws exactly the moment `t`). The film is the
`TRAILER` block in `public/index.html` (`SHOTS`, one entry per part, `trailerFrame`).

1. Soundtrack (original, made from scratch): `python3 trailer_score.py score.wav` (needs numpy + scipy; `engine.py` is the little synth).
2. Frames: `node render_trl.cjs 0 1215 frames` and `node render_trl.cjs 1215 2430 frames` (30 fps, 1280x720, Playwright + Chromium;
   `game.cjs` serves `public/` as http://jumpi.local and fakes the server; fonts come from a local copy of Lilita One / Fredoka).
3. Video: `ffmpeg -framerate 30 -i frames/%05d.jpg -i score.wav -c:v libx264 -preset slow -crf 21 -maxrate 2.6M -bufsize 5M -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart jumpi-trailer.mp4`
4. Put `jumpi-trailer.mp4` and `poster.jpg` in `public/site/trailer/`; the page is `/trailer` (`public/site/trailer.html`).
