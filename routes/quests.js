import express from "express";
import { User } from "../models/User.js";
import { requireJson } from "./auth.js";
import { requireUser } from "./shop.js";
import { notifyCoins, notifyUser, worldPos } from "../realtime/plaza.js";
import { addLevelXp } from "./levels.js";
import { levelOf } from "../public/shared/levels.js";
import { OUTFITS } from "../public/shared/outfits.js";
import { QUESTS, QUEST_BY_ID, RESIDENT_BY_ID, NPC_REACH, PICK_REACH, turnInOf } from "../public/shared/quests.js";

/*
  Quests from the people of Jumpi (public/shared/quests.js). The server keeps each player's progress in
  User.quests = { done: [ids], active: { <id>: { step, n, got: [spot indexes], snap } } } and checks every step:
  talking / visiting / picking up needs the player to really stand there (the position the game sends),
  quiz answers are checked here, buying / adopting / membership / level are read from the account,
  playing is counted by questEvent() from routes/rewards.js, routes/jobs.js and realtime/duel.js.
  The prize is paid once (the quest moves to done in the same update).
*/
const router = express.Router();
const SLACK = 2.5;   // a little extra room on distance checks (positions arrive a few times a second)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (res, code, error) => res.status(code).json({ error });
const countSlot = (u, slot) => (u.inventory || []).filter((id) => String(id).startsWith(slot + ":")).length;
const near = (pos, at, r) => !!pos && Math.hypot(pos.x - at[0], pos.z - at[1]) <= r + SLACK;
const isMember = (u) => u.subscriber === true || (!!u.memberUntil && new Date(u.memberUntil).getTime() > Date.now());

function stateOf(u) {
  const s = u.quests && typeof u.quests === "object" ? u.quests : {};
  return { done: Array.isArray(s.done) ? s.done.filter((id) => has(QUEST_BY_ID, id)) : [], active: s.active && typeof s.active === "object" ? { ...s.active } : {} };
}
// a step just became the current one: remember what to compare with
function startStep(u, q, a) {
  const st = q.steps[a.step];
  a.n = 0; a.got = [];
  if (!st) return;
  if (st.type === "buy") a.snap = countSlot(u, st.slot);
  else if (st.type === "adopt") a.snap = (u.pets || []).length;
}
// steps that finish by themselves (bought / adopted / member / level): move on while they're done
function autoSteps(u, q, a) {
  let moved = false;
  for (let guard = 0; guard < 10 && a.step < q.steps.length; guard++) {
    const st = q.steps[a.step];
    const ok = st.type === "buy" ? countSlot(u, st.slot) > (a.snap ?? Infinity)
      : st.type === "adopt" ? (u.pets || []).length > (a.snap ?? Infinity)
      : st.type === "member" ? isMember(u)
      : st.type === "level" ? (u.role === "admin" || levelOf(u.levelXp || 0) >= st.n)
      : false;
    if (!ok) break;
    a.step++; startStep(u, q, a); moved = true;
  }
  return moved;
}
function statusOf(S, q) {
  if (S.done.includes(q.id)) return "done";
  if (S.active[q.id]) return S.active[q.id].step >= q.steps.length ? "ready" : "active";
  return (q.needs || []).every((id) => S.done.includes(id)) ? "available" : "locked";
}
function view(u, S) {
  const status = {};
  for (const q of QUESTS) status[q.id] = statusOf(S, q);
  const active = {};
  for (const [id, a] of Object.entries(S.active)) active[id] = { step: a.step, n: a.n || 0, got: a.got || [] };
  return { done: S.done, active, status };
}
// load → change → save, safe when two requests come together (retries on a clash)
async function mutate(userId, fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const u = await User.findById(userId).lean();
    if (!u) return { error: [401, "Please log in first."] };
    const S = stateOf(u);
    const out = await fn(u, S);
    if (out && out.error) return out;
    if (!out || !out.save) return { u, S, ...(out || {}) };
    const r = await User.updateOne({ _id: u._id, __v: u.__v }, { $set: { quests: { done: S.done, active: S.active }, ...(out.set || {}) }, $inc: { __v: 1, ...(out.inc || {}) }, ...(out.push ? { $push: out.push } : {}) });
    if (r.modifiedCount) return { u, S, ...out };
  }
  return { error: [409, "Something got in the way. Try again."] };
}

router.get("/quests", requireUser, async (req, res, next) => {
  try {
    const r = await mutate(req.user._id, (u, S) => {
      let save = false;
      for (const [id, a] of Object.entries(S.active)) { const q = QUEST_BY_ID[id]; if (!q) { delete S.active[id]; save = true; continue; } if (autoSteps(u, q, a)) save = true; }
      return { save };
    });
    if (r.error) return fail(res, ...r.error);
    res.json(view(r.u, r.S));
  } catch (err) { next(err); }
});

// take a quest from the resident who gives it (you have to be next to them)
router.post("/quests/accept", requireJson, requireUser, async (req, res, next) => {
  try {
    const id = String(req.body.id || ""), q = has(QUEST_BY_ID, id) ? QUEST_BY_ID[id] : null;
    if (!q) return fail(res, 404, "That quest doesn't exist.");
    const pos = worldPos(String(req.user._id));
    if (!near(pos, RESIDENT_BY_ID[q.giver].at, NPC_REACH)) return fail(res, 400, `Go and talk to ${RESIDENT_BY_ID[q.giver].name} first.`);
    const r = await mutate(req.user._id, (u, S) => {
      const st = statusOf(S, q);
      if (st !== "available") return { error: [409, st === "locked" ? "You can't take this quest yet." : st === "done" ? "You already finished this quest." : "You already have this quest."] };
      const a = { step: 0 }; startStep(u, q, a); S.active[q.id] = a; autoSteps(u, q, a);
      return { save: true };
    });
    if (r.error) return fail(res, ...r.error);
    res.json(view(r.u, r.S));
  } catch (err) { next(err); }
});

