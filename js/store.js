// Storage layer. Today: the phone's localStorage.
// Later: same shape in Firestore (users/{uid}/exercises, workouts, sessions, settings),
// so only this file changes when we switch.
import { GUIDES } from "./guides.js";
import { SEED_VERSION, PROGRAM_VERSION, seedExercises, extraExercises, seedWorkouts, seedSettings } from "./seed.js";

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
const NAME_REV = 1; // 1: exercise names in Title Case (seed exercises only; custom ones untouched)
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
function migrate(db) {
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
    db.nameRev = NAME_REV;
  }
  return db;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const db = migrate(JSON.parse(raw)); save(db); return db; }
  } catch (e) { console.warn("load failed", e); }
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

export function importJson(text) {
  const db = JSON.parse(text);
  if (!db.exercises || !db.workouts || !db.sessions) throw new Error("Not a GymLog backup");
  migrate(db);
  save(db);
  return db;
}
