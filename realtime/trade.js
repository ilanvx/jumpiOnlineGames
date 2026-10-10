import crypto from "node:crypto";
import { ghosts } from "./blocks.js";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { ITEMS, LOOK_SLOTS } from "../catalog.js";
import { pruneHome } from "../routes/home.js";
import { TradeLog, logQuietly } from "../models/Logs.js";

/*
  Trading items between two players in the Plaza.

  1. A asks B ("trade:request"); B accepts or declines ("trade:respond").
  2. Both put up to 6 items each on the table ("trade:set"). Changing the table
     takes away both players' "ready".
  3. When both press ready ("trade:ready") the server checks everything again
     in the database and swaps the items in ONE transaction: either all items
     move or nothing does.

  The page only ever sends item ids; ownership is always checked here.
*/
const MAX_ITEMS = 6;
const INVITE_MS = 20_000;

export function attachTrading(io, socket, { players, me, notifyLook, limiter, setStatus }) {
  const state = io.__trade || (io.__trade = { trades: new Map(), bySocket: new Map(), invites: new Map() });
  const { trades, bySocket, invites } = state;
  const canAsk = limiter(5, 20_000);
  const canAct = limiter(40, 10_000);
  const sock = (id) => io.sockets.sockets.get(id);
  const fail = (msg) => socket.emit("trade:error", { message: msg });

  function sideOf(t, sid) {
    return t.a.sid === sid ? ["a", "b"] : t.b.sid === sid ? ["b", "a"] : [null, null];
  }
  function sendState(t) {
    for (const [mine, theirs] of [["a", "b"], ["b", "a"]])
      sock(t[mine].sid)?.emit("trade:state", {
        id: t.id,
        mine: t[mine].items,
        theirs: t[theirs].items,
        readyMe: t[mine].ready,
        readyThem: t[theirs].ready,
        locked: !!t.locked,
      });
  }
  // say no and put the page back in sync with the real table
  function refuse(t, msg) {
    fail(msg);
    sendState(t);
  }
  function closeTrade(t, reason, by) {
    if (!trades.has(t.id)) return;
    trades.delete(t.id);
    for (const s of ["a", "b"]) {
      bySocket.delete(t[s].sid);
      setStatus(t[s].sid, null);
      sock(t[s].sid)?.emit("trade:closed", { id: t.id, reason, by });
    }
  }

  // ---------- asking ----------
  socket.on("trade:request", (to) => {
    if (!canAsk()) return fail("Slow down a little before asking again.");
    const from = players.get(socket.id), target = players.get(String(to || ""));
    if (!from) return;
    if (!target || (from.role !== "admin" && target.role !== "admin" && ghosts(from.userId, target.userId))) return fail("That player isn't here any more.");
    if (target.userId === from.userId) return fail("You can't trade with yourself.");
    // nobody can ask an admin; an admin may ask a player, but then nothing can be put on the table
    if (target.role === "admin" && from.role !== "admin") return fail("Admins can't be asked to trade.");
    if (bySocket.has(socket.id) || io.__duel?.bySocket.has(socket.id)) return fail("Finish what you're doing first.");
    if (bySocket.has(target.id) || io.__duel?.bySocket.has(target.id)) return fail(`${target.username} is busy right now.`);
    invites.set(`${socket.id}>${target.id}`, Date.now());
    sock(target.id)?.emit("trade:invite", { from: socket.id, username: from.username });
    socket.emit("trade:asked", { to: target.id, username: target.username });
  });

  socket.on("trade:respond", (d) => {
    if (!canAct()) return;
    const fromId = String(d?.from || ""), key = `${fromId}>${socket.id}`, at = invites.get(key);
    invites.delete(key);
    const asker = players.get(fromId), meP = players.get(socket.id);
    if (!asker || !meP) return fail("That player isn't here any more.");
    if (!at || Date.now() - at > INVITE_MS) return fail("That trade request has expired.");
    if (d?.accept !== true) return sock(fromId)?.emit("trade:declined", { username: meP.username });
    if (bySocket.has(socket.id) || bySocket.has(fromId) || io.__duel?.bySocket.has(socket.id) || io.__duel?.bySocket.has(fromId)) return fail("One of you is busy right now.");
    const t = {
      id: crypto.randomUUID(),
      a: { sid: fromId, userId: asker.userId, username: asker.username, items: [], ready: false },
      b: { sid: socket.id, userId: meP.userId, username: meP.username, items: [], ready: false },
      busy: false,
      locked: asker.role === "admin" || meP.role === "admin",   // a trade with an admin: no items on either side
    };
    trades.set(t.id, t);
    setStatus(t.a.sid, "trade");
    setStatus(t.b.sid, "trade");
    bySocket.set(t.a.sid, t.id);
    bySocket.set(t.b.sid, t.id);
    sock(t.a.sid)?.emit("trade:open", { id: t.id, locked: t.locked, partner: { id: t.b.sid, username: t.b.username, look: meP.look } });
    sock(t.b.sid)?.emit("trade:open", { id: t.id, locked: t.locked, partner: { id: t.a.sid, username: t.a.username, look: asker.look } });
    sendState(t);
  });

  // ---------- the table ----------
  socket.on("trade:set", async (d) => {
    if (!canAct()) return;
    const t = trades.get(bySocket.get(socket.id));
    if (!t || t.busy) return;
    const [mine, theirs] = sideOf(t, socket.id);
    const raw = Array.isArray(d?.items) ? d.items : [];
    // the same item may be offered more than once if the player has doubles
    const items = raw.map(String).filter((id) => ITEMS.has(id)).slice(0, MAX_ITEMS);
    if (t.locked && items.length) return refuse(t, "Items can't be traded with an admin.");
    try {
      const u = await User.findById(t[mine].userId);
      if (!u) return closeTrade(t, "gone");
      const problem = offerProblem(u, items, "You");
      if (problem) return refuse(t, problem);
      if (!trades.has(t.id) || t.busy) return;
      t[mine].items = items;
      t.a.ready = t.b.ready = false; // any change means both look again
      sendState(t);
    } catch (err) {
      console.error(err);
      fail("Something went wrong. Try again.");
    }
  });

  socket.on("trade:ready", async (on) => {
    if (!canAct()) return;
    const t = trades.get(bySocket.get(socket.id));
    if (!t || t.busy) return;
    const [mine] = sideOf(t, socket.id);
    if (on === true && !t.a.items.length && !t.b.items.length) return fail("Put at least one item on the table.");
    t[mine].ready = on === true;
    sendState(t);
    if (t.a.ready && t.b.ready) await execute(t);
  });

  socket.on("trade:cancel", () => {
    const t = trades.get(bySocket.get(socket.id));
    if (t && !t.busy) closeTrade(t, "cancelled", players.get(socket.id)?.username);
  });

  const leave = () => {
    for (const k of invites.keys()) if (k.startsWith(socket.id + ">") || k.endsWith(">" + socket.id)) invites.delete(k);
    const t = trades.get(bySocket.get(socket.id));
    if (t && !t.busy) closeTrade(t, "left", players.get(socket.id)?.username);
  };
  socket.on("leave", leave);
  socket.on("disconnect", leave);

  // ---------- the swap ----------
  async function execute(t) {
    t.busy = true;
    for (const s of ["a", "b"]) sock(t[s].sid)?.emit("trade:busy", { id: t.id });
    const session = await mongoose.startSession();
    let ua, ub;
    try {
      await session.withTransaction(async () => {
        [ua, ub] = await Promise.all([User.findById(t.a.userId).session(session), User.findById(t.b.userId).session(session)]);
        if (!ua || !ub) throw publicError("One of the players is gone.");
        if (ua.isBanned() || ub.isBanned()) throw publicError("This trade can't happen.");
        check(ua, ub, t.a.items, t.a.username);
        check(ub, ua, t.b.items, t.b.username);
        move(ua, ub, t.a.items);
        move(ub, ua, t.b.items);
        await ua.save({ session });
        await ub.save({ session });
      });
    } catch (err) {
      session.endSession();
      t.busy = false;
      t.a.ready = t.b.ready = false;
      if (!err.publicMessage) console.error("[trade]", err);
      const msg = err.publicMessage || (/transaction|replica/i.test(err.message) ? "Trading needs a MongoDB Atlas database." : "The trade didn't go through. Nothing was changed.");
      for (const s of ["a", "b"]) sock(t[s].sid)?.emit("trade:error", { message: msg });
      return sendState(t);
    }
    session.endSession();
    console.log(`[trade] ${t.a.username} <-> ${t.b.username}: [${t.a.items}] for [${t.b.items}]`);
    logQuietly(TradeLog, { a: { userId: t.a.userId, username: t.a.username, items: t.a.items }, b: { userId: t.b.userId, username: t.b.username, items: t.b.items } });
    trades.delete(t.id);
    for (const [s, user, got, gave] of [["a", ua, t.b.items, t.a.items], ["b", ub, t.a.items, t.b.items]]) {
      bySocket.delete(t[s].sid);
      setStatus(t[s].sid, null);
      sock(t[s].sid)?.emit("trade:done", { id: t.id, user: user.toPublic(), got, gave });
    }
    notifyLook(ua._id.toString(), ua.publicLook());
    notifyLook(ub._id.toString(), ub.publicLook());
  }
}

