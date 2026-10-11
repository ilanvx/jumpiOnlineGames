import mongoose from "mongoose";

// one vote in the weekly poll on the website. A voter (player id, or an anonymous browser id) votes once per week.
const pollVoteSchema = new mongoose.Schema(
  {
    week: { type: String, required: true },   // the week and the question, e.g. "2026-W41:vacation" (polls.js voteKey)
    option: { type: Number, required: true, min: 0, max: 9 },
    voter: { type: String, required: true },  // "u:<userId>" or "a:<random id>"
  },
  { timestamps: true }
);
pollVoteSchema.index({ week: 1, voter: 1 }, { unique: true });
pollVoteSchema.index({ week: 1, option: 1 });
pollVoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 8 * 7 * 24 * 3600 });   // only recent weeks are kept (the database stays small)

export const PollVote = mongoose.models.PollVote || mongoose.model("PollVote", pollVoteSchema);
