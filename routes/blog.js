import express from "express";
import mongoose from "mongoose";
import { BlogPost, BlogImage, BlogComment } from "../models/Blog.js";
import { requireJson, currentUser } from "./auth.js";
import { requireUser } from "./shop.js";
import { clubAge } from "./club.js";
import { emitToAdmins, strike } from "../realtime/plaza.js";
import { checkText, FRIENDLY_MESSAGE, PRIVATE_MESSAGE } from "../public/shared/profanity.js";
import { cleanDoc, docText, textDoc } from "../public/shared/blogdoc.js";

/*
  Jumpi Club blog.
  - Everyone can read the posts (and the approved comments), even without logging in.
  - Only admins write, change or delete posts; every post has a picture (uploaded first: POST /api/blog/img).
  - Logged-in players aged 6+ (the Club's age) can comment. A comment waits until an admin approves it; until then only
    its writer sees it ("waiting for approval"). Admins get a notice: in the Club (the bell) and in their game window.
  - Comments go through the same word filter as the chat (no bad words, no phone numbers or addresses).
*/
const router = express.Router();
const S = (v) => String(v);
const isAdmin = (u) => !!u && u.role === "admin";
const okId = (v) => mongoose.isValidObjectId(String(v || ""));
const clean = (t, max) => String(t ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const one = (t, max) => clean(t, max).replace(/\s+/g, " ");
async function requireAdmin(req, res, next) {
  try { const u = await currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: "Only admins can do that." }); req.user = u; next(); }
  catch (err) { next(err); }
}
const postView = (p, n = {}) => ({ id: S(p._id), title: p.title, body: p.body, doc: p.doc || textDoc(p.body), excerpt: p.body.replace(/\s+/g, " ").slice(0, 180), image: p.image ? `/api/blog/img/${S(p.image)}` : null,
  author: p.authorName || "Jumpi", at: p.at.getTime(), updatedAt: p.updatedAt ? p.updatedAt.getTime() : null, comments: n[S(p._id)] || 0 });
const commentView = (c, mine = false) => ({ id: S(c._id), username: c.username, text: c.text, at: c.at.getTime(), status: c.status, mine });

/* ---------- reading ---------- */
router.get("/blog", async (req, res, next) => {
  try {
    const posts = await BlogPost.find().sort({ at: -1 }).limit(60).lean();
    const counts = await BlogComment.aggregate([{ $match: { post: { $in: posts.map((p) => p._id) }, status: "approved" } }, { $group: { _id: "$post", n: { $sum: 1 } } }]);
    const n = Object.fromEntries(counts.map((c) => [S(c._id), c.n]));
    res.set("Cache-Control", "no-store");
    res.json({ posts: posts.map((p) => postView(p, n)) });
  } catch (err) { next(err); }
});
router.get("/blog/post/:id", async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).json({ error: "There's no such post." });
    const p = await BlogPost.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: "There's no such post." });
    const me = await currentUser(req).catch(() => null);
    const list = await BlogComment.find({ post: p._id, $or: [{ status: "approved" }, ...(me ? [{ user: me._id, status: "pending" }] : [])] }).sort({ at: 1 }).limit(500).lean();
    res.set("Cache-Control", "no-store");
    res.json({ post: postView(p, { [S(p._id)]: list.filter((c) => c.status === "approved").length }), comments: list.map((c) => commentView(c, !!me && S(c.user) === S(me._id))) });
  } catch (err) { next(err); }
});
router.get("/blog/img/:id", async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).end();
    const im = await BlogImage.findById(req.params.id).lean();
    if (!im) return res.status(404).end();
    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.type(im.type).send(Buffer.from(im.data.buffer || im.data));
  } catch (err) { next(err); }
});

