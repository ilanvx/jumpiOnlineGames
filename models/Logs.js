import mongoose from "mongoose";

/*
  History kept for safety and moderation (shown in /admin).
  Chat is kept for 30 days, trades and games for a year, admin actions for good.
*/
const DAY = 24 * 60 * 60;
const { ObjectId } = mongoose.Schema.Types;

// public chat, game/trade chat and blocked private messages
const chatLogSchema = new mongoose.Schema({
  userId: { type: ObjectId, required: true },
  username: { type: String, required: true },
  room: { type: String, default: "plaza" },         // "plaza", "home:<name>", "dm:<name>"
  text: { type: String, required: true, maxlength: 400 },
  blocked: { type: Boolean, default: false },        // stopped by the bad-word filter
  at: { type: Date, default: Date.now },
});
chatLogSchema.index({ at: 1 }, { expireAfterSeconds: 30 * DAY });
chatLogSchema.index({ userId: 1, at: -1 });
chatLogSchema.index({ blocked: 1, at: -1 });

const side = { userId: ObjectId, username: String, items: [String] };
const tradeLogSchema = new mongoose.Schema({ a: side, b: side, at: { type: Date, default: Date.now } });
tradeLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * DAY });
tradeLogSchema.index({ "a.userId": 1, at: -1 });
tradeLogSchema.index({ "b.userId": 1, at: -1 });

const duelLogSchema = new mongoose.Schema({
  game: String,
  players: [{ userId: ObjectId, username: String, paid: Number, won: Number }],
  winner: { type: String, default: "" },   // username, or "" for a draw
  reason: String,
  at: { type: Date, default: Date.now },
});
duelLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * DAY });
duelLogSchema.index({ "players.userId": 1, at: -1 });

// everything an admin does
const adminLogSchema = new mongoose.Schema({
  adminId: ObjectId,
  admin: String,
  action: { type: String, required: true },
  targetId: ObjectId,
  target: { type: String, default: "" },
  details: { type: String, default: "" },
  via: { type: String, default: "panel" },   // "panel" (/admin) or "game" (in-game admin window)
  ip: { type: String, default: "" },
  at: { type: Date, default: Date.now },
});
adminLogSchema.index({ at: -1 });
adminLogSchema.index({ targetId: 1, at: -1 });

export const ChatLog = mongoose.models.ChatLog || mongoose.model("ChatLog", chatLogSchema);
export const TradeLog = mongoose.models.TradeLog || mongoose.model("TradeLog", tradeLogSchema);
export const DuelLog = mongoose.models.DuelLog || mongoose.model("DuelLog", duelLogSchema);
export const AdminLog = mongoose.models.AdminLog || mongoose.model("AdminLog", adminLogSchema);

// write without ever slowing down or breaking the game
export function logQuietly(Model, doc) {
  Model.create(doc).catch((err) => console.error(`[log] ${Model.modelName}:`, err.message));
}