// do the current step: talk / visit / pick up / answer the quiz
router.post("/quests/step", requireJson, requireUser, async (req, res, next) => {
  try {
    const id = String(req.body.id || ""), q = has(QUEST_BY_ID, id) ? QUEST_BY_ID[id] : null;
    if (!q) return fail(res, 404, "That quest doesn't exist.");
    const pos = worldPos(String(req.user._id));
    let wrong = null;
    const r = await mutate(req.user._id, (u, S) => {
      const a = S.active[q.id];
      if (!a || a.step >= q.steps.length) return { error: [409, "That step is already done."] };
      const st = q.steps[a.step];
      if (st.type === "talk") {
        if (!near(pos, RESIDENT_BY_ID[st.npc].at, NPC_REACH)) return { error: [400, `Go and talk to ${RESIDENT_BY_ID[st.npc].name}.`] };
      } else if (st.type === "visit") {
        if (!near(pos, st.at, st.r)) return { error: [400, `You're not at ${st.place} yet.`] };
      } else if (st.type === "collect") {
        const i = Number(req.body.spot);
        if (!Number.isInteger(i) || i < 0 || i >= st.spots.length) return { error: [400, "There's nothing there."] };
        if ((a.got || []).includes(i)) return { error: [409, "You already picked that up."] };
        if (!near(pos, st.spots[i], PICK_REACH)) return { error: [400, "Walk closer to pick it up."] };
        a.got = [...(a.got || []), i];
        if (a.got.length < st.spots.length) return { save: true };
      } else if (st.type === "quiz") {
        const ans = Array.isArray(req.body.answers) ? req.body.answers.map(Number) : [];
        wrong = st.questions.map((x, k) => (ans[k] === x.a ? -1 : k)).filter((k) => k >= 0);
        if (wrong.length) return { save: false };
      } else return { error: [400, "This step finishes by itself."] };
      a.step++; startStep(u, q, a); autoSteps(u, q, a);
      return { save: true };
    });
    if (r.error) return fail(res, ...r.error);
    if (wrong && wrong.length) return res.status(400).json({ error: wrong.length === 1 ? "One answer isn't right. Try again!" : `${wrong.length} answers aren't right. Try again!`, wrong, ...view(r.u, r.S) });
    res.json(view(r.u, r.S));
  } catch (err) { next(err); }
});

// collect the prize from the resident who pays out
router.post("/quests/claim", requireJson, requireUser, async (req, res, next) => {
  try {
    const id = String(req.body.id || ""), q = has(QUEST_BY_ID, id) ? QUEST_BY_ID[id] : null;
    if (!q) return fail(res, 404, "That quest doesn't exist.");
    const who = RESIDENT_BY_ID[turnInOf(q)];
    if (!near(worldPos(String(req.user._id)), who.at, NPC_REACH)) return fail(res, 400, `Go to ${who.name} to get your prize.`);
    let coins = q.reward.coins || 0, item = null;
    const r = await mutate(req.user._id, (u, S) => {
      const a = S.active[q.id];
      if (!a) return { error: [409, S.done.includes(q.id) ? "You already got this prize." : "You don't have this quest."] };
      autoSteps(u, q, a);
      if (a.step < q.steps.length) return { error: [409, "This quest isn't finished yet."] };
      delete S.active[q.id];
      S.done = [...S.done, q.id];
      coins = q.reward.coins || 0; item = null;
      const push = {};
      if (q.reward.item) {
        const [slot, i] = q.reward.item.split(":"), def = OUTFITS[slot] && OUTFITS[slot][+i];
        if ((u.inventory || []).includes(q.reward.item)) coins += def ? def.price || 0 : 0;   // already have it: its price in coins instead
        else { item = q.reward.item; push.inventory = item; }
      }
      return { save: true, inc: { coins }, push: item ? push : null };
    });
    if (r.error) return fail(res, ...r.error);
    const uid = String(req.user._id);
    const fresh = await User.findById(uid).select("coins");
    if (fresh) notifyCoins(uid, fresh.coins);
    const lv = q.reward.xp ? await addLevelXp(uid, q.reward.xp, { capped: false, why: "quest" }) : null;
    res.json({ ...view(r.u, r.S), prize: { coins, xp: q.reward.xp || 0, item }, total: fresh ? fresh.coins : null, level: lv });
  } catch (err) { next(err); }
});

// something countable happened (a mini-game round, job orders, a board game): count it for "play" steps. Never throws.
export async function questEvent(userId, kind, n = 1) {
  try {
    const r = await mutate(userId, (u, S) => {
      let save = false;
      for (const [id, a] of Object.entries(S.active)) {
        const q = QUEST_BY_ID[id], st = q && q.steps[a.step];
        if (!st || st.type !== "play" || st.kind !== kind) continue;
        a.n = (a.n || 0) + n; save = true;
        if (a.n >= st.n) { a.step++; startStep(u, q, a); autoSteps(u, q, a); }
      }
      return { save };
    });
    if (r && r.save) notifyUser(String(userId), "quests:changed", {});
  } catch (err) {
    console.error("quest event", err.message);
  }
}

export default router;
