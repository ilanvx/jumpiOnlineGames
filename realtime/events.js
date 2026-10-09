/*
  Which holiday event is on right now (public/shared/events.js). Kept in the database (Setting "event") so it
  survives restarts; read once at start and cached. Changing it tells every open game at once (socket "event").
*/
import mongoose from "mongoose";
import { EVENTS, isEvent } from "../public/shared/events.js";
import { broadcastAll } from "./plaza.js";

const settingSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, value: { type: mongoose.Schema.Types.Mixed, default: null }, by: { type: String, default: "" } },
  { timestamps: true }
);
export const Setting = mongoose.models.Setting || mongoose.model("Setting", settingSchema);

let current = "";
let since = null;

export async function loadEvent() {
  try {
    const s = await Setting.findOne({ key: "event" }).lean();
    current = s && isEvent(s.value) ? s.value : "";
    since = s ? s.updatedAt : null;
  } catch (err) {
    console.warn("[events] couldn't read the current event:", err.message);
  }
  if (current) console.log(`✓ Event on: ${EVENTS[current].name}`);
}

export const activeEvent = () => current;
export const eventInfo = () => ({ event: current, since, list: Object.values(EVENTS).map(({ id, name, about }) => ({ id, name, about })) });

// "" = normal game. Returns the new state.
export async function setEvent(id, by) {
  const next = isEvent(id) ? id : "";
  await Setting.updateOne({ key: "event" }, { $set: { value: next, by: by || "" } }, { upsert: true });
  current = next;
  since = new Date();
  broadcastAll("event", { event: current });
  return eventInfo();
}

// can this item be bought right now? (items of an event only while that event is on)
export const eventShopOpen = (item) => !item.event || item.event === current;
