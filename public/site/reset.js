/* Forgot / reset password page (/forgot-password and /reset-password?token=…). Server: routes/auth.js (/forgot, /reset/check, /reset). */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

if (new URLSearchParams(location.search).has("hero")) document.body.classList.add("hero-shot");   // just the 3D picture (used to make the email picture)

/* ---------- English ⇄ Hebrew (same choice as the rest of the site) ---------- */
let lang = "en";
const L = (en, he) => (lang === "he" ? he : en);
{
  const btns = [...document.querySelectorAll(".lang-sw [data-l]")];
  const setLang = (l) => {
    lang = l === "he" ? "he" : "en";
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === lang));
    document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach((el) => (el.textContent = lang === "he" ? el.dataset.he : el.dataset.en));
    try { localStorage.setItem("jumpi-lang", lang); } catch (e) {}
  };
  btns.forEach((b) => (b.onclick = () => setLang(b.dataset.l)));
  let start = "en";
  try { start = new URLSearchParams(location.search).get("lang") || localStorage.getItem("jumpi-lang") || "en"; } catch (e) {}
  setLang(start);
}

/* ---------- the views ---------- */
const $ = (id) => document.getElementById(id);
let view = "";
function show(v) {
  view = v;
  document.querySelectorAll(".rp-view").forEach((el) => (el.hidden = el.dataset.v !== v));
  scene3d.mood(v);
  const first = document.querySelector(`.rp-view[data-v="${v}"] input`);
  if (first && matchMedia("(min-width:861px)").matches) setTimeout(() => first.focus(), 60);
}
async function post(path, body) {
  try {
    const r = await fetch("/api/auth/" + path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) { return { ok: false, status: 0, data: { code: "net" } }; }
}
const ERR = {
  net: () => L("Can't reach Jumpi right now. Check the internet and try again.", "אי אפשר להתחבר לג'אמפי כרגע. בדקו את האינטרנט ונסו שוב."),
  off: () => L("Password reset by email isn't switched on yet. Write to support@jumpigames.com and we'll help.", "איפוס סיסמה במייל עוד לא פעיל. כתבו ל-support@jumpigames.com ונעזור."),
  empty: () => L("Type the email of your Jumpi account.", "כתבו את האימייל של חשבון הג'אמפי."),
  send: () => L("We couldn't send the email right now. Please try again in a minute.", "לא הצלחנו לשלוח את האימייל כרגע. נסו שוב בעוד דקה."),
  short: () => L("Your password needs at least 8 characters.", "הסיסמה צריכה לפחות 8 תווים."),
  long: () => L("That password is too long.", "הסיסמה ארוכה מדי."),
  name: () => L("Your password can't be your username.", "הסיסמה לא יכולה להיות שם המשתמש."),
  same: () => L("The two passwords aren't the same.", "שתי הסיסמאות לא זהות."),
  busy: () => L("Too many tries. Please wait a few minutes.", "יותר מדי ניסיונות. חכו כמה דקות."),
};
const errText = (r) => (r.status === 429 ? ERR.busy() : ERR[r.data.code] ? ERR[r.data.code]() : r.data.error || ERR.net());
function oops(form, msgEl, text) {
  msgEl.className = "rp-msg"; msgEl.textContent = text;
  form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
  scene3d.shake();
}

/* 1. ask for a link */
let lastEmail = "", againT = 0;
async function sendLink(email) {
  const r = await post("forgot", { email });
  if (!r.ok) return r;
  lastEmail = email;
  $("sTo").textContent = email;
  const btn = $("sAgain"); let left = r.data.wait || 60;
  btn.disabled = true; clearInterval(againT);
  const label = () => (btn.textContent = left > 0 ? `${L("SEND AGAIN", "שליחה שוב")} (${left})` : L("SEND AGAIN", "שליחה שוב"));
  label(); againT = setInterval(() => { left--; label(); if (left <= 0) { clearInterval(againT); btn.disabled = false; } }, 1000);
  return r;
}
$("fForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("fEmail").value.trim(), go = $("fGo");
  if (!email) return oops($("fForm"), $("fMsg"), ERR.empty());
  go.disabled = true; $("fMsg").textContent = "";
  const r = await sendLink(email);
  go.disabled = false;
  if (!r.ok) return oops($("fForm"), $("fMsg"), errText(r));
  show("sent");
});
$("sAgain").onclick = async () => { $("sAgain").disabled = true; const r = await sendLink(lastEmail); if (!r.ok) { $("sAgain").disabled = false; alertSoft(errText(r)); } };
const alertSoft = (t) => { $("sTo").textContent = lastEmail + " · " + t; };

