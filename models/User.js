import mongoose from "mongoose";
import { LOOK_SLOTS, STARTER_MAX, lookItems } from "../catalog.js";

// What sign-up may pick (the free starter items). Index ranges per slot.
export const LOOK_LIMITS = Object.fromEntries(
  Object.entries(STARTER_MAX).map(([slot, max]) => [slot, [LOOK_SLOTS[slot].optional ? -1 : 0, max]])
);

const slot = (name) => ({
  type: Number,
  default: LOOK_SLOTS[name].optional ? -1 : 0,
  min: LOOK_SLOTS[name].optional ? -1 : 0,
  max: LOOK_SLOTS[name].max,
});
const lookSchema = new mongoose.Schema(
  {
    color: slot("color"),
    eyes: slot("eyes"),
    hair: slot("hair"),
    shirt: slot("shirt"),
    pants: slot("pants"),
    glasses: slot("glasses"),
    tag: slot("tag"),
    aura: slot("aura"),
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    // lower-case copy so "Dana" and "dana" can't both exist
    usernameLower: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    look: { type: lookSchema, default: () => ({}) },
    // item ids the player owns, e.g. "shirt:4", "tag:8"
    inventory: { type: [String], default: [] },
    acceptedTermsAt: { type: Date, required: true },
    ageConfirmedAt: { type: Date, required: true },
    lastLoginAt: { type: Date },
    // set to true for paying members (for now, flip it by hand in Atlas)
    subscriber: { type: Boolean, default: false },
    // "admin" gets the admin panel (npm run make-admin -- <username>)
    role: { type: String, enum: ["player", "admin"], default: "player" },
    coins: { type: Number, default: 0, min: 0 },
    bannedUntil: { type: Date, default: null }, // far-future date = permanent
    banReason: { type: String, default: "" },
    mutedUntil: { type: Date, default: null },
    // bumped when an admin resets the password: every old login stops working
    tokenVersion: { type: Number, default: 0 },
    // the player's own home: wallpaper, floor and where each piece of furniture stands
    home: {
      type: new mongoose.Schema(
        {
          wall: { type: Number, default: 0 },
          floor: { type: Number, default: 0 },
          items: { type: [new mongoose.Schema({ f: Number, x: Number, z: Number, r: Number }, { _id: false })], default: [] },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    // friends (both players list each other) and friend requests waiting for this player's answer
    friends: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    friendReqIn: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // daily login bonus: the last day it was claimed ("2026-10-06", Israel time) and the current streak
    dailyLast: { type: String, default: "" },
    dailyStreak: { type: Number, default: 0, min: 0 },
    // mini-game coins earned today (capped per day)
    gamesDay: { type: String, default: "" },
    gamesEarned: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userSchema.methods.publicLook = function () {
  const l = this.look || {};
  const out = {};
  for (const name of Object.keys(LOOK_SLOTS)) out[name] = Number.isInteger(l[name]) ? l[name] : LOOK_SLOTS[name].optional ? -1 : 0;
  return out;
};

// how many of each item the player has (trades can give doubles); a worn item counts once even if it isn't listed
userSchema.methods.itemCounts = function () {
  const counts = new Map();
  for (const id of this.inventory || []) counts.set(id, (counts.get(id) || 0) + 1);
  for (const id of lookItems(this.publicLook())) if (!counts.has(id)) counts.set(id, 1);
  return counts;
};
// make sure everything being worn is also listed in the inventory (keeps doubles)
userSchema.methods.normalizeInventory = function () {
  const inv = [...(this.inventory || [])];
  for (const id of lookItems(this.publicLook())) if (!inv.includes(id)) inv.push(id);
  this.inventory = inv;
};

// everything the player owns: bought items plus whatever they're already wearing
userSchema.methods.ownedItems = function () {
  return new Set(this.itemCounts().keys());
};

// What the browser is allowed to see — never the password hash
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    look: this.publicLook(),
    inventory: [...this.itemCounts()].flatMap(([id, n]) => Array(n).fill(id)),
    subscriber: this.subscriber === true,
    role: this.role === "admin" ? "admin" : "player",
    coins: this.coins ?? 0,
    createdAt: this.createdAt,
  };
};

userSchema.methods.isBanned = function () {
  return !!this.bannedUntil && this.bannedUntil.getTime() > Date.now();
};

// all players live in the "jumpi3D" collection
export const User = mongoose.model("User", userSchema, "jumpi3D");
