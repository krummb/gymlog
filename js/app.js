import { load, save, exportJson, importJson, mergeData, missingSessions } from "./store.js";
import * as L from "./logic.js";
import { GUIDES } from "./guides.js";
import * as Sync from "./sync.js";
import { ALTS, CATS, CAT_ORDER, REST_TEXT } from "./alts.js";
import { DB_SCALE } from "./seed.js";

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
const ui = { overUntil: 0, screen: "today", letter: null, active: null, draft: null, restEnd: null, dialog: null, live: null, openCats: new Set() };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persist = () => { save(db); Sync.touch(db); };

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
  return s && s.workout === ui.letter && (s.program || db.activeProgram) === db.activeProgram ? s : null;
}
const prog = () => db.programs[db.activeProgram];
function workout() { return db.workouts[ui.letter]; }
const items = () => L.sessionItems(workout(), session() || (ui.short && workout().short && workout().short.length ? { short: true, entries: {} } : null)); // today's exercises (program + today-only swaps/additions)

function pickLetter() {
  const open = L.openSession(db);
  ui.letter = open ? open.workout : L.nextLetter(db);
}

function firstOpenItem() {
  const s = session();
  return items().find((it) => !["done", "skipped"].includes(L.itemState(s, it).status)) || null;
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
  if (ui.short && hasShort()) s.short = true;
  return s;
}

// ---------- render ----------
function render() {
  const app = $("#app");
  const scroll = app.querySelector(".body")?.scrollTop || 0;
  const today_ = ui.screen === "today";
  app.innerHTML = `
    <header class="title"><span class="ttl">${esc(titleText())}</span><span class="restclock" id="restclock"></span></header>
    <main class="body">${today_ ? today() : ui.screen === "programs" ? programs() : ui.screen === "exercises" ? exercisesScreen() : settings()}</main>
    <footer>
      ${today_ ? fkeys() : ""}

      ${today_ ? drivesBar() : ""}
      <nav class="menu">
        <button data-act="screen" data-v="today" class="${ui.screen === "today" ? "on" : ""}"><u>T</u>oday</button>
        <button data-act="screen" data-v="programs" class="${ui.screen === "programs" ? "on" : ""}"><u>P</u>rograms</button>
        <button data-act="screen" data-v="exercises" class="${ui.screen === "exercises" ? "on" : ""}"><u>E</u>xercises</button>
        <button data-act="screen" data-v="settings" class="${ui.screen === "settings" ? "on" : ""}"><u>S</u>ettings</button>
      </nav>
    </footer>
    ${ui.dialog ? dialog() : ""}
    ${ui.live ? liveView() : ""}`;
  const b = app.querySelector(".body");
  if (b) b.scrollTop = scroll;
  app.querySelectorAll("img.gimg").forEach(wireImg);
  tick();
  if (ui.live) liveTick();
}

// "GymLog\wo-A\Up-A_Push"
function titleText() {
  if (ui.screen !== "today") return "GymLog\\" + { programs: "Programs", exercises: "Exercises", settings: "Settings" }[ui.screen];
  const [a, ...b] = workout().name.split(/\s+-\s+/);
  return `GymLog\\${prog().code}\\wo-${ui.letter}\\${a.trim().replace(/\s+/g, "-")}${b.length ? "_" + b.join("_").trim().replace(/\s+/g, "-") : ""}`;
}
const shortName = (l) => db.workouts[l].name.split(/\s+-\s+/)[0] || l;

// Pictures are optional: show an image once it loads, keep the placeholder otherwise
function wireImg(img) {
  const ok = () => { img.hidden = false; img.closest(".gwrap")?.classList.add("ok"); };
  img.onload = ok;
  if (img.complete && img.naturalWidth) ok();
}

function drivesBar() {
  const doneSet = L.cycleDone(db);
  const open = L.openSession(db);
  const drives = L.LETTERS.map((l) => {
    const isDone = doneSet.has(l) && !(open && open.workout === l);
    const [a, ...b] = db.workouts[l].name.split(/\s+-\s+/);
    return `<button class="drive ${l === ui.letter ? "sel" : ""} ${isDone ? "done" : ""}" data-act="letter" data-v="${l}" aria-label="Workout ${l}, ${esc(db.workouts[l].name)}${isDone ? ", done" : ""}"><span class="dl">${l}</span><span class="dn">${esc(a)}${b.length ? `<small>${esc(b.join(" - "))}</small>` : ""}</span></button>`;
  }).join("");

  return `<div class="drives">${drives}</div>`;
}

function today() {
  const s = session();
  const w = workout(), its = items();
  if (!ui.active || (ui.active !== WARM && !its.some((i) => i.ex === ui.active))) {
    const fresh = !s || !!s.warmStart || (!s.warmup && !Object.keys(s.entries).length);
    setActive(fresh ? WARM : firstOpenItem()?.ex || null);
  }
  const doneCount = its.filter((it) => ["done", "skipped"].includes(L.itemState(s, it).status)).length;

  const warm = s?.warmup;
  const warming = !!s?.warmStart;
  const wAt = s?.warmAt ? new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const wMin = s?.warmSec ? Math.max(1, Math.round(s.warmSec / 60)) + " min" : "done";
  const wm = s?.warmEx ? s.warmEx + " · " : "";
  const wInfo = warm ? wm + (wAt && s.warmSec ? `${wAt} · ${wMin}` : wMin) : warming ? wm + `${wAt} · running` : s?.warmEx || "bike / row";
  const wActive = ui.active === WARM;
  const wIc = wActive ? I.cur : warm ? I.check : I.page("var(--ic-page)");
  const rows = [`<button class="row ${warm ? "done" : "todo"} ${wActive ? "active" : ""}" data-act="warmup">
      <span class="ic">${wIc}</span><span>Warm-up 5–10 min</span><span>${wInfo}</span><span>${warm ? "1/1" : "0/1"}</span></button>`];
  its.forEach((it, i) => {
    const ex = db.exercises[it.ex];
    const st = L.itemState(s, it);
    const isActive = it.ex === ui.active;
    let cls = "todo", ic = I.page("var(--ic-page2)"), info = L.targetText(db, it).replace(/ · /, " · ");
    if (st.status === "done") {
      cls = "done"; ic = I.check;
      info = L.setsSummary(ex, st.sets, false);
    } else if (st.status === "skipped") { cls = "skipped"; ic = I.skip; info = "skipped"; }
    if (isActive) { cls += " active"; if (st.status === "todo") ic = I.cur; }
    rows.push(`<button class="row ${cls} ${i % 2 ? "" : "alt"}" data-act="pick" data-v="${it.ex}">
      <span class="ic">${ic}</span><span class="nm"><span class="nt">${esc(ex.name)}</span>${it.ss ? '<i class="tag">SS</i>' : ""}${it.opt ? '<i class="tag">opt</i>' : ""}${it.today ? '<i class="tag">today</i>' : ""}</span><span>${esc(info)}</span><span>${st.sets.length}/${it.sets}</span></button>`);
  });

  const allClosed = doneCount === its.length;
  const modeRow = s && !allClosed ? modeSwitch() : "";
  const fin = allClosed || s ? `<button class="btn finish ${allClosed ? "primary" : ""}" data-act="finish">${allClosed ? "Finish workout " + ui.letter : "Finish workout early"}</button>` : "";
  const dt = ui.active === WARM ? warmDetail() : ui.active ? detail() : { top: "", info: "" };
  // Phone sits in a pouch, only the top ~4/7 of the screen is reachable: controls first, reading next, the list last.
  return `
    ${dt.top}
    ${allClosed ? fin : ""}
    ${dt.info}
    <div class="pathbar">▾ <span>gym:\\${esc(w.name.replace(/\s+/g, ""))}\\*.*</span><span class="right">${isShort() ? '<b class="shorttag">short</b> · ' : ""}${L.sessionCountFor(db, ui.letter)} ${L.sessionCountFor(db, ui.letter) === 1 ? "session" : "sessions"} logged</span></div>
    <div class="panel">
      <div class="thead"><span></span><span>Name</span><span>Today</span><span>Sets</span></div>
      ${rows.join("")}
      <div class="status">${doneCount} / ${its.length} exercises done${s ? "" : " · not started"}</div>
    </div>
    ${allClosed ? "" : fin}${modeRow}`;
}

