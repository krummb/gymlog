// Storage layer. Today: the phone's localStorage.
// Later: same shape in Firestore (users/{uid}/exercises, workouts, sessions, settings),
// so only this file changes when we switch.
import { GUIDES } from "./guides.js";
import { SEED_VERSION, PROGRAM_VERSION, DB_SCALE, seedExercises, extraExercises, skatingWorkouts, seedWorkouts, seedSettings } from "./seed.js";

const KEY = "gymlog.v1";
const clone = (o) => JSON.parse(JSON.stringify(o));

// A new exercise from the seed; "start" becomes a typed baseline ("Start: 10 kg")
function newEx(e, id) {
  const { start, ...rest } = clone(e);
  const x = { ...rest, note: "", last: null };
  if (GUIDES[id]) x.cue = GUIDES[id].cue;
  if (start != null) x.last = baseline(x, start);
  return x;
}
const baseline = (ex, v) => ({ date: new Date().toISOString(), kg: ex.type === "timed" ? null : v, sets: [{ kg: ex.type === "timed" ? null : v, reps: ex.type === "timed" ? v : 0 }], top: ex.type === "timed" ? v : 0, baseline: true });

function fresh() {
  const exercises = {};
  for (const [id, e] of Object.entries({ ...seedExercises, ...extraExercises })) exercises[id] = newEx(e, id);
  return { seed: SEED_VERSION, program: PROGRAM_VERSION, guideRev: GUIDE_REV, nameRev: NAME_REV, exercises, workouts: clone(seedWorkouts), sessions: {}, settings: clone(seedSettings) };
}

// Exercises that turned out to be the same machine: [from, to]
const MERGES = [["seated_ham_curl", "ham_curl"]];

function mergeExercises(db) {
  for (const [from, to] of MERGES) {
    const a = db.exercises[from];
    if (!a) continue;
    const b = db.exercises[to];
    if (b) {
      if (a.last && (!b.last || (a.last.date || "") > (b.last.date || ""))) b.last = a.last; // keep the most recent result
      if (!b.note && a.note) b.note = a.note;
      if (!b.scale && a.scale) b.scale = a.scale;
    } else db.exercises[to] = a;
    delete db.exercises[from];
    for (const w of Object.values(db.workouts)) for (const it of w.items) if (it.ex === from) it.ex = to;
    for (const s of Object.values(db.sessions)) {
      if (s.entries && s.entries[from]) { s.entries[to] = s.entries[to] || s.entries[from]; delete s.entries[from]; }
    }
  }
}

// Program v2 (2026-11-19): the free-weight program replaces workouts A-D once.
// Exercises that already exist keep their results, note, step and scale; only name, type, cue and the
// new fields (per, repUnit, rest, fixed...) are taken from the seed. The old A-D are kept in db.archive.
// Bump when guides.js cues change and should replace the saved one-line cues (once)
const GUIDE_REV = 1;
const REST_REV = 1; // 1: program exercises get the rest times from the PT how-tos; dumbbell exercises get the dumbbell rack scale (only where nothing is set)
const PROG_REV = 5; // 4: skating doc revision 2026-11-24 (intervals ladder level 1 first in S2, straight-arm pulldown + Z2 20 min in S4)
// 3 was: // 3: Hammer Curl named "DB Hammer Curl" (user had renamed it to Cable by mistake)
// 2 was: // 2: PT review 2026-11-23: deadlift 3 sets, farmer's carry 40-50 m, Glute Press merged into the old glute_bridge entry (keeps its 46 kg history), shorter leg-curl cue
// 1: Low B uses the Prone Cable Leg Curl instead of the machine Leg Curl (2026-11-23)
const NAME_REV = 2; // 2: also older built-in exercises (chest press, leg press …) in Title Case // 1: exercise names in Title Case (seed exercises only; custom ones untouched)
const PATCH = ["name", "type", "cue", "per", "repUnit", "repStep", "rest", "fixed", "wstep"];
function applyProgram(db) {
  if ((db.program || 1) >= PROGRAM_VERSION) return;
  for (const [id, seed] of Object.entries(seedExercises)) {
    const ex = db.exercises[id];
    if (!ex) continue;
    for (const k of PATCH) { if (k in seed) ex[k] = seed[k]; else delete ex[k]; }
    if (!ex.last && seed.start != null) ex.last = baseline(ex, seed.start);
  }
  db.archive = db.archive || {};
  db.archive.program1 = { savedAt: new Date().toISOString(), workouts: db.workouts };
  db.workouts = clone(seedWorkouts);
  db.program = PROGRAM_VERSION;
}

