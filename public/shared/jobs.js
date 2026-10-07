/*
  Jobs (used by the game and the server): Waiter at the restaurant, Police Officer on the Plaza.
  You get hired once, then work shifts. Every task done (an order served, a case solved) gives XP;
  higher levels pay more per task. The police job is kid-friendly: no weapons, nobody gets hurt —
  you catch cheeky pickpockets by tagging them and help lost little Jumpis find their parents.
*/
import { OUTFITS } from "./outfits.js";
export const SHIFT_SECONDS = 150;           // one shift
export const MIN_SECONDS_PER_ORDER = 6;     // nobody can serve faster than this (checked by the server; per job: minSecs)
export const JOB_DAILY_CAP = 800;           // most coins jobs can pay in one day (members: twice as much)
export const JOBS = {
  waiter: {
    id: "waiter",
    name: "Waiter",
    place: "Jumpi Restaurant",
    about: "Take orders from hungry customers, pick up the food from the kitchen and bring it to the right table. Fast service = tips!",
    titles: ["Trainee", "Junior Waiter", "Waiter", "Skilled Waiter", "Senior Waiter", "Star Waiter", "Head Waiter", "Floor Manager", "Restaurant Manager", "Legendary Waiter"],
    // total orders served needed for each level (level 1 starts at 0)
    xp: [0, 8, 20, 36, 56, 80, 110, 145, 185, 230],
    payMul: 1, minSecs: 6, unit: "order", units: "orders", done: "orders served",
  },
  police: {
    id: "police",
    name: "Police Officer",
    place: "Jumpi Police · The Plaza",
    about: "Put on your police uniform and patrol the Plaza! Catch cheeky pickpockets by tagging them so they give back what they took, and help lost little Jumpis find their mom or dad. Quick help = tips!",
    titles: ["Cadet", "Patrol Officer", "Officer", "Senior Officer", "Sergeant", "Detective", "Lieutenant", "Captain", "Police Chief", "Legendary Chief"],
    xp: [0, 5, 13, 24, 38, 55, 76, 100, 128, 160],
    payMul: 1.6, minSecs: 9, unit: "case", units: "cases", done: "cases solved",
  },
};
export const JOB_LIST = Object.values(JOBS);
// each job's uniform: real clothes (outfits.js, gift: job). Worn during the shift, and all of them are a gift at the top level.
const giftIndex = (slot, job) => OUTFITS[slot].findIndex((o) => o.gift === job);
export const JOB_LOOK = {};
export const JOB_GIFTS = {};
for (const job of Object.keys(JOBS)) {
  const look = { glasses: -1, neck: -1, hat: -1 }, gifts = [];
  for (const slot of ["shirt", "pants", "hat", "neck"]) { const i = giftIndex(slot, job); if (i >= 0) { look[slot] = i; gifts.push(`${slot}:${i}`); } }
  JOB_LOOK[job] = look;
  JOB_GIFTS[job] = gifts;
}
export function jobLevel(job, xp) {
  const J = JOBS[job];
  let lv = 1;
  for (let i = 1; i < J.xp.length; i++) if (xp >= J.xp[i]) lv = i + 1;
  return lv;
}
export const maxLevel = (job) => JOBS[job].xp.length;
// coins for one task at this level (job: which job; the waiter is the base), and the tip for a fast one
export const payPerOrder = (level, job = "waiter") => Math.round((8 + (level - 1) * 3) * (JOBS[job]?.payMul || 1));
export const tipFor = (level, job = "waiter") => Math.round(payPerOrder(level, job) / 2);
export function jobView(job, rec) {
  const J = JOBS[job], xp = rec?.xp || 0, level = jobLevel(job, xp), top = level >= J.xp.length;
  return {
    id: job, hired: !!rec?.hired, xp, level, title: J.titles[level - 1],
    from: J.xp[level - 1], to: top ? null : J.xp[level], pay: payPerOrder(level, job), tip: tipFor(level, job),
    nextPay: top ? null : payPerOrder(level + 1, job), shifts: rec?.shifts || 0, served: rec?.served || 0, earned: rec?.earned || 0,
  };
}