function exhead(title, sub) {
  return `<div class="exhead">
    <button class="btn nav" data-act="nav" data-v="-1" aria-label="Previous exercise">◂</button>
    <div class="exname">${title}${sub ? `<small class="${/^Set /.test(sub) ? "setno" : ""}">${sub}</small>` : ""}</div>
    <button class="btn nav" data-act="nav" data-v="1" aria-label="Next exercise">▸</button></div>`;
}

// Superset partner of an item (the neighbour that is also marked SS), or null
function partnerOf(item) {
  if (!item.ss) return null;
  const its = items(), ix = its.findIndex((i) => i.ex === item.ex);
  const nx = its[ix + 1], pv = its[ix - 1];
  return nx && nx.ss && !(pv && pv.ss) ? nx : pv && pv.ss ? pv : null;
}

// What follows the next logged set of an item: the superset partner without rest, rest between sets,
// or (last set) rest between exercises. Worked out before the set is logged.
function plan(item) {
  const s = session(), ex = db.exercises[item.ex];
  const n = L.itemState(s, item).sets.length + 1, last = n >= item.sets;
  if (!last && sideOf(ex, n) && n % 2 === 1 && ex.per !== "direction") return { sec: 0, next: item.ex, go: "other side" };
  const p = partnerOf(item), pst = p && L.itemState(s, p);
  if (pst && pst.status === "todo") return pst.sets.length < n ? { sec: 0, next: p.ex, go: db.exercises[p.ex].name } : { sec: L.restFor(db, ex), next: p.ex };
  if (last) {
    const more = items().some((it) => it.ex !== item.ex && L.itemState(s, it).status === "todo");
    return more ? { sec: db.settings.restSec, next: null, between: true } : { sec: 0, next: null };
  }
  return { sec: L.restFor(db, ex), next: item.ex };
}
const planText = (p) => (p.go ? `then ${p.go}` : p.sec ? `then rest ${fmtRest(p.sec)}${p.between ? " · next exercise" : ""}` : "last set");

// Log one set; returns true if the exercise is now complete
function logSet(item, kg, reps) {
  const s = ensureSession(); if (!s) return null;
  const ex = db.exercises[item.ex];
  const p = plan(item);
  const e = L.entryFor(s, item.ex);
  e.sets.push({ kg: ex.type === "timed" && (!ex.fixed || ex.noKg) ? null : (kg || 0), reps });
  const done = e.sets.length >= item.sets;
  if (done) e.status = "done";
  persist();
  return { done, p };
}

// Some sets logged but fewer than planned: F8 ends the exercise early (keeps the sets) instead of skipping it
function stopEarly() {
  const s = session();
  const e = s && ui.active && ui.active !== WARM ? s.entries[ui.active] : null;
  return !!(e && e.sets.length && L.itemState(s, items().find((i) => i.ex === ui.active) || { ex: ui.active, sets: 99 }).status === "todo");
}

function fkeys() {
  return `<div class="fkeys">
      <button class="btn" data-act="guide"><i class="fk">F3</i>Guide</button>
      <button class="btn" data-act="addtoday"><i class="fk">F4</i>Add</button>
      <button class="btn" data-act="rest"><i class="fk">F5</i>Timer</button>
      <button class="btn" data-act="swap"><i class="fk">F6</i>Swap</button>
      <button class="btn" data-act="skip"><i class="fk">F8</i>${stopEarly() ? "Done" : "Skip"}</button>
    </div>`;
}

const WARM = "__warm";
const MACHINES = ["Bike", "Row", "SkiErg", "Assault"];
const isMachine = (id) => id === "cardio_z2" || id === "cardio_4x4";
const MFIELDS = [["dist", "Distance", "km"], ["kcal", "Calories", "kcal"], ["hr", "Avg heart rate", "bpm"], ["watts", "Avg watts", "W"], ["pace", "Avg pace", "/500 m"], ["rate", "Avg rate", "spm/rpm"], ["level", "Level / damper", ""]];
const machChips = (cur, act) => `<div class="seg mchips">${MACHINES.map((m) => `<button class="btn ${cur === m ? "primary" : ""}" data-act="${act}" data-v="${m}">${m}</button>`).join("")}</div>`;
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

const hasShort = () => !!(workout().short && workout().short.length);
const isShort = () => { const s = session(); return hasShort() && (s ? !!s.short : !!ui.short); };
// Full / Short switch (only when the PT has written a short version of this workout)
function modeSwitch() {
  if (!hasShort()) return "";
  const sh = isShort();
  return `<div class="seg wmode"><button class="btn ${sh ? "" : "primary"}" data-act="wmode" data-v="full">Full · ${workout().items.length} exercises</button><button class="btn ${sh ? "primary" : ""}" data-act="wmode" data-v="short">Short · ${workout().short.length}</button></div>`;
}

function warmDetail() {
  const s = session();
  const running = !!s?.warmStart;
  const done = !!s?.warmup;
  const elapsed = running ? Math.floor((Date.now() - Date.parse(s.warmStart)) / 1000) : done ? s.warmSec || 0 : 0;
  const top = `
    <div class="panel">
      ${exhead("Warm-up", done ? "done" : running ? "running" : "")}
      <div class="detail">
        <div class="warmclock ${elapsed >= 300 ? "reached" : ""}" id="warmclock">${fmtClock(elapsed)}</div>
        <div class="last">${done ? (s.warmSec ? "Warm-up done · " + fmtClock(s.warmSec) + (s.warmAt ? " · started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "") : "Warm-up done") : running && s.warmAt ? "Started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) + " · target 5–10 min" : "Target 5–10 min · easy bike or row, enough to feel warm"}</div>
        ${machChips(s?.warmEx, "warmex")}
        ${done ? `<button class="btn" data-act="warmundo">Undo warm-up</button>`
          : running ? `<button class="btn primary log" data-act="warmstop">Stop · warm-up done</button>`
          : `<button class="btn primary log" data-act="warmstart">Start warm-up</button><button class="btn" data-act="warmdone">Mark done (no timer)</button>`}
        ${modeSwitch()}
        ${elapsed >= 300 && running ? `<div class="hint">5 min reached. Stop whenever you feel warm.</div>` : ""}
      </div>
    </div>`;
  return { top, info: "" };
}

function machinePanel(id, s) {
  const m = (s && s.entries[id] && s.entries[id].machine) || {};
  return `<div class="mach"><div class="mhead">Machine screen <span class="small">(optional)</span></div>${machChips(m.type, "machex")}
    <div class="mgrid">${MFIELDS.map(([f, l, u]) => `<label class="mf"><span>${l}${u ? " <i>" + u + "</i>" : ""}</span><input class="mi" data-ex="${id}" data-f="${f}" type="text" inputmode="${f === "pace" ? "text" : "decimal"}" value="${esc(m[f] || "")}"></label>`).join("")}</div></div>`;
}

