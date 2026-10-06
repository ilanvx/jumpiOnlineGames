import mongoose from "mongoose";

// one vote in the weekly poll on the website. A voter (player id, or an anonymous browser id) votes once per week.
const pollVoteSchema = new mongoose.Schema(
  {
    week: { type: String, required: true },   // e.g. "2026-W41"
    option: { type: Number, required: true, min: 0, max: 9 },
    voter: { type: String, required: true },  // "u:<userId>" or "a:<random id>"
  },
  { timestamps: true }
);
pollVoteSchema.index({ week: 1, voter: 1 }, { unique: true });
pollVoteSchema.index({ week: 1, option: 1 });

export const PollVote = mongoose.models.PollVote || mongoose.model("PollVote", pollVoteSchema);
