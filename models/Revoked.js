import mongoose from "mongoose";

/*
  Logins that were ended (log out): the id of the token and when it would have run out by itself.
  routes/auth.js keeps the list in memory too and refuses those tokens; the database forgets each one
  once its time is up anyway.
*/
const revokedSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  exp: { type: Date, required: true },
});
revokedSchema.index({ exp: 1 }, { expireAfterSeconds: 0 });

export const Revoked = mongoose.models.Revoked || mongoose.model("Revoked", revokedSchema);