// Bring older saved data up to date: add exercises/scales that the seed has and the saved data lacks
// Programs (0.14.0): db.programs = { <id>: { name, code, workouts: {A..D}, deleted? } }, db.activeProgram.
// db.workouts always points at the active program's workouts (same object), so the rest of the app needs no change.
const linkActive = (db) => { if (db.programs && db.programs[db.activeProgram]) db.workouts = db.programs[db.activeProgram].workouts; };

function migrate(db) {
  linkActive(db);
  mergeExercises(db);
  applyProgram(db);
  for (const [id, e] of Object.entries({ ...seedExercises, ...extraExercises })) {
    if (!db.exercises[id]) db.exercises[id] = newEx(e, id);
    else if (e.scale && !("scale" in db.exercises[id])) db.exercises[id].scale = clone(e.scale);
    else if (e.scale && db.exercises[id].scale && db.exercises[id].scale.unit !== e.scale.unit
      && JSON.stringify(db.exercises[id].scale.values) === JSON.stringify(e.scale.values)) db.exercises[id].scale.unit = e.scale.unit; // unit corrected (lb -> kg), values untouched
  }
  if ((db.guideRev || 0) < GUIDE_REV) {
    for (const [id, g] of Object.entries(GUIDES)) if (db.exercises[id]) db.exercises[id].cue = g.cue;
    db.guideRev = GUIDE_REV;
  }
  if ((db.nameRev || 0) < NAME_REV) {
    for (const [id, e] of Object.entries({ ...seedExercises, ...extraExercises })) if (db.exercises[id]) db.exercises[id].name = e.name;
    const tc = (n) => n.replace(/[A-Za-z][A-Za-z']*/g, (w) => (w.length > 1 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1)));
    for (const [id, x] of Object.entries(db.exercises)) if (!x.custom && !seedExercises[id] && !extraExercises[id]) x.name = tc(x.name);
    db.nameRev = NAME_REV;
  }
  for (const [id, e] of Object.entries({ ...seedExercises, ...extraExercises })) if (e.handKg && db.exercises[id]) db.exercises[id].handKg = true;
  if ((db.restRev || 0) < REST_REV) {
    for (const [id, e] of Object.entries({ ...seedExercises, ...extraExercises })) {
      const x = db.exercises[id]; if (!x) continue;
      if (e.rest && !x.rest) x.rest = e.rest;
      if (e.scale === DB_SCALE && !(x.scale && x.scale.values && x.scale.values.length)) x.scale = clone(DB_SCALE);
    }
    if (db.settings.prepSec == null) db.settings.prepSec = 10;
    db.restRev = REST_REV;
  }
  if ((db.progRev || 0) < 1) {
    const d = db.workouts && db.workouts.D;
    if (d) d.items = d.items.map((i) => (i.ex === "ham_curl" ? { ex: "prone_leg_curl", sets: 3, min: 12, max: 15 } : i));
    db.progRev = 1;
  }
  if ((db.progRev || 0) < 2) {
    const d = db.workouts && db.workouts.D;
    if (d) d.items = d.items.map((i) => i.ex === "deadlift" && i.sets === 2 ? { ...i, sets: 3 } : i.ex === "farmers_carry" && i.min === 30 && i.max === 30 ? { ...i, min: 40, max: 50 } : i);
    const pc = db.exercises.prone_leg_curl;
    if (pc && /Start light, about 10 kg/.test(pc.cue || "")) pc.cue = seedExercises.prone_leg_curl.cue;
    const gp = db.exercises.glute_press, gb = db.exercises.glute_bridge;
    const usedGp = Object.values(db.sessions).some((x) => x.entries.glute_press) || Object.values(db.workouts).some((w) => w.items.some((it) => it.ex === "glute_press"));
    if (gb && gp && !gp.last && !usedGp) {
      gb.type = "weight"; gb.name = gp.name; gb.cue = gp.cue; gb.rest = gb.rest || gp.rest;
      delete db.exercises.glute_press;
    } else if (gp && !gb) { db.exercises.glute_bridge = gp; delete db.exercises.glute_press; }
    db.progRev = 2;
  }
  if ((db.progRev || 0) < 3) {
    const hc = db.exercises.hammer_curl;
    if (hc && /^(Cable )?Hammer Curl$/i.test(hc.name)) hc.name = "DB Hammer Curl";
    db.progRev = 3;
  }
  if (!db.programs) {
    db.programs = { fw4: { name: "4-Day Free Weight", code: "FW4", workouts: db.workouts } };
    const old = db.archive && db.archive.program1;
    if (old && old.workouts) db.programs.mx4 = { name: "Machines (old)", code: "MX4", workouts: clone(old.workouts) };
    db.activeProgram = "fw4";
    for (const s of Object.values(db.sessions)) if (!s.program) s.program = old && old.savedAt && s.startedAt < old.savedAt ? "mx4" : "fw4";
  }
  if (!db.programs.sk4 && !db.skatingAdded) { db.programs.sk4 = { name: "Skating (pre-season)", code: "SK4", workouts: clone(skatingWorkouts) }; db.skatingAdded = true; }
  if (!db.programs[db.activeProgram]) db.activeProgram = Object.keys(db.programs)[0];
  if ((db.progRev || 0) < 4 && db.programs && db.programs.sk4) {
    const w = db.programs.sk4.workouts;
    w.B = clone(skatingWorkouts.B);
    const d = w.D.items;
    if (!d.some((i) => i.ex === "straight_arm_pulldown")) { const k = d.findIndex((i) => i.ex === "reverse_fly"); d.splice(k + 1, 0, { ex: "straight_arm_pulldown", sets: 2, min: 12, max: 15 }); }
    d.forEach((i) => { if (i.ex === "cardio_z2" && i.min === 1800) { i.min = 1200; i.max = 1200; } });
    const c = db.exercises.cardio_4x4;
    if (c && /^Cardio Intervals 4x4/.test(c.name)) { c.name = "Cardio Intervals (SkiErg/Rower)"; c.rest = 120; c.cue = GUIDES.cardio_4x4.cue; }
    const z = db.exercises.cardio_z2; if (z) z.cue = GUIDES.cardio_z2.cue;
  }
  if ((db.progRev || 0) < 5 && db.programs && db.programs.sk4) {
    // 5: skating doc 2026-11-25: S1 leg curl is the Stability Ball Leg Curl (2 × 10-12)
    for (const it of db.programs.sk4.workouts.A.items) if (it.ex === "prone_leg_curl") Object.assign(it, { ex: "ball_leg_curl", sets: 2, min: 10, max: 12 });
  }
  if (db.programs && db.programs.sk4) db.progRev = Math.max(db.progRev || 0, 5);
  linkActive(db);
  return db;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const db = migrate(JSON.parse(raw)); save(db); return db; }
  } catch (e) {
    console.warn("load failed", e);
    // Never lose data to a bug: keep the unreadable copy before starting fresh
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY + ".broken-" + Date.now(), raw); } catch (_) {}
  }
  const db = fresh();
  migrate(db);
  save(db);
  return db;
}

