/*
  Jumpi City (/city): what is built, what is being built, and the next follower goal.

  The city grows with the Jumpi Games TikTok follower count (routes/tiktok.js). Every goal in GOALS starts a building
  on the next empty plot: the workers arrive and a 24-hour timer runs, then it opens. WHAT each goal builds is a secret
  until it opens: the page only gets the goal's number, and a building under construction is sent without its id.
  Goals are passed in order, one building at a time (if the count jumps past two goals, the second starts when the
  first opens). A building that started never stops, even if followers go down.

  Saved in the database (Setting "city"): { built: [{ id, plot, at }], build: { id, plot, goal, start, end } | null }.
  The Luna Park was asked for by the followers before the city opened, so it is there from the start.
*/
import { Setting } from "../realtime/events.js";
import { cityFollowers } from "./tiktok.js";

export const BUILD_MS = 24 * 60 * 60 * 1000;
// the secret list: goal → building. The page knows how to draw each id (public/site/city3d.js BUILDINGS).
export const GOALS = [
  { at: 600, id: "mall" },
  { at: 1000, id: "stadium" },
  { at: 2000, id: "aquarium" },
  { at: 3500, id: "castle" },
  { at: 5000, id: "tower" },
];
const PLOTS = GOALS.length;   // one plot per goal, in this order (the page has the same number of plots)
const START = { built: [{ id: "lunapark", plot: -1, at: "2026-11-08T12:00:00.000Z" }], build: null };

let state = null;
async function load() {
  if (state) return state;
  try {
    const s = await Setting.findOne({ key: "city" }).lean();
    state = s && s.value ? { ...START, ...s.value } : structuredClone(START);
  } catch {
    state = structuredClone(START);
  }
  return state;
}
const save = () => Setting.updateOne({ key: "city" }, { $set: { value: state } }, { upsert: true }).catch(() => {});

// moves the city forward: finishes a build whose time is up, starts the next one if its goal is reached
async function step(followers) {
  await load();
  let changed = false;
  const now = Date.now();
  if (state.build && now >= state.build.end) {
    state.built.push({ id: state.build.id, plot: state.build.plot, at: new Date(state.build.end).toISOString() });
    state.build = null;
    changed = true;
  }
  const done = new Set(state.built.map((b) => b.id));
  const next = GOALS.find((g) => !done.has(g.id) && g.id !== state.build?.id);
  if (!state.build && next && Number.isFinite(followers) && followers >= next.at) {
    state.build = { id: next.id, plot: GOALS.indexOf(next), goal: next.at, start: now, end: now + BUILD_MS };
    changed = true;
  }
  if (changed) await save();
  return next;
}

export async function cityView() {
  const f = await cityFollowers();
  await step(f.followers);
  const done = new Set(state.built.map((b) => b.id));
  const next = GOALS.find((g) => !done.has(g.id) && g.id !== state.build?.id) || null;
  return {
    followers: f.followers, at: f.at, live: f.live,
    built: state.built,                                     // opened buildings (ids are public once open)
    build: state.build ? { plot: state.build.plot, goal: state.build.goal, start: state.build.start, end: state.build.end } : null,   // no id: a surprise
    next: next ? { goal: next.at, from: GOALS.indexOf(next) > 0 ? GOALS[GOALS.indexOf(next) - 1].at : 0 } : null,   // only the numbers (from = the goal before, for the bar)
    plots: PLOTS,
    now: Date.now(),
  };
}

export function startCity() {
  setInterval(() => { cityFollowers().then((f) => step(f.followers)).catch(() => {}); }, 60 * 1000).unref();
}
