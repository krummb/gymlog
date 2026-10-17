// Storage layer. Today: the phone's localStorage.
// Later: same shape in Firestore (users/{uid}/exercises, workouts, sessions, settings),
// so only this file changes when we switch.
import { SEED_VERSION, seedExercises, seedWorkouts, seedSettings } from "./seed.js";

const KEY = "gymlog.v1";
const clone = (o) => JSON.parse(JSON.stringify(o));

function fresh() {
  const exercises = {};
  for (const [id, e] of Object.entries(seedExercises)) exercises[id] = { ...clone(e), note: "", last: null };
  return { seed: SEED_VERSION, exercises, workouts: clone(seedWorkouts), sessions: {}, settings: clone(seedSettings) };
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

// Bring older saved data up to date: add exercises/scales that the seed has and the saved data lacks
function migrate(db) {
  mergeExercises(db);
  for (const [id, e] of Object.entries(seedExercises)) {
    if (!db.exercises[id]) db.exercises[id] = { ...clone(e), note: "", last: null };
    else if (e.scale && !("scale" in db.exercises[id])) db.exercises[id].scale = clone(e.scale);
    else if (e.scale && db.exercises[id].scale && db.exercises[id].scale.unit !== e.scale.unit
      && JSON.stringify(db.exercises[id].scale.values) === JSON.stringify(e.scale.values)) db.exercises[id].scale.unit = e.scale.unit; // unit corrected (lb -> kg), values untouched
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
