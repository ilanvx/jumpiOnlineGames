import mongoose from "mongoose";

/*
  The admin panel's Item studio (routes/items.js): one row per item that the panel changed.
  - fix: where it sits on the character (move p[x,y,z], turn r[x,y,z] in radians, size s), for any item.
  - item: a whole new item made in the panel (from an existing look, its own colours, name and price).
  key = "slot:index", the same item number as everywhere else ("neck:43").
*/
const itemDefSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 20 },
    slot: { type: String, required: true, maxlength: 10 },
    index: { type: Number, required: true, min: 0 },
    fix: { type: mongoose.Schema.Types.Mixed, default: null },
    item: { type: mongoose.Schema.Types.Mixed, default: null },
    by: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);

export const ItemDef = mongoose.models.ItemDef || mongoose.model("ItemDef", itemDefSchema);