/* 3. new password */
const token = new URLSearchParams(location.search).get("token") || "";
function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++;
  if (/[a-z]/i.test(pw) && /\d/.test(pw)) s++; if (/[^a-z0-9]/i.test(pw) || /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(pw)) s++;
  return pw.length < 8 ? Math.min(1, s) * 0.18 : [0.3, 0.45, 0.7, 0.88, 1][s];
}
$("rPass").addEventListener("input", () => {
  const pw = $("rPass").value, k = strength(pw), bar = $("rBar");
  bar.style.width = (pw ? Math.max(0.08, k) * 100 : 0) + "%";
  bar.style.background = k < 0.3 ? "#ff5a5a" : k < 0.6 ? "#ffb21f" : "#2fd36b";
  $("rHint").textContent = !pw ? L("At least 8 characters. A mix of words and numbers is best!", "לפחות 8 תווים. הכי טוב שילוב של מילים ומספרים!")
    : pw.length < 8 ? L(`${8 - pw.length} more to go…`, `עוד ${8 - pw.length} תווים…`) : k < 0.6 ? L("Good! Even better with numbers or a longer password.", "טוב! עוד יותר טוב עם מספרים או סיסמה ארוכה יותר.") : L("Super strong password!", "סיסמה סופר חזקה!");
  $("rMsg").textContent = "";
});
document.querySelectorAll(".rp-eye").forEach((b) => (b.onclick = () => {
  const inp = $(b.dataset.for), on = inp.type === "password";
  inp.type = on ? "text" : "password"; b.classList.toggle("on", on); b.setAttribute("aria-label", on ? "Hide password" : "Show password");
}));
$("rForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("rPass").value, pw2 = $("rPass2").value, form = $("rForm"), msg = $("rMsg");
  if (pw.length < 8) return oops(form, msg, ERR.short());
  if (pw !== pw2) return oops(form, msg, ERR.same());
  $("rGo").disabled = true;
  const r = await post("reset", { token, password: pw });
  $("rGo").disabled = false;
  if (!r.ok) { if (r.data.code === "bad") return show("bad"); return oops(form, msg, errText(r)); }
  $("dName").textContent = r.data.username || "";
  history.replaceState(null, "", "/reset-password");   // the link is used up: take it out of the address bar
  show("done");
});

