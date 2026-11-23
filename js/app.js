import { load, save, exportJson, importJson } from "./store.js";
import * as L from "./logic.js";
import { GUIDES } from "./guides.js";
import * as Sync from "./sync.js";
import { ALTS } from "./alts.js";

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
  return s && s.workout === ui.letter ? s : null;
}
function workout() { return db.workouts[ui.letter]; }
const items = () => L.sessionItems(workout(), session()); // today's exercises (program + today-only swaps/additions)

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
  return s;
}

// ---------- render ----------
function render() {
  const app = $("#app");
  const scroll = app.querySelector(".body")?.scrollTop || 0;
  const today_ = ui.screen === "today";
  app.innerHTML = `
    <header class="title"><span class="ttl">GymLog – ${today_ ? `Workout ${ui.letter} · ${esc(workout().name)}` : ui.screen === "programs" ? "Programs" : "Settings"}</span><span class="restclock" id="restclock"></span></header>
    <main class="body">${today_ ? today() : ui.screen === "programs" ? programs() : settings()}</main>
    <footer>
      ${today_ ? fkeys() : ""}
      <nav class="menu">
        <button data-act="screen" data-v="today" class="${ui.screen === "today" ? "on" : ""}"><u>T</u>oday</button>
        <button data-act="screen" data-v="programs" class="${ui.screen === "programs" ? "on" : ""}"><u>P</u>rograms</button>
        <button data-act="screen" data-v="settings" class="${ui.screen === "settings" ? "on" : ""}"><u>S</u>ettings</button>
      </nav>
      ${today_ ? drivesBar() + `<div class="cmdline"><label for="gnote">Note (all)&gt;</label><input id="gnote" value="${esc(db.settings.globalNote)}"></div>` : ""}
    </footer>
    ${ui.dialog ? dialog() : ""}`;
  const b = app.querySelector(".body");
  if (b) b.scrollTop = scroll;
  app.querySelectorAll("img.gimg").forEach(wireImg);
  tick();
}

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
    return `<button class="drive ${l === ui.letter ? "sel" : ""}" data-act="letter" data-v="${l}" aria-label="Workout ${l}${isDone ? ", done" : ""}">${I.disk}${l}${isDone ? '<b class="ok">✓</b>' : ""}</button>`;
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
  const wInfo = warm ? (wAt && s.warmSec ? `${wAt} · ${wMin}` : wMin) : warming ? `${wAt} · running` : "walk / bike";
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
      <span class="ic">${ic}</span><span class="nm">${esc(ex.name)}${it.ss ? '<i class="tag">SS</i>' : ""}${it.opt ? '<i class="tag">opt</i>' : ""}${it.today ? '<i class="tag">today</i>' : ""}</span><span>${esc(info)}</span><span>${st.sets.length}/${it.sets}</span></button>`);
  });

  const allClosed = doneCount === its.length;
  const fin = allClosed || s ? `<button class="btn finish ${allClosed ? "primary" : ""}" data-act="finish">${allClosed ? "Finish workout " + ui.letter : "Finish workout early"}</button>` : "";
  const dt = ui.active === WARM ? warmDetail() : ui.active ? detail() : { top: "", info: "" };
  // Phone sits in a pouch, only the top ~4/7 of the screen is reachable: controls first, reading next, the list last.
  return `
    ${dt.top}
    ${allClosed ? fin : ""}
    ${dt.info}
    <div class="pathbar">▾ <span>gym:\\${esc(w.name.replace(/\s+/g, ""))}\\*.*</span><span class="right">${L.sessionCountFor(db, ui.letter)} ${L.sessionCountFor(db, ui.letter) === 1 ? "session" : "sessions"} logged</span></div>
    <div class="panel">
      <div class="thead"><span></span><span>Name</span><span>Today</span><span>Sets</span></div>
      ${rows.join("")}
      <div class="status">${doneCount} / ${its.length} exercises done${s ? "" : " · not started"}</div>
    </div>
    ${allClosed ? "" : fin}`;
}

function exhead(title, sub) {
  return `<div class="exhead">
    <button class="btn nav" data-act="nav" data-v="-1" aria-label="Previous exercise">◂</button>
    <div class="exname">${title}${sub ? `<small>${sub}</small>` : ""}</div>
    <button class="btn nav" data-act="nav" data-v="1" aria-label="Next exercise">▸</button></div>`;
}

// Some sets logged but fewer than planned: F8 ends the exercise early (keeps the sets) instead of skipping it
function stopEarly() {
  const s = session();
  const e = s && ui.active && ui.active !== WARM ? s.entries[ui.active] : null;
  return !!(e && e.sets.length && L.itemState(s, items().find((i) => i.ex === ui.active) || { ex: ui.active, sets: 99 }).status === "todo");
}

function fkeys() {
  return `<div class="fkeys">
      <button class="btn" data-act="guide">F3 Guide</button>
      <button class="btn" data-act="addtoday">F4 Add</button>
      <button class="btn" data-act="rest">F5 Timer</button>
      <button class="btn" data-act="swap">F6 Swap</button>
      <button class="btn" data-act="skip">${stopEarly() ? "F8 Done" : "F8 Skip"}</button>
    </div>`;
}

const WARM = "__warm";
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

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
        <div class="last">${done ? (s.warmSec ? "Warm-up done · " + fmtClock(s.warmSec) + (s.warmAt ? " · started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "") : "Warm-up done") : running && s.warmAt ? "Started " + new Date(s.warmAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) + " · target 5–10 min" : "Target 5–10 min · easy walk or bike, enough to feel warm"}</div>
        ${done ? `<button class="btn" data-act="warmundo">Undo warm-up</button>`
          : running ? `<button class="btn primary log" data-act="warmstop">Stop · warm-up done</button>`
          : `<button class="btn primary log" data-act="warmstart">Start warm-up</button><button class="btn" data-act="warmdone">Mark done (no timer)</button>`}
        ${elapsed >= 300 && running ? `<div class="hint">5 min reached. Stop whenever you feel warm.</div>` : ""}
      </div>
    </div>`;
  return { top, info: "" };
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

  const hand = ex.per === "hand" ? "/hand" : "";
  const tgt = timed
    ? (ex.fixed ? `Today: ${item.sets} × ${t.reps} s${t.kg ? " +" + L.fmtKg(t.kg) + " " + L.unitOf(ex) : ""}`
      : t.first ? `First time: start at ${t.reps} s` : `Today: ${item.sets} × ${t.reps} s ↑`)
    : t.first
      ? (ex.type === "bodyweight" ? `First time: ${item.min}–${item.max} reps per set, stop about 1 rep before failure` : `First time: pick a weight that leaves 3–4 reps in reserve`)
      : `Today: ${t.kg ? L.fmtKg(t.kg) + " " + L.unitOf(ex) + hand : "BW"} · ${item.sets} × ${L.rangeText(ex, item)}${t.up ? " ↑" : ""}`;

  const logged = st.sets.map((x, i) => `<div class="logged">[x] Set ${i + 1} · ${timed ? x.reps + " s" + (x.kg ? " +" + L.fmtKg(x.kg) + " " + L.unitOf(ex) : "") : (x.kg ? L.fmtKg(x.kg) + " " + L.unitOf(ex) : "BW") + " × " + x.reps + (ex.repUnit ? " " + ex.repUnit : "")}</div>`).join("");

  const stepper = (field, label, val, color, cap) => `
    <div class="stepper"><div class="cap">${cap}</div><div class="sr">
      <button class="btn sq" aria-label="Less ${label}" data-act="dec" data-v="${field}">${I.minus}</button>
      <div class="val" style="color:${color}">${val}</div>
      <button class="btn sq" aria-label="More ${label}" data-act="inc" data-v="${field}">${I.plus}</button></div></div>`;

  const kgVal = d.kg == null || d.kg === 0 ? (ex.type === "weight" ? "0" : "BW") : L.fmtKg(d.kg);
  // Hint line: manual-progression cases keep their advice; superset items name their partner; the rest list alternatives.
  const its = items(), ix = its.findIndex((i) => i.ex === item.ex);
  const partner = item.ss ? (its[ix + 1] && its[ix + 1].ss && !(its[ix - 1] && its[ix - 1].ss) ? its[ix + 1] : its[ix - 1] && its[ix - 1].ss ? its[ix - 1] : null) : null;
  const alts = (ALTS[item.ex] || []).filter((id) => db.exercises[id] && !its.some((i) => i.ex === id)).slice(0, 2).map((id) => db.exercises[id].name);
  const hint = timed
    ? (ex.fixed ? `Hold ${item.min} s. Once it is easy, add weight with the + button.` : `Next time: beat your best by +${ex.step} s`)
    : ex.type === "bodyweight" && !(t.kg > 0)
      ? `Top of the range on every set (${item.max}) → add reps, weight or a new range yourself.`
      : partner ? `Superset with ${db.exercises[partner.ex].name}: alternate sets.`
      : alts.length ? `Alternative: ${alts.join(" or ")} (F6 Swap).` : "";

  const top = `
    <div class="panel">
      ${exhead(esc(ex.name), st.status === "skipped" ? "skipped" : finished ? "done" : `Set ${setNo} of ${item.sets}`)}
      <div class="detail">
        ${finished ? `<button class="btn" data-act="undo">Undo last</button>` : `
          <div class="steppers">
            ${timed && !ex.fixed ? "" : stepper("kg", "weight", kgVal, "var(--blue)", ex.scale ? `${L.unitOf(ex).toUpperCase()} · machine scale` : `${L.unitOf(ex).toUpperCase()}${ex.per === "hand" ? " · per hand" : ""} · step ${L.fmtKg(timed ? ex.wstep || 2.5 : ex.step)}`)}
            ${stepper("reps", timed ? "seconds" : L.repCap(ex).toLowerCase(), d.reps, "var(--green)", L.repCap(ex))}
          </div>
          <div class="logrow"><button class="btn primary log" data-act="log">Log set ${setNo} · then rest ${fmtRest(L.restFor(db, ex))}</button>
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
        <div class="noterow"><label for="xnote">Note</label><input id="xnote" data-ex="${item.ex}" value="${esc(ex.note)}" placeholder="seat height, notch, how it felt…"></div>
        ${hint ? `<div class="hint">${esc(hint)}</div>` : ""}
      </div>
    </div>`;
  return { top, info };
}

const fmtRest = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function programs() {
  return L.LETTERS.map((l) => {
    const w = db.workouts[l];
    return `<div class="panel">
      <div class="pathbar">▾ gym:\\${l} · ${esc(w.name)}</div>
      <div class="thead prog"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Step</span><span></span></div>
      ${w.items.map((it, i) => {
        const ex = db.exercises[it.ex];
        const timed = ex.type === "timed";
        return `<div class="prow ${i % 2 ? "" : "alt"}"><span class="nmcell"><span class="nm">${esc(ex.name)}${it.ss ? '<i class="tag">SS</i>' : ""}${it.opt ? '<i class="tag">opt</i>' : ""}</span><button class="restbtn ${ex.rest ? "custom" : ""}" data-act="prest" data-ex="${it.ex}" aria-label="Rest time for ${esc(ex.name)}">rest ${fmtRest(L.restFor(db, ex))}</button></span>
          <span class="mini"><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="-1" aria-label="Fewer sets">−</button><b>${it.sets}</b><button class="btn" data-act="psets" data-l="${l}" data-i="${i}" data-d="1" aria-label="More sets">+</button></span>
          <span><button class="btn stepbtn" data-act="prange" data-l="${l}" data-i="${i}" aria-label="Edit reps">${timed ? it.min + (ex.fixed ? "s" : "s+") : it.min === it.max ? it.min : it.min + "–" + it.max}</button></span>
          <span>${ex.scale ? `<button class="btn stepbtn" data-act="exdlg" data-ex="${it.ex}">scale</button>` : `<button class="btn stepbtn" data-act="pstep" data-ex="${it.ex}">${L.fmtKg(ex.step)}${timed ? "s" : ""}</button>`}</span>
          <span><button class="btn stepbtn xbtn" data-act="premove" data-l="${l}" data-i="${i}" aria-label="Remove ${esc(ex.name)} from workout ${l}">×</button></span></div>`;
      }).join("")}
      <div class="status"><button class="btn" data-act="allsets" data-l="${l}">All to 3 sets</button> <button class="btn" data-act="padd" data-l="${l}">+ Add exercise</button></div>
    </div>`;
  }).join("") + `<p class="small">Tap “rest” under a name to set the rest time for that exercise (it applies wherever the exercise is used; default is set in Settings). Tap reps to change the range, a step size to change it (one machine notch), or “scale” for machines with a weight stack. Timed exercises: “60s” is a fixed hold time (plank); “20s+” is a starting time, then the target is your last best + the step. SS = superset with the next row.</p>`;
}

function syncPanel() {
  const c = Sync.config(), on = Sync.configured();
  const when = c.last ? new Date(c.last).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : null;
  const status = Sync.busyNow() ? "Syncing…" : c.err ? `<span class="m-bad">Not synced: ${esc(c.err)}</span>` : on ? (c.pending ? "Changes not sent yet (sent when you finish a workout or leave the app)" : `Synced ${when}`) : "Off";
  return `<p class="small">Copies your results to a private GitHub repo (gymlog.json + a readable log.md) so they can be read without exporting. Needs a repo and a fine-grained token with Contents: read and write on that repo only. The token stays on this phone and is not part of backups.</p>
    <div class="noterow"><label for="syncrepo">Repo</label><input id="syncrepo" value="${esc(c.repo)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <div class="noterow"><label for="synctoken">Token</label><input id="synctoken" type="password" value="" placeholder="${on ? "saved (paste to replace)" : "github_pat_…"}" autocomplete="off"></div>
    <p class="small">${status}</p>
    <button class="btn" data-act="syncnow">Sync now</button>${on ? '<button class="btn" data-act="syncoff">Remove token</button>' : ""}`;
}

function settings() {
  return `<div class="panel"><div class="pathbar">▾ gym:\\settings</div><div class="detail">
    <div class="noterow"><label for="rest">Rest (s)</label><input id="rest" type="number" inputmode="numeric" value="${db.settings.restSec}"></div>
    <div class="setlabel">Appearance</div>
    <div class="seg">${MODES.map((m) => `<button class="btn ${(db.settings.mode || "auto") === m ? "primary" : ""}" data-act="mode" data-v="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>
    <div class="setlabel">Exercises</div>
    <p class="small">Tap one to change its name, step, current weight or weight scale.</p>
    <div class="scales">${Object.entries(db.exercises).map(([id, e]) => {
      const mode = e.type !== "timed" && e.scale && e.scale.values.length ? `<span class="m-scale">scale</span>` : `<span class="m-step">step ${L.fmtKg(e.step)} ${e.type === "timed" ? "s" : "kg"}</span>`;
      return `<button class="srow" data-act="exdlg" data-ex="${id}"><span class="nm">${esc(e.name)}</span><span class="rt"><span class="m-wt">${esc(L.currentText(e))}</span> · ${mode}</span></button>`;
    }).join("")}</div>
    <button class="btn" data-act="exdlg" data-ex="">+ Add exercise…</button>
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
    <div class="title">${esc(d.title)}<button class="x" data-act="close" aria-label="Close">×</button></div>
    <div class="detail">${d.body}${d.ok === false ? "" : '<button class="btn primary wide" data-act="close">OK</button>'}</div></div></div>`;
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
  el.textContent = text;
  el.classList.toggle("over", over);
  if (ui.restEnd || ui.overUntil > now || warming) timerId = setTimeout(tick, 250);
}

// ---------- actions ----------
const act = {
  screen: (v) => { ui.screen = v; },
  letter: (v) => { ui.letter = v; setActive(null); },
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
  warmundo: () => { const s = session(); if (!s) return; s.warmup = false; s.warmStart = null; s.warmAt = null; s.warmSec = 0; persist(); },
  inc: (f) => bump(f, 1),
  dec: (f) => bump(f, -1),
  log: () => {
    const s = ensureSession(); if (!s) return;
    const item = items().find((i) => i.ex === ui.active);
    const ex = db.exercises[item.ex];
    const d = draftFor(item);
    const e = L.entryFor(s, item.ex);
    e.sets.push({ kg: ex.type === "timed" && !ex.fixed ? null : (d.kg || 0), reps: d.reps });
    if (e.sets.length >= item.sets) { e.status = "done"; persist(); const n = firstOpenItem(); setActive(n ? n.ex : item.ex); }
    else persist();
    startRest(L.restFor(db, ex));
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
      const base = w.items.find((it) => ((s.swaps || {})[it.ex] || it.ex) === cur);
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
    const imgs = [1, 2].map((n) => `<img class="gimg" src="img/${ui.active}-${n}.webp" alt="${esc(ex.name)}, picture ${n}" hidden>`).join("");
    const how = g ? `
      <p class="gcue">${esc(g.cue)}</p>
      <div class="glbl">How</div>
      <ol class="gsteps">${g.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="glbl bad">Common mistakes</div>
      <p class="gbad">${esc(g.mistakes)}</p>` : `<p class="gcue">${esc(ex.cue)}</p>`;
    // Full-height sheet: text first (readable in the top part of the screen), picture below, blank space last so the picture can be scrolled up into reach
    ui.dialog = { title: ex.name, sheet: true, ok: false, body: `
      ${per ? `<p class="small">Weight and reps are logged ${esc(per)}.</p>` : ""}
      ${how}
      ${ex.note ? `<p class="notecol">Note: ${esc(ex.note)}</p>` : ""}
      <div class="gimgs gwrap"><div class="guideimg ph">Image coming</div>${imgs}</div>
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
    ui.dialog = { title: isNew ? "Add exercise" : e.name, ok: false, body: `
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
  prest: (_, el) => {
    const ex = db.exercises[el.dataset.ex];
    const v = prompt(`Rest after each set of ${ex.name}: seconds or m:ss (e.g. 90 or 2:30). Leave empty for the default ${fmtRest(db.settings.restSec)}.`, ex.rest ? fmtRest(ex.rest) : "");
    if (v == null) return;
    if (v.trim() === "") { delete ex.rest; persist(); return; }
    const m = v.trim().match(/^(?:(\d+):(\d{1,2})|(\d+))$/);
    const sec = m ? (m[3] != null ? +m[3] : +m[1] * 60 + +m[2]) : 0;
    if (sec >= 10 && sec <= 900) { ex.rest = sec; persist(); }
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
  syncnow: () => { if (!Sync.configured()) { alert("Paste the token first."); return; } Sync.flush(db, true); },
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
addEventListener("online", () => { if (Sync.config().pending) Sync.flush(db); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && Sync.config().pending) Sync.flush(db); });
pickLetter();
render();
if (Sync.configured() && Sync.config().pending) Sync.flush(db);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
