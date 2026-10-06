/*
  The weekly poll on the website. A new question every week (Sunday, Israel time), going round this list.
  To run a special poll on a certain week, put it in SPECIAL with the week key, e.g. "2026-W42".
*/
export const POLLS = [
  { question: "Which pet should come to Jumpi first?", options: [["Puppy", "🐶"], ["Kitten", "🐱"], ["Bunny", "🐰"], ["Baby dragon", "🐲"]] },
  { question: "Where should the next Jumpi zone be?", options: [["Snowy mountain", "🏔️"], ["Candy land", "🍭"], ["Under the sea", "🐠"], ["Outer space", "🚀"]] },
  { question: "Which new mini-game do you want?", options: [["Kart racing", "🏎️"], ["Hide and seek", "🙈"], ["Dance battle", "💃"], ["Fishing", "🎣"]] },
  { question: "What should we add to homes next?", options: [["A garden", "🌻"], ["A second floor", "🪜"], ["A pool", "🏊"], ["A pet bed", "🛏️"]] },
  { question: "Pick the next legendary aura!", options: [["Ocean waves", "🌊"], ["Cherry blossoms", "🌸"], ["Pixel glitch", "👾"], ["Music notes", "🎵"]] },
];
export const SPECIAL = {};

// ISO week key in Israel time, plus when this week's poll ends
export function weekInfo(date = new Date()) {
  const il = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const offset = il.getTime() - date.getTime();
  // weeks start on Sunday in Israel
  const day = il.getDay();
  const start = new Date(il.getFullYear(), il.getMonth(), il.getDate() - day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const jan1 = new Date(start.getFullYear(), 0, 1);
  const n = Math.floor((start - jan1) / 864e5 / 7) + 1;
  // index 0 = the week the website opened (Oct 4, 2026), so the pets poll goes first
  const index = Math.round((start.getTime() - new Date(2026, 9, 4).getTime()) / (7 * 864e5));
  return { key: `${start.getFullYear()}-W${String(n).padStart(2, "0")}`, index, endsAt: Math.floor((end.getTime() - offset) / 60000) * 60000 };
}

export function pollFor(info = weekInfo()) {
  return SPECIAL[info.key] || POLLS[((info.index % POLLS.length) + POLLS.length) % POLLS.length];
}