/* ---------- the 3D picture: a Jumpi, a big golden key and a padlock ---------- */
const scene3d = (() => {
  const canvas = $("rpCanvas"), reduce = (window.JUMPI_REDUCE_MOTION || matchMedia("(prefers-reduced-motion: reduce)").matches);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: document.body.classList.contains("hero-shot") });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60), clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6aa0d0, 1.8));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(-3, 7, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -3, near: 1, far: 20 }); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9ad8ff, 1); rim.position.set(4, 3, -5); scene.add(rim);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
  const mesh = (geo, m, pos, parent, rot) => { const x = new THREE.Mesh(geo, m); if (pos) x.position.set(...pos); if (rot) x.rotation.set(...rot); x.castShadow = x.receiveShadow = true; parent.add(x); return x; };
  const GOLD = mat("#ffc21a", { metalness: 0.65, roughness: 0.28, emissive: "#5a3400", emissiveIntensity: 0.15 }), STEEL = mat("#c9d3e2", { metalness: 0.8, roughness: 0.25 });

  const world = new THREE.Group(); scene.add(world);
  // a little floating island
  mesh(new THREE.CylinderGeometry(2.3, 1.7, 0.7, 48), mat("#b5784a", { roughness: 0.95 }), [0, -0.35, 0], world);
  mesh(new THREE.CylinderGeometry(2.36, 2.36, 0.14, 48), mat("#6fcf5b", { roughness: 0.95 }), [0, -0.03, 0], world);
  [[-1.6, 0.9], [1.7, 0.7], [-0.6, 1.8], [1.1, -1.4]].forEach(([x, z], i) => { const f = new THREE.Group(); f.position.set(x, 0.04, z); world.add(f);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), mat("#2f9a3e"), [0, 0.11, 0], f);
    mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(["#ff5fa8", "#ffd23a", "#ffffff", "#9b5cff"][i]), [0, 0.24, 0], f); });

  // the padlock
  const lock = new THREE.Group(); lock.position.set(1.15, 0.02, -0.2); lock.rotation.y = -0.35; world.add(lock);
  const lockBody = mesh(new THREE.BoxGeometry(0.95, 0.8, 0.42), mat("#7a5cff", { roughness: 0.35 }), [0, 0.42, 0], lock);
  mesh(new THREE.BoxGeometry(0.99, 0.08, 0.46), mat("#5a3fd6"), [0, 0.12, 0], lock); mesh(new THREE.BoxGeometry(0.99, 0.08, 0.46), mat("#5a3fd6"), [0, 0.74, 0], lock);
  mesh(new THREE.CircleGeometry(0.08, 20), mat("#1d1446"), [0, 0.47, 0.212], lock); mesh(new THREE.PlaneGeometry(0.06, 0.16), mat("#1d1446"), [0, 0.37, 0.212], lock);
  void lockBody;
  const shackle = new THREE.Group(); shackle.position.set(-0.27, 0.82, 0); lock.add(shackle);   // turns around its left leg
  mesh(new THREE.TorusGeometry(0.27, 0.07, 14, 28, Math.PI), STEEL, [0.27, 0.22, 0], shackle);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 14), STEEL, [0, 0.07, 0], shackle); mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 14), STEEL, [0.54, 0.07, 0], shackle);

  // the golden key
  const key = new THREE.Group(); world.add(key);
  mesh(new THREE.TorusGeometry(0.26, 0.085, 16, 36), GOLD, [-0.52, 0, 0], key);
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.95, 16), GOLD, [0.1, 0, 0], key, [0, 0, Math.PI / 2]);
  mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), GOLD, [0.38, -0.12, 0], key); mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), GOLD, [0.52, -0.09, 0], key);
  mesh(new THREE.SphereGeometry(0.06, 12, 8), mat("#ff5fa8", { roughness: 0.2 }), [-0.52, 0, 0.09], key);
  const sparkles = [];
  for (let i = 0; i < 6; i++) { const s = mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: "#fff6c0" }), [0, 0, 0], world); s.castShadow = false; sparkles.push(s); }

  // the Jumpi
  let J = null;
  new GLTFLoader().load("/blobby.glb", (g) => {
    const root = g.scene;
    root.traverse((o) => { if (!o.isMesh) return; o.castShadow = true;
      o.material = [].concat(o.material).map((m) => { if (m.name === "Skin") { m = m.clone(); m.color.set("#ff8a1c"); } else if (m.name === "Iris") { m = m.clone(); m.color.set("#2a7fff"); }
        else if (m.name === "Mouth") { m = m.clone(); m.color.set("#4a1c00"); } return m; });
      if (o.material.length === 1) o.material = o.material[0]; });
    J = { root, body: root.getObjectByName("Body"), head: root.getObjectByName("Head"), armL: root.getObjectByName("ArmL"), armR: root.getObjectByName("ArmR"), eyeL: root.getObjectByName("EyeL"), eyeR: root.getObjectByName("EyeR") };
    J.headY = J.head.position.y; root.scale.setScalar(0.95); root.position.set(-0.75, 0.04, 0.35); root.rotation.y = 0.35; world.add(root);
  });

  let mood = "forgot", moodT = 0, hopT = -9, shakeT = -9, keyFrom = null;
  const KEYHOLE = new THREE.Vector3(0, 0.47, 0.212 + 0.3), X_AXIS = new THREE.Vector3(1, 0, 0), qTurn = new THREE.Quaternion();
  const Q_IN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });
  canvas.addEventListener("click", () => (hopT = clock.getElapsedTime()));
  const kw = new THREE.Vector3();
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  function frame() {
    requestAnimationFrame(frame);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); cam.aspect = w / h; const k = Math.max(1, 1.25 / cam.aspect);
      cam.position.set(0, 2.6, 9.4 * k); cam.lookAt(0, 0.95, 0); cam.updateProjectionMatrix();
    }
    const t = reduce ? 1.5 : clock.getElapsedTime(), mt = t - moodT;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    world.rotation.y = mouse.x * 0.4 + Math.sin(t * 0.25) * 0.08; world.rotation.x = mouse.y * 0.06;
    const sk = (t - shakeT) / 0.5; world.position.x = sk >= 0 && sk < 1 ? Math.sin(sk * 40) * 0.06 * (1 - sk) : 0;
    // the key: floats and turns while waiting; when the password is saved it flies into the lock and turns it
    const done = mood === "done";
    const kIn = done ? ease(Math.min(1, mt / 0.9)) : 0, turn = done ? ease((mt - 0.9) / 0.4) : 0, open = done ? ease((mt - 1.25) / 0.35) : 0;
    if (!done) {
      key.position.set(-0.1, 2.25 + Math.sin(t * 1.6) * 0.1, 0.3);
      key.rotation.set(Math.sin(t * 0.9) * 0.25, t * 0.8, Math.sin(t * 1.3) * 0.15 - 0.4);
    } else if (keyFrom) {
      // in the lock's own space: the shaft goes into the keyhole (key +x → lock -z), then the key turns a quarter
      key.position.lerpVectors(keyFrom.p, KEYHOLE, kIn); key.position.y += Math.sin(Math.PI * kIn) * 0.6;
      if (turn <= 0) key.quaternion.slerpQuaternions(keyFrom.q, Q_IN, kIn);
      else key.quaternion.copy(Q_IN).multiply(qTurn.setFromAxisAngle(X_AXIS, turn * Math.PI / 2));
    }
    shackle.position.y = 0.82 + open * 0.3; shackle.rotation.y = open * Math.PI;
    key.getWorldPosition(kw); world.worldToLocal(kw);
    sparkles.forEach((s, i) => { const a = t * 1.4 + i * (Math.PI * 2 / 6); const r = 0.75 + Math.sin(t * 2 + i) * 0.08;
      s.position.set(kw.x + Math.cos(a) * r, kw.y + Math.sin(a * 1.3) * 0.35, kw.z + Math.sin(a) * r * 0.5);
      s.rotation.y = t * 3 + i; s.scale.setScalar(done && open > 0.5 ? 1.6 : 0.7 + 0.4 * Math.sin(t * 4 + i)); });
    if (J) {
      const br = Math.sin(t * 2.1); J.body.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012); J.head.position.y = J.headY + br * 0.012;
      J.eyeL.scale.y = J.eyeR.scale.y = (t * 0.37) % 1 < 0.035 ? 0.15 : 1;
      // looks up at the key; waves when the email is sent; cheers when it's done
      J.head.rotation.x = done ? 0 : -0.14; J.head.rotation.y = 0.25 + mouse.x * 0.3;
      let hy = 0; const hk = (t - hopT) / 0.8; if (hk >= 0 && hk < 1) hy = Math.sin(Math.PI * hk) * 0.55;
      if (done && mt > 1.3) { const c = ((mt - 1.3) % 1.1) / 1.1; hy = Math.max(hy, Math.sin(Math.PI * Math.min(1, c / 0.7)) * 0.45 * (c < 0.7 ? 1 : 0)); }
      J.root.position.y = 0.04 + hy;
      if (mood === "sent") { J.armR.rotation.set(0, 0, 2.4 + Math.sin(t * 12) * 0.35); J.armL.rotation.set(0, 0, -0.1); }
      else if (done && mt > 1.3) { J.armR.rotation.set(0, 0, 2.6); J.armL.rotation.set(0, 0, -2.6); }
      else if (mood === "bad") { J.armR.rotation.set(0, 0, 0.5); J.armL.rotation.set(0, 0, -0.5); J.head.rotation.z = Math.sin(t * 2) * 0.12; }
      else { J.armR.rotation.set(-0.5, 0, 0.9 + Math.sin(t * 1.6) * 0.1); J.armL.rotation.set(0, 0, -0.1); J.head.rotation.z = 0; }
    }
    renderer.render(scene, cam);
  }
  frame();
  return { mood(v) {
      mood = v; moodT = clock.getElapsedTime(); if (v === "sent") hopT = moodT;
      if (v === "done" && !keyFrom) { scene.updateMatrixWorld(true); lock.attach(key); keyFrom = { p: key.position.clone(), q: key.quaternion.clone() }; }
    }, shake() { shakeT = clock.getElapsedTime(); } };
})();

/* ---------- start ---------- */
if (document.body.classList.contains("hero-shot")) show("forgot");
else if (token) {
  show("wait");
  post("reset/check", { token }).then((r) => {
    if (!r.ok) return show("bad");
    $("rName").textContent = r.data.username;
    show("reset");
  });
} else show("forgot");
