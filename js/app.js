import { load, save, exportJson, importJson } from "./store.js";
import * as L from "./logic.js";

let db = load();
const MODES = ["auto", "light", "dark"];
function applyMode() {
  const m = db.settings.mode || "auto";
  if (m === "auto") delete document.documentElement.dataset.mode; else document.documentElement.dataset.mode = m;
  const dark = m === "dark" || (m === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0E1013" : "#3C4048");
}
applyMode();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyMode);
const ui = { screen: "today", letter: null, active: null, draft: null, restEnd: null, dialog: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persist = () => save(db);

// ---------- icons (small coloured strokes, Commander style) ----------
const svg = (d, c, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" style="stroke:${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  today: svg('<rect x="3" y="4" width="14" height="13"/><path d="M3 8h14M7 2v4M13 2v4"/>', "var(--ic-green)"),
  programs: svg('<path d="M6 6h11M6 10h11M6 14h11M2 6h1M2 10h1M2 14h1"/>', "var(--ic-purple)"),
  timer: svg('<circle cx="10" cy="11" r="6"/><path d="M10 11V7.5M8 2h4"/>', "var(--ic-orange)"),
  settings: svg('<circle cx="10" cy="10" r="3"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2 2M13.5 13.5l2 2M4.5 15.5l2-2M13.5 6.5l2-2"/>', "var(--ic-slate)"),
  disk: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="5.5" width="13" height="6" style="fill:var(--ic-disk);stroke:var(--ic-slate)"/><circle cx="12" cy="8.5" r="1" style="fill:var(--ic-slate)"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="stroke:var(--ic-ok)" stroke-width="2.2" aria-hidden="true"><path d="M2.5 8.5l3.5 3.5 7.5-8"/></svg>`,
  skip: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="stroke:var(--ic-grey)" stroke-width="2" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
  cur: `<svg width="14" height="14" viewBox="0 0 16 16" style="fill:var(--active-txt)" aria-hidden="true"><path d="M4 2l9 6-9 6z"/></svg>`,
  page: (c) => `<svg width="14" height="14" viewBox="0 0 16 16" style="fill:var(--ctl);stroke:${c}" aria-hidden="true"><rect x="3.5" y="1.5" width="9" height="13"/></svg>`,
  minus: `<svg width="18" height="18" viewBox="0 0 18 18" style="stroke:var(--ico)" stroke-width="2" aria-hidden="true"><path d="M4 9h10"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 18 18" style="stroke:var(--ico)" stroke-width="2" aria-hidden="true"><path d="M4 9h10M9 4v10"/></svg>`,
};

// ---------- state helpers ----------
function session() {
  const s = L.openSession(db);
  return s && s.workout === ui.letter ? s : null;
}
function workout() { return db.workouts[ui.letter]; }

function pickLetter() {
  const open = L.openSession(db);
  ui.letter = open ? open.workout : L.nextLetter(db);
}

function firstOpenItem() {
  const s = session();
  return workout().items.find((it) => !["done", "skipped"].includes(L.itemState(s, it).status)) || null;
}

function setActive(exId) {
  ui.active = exId;
  ui.draft = null;
}

function draftFor(item) {
  if (ui.draft && ui.draft.ex === item.ex) return ui.draft;
  const s = session();
  const st = L.itemState(s, item);
  const t = L.target(db, item);
  const prev = st.sets[st.sets.length - 1];
  ui.draft = { ex: item.ex, kg: prev ? prev.kg : t.kg, reps: prev ? prev.reps : t.reps };
  return ui.draft;
}

function ensureSession() {
  let s = session();
  if (s) return s;
  const other = L.openSession(db);
  if (other) {
    const any = Object.values(other.entries).some((e) => e.sets.length);
    if (any && !confirm(`Workout ${other.workout} is unfinished. Finish it and start ${ui.letter}?`)) return null;
    if (any) L.finishSession(db, other); else delete db.sessions[other.id];
  }
  s = L.newSession(db, ui.letter);
  return s;
}

// ---------- render ----------
function render() {
  const app = $("#app");
  const scroll = app.querySelector(".body")?.scrollTop || 0;
  app.innerHTML = `
    <header class="title">GymLog – ${ui.screen === "today" ? `Workout ${ui.letter} · ${esc(workout().name)}` : ui.screen === "programs" ? "Programs" : "Settings"}</header>
    <nav class="menu">
      <button data-act="screen" data-v="today" class="${ui.screen === "today" ? "on" : ""}"><u>T</u>oday</button>
      <button data-act="screen" data-v="programs" class="${ui.screen === "programs" ? "on" : ""}"><u>P</u>rograms</button>
      <button data-act="screen" data-v="settings" class="${ui.screen === "settings" ? "on" : ""}"><u>S</u>ettings</button>
    </nav>
    <div class="toolbar">
      <button aria-label="Today" data-act="screen" data-v="today">${I.today}</button>
      <button aria-label="Programs" data-act="screen" data-v="programs">${I.programs}</button>
      <button aria-label="Rest timer" data-act="rest">${I.timer}</button>
      <button aria-label="Settings" data-act="screen" data-v="settings">${I.settings}</button>
      <span class="restclock" id="restclock"></span>
    </div>
    <main class="body">${ui.screen === "today" ? today() : ui.screen === "programs" ? programs() : settings()}</main>
    ${ui.screen === "today" ? footer() : ""}
    ${ui.dialog ? dialog() : ""}`;
  const b = app.querySelector(".body");
  if (b) b.scrollTop = scroll;
  tick();
}

function today() {
  const s = session();
  const w = workout();
  const doneSet = L.cycleDone(db);
  const open = L.openSession(db);
  const drives = L.LETTERS.map((l) => {
    const isDone = doneSet.has(l) && !(open && open.workout === l);
    return `<button class="drive ${l === ui.letter ? "sel" : ""}" data-act="letter" data-v="${l}" aria-label="Workout ${l}${isDone ? ", done" : ""}">${I.disk}${l}${isDone ? '<b class="ok">✓</b>' : ""}</button>`;
  }).join("");

  if (!ui.active || !w.items.some((i) => i.ex === ui.active)) setActive(firstOpenItem()?.ex || null);
  const doneCount = w.items.filter((it) => ["done", "skipped"].includes(L.itemState(s, it).status)).length;

  const warm = s?.warmup;
  const rows = [`<button class="row ${warm ? "done" : "todo"}" data-act="warmup">
      <span class="ic">${warm ? I.check : I.page("var(--ic-page)")}</span><span>Warm-up 5–10 min</span><span>walk / bike</span><span>${warm ? "1/1" : "0/1"}</span></button>`];
  w.items.forEach((it, i) => {
    const ex = db.exercises[it.ex];
    const st = L.itemState(s, it);
    const isActive = it.ex === ui.active;
    let cls = "todo", ic = I.page("var(--ic-page2)"), info = L.targetText(db, it).replace(/ · /, " · ");
    if (st.status === "done") {
      cls = "done"; ic = I.check;
      info = ex.type === "timed" ? st.sets.map((x) => x.reps + "s").join(",") : `${st.sets[st.sets.length - 1].kg ? L.fmtKg(st.sets[st.sets.length - 1].kg) + " kg" : "BW"} × ${st.sets.map((x) => x.reps).join(",")}`;
    } else if (st.status === "skipped") { cls = "skipped"; ic = I.skip; info = "skipped"; }
    if (isActive) { cls += " active"; ic = I.cur; }
    rows.push(`<button class="row ${cls} ${i % 2 ? "" : "alt"}" data-act="pick" data-v="${it.ex}">
      <span class="ic">${ic}</span><span class="nm">${esc(ex.name)}</span><span>${esc(info)}</span><span>${st.sets.length}/${it.sets}</span></button>`);
  });

  const allClosed = doneCount === w.items.length;
  return `
    <div class="drives">${drives}</div>
    <div class="pathbar">▾ <span>gym:\\${esc(w.name.replace(" ", ""))}\\*.*</span><span class="right">${L.sessionCount(db)} sessions logged</span></div>
    <div class="panel">
      <div class="thead"><span></span><span>Name</span><span>Today</span><span>Sets</span></div>
      ${rows.join("")}
      <div class="status">${doneCount} / ${w.items.length} exercises done${s ? "" : " · not started"}</div>
    </div>
    ${ui.active ? detail() : ""}
    ${allClosed || s ? `<button class="btn finish ${allClosed ? "primary" : ""}" data-act="finish">${allClosed ? "Finish workout " + ui.letter : "Finish workout early"}</button>` : ""}`;
}

function detail() {
  const w = workout();
  const item = w.items.find((i) => i.ex === ui.active);
  const ex = db.exercises[item.ex];
  const s = session();
  const st = L.itemState(s, item);
  const t = L.target(db, item);
  const d = draftFor(item);
  const timed = ex.type === "timed";
  const setNo = st.sets.length + 1;
  const finished = st.status === "done" || st.status === "skipped";

  const tgt = timed
    ? `Today: ${item.sets} × ${t.reps} s (range ${item.min}–${item.max})`
    : t.first
      ? `First time: pick a weight that leaves 3–4 reps in reserve`
      : `Today: ${t.kg ? L.fmtKg(t.kg) + " kg" : "BW"} · ${item.sets} × ${item.min}–${item.max}${t.up ? " ↑" : ""}`;

  const logged = st.sets.map((x, i) => `<div class="logged">[x] Set ${i + 1} · ${timed ? x.reps + " s" : (x.kg ? L.fmtKg(x.kg) + " kg" : "BW") + " × " + x.reps}</div>`).join("");

  const stepper = (field, label, val, color, cap) => `
    <div class="stepper"><div class="cap">${cap}</div><div class="sr">
      <button class="btn sq" aria-label="Less ${label}" data-act="dec" data-v="${field}">${I.minus}</button>
      <div class="val" style="color:${color}">${val}</div>
      <button class="btn sq" aria-label="More ${label}" data-act="inc" data-v="${field}">${I.plus}</button></div></div>`;

  const kgVal = d.kg == null || d.kg === 0 ? (ex.type === "weight" ? "0" : "BW") : L.fmtKg(d.kg);
  const hint = timed
    ? `All sets at ${item.max} s → +${ex.step} s next time`
    : `${item.sets > 1 ? "All sets" : "Set"} at ${item.max} reps → +${L.fmtKg(ex.step)} kg next time`;

  return `
    <div class="panel">
      <div class="pathbar">▾ gym:\\${esc(ui.letter)}\\${esc(ex.name)}\\sets</div>
      <div class="detail">
        <div class="dhead">
          <button class="img" data-act="guide" aria-label="Open position guide">IMG<br>guide</button>
          <div class="dinfo"><div class="tgt">${esc(tgt)}</div><div class="last">${esc(L.lastText(ex))}</div><div class="cue">${esc(ex.cue)}</div></div>
        </div>
        <div class="noterow"><label for="xnote">Note</label><input id="xnote" data-ex="${item.ex}" value="${esc(ex.note)}" placeholder="seat height, notch, how it felt…"></div>
        ${logged}
        ${finished ? `<button class="btn" data-act="undo">Undo last</button>` : `
          <div class="setlabel">Set ${setNo} of ${item.sets}</div>
          <div class="steppers">
            ${timed ? "" : stepper("kg", "weight", kgVal, "var(--blue)", `KG · step ${L.fmtKg(ex.step)}`)}
            ${stepper("reps", timed ? "seconds" : "reps", d.reps, "var(--green)", timed ? "SECONDS" : "REPS")}
          </div>
          <button class="btn primary log" data-act="log">Log set ${setNo} · then rest ${fmtRest(db.settings.restSec)}</button>
          ${st.sets.length ? `<button class="btn" data-act="undo">Undo last</button>` : ""}`}
        <div class="hint">${esc(hint)}</div>
      </div>
    </div>`;
}

const fmtRest = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function footer() {
  return `<footer>
    <div class="cmdline"><label for="gnote">Note (all)&gt;</label><input id="gnote" value="${esc(db.settings.globalNote)}"></div>
    <div class="fkeys">
      <button class="btn" data-act="guide">F3 Guide</button>
      <button class="btn" data-act="focusnote">F4 Note</button>
      <button class="btn" data-act="rest">F5 Timer</button>
      <button class="btn" data-act="swap">F6 Swap</button>
      <button class="btn" data-act="skip">F8 Skip</button>
    </div></footer>`;
}

function programs() {
  return L.LETTERS.map((l) => {
    const w = db.workouts[l];
    return `<div class="panel">
      <div class="pathbar">▾ gym:\\${l} · ${esc(w.name)}</div>
      <div class="thead prog"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Step</span></div>
      ${w.items.map((it, i) => {
        const ex = db.exercises[it.ex];
        return `<div class="prow ${i % 2 ? "" : "alt"}"><span class="nm">${esc(ex.name)}</span>
          <span class="mini"><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="-1" aria-label="Fewer sets">−</button><b>${it.sets}</b><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="1" aria-label="More sets">+</button></span>
          <span>${it.min}–${it.max}${ex.type === "timed" ? "s" : ""}</span>
          <span><button class="btn stepbtn" data-act="pstep" data-ex="${it.ex}">${L.fmtKg(ex.step)}${ex.type === "timed" ? "s" : ""}</button></span></div>`;
      }).join("")}
      <div class="status"><button class="btn" data-act="allsets" data-l="${l}">All to 2 sets</button></div>
    </div>`;
  }).join("") + `<p class="small">Tap a step size to change it (one machine notch). Sets: 1 in weeks 1–2, 2 from week 3.</p>`;
}

function settings() {
  return `<div class="panel"><div class="pathbar">▾ gym:\\settings</div><div class="detail">
    <div class="noterow"><label for="rest">Rest (s)</label><input id="rest" type="number" inputmode="numeric" value="${db.settings.restSec}"></div>
    <div class="setlabel">Appearance</div>
    <div class="seg">${MODES.map((m) => `<button class="btn ${(db.settings.mode || "auto") === m ? "primary" : ""}" data-act="mode" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>
    <div class="setlabel">Backup</div>
    <p class="small">Data lives on this phone until we switch to Firestore. Export now and then to be safe.</p>
    <button class="btn" data-act="export">Export backup (.json)</button>
    <button class="btn" data-act="import">Import backup…</button>
    <input type="file" id="importfile" accept="application/json" hidden>
    <p class="small">${L.sessionCount(db)} sessions logged · version 0.1</p>
  </div></div>`;
}

function dialog() {
  const d = ui.dialog;
  return `<div class="overlay" data-act="close"><div class="win" role="dialog" aria-label="${esc(d.title)}" data-act="noop">
    <div class="title">${esc(d.title)}<button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="detail">${d.body}${d.ok === false ? "" : '<button class="btn primary wide" data-act="close">OK</button>'}</div></div></div>`;
}

// ---------- rest timer ----------
let timerId = null;
function startRest() {
  ui.restEnd = Date.now() + db.settings.restSec * 1000;
  tick();
}
function tick() {
  clearTimeout(timerId);
  const el = $("#restclock");
  if (!el) return;
  if (!ui.restEnd) { el.textContent = ""; return; }
  const left = Math.ceil((ui.restEnd - Date.now()) / 1000);
  if (left <= 0) {
    el.textContent = "REST OVER";
    el.classList.add("over");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    ui.restEnd = null;
    timerId = setTimeout(() => { el.textContent = ""; el.classList.remove("over"); }, 4000);
    return;
  }
  el.classList.remove("over");
  el.textContent = "Rest " + fmtRest(left);
  timerId = setTimeout(tick, 250);
}

// ---------- actions ----------
const act = {
  screen: (v) => { ui.screen = v; },
  letter: (v) => { ui.letter = v; setActive(null); },
  pick: (v) => { setActive(v); },
  warmup: () => { const s = ensureSession(); if (!s) return; s.warmup = !s.warmup; persist(); },
  inc: (f) => bump(f, 1),
  dec: (f) => bump(f, -1),
  log: () => {
    const s = ensureSession(); if (!s) return;
    const item = workout().items.find((i) => i.ex === ui.active);
    const ex = db.exercises[item.ex];
    const d = draftFor(item);
    const e = L.entryFor(s, item.ex);
    e.sets.push({ kg: ex.type === "timed" ? null : (d.kg || 0), reps: d.reps });
    if (e.sets.length >= item.sets) { e.status = "done"; persist(); const n = firstOpenItem(); setActive(n ? n.ex : item.ex); }
    else persist();
    startRest();
  },
  undo: () => {
    const s = session(); if (!s) return;
    const e = s.entries[ui.active]; if (!e) return;
    if (e.status === "skipped") e.status = "todo";
    else { e.sets.pop(); e.status = "todo"; }
    ui.draft = null; persist();
  },
  skip: () => {
    if (!ui.active) return;
    const s = ensureSession(); if (!s) return;
    const e = L.entryFor(s, ui.active); e.status = "skipped"; persist();
    const n = firstOpenItem(); setActive(n ? n.ex : ui.active);
  },
  swap: () => {
    if (!ui.active) return;
    const w = workout();
    const opts = Object.entries(db.exercises).filter(([id]) => !w.items.some((i) => i.ex === id))
      .map(([id, e]) => `<button class="btn wide" data-act="doswap" data-v="${id}">${esc(e.name)}</button>`).join("");
    ui.dialog = { title: `Swap ${db.exercises[ui.active].name} for…`, body: `<p class="small">Changes it in workout ${ui.letter} from now on.</p>${opts}` };
  },
  doswap: (v) => {
    const w = workout();
    const it = w.items.find((i) => i.ex === ui.active);
    if (it) { it.ex = v; persist(); setActive(v); }
    ui.dialog = null;
  },
  guide: () => {
    if (!ui.active) return;
    const ex = db.exercises[ui.active];
    ui.dialog = { title: ex.name, body: `<div class="guideimg">Illustration coming</div><p>${esc(ex.cue)}</p>${ex.note ? `<p class="notecol">Note: ${esc(ex.note)}</p>` : ""}` };
  },
  mode: (v) => { db.settings.mode = v; persist(); applyMode(); },
  close: () => { ui.dialog = null; },
  noop: () => "norender",
  focusnote: () => { const n = $("#xnote"); if (n) { n.focus(); n.select(); } return "norender"; },
  rest: () => { startRest(); return "norender"; },
  finish: () => {
    const s = session(); if (!s) return;
    const w = workout();
    const open = w.items.filter((it) => !["done", "skipped"].includes(L.itemState(s, it).status)).length;
    if (open && !confirm(`${open} exercise(s) not done. Finish anyway?`)) return;
    L.finishSession(db, s); persist();
    ui.letter = L.nextLetter(db); setActive(null); ui.restEnd = null;
    ui.dialog = { title: "Workout logged", body: `<p>Nice. Next time: workout ${ui.letter} · ${esc(workout().name)}.</p>`, ok: true };
  },
  psets: (_, el) => {
    const it = db.workouts[el.dataset.l].items[+el.dataset.i];
    it.sets = Math.min(5, Math.max(1, it.sets + +el.dataset.d)); persist();
  },
  allsets: (_, el) => { db.workouts[el.dataset.l].items.forEach((it) => (it.sets = Math.max(it.sets, 2))); persist(); },
  pstep: (_, el) => {
    const ex = db.exercises[el.dataset.ex];
    const v = prompt(`Step size for ${ex.name} (${ex.type === "timed" ? "seconds" : "kg"})`, ex.step);
    const n = parseFloat(String(v).replace(",", "."));
    if (v != null && n > 0) { ex.step = n; persist(); }
  },
  export: () => {
    const blob = new Blob([exportJson(db)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gymlog-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    return "norender";
  },
  import: () => { $("#importfile").click(); return "norender"; },
};

function bump(field, dir) {
  const item = workout().items.find((i) => i.ex === ui.active);
  const ex = db.exercises[item.ex];
  const d = draftFor(item);
  if (field === "kg") d.kg = Math.max(0, Math.round(((d.kg || 0) + dir * ex.step) * 100) / 100);
  else d.reps = Math.max(1, d.reps + dir * (ex.type === "timed" ? ex.step : 1));
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = act[el.dataset.act];
  if (!fn) return;
  if (fn(el.dataset.v, el) !== "norender") render();
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "xnote") { db.exercises[t.dataset.ex].note = t.value; persist(); }
  if (t.id === "gnote") { db.settings.globalNote = t.value; persist(); }
  if (t.id === "rest") { const n = parseInt(t.value, 10); if (n > 0) { db.settings.restSec = n; persist(); } }
  if (t.id === "importfile" && t.files[0]) {
    t.files[0].text().then((txt) => {
      try { db = importJson(txt); pickLetter(); setActive(null); render(); alert("Backup imported."); }
      catch (err) { alert("Import failed: " + err.message); }
    });
  }
});

// hold-to-repeat on +/− steppers
let holdT = null;
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest('[data-act="inc"],[data-act="dec"]');
  if (!el) return;
  const dir = el.dataset.act === "inc" ? 1 : -1, f = el.dataset.v;
  holdT = setTimeout(function rep() { bump(f, dir); const v = el.parentNode.querySelector(".val"); render(); holdT = setTimeout(rep, 120); }, 450);
});
["pointerup", "pointercancel", "pointerleave"].forEach((t) => document.addEventListener(t, () => clearTimeout(holdT)));

pickLetter();
render();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
