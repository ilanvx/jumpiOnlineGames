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
    product: { type: String, required: true },
    kind: { type: String, enum: ["member", "coins", "bundle"], required: true },
    amount: { type: Number, required: true }, // shekels
    currency: { type: String, default: "ILS" },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled", "duplicate", "refunded"], default: "pending", index: true },
    provider: { type: String, enum: ["hyp", "test"], default: "hyp" },
    providerRef: { type: String, default: "" }, // the payment company's transaction id
    give: { type: Object, default: {} }, // what this order gives, copied at the time of buying
    paidAt: { type: Date, default: null },
    grantedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
orderSchema.index({ user: 1, product: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
