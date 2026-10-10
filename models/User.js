import mongoose from "mongoose";
import { LOOK_SLOTS, STARTER_MAX, lookItems, CATALOG, MOD_ITEMS } from "../catalog.js";

// admins always have every item in the game (furniture: this many of each). Admins can't trade, so nothing leaks out.
const ADMIN_FURNITURE_EACH = 10;
import { isBirthdayOn } from "../public/shared/birthday.js";

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
    hat: slot("hat"),
    neck: slot("neck"),
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
    birthDate: { type: Date },                       // asked at sign-up (accounts made before that don't have it)
    birthdayGiftYear: { type: Number },              // the year the birthday present was last given
    snacks: { type: Array, default: [] },            // the food bar: [{ id, k, i, b }] (realtime/food.js)
    // email check: a 6-digit code sent with Resend (only when RESEND_API_KEY is set). Accounts can't log in until it's true.
    emailVerified: { type: Boolean },
    verify: { type: mongoose.Schema.Types.Mixed },   // { hash, expires, tries, sentAt, sends: [times] } while a code is waiting
    tutorialAt: { type: Date },                      // finished or skipped the live tutorial (new players get it on their first visit)
    tutorialPaid: { type: Boolean, default: false }, // the 250-coin prize for finishing it (once)
    reset: { type: mongoose.Schema.Types.Mixed },    // forgot password: { hash, expires, sends: [times] } while a reset link is waiting
    lastLoginAt: { type: Date },
    // set to true for paying members (for now, flip it by hand in Atlas)
    subscriber: { type: Boolean, default: false },
    // membership bought in the store: one payment, never renews by itself; buying again adds days
    memberUntil: { type: Date, default: null },
    // "admin" gets the admin panel (npm run make-admin -- <username>)
    role: { type: String, enum: ["player", "mod", "admin"], default: "player" },   // "mod" = moderator (chosen players: kick/ban/mute, coins from a monthly budget)
    modBudget: { type: mongoose.Schema.Types.Mixed },   // moderators: { month: "2026-10", used: coins given this month }
    coins: { type: Number, default: 0, min: 0 },
    bannedUntil: { type: Date, default: null }, // far-future date = permanent
    banReason: { type: String, default: "" },
    mutedUntil: { type: Date, default: null },
    // admins: play invisibly (only other admins see them). On by default; switched in the game or on the admin website
    adminInvisible: { type: Boolean, default: true },
    // best score in each mini-game ("fruit", "shell", "dig", "flap")
    gameBest: { type: Map, of: Number, default: {} },
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
    // house upgrades bought with coins (public/shared/houses.js)
    house: {
      type: new mongoose.Schema(
        { big: { type: Boolean, default: false }, garden: { type: Boolean, default: false }, pool: { type: Boolean, default: false }, upstairs: { type: Boolean, default: false } },
        { _id: false }
      ),
      default: () => ({}),
    },
    // jobs: per job { hired, since, xp, served, shifts, earned } (public/shared/jobs.js), and today's job pay (capped per day)
    jobs: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    jobsDay: { type: String, default: "" },
    jobsEarned: { type: Number, default: 0, min: 0 },
    // the Season (public/shared/season.js): { id, xp, claimed: [tiers] }, XP earned today (capped), and the last Lucky Wheel spin
    season: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    seasonDay: { type: String, default: "" },
    seasonDayXp: { type: Number, default: 0, min: 0 },
    wheelAt: { type: Date, default: null },
    // hidden places in the world whose treasure this player already took (e.g. "cave", routes/secrets.js)
    secrets: { type: [String], default: [] },
    // friends (both players list each other) and friend requests waiting for this player's answer
    friends: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    friendReqIn: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    // player level (public/shared/levels.js, routes/levels.js): total XP, and today's capped XP
    levelXp: { type: Number, default: 0, min: 0 },
    levelDay: { type: String, default: "" },
    levelDayXp: { type: Number, default: 0 },
    // quests from the people of Jumpi (routes/quests.js): { done: [ids], active: { id: { step, n, got, snap } } }
    quests: { type: mongoose.Schema.Types.Mixed, default: () => ({ done: [], active: {} }) },
    // players this player blocked (routes/social.js): no messages or friend requests, and both are "ghosts" to each other in the game
    blocked: { type: [mongoose.Schema.Types.ObjectId], default: [], index: true },
    // daily login bonus: the last day it was claimed ("2026-10-06", Israel time) and the current streak
    dailyLast: { type: String, default: "" },
    dailyStreak: { type: Number, default: 0, min: 0 },
    // mini-game coins earned today (capped per day)
    gamesDay: { type: String, default: "" },
    gamesEarned: { type: Number, default: 0, min: 0 },
    // adopted pets; petOut = the id of the pet walking with the player ("" = all at home)
    pets: {
      type: [
        new mongoose.Schema(
          { id: String, kind: String, color: { type: Number, default: 0 }, name: String, at: { type: Date, default: Date.now } },
          { _id: false }
        ),
      ],
      default: [],
    },
    petOut: { type: String, default: "" },
    // hunger / energy / stamina / fun, 0–100 (they only go down while playing; see realtime/needs.js)
    needs: {
      type: new mongoose.Schema(
        {
          hunger: { type: Number, default: 100, min: 0, max: 100 },
          energy: { type: Number, default: 100, min: 0, max: 100 },
          stamina: { type: Number, default: 100, min: 0, max: 100 },
          fun: { type: Number, default: 100, min: 0, max: 100 },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
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
  if (this.role === "mod") for (const id of MOD_ITEMS) if (!counts.has(id)) counts.set(id, 1);
  if (this.role === "admin")
    for (const it of CATALOG) {
      const n = it.category === "furniture" ? ADMIN_FURNITURE_EACH : 1;
      if ((counts.get(it.id) || 0) < n) counts.set(it.id, n);
    }
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
    subscriber: this.isMember(),
    memberUntil: this.memberUntil && this.memberUntil.getTime() > Date.now() ? this.memberUntil : null,
    role: this.role === "admin" ? "admin" : this.role === "mod" ? "mod" : "player",
    coins: this.coins ?? 0,
    createdAt: this.createdAt,
    verified: this.emailVerified === true,
    hasBirthday: !!this.birthDate,   // older accounts are asked once in the game
    levelXp: this.levelXp || 0,
    birthDate: this.birthDate ? this.birthDate.toISOString().slice(0, 10) : null,   // shown only to the player (Settings → Account)
    birthdayToday: isBirthdayOn(this.birthDate),
    tutorialDone: !!this.tutorialAt,
    secrets: Array.isArray(this.secrets) ? [...this.secrets] : [],
    mustVerify: !!process.env.RESEND_API_KEY && this.emailVerified !== true,   // the game asks for the email code before playing
  };
};

// a member: set by hand (subscriber) or a store membership that hasn't run out
userSchema.methods.isMember = function () {
  return this.subscriber === true || (!!this.memberUntil && this.memberUntil.getTime() > Date.now());
};

userSchema.methods.isBanned = function () {
  return !!this.bannedUntil && this.bannedUntil.getTime() > Date.now();
};

// all players live in the "jumpi3D" collection
export const User = mongoose.model("User", userSchema, "jumpi3D");
