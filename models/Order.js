import mongoose from "mongoose";

/*
  One purchase in the Jumpi Store (real money). Created as "pending" when the player
  goes to pay; turned into "paid" only after the payment company confirms it,
  and only then are the coins / items / membership days given (once).
*/
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, default: "" },
    product: { type: String, required: true },   // the product id, or "cart" when the order has several
    kind: { type: String, enum: ["member", "coins", "bundle", "costume", "cart"], required: true },
    // what is in the cart: one line per product (bundles are always 1); amount = the sum of price × qty
    items: { type: [{ _id: false, product: String, qty: Number, price: Number }], default: [] },
    cartKey: { type: String, default: "" },   // the same cart again within 15 minutes reuses this order (no paying twice)
    amount: { type: Number, required: true }, // shekels
    currency: { type: String, default: "ILS" },
    // partial = part of the money was given back; refunded = all of it (routes/payments.js)
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled", "duplicate", "partial", "refunded"], default: "pending", index: true },
    provider: { type: String, enum: ["hyp", "test", "msstore"], default: "hyp" },   // msstore = bought in the Microsoft Store app (routes/msstore.js)
    providerRef: { type: String, default: "" }, // the payment company's transaction id
    give: { type: Object, default: {} }, // what this order gives, copied at the time of buying
    paidAt: { type: Date, default: null },
    grantedAt: { type: Date, default: null },
    // money given back from the admin payments panel. kind "cancel" = cancelled at Hyp the same day (no fee),
    // "refund" = a refund transaction at Hyp. days = membership days taken back; ref = Hyp's id of the refund
    refunds: {
      type: [{ _id: false, kind: String, amount: Number, at: Date, by: String, ref: String, reason: String, takeBack: String, coins: Number, days: Number, items: [String], batch: String }],
      default: [],
    },
    refunded: { type: Number, default: 0 },          // shekels given back so far
    busy: { type: Date, default: null },             // a refund is being sent to Hyp right now (stops double clicks)
    notes: { type: String, default: "" },            // the admin's own notes
    ms: { type: Object, default: undefined },        // Microsoft Store purchases: { itemId, trackingId, country, orderId }
  },
  { timestamps: true }
);
orderSchema.index({ user: 1, product: 1, status: 1 });
orderSchema.index({ user: 1, "items.product": 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ paidAt: -1 });
// a Microsoft transaction makes one order, ever
orderSchema.index({ provider: 1, providerRef: 1 }, { unique: true, partialFilterExpression: { provider: "msstore" } });
orderSchema.index({ "refunds.at": -1 });

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
