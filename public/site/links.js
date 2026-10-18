/* /links (the link in our TikTok and YouTube bios): English ⇄ Hebrew like the rest of the site (guide-lang.js).
   Someone who never picked a language and whose phone is in Hebrew sees Hebrew. */
import { setLang } from "/site/guide-lang.js";

let picked = false;
try { picked = !!(new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang")); } catch (e) {}
if (!picked && /^he|^iw/i.test(navigator.language || "")) setLang("he");
