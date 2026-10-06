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
  },
  { timestamps: true }
);

userSchema.methods.publicLook = function () {
  const l = this.look || {};
  const out = {};
  for (const name of Object.keys(LOOK_SLOTS)) out[name] = Number.isInteger(l[name]) ? l[name] : LOOK_SLOTS[name].optional ? -1 : 0;
  return out;
};

// everything the player owns: bought items plus whatever they're already wearing
userSchema.methods.ownedItems = function () {
  return new Set([...(this.inventory || []), ...lookItems(this.publicLook())]);
};

// What the browser is allowed to see — never the password hash
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    look: this.publicLook(),
    inventory: [...this.ownedItems()],
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
