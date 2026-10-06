// Make a player an admin (or a regular player again).
// Usage:  npm run make-admin -- <username>
//         npm run remove-admin -- <username>
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User.js";

const [role, username] = process.argv.slice(2);
if (!["admin", "player"].includes(role) || !username) {
  console.error("Usage: npm run make-admin -- <username>   or   npm run remove-admin -- <username>");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "jumpi", serverSelectionTimeoutMS: 10000 });
  const user = await User.findOneAndUpdate({ usernameLower: username.toLowerCase() }, { role }, { new: true });
  if (!user) {
    console.error(`✗ No player called "${username}". Check the spelling, or sign up with that name first.`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${user.username} is now ${role === "admin" ? "an admin" : "a regular player"}.`);
    console.log("  Log out and back in on the website to see the change.");
  }
} catch (err) {
  console.error("✗ Could not update the database:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
