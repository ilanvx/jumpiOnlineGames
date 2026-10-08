// makes the welcome card in a worker thread, so the game server never stops for the ~1 second it takes
import { parentPort, workerData } from "node:worker_threads";
import { welcomeCard } from "./card.js";

const d = workerData;
const png = welcomeCard({ ...d, avatar: d.avatar ? Buffer.from(d.avatar) : null });
parentPort.postMessage(png, [png.buffer]);
