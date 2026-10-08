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
        if (!d.user || d.user.role !== "admin") {
          await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
          throw new Error("This account isn't an admin.");
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
        tile(d.contactOpen, "contact messages to answer", "#ff5fb4", "#a3226a", "#contact")));
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
      page(u.username, h("a", { class: "b b-sm b-ghost", href: "#players" }, "← All players"));
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
          !isAdmin ? A("Delete account", "b-red", () => modal(`Delete ${u.username}?`, [{ text: "This deletes the account, items, friends, messages and history. It can't be undone. Use it for deletion requests from players or parents." }, { name: "confirm", label: `Type ${u.username} to confirm` }],
            "Delete forever", async (v) => { await act(u.id, "delete", { confirm: v.confirm }, null, true); location.hash = "#players"; }, true)) : null)));
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
    async orders() {
      page("Store orders");
      const sel = h("select", { class: "inp" }, [["", "All orders"], ["paid", "Paid"], ["pending", "Waiting for payment"], ["failed", "Failed"], ["duplicate", "Paid twice (refund by hand)"], ["refunded", "Refunded"]].map(([v, t]) => h("option", { value: v }, t)));
      const q = h("input", { class: "inp", placeholder: "Player name…", maxlength: 32 });
      const box = h("div");
      const ils = (n) => "₪" + (Math.round(n * 100) / 100).toFixed(2);
      const load = async () => {
        const d = await api("/orders?status=" + sel.value + "&q=" + encodeURIComponent(q.value.trim()));
        const sum = (st) => d.sums.find((x) => x._id === st) || { n: 0, total: 0 };
        box.replaceChildren(
          h("div", { class: "tiles" },
            h("div", { class: "tile", style: "--c:#2fd36b;--e:#17a24a" }, h("b", null, ils(d.month.total)), h("span", null, `paid in the last 30 days (${d.month.n})`)),
            h("div", { class: "tile", style: "--c:#1fb6ff;--e:#06488a" }, h("b", null, ils(sum("paid").total)), h("span", null, `paid in total (${sum("paid").n})`)),
            h("div", { class: "tile", style: "--c:#ff9a1f;--e:#a3410a" }, h("b", null, fmtNum(sum("pending").n)), h("span", null, "waiting for payment")),
            h("div", { class: "tile", style: "--c:#c8263c;--e:#7a1020" }, h("b", null, fmtNum(sum("duplicate").n)), h("span", null, "paid twice: refund by hand"))),
          panel(null, table([
            ["When", (r) => h("span", { class: "nowrap small" }, fmtDate(r.createdAt))], ["Player", (r) => userLink(r.username, r.user)],
            ["Product", (r) => r.product], ["Price", (r) => ils(r.amount)],
            ["Status", (r) => h("span", { class: "tag " + ({ paid: "green", pending: "", duplicate: "red", failed: "red", refunded: "" }[r.status] || "") }, r.status)],
            ["Payment", (r) => h("span", { class: "small muted" }, r.provider === "test" ? "test (pretend)" : r.providerRef || "–")],
          ], d.list)));
      };
      sel.onchange = () => load().catch(oops);
      q.addEventListener("input", () => { clearTimeout(q.t); q.t = setTimeout(() => load().catch(oops), 300); });
      main.append(h("div", { class: "tools" }, sel, q), box);
      await load();
    },
  };

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
    "give-item": "Gave item", "take-item": "Took item", "delete-account": "Deleted account", announce: "Announcement", unlock: "Opened the panel", "unlock-failed": "Wrong panel password",
    "read-messages": "Read private messages", "contact-done": "Answered contact message", "contact-reopen": "Reopened contact message", "code-create": "Made a gift code", "contact-reply": "Answered contact message by email", "verify-email": "Checked email by hand", "make-admin": "Made admin", "remove-admin": "Removed admin", "make-mod": "Made moderator", "remove-mod": "Removed moderator", "code-off": "Switched off a code", "code-on": "Switched on a code" };
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
      const [o, c] = await Promise.all([api("/online"), api("/contact")]);
      $("#navOnline").textContent = o.players.length || "";
      $("#navContact").textContent = c.list.length || "";
    } catch {}
  }
  setInterval(() => { if (!$("#app").hidden) refreshCounts(); }, 20000);

  boot();
})();
