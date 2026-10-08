import mongoose from "mongoose";
import crypto from "crypto";
import { checkName } from "../public/shared/profanity.js";

/*
  Gift codes. Admins make them in the admin panel (Codes); players type them on the sign in the game's
  start screen (routes/codes.js). A code gives coins, works once per player, and can have a limit on how
  many players may use it and an end date.
*/
const codeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, maxlength: 20 },   // letters and numbers only, upper case
    coins: { type: Number, required: true, min: 1, max: 100000 },
    maxUses: { type: Number, default: 0, min: 0 },   // 0 = no limit
    uses: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    note: { type: String, default: "", maxlength: 120 },   // for the admins only (where the code was given out)
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

// one row per player who used a code (the unique index is what makes "once per player" safe)
const codeUseSchema = new mongoose.Schema({
  codeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  code: { type: String, default: "" },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  username: { type: String, default: "" },
  coins: { type: Number, default: 0 },
  at: { type: Date, default: Date.now },
});
codeUseSchema.index({ codeId: 1, userId: 1 }, { unique: true });
codeUseSchema.index({ codeId: 1, at: -1 });

export const Code = mongoose.models.Code || mongoose.model("Code", codeSchema);
export const CodeUse = mongoose.models.CodeUse || mongoose.model("CodeUse", codeUseSchema);
// what players type: "jumpi-2026 " → "JUMPI2026"
export const normCode = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

// make a new code (admin panel website and the in-game admin panel). Throws an error with .publicMessage.
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I, easy to read out
const oops = (m) => Object.assign(new Error(m), { publicMessage: m });
export async function createCode({ code, coins, maxUses, days, note, by }) {
  coins = Math.floor(Number(coins) || 0);
  if (coins < 1 || coins > 100000) throw oops("Coins: between 1 and 100,000.");
  maxUses = Math.max(0, Math.min(1000000, Math.floor(Number(maxUses) || 0)));
  days = Math.max(0, Math.min(3650, Number(days) || 0));
  code = normCode(code);
  if (code && (code.length < 4 || code.length > 20)) throw oops("The code needs 4 to 20 letters or numbers.");
  if (code && checkName(code).ok === false) throw oops("Pick another code (that word isn't allowed).");
  if (!code) { do code = "JUMPI" + Array.from(crypto.randomBytes(5), (b) => ABC[b % ABC.length]).join(""); while (checkName(code).ok === false || (await Code.exists({ code }))); }
  else if (await Code.exists({ code })) throw oops("That code already exists.");
  return Code.create({ code, coins, maxUses, expiresAt: days ? new Date(Date.now() + days * 86400000) : null, note: String(note ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120), createdBy: by || "" });
}
