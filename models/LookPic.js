import mongoose from "mongoose";

// A picture of a Jumpi in one look (body colour, eyes and clothes), made by the server itself (routes/portraits.js) for the
// Club website. One per look: everyone who wears the same things shares it. Nobody can send in a picture of their own.
const lookPicSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  png: { type: Buffer, required: true },
  at: { type: Date, default: Date.now },
});

export const LookPic = mongoose.model("LookPic", lookPicSchema);