function detail() {
  const w = workout();
  const item = items().find((i) => i.ex === ui.active);
  const ex = db.exercises[item.ex];
  const s = session();
  const st = L.itemState(s, item);
  const t = L.target(db, item);
  const d = draftFor(item);
  const timed = ex.type === "timed";
  const setNo = st.sets.length + 1;
  const finished = st.status === "done" || st.status === "skipped";

  const hand = L.perHand(ex) ? "/hand" : "";
  const tgt = timed
    ? (ex.fixed ? `Today: ${L.setsOf(ex, item)} × ${dur(t.reps)}${L.grp(ex) === 2 ? " per " + ex.per : L.grp(ex) === 4 ? " each direction" : ""}${t.kg ? " +" + L.fmtKg(t.kg) + " " + L.unitOf(ex) : ""}`
      : t.first ? `First time: start at ${t.reps} s` : `Today: ${L.setsOf(ex, item)} × ${t.reps} s ↑`)
    : t.first
      ? (ex.type === "bodyweight" ? `First time: ${item.min === item.max ? item.min : item.min + "–" + item.max} ${ex.repUnit || "reps"} per set, ${prog().light ? "easy, 3–4 reps in reserve" : "stop about 1 rep before failure"}` : `First time: pick a weight that leaves 3–4 reps in reserve`)
      : `Today: ${t.kg ? L.fmtKg(t.kg) + " " + L.unitOf(ex) + hand : "BW"} · ${item.sets} × ${L.rangeText(ex, item)}${t.up ? " ↑" : ""}`;

  const logged = st.sets.map((x, i) => `<div class="logged">[x] Set ${L.setNoOf(ex, i + 1)}${L.grp(ex) > 1 ? " · " + sideOf(ex, i + 1).toLowerCase() : ""} · ${timed ? dur(x.reps) + (x.kg ? " +" + L.fmtKg(x.kg) + " " + L.unitOf(ex) : "") : (x.kg ? L.fmtKg(x.kg) + " " + L.unitOf(ex) : "BW") + " × " + x.reps + (ex.repUnit ? " " + ex.repUnit : "")}</div>`).join("");

  const stepper = (field, label, val, color) => `
    <div class="stepper"><div class="sr">
      <button class="btn sq" aria-label="Less ${label}" data-act="dec" data-v="${field}">${I.minus}</button>
      <div class="val" style="color:${color}">${val}</div>
      <button class="btn sq" aria-label="More ${label}" data-act="inc" data-v="${field}">${I.plus}</button></div></div>`;

  const u = L.unitOf(ex), perU = L.perHand(ex) ? "/hand" : "";
  const kgVal = d.kg == null || d.kg === 0
    ? (ex.type === "weight" ? `<b>0</b><i>${u}${perU}</i>` : timed ? `<i>+</i><b>0</b><i>${u}</i>` : `<b>BW</b>`)
    : `${ex.type === "weight" ? "" : "<i>+</i>"}<b>${L.fmtKg(d.kg)}</b><i>${u}${perU}</i>`;
  const repVal = timed ? (d.reps >= 120 ? `<b>${fmtClock(d.reps)}</b>` : `<b>${d.reps}</b><i>s</i>`) : `<i>×</i><b>${d.reps}</b>${ex.repUnit ? `<i>${esc(ex.repUnit)}</i>` : ex.per === "leg" || ex.per === "side" ? `<i>/${ex.per}</i>` : ""}`;
  const pl = finished ? null : plan(item);
  // Hint line: manual-progression cases keep their advice; superset items name their partner; the rest list alternatives.
  const its = items();
  const partner = partnerOf(item);
  const alts = (ALTS[item.ex] || []).filter((id) => db.exercises[id] && !its.some((i) => i.ex === id)).slice(0, 2).map((id) => db.exercises[id].name);
  // PT target from next.json, shown until the exercise has been logged after the PT's review
  const ptx = ptLine(item, t);
  const hint = ptx ? ptx : timed
    && !(ex.fixed && ex.noKg) ? (ex.fixed ? `Hold ${item.min} s. Once it is easy, add weight with the + button.` : `Next time: beat your best by +${ex.step} s`)
    : partner ? `Superset with ${db.exercises[partner.ex].name}: alternate sets.`
      : alts.length ? `Alternative: ${alts.join(" or ")} (F6 Swap).` : "";

  const top = `
    <div class="panel">
      ${exhead(esc(ex.name), st.status === "skipped" ? "skipped" : finished ? "done" : `Set ${L.setNoOf(ex, setNo)} of ${L.setsOf(ex, item)}${sideOf(ex, setNo) ? " · " + sideOf(ex, setNo).toLowerCase() : ""}`)}
      <div class="detail">
        ${finished ? `<button class="btn" data-act="undo">Undo last</button>` : `
          <div class="steppers">
            ${timed && (!ex.fixed || ex.noKg) ? "" : stepper("kg", "weight", kgVal, "var(--blue)")}
            ${stepper("reps", timed ? "seconds" : L.repCap(ex).toLowerCase(), repVal, "var(--green)")}
          </div>
          <div class="logrow">${timed
            ? `<button class="btn primary log" data-act="liveopen">▶ Set ${L.setNoOf(ex, setNo)} <span class="of">(of ${L.setsOf(ex, item)})</span>${L.grp(ex) > 1 ? " · " + esc(sideOf(ex, setNo).toLowerCase()) : ""} · live timer</button><button class="btn undo" data-act="log">Log${L.grp(ex) > 1 ? " " + esc(sideOf(ex, setNo).split(" ")[0].toLowerCase()) : ""}</button>`
            : `<button class="btn primary log" data-act="log">Log set ${setNo} <span class="of">(of ${item.sets})</span> · ${planText(pl)}</button>`}
          ${st.sets.length ? `<button class="btn undo" data-act="undo">Undo</button>` : ""}</div>`}
      </div>
    </div>`;
  const info = `
    <div class="panel">
      <div class="detail">
        <div class="dhead">
          <button class="img gwrap" data-act="guide" aria-label="Open position guide"><span class="ph">IMG<br>guide</span><img class="gimg" src="img/${item.ex}-1.webp" alt="" hidden></button>
          <div class="dinfo"><div class="tgt">${esc(tgt)}</div><div class="last">${esc(L.lastText(ex))}</div><div class="cue">${esc(ex.cue)}</div></div>
        </div>
        ${logged}
        ${isMachine(item.ex) ? machinePanel(item.ex, s) : ""}
        <div class="noterow"><label for="xnote">Note</label><input id="xnote" data-ex="${item.ex}" value="${esc(ex.note)}" placeholder="seat height, notch, how it felt…"></div>
        ${hint ? `<div class="hint">${esc(hint)}</div>` : ""}
      </div>
    </div>`;
  return { top, info };
}

// "90" or "1:30" -> seconds (10 s .. 15 min), else 0
function parseRest(v) {
  const m = String(v).trim().match(/^(?:(\d+):(\d{1,2})|(\d+))$/);
  const sec = m ? (m[3] != null ? +m[3] : +m[1] * 60 + +m[2]) : 0;
  return sec >= 10 && sec <= 900 ? sec : 0;
}
const fmtRest = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function programList() {
  const list = Object.entries(db.programs).filter(([, p]) => !p.deleted);
  return `<div class="panel"><div class="pathbar">▾ gym:\\programs\\*.*</div><div class="detail">
    ${list.map(([id, p]) => {
      const on = id === db.activeProgram;
      const n = Object.values(db.sessions).filter((s) => s.finishedAt && s.program === id).length;
      return `<div class="progrow ${on ? "on" : ""}"><span class="pcode">${esc(p.code)}</span><span class="pname">${esc(p.name)}<small>${n} session${n === 1 ? "" : "s"}${on ? " · active" : ""}</small></span>
        <span class="pbtns">${on ? "" : `<button class="btn" data-act="progswitch" data-v="${id}">Switch to</button>`}<button class="btn" data-act="progmenu" data-v="${id}" aria-label="More for ${esc(p.name)}">…</button></span></div>`;
    }).join("")}
    <p class="small">Exercises, weights and history are shared by all programs. Each program keeps its own place in the A–D rotation. Below: the workouts of the active program.</p>
  </div></div>`;
}

function programs() {
  return programList() + L.LETTERS.map((l) => {
    const w = db.workouts[l];
    return `<div class="panel">
      <button class="pathbar wname" data-act="wrename" data-l="${l}" aria-label="Rename workout ${l}">▾ gym:\\${l} · ${esc(w.name)} <span class="small">✎</span></button>
      <div class="thead prog"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Step</span><span></span></div>
      ${w.items.map((it, i) => {
        const ex = db.exercises[it.ex];
        const timed = ex.type === "timed";
        return `<div class="prow ${i % 2 ? "" : "alt"}"><span class="nmcell"><span class="nm">${esc(ex.name)}${it.ss ? '<i class="tag">SS</i>' : ""}${it.opt ? '<i class="tag">opt</i>' : ""}</span><button class="restbtn ${ex.rest ? "custom" : ""}" data-act="prest" data-ex="${it.ex}" aria-label="Rest time for ${esc(ex.name)}">rest ${fmtRest(L.restFor(db, ex))}</button></span>
          <span class="mini"><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="-1" aria-label="Fewer sets">−</button><b>${L.setsOf(ex, it)}</b><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="1" aria-label="More sets">+</button></span>
          <span><button class="btn stepbtn" data-act="prange" data-l="${l}" data-i="${i}" aria-label="Edit reps">${timed ? it.min + (ex.fixed ? "s" : "s+") : it.min === it.max ? it.min : it.min + "–" + it.max}</button></span>
          <span>${ex.scale ? `<button class="btn stepbtn" data-act="exdlg" data-ex="${it.ex}">scale</button>` : `<button class="btn stepbtn" data-act="pstep" data-ex="${it.ex}">${L.fmtKg(ex.step)}${timed ? "s" : ""}</button>`}</span>
          <span><button class="btn stepbtn xbtn" data-act="premove" data-l="${l}" data-i="${i}" aria-label="Remove ${esc(ex.name)} from workout ${l}">×</button></span></div>`;
      }).join("")}
      <div class="status"><button class="btn" data-act="allsets" data-l="${l}">All to 3 sets</button> <button class="btn" data-act="padd" data-l="${l}">+ Add exercise</button></div>
      <div class="shortlist small">${w.short && w.short.length
        ? `<b>Short version</b> (from the PT): ${w.short.map((it) => `${esc(db.exercises[it.ex] ? db.exercises[it.ex].name : it.ex)} ${db.exercises[it.ex] ? L.setsOf(db.exercises[it.ex], it) : it.sets}×${db.exercises[it.ex] && db.exercises[it.ex].type === "timed" ? dur(it.min) : it.min === it.max ? it.min : it.min + "–" + it.max}`).join(" · ")}`
        : "No short version yet."}</div>
    </div>`;
  }).join("") + `<p class="small">Tap “rest” under a name to set the rest time for that exercise (it applies wherever the exercise is used; default is set in Settings). Tap reps to change the range, a step size to change it (one machine notch), or “scale” for machines with a weight stack. Timed exercises: “60s” is a fixed hold time (plank); “20s+” is a starting time, then the target is your last best + the step. SS = superset with the next row.</p>`;
}

