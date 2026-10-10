import { User } from "../models/User.js";
import { notifyUser, notifyLevel } from "../realtime/plaza.js";
import { LEVEL_DAY_XP, MAX_LEVEL, TOTAL, levelOf } from "../public/shared/levels.js";

/*
  Player levels (public/shared/levels.js). addLevelXp is called where XP is earned: mini-games and the daily
  gift (routes/rewards.js), jobs (routes/jobs.js), board games (realtime/duel.js), the tutorial (routes/tutorial.js)
  and quests. capped: counts toward LEVEL_DAY_XP a day (quests aren't capped). Never throws.
  The player gets "level:xp" { xp, level, gained, up }; everyone around sees the new badge ("player:level").
*/
const TZ = "Asia/Jerusalem";
const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export async function addLevelXp(userId, amount, { capped = true, why = "" } = {}) {
  try {
    amount = Math.max(0, Math.floor(amount));
    if (!amount) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const user = await User.findById(userId).select("levelXp levelDay levelDayXp __v");
      if (!user) return null;
      const day = dayKey(), dayXp = user.levelDay === day ? user.levelDayXp || 0 : 0, xp0 = user.levelXp || 0;
      const room = Math.max(0, TOTAL[MAX_LEVEL] - xp0);
      const gain = Math.min(room, capped ? Math.max(0, Math.min(amount, LEVEL_DAY_XP - dayXp)) : amount);
      if (!gain) return { gained: 0, xp: xp0, level: levelOf(xp0), capped: capped && room > 0 };
      const ok = await User.updateOne(
        { _id: user._id, __v: user.__v },
        { $set: { levelXp: xp0 + gain, levelDay: day, levelDayXp: capped ? dayXp + gain : dayXp }, $inc: { __v: 1 } }
      );
      if (!ok.modifiedCount) continue;
      const before = levelOf(xp0), level = levelOf(xp0 + gain), id = user._id.toString();
      const out = { gained: gain, xp: xp0 + gain, level, up: level > before, why };
      notifyUser(id, "level:xp", out);
      if (out.up) notifyLevel(id, level);
      return out;
    }
  } catch (err) {
    console.error("level xp", err.message);
  }
  return null;
}
