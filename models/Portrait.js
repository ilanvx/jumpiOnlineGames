import mongoose from "mongoose";

// A small picture of a player's own Jumpi in the clothes they wear, made by their game window (index.html: clubPortrait)
// when their look changes. Only that player is ever shown it (the Club website's circle at the top), so nobody can
// put a picture in front of other kids.
const portraitSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  png: { type: Buffer, required: true },
  at: { type: Date, default: Date.now },
});

export const Portrait = mongoose.model("Portrait", portraitSchema);
