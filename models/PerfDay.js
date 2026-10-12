import mongoose from "mongoose";

/*
  The daily performance report (admin panel → Performance). Anonymous: no player id, only a running total per day
  and kind of device. A game tab sends one short report every few minutes it's played (routes/perf.js).
*/
const perfDaySchema = new mongoose.Schema(
  {
    day: { type: String, required: true },       // "2026-10-13" (Israel date)
    device: { type: String, required: true },    // web-computer / web-phone / android-app / computer-app
    tier: { type: String, required: true },      // low / mid / high (what the game guessed for the graphics card)
    reports: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },       // minutes of play these reports cover
    fpsMinutes: { type: Number, default: 0 },    // sum of (frames a second × minutes): average = fpsMinutes / minutes
    slowMinutes: { type: Number, default: 0 },   // minutes that ran under 30 frames a second
    longFrames: { type: Number, default: 0 },    // frames that took more than 100 ms (a visible stutter)
  },
  { timestamps: false }
);
perfDaySchema.index({ day: 1, device: 1, tier: 1 }, { unique: true });

export const PerfDay = mongoose.models.PerfDay || mongoose.model("PerfDay", perfDaySchema);