export function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert("Could not save on this device: " + e.message); }
}

export function exportJson(db) {
  return JSON.stringify(db, null, 2);
}

// Merge two copies of the data (e.g. the repo's and this phone's): every session from both, and for each exercise
// the newer real result. Names, notes, settings, rest, scales and programs come from `base` (the fuller history);
// anything only `extra` has is added. Returns migrated data.
export function mergeData(base, extra) {
  const m = migrate(clone(base)), x = migrate(clone(extra));
  for (const [id, s] of Object.entries(x.sessions)) if (!m.sessions[id]) m.sessions[id] = s;
  for (const [id, e] of Object.entries(x.exercises)) {
    const b = m.exercises[id];
    if (!b) { m.exercises[id] = e; continue; }
    const real = (l) => l && !l.baseline && l.date;
    if (real(e.last) && (!real(b.last) || e.last.date > b.last.date)) b.last = e.last;
  }
  for (const [id, p] of Object.entries(x.programs || {})) if (!m.programs[id]) m.programs[id] = p;
  if (x.activeProgram && m.programs[x.activeProgram]) m.activeProgram = x.activeProgram;
  return migrate(m);
}

// Finished sessions in `remote` that `local` doesn't have (sync refuses to overwrite those)
export const missingSessions = (local, remote) => Object.values(remote.sessions || {}).filter((s) => s.finishedAt && !(local.sessions || {})[s.id]);

export function importJson(text) {
  const db = JSON.parse(text);
  if (!db.exercises || !db.workouts || !db.sessions) throw new Error("Not a GymLog backup");
  migrate(db);
  save(db);
  return db;
}