/* ---------- writing (admins) ---------- */
// the picture: a real PNG / JPEG / WebP, up to 3 MB (the Club makes it smaller before sending)
const kindOf = (b) => b.length > 12 && (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG" ? "image/png" : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg"
  : b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" ? "image/webp" : "");
router.post("/blog/img", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "3mb" }), requireAdmin, async (req, res, next) => {
  try {
    const b = req.body, type = Buffer.isBuffer(b) ? kindOf(b) : "";
    if (!type) return res.status(400).json({ error: "Choose a PNG, JPG or WebP picture." });
    const im = await BlogImage.create({ type, data: b, by: req.user._id });
    res.json({ id: S(im._id), url: `/api/blog/img/${S(im._id)}` });
  } catch (err) { next(err); }
});
async function readPost(req, res) {
  // the post: its formatted text (doc, checked piece by piece) or plain text
  const doc = req.body.doc ? cleanDoc(req.body.doc) : textDoc(clean(req.body.body, 20000));
  const title = one(req.body.title, 120), body = doc ? docText(doc).slice(0, 25000) : "", image = String(req.body.image || "");
  if (!title) { res.status(400).json({ error: "Give the post a title." }); return null; }
  if (!doc || !doc.blocks.length) { res.status(400).json({ error: "Write something in the post." }); return null; }
  if (!okId(image) || !(await BlogImage.exists({ _id: image }))) { res.status(400).json({ error: "Every post needs a picture." }); return null; }
  return { title, body: body || "…", doc, image };
}
router.post("/blog", requireJson, requireAdmin, async (req, res, next) => {
  try {
    const v = await readPost(req, res); if (!v) return;
    const p = await BlogPost.create({ ...v, author: req.user._id, authorName: req.user.username });
    res.json({ post: postView(p.toObject()) });
  } catch (err) { next(err); }
});
router.post("/blog/post/:id", requireJson, requireAdmin, async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).json({ error: "There's no such post." });
    const v = await readPost(req, res); if (!v) return;
    const p = await BlogPost.findByIdAndUpdate(req.params.id, { $set: { ...v, updatedAt: new Date() } }, { new: true }).lean();
    if (!p) return res.status(404).json({ error: "There's no such post." });
    res.json({ post: postView(p) });
  } catch (err) { next(err); }
});
router.post("/blog/post/:id/delete", requireJson, requireAdmin, async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).json({ error: "There's no such post." });
    const p = await BlogPost.findByIdAndDelete(req.params.id).lean();
    if (!p) return res.status(404).json({ error: "There's no such post." });
    await BlogComment.deleteMany({ post: p._id });
    if (p.image && !(await BlogPost.exists({ image: p.image }))) await BlogImage.deleteOne({ _id: p.image });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* ---------- comments ---------- */
const recent = new Map();   // userId -> times (a few comments per 10 minutes)
router.post("/blog/post/:id/comment", requireJson, requireUser, clubAge, async (req, res, next) => {
  try {
    const me = req.user;
    if (!okId(req.params.id) || !(await BlogPost.exists({ _id: req.params.id }))) return res.status(404).json({ error: "There's no such post." });
    if (me.mutedUntil && me.mutedUntil.getTime() > Date.now()) return res.status(403).json({ error: "You're muted right now, so you can't comment." });
    const text = clean(req.body.text, 400);
    if (text.length < 2) return res.status(400).json({ error: "Write a comment first." });
    const now = Date.now(), list = (recent.get(S(me._id)) || []).filter((t) => now - t < 600_000);
    if (list.length >= 5) return res.status(429).json({ error: "You wrote a lot of comments. Wait a few minutes and try again." });
    const chk = checkText(text);
    if (chk.kind === "private") return res.status(400).json({ error: PRIVATE_MESSAGE[chk.info || "phone"], blocked: true });
    if (!chk.ok) { const st = await strike(S(me._id)); return res.status(400).json({ error: st.muted ? "You used bad words too many times, so you're muted for 5 minutes." : FRIENDLY_MESSAGE, blocked: true }); }
    list.push(now); recent.set(S(me._id), list);
    const c = await BlogComment.create({ post: req.params.id, user: me._id, username: me.username, text });
    // the admins hear about it (their game window; the Club's bell asks /api/blog/pending)
    emitToAdmins("admin:blogComment", { username: me.username, text: text.slice(0, 80) });
    res.json({ comment: commentView(c, true), message: "Thanks! Your comment will show after an admin approves it." });
  } catch (err) { next(err); }
});
router.get("/blog/pending", requireAdmin, async (req, res, next) => {
  try {
    const list = await BlogComment.find({ status: "pending" }).sort({ at: 1 }).limit(200).lean();
    const titles = new Map((await BlogPost.find({ _id: { $in: [...new Set(list.map((c) => S(c.post)))] } }).select("title").lean()).map((p) => [S(p._id), p.title]));
    res.set("Cache-Control", "no-store");
    res.json({ comments: list.map((c) => ({ ...commentView(c), post: S(c.post), postTitle: titles.get(S(c.post)) || "" })), count: list.length });
  } catch (err) { next(err); }
});
router.post("/blog/comment/:id/:act(approve|reject|delete)", requireJson, requireAdmin, async (req, res, next) => {
  try {
    if (!okId(req.params.id)) return res.status(404).json({ error: "There's no such comment." });
    if (req.params.act === "delete") { await BlogComment.deleteOne({ _id: req.params.id }); return res.json({ ok: true }); }
    const c = await BlogComment.findByIdAndUpdate(req.params.id, { $set: { status: req.params.act === "approve" ? "approved" : "rejected", reviewedBy: req.user.username, reviewedAt: new Date() } }, { new: true }).lean();
    if (!c) return res.status(404).json({ error: "There's no such comment." });
    res.json({ comment: commentView(c) });
  } catch (err) { next(err); }
});

export default router;
