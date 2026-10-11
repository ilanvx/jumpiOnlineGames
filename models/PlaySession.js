import mongoose from "mongoose";

/*
  Play sessions: when a player opened the game and when they closed it (realtime/playtime.js writes them).
  For the parents' page (/parents): "played today" and the history of logins. Kept for 90 days.
  "last" moves forward every minute while the game is open, so a server restart still knows about when it ended.
*/
const playSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  start: { type: Date, required: true },
  last: { type: Date, required: true },
  end: { type: Date, default: null },                                                  // null: still playing
  device: { type: String, enum: ["app", "phone", "tablet", "computer"], default: "computer" },
});
playSessionSchema.index({ userId: 1, start: -1 });
playSessionSchema.index({ userId: 1, last: -1 });
playSessionSchema.index({ start: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const PlaySession = mongoose.models.PlaySession || mongoose.model("PlaySession", playSessionSchema);
