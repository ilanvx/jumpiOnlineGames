import express from "express";
import { ContactMessage } from "../models/ContactMessage.js";
import { currentUser, requireJson } from "./auth.js";

/* The Contact page form. Messages are saved for the team to answer at support@jumpigames.com. */
const router = express.Router();
const TOPICS = new Set(["general", "safety", "privacy", "account", "bug", "idea"]);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

// at most 5 messages an hour from one connection
const recent = new Map();
function allowed(key) {
  const now = Date.now(), list = (recent.get(key) || []).filter((t) => now - t < 3600_000);
  if (list.length >= 5) return false;
  list.push(now);
  recent.set(key, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

router.post("/contact", requireJson, async (req, res, next) => {
  try {
    if (req.body.website) return res.json({ ok: true });   // a hidden field only spam robots fill in
    const email = clean(req.body.email, 200).toLowerCase(), message = clean(req.body.message, 3000);
    const topic = TOPICS.has(req.body.topic) ? req.body.topic : "general";
    if (!EMAIL.test(email)) return res.status(400).json({ field: "email", error: "Please enter a valid email address." });
    if (message.length < 10) return res.status(400).json({ field: "message", error: "Please write a little more (at least 10 characters)." });
    if (!allowed(req.ip || "?")) return res.status(429).json({ error: "You've sent a lot of messages. Please try again in an hour, or email support@jumpigames.com." });
    const user = await currentUser(req).catch(() => null);
    await ContactMessage.create({ name: clean(req.body.name, 80), email, topic, message, username: user ? user.username : "", lang: req.body.lang === "he" ? "he" : "en" });
    console.log(`[contact] new ${topic} message${user ? " from " + user.username : ""}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
