import net from "node:net";

/*
  The player's real address (for the "too many tries" limits and the admin log).
  The game is reached through Cloudflare (its tunnel runs on this computer, or its proxies connect to us), so the
  connection itself comes from 127.0.0.1 or from a Cloudflare address. Cloudflare puts the visitor's address in the
  CF-Connecting-IP header; we only believe that header when the connection really came from the tunnel or from
  Cloudflare (anyone else could write it themselves).
*/
const CF_V4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"];
const CF_V6 = ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"];
const cloudflare = new net.BlockList();
for (const r of CF_V4) { const [a, n] = r.split("/"); cloudflare.addSubnet(a, Number(n), "ipv4"); }
for (const r of CF_V6) { const [a, n] = r.split("/"); cloudflare.addSubnet(a, Number(n), "ipv6"); }

const plain = (a) => String(a || "").replace(/^::ffff:/, "");
const isLocal = (a) => a === "127.0.0.1" || a === "::1" || a.startsWith("127.");
function fromCloudflare(a) {
  try { return cloudflare.check(a, net.isIPv6(a) ? "ipv6" : "ipv4"); } catch { return false; }
}
// remote = the address the connection came from, header = the CF-Connecting-IP header
export function realIp(remote, header) {
  const a = plain(remote);
  const h = String(header || "").split(",")[0].trim();
  if ((isLocal(a) || fromCloudflare(a)) && net.isIP(h)) return plain(h);
  return a || "?";
}
export const reqIp = (req) => realIp(req.socket?.remoteAddress, req.headers["cf-connecting-ip"]);
export const socketIp = (socket) => realIp(socket.handshake.address, socket.handshake.headers["cf-connecting-ip"]);
// did the player reach us over https? (directly, or through Cloudflare / its tunnel, which say so in a header)
export function isHttps(req) {
  if (!req) return process.env.NODE_ENV === "production";
  if (req.secure || process.env.NODE_ENV === "production") return true;
  const a = plain(req.socket?.remoteAddress);
  if (!isLocal(a) && !fromCloudflare(a)) return false;
  const proto = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return proto === "https" || /"scheme"\s*:\s*"https"/.test(String(req.headers?.["cf-visitor"] || ""));
}
// the request came in through Cloudflare (the real domain), not straight to this computer
export function viaCloudflare(reqOrHandshake) {
  const remote = reqOrHandshake.socket?.remoteAddress ?? reqOrHandshake.address;
  const a = plain(remote);
  return (isLocal(a) || fromCloudflare(a)) && !!reqOrHandshake.headers?.["cf-connecting-ip"];
}
