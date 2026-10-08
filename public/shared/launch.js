/*
  Grand opening. Until LAUNCH_AT, the game on the real domain (LAUNCH_HOSTS) shows the "almost here" page with a
  countdown (public/site/game-soon.html) instead of the game. localhost and other hosts are never blocked, and
  admins who are already logged in can still play. After LAUNCH_AT everything opens by itself (no deploy needed).
*/
export const LAUNCH_AT = Date.parse("2026-10-11T17:00:00+03:00");   // Sunday 11 October 2026, 17:00 Israel time
export const LAUNCH_HOSTS = ["jumpigames.com", "www.jumpigames.com"];