function publicError(msg) {
  return Object.assign(new Error(msg), { publicMessage: msg });
}
// why this offer can't be made, or null. Counts doubles, and keeps at least one body colour and one pair of eyes.
function offerProblem(user, items, who) {
  const counts = user.itemCounts(), want = new Map();
  for (const id of items) want.set(id, (want.get(id) || 0) + 1);
  for (const [id, n] of want) {
    if (ITEMS.get(id)?.gift) return `${ITEMS.get(id).name} is a special item, it can't be traded.`;
    if (ITEMS.get(id)?.member) return `${ITEMS.get(id).name} is a Members Club item, it can't be traded.`;
    const have = counts.get(id) || 0;
    if (have < n) return have ? `${who === "You" ? "You only have" : who + " only has"} ${have} × ${ITEMS.get(id)?.name || "that item"}.` : `${who === "You" ? "You don't" : who + " doesn't"} have ${ITEMS.get(id)?.name || "that item"}.`;
  }
  for (const slot of ["color", "eyes"]) {
    let total = 0, giving = 0;
    for (const [id, n] of counts) if (id.startsWith(slot + ":")) total += n;
    for (const [id, n] of want) if (id.startsWith(slot + ":")) giving += n;
    if (giving && total - giving < 1) return slot === "color" ? "Keep at least one body colour for yourself." : "Keep at least one pair of eyes for yourself.";
  }
  return null;
}
function check(from, to, items, fromName) {
  const problem = offerProblem(from, items, fromName);
  if (problem) throw publicError(problem);
}
// take one copy of each offered item from one player and give it to the other.
// Something being worn comes off only if no other copy is left; colour and eyes switch to another one they own.
function move(from, to, items) {
  from.normalizeInventory();
  to.normalizeInventory();
  const inv = [...from.inventory];
  for (const id of items) {
    const at = inv.indexOf(id);
    if (at >= 0) inv.splice(at, 1);
  }
  from.inventory = inv;
  const look = from.look || {};
  for (const slot of Object.keys(LOOK_SLOTS)) {
    const worn = look[slot];
    if (!Number.isInteger(worn) || worn < 0 || inv.includes(`${slot}:${worn}`)) continue;
    if (LOOK_SLOTS[slot].optional) look[slot] = -1;
    else {
      const other = inv.find((id) => id.startsWith(slot + ":"));
      look[slot] = other ? Number(other.split(":")[1]) : 0;
    }
  }
  from.markModified("look");
  to.inventory = [...to.inventory, ...items];
  pruneHome(from); // furniture that was given away leaves the room
}
