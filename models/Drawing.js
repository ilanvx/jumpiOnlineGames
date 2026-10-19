import mongoose from "mongoose";

// A picture a player coloured or drew in the Jumpi Club colouring book (public/club/draw). Only its owner ever sees it.
// png = the paint layer only; the page's lines (public/club/draw/pages.js) are drawn over it when it's shown.
const drawingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  page: { type: String, default: "blank", maxlength: 40 },
  png: { type: Buffer, required: true },
  at: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Drawing = mongoose.model("Drawing", drawingSchema);
