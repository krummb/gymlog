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
const ui = { overUntil: 0, screen: "today", letter: null, active: null, draft: null, restEnd: null, dialog: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persist = () => save(db);

// ---------- icons (small coloured strokes, Commander style) ----------
const svg = (d, c, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" style="stroke:${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
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
      <span class="restclock" id="restclock"></span>
    </nav>
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

  if (!ui.active || (ui.active !== WARM && !w.items.some((i) => i.ex === ui.active))) {
    const fresh = !s || !!s.warmStart || (!s.warmup && !Object.keys(s.entries).length);
    setActive(fresh ? WARM : firstOpenItem()?.ex || null);
  }
  const doneCount = w.items.filter((it) => ["done", "skipped"].includes(L.itemState(s, it).status)).length;

  const warm = s?.warmup;
  const warming = !!s?.warmStart;
  const wAt = s?.warmAt ? new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const wMin = s?.warmSec ? Math.max(1, Math.round(s.warmSec / 60)) + " min" : "done";
  const wInfo = warm ? (wAt && s.warmSec ? `${wAt} · ${wMin}` : wMin) : warming ? `${wAt} · running` : "walk / bike";
  const wActive = ui.active === WARM;
  const wIc = wActive ? I.cur : warm ? I.check : I.page("var(--ic-page)");
  const rows = [`<button class="row ${warm ? "done" : "todo"} ${wActive ? "active" : ""}" data-act="warmup">
      <span class="ic">${wIc}</span><span>Warm-up 5–10 min</span><span>${wInfo}</span><span>${warm ? "1/1" : "0/1"}</span></button>`];
  w.items.forEach((it, i) => {
    const ex = db.exercises[it.ex];
    const st = L.itemState(s, it);
    const isActive = it.ex === ui.active;
    let cls = "todo", ic = I.page("var(--ic-page2)"), info = L.targetText(db, it).replace(/ · /, " · ");
    if (st.status === "done") {
      cls = "done"; ic = I.check;
      info = ex.type === "timed" ? st.sets.map((x) => x.reps + "s").join(",") : `${st.sets[st.sets.length - 1].kg ? L.fmtKg(st.sets[st.sets.length - 1].kg) + " " + L.unitOf(ex) : "BW"} × ${st.sets.map((x) => x.reps).join(",")}`;
    } else if (st.status === "skipped") { cls = "skipped"; ic = I.skip; info = "skipped"; }
    if (isActive) { cls += " active"; if (st.status === "todo") ic = I.cur; }
    rows.push(`<button class="row ${cls} ${i % 2 ? "" : "alt"}" data-act="pick" data-v="${it.ex}">
      <span class="ic">${ic}</span><span class="nm">${esc(ex.name)}</span><span>${esc(info)}</span><span>${st.sets.length}/${it.sets}</span></button>`);
  });

  const allClosed = doneCount === w.items.length;
  return `
    <div class="drives">${drives}</div>
    <div class="pathbar">▾ <span>gym:\\${esc(w.name.replace(" ", ""))}\\*.*</span><span class="right">${L.sessionCountFor(db, ui.letter)} ${L.sessionCountFor(db, ui.letter) === 1 ? "session" : "sessions"} logged</span></div>
    <div class="panel">
      <div class="thead"><span></span><span>Name</span><span>Today</span><span>Sets</span></div>
      ${rows.join("")}
      <div class="status">${doneCount} / ${w.items.length} exercises done${s ? "" : " · not started"}</div>
    </div>
    ${ui.active === WARM ? warmDetail() : ui.active ? detail() : ""}
    ${allClosed || s ? `<button class="btn finish ${allClosed ? "primary" : ""}" data-act="finish">${allClosed ? "Finish workout " + ui.letter : "Finish workout early"}</button>` : ""}`;
}

const WARM = "__warm";
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function warmDetail() {
  const s = session();
  const running = !!s?.warmStart;
  const done = !!s?.warmup;
  const elapsed = running ? Math.floor((Date.now() - Date.parse(s.warmStart)) / 1000) : done ? s.warmSec || 0 : 0;
  return `
    <div class="panel">
      <div class="pathbar">▾ gym:\\${esc(ui.letter)}\\Warm-up\\timer</div>
      <div class="detail">
        <div class="warmclock ${elapsed >= 300 ? "reached" : ""}" id="warmclock">${fmtClock(elapsed)}</div>
        <div class="last">${done ? (s.warmSec ? "Warm-up done · " + fmtClock(s.warmSec) + (s.warmAt ? " · started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "") : "Warm-up done") : running && s.warmAt ? "Started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) + " · target 5–10 min" : "Target 5–10 min · easy walk or bike, enough to feel warm"}</div>
        ${done ? `<button class="btn" data-act="warmundo">Undo warm-up</button>`
          : running ? `<button class="btn primary log" data-act="warmstop">Stop · warm-up done</button>`
          : `<button class="btn primary log" data-act="warmstart">Start warm-up</button><button class="btn" data-act="warmdone">Mark done (no timer)</button>`}
        ${elapsed >= 300 && running ? `<div class="hint">5 min reached. Stop whenever you feel warm.</div>` : ""}
      </div>
    </div>`;
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
    ? (t.first ? `First time: start at ${t.reps} s` : `Today: ${item.sets} × ${t.reps} s ↑`)
    : t.first
      ? `First time: pick a weight that leaves 3–4 reps in reserve`
      : `Today: ${t.kg ? L.fmtKg(t.kg) + " " + L.unitOf(ex) : "BW"} · ${item.sets} × ${item.min}–${item.max}${t.up ? " ↑" : ""}`;

  const logged = st.sets.map((x, i) => `<div class="logged">[x] Set ${i + 1} · ${timed ? x.reps + " s" : (x.kg ? L.fmtKg(x.kg) + " " + L.unitOf(ex) : "BW") + " × " + x.reps}</div>`).join("");

  const stepper = (field, label, val, color, cap) => `
    <div class="stepper"><div class="cap">${cap}</div><div class="sr">
      <button class="btn sq" aria-label="Less ${label}" data-act="dec" data-v="${field}">${I.minus}</button>
      <div class="val" style="color:${color}">${val}</div>
      <button class="btn sq" aria-label="More ${label}" data-act="inc" data-v="${field}">${I.plus}</button></div></div>`;

  const kgVal = d.kg == null || d.kg === 0 ? (ex.type === "weight" ? "0" : "BW") : L.fmtKg(d.kg);
  const hint = timed
    ? `Next time: beat your best by +${ex.step} s`
    : `${item.sets > 1 ? "All sets" : "Set"} at ${item.max} reps → ${ex.scale ? "next weight on the stack" : "+" + L.fmtKg(ex.step) + " " + L.unitOf(ex)} next time`;

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
            ${timed ? "" : stepper("kg", "weight", kgVal, "var(--blue)", ex.scale ? `${L.unitOf(ex).toUpperCase()} · machine scale` : `${L.unitOf(ex).toUpperCase()} · step ${L.fmtKg(ex.step)}`)}
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
      <div class="thead prog"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Step</span><span></span></div>
      ${w.items.map((it, i) => {
        const ex = db.exercises[it.ex];
        const timed = ex.type === "timed";
        return `<div class="prow ${i % 2 ? "" : "alt"}"><span class="nm">${esc(ex.name)}</span>
          <span class="mini"><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="-1" aria-label="Fewer sets">−</button><b>${it.sets}</b><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="1" aria-label="More sets">+</button></span>
          <span><button class="btn stepbtn" data-act="prange" data-l="${l}" data-i="${i}" aria-label="Edit reps">${timed ? it.min + "s+" : it.min + "–" + it.max}</button></span>
          <span>${ex.scale ? `<button class="btn stepbtn" data-act="exdlg" data-ex="${it.ex}">scale</button>` : `<button class="btn stepbtn" data-act="pstep" data-ex="${it.ex}">${L.fmtKg(ex.step)}${timed ? "s" : ""}</button>`}</span>
          <span><button class="btn stepbtn xbtn" data-act="premove" data-l="${l}" data-i="${i}" aria-label="Remove ${esc(ex.name)} from workout ${l}">×</button></span></div>`;
      }).join("")}
      <div class="status"><button class="btn" data-act="allsets" data-l="${l}">All to 3 sets</button> <button class="btn" data-act="padd" data-l="${l}">+ Add exercise</button></div>
    </div>`;
  }).join("") + `<p class="small">Tap reps to change the range, a step size to change it (one machine notch), or “scale” for machines with a weight stack. Timed exercises (plank) have no range: “20s+” is the starting time, then the target is your last best + the step.</p>`;
}

function settings() {
  return `<div class="panel"><div class="pathbar">▾ gym:\\settings</div><div class="detail">
    <div class="noterow"><label for="rest">Rest (s)</label><input id="rest" type="number" inputmode="numeric" value="${db.settings.restSec}"></div>
    <div class="setlabel">Appearance</div>
    <div class="seg">${MODES.map((m) => `<button class="btn ${(db.settings.mode || "auto") === m ? "primary" : ""}" data-act="mode" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>
    <div class="setlabel">Exercises</div>
    <p class="small">Tap one to change its name, step, current weight or weight scale.</p>
    <div class="scales">${Object.entries(db.exercises).map(([id, e]) => {
      const step = e.type === "timed" ? `step ${L.fmtKg(e.step)} s` : e.scale && e.scale.values.length ? "scale" : `step ${L.fmtKg(e.step)} kg`;
      return `<button class="srow" data-act="exdlg" data-ex="${id}"><span class="nm">${esc(e.name)}</span><span class="${e.scale ? "has" : ""}">${esc(L.currentText(e))} · ${esc(step)}</span></button>`;
    }).join("")}</div>
    <button class="btn" data-act="exdlg" data-ex="">+ Add exercise…</button>
    <div class="setlabel">Backup</div>
    <p class="small">Data lives on this phone until we switch to Firestore. Export now and then to be safe.</p>
    <button class="btn" data-act="export">Export backup (.json)</button>
    <button class="btn" data-act="import">Import backup…</button>
    <input type="file" id="importfile" accept="application/json" hidden>
    <p class="small">${L.sessionCount(db)} sessions logged · version ${window.APP_VERSION || "?"}</p>
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
  const now = Date.now();
  const sess = L.openSession(db);
  const warming = !!(sess && sess.warmStart);
  const wsec = warming ? Math.floor((now - Date.parse(sess.warmStart)) / 1000) : 0;
  const wc = $("#warmclock");
  if (warming && wc) { wc.textContent = fmtClock(wsec); wc.classList.toggle("reached", wsec >= 300); }
  let text = "", over = false;
  if (ui.restEnd) {
    const left = Math.ceil((ui.restEnd - now) / 1000);
    if (left <= 0) { ui.restEnd = null; ui.overUntil = now + 4000; if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
    else text = "Rest " + fmtRest(left);
  }
  if (!text && ui.overUntil > now) { text = "REST OVER"; over = true; }
  if (!text && warming) text = "Warm " + fmtClock(wsec);
  el.textContent = text;
  el.classList.toggle("over", over);
  if (ui.restEnd || ui.overUntil > now || warming) timerId = setTimeout(tick, 250);
}

// ---------- actions ----------
const act = {
  screen: (v) => { ui.screen = v; },
  letter: (v) => { ui.letter = v; setActive(null); },
  pick: (v) => { setActive(v); },
  warmup: () => { setActive(WARM); },
  warmstart: () => { const s = ensureSession(); if (!s) return; s.warmStart = new Date().toISOString(); s.warmAt = s.warmStart; s.warmup = false; s.warmSec = 0; persist(); },
  warmstop: () => {
    const s = session(); if (!s || !s.warmStart) return;
    s.warmSec = Math.round((Date.now() - Date.parse(s.warmStart)) / 1000);
    s.warmStart = null; s.warmup = true; persist();
    const n = firstOpenItem(); setActive(n ? n.ex : null);
  },
  warmdone: () => { const s = ensureSession(); if (!s) return; s.warmup = true; s.warmSec = 0; s.warmAt = null; persist(); const n = firstOpenItem(); setActive(n ? n.ex : null); },
  warmundo: () => { const s = session(); if (!s) return; s.warmup = false; s.warmStart = null; s.warmAt = null; s.warmSec = 0; persist(); },
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
    if (!ui.active || ui.active === WARM) return "norender";
    const s = ensureSession(); if (!s) return;
    const e = L.entryFor(s, ui.active); e.status = "skipped"; persist();
    const n = firstOpenItem(); setActive(n ? n.ex : ui.active);
  },
  swap: () => {
    if (!ui.active || ui.active === WARM) return "norender";
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
    if (!ui.active || ui.active === WARM) return "norender";
    const ex = db.exercises[ui.active];
    ui.dialog = { title: ex.name, body: `<div class="guideimg">Illustration coming</div><p>${esc(ex.cue)}</p>${ex.note ? `<p class="notecol">Note: ${esc(ex.note)}</p>` : ""}` };
  },
  mode: (v) => { db.settings.mode = v; persist(); applyMode(); },
  exdlg: (_, el) => {
    const id = el.dataset.ex;
    const isNew = !id;
    const e = isNew ? { name: "", type: "weight", step: 2.5, cue: "", last: null, scale: null } : db.exercises[id];
    const timed = e.type === "timed";
    const cur = e.last ? (timed ? e.last.top : e.last.kg) : "";
    const letters = L.LETTERS.map((l) => `<label><input type="checkbox" class="ex_in" value="${l}"> ${l}</label>`).join("");
    ui.dialog = { title: isNew ? "Add exercise" : e.name, ok: false, body: `
      <div class="frow"><label for="ex_name">Name</label><input id="ex_name" type="text" value="${esc(e.name)}" placeholder="e.g. Cable fly"></div>
      ${isNew ? `<div class="frow"><label for="ex_type">Type</label><select id="ex_type" data-act="extype"><option value="weight">Weight (machine / free)</option><option value="bodyweight">Bodyweight (reps)</option><option value="timed">Timed (seconds)</option></select></div>` : ""}
      <div class="frow"><label for="ex_cur">${timed ? "Current best (s)" : "Current weight (kg)"}</label><input id="ex_cur" type="text" inputmode="decimal" value="${cur === null ? "" : esc(cur)}" placeholder="${timed ? "e.g. 30" : "e.g. 25"}"></div>
      <p class="small">Today's target starts from this. Changing it starts the rep count over at the low end.</p>
      <div class="frow"><label for="ex_step">Step (${timed ? "s" : "kg"})</label><input id="ex_step" type="text" inputmode="decimal" value="${esc(e.step)}"></div>
      <div id="ex_scalebox" ${timed ? "hidden" : ""}>
        <label class="lbl" for="sc_vals">Weight scale (kg, optional)</label>
        <textarea id="sc_vals" rows="3" placeholder="Weights the machine can select, lowest first, separated by spaces. Empty = fixed step.">${esc(e.scale ? e.scale.values.join("  ") : "")}</textarea>
      </div>
      <div class="frow"><label for="ex_cue">Form cue</label><input id="ex_cue" type="text" value="${esc(e.cue)}" placeholder="one line, optional"></div>
      ${isNew ? `<div class="frow"><label for="ex_range" id="ex_range_lbl">Reps</label><input id="ex_range" type="text" value="8-12" placeholder="8-12"></div>
      <div class="lbl">Add to workout</div><div class="checks">${letters}</div>` : ""}
      <button class="btn primary wide" data-act="exsave" data-ex="${esc(id)}">Save</button>
      <button class="btn wide" data-act="close">Cancel</button>
      ${!isNew && e.custom ? `<button class="btn wide" data-act="exdel" data-ex="${esc(id)}">Delete this exercise</button>` : ""}` };
  },
  extype: () => "norender",
  exsave: (_, el) => {
    const id = el.dataset.ex;
    const isNew = !id;
    const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
    const name = $("#ex_name").value.trim();
    if (!name) { alert("Give the exercise a name."); return "norender"; }
    const step = num($("#ex_step").value);
    if (!(step > 0)) { alert("Step must be a number above 0."); return "norender"; }
    const type = isNew ? $("#ex_type").value : db.exercises[id].type;
    let scale = null;
    const raw = ($("#sc_vals").value || "").trim();
    if (raw && type !== "timed") {
      const toks = raw.split(/[;\s]+|,\s+/).filter(Boolean);
      if (toks.some((t) => !/^\d+([.,]\d+)?$/.test(t))) { alert("Weight scale: use numbers separated by spaces, e.g. 9 14 18 23"); return "norender"; }
      scale = { unit: "kg", values: [...new Set(toks.map((t) => parseFloat(t.replace(",", "."))))].sort((a, b) => a - b) };
    }
    const curRaw = $("#ex_cur").value.trim();
    const cur = curRaw === "" ? null : num(curRaw);
    if (curRaw !== "" && cur === null) { alert("Current weight must be a number."); return "norender"; }
    let e, exId = id;
    if (isNew) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "exercise";
      exId = base; for (let n = 2; db.exercises[exId]; n++) exId = base + "_" + n;
      e = db.exercises[exId] = { name, type, step, cue: "", note: "", last: null, scale: null, custom: true };
    } else e = db.exercises[id];
    e.name = name; e.step = step; e.cue = $("#ex_cue").value.trim(); e.scale = scale;
    if (cur !== null) {
      const before = e.last ? (e.type === "timed" ? e.last.top : e.last.kg) : null;
      if (cur !== before) L.setCurrent(e, cur);
    }
    if (isNew) {
      const rng = $("#ex_range").value.match(/(\d+)\s*[-–]?\s*(\d+)?/);
      const min = rng ? +rng[1] : (type === "timed" ? 20 : 8), max = rng && rng[2] ? +rng[2] : (type === "timed" ? min : Math.max(min, 12));
      for (const c of document.querySelectorAll(".ex_in:checked")) {
        const w = db.workouts[c.value];
        w.items.push({ ex: exId, sets: w.items[0] ? w.items[0].sets : 1, min, max });
      }
    }
    persist(); ui.dialog = null;
  },
  exdel: (_, el) => {
    const id = el.dataset.ex;
    ui.dialog = { title: `Delete ${db.exercises[id].name}?`, ok: false, body: `<p>It will be removed from every workout. Past results stay in the saved data.</p>
      <button class="btn primary wide" data-act="exdelnow" data-ex="${esc(id)}">Delete</button><button class="btn wide" data-act="close">Cancel</button>` };
  },
  exdelnow: (_, el) => {
    const id = el.dataset.ex;
    for (const w of Object.values(db.workouts)) w.items = w.items.filter((i) => i.ex !== id);
    delete db.exercises[id]; if (ui.active === id) setActive(null);
    persist(); ui.dialog = null;
  },
  padd: (_, el) => {
    const l = el.dataset.l, w = db.workouts[l];
    const opts = Object.entries(db.exercises).filter(([id]) => !w.items.some((i) => i.ex === id))
      .map(([id, e]) => `<button class="btn wide" data-act="paddnow" data-l="${l}" data-ex="${id}">${esc(e.name)}</button>`).join("");
    ui.dialog = { title: `Add to workout ${l}`, ok: false, body: `${opts || "<p>All exercises are already in this workout.</p>"}<button class="btn wide" data-act="close">Cancel</button><p class="small">New exercises are created in Settings → Exercises.</p>` };
  },
  paddnow: (_, el) => {
    const w = db.workouts[el.dataset.l], id = el.dataset.ex, e = db.exercises[id];
    let ref = null;
    for (const x of Object.values(db.workouts)) { const f = x.items.find((i) => i.ex === id); if (f) { ref = f; break; } }
    const min = ref ? ref.min : e.type === "timed" ? 20 : e.type === "bodyweight" ? 10 : 8;
    const max = ref ? ref.max : e.type === "timed" ? min : e.type === "bodyweight" ? 12 : 10;
    w.items.push({ ex: id, sets: w.items[0] ? w.items[0].sets : 1, min, max });
    persist(); ui.dialog = null;
  },
  premove: (_, el) => {
    const l = el.dataset.l, i = +el.dataset.i, it = db.workouts[l].items[i];
    ui.dialog = { title: `Remove ${db.exercises[it.ex].name}?`, ok: false, body: `<p>Takes it out of workout ${l} only. Its saved results are kept.</p>
      <button class="btn primary wide" data-act="premovenow" data-l="${l}" data-i="${i}">Remove</button><button class="btn wide" data-act="close">Cancel</button>` };
  },
  premovenow: (_, el) => { db.workouts[el.dataset.l].items.splice(+el.dataset.i, 1); persist(); ui.dialog = null; },
  prange: (_, el) => {
    const it = db.workouts[el.dataset.l].items[+el.dataset.i], ex = db.exercises[it.ex];
    if (ex.type === "timed") {
      const v = prompt(`Starting time for ${ex.name} (seconds). After that the target is your last best + ${ex.step} s.`, it.min);
      const n = parseInt(v, 10);
      if (v != null && n > 0) { it.min = n; it.max = n; persist(); }
      return;
    }
    const v = prompt(`Rep range for ${ex.name} (min-max)`, `${it.min}-${it.max}`);
    const m = v && v.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);
    if (v != null && m && +m[1] > 0 && +m[2] >= +m[1]) { it.min = +m[1]; it.max = +m[2]; persist(); }
    else if (v != null) alert("Use the form 8-10.");
  },
  close: () => { ui.dialog = null; },
  noop: () => "norender",
  focusnote: () => { const n = $("#xnote"); if (n) { n.focus(); n.select(); } return "norender"; },
  rest: () => { startRest(); return "norender"; },
  finish: () => {
    const s = session(); if (!s) return;
    const w = workout();
    const st = w.items.map((it) => L.itemState(s, it).status);
    const done = st.filter((x) => x === "done").length, skipped = st.filter((x) => x === "skipped").length, open = st.length - done - skipped;
    const parts = [`${done} of ${st.length} exercises done`]; if (skipped) parts.push(`${skipped} skipped`); if (open) parts.push(`${open} not done`);
    ui.dialog = { title: `Finish workout ${ui.letter}?`, ok: false, body: `<p>${parts.join(", ")}.</p>
      <p class="small">Your results are saved and become the starting point for next time.</p>
      <button class="btn primary wide" data-act="finishnow">Finish workout</button><button class="btn wide" data-act="close">Keep going</button>` };
  },
  finishnow: () => {
    const s = session(); if (!s) { ui.dialog = null; return; }
    L.finishSession(db, s); persist();
    ui.letter = L.nextLetter(db); setActive(null); ui.restEnd = null;
    ui.dialog = { title: "Workout logged", body: `<p>Nice. Next time: workout ${ui.letter} · ${esc(workout().name)}.</p>`, ok: true };
  },
  psets: (_, el) => {
    const it = db.workouts[el.dataset.l].items[+el.dataset.i];
    it.sets = Math.min(5, Math.max(1, it.sets + +el.dataset.d)); persist();
  },
  allsets: (_, el) => { db.workouts[el.dataset.l].items.forEach((it) => (it.sets = Math.max(it.sets, 3))); persist(); },
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
  if (field === "kg") d.kg = L.stepWeight(ex, d.kg || 0, dir);
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
  if (t.id === "ex_type") {
    const timed = t.value === "timed";
    $("#ex_scalebox").hidden = timed;
    document.querySelector('label[for="ex_cur"]').textContent = timed ? "Current best (s)" : "Current weight (kg)";
    document.querySelector('label[for="ex_step"]').textContent = timed ? "Step (s)" : "Step (kg)";
    $("#ex_step").value = timed ? 5 : 2.5; $("#ex_range").value = timed ? "20" : "8-12";
    document.getElementById("ex_range_lbl").textContent = timed ? "Start (s)" : "Reps";
  }
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
