/*
  Grand opening. Until LAUNCH_AT, the game on the real domain (LAUNCH_HOSTS) shows the "almost here" page
  (public/site/game-soon.html) instead of the game. localhost and other hosts are never blocked, and admins who
  are already logged in can still play. After LAUNCH_AT everything opens by itself (no deploy needed).

  No date yet: LAUNCH_AT = Infinity keeps the doors closed and the page says "Coming soon!" with no countdown.
  To set a date again, e.g.: export const LAUNCH_AT = Date.parse("2026-11-01T17:00:00+02:00");
*/
export const LAUNCH_AT = Number.POSITIVE_INFINITY;   // the 11.10.2026 opening was called off; the new date isn't set yet
export const LAUNCH_HOSTS = ["jumpigames.com", "www.jumpigames.com"];
