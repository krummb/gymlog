// Storage layer. The device's localStorage is the instant, offline copy the UI reads and writes.
// sync.js mirrors it to Firestore when signed in (users/{uid}/data/config + users/{uid}/sessions/{key}).
import { SEED_VERSION, seedExercises, seedWorkouts, seedSettings } from "./seed.js";
import { push } from "./sync.js";

const KEY = "gymlog.v1";
const clone = (o) => JSON.parse(JSON.stringify(o));

function fresh() {
  const exercises = {};
  for (const [id, e] of Object.entries(seedExercises)) exercises[id] = { ...clone(e), note: "", last: null };
  return { seed: SEED_VERSION, exercises, workouts: clone(seedWorkouts), sessions: {}, settings: clone(seedSettings) };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("load failed", e); }
  const db = fresh();
  save(db);
  return db;
}

// Device only (also used when applying changes that came from Firestore).
export function saveLocal(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert("Could not save on this device: " + e.message); }
}

// Device first (instant, works offline), then mirror to Firestore when signed in.
export function save(db) {
  saveLocal(db);
  push();
}

export function exportJson(db) {
  return JSON.stringify(db, null, 2);
}

export function importJson(text) {
  const db = JSON.parse(text);
  if (!db.exercises || !db.workouts || !db.sessions) throw new Error("Not a GymLog backup");
  save(db);
  return db;
}
