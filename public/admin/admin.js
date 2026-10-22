/* Jumpi admin panel. Everything players wrote is shown with textContent only (never as HTML). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const main = $("#main");

  /* ---------- tiny DOM builder (safe: text is never parsed as HTML) ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style") el.style.cssText = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
    return el;
  }
  const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");
  const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const ago = (d) => {
    if (!d) return "—";
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Math.floor(s / 86400) + " days ago";
  };
  const until = (d) => {
    if (!d) return "";
    const t = new Date(d);
    if (t.getFullYear() >= 9000) return "forever";
    const m = Math.round((t - Date.now()) / 60000);
    return m < 60 ? `${m} min left` : m < 1440 ? `${Math.round(m / 60)} h left` : `${Math.round(m / 1440)} days left`;
  };
  const SKIN = ["#ff8a1c", "#1fb6ff", "#2fd36b", "#ff5fb4", "#9b5cff", "#ffd23a", "#ff4545", "#f2f6ff", "#5b3420", "#c27a3a", "#f6c4a0", "#8a5a3c", "#2a2f72", "#c8102e", "#39ff14", "#f2c230"];
  const where = (w) => (!w ? "" : w === "plaza" ? "In the Plaza" : w.startsWith("home:") ? `At ${w.slice(5)}'s home` : w);

  /* ---------- talking to the server ---------- */
  async function api(path, body) {
    const opt = { credentials: "same-origin", headers: {} };
    if (body !== undefined) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    let r;
    try { r = await fetch("/api/admin" + path, opt); } catch { throw new Error("Can't reach the server."); }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && data.locked) { showGate("unlock"); throw Object.assign(new Error("Locked"), { quiet: true }); }
    if (r.status === 404 && path === "/session") throw Object.assign(new Error("not-admin"), { notAdmin: true });
    if (!r.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }
  let toastT = 0;
  function toast(text, err) {
    const t = $("#toast");
    t.textContent = text; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = "toast" + (err ? " err" : "")), 3200);
  }
  const oops = (e) => { if (!e.quiet) toast(e.message, true); };

  /* ---------- sign in and unlock ---------- */
  let unlockUntil = 0;
  function showGate(mode) {
    $("#app").hidden = true;
    $("#gate").hidden = false;
    $("#gateUserRow").hidden = mode === "unlock";
    $("#gateUser").required = mode !== "unlock";
    $("#gateText").textContent = mode === "unlock" ? "For safety, type your password again to open the admin panel." : "Sign in with your admin account.";
    $("#gateGo").textContent = mode === "unlock" ? "Unlock" : "Sign in";
    $("#gateForm").dataset.mode = mode;
    $("#gatePass").value = "";
    setTimeout(() => (mode === "unlock" ? $("#gatePass") : $("#gateUser")).focus(), 30);
  }
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#gateMsg"), btn = $("#gateGo"), pass = $("#gatePass").value;
    msg.textContent = ""; btn.disabled = true;
    try {
      if ($("#gateForm").dataset.mode === "login") {
        const r = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: $("#gateUser").value, password: pass, remember: false }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Couldn't sign in.");
        // only senior admins can open this website (other admins use their tools inside the game)
        const ok = d.user && d.user.role === "admin" && (await fetch("/api/admin/session", { credentials: "same-origin" })).status !== 404;
        if (!ok) {
          await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
          throw new Error("This account can't open the admin website.");
        }
      }
      const u = await api("/unlock", { password: pass });
      unlockUntil = u.until;
      $("#gatePass").value = "";
      await start();
    } catch (err) {
      if (!err.quiet) msg.textContent = err.message;
    }
    btn.disabled = false;
  });
  $("#lockBtn").onclick = async () => { try { await api("/lock", {}); } catch {} unlockUntil = 0; showGate("unlock"); };
  setInterval(() => {
    if (!unlockUntil) return;
    const m = Math.max(0, Math.round((unlockUntil - Date.now()) / 60000));
    $("#lockTimer").textContent = "Locks itself after 30 minutes without activity";
    if (unlockUntil < Date.now()) { unlockUntil = 0; showGate("unlock"); }
    void m;
  }, 15000);

  async function boot() {
    try {
      const s = await api("/session");
      $("#whoName").textContent = s.admin;
      if (!s.unlocked) return showGate("unlock");
      unlockUntil = s.until;
      start();
    } catch (e) {
      if (e.notAdmin) showGate("login");
      else oops(e);
    }
  }
  async function start() {
    const s = await api("/session");
    $("#whoName").textContent = s.admin;
    unlockUntil = Date.now() + 30 * 60000;
    $("#gate").hidden = true;
    $("#app").hidden = false;
    route();
    refreshCounts();
  }

  /* ---------- small UI pieces ---------- */
  function page(title, ...right) {
    main.replaceChildren(h("div", { class: "head" }, h("h1", null, title), h("span", { class: "sp" }), right));
    return main;
  }
  const panel = (title, ...kids) => h("section", { class: "panel" }, title ? h("h2", null, title) : null, kids);
  function table(cols, rows, onRow) {
    if (!rows.length) return h("p", { class: "empty" }, "Nothing here yet.");
    return h("div", { class: "tbl-wrap" }, h("table", null, h("thead", null, h("tr", null, cols.map((c) => h("th", null, c[0])))),
      h("tbody", null, rows.map((r) => h("tr", { class: onRow ? "click" : null, onclick: onRow ? () => onRow(r) : null }, cols.map((c) => h("td", null, c[1](r))))))));
  }
  const userLink = (name, id) => (id ? h("a", { href: "#player/" + id }, name) : name);
  function modal(title, fields, okText, onOk, danger) {
    const card = $("#modalCard"), inputs = {};
    card.classList.remove("wide");
    const form = h("form", { class: "ann" }, h("h2", null, title),
      fields.map((f) => f.text ? h("p", { class: "muted" }, f.text) : h("label", { class: "fld" }, h("span", null, f.label),
        (inputs[f.name] = f.options ? h("select", null, f.options.map(([v, t]) => h("option", { value: v }, t)))
          : f.area ? h("textarea", { rows: 3, maxlength: f.max || 200 }) : h("input", { type: f.type || "text", maxlength: f.max || 200, placeholder: f.ph || "", autocomplete: f.type === "password" ? "new-password" : "off" })))),
      h("div", { class: "row" }, h("button", { class: "b b-ghost", type: "button", onclick: close }, "Cancel"), h("button", { class: "b " + (danger ? "b-red" : "b-orange"), type: "submit" }, okText)));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const vals = {};
      for (const k in inputs) vals[k] = inputs[k].value;
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      try { await onOk(vals); close(); } catch (err) { oops(err); }
      btn.disabled = false;
    });
    card.replaceChildren(form);
    $("#modal").hidden = false;
    setTimeout(() => (Object.values(inputs)[0] || form.querySelector("button[type=submit]")).focus(), 30);
    function close() { $("#modal").hidden = true; }
  }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });
  addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });

  /* ---------- payments panel ---------- */
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  const ils = (n) => "₪" + (Math.round(Number(n || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function payApi(path, body) {
    const opt = { credentials: "same-origin", headers: {} };
    if (body !== undefined) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    let r;
    try { r = await fetch("/api/admin/pay" + path, opt); } catch { throw new Error("Can't reach the server."); }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && data.locked) { showGate("unlock"); throw Object.assign(new Error("Locked"), { quiet: true }); }
    if (r.status === 401 && data.payLocked) { if (path !== "/session") payGate(); throw Object.assign(new Error("Payments locked"), { quiet: path !== "/session", payLocked: true }); }
    if (!r.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }
  function payGate() {
    page("Payments");
    const code = h("input", { type: "password", autocomplete: "off", maxlength: 200, required: true });
    const msg = h("p", { class: "bad small", role: "alert" });
    const form = h("form", { class: "panel pay-gate" },
      h("h2", null, "Payments code"),
      h("p", { class: "muted" }, "The payments are locked with their own code. It stays open for 15 minutes while you work."),
      h("label", { class: "fld" }, h("span", null, "Code"), code),
      h("button", { class: "b b-orange", type: "submit" }, "Open payments"), msg);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = "";
      const btn = form.querySelector("button"); btn.disabled = true;
      try { await payApi("/unlock", { code: code.value }); code.value = ""; if (location.hash.startsWith("#pay")) route(); else location.hash = "#pay"; }
      catch (err) { if (!err.quiet || err.payLocked) msg.textContent = err.message === "Payments locked" ? "Wrong code." : err.message; }
      btn.disabled = false;
    });
    main.append(form);
    setTimeout(() => code.focus(), 30);
  }
  const STATUS_TAG = { paid: ["green", "Paid"], pending: ["", "Waiting"], failed: ["red", "Failed"], cancelled: ["", "Cancelled"], duplicate: ["red", "Paid twice"], partial: ["orange", "Part refunded"], refunded: ["violet", "Refunded"] };
  const statusTag = (st) => h("span", { class: "tag " + (STATUS_TAG[st]?.[0] || "") }, STATUS_TAG[st]?.[1] || st);
  const tileBox = (big, label, c, e, sub) => h("div", { class: "tile", style: `--c:${c};--e:${e}` }, h("b", null, big), h("span", null, label), sub ? h("small", { class: "tile-sub" }, sub) : null);
  // bars for the last 30 days: money in (green) and refunds (red)
  function payChart(days) {
    const W = 720, H = 180, pad = 22, n = days.length, bw = (W - pad * 2) / n;
    const max = Math.max(10, ...days.map((d) => Math.max(d.in, d.out)));
    const NS = "http://www.w3.org/2000/svg", el = (t, a) => { const x = document.createElementNS(NS, t); for (const k in a) x.setAttribute(k, a[k]); return x; };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H + 24}`, class: "pay-chart", role: "img", "aria-label": "Money in and refunds, last 30 days" });
    for (const f of [0, 0.5, 1]) {
      const y = pad + (H - pad * 2) * (1 - f);
      svg.append(el("line", { x1: pad, x2: W - pad, y1: y, y2: y, class: "grid" }));
      const t = el("text", { x: 2, y: y - 3, class: "lbl" }); t.textContent = "₪" + Math.round(max * f); svg.append(t);
    }
    days.forEach((d, i) => {
      const x = pad + i * bw, hIn = (H - pad * 2) * (d.in / max), hOut = (H - pad * 2) * (d.out / max);
      const g = el("g", {});
      const tip = el("title", {}); tip.textContent = `${d.day}: ${ils(d.in)} in (${d.n})${d.out ? ", " + ils(d.out) + " refunded" : ""}`; g.append(tip);
      g.append(el("rect", { x: x + 2, y: H - pad - hIn, width: Math.max(2, bw / 2 - 2), height: Math.max(0, hIn), rx: 3, class: "in" }));
      if (d.out) g.append(el("rect", { x: x + bw / 2, y: H - pad - hOut, width: Math.max(2, bw / 2 - 2), height: hOut, rx: 3, class: "out" }));
      svg.append(g);
      if (i % 5 === 0 || i === n - 1) { const t = el("text", { x: x + 2, y: H + 4, class: "lbl" }); t.textContent = d.day.slice(5).replace("-", "/"); svg.append(t); }
    });
    return svg;
  }
  async function download(path, name) {
    const r = await fetch("/api/admin/pay" + path, { credentials: "same-origin" });
    if (r.status === 401) { const d = await r.json().catch(() => ({})); if (d.payLocked) return payGate(); if (d.locked) return showGate("unlock"); }
    if (!r.ok) throw new Error("Couldn't make the file.");
    const url = URL.createObjectURL(await r.blob()), a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function openReceipt(orderId, ref) {
    const w = window.open("", "_blank");   // opened right away, so the browser doesn't block it
    try {
      const d = await payApi(`/orders/${orderId}/receipt` + (ref ? "?ref=" + encodeURIComponent(ref) : ""));
      if (w) { w.opener = null; w.location.href = d.url; } else location.href = d.url;
    } catch (e) { if (w) w.close(); oops(e); }
  }

  // one order: everything about it, and what can be done with it
  async function orderCard(id, after) {
    const d = await payApi("/orders/" + id), o = d.order, p = d.player, card = $("#modalCard");
    card.classList.add("wide");
    const close = () => { $("#modal").hidden = true; };
    const done = async (msg) => { toast(msg); close(); await after?.(); };
    const facts = (pairs) => h("dl", { class: "facts" }, pairs.filter(Boolean).map(([k, v]) => h("div", null, h("dt", null, k), h("dd", null, v))));
    const acts = h("div", { class: "row pay-acts" });
    if (o.provider === "hyp" && o.ref && o.status !== "pending" && o.status !== "failed") acts.append(h("button", { class: "b b-ghost b-sm", type: "button", onclick: () => openReceipt(o.id) }, "Receipt (PDF)"));
    if (o.provider === "msstore") acts.append(h("p", { class: "small muted", style: "margin:0" }, "Bought in the Microsoft Store app: Microsoft holds the receipt and gives refunds (Partner Center → Insights / support). Microsoft keeps 12%."));
    else if (["paid", "partial", "duplicate"].includes(o.status) && o.left > 0) acts.append(h("button", { class: "b b-red b-sm", type: "button", onclick: () => refundForm(o, done, after) }, "Refund…"));
    if (o.provider === "hyp" && ["pending", "failed"].includes(o.status)) acts.append(h("button", { class: "b b-green b-sm", type: "button", onclick: () => grantForm(o, done) }, "Paid → give"));
    const notes = h("textarea", { rows: 2, maxlength: 500 }); notes.value = o.notes || "";
    const saveNote = h("button", { class: "b b-ghost b-sm", type: "button", onclick: async () => { try { await payApi(`/orders/${o.id}/note`, { notes: notes.value }); toast("Note saved."); } catch (e) { oops(e); } } }, "Save note");
    fill(card,
      h("h2", null, `Order · ${ils(o.amount)}`), h("div", { class: "row", style: "justify-content:flex-start;gap:8px" }, statusTag(o.status), o.provider === "test" ? h("span", { class: "tag" }, "test (pretend)") : o.provider === "msstore" ? h("span", { class: "tag blue" }, "Microsoft Store") : null, o.busy ? h("span", { class: "tag orange" }, "refund being sent") : null),
      facts([["Created", fmtDate(o.at)], ["Paid", fmtDate(o.paidAt)], [o.provider === "msstore" ? "Microsoft transaction" : "Hyp transaction", o.ref || "–"], ["Refunded", ils(o.refunded)], ["Can still refund", ils(o.left)], ["Order id", h("span", { class: "mono small" }, o.id)]]),
      h("h3", { class: "pay-h3" }, "What was bought"),
      table([["Product", (l) => l.name], ["Qty", (l) => l.qty], ["Price", (l) => ils(l.price)], ["Total", (l) => ils(l.price * l.qty)]], o.lines),
      h("p", { class: "small muted" }, `Gave: ${fmtNum(o.give.coins)} coins${o.give.memberDays ? ` · ${o.give.memberDays} membership days` : ""}${o.give.items.length ? " · " + o.give.items.join(", ") : ""}${o.grantedAt ? " · given " + fmtDate(o.grantedAt) : " · nothing given yet"}`),
      o.memberValue ? h("p", { class: "small" }, `Membership still unused from this order: ${o.memberValue.days} days, worth ${ils(o.memberValue.amount)}.`) : null,
      p ? h("div", { class: "pay-sec" }, h("h3", { class: "pay-h3" }, "Player"), facts([["Player", h("a", { href: "#player/" + p.id, onclick: close }, p.username)], ["Email", p.email], ["Coins now", fmtNum(p.coins)], ["Member until", p.memberUntil ? fmtDate(p.memberUntil) : "–"],
        ["Spent in total", ils(p.spent)], ["Refunded in total", ils(p.refunded)], ["Paid orders", fmtNum(p.orders)]])) : h("p", { class: "bad" }, "The account was deleted."),
      o.refunds.length ? h("div", { class: "pay-sec" }, h("h3", { class: "pay-h3" }, "Refunds"), table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Type", (r) => (r.kind === "cancel" ? "Same-day cancel" : "Refund")], ["Amount", (r) => ils(r.amount)],
        ["Took back", (r) => [r.coins && fmtNum(r.coins) + " coins", r.days && r.days + " days", r.items && r.items + " clothes"].filter(Boolean).join(", ") || "–"], ["By", (r) => r.by], ["Why", (r) => h("span", { class: "small" }, r.reason || "–")],
        ["", (r) => (o.provider === "hyp" && r.kind === "refund" && r.ref ? h("button", { class: "b b-ghost b-sm", type: "button", onclick: () => openReceipt(o.id, r.ref) }, "Credit doc") : "")]], o.refunds)) : null,
      h("label", { class: "fld" }, h("span", null, "Your notes (only you see them)"), notes), h("div", { class: "row", style: "justify-content:flex-start" }, saveNote),
      acts, h("div", { class: "row" }, h("button", { class: "b b-ghost", type: "button", onclick: close }, "Close")));
    $("#modal").hidden = false;
  }
  function refundForm(o, done, after) {
    const card = $("#modalCard"), whole = h("input", { type: "checkbox", checked: true });
    const amount = h("input", { type: "number", min: "0.01", step: "0.01", max: String(o.left), value: o.left.toFixed(2), disabled: true });
    whole.onchange = () => { amount.disabled = whole.checked; if (whole.checked) amount.value = o.left.toFixed(2); };
    const take = h("select", null, [["none", "Leave what they got (money only)"], ["share", "Take back the same part: coins and membership days"], ["all", "Take back everything: coins, days and clothes"]].map(([v, t]) => h("option", { value: v }, t)));
    if (o.status === "duplicate") take.disabled = true;
    const reason = h("input", { maxlength: 200, placeholder: "e.g. parent asked, didn't get the coins…" });
    const sure = h("input", { type: "checkbox" });
    const form = h("form", { class: "ann" }, h("h2", null, `Refund ${o.username}`),
      h("p", { class: "muted" }, `${o.what} · paid ${ils(o.amount)}${o.refunded ? `, ${ils(o.refunded)} already refunded` : ""}.`),
      o.canCancel ? h("p", { class: "tag green pay-note" }, "Paid today: a full refund is sent as a same-day cancel at Hyp (no card fee).") : null,
      o.provider === "test" ? h("p", { class: "tag pay-note" }, "A test (pretend) order: Hyp won't be called.") : null,
      h("label", { class: "chk" }, whole, h("span", null, `Everything that's left (${ils(o.left)})`)),
      h("label", { class: "fld" }, h("span", null, "Amount (₪)"), amount),
      h("label", { class: "fld" }, h("span", null, "From the player's account"), take),
      h("label", { class: "fld" }, h("span", null, "Reason (for your log)"), reason),
      h("label", { class: "chk" }, sure, h("span", null, "I checked: send this money back to the card.")),
      h("div", { class: "row" }, h("button", { class: "b b-ghost", type: "button", onclick: () => orderCard(o.id, after).catch(oops) }, "Back"), h("button", { class: "b b-red", type: "submit" }, "Refund")));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!sure.checked) return toast("Tick the box first.", true);
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = "Sending to Hyp…";
      try { const r = await payApi(`/orders/${o.id}/refund`, { all: whole.checked, amount: Number(amount.value), takeBack: take.value, reason: reason.value }); await done(r.message); }
      catch (err) { oops(err); btn.disabled = false; btn.textContent = "Refund"; }
    });
    fill(card, form);
  }
  function grantForm(o, done) {
    modal(`Give ${o.username} what they paid for`, [
      { text: `Only if ${ils(o.amount)} really came in: check the payment in the Hyp portal first, then copy its transaction number.` },
      { name: "ref", label: "Hyp transaction number", ph: "e.g. 12345678", max: 40 },
    ], "Give", async (v) => { const r = await payApi(`/orders/${o.id}/grant`, { ref: v.ref.trim() }); await done(r.message); });
  }

  const PAY = {
    async overview(box) {
      const d = await payApi("/summary"), m = d.money;
      const sub = (x) => `${fmtNum(x.orders)} payments · ${ils(x.gross)} in${x.refunds ? " · " + ils(x.refunds) + " back" : ""}`;
      box.append(h("div", { class: "tiles" },
        tileBox(ils(m.today.net), "today (net)", "#2fd36b", "#17a24a", sub(m.today)),
        tileBox(ils(m.d7.net), "last 7 days", "#1fb6ff", "#06488a", sub(m.d7)),
        tileBox(ils(m.d30.net), "last 30 days", "#8a4dff", "#3a1192", sub(m.d30)),
        tileBox(ils(m.all.net), "since the start", "#3e5b86", "#1f3355", sub(m.all)),
        tileBox(fmtNum(d.buyers), "players who paid", "#ff9a1f", "#a3410a"),
        tileBox(ils(d.members.owed), "unused paid membership", "#ff5fb4", "#a3226a", `${fmtNum(d.members.active)} members now · ${fmtNum(d.members.paidFor)} paid for`)));
      const hl = d.health;
      const check = (ok, good, bad) => h("li", { class: ok ? "ok" : "no" }, ok ? good : bad);
      box.append(h("div", { class: "split" },
        panel("Last 30 days", payChart(d.days), h("p", { class: "small muted" }, h("span", { class: "dot in" }), " money in  ", h("span", { class: "dot out" }), " refunds · Israel time")),
        h("div", null,
          panel("Needs a look", d.attention.length ? table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Player", (r) => r.username], ["Amount", (r) => ils(r.amount)],
            ["Why", (r) => (r.status === "duplicate" ? h("span", { class: "tag red" }, "paid twice: refund") : r.busy ? h("span", { class: "tag orange" }, "refund stuck") : h("span", { class: "tag" }, "never came back: check Hyp"))]], d.attention, (r) => orderCard(r.id, route))
            : h("p", { class: "muted" }, "All good: nothing waiting.")),
          panel("Set-up", h("ul", { class: "pay-health" },
            check(hl.hyp, "Hyp is connected", "Hyp isn't connected (HYP_MASOF / HYP_KEY / HYP_PASSP in .env)"),
            check(hl.code, "Payments code is set", "No payments code"),
            check(hl.microsoft, "Microsoft Store purchases are connected", "Microsoft Store purchases aren't connected (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET)"),
            check(hl.storeOpen, "The store is open to everyone", "The store is closed (only admins on /store?preview)"),
            hl.test ? h("li", { class: "no" }, "STORE_TEST is on: admins can make pretend payments") : null),
            h("p", { class: "small muted" }, "In the Hyp portal: success page = https://jumpigames.com" + hl.returnUrl + ", default document = Receipt (exempt dealer)."))),
      ));
      box.append(panel("What sells", table([["Product", (r) => r.name], ["Sold", (r) => fmtNum(r.n)], ["Money in", (r) => ils(r.total)]], d.byKind)));
    },

    async tx(box) {
      const st = h("select", { class: "inp" }, [["", "All"], ["money", "Money in (paid + refunded)"], ["paid", "Paid"], ["partial", "Part refunded"], ["refunded", "Refunded"], ["attention", "Needs a look"], ["pending", "Waiting for payment"], ["failed", "Failed"], ["duplicate", "Paid twice"]].map(([v, t]) => h("option", { value: v }, t)));
      const q = h("input", { class: "inp", type: "search", placeholder: "Player, Hyp number or order id…", maxlength: 40 });
      const from = h("input", { class: "inp pay-date", type: "date", title: "From" }), to = h("input", { class: "inp pay-date", type: "date", title: "To" });
      const prov = h("select", { class: "inp" }, [["", "All payments"], ["hyp", "Website (Hyp)"], ["msstore", "Microsoft Store app"], ["test", "Test only"]].map(([v, t]) => h("option", { value: v }, t)));
      const csv = h("button", { class: "b b-sm b-green", type: "button" }, "Download for Excel");
      const list = h("div");
      let pageN = 0;
      const params = () => `status=${st.value}&q=${encodeURIComponent(q.value.trim())}&from=${from.value}&to=${to.value}&provider=${prov.value}`;
      const load = async () => {
        const d = await payApi("/orders?" + params() + "&page=" + pageN);
        const pager = d.pages > 1 ? h("div", { class: "row pay-pager" },
          h("button", { class: "b b-ghost b-sm", type: "button", disabled: pageN === 0, onclick: () => { pageN--; load().catch(oops); } }, "← Newer"),
          h("span", { class: "muted small" }, `Page ${pageN + 1} of ${d.pages} · ${fmtNum(d.count)} orders`),
          h("button", { class: "b b-ghost b-sm", type: "button", disabled: pageN >= d.pages - 1, onclick: () => { pageN++; load().catch(oops); } }, "Older →")) : null;
        fill(list,
          h("p", { class: "pay-totals" }, h("span", null, "In: ", h("b", null, ils(d.totals.paid))), h("span", null, "Refunded: ", h("b", null, ils(d.totals.refunded))), h("span", null, "Net: ", h("b", null, ils(d.totals.net))), h("span", { class: "muted small" }, `${fmtNum(d.count)} orders`)),
          panel(null, table([
            ["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Player", (r) => r.username], ["What", (r) => h("span", { class: "small" }, r.what)],
            ["Amount", (r) => h("span", { class: "nowrap" }, ils(r.amount), r.refunded ? h("small", { class: "bad" }, " −" + ils(r.refunded)) : null)],
            ["Status", (r) => statusTag(r.status)], ["Paid with", (r) => h("span", { class: "small muted mono" }, r.provider === "test" ? "test" : r.provider === "msstore" ? "Microsoft" : r.ref || "–")],
            ["", (r) => (r.notes ? h("span", { class: "tag blue", title: r.notes }, "note") : "")],
          ], d.list, (r) => orderCard(r.id, load)), pager));
      };
      const reload = () => { pageN = 0; load().catch(oops); };
      for (const x of [st, from, to, prov]) x.onchange = reload;
      q.addEventListener("input", () => { clearTimeout(q.t); q.t = setTimeout(reload, 300); });
      csv.onclick = () => download("/orders.csv?" + params(), "jumpi-payments.csv").catch(oops);
      box.append(h("div", { class: "tools" }, st, q, from, to, prov, csv), list);
      await load();
    },

    async members(box) {
      const min = h("input", { class: "inp pay-num", type: "number", min: "0", max: "50", step: "0.5", value: "1", title: "Smallest refund (₪)" });
      const out = h("div");
      let timer = 0;
      const showJob = (j) => {
        if (!j) return null;
        const pct = j.total ? Math.round((j.done / j.total) * 100) : 0;
        return panel(j.running ? "Refunding now…" : "Last membership refund",
          h("div", { class: "pay-bar" }, h("i", { style: `width:${pct}%` })),
          h("p", null, `${j.done} of ${j.total} orders · ${j.ok} done · ${j.failed} failed · ${ils(j.amount)} of ${ils(j.planned)} sent back`),
          h("p", { class: "small muted" }, `Started ${fmtDate(j.startedAt)} by ${j.by}${j.endedAt ? " · ended " + fmtDate(j.endedAt) : ""} · ${j.endMembership ? "membership days were taken away" : "membership days were left"}`),
          j.errors.length ? table([["Player", (e) => e.username || "–"], ["Amount", (e) => (e.amount ? ils(e.amount) : "–")], ["Problem", (e) => h("span", { class: "small bad" }, e.error)],
            ["", (e) => (e.orderId ? h("button", { class: "b b-ghost b-sm", type: "button", onclick: () => orderCard(e.orderId) }, "Open") : "")]], j.errors) : null);
      };
      const load = async () => {
        clearTimeout(timer);
        const d = await payApi("/members/plan?min=" + (Number(min.value) || 0));
        const code = h("input", { type: "password", autocomplete: "off", maxlength: 200 });
        const confirm = h("input", { maxlength: 20, placeholder: "REFUND ALL", autocomplete: "off" });
        const end = h("input", { type: "checkbox", checked: true });
        const run = h("button", { class: "b b-red", type: "submit", disabled: !d.orders || d.job?.running }, `Refund ${ils(d.total)} to ${fmtNum(d.plan.length)} players`);
        const form = h("form", { class: "panel pay-run" }, h("h2", null, "Send it all back"),
          h("p", null, "Each payment is refunded on its own through Hyp, by the days left, one after another. You can leave this page while it runs."),
          h("label", { class: "chk" }, end, h("span", null, "Also take away the refunded membership days")),
          h("label", { class: "fld" }, h("span", null, "Payments code (again)"), code),
          h("label", { class: "fld" }, h("span", null, "Type REFUND ALL"), confirm), h("div", { class: "row" }, run));
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          run.disabled = true;
          try { await payApi("/members/run", { code: code.value, confirm: confirm.value, min: Number(min.value) || 0, endMembership: end.checked }); code.value = ""; toast("Started."); await load(); }
          catch (err) { oops(err); run.disabled = false; }
        });
        fill(out,
          h("div", { class: "tiles" }, tileBox(fmtNum(d.members), "members now", "#ff5fb4", "#a3226a"), tileBox(fmtNum(d.plan.length), "with paid time left", "#8a4dff", "#3a1192"),
            tileBox(fmtNum(d.orders), "payments to refund", "#1fb6ff", "#06488a"), tileBox(ils(d.total), "would go back", "#ff5a5a", "#8a1c1c")),
          d.job ? showJob(d.job) : null,
          panel("Who gets what", h("p", { class: "small muted" }, "Days left are matched to the newest paid orders first. A membership day is worth its pack's price ÷ days; days that came with a costume are worth the 1-week pack's day price. Days given by hand or by codes aren't refunded."),
            table([["Player", (p) => h("a", { href: "#player/" + p.userId }, p.username)], ["Member until", (p) => h("span", { class: "nowrap small" }, fmtDate(p.memberUntil))], ["Days left", (p) => fmtNum(p.daysLeft)],
              ["Payments", (p) => h("span", { class: "small" }, p.rows.map((r) => `${r.days}d of ${r.what} → ${ils(r.amount)}`).join(" · "))], ["Refund", (p) => h("b", null, ils(p.total))]], d.plan)),
          d.orders ? form : null);
        if (d.job?.running) timer = setTimeout(() => { if (location.hash.startsWith("#pay/members")) load().catch(oops); }, 2500);
      };
      min.onchange = () => load().catch(oops);
      box.append(panel(null, h("p", { style: "margin:0" }, "If the game ever closes: everyone with a membership gets back the money for the days they haven't used yet. Nothing is sent until you run it below."),
        h("div", { class: "tools", style: "margin:12px 0 0" }, h("label", { class: "small" }, "Skip refunds smaller than ₪ "), min)), out);
      await load();
    },

    async log(box) {
      const d = await payApi("/log");
      const NAMES = { "payments-open": "Opened payments", "payments-code-wrong": "Wrong payments code", "payments-refund": "Refund", "payments-refund-failed": "Refund failed", "payments-note": "Note", "payments-receipt": "Receipt opened",
        "payments-export": "Excel export", "payments-members-start": "Membership refund started", "payments-members-done": "Membership refund ended", "store-grant": "Given by hand" };
      box.append(panel(null, table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Who", (r) => r.admin], ["What", (r) => h("span", { class: "tag " + (/wrong|failed/.test(r.action) ? "red" : "") }, NAMES[r.action] || r.action)],
        ["Player", (r) => r.target || "–"], ["Details", (r) => h("span", { class: "small" }, r.details)], ["IP", (r) => h("span", { class: "small muted mono" }, r.ip)]], d.list)));
    },
  };

  /* ---------- views ---------- */
  const VIEWS = {
    async overview() {
      const d = await api("/overview");
      page("Overview", h("button", { class: "b b-sm b-ghost", onclick: route }, "Refresh"));
      const tile = (n, label, c, e, href) => h("a", { class: "tile", style: `--c:${c};--e:${e}`, href }, h("b", null, fmtNum(n)), h("span", null, label));
      main.append(h("div", { class: "tiles" },
        tile(d.online, "online now", "#2fd36b", "#17a24a", "#online"), tile(d.users, "players", "#1fb6ff", "#06488a", "#players"),
        tile(d.new24, "new today", "#8a4dff", "#3a1192", "#players"), tile(d.new7, "new this week", "#a77bff", "#5a22d6", "#players"),
        tile(d.banned, "banned", "#ff5a5a", "#8a1c1c", "#players/banned"), tile(d.muted, "muted", "#ff9a1f", "#a3410a", "#players/muted"),
        tile(d.chat24, "chat messages today", "#3e5b86", "#1f3355", "#chat"), tile(d.blocked24, "blocked by the filter today", "#c8263c", "#7a1020", "#chat/blocked"),
        tile(d.trades24, "trades today", "#12b8a0", "#0a8a77", "#trades"), tile(d.duels24, "games today", "#ffb21f", "#c98a00", "#duels"),
        tile(d.reportsOpen || 0, "player reports to check", "#e0262f", "#8f1218", "#reports"),
        tile(d.contactOpen, "contact messages to answer", "#ff5fb4", "#a3226a", "#contact"),
        tile(d.teamNew || 0, "new team applications", "#ff9a1f", "#a3410a", "#team")));
      const rooms = Object.entries(d.rooms || {}).map(([k, v]) => h("span", { class: "tag blue" }, `${k}: ${v}`));
      main.append(h("div", { class: "split" },
        panel("Recent admin actions", logTable(d.recent)),
        h("div", null, panel("Where players are", rooms.length ? h("div", { class: "chips" }, rooms) : h("p", { class: "muted" }, "Nobody is online right now.")),
          panel("Most coins", table([["Player", (r) => userLink(r.username, r._id)], ["Coins", (r) => fmtNum(r.coins)]], d.rich)))));
    },

    async online() {
      const d = await api("/online");
      page("Online now", h("span", { class: "muted" }, `${d.players.length} player(s)`), h("button", { class: "b b-sm b-ghost", onclick: route }, "Refresh"));
      main.append(panel(null, table([
        ["Player", (r) => h("span", null, userLink(r.username, r.userId), r.role === "admin" ? h("span", { class: "tag red", style: "margin-inline-start:6px" }, "admin") : null)],
        ["Where", (r) => where(r.where)],
        ["", (r) => r.role === "admin" ? "" : h("span", { class: "acts" },
          h("button", { class: "b b-sm b-ghost", onclick: (e) => { e.stopPropagation(); muteDialog(r.userId, r.username); } }, "Mute"),
          h("button", { class: "b b-sm b-red", onclick: (e) => { e.stopPropagation(); act(r.userId, "kick", {}, `Kick ${r.username}?`); } }, "Kick"))],
      ], d.players, (r) => (location.hash = "#player/" + r.userId))));
    },

    async players(arg) {
      const filter = arg || "";
      page("Players");
      const q = h("input", { class: "inp", type: "search", placeholder: "Search username or email…" });
      const sel = h("select", { class: "inp" }, [["", "All players"], ["online", "Online now"], ["new", "New this week"], ["banned", "Banned"], ["muted", "Muted"], ["admins", "Admins"], ["mods", "Moderators"], ["unverified", "Email not checked"], ["rich", "Most coins"]].map(([v, t]) => h("option", { value: v, selected: v === filter }, t)));
      const box = h("div");
      let pageNo = 0;
      const load = async (more) => {
        if (!more) pageNo = 0;
        const d = await api(`/users?q=${encodeURIComponent(q.value)}&filter=${sel.value}&page=${pageNo}`);
        const t = table([
          ["Player", (r) => h("b", null, r.username)], ["Email", (r) => h("span", { class: "small" }, r.email)], ["Coins", (r) => fmtNum(r.coins)],
          ["Status", (r) => h("span", { class: "chips" }, r.role === "admin" ? h("span", { class: "tag red" }, "admin") : r.role === "mod" ? h("span", { class: "tag blue" }, "moderator") : null, r.online ? h("span", { class: "tag green" }, "online") : null,
            r.bannedUntil ? h("span", { class: "tag red" }, "banned") : null, r.mutedUntil ? h("span", { class: "tag orange" }, "muted") : null,
            !r.verified ? h("span", { class: "tag orange" }, "email not checked") : null)],
          ["Joined", (r) => h("span", { class: "small nowrap" }, fmtDate(r.createdAt))], ["Last sign-in", (r) => h("span", { class: "small nowrap" }, ago(r.lastLoginAt))],
        ], d.users, (r) => (location.hash = "#player/" + r.id));
        if (!more) box.replaceChildren();
        box.append(t, h("p", { class: "muted small" }, `${fmtNum(d.total)} player(s)`));
        if (pageNo + 1 < d.pages) box.append(h("div", { class: "more" }, h("button", { class: "b b-ghost", onclick: (e) => { e.target.parentNode.remove(); pageNo++; load(true).catch(oops); } }, "Show more")));
      };
      let t = 0;
      q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => load().catch(oops), 300); });
      sel.addEventListener("change", () => load().catch(oops));
      main.append(panel(null, h("div", { class: "tools" }, q, sel), box));
      await load();
      q.focus();
    },

    async player(id) {
      const d = await api("/users/" + id), u = d.user;
      const isAdmin = u.role === "admin";
      page(u.username, h("a", { class: "b b-sm b-ghost", href: "#reports/" + id }, "Reports about this player"), h("a", { class: "b b-sm b-ghost", href: "#players" }, "← All players"));
      main.append(panel(null,
        h("div", { class: "pl-head" }, h("span", { class: "avatar", style: `--c:${SKIN[u.look?.color] || "#ff9a1f"}` }, u.username[0].toUpperCase()),
          h("div", null, h("h2", { style: "margin:0" }, u.username), h("span", { class: "chips" },
            isAdmin ? h("span", { class: "tag red" }, "admin") : u.role === "mod" ? h("span", { class: "tag blue" }, "moderator") : h("span", { class: "tag" }, "player"),
            u.online ? h("span", { class: "tag green" }, where(u.online)) : h("span", { class: "tag" }, "offline"),
            u.bannedUntil ? h("span", { class: "tag red" }, `banned · ${until(u.bannedUntil)}`) : null,
            u.mutedUntil ? h("span", { class: "tag orange" }, `muted · ${until(u.mutedUntil)}`) : null,
            !u.verified ? h("span", { class: "tag orange" }, "email not checked") : null))),
        h("dl", { class: "facts", style: "margin-top:14px" },
          [["Email", u.email], ["Coins", fmtNum(u.coins)], ["Joined", fmtDate(u.createdAt)], ["Last sign-in", fmtDate(u.lastLoginAt)],
            ["Friends", u.friends.length], ["Daily streak", u.dailyStreak], ["Furniture placed", u.homeItems], ["Terms accepted", fmtDate(u.acceptedTermsAt)],
            ["Chat messages (30 days)", u.counts.chats], ["Blocked by filter (30 days)", u.counts.blocked], ["Trades", u.counts.trades], ["Games", u.counts.duels],
            ["Ban reason", u.banReason || "—"], ...(u.role === "mod" ? [["Moderator coins left this month", `${fmtNum(u.modBudgetLeft)} / ${fmtNum(u.modBudget)}`]] : [])].map(([k, v]) => h("div", null, h("dt", null, k), h("dd", null, String(v)))))));
      // actions
      const A = (label, cls, fn) => h("button", { class: "b b-sm " + cls, onclick: fn }, label);
      const self = u.username === $("#whoName").textContent;
      const roleDialog = (make) => modal(make ? `Make ${u.username} an admin?` : `Remove admin from ${u.username}?`,
        [{ text: make ? "Admins can ban, mute, give coins and items, read private messages and see this panel. Only do this for people you fully trust." : "They become a regular player and lose every admin tool right away." },
          { name: "password", label: "Your password (to confirm it's you)", type: "password", max: 128 }],
        make ? "Make admin" : "Remove admin", (v) => act(u.id, make ? "make-admin" : "remove-admin", { password: v.password }), !make);
      main.append(panel("Actions", isAdmin ? h("p", { class: "muted" }, self ? "This is you." : "Admins can't be moderated. Remove the admin role first to ban, mute or rename them.") : null,
        h("div", { class: "acts" },
          !u.verified ? A("Mark email as checked", "b-green", () => act(u.id, "verify", {}, `Let ${u.username} log in without the email code?`)) : null,
          !self ? (isAdmin ? A("Remove admin", "b-red", () => roleDialog(false)) : A("Make admin", "b-violet", () => roleDialog(true))) : null,
          !isAdmin ? (u.role === "mod" ? A("Remove moderator", "b-ghost", () => act(u.id, "remove-mod", {}, `Make ${u.username} a regular player again? They lose the moderator tools and clothes.`))
            : A("Make moderator", "b", () => act(u.id, "make-mod", {}, `Make ${u.username} a moderator? They can kick, ban for up to 7 days, mute, and give up to 10,000 coins a month. Their name and chat turn blue.`))) : null,
          !isAdmin && u.online ? A("Kick from game", "b-red", () => act(u.id, "kick", {}, `Kick ${u.username} out of the game?`)) : null,
          !isAdmin ? (u.bannedUntil ? A("Unban", "b-green", () => act(u.id, "unban", {}, `Unban ${u.username}?`)) : A("Ban", "b-red", () => banDialog(u))) : null,
          !isAdmin ? (u.mutedUntil ? A("Unmute", "b-green", () => act(u.id, "unmute", {}, `Let ${u.username} chat again?`)) : A("Mute chat", "b-orange", () => muteDialog(u.id, u.username))) : null,
          A("Add or remove coins", "b-violet", () => modal(`Coins for ${u.username}`, [{ text: `They have ${fmtNum(u.coins)} coins. Use a minus to take coins away.` }, { name: "amount", label: "Amount", type: "number", ph: "500 or -200" }, { name: "note", label: "Note for the log (optional)" }],
            "Update coins", (v) => act(u.id, "coins", { amount: Number(v.amount), note: v.note }))),
          A("Give an item", "b", () => giveDialog(u)),
          !isAdmin ? A("Set a new password", "b-ghost", () => modal(`New password for ${u.username}`, [{ text: "They'll be signed out on every device and must use the new password." }, { name: "password", label: "New password (8+ characters)", type: "password", max: 128 }],
            "Set password", (v) => act(u.id, "password", { password: v.password }))) : null,
          !isAdmin ? A("Sign out everywhere", "b-ghost", () => act(u.id, "logout", {}, `Sign ${u.username} out on every device?`)) : null,
          !isAdmin ? A("Change username", "b-ghost", () => modal(`Rename ${u.username}`, [{ name: "username", label: "New username (3–16 letters, numbers or _)", max: 16 }], "Rename", (v) => act(u.id, "rename", { username: v.username }))) : null,
          !isAdmin ? A("Delete account", "b-red", () => modal(`Delete ${u.username}?`, [{ text: "This deletes the account, items, friends, messages and history. It can't be undone. Use it for deletion requests from players or parents." }, { name: "confirm", label: `Type ${u.username} to confirm` }, { name: "password", label: "Your password (to confirm it's you)", type: "password", max: 128 }],
            "Delete forever", async (v) => { await act(u.id, "delete", { confirm: v.confirm, password: v.password }, null, true); location.hash = "#players"; }, true)) : null)));
      // items
      main.append(panel(`Items (${u.items.reduce((n, i) => n + i.n, 0)})`, u.items.length ? h("div", { class: "chips" }, u.items.map((it) =>
        h("span", { class: "chip" }, h("span", { class: "muted small" }, it.category), it.name + (it.n > 1 ? ` ×${it.n}` : ""),
          h("button", { title: "Take one away", "aria-label": `Take ${it.name} away`, onclick: () => act(u.id, "take", { item: it.id }, `Take one ${it.name} from ${u.username}?`) }, "×")))) : h("p", { class: "muted" }, "No items.")));
      // friends + conversations
      const convo = h("div");
      main.append(h("div", { class: "split" },
        panel(`Friends (${u.friends.length})`, u.friends.length ? h("div", { class: "chips" }, u.friends.map((f) => h("span", { class: "tag blue" }, f))) : h("p", { class: "muted" }, "No friends yet."),
          u.requests.length ? h("p", { class: "small muted" }, "Waiting for an answer: " + u.requests.join(", ")) : null),
        panel("Private messages", d.conversations.length ? h("div", null,
          h("p", { class: "small muted" }, "Opening a conversation is written to the admin log."),
          h("div", { class: "chips" }, d.conversations.map((c) => h("button", { class: "b b-sm b-ghost", onclick: async () => {
            try {
              const m = await api(`/users/${u.id}/messages/${c.id}`);
              convo.replaceChildren(h("h3", { style: "margin:12px 0 8px" }, `${u.username} ↔ ${c.username}`), h("div", { class: "convo" }, m.messages.map((x) =>
                h("div", { class: "bub" + (x.from === u.username ? " me" : "") }, h("small", null, `${x.from} · ${fmtDate(x.at)}`), x.text))));
            } catch (e) { oops(e); }
          } }, `${c.username} (${c.n})`))), convo) : h("p", { class: "muted" }, "No private messages."))));
      // their history
      const hist = h("div");
      main.append(panel("History", h("div", { class: "tools" },
        h("button", { class: "b b-sm b-ghost", onclick: async () => hist.replaceChildren(chatTable((await api(`/chat?user=${encodeURIComponent(u.username)}`)).list)) }, "Chat"),
        h("button", { class: "b b-sm b-ghost", onclick: async () => hist.replaceChildren(tradeTable((await api(`/trades?user=${encodeURIComponent(u.username)}`)).list)) }, "Trades"),
        h("button", { class: "b b-sm b-ghost", onclick: async () => hist.replaceChildren(duelTable((await api(`/duels?user=${encodeURIComponent(u.username)}`)).list)) }, "Games"),
        h("button", { class: "b b-sm b-ghost", onclick: () => hist.replaceChildren(logTable(d.history)) }, "Admin actions")), hist));
      hist.replaceChildren(logTable(d.history));
    },

    async codes() {
      page("Gift codes");
      const f = {
        code: h("input", { maxlength: 20, placeholder: "Empty = a random code", autocomplete: "off", style: "text-transform:uppercase" }),
        coins: h("input", { type: "number", min: 1, max: 100000, value: 500 }),
        uses: h("select", null, [["0", "No limit"], ["1", "1 player"], ["10", "10 players"], ["50", "50 players"], ["100", "100 players"], ["500", "500 players"], ["1000", "1,000 players"]].map(([v, t]) => h("option", { value: v }, t))),
        days: h("select", null, [["0", "Never ends"], ["1", "1 day"], ["3", "3 days"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"]].map(([v, t]) => h("option", { value: v }, t))),
        note: h("input", { maxlength: 120, placeholder: "Where it's given out (only admins see this)" }),
        discord: h("input", { type: "checkbox" }),
      };
      let discordOn = false;
      const discordRow = h("label", { class: "code-discord", hidden: true }, f.discord, h("span", null, "Post in Discord"), h("small", null, "Pip posts it in #updates"));
      const made = h("div");
      const copy = (code) => navigator.clipboard?.writeText(code).then(() => toast(`Copied ${code}`), () => toast(code));
      const go = h("button", { class: "b b-orange", type: "submit" }, "Create code");
      const form = h("form", { class: "code-form" },
        h("label", { class: "fld" }, h("span", null, "Code"), f.code), h("label", { class: "fld" }, h("span", null, "Coins it gives"), f.coins),
        h("label", { class: "fld" }, h("span", null, "How many players can use it"), f.uses), h("label", { class: "fld" }, h("span", null, "Ends"), f.days),
        h("label", { class: "fld" }, h("span", null, "Note"), f.note), discordRow, go);
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); go.disabled = true;
        try {
          const r = await api("/codes", { code: f.code.value, coins: Number(f.coins.value), maxUses: Number(f.uses.value), days: Number(f.days.value), note: f.note.value, discord: discordOn && f.discord.checked });
          toast(r.message); f.code.value = ""; f.note.value = ""; f.discord.checked = false;
          made.replaceChildren(h("div", { class: "code-new" }, h("b", null, r.code.code), h("span", null, `${fmtNum(r.code.coins)} coins`), h("span", { style: "flex:1" }),
            h("button", { class: "b b-sm b-ghost", type: "button", onclick: () => copy(r.code.code) }, "Copy")));
          load();
        } catch (err) { oops(err); }
        go.disabled = false;
      });
      const list = h("div");
      const status = (c) => (!c.active ? h("span", { class: "tag red" }, "Off") : c.ended ? h("span", { class: "tag orange" }, c.maxUses && c.uses >= c.maxUses ? "Used up" : "Ended") : h("span", { class: "tag green" }, "Working"));
      const toDiscord = async (c) => {
        if (!confirm(`Post ${c.code} in the Discord #updates channel? Everyone in the server will see it.`)) return;
        try { toast((await api(`/codes/${c.id}/discord`, {})).message); } catch (e) { oops(e); }
      };
      const load = async () => { const d = await api("/codes"); discordOn = !!d.discord; discordRow.hidden = !discordOn; list.replaceChildren(table([
        ["Code", (c) => h("span", { class: "code-txt" }, c.code)], ["Coins", (c) => fmtNum(c.coins)],
        ["Used", (c) => `${fmtNum(c.uses)}${c.maxUses ? " / " + fmtNum(c.maxUses) : ""}`],
        ["Ends", (c) => h("span", { class: "nowrap small" }, c.expiresAt ? fmtDate(c.expiresAt) : "Never")], ["", status],
        ["Note", (c) => h("span", { class: "small muted" }, c.note || "")], ["Made by", (c) => h("span", { class: "small" }, c.createdBy, h("br"), h("span", { class: "muted" }, fmtDate(c.createdAt)))],
        ["", (c) => h("div", { class: "acts" },
          h("button", { class: "b b-sm b-ghost", onclick: () => copy(c.code) }, "Copy"),
          h("button", { class: "b b-sm b-ghost", onclick: () => usesOf(c).catch(oops) }, "Who used it"),
          discordOn && c.active && !c.ended ? h("button", { class: "b b-sm b-ghost", onclick: () => toDiscord(c) }, "Post in Discord") : null,
          h("button", { class: "b b-sm " + (c.active ? "b-red" : "b-green"), onclick: async () => {
            if (c.active && !confirm(`Switch off ${c.code}? Players won't be able to use it any more.`)) return;
            try { toast((await api("/codes/" + c.id, { active: !c.active })).message); load(); } catch (e) { oops(e); }
          } }, c.active ? "Switch off" : "Switch on"))],
      ], d.list)); };
      async function usesOf(c) {
        const d = await api(`/codes/${c.id}/uses`), card = $("#modalCard");
        card.replaceChildren(h("h2", null, c.code), h("p", { class: "muted", style: "margin:0" }, `${fmtNum(c.uses)} player(s) used it · ${fmtNum(c.coins)} coins each`),
          h("div", { class: "code-uses" }, table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Player", (r) => userLink(r.username, r.userId)], ["Coins", (r) => fmtNum(r.coins)]], d.list)),
          h("div", { class: "row" }, h("button", { class: "b b-ghost", type: "button", onclick: () => ($("#modal").hidden = true) }, "Close")));
        $("#modal").hidden = false;
      }
      main.append(panel("Make a new code", h("p", { class: "small muted", style: "margin:0 0 12px" }, "Players type the code on the sign in the game's start screen (the Codes button). Every player can use a code once. Letters and numbers only; spaces and dashes are ignored."), form, made),
        panel("All codes", list));
      await load();
    },

    // the poll on the home page: this week's question and the answers so far (older weeks aren't kept)
    async poll() {
      const d = await api("/poll");
      page("Weekly poll", h("span", { class: "muted" }, `${d.week} · a new question on ${fmtDate(d.endsAt)}`), h("button", { class: "b b-sm b-ghost", onclick: route }, "Refresh"));
      const top = Math.max(1, ...d.counts);
      const rows = d.options.map((o, i) => {
        const n = d.counts[i], pct = d.total ? Math.round((n / d.total) * 100) : 0;
        return h("div", { class: "pl-row" + (n === top && n ? " top" : "") },
          h("div", { class: "pl-txt" }, h("b", null, o.en), h("span", { dir: "rtl" }, o.he)),
          h("div", { class: "pl-bar" }, h("i", { style: `width:${d.total ? (n / top) * 100 : 0}%` })),
          h("div", { class: "pl-n" }, h("b", null, fmtNum(n)), h("span", null, `${pct}%`)));
      });
      main.append(panel(null,
        h("div", { class: "pl-q" }, h("h3", null, d.question.en), h("p", { dir: "rtl" }, d.question.he), h("span", { class: "tag blue" }, `${fmtNum(d.total)} vote${d.total === 1 ? "" : "s"}`)),
        h("div", { class: "pl-list" }, rows),
        h("p", { class: "muted small" }, "Players vote once a week (by account, or by browser for visitors). The question changes by itself every Sunday; votes are kept for 8 weeks, and only this week is shown here.")));
    },

    async events() {
      page("Events");
      const box = h("div", { class: "ev-grid" });
      const ART = {
        "": '<svg viewBox="0 0 120 120"><circle cx="60" cy="58" r="30" fill="#ffd23a"/><g stroke="#ffd23a" stroke-width="7" stroke-linecap="round">' +
          [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 60 58)" d="M60 14v10"/>`).join("") + "</g></svg>",
        halloween: '<svg viewBox="0 0 120 120"><path d="M60 30c-2-8 2-14 8-16-2 5-1 10 2 14" fill="#3f8a2a"/><ellipse cx="42" cy="70" rx="24" ry="30" fill="#e8700f"/><ellipse cx="78" cy="70" rx="24" ry="30" fill="#e8700f"/>' +
          '<ellipse cx="60" cy="70" rx="26" ry="32" fill="#ff8a1c"/><path d="M42 60l8 8h-16zM78 60l8 8h-16z" fill="#ffd23a"/><path d="M38 82q22 16 44 0l-6 2-4 5-5-5-6 6-6-6-5 5-4-5z" fill="#ffd23a"/></svg>',
      };
      const load = async () => {
        const d = await api("/event");
        const cards = [{ id: "", name: "Normal game", about: "Jumpi as usual: no holiday decorations and no event shop." }, ...d.list];
        box.replaceChildren(...cards.map((e) => {
          const on = (d.event || "") === e.id, card = h("div", { class: `ev-card ${e.id}${on ? " on" : ""}` });
          card.innerHTML = ART[e.id] || "";
          card.firstChild && card.firstChild.setAttribute("class", "ev-art");
          card.append(h("h3", null, e.name), h("p", null, e.about),
            e.items ? h("span", { class: "ev-meta" }, `${fmtNum(e.items)} items in its shop`) : null,
            on ? h("span", { class: "ev-state" }, h("i", null, "✓"), e.id ? "On now" + (d.since ? ` · since ${fmtDate(d.since)}` : "") : "On now")
              : h("button", { class: "b ev-go " + (e.id ? "b-orange" : "b-ghost"), type: "button", onclick: async (ev) => {
                  if (!confirm(e.id ? `Switch on ${e.name}? Every game will decorate itself right away and its shop opens.` : "Go back to the normal game? The decorations go away and the event shop closes (players keep what they bought).")) return;
                  ev.currentTarget.disabled = true;
                  try { toast((await api("/event", { event: e.id })).message); } catch (err) { oops(err); }
                  load();
                } }, e.id ? `Switch on ${e.name}` : "Back to normal"));
          return card;
        }));
      };
      main.append(panel("Holiday events", h("p", { class: "ev-how" }, "Switch on an event and every game changes at once: the world gets its decorations and its shop opens in the Plaza. Back to normal takes it all away, and the server stops selling the event items. Players keep everything they already bought."), h("div", { style: "height:14px" }), box));
      await load();
    },

    async announce() {
      page("Announcements");
      const ta = h("textarea", { class: "inp", maxlength: 160, placeholder: "Write a message everyone in the game will see on their screen…" });
      const pv = h("div", { class: "preview" }, h("small", null, "Announcement from an admin"), h("span", null, "Your message will look like this."));
      const cnt = h("span", { class: "muted small" }, "0/160");
      ta.addEventListener("input", () => { pv.lastChild.textContent = ta.value || "Your message will look like this."; cnt.textContent = `${ta.value.length}/160`; });
      const list = h("div");
      main.append(panel("Send to everyone in the game", h("div", { class: "ann" }, ta, h("div", { class: "tools" }, cnt, h("span", { class: "sp", style: "flex:1" }),
        h("button", { class: "b b-orange", onclick: async () => {
          if (!ta.value.trim()) return toast("Write a message first.", true);
          if (!confirm("Send this to every player online now?")) return;
          try { const r = await api("/announce", { text: ta.value }); toast(r.message); ta.value = ""; ta.dispatchEvent(new Event("input")); loadList(); } catch (e) { oops(e); }
        } }, "Send now")), h("p", { class: "small muted" }, "Preview"), pv)), panel("Sent before", list));
      const loadList = async () => list.replaceChildren(table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Admin", (r) => r.admin], ["Message", (r) => r.details]], (await api("/announcements")).list));
      await loadList();
    },

    chat: (arg) => historyView("Chat history", "/chat", chatTable, { rooms: true, text: true, blocked: arg === "blocked" }),
    trades: () => historyView("Trades", "/trades", tradeTable, {}),
    duels: () => historyView("Games", "/duels", duelTable, {}),
    log: () => historyView("Admin log", "/logs", logTable, {}),

    // the anonymous daily report from the game: frames a second and stutters per kind of device (last 14 days)
    async perf() {
      const d = await api("/perf");
      page("Performance", h("button", { class: "b b-sm b-ghost", onclick: route }, "Refresh"));
      const DEV = { "web-computer": "Website, computer", "web-phone": "Website, phone", "android-app": "Android app", "computer-app": "Computer program" };
      const fpsTag = (f) => h("span", { class: "tag " + (f >= 50 ? "green" : f >= 30 ? "orange" : "red") }, f.toLocaleString("en-US"));
      main.append(h("p", { class: "muted" }, "Sent by the game every few minutes of play, without any player names. Graphics: what the game guessed for the device (low / mid / high). Slow = share of play time under 30 frames a second. Stutters = frames that took longer than 0.1 s, per minute of play."),
        panel(null, table([["Day", (r) => r.day], ["Device", (r) => DEV[r.device] || r.device], ["Graphics", (r) => r.tier], ["Reports", (r) => fmtNum(r.reports)],
          ["Minutes", (r) => fmtNum(r.minutes)], ["Frames / s", (r) => fpsTag(r.fps)], ["Slow", (r) => r.slow + "%"], ["Stutters / min", (r) => r.stutters]], d.rows)));
    },

    async items() {
      const d = await api("/items");
      page("All items", h("span", { class: "muted" }, `${d.items.length} items`));
      const cats = [...new Set(d.items.map((i) => i.category))];
      const sel = h("select", { class: "inp" }, h("option", { value: "" }, "All categories"), cats.map((c) => h("option", { value: c }, c)));
      const q = h("input", { class: "inp", type: "search", placeholder: "Search items…" });
      const box = h("div");
      const draw = () => box.replaceChildren(table([
        ["Item", (r) => h("b", null, r.name)], ["Id", (r) => h("span", { class: "mono" }, r.id)], ["Category", (r) => r.category],
        ["Price", (r) => (r.free ? "free" : fmtNum(r.price))], ["Rarity", (r) => (r.rarity ? h("span", { class: "tag violet" }, r.rarity) : r.starter ? h("span", { class: "tag" }, "starter") : "")],
        ["Owners", (r) => fmtNum(r.owners)], ["Copies", (r) => fmtNum(r.copies)],
      ], d.items.filter((i) => (!sel.value || i.category === sel.value) && (!q.value || i.name.toLowerCase().includes(q.value.toLowerCase()) || i.id.includes(q.value)))));
      sel.onchange = draw; q.oninput = draw;
      main.append(panel(null, h("div", { class: "tools" }, q, sel), box));
      draw();
    },

    /* ---------- player reports from the game (routes/social.js → models/Report.js) ---------- */
    async reports(arg) {
      const REASON = { grooming: "Asked to meet / for photos / personal details", sexual: "Sexual or inappropriate talk", bullying: "Bullying or harassment", language: "Bad language or hate", scam: "Scam or stealing items", other: "Something else", flagged: "Flagged by the chat filter (worth a look)" };
      const WHERE = { card: "player card", chat: "JumpiChat", friends: "Friends app", filter: "chat filter" };
      page("Player reports", h("button", { class: "b b-sm b-ghost", onclick: () => load().catch(oops) }, "Refresh"));
      const sel = h("select", { class: "inp" }, [["", "To check"], ["done", "Checked"], ["all", "All"]].map(([v, t]) => h("option", { value: v }, t)));
      const box = h("div");
      const load = async () => {
        const d = await api("/reports?show=" + sel.value + (arg ? "&user=" + encodeURIComponent(arg) : ""));
        box.replaceChildren(d.list.length ? h("div", null, d.list.map((r) => {
          const note = h("input", { class: "inp", placeholder: "Note (what you did)", maxlength: 500, value: r.note || "", style: "flex:1;min-width:160px" });
          return panel(null, h("div", { class: "rp-card" + (r.urgent && r.status === "open" ? " urgent" : "") + (r.status === "done" ? " done" : "") },
            h("div", { class: "tools" },
              h("span", { class: "tag " + (r.urgent ? "red" : "orange") }, REASON[r.reason] || r.reason),
              h("b", null, userLink(r.target, r.targetId)), h("span", { class: "muted small" }, "reported by"), userLink(r.from, r.fromId),
              h("span", { class: "tag" }, WHERE[r.where] || r.where), r.room ? h("span", { class: "tag blue" }, r.room) : null,
              r.times.n > 1 ? h("span", { class: "tag violet" }, `reported ${r.times.n}× by ${r.times.people} player${r.times.people === 1 ? "" : "s"}`) : null,
              h("span", { class: "muted small" }, fmtDate(r.at))),
            r.details ? h("p", { class: "rp-details", dir: "auto" }, r.details) : null,
            r.context.length ? h("div", { class: "rp-ctx" }, r.context.map((c) => h("p", { class: c.from === r.target ? "tgt" : "", dir: "auto" }, h("small", null, `${fmtDate(c.at)} · ${c.room === "dm" ? "private" : c.room}`), h("b", null, c.from + ": "), c.text)))
              : h("p", { class: "muted small" }, "No chat saved with this report."),
            h("div", { class: "tools", style: "margin-top:8px" }, note,
              h("a", { class: "b b-sm b-ghost", href: "#player/" + r.targetId }, "Open player (mute / ban)"),
              h("button", { class: "b b-sm " + (r.status === "done" ? "b-ghost" : "b-green"), onclick: async () => { try { await api("/reports/" + r._id, { status: r.status === "done" ? "open" : "done", note: note.value }); load(); refreshCounts(); } catch (e) { oops(e); } } }, r.status === "done" ? "Open again" : "Mark as checked")),
            r.handledBy ? h("p", { class: "muted small" }, "Checked by " + r.handledBy) : null));
        })) : h("p", { class: "empty" }, "No reports here."));
      };
      sel.onchange = () => load().catch(oops);
      main.append(h("div", { class: "tools" }, sel, arg ? h("a", { class: "b b-sm b-ghost", href: "#reports" }, "All players") : null), box);
      await load();
    },

    async contact() {
      page("Contact messages");
      const sel = h("select", { class: "inp" }, h("option", { value: "" }, "Waiting for an answer"), h("option", { value: "all" }, "All messages"));
      const box = h("div");
      const load = async () => {
        const d = await api("/contact?show=" + sel.value);
        box.replaceChildren(d.list.length ? h("div", null, d.list.map((m) => panel(null,
          h("div", { class: "tools" }, h("span", { class: "tag blue" }, m.topic), h("b", null, m.name || "(no name)"), h("a", { href: "mailto:" + m.email }, m.email),
            m.username ? h("span", { class: "tag" }, "player: " + m.username) : null, h("span", { class: "muted small" }, fmtDate(m.createdAt)), h("span", { style: "flex:1" }),
            h("button", { class: "b b-sm b-orange", onclick: () => replyLetter(m, load).catch(oops) }, (m.replies || []).length ? "Reply again" : "Reply"),
            h("button", { class: "b b-sm " + (m.handled ? "b-ghost" : "b-green"), onclick: async () => { try { await api("/contact/" + m._id, { handled: !m.handled }); load(); refreshCounts(); } catch (e) { oops(e); } } }, m.handled ? "Mark as open" : "Mark as answered")),
          h("p", { style: "white-space:pre-wrap;margin:6px 0 0" }, m.message),
          (m.replies || []).map((r) => h("div", { class: "reply-done" }, h("small", null, `Answered by ${r.admin} · ${fmtDate(r.at)}`), h("p", null, r.text)))))) : h("p", { class: "empty" }, "No messages waiting."));
      };
      sel.onchange = () => load().catch(oops);
      main.append(h("div", { class: "tools" }, sel), box);
      await load();
    },
    /* ---------- applications from the /team page (routes/team.js) ---------- */
    async team(arg) {
      const ROLE = { manager: ["Community Manager", "#e0262f", "#8f1218"], guide: ["Guide (moderator)", "#1f5fe0", "#123a99"], beta: ["Beta Tester", "#8a4dff", "#3a1192"] };
      const STATUS = { new: ["New", "orange"], reviewing: ["Reviewing", "blue"], accepted: ["Accepted", "green"], declined: ["Declined", ""] };
      const LANGS = { he: "Hebrew", en: "English", ar: "Arabic", ru: "Russian", fr: "French", es: "Spanish", other: "Other" };
      const DEV = { android: "Android", iphone: "iPhone", pc: "Windows", mac: "Mac", tablet: "Tablet" };
      page("Team applications", h("a", { class: "b b-sm b-ghost", href: "/team", target: "_blank", rel: "noopener" }, "Open the page"), h("button", { class: "b b-sm b-ghost", onclick: () => load().catch(oops) }, "Refresh"));
      const status = h("select", { class: "inp" }, [["open", "Waiting (new + reviewing)"], ["new", "New"], ["reviewing", "Reviewing"], ["accepted", "Accepted"], ["declined", "Declined"], ["all", "All"]].map(([v, t]) => h("option", { value: v }, t)));
      const role = h("select", { class: "inp" }, [["", "Every role"], ...Object.entries(ROLE).map(([k, v]) => [k, v[0]])].map(([v, t]) => h("option", { value: v }, t)));
      if (ROLE[arg]) role.value = arg;
      const q = h("input", { class: "inp", type: "search", placeholder: "Name, email, username…", maxlength: 60 });
      const tiles = h("div", { class: "tiles" }), box = h("div");
      const qa = (title, text) => (text ? h("div", { class: "tm-qa" }, h("b", null, title), h("p", { dir: "auto" }, text)) : null);
      function card(a) {
        const [rn, rc, re] = ROLE[a.role] || [a.role, "#3e5b86", "#1f3355"], [sn, sc] = STATUS[a.status] || [a.status, ""];
        const set = async (st) => { try { toast((await api("/team/" + a._id, { status: st })).message); load(); refreshCounts(); } catch (e) { oops(e); } };
        const note = h("input", { class: "inp", maxlength: 1000, placeholder: "Add a note for the team (only admins see it)…" });
        const facts = [["Age", h("span", null, String(a.age), a.age < 18 ? h("span", { class: "tag red", style: "margin-inline-start:6px" }, a.parentOk ? "under 18 · parent approved" : "under 18") : null)],
          ["Email", h("a", { href: "mailto:" + a.email }, a.email)], ["Country", a.country || "—"], ["Languages", (a.languages || []).map((l) => LANGS[l] || l).join(", ") || "—"],
          ["Time a week", a.hours ? a.hours + " hours" : "—"], a.role === "beta" ? ["Devices", (a.devices || []).map((d) => DEV[d] || d).join(", ") || "—"] : null,
          ["Jumpi username", a.username || "—"], ["Signed in as", a.account || "not signed in"], ["Discord", a.discord || "—"],
          ["Link", a.link && /^https?:\/\//i.test(a.link) ? h("a", { href: a.link, target: "_blank", rel: "noopener noreferrer nofollow" }, a.link) : "—"],
          ["Page language", a.lang === "he" ? "Hebrew" : "English"]].filter(Boolean);
        return h("section", { class: "panel tm-app", style: `--c:${rc};--e:${re}` },
          h("div", { class: "tm-app-head" },
            h("span", { class: "tm-role" }, rn), h("h2", null, a.name), h("span", { class: "tag " + sc }, sn),
            h("span", { class: "muted small" }, fmtDate(a.createdAt) + (a.statusBy ? ` · last change by ${a.statusBy}` : "")), h("span", { style: "flex:1" }),
            h("div", { class: "acts" },
              a.status !== "reviewing" ? h("button", { class: "b b-sm", onclick: () => set("reviewing") }, "Reviewing") : null,
              a.status !== "accepted" ? h("button", { class: "b b-sm b-green", onclick: () => teamLetter(a, "accepted", rn, () => { load(); refreshCounts(); }).catch(oops) }, "Accept") : null,
              a.status !== "declined" ? h("button", { class: "b b-sm b-ghost", onclick: () => teamLetter(a, "declined", rn, () => { load(); refreshCounts(); }).catch(oops) }, "Decline") : null,
              a.status !== "new" ? h("button", { class: "b b-sm b-ghost", onclick: () => set("new") }, "Back to new") : null,
              h("button", { class: "b b-sm b-red", onclick: async () => {
                if (!confirm(`Delete ${a.name}'s application for good? This can't be undone.`)) return;
                try { toast((await api("/team/" + a._id, { delete: true })).message); load(); refreshCounts(); } catch (e) { oops(e); }
              } }, "Delete"))),
          h("dl", { class: "facts" }, facts.map(([k, v]) => h("div", null, h("dt", null, k), h("dd", null, v)))),
          (a.mails || []).length ? h("p", { class: "small muted", style: "margin:0 0 10px" }, (a.mails || []).map((m) => `${m.kind === "accepted" ? "Acceptance" : "Decline"} email sent by ${m.admin} · ${fmtDate(m.at)}`).join("  ·  ")) : null,
          h("div", { class: "tm-qas" }, qa("Why they want to join", a.why), qa(a.role === "beta" ? "Testing before" : "Experience", a.about), qa("A player keeps being mean to a younger kid. What do you do?", a.scenario)),
          h("div", { class: "tm-notes" },
            (a.notes || []).map((n) => h("div", { class: "reply-done" }, h("small", null, `${n.admin} · ${fmtDate(n.at)}`), h("p", { dir: "auto" }, n.text))),
            h("form", { class: "tools", style: "margin:10px 0 0", onsubmit: async (e) => {
              e.preventDefault(); if (!note.value.trim()) return;
              try { toast((await api("/team/" + a._id, { note: note.value })).message); load(); } catch (err) { oops(err); }
            } }, note, h("button", { class: "b b-sm b-ghost", type: "submit" }, "Save note"))));
      }
      async function load() {
        const d = await api(`/team?status=${status.value}&role=${role.value}&q=${encodeURIComponent(q.value.trim())}`);
        const n = (r, st) => d.counts.filter((c) => c.role === r && (!st || st.includes(c.status))).reduce((s, c) => s + c.n, 0);
        tiles.replaceChildren(...Object.entries(ROLE).map(([k, [name, c, e]]) => h("a", { class: "tile", style: `--c:${c};--e:${e};cursor:pointer`, href: "#team/" + k, onclick: (ev) => { ev.preventDefault(); role.value = role.value === k ? "" : k; load().catch(oops); } },
          h("b", null, fmtNum(n(k, ["new"]))), h("span", null, `new · ${name}`), h("span", { class: "small", style: "opacity:.8" }, `${fmtNum(n(k, ["reviewing"]))} reviewing · ${fmtNum(n(k, ["accepted"]))} accepted · ${fmtNum(n(k))} in total`))));
        box.replaceChildren(...(d.list.length ? d.list.map(card) : [h("p", { class: "empty" }, "No applications here yet.")]));
      }
      status.onchange = role.onchange = () => load().catch(oops);
      q.addEventListener("input", () => { clearTimeout(q.t); q.t = setTimeout(() => load().catch(oops), 300); });
      main.append(tiles, h("div", { class: "tools" }, status, role, q), box);
      await load();
    },
    /* ---------- payments (one more code: PAYMENTS_CODE on the server) ---------- */
    async pay(arg) {
      const tab = ["overview", "tx", "members", "log"].includes(arg) ? arg : "overview";
      const s = await payApi("/session").catch((e) => { if (e.payLocked) return { codeSet: true, open: false }; throw e; });
      if (!s.codeSet) {
        page("Payments");
        main.append(panel("The payments code isn't set yet",
          h("p", null, "The payments panel opens with its own code, on top of your password. Add this line to the server's .env file (at least 6 characters, only you know it), then restart the server:"),
          h("pre", { class: "mono pay-pre" }, "PAYMENTS_CODE=your-code-here"),
          h("p", { class: "muted small" }, "Don't send the code in chat or email. If you change it, every open payments session closes.")));
        return;
      }
      if (!s.open) return payGate();
      const lockBtn = h("button", { class: "b b-sm b-ghost", type: "button", onclick: async () => { try { await payApi("/lock", {}); } catch {} payGate(); } }, "Lock payments");
      page("Payments", lockBtn);
      const tabs = [["overview", "Overview"], ["tx", "Transactions"], ["members", "Membership refunds"], ["log", "Money log"]];
      main.append(h("nav", { class: "pay-tabs" }, tabs.map(([k, t]) => h("a", { href: "#pay/" + k, class: k === tab ? "on" : null }, t))));
      const box = h("div");
      main.append(box);
      await PAY[tab](box);
    },
  };
  VIEWS.studio = studio;   // (the Item studio, below)


  /* ---------- answer a Contact message: the real email, with the answer typed right inside the letter ---------- */
  async function replyLetter(m, after) {
    const d = await api(`/contact/${m._id}/letter`), card = $("#modalCard");
    const he = d.lang === "he";
    const frame = h("iframe", { class: "letter-frame", title: "The answer email" });
    const send = h("button", { class: "b b-orange", type: "button" }, "Send answer");
    const note = h("span", { class: "small muted" }, `To ${d.email} · in ${he ? "Hebrew" : "English"} (the language they wrote in)`);
    card.replaceChildren(...[h("h2", null, `Answer ${m.name || m.email}`), note, frame,
      d.emailOn ? null : h("p", { class: "bad small", style: "margin:0" }, "Email isn't set up on the server (RESEND_API_KEY), so it can't be sent yet."),
      h("div", { class: "row" }, h("button", { class: "b b-ghost", type: "button", onclick: close }, "Cancel"), send)].filter(Boolean));
    card.classList.add("wide");
    $("#modal").hidden = false;
    // the letter, with a text box where the answer goes
    const box = `<textarea id="ans" dir="${he ? "rtl" : "ltr"}" placeholder="${he ? "כתבו כאן את התשובה…" : "Write your answer here…"}"></textarea>`;
    const css = `<style>#ans{display:block;width:100%;box-sizing:border-box;min-height:140px;border:2px dashed #ffc98a;border-radius:14px;background:#fffaf0;padding:12px 14px;
      font:inherit;font-size:17px;line-height:28px;color:#33456e;resize:none;overflow:hidden;outline:0}#ans:focus{border-color:#ff9a1f;background:#fff}a{pointer-events:none}</style>`;
    frame.srcdoc = d.html.replace(d.slot, box).replace("</head>", css + "</head>");
    let ans = null;
    const fit = () => { const doc = frame.contentDocument; if (!doc) return; if (ans) { ans.style.height = "auto"; ans.style.height = ans.scrollHeight + 4 + "px"; } frame.style.height = doc.documentElement.scrollHeight + "px"; };
    frame.onload = () => { ans = frame.contentDocument.getElementById("ans"); ans.addEventListener("input", fit); fit(); setTimeout(fit, 400); ans.focus(); };
    send.onclick = async () => {
      const text = ans ? ans.value.trim() : "";
      if (text.length < 2) return toast("Write your answer inside the letter first.", true);
      if (!confirm(`Send this answer to ${d.email}?`)) return;
      send.disabled = true;
      try { toast((await api(`/contact/${m._id}/reply`, { text })).message); close(); after(); refreshCounts(); } catch (e) { oops(e); }
      send.disabled = false;
    };
    function close() { $("#modal").hidden = true; card.classList.remove("wide"); }
  }

  /* ---------- accept / decline a team application: the real email with a ready text inside; sending it is optional ---------- */
  async function teamLetter(a, decision, roleName, after) {
    const d = await api(`/team/${a._id}/letter?decision=${decision}`), card = $("#modalCard");
    const he = d.lang === "he", yes = decision === "accepted";
    const frame = h("iframe", { class: "letter-frame", title: "The email" });
    const send = h("button", { class: "b " + (yes ? "b-green" : "b-orange"), type: "button", disabled: !d.emailOn }, yes ? "Accept + send email" : "Decline + send email");
    const quiet = h("button", { class: "b b-ghost", type: "button" }, yes ? "Accept without email" : "Decline without email");
    const reset = h("button", { class: "b b-sm b-ghost", type: "button" }, "Back to the ready text");
    card.replaceChildren(...[h("h2", null, `${yes ? "Accept" : "Decline"} ${a.name} · ${roleName}`),
      h("span", { class: "small muted" }, `To ${d.email} · in ${he ? "Hebrew" : "English"} (the language they applied in) · subject: “${d.subject}”. You can change the text inside the letter. Sending the email is up to you.`),
      frame,
      d.emailOn ? null : h("p", { class: "bad small", style: "margin:0" }, "Email isn't set up on the server (RESEND_API_KEY), so you can only mark it for now."),
      h("div", { class: "row" }, reset, h("span", { style: "flex:1" }), h("button", { class: "b b-ghost", type: "button", onclick: close }, "Cancel"), quiet, send)].filter(Boolean));
    card.classList.add("wide");
    $("#modal").hidden = false;
    const box = `<textarea id="ans" dir="${he ? "rtl" : "ltr"}"></textarea>`;
    const css = `<style>#ans{display:block;width:100%;box-sizing:border-box;min-height:140px;border:2px dashed #ffc98a;border-radius:14px;background:#fffaf0;padding:12px 14px;
      font:inherit;font-size:17px;line-height:28px;color:#33456e;resize:none;overflow:hidden;outline:0}#ans:focus{border-color:#ff9a1f;background:#fff}a{pointer-events:none}</style>`;
    frame.srcdoc = d.html.replace(d.slot, box).replace("</head>", css + "</head>");
    let ans = null;
    const fit = () => { const doc = frame.contentDocument; if (!doc) return; if (ans) { ans.style.height = "auto"; ans.style.height = ans.scrollHeight + 4 + "px"; } frame.style.height = doc.documentElement.scrollHeight + "px"; };
    frame.onload = () => { ans = frame.contentDocument.getElementById("ans"); ans.value = d.text; ans.addEventListener("input", fit); fit(); setTimeout(fit, 400); };
    reset.onclick = () => { if (ans) { ans.value = d.text; fit(); } };
    const go = async (withMail) => {
      const body = { status: decision };
      if (withMail) {
        const text = ans ? ans.value.trim() : "";
        if (text.length < 2) return toast("Write the email inside the letter first.", true);
        if (!confirm(`${yes ? "Accept" : "Decline"} and send this email to ${d.email}?`)) return;
        body.mail = text;
      }
      send.disabled = quiet.disabled = true;
      try { toast((await api("/team/" + a._id, body)).message); close(); after(); } catch (e) { oops(e); }
      send.disabled = !d.emailOn; quiet.disabled = false;
    };
    send.onclick = () => go(true);
    quiet.onclick = () => go(false);
    function close() { $("#modal").hidden = true; card.classList.remove("wide"); }
  }

  /* ---------- history tables ---------- */
  const chatTable = (list) => table([
    ["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Player", (r) => userLink(r.username, r.userId)],
    ["Where", (r) => h("span", { class: "small" }, r.room.startsWith("dm:") ? "private to " + r.room.slice(3) : r.room.startsWith("home:") ? r.room.slice(5) + "'s home" : r.room)],
    ["Message", (r) => h("span", { class: r.blocked ? "bad" : "" }, r.blocked ? "🚫 " : "", r.text)],
  ], list);
  const items = (s) => h("span", null, h("b", null, userLink(s.username, s.userId)), h("br"), h("span", { class: "small muted" }, (s.names || s.items).join(", ") || "nothing"));
  const tradeTable = (list) => table([["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Gave", (r) => items(r.a)], ["Gave back", (r) => items(r.b)]], list);
  const duelTable = (list) => table([
    ["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Game", (r) => r.game],
    ["Players", (r) => h("span", null, r.players.map((p, i) => [i ? " vs " : "", userLink(p.username, p.userId)]))],
    ["Result", (r) => (r.winner ? h("span", null, h("b", null, r.winner), " won 200 coins") : "Draw")], ["Why", (r) => h("span", { class: "small muted" }, r.reason)],
  ], list);
  const ACT_NAME = { kick: "Kicked", ban: "Banned", unban: "Unbanned", mute: "Muted", unmute: "Unmuted", coins: "Coins", password: "Password reset", logout: "Signed out everywhere", rename: "Renamed",
    "give-item": "Gave item", "take-item": "Took item", "delete-account": "Deleted account", announce: "Announcement", event: "Holiday event", unlock: "Opened the panel", "unlock-failed": "Wrong panel password",
    "read-messages": "Read private messages", "contact-done": "Answered contact message", "report-done": "Checked a player report", "report-reopen": "Reopened a player report", "contact-reopen": "Reopened contact message", "code-create": "Made a gift code", "contact-reply": "Answered contact message by email", "verify-email": "Checked email by hand", "make-admin": "Made admin", "remove-admin": "Removed admin", "make-mod": "Made moderator", "remove-mod": "Removed moderator", "code-off": "Switched off a code", "code-on": "Switched on a code", "team-status": "Team application", "team-mail": "Emailed a team application", "team-note": "Note on a team application", "team-delete": "Deleted a team application" };
  const logTable = (list) => table([
    ["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.at))], ["Admin", (r) => r.admin],
    ["Action", (r) => h("span", { class: "tag " + (/ban|kick|delete|failed/.test(r.action) && r.action !== "unban" ? "red" : /mute/.test(r.action) && r.action !== "unmute" ? "orange" : "blue") }, ACT_NAME[r.action] || r.action)],
    ["Player", (r) => (r.target ? userLink(r.target, r.targetId) : "")], ["Details", (r) => h("span", { class: "small" }, r.details)], ["From", (r) => h("span", { class: "small muted" }, r.via === "game" ? "in game" : "panel")],
  ], list);

  async function historyView(title, path, render, opt) {
    page(title);
    const user = h("input", { class: "inp", type: "search", placeholder: "Filter by username…" });
    const text = opt.text ? h("input", { class: "inp", type: "search", placeholder: "Search words…" }) : null;
    const room = opt.rooms ? h("select", { class: "inp" }, [["", "Everywhere"], ["plaza", "Plaza"], ["homes", "Homes"], ["dm", "Private (blocked only)"]].map(([v, t]) => h("option", { value: v }, t))) : null;
    const blocked = opt.rooms ? h("label", { class: "small", style: "display:flex;gap:6px;align-items:center" }, h("input", { type: "checkbox", checked: opt.blocked }), "Blocked by filter only") : null;
    const box = h("div");
    let last = null;
    const load = async (more) => {
      const qs = new URLSearchParams({ user: user.value.trim() });
      if (text && text.value.trim()) qs.set("q", text.value.trim());
      if (room && room.value) qs.set("room", room.value);
      if (blocked && blocked.firstChild.checked) qs.set("blocked", "1");
      if (more && last) qs.set("before", new Date(last).getTime());
      const d = await api(path + "?" + qs);
      if (!more) box.replaceChildren();
      box.append(render(d.list));
      last = d.list.length ? d.list[d.list.length - 1].at : null;
      if (d.list.length === 100) box.append(h("div", { class: "more" }, h("button", { class: "b b-ghost", onclick: (e) => { e.target.parentNode.remove(); load(true).catch(oops); } }, "Show older")));
    };
    let t = 0;
    const later = () => { clearTimeout(t); t = setTimeout(() => load().catch(oops), 350); };
    [user, text].forEach((x) => x && x.addEventListener("input", later));
    [room, blocked].forEach((x) => x && x.addEventListener("change", () => load().catch(oops)));
    main.append(panel(null, h("div", { class: "tools" }, user, text, room, blocked), opt.rooms ? h("p", { class: "small muted" }, "Chat is kept for 30 days. Private messages that went through are in each player's page.") : null, box));
    await load();
  }

  /* ---------- actions ---------- */
  async function act(id, action, body, question, quietAfter) {
    if (question && !confirm(question)) return;
    const r = await api(`/users/${id}/${action}`, body);
    toast(r.message);
    if (!quietAfter) route();
  }
  function banDialog(u) {
    modal(`Ban ${u.username}`, [{ name: "minutes", label: "How long", options: [["60", "1 hour"], ["1440", "1 day"], ["10080", "7 days"], ["43200", "30 days"], ["0", "Forever"]] }, { name: "reason", label: "Reason (the player sees it)", max: 120 }],
      "Ban", (v) => act(u.id, "ban", { minutes: Number(v.minutes), reason: v.reason }), true);
  }
  function muteDialog(id, name) {
    modal(`Mute ${name}`, [{ name: "minutes", label: "How long", options: [["5", "5 minutes"], ["15", "15 minutes"], ["60", "1 hour"], ["1440", "1 day"], ["10080", "7 days"]] }],
      "Mute", (v) => act(id, "mute", { minutes: Number(v.minutes) }));
  }
  let itemCache = null;
  async function giveDialog(u) {
    if (!itemCache) itemCache = (await api("/items")).items;
    modal(`Give an item to ${u.username}`, [{ name: "item", label: "Item", options: itemCache.map((i) => [i.id, `${i.category} · ${i.name}${i.rarity ? " (" + i.rarity + ")" : ""}`]) }],
      "Give", (v) => act(u.id, "give", { item: v.item }));
  }

  /* ---------- Item studio: every item, where it sits on the character, and new items from existing looks ----------
     The 3D view is the game itself in a frame (/play?game&itemlab: public/world/item-lab.js); the server side is
     routes/items.js. Moving an item changes it for everyone (the next time they open the game). */
  const ST = { data: null, slot: "neck", sel: null, q: "", filter: "all", fix: null, savedFix: null, draft: null, look: { color: 0, hair: 5, shirt: 3, pants: 2 }, withHair: true, withClothes: true, frame: null, ready: false, queue: [], ui: {} };
  const SLOT_NAMES = { hair: "Hair", shirt: "Shirts", pants: "Pants", glasses: "Glasses", hat: "Hats", neck: "Neck & back", beard: "Beards" };
  const MOVABLE = new Set(["hair", "hat", "glasses", "neck", "beard"]);
  const SALES = [["shop", "Shop"], ["future", "Sky Mall (Future City)"], ["members", "Members Club"], ["none", "Not sold (prize only)"]];
  const SALE_TAG = { prize: "prize", store: "Jumpi Store", members: "members", future: "Sky Mall", event: "event", none: "not sold" };
  const deg = (r) => Math.round(r * 180 / Math.PI * 10) / 10, rad = (d) => Math.round(d * Math.PI / 180 * 10000) / 10000;
  const sameFix = (a, b) => JSON.stringify(normFix(a)) === JSON.stringify(normFix(b));
  function normFix(f) {
    const p = (f && f.p) || [0, 0, 0], r = (f && f.r) || [0, 0, 0], s = (f && f.s) || 1, z = (v) => Math.round(v * 10000) / 10000;
    const o = {}; if (p.some((v) => z(v))) o.p = p.map(z); if (r.some((v) => z(v))) o.r = r.map(z); if (z(s) !== 1) o.s = z(s);
    return Object.keys(o).length ? o : null;
  }
  const lab = (m) => { if (ST.ready && ST.frame) ST.frame.contentWindow.postMessage(m, location.origin); else ST.queue.push(m); };
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !ST.frame || e.source !== ST.frame.contentWindow) return;
    const m = e.data || {};
    if (m.t === "ready") { ST.ready = true; const q = ST.queue.splice(0); q.forEach(lab); if (ST.sel != null || ST.draft) showInLab(true); }
    else if (m.t === "fix") { ST.fix = m.fix; paintFix(); }
  });
  const cur = () => (ST.data && ST.sel != null ? ST.data.slots[ST.slot].find((x) => x.i === ST.sel) : null);
  const lookFor = () => ({ color: ST.look.color, eyes: 1, hair: ST.withHair && ST.slot !== "hair" ? ST.look.hair : -1, shirt: ST.withClothes && ST.slot !== "shirt" ? ST.look.shirt : -1, pants: ST.withClothes && ST.slot !== "pants" ? ST.look.pants : -1 });
  const draftIndex = () => Math.max(ST.data.from - 1, ...ST.data.slots[ST.slot].filter((x) => x.custom).map((x) => x.i)) + 1;
  function showInLab(refit) {
    if (ST.draft) lab({ t: "show", slot: ST.slot, i: draftIndex(), from: ST.draft.from, patch: { ...ST.draft.colors, name: ST.draft.name }, fix: ST.fix, look: lookFor(), refit });
    else if (ST.sel != null) lab({ t: "show", slot: ST.slot, i: ST.sel, look: lookFor(), refit });
  }

  async function studio() {
    ST.data = await api("/itemdefs");
    ST.ready = false; ST.queue = [];
    page("Item studio", h("span", { class: "muted" }, "Where items sit on the character, and new items from the looks that already exist"));
    const tabs = h("div", { class: "st-tabs" }, Object.keys(SLOT_NAMES).map((s) => h("button", { type: "button", class: "st-tab", "data-s": s, onclick: () => { if (leaveOk()) { ST.slot = s; ST.sel = null; ST.draft = null; paintList(); paintSide(); } } }, SLOT_NAMES[s], h("small", null, ST.data.slots[s].length))));
    const q = h("input", { class: "inp", type: "search", placeholder: "Search by name or number…", oninput: () => { ST.q = q.value.trim().toLowerCase(); paintList(); } });
    const flt = h("select", { class: "inp st-flt", onchange: () => { ST.filter = flt.value; paintList(); } }, [["all", "Everything"], ["moved", "Moved"], ["custom", "Made here"]].map(([v, t]) => h("option", { value: v }, t)));
    const list = h("ul", { class: "st-list" });
    ST.frame = h("iframe", { class: "st-frame", src: "/play?game&itemlab", title: "3D view" });
    const tool = (txt, on, cls) => h("button", { type: "button", class: "b b-ghost b-sm " + (cls || ""), onclick: on }, txt);
    const modeBtns = [["translate", "Move"], ["rotate", "Turn"], ["scale", "Size"]].map(([m, t]) => tool(t, (e) => { lab({ t: "mode", m }); modeBtns.forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); }, m === "translate" ? "on" : ""));
    const skins = h("div", { class: "st-skins" }, SKIN.slice(0, 8).map((c, k) => h("button", { type: "button", class: "st-skin", style: `--c:${c}`, title: "Skin colour", onclick: () => { ST.look.color = k; showInLab(false); } })));
    const tog = (label, key) => h("label", { class: "st-tog" }, h("input", { type: "checkbox", checked: ST[key], onchange: (e) => { ST[key] = e.target.checked; showInLab(false); } }), label);
    const side = h("div", { class: "st-side" });
    ST.ui = { tabs, list, side };
    main.append(h("div", { class: "st" },
      h("section", { class: "panel st-left" }, tabs, h("div", { class: "row st-find" }, q, flt), list),
      h("section", { class: "panel st-mid" },
        h("div", { class: "st-bar" }, modeBtns, h("span", { class: "sp" }), ["front", "side", "back", "top", "fit"].map((v) => tool(v === "fit" ? "Zoom to item" : v[0].toUpperCase() + v.slice(1), () => lab({ t: "view", v })))),
        ST.frame,
        h("div", { class: "st-bar" }, h("span", { class: "small muted" }, "Wearing:"), tog("hair", "withHair"), tog("clothes", "withClothes"), h("span", { class: "sp" }), skins)),
      h("section", { class: "panel st-right" }, side)));
    paintList(); paintSide();
  }
  function leaveOk() { return !dirty() || confirm("You have changes that aren't saved. Leave them?"); }
  const dirty = () => !!ST.draft || (ST.sel != null && MOVABLE.has(ST.slot) && !sameFix(ST.fix, ST.savedFix));
  addEventListener("beforeunload", (e) => { if (location.hash.startsWith("#studio") && ST.data && dirty()) { e.preventDefault(); e.returnValue = ""; } });

  function paintList() {
    const { tabs, list } = ST.ui;
    tabs.querySelectorAll(".st-tab").forEach((b) => b.classList.toggle("on", b.dataset.s === ST.slot));
    const rows = ST.data.slots[ST.slot].filter((x) => (ST.filter === "all" || (ST.filter === "moved" ? x.fix : x.custom)) &&
      (!ST.q || x.name.toLowerCase().includes(ST.q) || (x.he || "").includes(ST.q) || String(x.i) === ST.q.replace("#", "") || x.id.toLowerCase().includes(ST.q)));
    list.replaceChildren(...(rows.length ? rows.map((x) => h("li", null, h("button", { type: "button", class: "st-row" + (x.i === ST.sel && !ST.draft ? " on" : ""), onclick: () => pick(x.i) },
      h("span", { class: "st-num" }, "#" + x.i),
      h("span", { class: "st-name" }, x.name, x.he ? h("small", null, x.he) : null),
      h("span", { class: "st-tags" }, x.custom ? h("i", { class: "st-new" }, "new") : null, x.fix ? h("i", { class: "st-moved" }, "moved") : null, SALE_TAG[x.sale] ? h("i", null, SALE_TAG[x.sale]) : null)))) : [h("li", { class: "empty" }, "Nothing here.")]));
  }
  function pick(i) {
    if (ST.sel === i && !ST.draft) return;
    if (!leaveOk()) return;
    ST.draft = null; ST.sel = i; const x = cur(); ST.fix = x.fix ? JSON.parse(JSON.stringify(x.fix)) : null; ST.savedFix = ST.fix;
    showInLab(true); paintList(); paintSide();
  }

  // the right side: where it sits (any item you can move), and the details (items made here, or a new one)
  function paintSide() {
    const { side } = ST.ui, x = cur();
    if (!x && !ST.draft) { side.replaceChildren(h("h2", null, "Pick an item"), h("p", { class: "muted" }, "Choose an item on the left to see it on the character. You can move, turn and size it with the arrows in the 3D view or with the numbers here, or make a new item from it.")); return; }
    const kids = [];
    if (ST.draft) kids.push(h("h2", null, "New item"), h("p", { class: "small muted" }, `Looks like #${ST.draft.from} ${ST.data.slots[ST.slot].find((y) => y.i === ST.draft.from).name}. It gets number #${draftIndex()} when you create it.`));
    else kids.push(h("h2", null, x.name), h("p", { class: "small muted" }, `${SLOT_NAMES[ST.slot]} · #${x.i} · look "${x.id}" · ${fmtNum(x.price)} coins${x.rarity ? " · " + x.rarity : ""}${x.base ? " · made from #" + x.base.split(":")[1] : ""}`));
    if (MOVABLE.has(ST.slot)) kids.push(fixBox());
    else kids.push(h("p", { class: "st-note" }, "Shirts and pants are painted onto the body, so they can't be moved."));
    if (ST.draft) kids.push(detailsBox(ST.draft, true));
    else if (x.custom) kids.push(detailsBox({ name: x.name, he: x.he, price: x.price, rarity: x.rarity || "rare", sale: x.sale || "shop", colors: { ...x.colors } }, false));
    else kids.push(h("div", { class: "st-box" }, h("h3", null, "A new item from this one"), h("p", { class: "small muted" }, "Same shape, your own colours, name and price."),
      h("button", { type: "button", class: "b b-violet", onclick: () => startDraft(x) }, "Make a new item from this")));
    side.replaceChildren(...kids);
    paintFix();
  }
  function fixBox() {
    const row = (label, key, k, min, max, step, unit) => {
      const range = h("input", { type: "range", min, max, step, "data-k": key + k }), numIn = h("input", { class: "inp st-n", type: "number", min, max, step, "data-k": key + k });
      const set = (v) => { const f = normFix(ST.fix) || {}; const out = { p: f.p || [0, 0, 0], r: f.r || [0, 0, 0], s: f.s || 1 };
        if (key === "s") out.s = Math.max(.2, Math.min(5, +v || 1)); else if (key === "r") out.r[k] = rad(+v || 0); else out.p[k] = +v || 0;
        ST.fix = normFix(out); lab({ t: "fix", fix: ST.fix }); paintFix(); };
      range.addEventListener("input", () => set(range.value)); numIn.addEventListener("change", () => set(numIn.value));
      return h("label", { class: "st-axis" }, h("b", null, label), range, numIn, h("small", null, unit));
    };
    ST.ui.save = h("button", { type: "button", class: "b b-green", onclick: saveFix }, "Save position");
    ST.ui.state = h("span", { class: "small" });
    return h("div", { class: "st-box" }, h("h3", null, "Where it sits"),
      h("p", { class: "small muted" }, "Left / right, up / down, back / front: compared with where it was made."),
      row("X", "p", 0, -1, 1, .005, ""), row("Y", "p", 1, -1, 1, .005, ""), row("Z", "p", 2, -1, 1, .005, ""),
      h("h4", null, "Turn"), row("X", "r", 0, -180, 180, 1, "°"), row("Y", "r", 1, -180, 180, 1, "°"), row("Z", "r", 2, -180, 180, 1, "°"),
      h("h4", null, "Size"), row("×", "s", 0, .2, 3, .01, ""),
      h("div", { class: "row st-acts" }, ST.draft ? null : ST.ui.save, h("button", { type: "button", class: "b b-ghost", onclick: () => { ST.fix = null; lab({ t: "fix", fix: null }); paintFix(); } }, "Back to how it was made"), ST.ui.state));
  }
  function paintFix() {
    const f = normFix(ST.fix) || {}, p = f.p || [0, 0, 0], r = f.r || [0, 0, 0], s = f.s || 1;
    const vals = { p0: p[0], p1: p[1], p2: p[2], r0: deg(r[0]), r1: deg(r[1]), r2: deg(r[2]), s0: s };
    ST.ui.side && ST.ui.side.querySelectorAll("[data-k]").forEach((el) => { if (el !== document.activeElement) el.value = vals[el.dataset.k]; });
    if (ST.ui.save) { const d = !ST.draft && !sameFix(ST.fix, ST.savedFix); ST.ui.save.disabled = !d; ST.ui.state.textContent = ST.draft ? "" : d ? "Not saved yet" : ST.savedFix ? "Saved (moved)" : "As it was made"; ST.ui.state.className = "small " + (d ? "st-warn" : "muted"); }
  }
  async function saveFix() {
    const x = cur(); if (!x) return;
    try {
      const r = await api("/itemdefs/fix", { slot: ST.slot, i: x.i, fix: normFix(ST.fix) });
      x.fix = r.fix; ST.savedFix = r.fix ? JSON.parse(JSON.stringify(r.fix)) : null; ST.fix = ST.savedFix;
      toast(r.fix ? `Saved: ${x.name} is in its new place.` : `${x.name} is back where it was made.`); paintList(); paintFix();
    } catch (e) { oops(e); }
  }
  function startDraft(x) {
    if (!leaveOk()) return;
    ST.draft = { from: x.i, name: x.name + " (new)", he: "", price: x.price || 500, rarity: x.rarity || "rare", sale: "none", colors: JSON.parse(JSON.stringify(x.colors)) };
    ST.fix = x.fix ? JSON.parse(JSON.stringify(x.fix)) : null;
    showInLab(true); paintList(); paintSide();
  }
  function detailsBox(d, isNew) {
    const f = {};
    const fld = (label, el) => h("label", { class: "fld st-fld" }, h("span", null, label), el);
    f.name = h("input", { maxlength: 40, value: d.name || "" }); f.he = h("input", { maxlength: 40, dir: "rtl", value: d.he || "" });
    f.price = h("input", { type: "number", min: 0, max: 100000, step: 50, value: d.price });
    f.rarity = h("select", null, ST.data.rarities.map((r) => h("option", { value: r, selected: r === d.rarity }, r)));
    f.sale = h("select", null, SALES.map(([v, t]) => h("option", { value: v, selected: v === d.sale }, t)));
    const colors = JSON.parse(JSON.stringify(d.colors || {}));
    const preview = () => { if (isNew) { ST.draft.colors = colors; ST.draft.name = f.name.value; } lab(isNew ? { t: "show", slot: ST.slot, i: draftIndex(), from: ST.draft.from, patch: { ...colors }, fix: ST.fix, look: lookFor() } : { t: "show", slot: ST.slot, i: ST.sel, patch: { ...colors }, look: lookFor() }); };
    const colorRows = Object.entries(colors).map(([k, v]) => h("div", { class: "st-col" }, h("b", null, k),
      [].concat(v).map((c, n) => h("input", { type: "color", value: c, oninput: (e) => { if (Array.isArray(colors[k])) colors[k][n] = e.target.value; else colors[k] = e.target.value; preview(); } }))));
    const go = async () => {
      const data = { name: f.name.value, he: f.he.value, price: +f.price.value, rarity: f.rarity.value, sale: f.sale.value, colors };
      try {
        if (isNew) {
          const r = await api("/itemdefs/item", { slot: ST.slot, from: ST.draft.from, data, fix: normFix(ST.fix) });
          ST.draft = null; ST.data = await api("/itemdefs"); ST.sel = null; toast(`Made #${r.i} ${data.name}.${data.sale === "none" ? " It isn't sold yet: choose a shop when it's ready." : ""}`);
          ST.ready = false; ST.frame.contentWindow.location.reload();   // (the 3D view loads the new item list)
          pick(r.i);
        } else {
          await api("/itemdefs/item", { slot: ST.slot, i: ST.sel, data });
          const keep = ST.sel; ST.data = await api("/itemdefs"); ST.sel = null; ST.sel = keep; const x = cur(); ST.savedFix = x.fix; toast(`Saved ${data.name}.`); paintList(); paintSide();
        }
      } catch (e) { oops(e); }
    };
    return h("div", { class: "st-box" }, h("h3", null, isNew ? "Details" : "Details (made here)"),
      fld("Name (English)", f.name), fld("Name (Hebrew)", f.he),
      h("div", { class: "row st-2" }, fld("Price (coins)", f.price), fld("Rarity", f.rarity)), fld("Where it's sold", f.sale),
      colorRows.length ? h("div", { class: "st-cols" }, h("h4", null, "Colours"), colorRows) : h("p", { class: "small muted" }, "This look has no colours to change."),
      h("div", { class: "row st-acts" }, h("button", { type: "button", class: "b b-green", onclick: go }, isNew ? "Create the item" : "Save details"),
        isNew ? h("button", { type: "button", class: "b b-ghost", onclick: () => { ST.draft = null; ST.fix = ST.savedFix; showInLab(true); paintList(); paintSide(); } }, "Cancel") : null),
      isNew ? h("p", { class: "small muted" }, "Its position is saved with it. Players see it the next time they open the game.") : null);
  }

  /* ---------- navigation ---------- */
  async function route() {
    const [view, arg] = (location.hash.slice(1) || "overview").split("/");
    const name = VIEWS[view] ? view : "overview";
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.v === (name === "player" ? "players" : name)));
    main.replaceChildren(h("p", { class: "empty" }, "Loading…"));
    try { await VIEWS[name](arg); } catch (e) { oops(e); main.replaceChildren(h("p", { class: "empty" }, e.quiet ? "" : e.message)); }
    main.scrollTo?.(0, 0); window.scrollTo(0, 0);
  }
  addEventListener("hashchange", () => { if (!$("#app").hidden) route(); });
  async function refreshCounts() {
    try {
      const [o, c, tm, rp] = await Promise.all([api("/online"), api("/contact"), api("/team/count").catch(() => ({ new: 0 })), api("/reports/count").catch(() => ({ open: 0 }))]);
      $("#navReports").textContent = rp.open || "";
      $("#navOnline").textContent = o.players.length || "";
      $("#navContact").textContent = c.list.length || "";
      $("#navTeam").textContent = tm.new || "";
    } catch {}
  }
  setInterval(() => { if (!$("#app").hidden) refreshCounts(); }, 20000);

  boot();
})();
