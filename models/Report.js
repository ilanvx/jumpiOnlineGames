import mongoose from "mongoose";

/*
  A player reported another player (the player card, JumpiChat or the Friends app; routes/social.js).
  Admins see them in /admin → Reports. Kept for a year.
  "context" is a copy of what was said around the report, so an admin can judge it even after
  the chat history (30 days) is gone: the last private messages between the two, or the reported
  player's last public chat lines.
*/
const DAY = 24 * 60 * 60;
const { ObjectId } = mongoose.Schema.Types;
export const REPORT_REASONS = ["grooming", "sexual", "bullying", "language", "scam", "other"];
// these go to the top of the list in /admin
export const URGENT_REASONS = new Set(["grooming", "sexual"]);

const reportSchema = new mongoose.Schema({
  fromId: { type: ObjectId, required: true },
  from: { type: String, required: true },
  targetId: { type: ObjectId, required: true },
  target: { type: String, required: true },
  reason: { type: String, enum: REPORT_REASONS, required: true },
  details: { type: String, default: "", maxlength: 500 },
  where: { type: String, enum: ["card", "chat", "friends"], default: "card" },
  room: { type: String, default: "" },
  context: { type: [{ from: String, text: String, at: Date, room: String }], default: [] },
  status: { type: String, enum: ["open", "done"], default: "open" },
  handledBy: { type: String, default: "" },
  note: { type: String, default: "", maxlength: 500 },
  at: { type: Date, default: Date.now },
});
reportSchema.index({ at: 1 }, { expireAfterSeconds: 365 * DAY });
reportSchema.index({ status: 1, at: -1 });
reportSchema.index({ targetId: 1, at: -1 });

export const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);
