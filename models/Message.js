import mongoose from "mongoose";

// A private message between two friends (JumpiChat on the in-game phone).
const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, maxlength: 300 },
  at: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});
messageSchema.index({ from: 1, to: 1, at: -1 });
messageSchema.index({ to: 1, read: 1 });

export const Message = mongoose.model("Message", messageSchema);
