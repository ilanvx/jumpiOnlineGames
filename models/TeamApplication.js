import mongoose from "mongoose";

/*
  Applications from the /team page (public/site/team.html, routes/team.js) to join the first Community Team.
  Read and answered in the admin panel → Team applications (routes/admin.js /team).
  Youngest age per role (TEAM_MIN_AGE): Community Manager 16, Guide (the moderation team) 15, Beta Tester 13.
  Everyone under 18 needs a parent's approval (parentOk). The server checks both.
*/
export const TEAM_ROLES = ["manager", "guide", "beta"];
export const TEAM_MIN_AGE = { manager: 16, guide: 15, beta: 13 };
export const TEAM_MOD_ROLES = ["manager", "guide"];   // moderation powers: they also answer the experience + situation questions
export const TEAM_STATUS = ["new", "reviewing", "accepted", "declined"];

const teamSchema = new mongoose.Schema(
  {
    role: { type: String, enum: TEAM_ROLES, required: true },
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, maxlength: 200 },
    age: { type: Number, min: 13, max: 99, required: true },
    country: { type: String, default: "", maxlength: 60 },
    username: { type: String, default: "", maxlength: 24 },   // Jumpi username they typed
    account: { type: String, default: "" },                   // the account that was signed in when they sent it
    discord: { type: String, default: "", maxlength: 40 },
    languages: { type: [String], default: [] },
    hours: { type: String, default: "" },
    devices: { type: [String], default: [] },
    about: { type: String, default: "", maxlength: 2000 },     // experience
    why: { type: String, required: true, maxlength: 2000 },
    scenario: { type: String, default: "", maxlength: 1500 },  // "a player is being mean to a younger kid…"
    link: { type: String, default: "", maxlength: 200 },
    parentOk: { type: Boolean, default: false },              // under 18: a parent approves
    lang: { type: String, default: "en" },
    status: { type: String, enum: TEAM_STATUS, default: "new" },
    notes: { type: [{ text: String, admin: String, at: { type: Date, default: Date.now } }], default: [] },
    statusBy: { type: String, default: "" },
  },
  { timestamps: true }
);
teamSchema.index({ status: 1, createdAt: -1 });
teamSchema.index({ email: 1, role: 1 });

export const TeamApplication = mongoose.models.TeamApplication || mongoose.model("TeamApplication", teamSchema);
