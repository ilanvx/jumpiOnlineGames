import mongoose from "mongoose";

/*
  A sign-up waiting for its email code (routes/auth.js). The account (User) is made only when the right code
  is typed, so an email that was never checked never becomes an account. Forgotten after 2 hours.
*/
const pendingSignupSchema = new mongoose.Schema({
  username: { type: String, required: true },
  usernameLower: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true },
  look: { type: mongoose.Schema.Types.Mixed, default: {} },
  birthDate: { type: Date, required: true },
  lang: { type: String, default: "en" },
  verify: { type: mongoose.Schema.Types.Mixed, default: {} },   // { hash, expires, tries, sentAt, sends } like User.verify
  createdAt: { type: Date, default: Date.now },
});
pendingSignupSchema.index({ email: 1 });
pendingSignupSchema.index({ usernameLower: 1 });
pendingSignupSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 3600 });

export const PendingSignup = mongoose.models.PendingSignup || mongoose.model("PendingSignup", pendingSignupSchema);
