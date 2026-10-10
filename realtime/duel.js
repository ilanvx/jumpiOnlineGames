import crypto from "node:crypto";
import { ghosts } from "./blocks.js";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { DuelLog, logQuietly } from "../models/Logs.js";

/*
  1-on-1 games in the Plaza: Tic-Tac-Toe and Four in a Row.

  - Each player puts 100 coins in. The coins are taken from BOTH players in one
    database transaction when the game starts (or from neither).
  - The server keeps the board and checks every move; the page only says
    "I want to play here".
  - Winner gets 200 (their 100 back + the other 100). A draw gives both 100 back.
  - Leaving, closing the tab or running out of time (30 s a move) loses the game.
*/
export const ENTRY = 100;
const MOVE_MS = 30_000;
const INVITE_MS = 20_000;
const GAMES = {
  ttt: { name: "Tic-Tac-Toe", cols: 3, rows: 3, need: 3, gravity: false },
  c4: { name: "Four in a Row", cols: 7, rows: 6, need: 4, gravity: true },
};

export function attachDuels(io, socket, { players, limiter, notifyCoins, setStatus }) {
  const state = io.__duel || (io.__duel = { matches: new Map(), bySocket: new Map(), invites: new Map() });
  const { matches, bySocket, invites } = state;
  const busy = (sid) => bySocket.has(sid) || io.__trade?.bySocket.has(sid);
  const canAsk = limiter(5, 20_000);
  const canMove = limiter(30, 5_000);
  const sock = (id) => io.sockets.sockets.get(id);
  const fail = (msg) => socket.emit("duel:error", { message: msg });

  socket.on("duel:request", async (d) => {
    if (!canAsk()) return fail("Slow down a little before asking again.");
    const game = String(d?.game || "");
    if (!GAMES[game]) return fail("That game doesn't exist.");
    const from = players.get(socket.id), target = players.get(String(d?.to || ""));
    if (!from) return;
    if (!target || (from.role !== "admin" && target.role !== "admin" && ghosts(from.userId, target.userId))) return fail("That player isn't here any more.");
    if (target.userId === from.userId) return fail("You can't play against yourself.");
    if (target.role === "admin" && from.role !== "admin") return fail("Admins can't be asked to play.");
    if (busy(socket.id)) return fail("Finish what you're doing first.");
    if (busy(target.id)) return fail(`${target.username} is busy right now.`);
    const u = await User.findById(from.userId).select("coins");
    if (!u || u.coins < ENTRY) return fail(`You need ${ENTRY} coins to play.`);
    invites.set(`${socket.id}>${target.id}`, { at: Date.now(), game });
    sock(target.id)?.emit("duel:invite", { from: socket.id, username: from.username, game, entry: ENTRY });
    socket.emit("duel:asked", { username: target.username, game });
  });

  socket.on("duel:respond", async (d) => {
    const fromId = String(d?.from || ""), key = `${fromId}>${socket.id}`, inv = invites.get(key);
    invites.delete(key);
    const asker = players.get(fromId), meP = players.get(socket.id);
    if (!asker || !meP) return fail("That player isn't here any more.");
    if (!inv || Date.now() - inv.at > INVITE_MS) return fail("That invite has expired.");
    if (d?.accept !== true) return sock(fromId)?.emit("duel:declined", { username: meP.username });
    if (busy(socket.id) || busy(fromId)) return fail("One of you is busy right now.");
    // reserve both players before the database step so nothing else can start
    const m = {
      id: crypto.randomUUID(),
      game: inv.game,
      p: [
        { sid: fromId, userId: asker.userId, username: asker.username, look: asker.look },
        { sid: socket.id, userId: meP.userId, username: meP.username, look: meP.look },
      ],
      board: Array(GAMES[inv.game].cols * GAMES[inv.game].rows).fill(-1),
      turn: crypto.randomInt(2),
      over: false,
      timer: null,
    };
    bySocket.set(fromId, m.id);
    bySocket.set(socket.id, m.id);
    matches.set(m.id, m);
    try {
      await takeEntry(m);
    } catch (err) {
      release(m);
      const msg = err.publicMessage || "Couldn't start the game. Nobody paid anything.";
      if (!err.publicMessage) console.error("[duel]", err);
      for (const p of m.p) sock(p.sid)?.emit("duel:error", { message: msg });
      return;
    }
    startTurn(m);
    for (const p of m.p) setStatus(p.sid, "duel");
    for (let i = 0; i < 2; i++) sock(m.p[i].sid)?.emit("duel:start", view(m, i));
  });

  socket.on("duel:move", (d) => {
    if (!canMove()) return;
    const m = matches.get(bySocket.get(socket.id));
    if (!m || m.over) return;
    const me = m.p.findIndex((p) => p.sid === socket.id);
    if (me !== m.turn) return fail("It's not your turn.");
    const g = GAMES[m.game];
    let cell = -1;
    if (g.gravity) {
      const col = Number(d?.col);
      if (!Number.isInteger(col) || col < 0 || col >= g.cols) return;
      for (let r = g.rows - 1; r >= 0; r--) if (m.board[r * g.cols + col] < 0) { cell = r * g.cols + col; break; }
      if (cell < 0) return fail("That column is full.");
    } else {
      cell = Number(d?.cell);
      if (!Number.isInteger(cell) || cell < 0 || cell >= m.board.length || m.board[cell] >= 0) return fail("Pick an empty square.");
    }
    m.board[cell] = me;
    const line = winLine(m.board, g, cell, me);
    if (line) return finish(m, me, "win", line, cell);
    if (m.board.every((v) => v >= 0)) return finish(m, -1, "draw", null, cell);
    m.turn = 1 - me;
    startTurn(m);
    for (let i = 0; i < 2; i++) sock(m.p[i].sid)?.emit("duel:state", { ...view(m, i), last: cell });
  });

  const forfeit = (why) => () => {
    for (const k of invites.keys()) if (k.startsWith(socket.id + ">") || k.endsWith(">" + socket.id)) invites.delete(k);
    const m = matches.get(bySocket.get(socket.id));
    if (!m || m.over || !m.started) return;
    const me = m.p.findIndex((p) => p.sid === socket.id);
    finish(m, 1 - me, why);
  };
  socket.on("duel:quit", forfeit("quit"));
  socket.on("leave", forfeit("left"));
  socket.on("disconnect", forfeit("left"));

  /* ---------- helpers ---------- */
  function view(m, i) {
    return {
      id: m.id, game: m.game, you: i, opp: m.p[1 - i].sid, board: m.board, turn: m.turn, entry: ENTRY, pot: ENTRY * 2,
      players: m.p.map((p) => ({ username: p.username, look: p.look })), left: Math.max(0, (m.deadline || 0) - Date.now()),
    };
  }
  function startTurn(m) {
    m.started = true;
    clearTimeout(m.timer);
    m.deadline = Date.now() + MOVE_MS;
    m.timer = setTimeout(() => !m.over && finish(m, 1 - m.turn, "timeout"), MOVE_MS + 500);
  }
  function release(m) {
    clearTimeout(m.timer);
    matches.delete(m.id);
    for (const p of m.p) if (bySocket.get(p.sid) === m.id) { bySocket.delete(p.sid); setStatus(p.sid, null); }
  }
  async function finish(m, winner, reason, line = null, last = null) {
    if (m.over) return;
    m.over = true;
    release(m);
    // pay out: the whole pot to the winner, or each entry back on a draw
    const pay = winner < 0 ? [ENTRY, ENTRY] : [winner === 0 ? ENTRY * 2 : 0, winner === 1 ? ENTRY * 2 : 0];
    const totals = [null, null];
    for (let i = 0; i < 2; i++) {
      if (!pay[i]) continue;
      try {
        const u = await User.findByIdAndUpdate(m.p[i].userId, { $inc: { coins: pay[i] } }, { new: true });
        if (u) { totals[i] = u.coins; notifyCoins(u._id.toString(), u.coins); }
      } catch (err) {
        console.error("[duel] payout failed", m.p[i].username, pay[i], err);
      }
    }
    console.log(`[duel] ${GAMES[m.game].name}: ${m.p[0].username} vs ${m.p[1].username} -> ${winner < 0 ? "draw" : m.p[winner].username + " wins"} (${reason})`);
    // level XP: more for the winner; whoever quit or left gets none (routes/levels.js, loaded late: it imports plaza.js)
    import("../routes/levels.js").then(({ addLevelXp }) => import("../public/shared/levels.js").then(({ LEVEL_XP }) => {
      for (let i = 0; i < 2; i++) {
        const xp = winner === i ? LEVEL_XP.duelWin : reason === "quit" || reason === "left" ? 0 : LEVEL_XP.duel;
        if (xp) addLevelXp(m.p[i].userId, xp, { why: "duel" });
      }
    })).catch(() => {});
    import("../routes/quests.js").then(({ questEvent }) => { for (let i = 0; i < 2; i++) if (winner === i || (reason !== "quit" && reason !== "left")) questEvent(m.p[i].userId, "duel", 1); }).catch(() => {});
    logQuietly(DuelLog, { game: GAMES[m.game].name, winner: winner < 0 ? "" : m.p[winner].username, reason,
      players: m.p.map((p, i) => ({ userId: p.userId, username: p.username, paid: ENTRY, won: pay[i] })) });
    for (let i = 0; i < 2; i++)
      sock(m.p[i].sid)?.emit("duel:over", {
        ...view(m, i), winner, reason, line, last, won: pay[i], coins: totals[i],
        opponent: { id: m.p[1 - i].sid, username: m.p[1 - i].username },
      });
  }
  async function takeEntry(m) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const p of m.p) {
          const u = await User.findOneAndUpdate({ _id: p.userId, coins: { $gte: ENTRY } }, { $inc: { coins: -ENTRY } }, { new: true, session });
          if (!u) throw Object.assign(new Error("not enough"), { publicMessage: `${p.username} doesn't have ${ENTRY} coins.` });
          p.coinsAfter = u.coins;
        }
      });
    } finally {
      session.endSession();
    }
    for (const p of m.p) notifyCoins(p.userId, p.coinsAfter);
  }
}

// does the piece just placed at `cell` finish a line? returns the cells of the line
function winLine(board, g, cell, who) {
  const r0 = Math.floor(cell / g.cols), c0 = cell % g.cols;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [cell];
    for (const s of [1, -1]) {
      let r = r0 + dr * s, c = c0 + dc * s;
      while (r >= 0 && r < g.rows && c >= 0 && c < g.cols && board[r * g.cols + c] === who) {
        line.push(r * g.cols + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (line.length >= g.need) return line;
  }
  return null;
}
export const _test = { winLine, GAMES };