function ptTarget(id) {
  const n = Sync.nextTargets(), t = n && n.targets && n.targets[id], ex = db.exercises[id];
  if (!t) return null;
  const last = ex && ex.last && !ex.last.baseline && ex.last.date ? ex.last.date.slice(0, 10) : "";
  return !last || last <= t.setOn ? t : null;
}
// PT advice without sentences that only repeat the last results (the "Last:" line shows those)
const ptAdvice = (note) => (note || "").split(/(?<=\.)\s+(?=[A-Z])/).filter((s) => !/^(Reps were|Last logged|Typed start)\b/i.test(s.trim())).join(" ").trim();
// Does the PT target ("40 kg, 3 × 5-8", "bodyweight, 4 × 3", "2 × 65-70 s") say the same as the app's own target?
function ptSame(tx, item, t) {
  const kg = (tx.match(/(\d+(?:[.,]\d+)?)\s*kg/) || [])[1];
  const m = tx.match(/(\d+)\s*[×x]\s*(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!m) return false;
  const sets = +m[1], lo = +m[2], hi = m[3] ? +m[3] : lo;
  const appKg = t.kg || 0, ptKg = kg ? parseFloat(kg.replace(",", ".")) : 0;
  return sets === item.sets && lo === item.min && hi === item.max && ptKg === appKg;
}
function ptLine(item, t) {
  if (prog().light) return ""; // PT targets are for the training programs
  const n = ptTarget(item.ex); if (!n) return "";
  const adv = ptAdvice(n.note), same = ptSame(n.target || "", item, t);
  if (same && !adv) return "";
  return "PT: " + [same ? "" : n.target, adv].filter(Boolean).join(" · ");
}
// Made-up short code from a program name: initials + 4 (four-day split), unique
function progCode(name) {
  const base = (name.match(/[A-Za-z0-9]+/g) || ["P"]).map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "P";
  let code = base + "4", n = 2;
  while (Object.values(db.programs).some((p) => p.code === code)) code = base + n++;
  return code;
}
// Seconds as "45 s", or "4:00" from 2 minutes up
const dur = (s) => (s >= 120 ? fmtClock(s) : `${s} s`);
const sideOf = (ex, n) => (!ex || ex.type !== "timed" ? "" : ex.per === "direction" ? ["Front", "Back", "Left side", "Right side"][(n - 1) % 4]
  : ex.per === "leg" || ex.per === "side" ? `${n % 2 ? "Left" : "Right"} ${ex.per}` : "");
const catOf = (id) => { const c = (db.exercises[id] && db.exercises[id].cat) || CATS[id]; return CAT_ORDER.includes(c) ? c : "Other"; };
function progTags(id) {
  const ls = L.LETTERS.filter((l) => db.workouts[l].items.some((i) => i.ex === id));
  return ls.map((l) => `<i class="ptag">${l}</i>`).join("");
}
// How-to text (cue, steps, mistakes) and pictures of an exercise
function howHtml(id) {
  const ex = db.exercises[id], g = GUIDES[id];
  return g ? `
      <p class="gcue">${esc(g.cue)}</p>
      <div class="glbl">How</div>
      <ol class="gsteps">${g.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="glbl bad">Common mistakes</div>
      <p class="gbad">${esc(g.mistakes)}</p>` : `<p class="gcue">${esc(ex.cue)}</p>`;
}
const imgsHtml = (id) => `<div class="gimgs gwrap"><div class="guideimg ph">Image coming</div>${[1, 2].map((n) => `<img class="gimg" src="img/${id}-${n}.webp" alt="${esc(db.exercises[id].name)}, picture ${n}" hidden>`).join("")}</div>`;

function exercisesScreen() {
  const inProg = {};
  for (const l of L.LETTERS) for (const it of db.workouts[l].items) (inProg[it.ex] = inProg[it.ex] || []).push(l);
  const groups = new Map(CAT_ORDER.map((c) => [c, []]));
  for (const [id, e] of Object.entries(db.exercises)) {
    const c = catOf(id);
    groups.get(c).push([id, e]);
  }
  const out = [];
  for (const [c, list] of groups) {
    if (!list.length) continue;
    list.sort((a, b) => a[1].name.localeCompare(b[1].name));
    const open = ui.openCats.has(c), n = list.filter(([id]) => inProg[id]).length;
    out.push(`<button class="cathead" data-act="cat" data-v="${esc(c)}" aria-expanded="${open}"><span>${open ? "▾" : "▸"} ${esc(c)}</span><span class="rt">${list.length}${n ? ` · <b class="inprog">${n} in program</b>` : ""}</span></button>`);
    if (open) out.push(`<div class="scales">${list.map(([id, e]) => {
      const mode = e.type !== "timed" && e.scale && e.scale.values && e.scale.values.length ? `<span class="m-scale">scale</span>` : `<span class="m-step">step ${L.fmtKg(e.step)} ${e.type === "timed" ? "s" : "kg"}</span>`;
      const tag = progTags(id);
      return `<button class="srow" data-act="exdlg" data-ex="${id}"><span class="nm">${esc(e.name)}${tag}</span><span class="rt"><span class="m-wt">${esc(L.currentText(e))}</span> · ${mode} · ${fmtRest(L.restFor(db, e))}</span></button>`;
    }).join("")}</div>`);
  }
  return `<div class="panel"><div class="pathbar">▾ gym:\\exercises\\*.*</div><div class="detail">
    <p class="small">Tap a group to open it, an exercise to change its settings or read its how-to.</p>
    <p class="small"><i class="ptag">A</i> = used in workout A</p>
    <div class="cats">${out.join("")}</div>
    <button class="btn" data-act="exdlg" data-ex="">+ Add exercise…</button>
  </div></div>`;
}

function recentHtml() {
  const last = L.finishedSessions(db, true).slice(-3).reverse();
  if (!last.length) return `<p class="small">None yet.</p>`;
  const f = (iso) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
  return `<div class="recent">${last.map((s) => `<div><span class="rd">${esc(f(s.startedAt))}</span> · <b>${(L.programOf(db, s) || {}).code || ""} ${s.workout}</b> · ${esc(L.programOf(db, s) && L.programOf(db, s).workouts[s.workout] ? L.programOf(db, s).workouts[s.workout].name : "")}</div>`).join("")}</div>`;
}

function syncPanel() {
  const c = Sync.config(), on = Sync.configured();
  const when = c.last ? new Date(c.last).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : null;
  const status = Sync.busyNow() ? "Syncing…" : c.err ? `<span class="m-bad">Not synced: ${esc(c.err)}</span>` : on ? (c.pending ? "Changes not sent yet (sent when you finish a workout or leave the app)" : `Synced ${when}`) : "Off";
  return `<p class="small">Copies your results to a private GitHub repo (gymlog.json + a readable log.md) so they can be read without exporting. Needs a repo and a fine-grained token with Contents: read and write on that repo only. The token stays on this phone and is not part of backups.</p>
    <div class="noterow"><label for="syncrepo">Repo</label><input id="syncrepo" value="${esc(c.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <div class="noterow"><label for="synctoken">Token</label><input id="synctoken" type="password" value="" placeholder="${on ? "saved (paste to replace)" : "github_pat_…"}" autocomplete="off"></div>
    <p class="small">${status}</p>
    <p class="small">PT targets: ${(() => { const n = Sync.nextTargets(); return n ? `${Object.keys(n.targets || {}).length} exercises, updated ${esc(String(n.updated || "").replace("T", " "))}` : "none loaded yet"; })()}</p>
    ${c.conflict ? `<button class="btn primary" data-act="syncrestore">Restore from GitHub</button><p class="small">Adds the repo's workouts to this phone (nothing here is lost), then syncs.</p>` : ""}
    <button class="btn" data-act="syncnow">Sync now</button>${on ? '<button class="btn" data-act="syncoff">Remove token</button>' : ""}`;
}

function settings() {
  return `<div class="panel"><div class="pathbar">▾ gym:\\settings</div><div class="detail">
    <div class="frow"><label for="rest">Rest between exercises (s)</label><input id="rest" type="number" inputmode="numeric" value="${db.settings.restSec}"></div>
    <p class="small">Used after the last set of an exercise, before the next one. Rest between sets is set per exercise (Programs, Exercises or the info sheet); exercises without one use this value too.</p>
    <div class="setlabel">Appearance</div>
    <div class="seg">${MODES.map((m) => `<button class="btn ${(db.settings.mode || "auto") === m ? "primary" : ""}" data-act="mode" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>
    <div class="setlabel">Live timer beeps</div>
    <div class="seg">${[["off", "Off"], ["on", "On"]].map(([v, t]) => `<button class="btn ${(db.settings.beeps ? "on" : "off") === v ? "primary" : ""}" data-act="beeps" data-v="${v}">${t}</button>`).join("")}</div>
    <p class="small">The last 3 seconds of every countdown flash yellow either way.</p>
    <div class="setlabel">Recent workouts</div>
    ${recentHtml()}
    <div class="setlabel">General note</div>
    <textarea id="gnote" rows="2" class="gnote">${esc(db.settings.globalNote)}</textarea>
    <div class="setlabel">Sync to GitHub</div>
    ${syncPanel()}
    <div class="setlabel">Backup</div>
    <p class="small">Data lives on this phone. Export now and then to be safe.</p>
    <button class="btn" data-act="export">Export backup (.json)</button>
    <button class="btn" data-act="import">Import backup…</button>
    <input type="file" id="importfile" accept="application/json" hidden>
    <p class="small">${L.sessionCount(db)} sessions logged · version ${window.APP_VERSION || "?"}</p>
  </div></div>`;
}

function dialog() {
  const d = ui.dialog;
  return `<div class="overlay ${d.sheet ? "sheet" : ""}" data-act="close"><div class="win" role="dialog" aria-label="${esc(d.title)}" data-act="noop">
    <div class="title">${esc(d.title)}${d.tags || ""}<button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="detail">${d.body}${d.ok === false ? "" : '<button class="btn primary wide" data-act="close">OK</button>'}</div></div></div>`;
}

// ---------- live timer (timed exercises: prep → hold → rest → next set) ----------
let liveT = null, actx = null, wakeLock = null, lastBeep = null;
function beepInit() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} }
function beep(f = 880, d = 0.12) {
  if (!actx || !db.settings.beeps) return;
  try { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = 0.25; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d); } catch (e) {}
}
async function wake(on) {
  try { if (on && navigator.wakeLock && !wakeLock) wakeLock = await navigator.wakeLock.request("screen"); if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
}
function liveGo(phase, sec) {
  const lv = ui.live; lv.phase = phase; lv.t = Date.now(); lv.end = sec ? lv.t + sec * 1000 : null; lastBeep = null;
  if (phase === "prep") lv.end = lv.t + lv.prep * 1000;
  if (phase === "hold") { lv.goalHit = false; beep(1046, 0.35); }
  render(); liveTick();
}
function liveClose() { clearTimeout(liveT); wake(false); ui.live = null; }
function liveTick() {
  clearTimeout(liveT);
  const lv = ui.live; if (!lv) return;
  const now = Date.now(), el = document.getElementById("livebig"), ov = document.querySelector(".overlay.live");
  let hv = false;
  if (lv.phase === "prep" || lv.phase === "rest") {
    const left = Math.ceil((lv.end - now) / 1000);
    if (left <= 0) { liveGo(lv.phase === "rest" && lv.prep ? "prep" : "hold"); return; }
    if (left <= 3 && lastBeep !== left) { lastBeep = left; beep(660, 0.1); }
    hv = left <= 3;
    if (el) el.textContent = fmtClock(left);
  } else if (lv.phase === "hold") {
    const e = Math.floor((now - lv.t) / 1000), left = lv.goal - e;
    if (left <= 0 && !lv.goalHit) { lv.goalHit = true; beep(1046, 0.15); setTimeout(() => beep(1046, 0.15), 220); render(); return; }
    else if (left > 0 && left <= 3 && lastBeep !== left) { lastBeep = left; beep(660, 0.08); }
    hv = left > 0 && left <= 3;
    if (el) el.textContent = left > 0 ? fmtClock(left) : "+" + fmtClock(-left);
  }
  if (ov) ov.classList.toggle("hiviz", hv);
  liveT = setTimeout(liveTick, 200);
}
function liveView() {
  const lv = ui.live, ex = db.exercises[lv.ex], item = items().find((i) => i.ex === lv.ex);
  const s = session(), sets = s && s.entries[lv.ex] ? s.entries[lv.ex].sets : [];
  const of = item ? L.setsOf(ex, item) : 1, setNo = Math.min(of, L.setNoOf(ex, sets.length + (lv.phase === "done" ? 0 : 1)));
  const curN = sets.length + 1; // entry number (one per side)
  const kgTxt = lv.kg ? ` +${L.fmtKg(lv.kg)} ${L.unitOf(ex)}` : "";
  // Per-leg / per-side holds: one set per side, odd sets left, even sets right
  const sideTxt = sideOf(ex, curN);
  const side = sideTxt ? `<div class="lside">${sideTxt.toUpperCase()}</div>` : "";
  const st = (f, label, val) => `<div class="lstep"><span class="lcap">${label}</span><div class="sr">
      <button class="btn sq" data-act="livestep" data-f="${f}" data-v="-1" aria-label="Less ${label}">${I.minus}</button><div class="val">${val}</div>
      <button class="btn sq" data-act="livestep" data-f="${f}" data-v="1" aria-label="More ${label}">${I.plus}</button></div></div>`;
  let main = "";
  if (lv.phase === "setup") main = `${side}
      ${st("prep", "Get ready", `<b>${lv.prep}</b><i>s</i>`)}
      ${st("goal", ex.live || "Hold", lv.goal >= 120 ? `<b>${fmtClock(lv.goal)}</b>` : `<b>${lv.goal}</b><i>s</i>`)}
      ${ex.fixed && !ex.noKg ? st("kg", "Added weight", `<i>+</i><b>${L.fmtKg(lv.kg)}</b><i>${L.unitOf(ex)}</i>`) : ""}
      <button class="btn primary lbtn" data-act="livestart">▶ Start</button>`;
  else if (lv.phase === "prep") main = `${side}<div class="lphase prep">Get ready</div><div class="lbig prep" id="livebig"></div>
      <div class="lsub">then ${(ex.live || "hold").toLowerCase()} ${dur(lv.goal)}${kgTxt}</div><button class="btn lbtn" data-act="liveskiprest">Start now</button>`;
  else if (lv.phase === "hold") main = `${side}<div class="lphase ${lv.goalHit ? "over" : "hold"}">${lv.goalHit ? "Goal reached · keep going" : ex.live || "Hold"}</div><div class="lbig ${lv.goalHit ? "over" : "hold"}" id="livebig"></div>
      <div class="lsub">goal ${dur(lv.goal)}${kgTxt}</div><button class="btn primary lbtn stop" data-act="livestop">■ Stop · log set</button>`;
  else if (lv.phase === "rest") main = `${sideTxt ? `<div class="lside next">Next: ${esc(sideTxt.toLowerCase())}</div>` : ""}<div class="lphase rest">${ex.liveRest || "Rest"} · ${ex.live ? "interval" : "set"} ${setNo} of ${of} next</div><div class="lbig rest" id="livebig"></div>
      <div class="lsub">Last ${ex.live ? "interval" : "set"}: ${dur(lv.held)}${kgTxt}</div><button class="btn lbtn" data-act="liveskiprest">Start next set now</button><button class="btn lbtn" data-act="liveend">End ${esc(ex.name)} here</button>`;
  else main = `<div class="lphase over">All ${of} sets done</div><div class="lsub">${sets.map((x) => dur(x.reps)).join(" · ")}${kgTxt}</div>
      <button class="btn primary lbtn" data-act="liveclose">Next exercise</button>`;
  return `<div class="overlay live"><div class="win">
    <div class="title">${esc(ex.name)} · set ${setNo} of ${of}${sideTxt ? " · " + esc(sideTxt.toLowerCase()) : ""}<button class="x" data-act="liveclose" aria-label="Close">×</button></div>
    <div class="detail lbody">${main}
      ${sets.length ? `<div class="lsets">${sets.map((x, i) => `Set ${L.setNoOf(ex, i + 1)}${L.grp(ex) > 1 ? " · " + sideOf(ex, i + 1).toLowerCase() : ""}: ${dur(x.reps)}${x.kg ? " +" + L.fmtKg(x.kg) + " " + L.unitOf(ex) : ""}`).join("<br>")}</div>` : ""}
    </div></div></div>`;
}

// ---------- rest timer ----------
let timerId = null;
function startRest(sec = db.settings.restSec) {
  ui.restEnd = Date.now() + sec * 1000;
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
  el.innerHTML = esc(text).replace(/ 0:/, ' <span class="z">0</span>:');
  el.classList.toggle("over", over);
  if (ui.restEnd || ui.overUntil > now || warming) timerId = setTimeout(tick, 250);
}

// ---------- actions ----------
const act = {
  screen: (v) => { ui.screen = v; },
  letter: (v) => { ui.letter = v; ui.short = false; setActive(null); },
  wmode: (v) => {
    const s = session(), on = v === "short";
    if (s) { if (on) s.short = true; else delete s.short; persist(); } else ui.short = on;
    if (ui.active && ui.active !== WARM && !items().some((i) => i.ex === ui.active)) setActive(null);
  },
  pick: (v) => { setActive(v); },
  nav: (v) => {
    const order = [WARM, ...items().map((i) => i.ex)];
    const i = Math.max(0, order.indexOf(ui.active)) + (+v);
    setActive(order[Math.min(order.length - 1, Math.max(0, i))]);
  },
  warmup: () => { setActive(WARM); },
  warmstart: () => { const s = ensureSession(); if (!s) return; s.warmStart = new Date().toISOString(); s.warmAt = s.warmStart; s.warmup = false; s.warmSec = 0; persist(); },
  warmstop: () => {
    const s = session(); if (!s || !s.warmStart) return;
    s.warmSec = Math.round((Date.now() - Date.parse(s.warmStart)) / 1000);
    s.warmStart = null; s.warmup = true; persist();
    const n = firstOpenItem(); setActive(n ? n.ex : null);
  },
  warmdone: () => { const s = ensureSession(); if (!s) return; s.warmup = true; s.warmSec = 0; s.warmAt = null; persist(); const n = firstOpenItem(); setActive(n ? n.ex : null); },
  warmex: (v) => { const s = ensureSession(); if (!s) return; s.warmEx = s.warmEx === v ? null : v; persist(); },
  machex: (v) => {
    const s = ensureSession(); if (!s || !ui.active) return;
    const m = (L.entryFor(s, ui.active).machine = L.entryFor(s, ui.active).machine || {});
    m.type = m.type === v ? null : v; persist();
  },
  warmundo: () => { const s = session(); if (!s) return; s.warmup = false; s.warmStart = null; s.warmAt = null; s.warmSec = 0; persist(); },
  inc: (f) => bump(f, 1),
  dec: (f) => bump(f, -1),
  log: () => {
    const item = items().find((i) => i.ex === ui.active);
    const d = draftFor(item);
    const r = logSet(item, d.kg, d.reps); if (!r) return;
    const next = r.p.next && session() && L.itemState(session(), items().find((i) => i.ex === r.p.next)).status === "todo" ? r.p.next : firstOpenItem()?.ex;
    if (next && next !== item.ex) setActive(next);
    if (r.p.sec) startRest(r.p.sec); else { ui.restEnd = null; tick(); }
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
    const early = stopEarly();
    const e = L.entryFor(s, ui.active); e.status = early ? "done" : "skipped"; persist();
    const n = firstOpenItem(); setActive(n ? n.ex : ui.active);
  },
  swap: () => {
    if (!ui.active || ui.active === WARM) return "norender";
    const s = session(), cur = db.exercises[ui.active];
    const logged = s && s.entries[ui.active] ? s.entries[ui.active].sets.length : 0;
    if (logged) { ui.dialog = { title: "Swap " + cur.name, body: `<p>${logged} ${logged === 1 ? "set is" : "sets are"} already logged for it today. Tap “Undo last” until none are left, then swap. Or skip it (F8).</p>` }; return; }
    const taken = items().map((i) => i.ex);
    const opts = Object.entries(db.exercises).filter(([id]) => !taken.includes(id))
      .map(([id, e]) => `<button class="btn wide" data-act="doswap" data-v="${id}">${esc(e.name)}</button>`).join("");
    ui.dialog = { title: `Swap ${cur.name} for…`, ok: false, body: `<p class="small">Today only. The program stays as it is.</p>${opts}<button class="btn wide" data-act="close">Cancel</button>` };
  },
  doswap: (v) => {
    const s = ensureSession(); if (!s) { ui.dialog = null; return; }
    const cur = ui.active, w = workout();
    const xi = (s.extra || []).findIndex((i) => i.ex === cur);
    if (xi >= 0) s.extra[xi] = { ...s.extra[xi], ex: v };
    else {
      const base = L.baseItems(w, s).find((it) => ((s.swaps || {})[it.ex] || it.ex) === cur);
      if (base) { s.swaps = s.swaps || {}; if (v === base.ex) delete s.swaps[base.ex]; else s.swaps[base.ex] = v; if (!Object.keys(s.swaps).length) delete s.swaps; }
    }
    if (s.entries[cur] && !s.entries[cur].sets.length) delete s.entries[cur];
    persist(); setActive(v); ui.dialog = null;
  },
  addtoday: () => {
    const taken = items().map((i) => i.ex);
    const opts = Object.entries(db.exercises).filter(([id]) => !taken.includes(id))
      .map(([id, e]) => `<button class="btn wide" data-act="addtodaynow" data-v="${id}">${esc(e.name)}</button>`).join("");
    ui.dialog = { title: "Add for today", ok: false, body: `<p class="small">Added at the end of today's workout only. The program stays as it is.</p>${opts || "<p>All exercises are already in today's workout.</p>"}<button class="btn wide" data-act="close">Cancel</button>` };
  },
  addtodaynow: (id) => {
    const s = ensureSession(); if (!s) { ui.dialog = null; return; }
    const e = db.exercises[id];
    let ref = null;
    for (const x of Object.values(db.workouts)) { const f = x.items.find((i) => i.ex === id); if (f) { ref = f; break; } }
    const min = ref ? ref.min : e.type === "timed" ? 20 : e.type === "bodyweight" ? 10 : 8;
    const max = ref ? ref.max : e.type === "timed" ? min : e.type === "bodyweight" ? 12 : 10;
    (s.extra = s.extra || []).push({ ex: id, sets: ref ? ref.sets : 3, min, max, today: true });
    persist(); setActive(id); ui.dialog = null;
  },
  guide: () => {
    if (!ui.active || ui.active === WARM) return "norender";
    const ex = db.exercises[ui.active], g = GUIDES[ui.active];
    const per = L.perText(ex);
    const how = howHtml(ui.active);
    // Full-height sheet: text first (readable in the top part of the screen), picture below, blank space last so the picture can be scrolled up into reach
    const id = ui.active, s = session();
    const logged = s && s.entries[id] ? s.entries[id].sets.length : 0;
    const its = items();
    const alts = (ALTS[id] || []).filter((a) => db.exercises[a]);
    const altHtml = alts.length ? alts.map((a) => !its.some((i) => i.ex === a) && !logged
      ? `<button class="btn alt" data-act="doswap" data-v="${a}">${esc(db.exercises[a].name)} <span class="small">· swap today</span></button>`
      : `<span class="altname">${esc(db.exercises[a].name)}</span>`).join("") : `<span class="small">none listed</span>`;
    const wdesc = ex.type === "timed" ? `step ${L.fmtKg(ex.step)} s` : ex.scale && JSON.stringify(ex.scale.values) === JSON.stringify(DB_SCALE.values) ? "dumbbell rack: 1–10 kg, then 12, 14 … 60 kg" : ex.scale && ex.scale.values && ex.scale.values.length ? `scale ${ex.scale.values.slice(0, 4).map(L.fmtKg).join(", ")} … ${L.fmtKg(ex.scale.values[ex.scale.values.length - 1])} ${L.unitOf(ex)}` : `step ${L.fmtKg(ex.step)} kg`;
    ui.dialog = { title: ex.name, sheet: true, ok: false, body: `
      ${per ? `<p class="small">${/^weight/.test(per) ? "Logged " + esc(per) : "Weight and reps are logged " + esc(per)}.</p>` : ""}
      ${how}
      <div class="glbl">Rest between sets</div>
      <div class="frow"><label for="sh_rest">Yours</label><input id="sh_rest" data-ex="${id}" type="text" inputmode="numeric" value="${fmtRest(L.restFor(db, ex))}"><span class="small">${ex.rest ? "" : "default"}</span></div>
      ${REST_TEXT[id] ? `<p class="small">Recommended: ${esc(REST_TEXT[id])}</p>` : ""}
      <div class="glbl">Weight</div>
      <div class="frow"><span class="wdesc">${esc(wdesc)}</span><button class="btn" data-act="exdlg" data-ex="${id}">Edit…</button></div>
      <div class="glbl">Alternatives</div>
      <div class="alts">${altHtml}</div>
      <div class="glbl">Note</div>
      <textarea id="sh_note" data-ex="${id}" rows="3" placeholder="seat height, notch, how it felt…">${esc(ex.note)}</textarea>
      ${imgsHtml(ui.active)}
      <div class="gspace"></div>` };
  },
  mode: (v) => { db.settings.mode = v; persist(); applyMode(); },
  exdlg: (_, el) => {
    const id = el.dataset.ex;
    const isNew = !id;
    const e = isNew ? { name: "", type: "weight", step: 2.5, cue: "", last: null, scale: null } : db.exercises[id];
    const timed = e.type === "timed";
    const cur = e.last ? (timed ? e.last.top : e.last.kg) : "";
    const letters = L.LETTERS.map((l) => `<label><input type="checkbox" class="ex_in" value="${l}"> ${l}</label>`).join("");
    const cat = isNew ? "Other" : catOf(id);
    ui.dialog = { title: isNew ? "Add exercise" : e.name, tags: isNew ? "" : progTags(id), ok: false, body: `
      <div class="frow"><label for="ex_name">Name</label><input id="ex_name" type="text" value="${esc(e.name)}" placeholder="e.g. Cable fly"></div>
      ${isNew ? `<div class="frow"><label for="ex_type">Type</label><select id="ex_type" data-act="extype"><option value="weight">Weight (machine / free)</option><option value="bodyweight">Bodyweight (reps)</option><option value="timed">Timed (seconds)</option></select></div>` : ""}
      <div class="frow"><label for="ex_cur">${timed ? "Current best (s)" : "Current weight (kg)"}</label><input id="ex_cur" type="text" inputmode="decimal" value="${cur === null ? "" : esc(cur)}" placeholder="${timed ? "e.g. 30" : "e.g. 25"}"></div>
      <p class="small">Today's target starts from this. Changing it starts the rep count over at the low end.</p>
      <div class="frow"><label for="ex_step">Step (${timed ? "s" : "kg"})</label><input id="ex_step" type="text" inputmode="decimal" value="${esc(e.step)}"></div>
      <div class="frow"><label for="ex_rest">Rest (s)</label><input id="ex_rest" type="text" inputmode="numeric" value="${e.rest ? esc(e.rest) : ""}" placeholder="default ${db.settings.restSec}"></div>
      <div id="ex_scalebox" ${timed ? "hidden" : ""}>
        <label class="lbl" for="sc_vals">Weight scale (kg, optional)</label>
        <textarea id="sc_vals" rows="3" placeholder="Weights the machine can select, lowest first, separated by spaces. Empty = fixed step.">${esc(e.scale ? e.scale.values.join("  ") : "")}</textarea>
      </div>
      <div class="frow"><label for="ex_cat">Category</label><select id="ex_cat">${CAT_ORDER.map((c) => `<option ${c === cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="frow"><label for="ex_cue">Form cue</label><input id="ex_cue" type="text" value="${esc(e.cue)}" placeholder="one line, optional"></div>
      ${isNew ? `<div class="frow"><label for="ex_range" id="ex_range_lbl">Reps</label><input id="ex_range" type="text" value="8-12" placeholder="8-12"></div>
      <div class="lbl">Add to workout</div><div class="checks">${letters}</div>` : ""}
      <button class="btn primary wide" data-act="exsave" data-ex="${esc(id)}">Save</button>
      <button class="btn wide" data-act="close">Cancel</button>
      ${!isNew && e.custom ? `<button class="btn wide" data-act="exdel" data-ex="${esc(id)}">Delete this exercise</button>` : ""}
      ${isNew ? "" : `<div class="howsep">How-to</div>${howHtml(id)}${REST_TEXT[id] ? `<p class="small">Recommended rest: ${esc(REST_TEXT[id])}</p>` : ""}${imgsHtml(id)}`}` };
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
    const cat = $("#ex_cat").value;
    if (cat && cat !== (CATS[exId] && CAT_ORDER.includes(CATS[exId]) ? CATS[exId] : "Other")) e.cat = cat; else delete e.cat;
    const restN = parseInt($("#ex_rest").value, 10);
    if (restN > 0) e.rest = restN; else delete e.rest;
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
  beeps: (v) => { db.settings.beeps = v === "on"; persist(); },
  progswitch: (v) => {
    const open = L.openSession(db);
    if (open && Object.values(open.entries).some((e) => e.sets.length)) { alert(`Workout ${open.workout} is still open. Finish it first, then switch.`); return "norender"; }
    if (open) delete db.sessions[open.id];
    db.activeProgram = v; db.workouts = db.programs[v].workouts;
    persist(); ui.letter = L.nextLetter(db); setActive(null); ui.restEnd = null;
  },
  progmenu: (v) => {
    const p = db.programs[v], on = v === db.activeProgram;
    ui.dialog = { title: `${p.code} · ${p.name}`, ok: false, body: `
      <button class="btn wide" data-act="progrename" data-v="${v}">Rename…</button>
      <button class="btn wide" data-act="progcopy" data-v="${v}">Copy as a new program…</button>
      ${on ? `<p class="small">The active program can't be deleted. Switch to another one first.</p>` : `<button class="btn wide" data-act="progdel" data-v="${v}">Delete program</button>`}
      <button class="btn wide" data-act="close">Cancel</button>` };
  },
  progrename: (v) => {
    const p = db.programs[v];
    const name = prompt("Program name", p.name); if (name == null || !name.trim()) return "norender";
    const code = prompt("Short code (2–4 letters, shown in the title)", p.code); 
    p.name = name.trim(); if (code && code.trim()) p.code = code.trim().toUpperCase().slice(0, 4);
    persist(); ui.dialog = null;
  },
  progcopy: (v) => {
    const src = db.programs[v];
    const name = prompt("Name of the new program", "Copy of " + src.name); if (name == null || !name.trim()) return "norender";
    const id = "p" + Date.now().toString(36);
    db.programs[id] = { name: name.trim(), code: progCode(name), workouts: JSON.parse(JSON.stringify(src.workouts)) };
    persist(); ui.dialog = null; act.progswitch(id);
  },
  progdel: (v) => {
    const p = db.programs[v];
    if (!confirm(`Delete ${p.name}? Its workout history stays in the log.`)) return "norender";
    p.deleted = true; persist(); ui.dialog = null;
  },
  wrename: (_, el) => {
    const w = db.workouts[el.dataset.l];
    const n = prompt(`Name of workout ${el.dataset.l} (e.g. "Up A - Push": the part before " - " is shown on the button)`, w.name);
    if (n != null && n.trim()) { w.name = n.trim(); persist(); }
  },
  cat: (v) => { if (ui.openCats.has(v)) ui.openCats.delete(v); else ui.openCats.add(v); },
  liveopen: () => {
    const item = items().find((i) => i.ex === ui.active); if (!item) return;
    const d = draftFor(item);
    ui.live = { ex: item.ex, phase: "setup", prep: db.settings.prepSec ?? 10, goal: d.reps, kg: d.kg || 0 };
  },
  livestep: (v, el) => {
    const lv = ui.live, f = el.dataset.f, dir = +v, ex = db.exercises[lv.ex];
    if (f === "prep") lv.prep = Math.min(60, Math.max(0, lv.prep + dir * 5));
    if (f === "goal") lv.goal = Math.max(5, lv.goal + dir * 5);
    if (f === "kg") lv.kg = L.stepWeight(ex, lv.kg, dir);
  },
  livestart: () => { beepInit(); wake(true); const lv = ui.live; db.settings.prepSec = lv.prep; save(db); liveGo(lv.prep ? "prep" : "hold"); },
  livestop: () => {
    const lv = ui.live, item = items().find((i) => i.ex === lv.ex);
    const held = Math.max(1, Math.round((Date.now() - lv.t) / 1000));
    if (ui.draft && ui.draft.ex === lv.ex) ui.draft.kg = lv.kg;
    const r = logSet(item, lv.kg, held); if (!r) return;
    lv.held = held;
    if (r.done) { lv.phase = "done"; ui.restEnd = null; beep(660, 0.25); }
    else {
      const ex = db.exercises[lv.ex], n = r.done ? 0 : L.itemState(session(), item).sets.length;
      // left then right back to back: no rest after the left side, straight to get-ready for the right
      if (sideOf(ex, n) && n % 2 === 1 && ex.per !== "direction") { ui.restEnd = null; liveGo(lv.prep ? "prep" : "hold"); }
      else { const sec = L.restFor(db, ex); startRest(sec); liveGo("rest", sec); }
    }
  },
  liveskiprest: () => { ui.restEnd = null; liveGo(ui.live.prep ? "prep" : "hold"); },
  liveend: () => { // stop the exercise here, keep the sets done
    const lv = ui.live, s = session();
    if (s && s.entries[lv.ex] && s.entries[lv.ex].sets.length) { s.entries[lv.ex].status = "done"; persist(); }
    liveClose(); const n = firstOpenItem(); setActive(n ? n.ex : lv.ex);
  },
  liveclose: () => {
    const lv = ui.live;
    if ((lv.phase === "prep" || lv.phase === "hold") && !confirm("Stop without logging this set?")) return "norender";
    const done = lv.phase === "done";
    liveClose(); if (done) { const n = firstOpenItem(); setActive(n ? n.ex : lv.ex); if (n) startRest(db.settings.restSec); }
  },
  prest: (_, el) => {
    const ex = db.exercises[el.dataset.ex];
    const v = prompt(`Rest after each set of ${ex.name}: seconds or m:ss (e.g. 90 or 2:30). Leave empty for the default ${fmtRest(db.settings.restSec)}.`, ex.rest ? fmtRest(ex.rest) : "");
    if (v == null) return;
    if (v.trim() === "") { delete ex.rest; persist(); return; }
    const sec = parseRest(v);
    if (sec) { ex.rest = sec; persist(); }
    else alert("Use seconds (90) or minutes:seconds (1:30), between 10 s and 15 min.");
  },
  prange: (_, el) => {
    const it = db.workouts[el.dataset.l].items[+el.dataset.i], ex = db.exercises[it.ex];
    if (ex.type === "timed") {
      const v = prompt(ex.fixed ? `Hold time for ${ex.name} (seconds)` : `Starting time for ${ex.name} (seconds). After that the target is your last best + ${ex.step} s.`, it.min);
      const n = parseInt(v, 10);
      if (v != null && n > 0) { it.min = n; it.max = n; persist(); }
      return;
    }
    const v = prompt(`Rep range for ${ex.name} (min-max)`, `${it.min}-${it.max}`);
    const m = v && v.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
    if (v != null && m && +m[1] > 0 && (m[2] == null || +m[2] >= +m[1])) { it.min = +m[1]; it.max = m[2] == null ? +m[1] : +m[2]; persist(); }
    else if (v != null) alert("Use the form 8-10 (or a single number).");
  },
  syncnow: () => { if (!Sync.configured()) { alert("Paste the token first."); return; } Sync.flush(db, true); Sync.fetchNext().then(() => render()); },
  syncrestore: async () => {
    try {
      const remote = await Sync.fetchRemote(); if (!remote) { alert("The repo has no data yet."); return "norender"; }
      const n = missingSessions(db, remote).length;
      if (!confirm(`Add ${n} workout${n === 1 ? "" : "s"} from GitHub to this phone? Everything already on this phone is kept.`)) return "norender";
      db = mergeData(remote, db); save(db); Sync.setConfig({ conflict: 0, err: null, hash: {} });
      pickLetter(); render(); Sync.flush(db, true);
    } catch (e) { alert("Restore failed: " + (e.message || e)); }
    return "norender";
  },
  syncoff: () => { if (confirm("Remove the token from this phone? Nothing in the repo is deleted.")) Sync.setConfig({ token: "", pending: false, err: null }); },
  close: () => { ui.dialog = null; },
  noop: () => "norender",
  focusnote: () => { const n = $("#xnote"); if (n) { n.focus(); n.select(); } return "norender"; },
  rest: () => { const ex = ui.active && ui.active !== WARM ? db.exercises[ui.active] : null; startRest(ex ? L.restFor(db, ex) : undefined); return "norender"; },
  finish: () => {
    const s = session(); if (!s) return;
    const w = workout();
    const st = items().map((it) => L.itemState(s, it).status);
    const done = st.filter((x) => x === "done").length, skipped = st.filter((x) => x === "skipped").length, open = st.length - done - skipped;
    const parts = [`${done} of ${st.length} exercises done`]; if (skipped) parts.push(`${skipped} skipped`); if (open) parts.push(`${open} not done`);
    ui.dialog = { title: `Finish workout ${ui.letter}?`, ok: false, body: `<p>${parts.join(", ")}.</p>
      <p class="small">Your results are saved and become the starting point for next time.</p>
      <button class="btn primary wide" data-act="finishnow">Finish workout</button><button class="btn wide" data-act="close">Keep going</button>` };
  },
  finishnow: () => {
    const s = session(); if (!s) { ui.dialog = null; return; }
    L.finishSession(db, s); persist(); Sync.flush(db);
    ui.letter = L.nextLetter(db); setActive(null); ui.restEnd = null;
    ui.dialog = { title: "Workout logged", body: `<p>Nice. Next time: workout ${ui.letter} · ${esc(workout().name)}.</p>`, ok: true };
  },
  psets: (_, el) => {
    const it = db.workouts[el.dataset.l].items[+el.dataset.i];
    const g = L.grp(db.exercises[it.ex]);
    it.sets = Math.min(5 * g, Math.max(g, it.sets + +el.dataset.d * g)); persist();
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
  const item = items().find((i) => i.ex === ui.active);
  const ex = db.exercises[item.ex];
  const d = draftFor(item);
  if (field === "kg") d.kg = L.stepWeight(ex, d.kg || 0, dir);
  else d.reps = Math.max(1, d.reps + dir * L.repStepOf(ex));
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
  if (t.id === "sh_note") { db.exercises[t.dataset.ex].note = t.value; persist(); }
  if (t.id === "sh_rest") {
    const ex = db.exercises[t.dataset.ex], v = t.value.trim();
    if (v === "") delete ex.rest; else { const sec = parseRest(v); if (sec) ex.rest = sec; else alert("Use seconds (90) or minutes:seconds (1:30), between 10 s and 15 min."); }
    persist(); act.guide(); render();
  }
  if (t.classList.contains("mi")) {
    const s = ensureSession(); if (!s) return;
    const e = L.entryFor(s, t.dataset.ex);
    e.machine = e.machine || {};
    const v = t.value.trim(); if (v) e.machine[t.dataset.f] = v; else delete e.machine[t.dataset.f];
    persist();
  }
  if (t.id === "gnote") { db.settings.globalNote = t.value; persist(); }
  if (t.id === "syncrepo") { const v = t.value.trim().replace(/^https?:\/\/github.com\//, "").replace(/\.git$/, ""); Sync.setConfig({ repo: v, hash: {} }); }
  if (t.id === "synctoken" && t.value.trim()) { Sync.setConfig({ token: t.value.trim(), err: null, hash: {}, pending: true }); t.value = ""; Sync.flush(db, true); }
  if (t.id === "rest") { const n = parseInt(t.value, 10); if (n > 0) { db.settings.restSec = n; persist(); } }
  if (t.id === "importfile" && t.files[0]) {
    t.files[0].text().then((txt) => {
      try { db = importJson(txt); Sync.touch(db); pickLetter(); setActive(null); render(); alert("Backup imported."); }
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

Sync.setListener(() => { if (ui.screen === "settings" && !ui.dialog) render(); });
addEventListener("online", () => { if (Sync.config().pending) Sync.flush(db); Sync.fetchNext().then((ch) => { if (ch) render(); }); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && Sync.config().pending) Sync.flush(db); });
pickLetter();
render();
if (Sync.configured() && Sync.config().pending) Sync.flush(db);
Sync.fetchNext().then((ch) => { if (ch) render(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Sync.fetchNext().then((ch) => { if (ch) render(); }); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
